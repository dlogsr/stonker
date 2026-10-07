import { Router } from 'express';
import { fetchYahooChart, ChartPoint } from './yahoo-chart.js';
import { scoreSentiment, getStockTwitsTrendingSummary } from './sentiment.js';

export const redditWsbRouter = Router();

interface ApeWisdomResult {
  rank: number;
  ticker: string;
  name: string;
  mentions: number | string;
  upvotes: number | string;
  rank_24h_ago: number | string;
  mentions_24h_ago: number | string;
}

export interface WsbBet {
  rank: number;
  symbol: string;
  name: string;
  trendScore: number;
  summary?: string;
  marketCap?: string;
  threadsUrl: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  bullPct: number;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  chart: ChartPoint[];
  messageCount: number;
  totalLikes: number;
  topMessages: { body: string; sentiment: string; likes: number; url: string }[];
}

/** ApeWisdom aggregates real-time r/wallstreetbets ticker mentions — no Reddit auth needed. */
async function fetchApeWisdom(): Promise<ApeWisdomResult[] | null> {
  const res = await fetch('https://apewisdom.io/api/v1.0/filter/wallstreetbets/page/1', {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    console.error('ApeWisdom API failed:', res.status);
    return null;
  }
  const data = await res.json() as any;
  return data?.results ?? null;
}

type Thread = { body: string; sentiment: string; likes: number; url: string };
const threadCache = new Map<string, { threads: Thread[]; ts: number }>();

/** Top recent r/wallstreetbets threads mentioning the ticker (unauthenticated Reddit search). */
async function fetchWsbThreads(symbol: string): Promise<Thread[]> {
  const cached = threadCache.get(symbol);
  if (cached && Date.now() - cached.ts < 10 * 60 * 1000) return cached.threads;
  try {
    const q = encodeURIComponent(`"${symbol}"`);
    const url = `https://www.reddit.com/r/wallstreetbets/search.json?q=${q}&restrict_sr=on&sort=top&t=week&limit=25`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) {
      console.warn(`[wsb] Reddit search ${symbol} returned ${r.status}`);
      return cached?.threads ?? [];
    }
    const data = await r.json() as any;
    const re = new RegExp(`(^|[^A-Za-z])\\$?${symbol}([^A-Za-z]|$)`);
    const threads: Thread[] = (data?.data?.children ?? [])
      .map((c: any) => c.data)
      .filter((d: any) => d && re.test(`${d.title ?? ''}`))
      .slice(0, 4)
      .map((d: any) => ({
        body: decodeEntities(d.title as string).substring(0, 160),
        sentiment: scoreSentiment(d.title ?? ''),
        likes: d.score ?? 0,
        url: `https://reddit.com${d.permalink}`,
      }));
    threadCache.set(symbol, { threads, ts: Date.now() });
    return threads;
  } catch (err) {
    console.warn(`[wsb] Reddit search failed for ${symbol}:`, (err as Error).message);
    return cached?.threads ?? [];
  }
}

function formatMktCap(n?: number): string | undefined {
  if (!n) return undefined;
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  return `${(n / 1e6).toFixed(0)}M`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

redditWsbRouter.get('/trending', async (req, res) => {
  const timeScale = (req.query.timeScale as string) || '1D';
  try {
    const results = await fetchApeWisdom();

    if (!results) {
      res.status(502).json({ error: 'ApeWisdom API unavailable' });
      return;
    }

    const top = results.slice(0, 8);

    if (top.length === 0) {
      res.json({ bets: [] });
      return;
    }

    const enriched = await Promise.all(
      top.map(async (r, i): Promise<WsbBet> => {
        const [chartData, threads, summary] = await Promise.all([
          fetchYahooChart(r.ticker, timeScale).catch(() => null),
          fetchWsbThreads(r.ticker),
          getStockTwitsTrendingSummary(r.ticker).catch(() => null),
        ]);

        const mentions = Number(r.mentions) || 0;
        const mentions24hAgo = Number(r.mentions_24h_ago) || 0;
        const upvotes = Number(r.upvotes) || 0;

        // No sentiment data is available from ApeWisdom — derive a bullish/bearish
        // lean from whether chatter about the ticker is rising or falling.
        const momentum = Math.log2(Math.max(mentions, 1) / Math.max(mentions24hAgo, 1));
        let bullPct = Math.min(90, Math.max(10, Math.round(50 + momentum * 15)));
        // Nudge by thread-title tone when we have threads
        const tone = threads.reduce((a, t) => a + (t.sentiment === 'bullish' ? 1 : t.sentiment === 'bearish' ? -1 : 0), 0);
        bullPct = Math.min(90, Math.max(10, bullPct + tone * 5));

        return {
          rank: i + 1,
          symbol: r.ticker,
          name: chartData?.name ?? decodeEntities(r.name),
          trendScore: mentions,
          summary: summary ?? undefined,
          marketCap: formatMktCap(chartData?.marketCap),
          threadsUrl: `https://www.reddit.com/r/wallstreetbets/search/?q=${encodeURIComponent('$' + r.ticker)}&restrict_sr=1&sort=top&t=week`,
          sentiment: bullPct >= 60 ? 'bullish' : bullPct <= 40 ? 'bearish' : 'neutral',
          bullPct,
          price: chartData?.price ?? 0,
          change: chartData?.change ?? 0,
          changePercent: chartData?.changePercent ?? 0,
          previousClose: chartData?.previousClose ?? 0,
          chart: chartData?.chart ?? [],
          messageCount: mentions,
          totalLikes: upvotes,
          topMessages: threads,
        };
      })
    );

    const valid = enriched.filter(b => b.price > 0);

    res.json({ bets: valid });
  } catch (err) {
    console.error('WSB trending error:', err);
    res.status(500).json({ error: 'Failed to fetch WSB trending' });
  }
});
