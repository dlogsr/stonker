import { Router } from 'express';
import { fetchYahooChart, ChartPoint } from './yahoo-chart.js';

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
        const chartData = await fetchYahooChart(r.ticker, timeScale).catch(() => null);

        const mentions = Number(r.mentions) || 0;
        const mentions24hAgo = Number(r.mentions_24h_ago) || 0;
        const upvotes = Number(r.upvotes) || 0;

        // No sentiment data is available from ApeWisdom — derive a bullish/bearish
        // lean from whether chatter about the ticker is rising or falling.
        const momentum = Math.log2(Math.max(mentions, 1) / Math.max(mentions24hAgo, 1));
        const bullPct = Math.min(90, Math.max(10, Math.round(50 + momentum * 15)));

        return {
          rank: i + 1,
          symbol: r.ticker,
          name: chartData?.name ?? decodeEntities(r.name),
          trendScore: mentions,
          sentiment: bullPct >= 60 ? 'bullish' : bullPct <= 40 ? 'bearish' : 'neutral',
          bullPct,
          price: chartData?.price ?? 0,
          change: chartData?.change ?? 0,
          changePercent: chartData?.changePercent ?? 0,
          previousClose: chartData?.previousClose ?? 0,
          chart: chartData?.chart ?? [],
          messageCount: mentions,
          totalLikes: upvotes,
          topMessages: [],
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
