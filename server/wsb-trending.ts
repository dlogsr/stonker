import { Router } from 'express';
import { fetchYahooChart, ChartPoint } from './yahoo-chart.js';

export const wsbRouter = Router();

interface MemeBet {
  rank: number;
  symbol: string;
  name: string;
  trendScore: number;
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  bullPct: number;
  watchers: number;
  beta?: number;
  peRatio?: number;
  marketCap?: string;
  // Price + chart
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  chart: ChartPoint[];
  // Engagement volume
  messageCount: number;
  totalLikes: number;
  topMessages: { body: string; sentiment: string; likes: number }[];
}

wsbRouter.get('/trending', async (_req, res) => {
  try {
    // 1. Get trending symbols
    const trendRes = await fetch('https://api.stocktwits.com/api/2/trending/symbols.json', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!trendRes.ok) {
      res.status(502).json({ error: 'StockTwits trending unavailable' });
      return;
    }
    const trendData = await trendRes.json() as any;
    const symbols = (trendData.symbols ?? [])
      .filter((s: any) => s.instrument_class === 'Stock')
      .slice(0, 8);

    if (symbols.length === 0) {
      res.json({ bets: [] });
      return;
    }

    // 2. Enrich each symbol with sentiment + chart in parallel
    const enriched = await Promise.all(
      symbols.map(async (sym: any): Promise<MemeBet> => {
        // Fetch sentiment stream and Yahoo chart concurrently
        const [streamData, chartData] = await Promise.all([
          fetchSymbolStream(sym.symbol),
          fetchYahooChart(sym.symbol).catch(() => null),
        ]);

        const f = sym.fundamentals ?? {};

        return {
          rank: sym.rank ?? 0,
          symbol: sym.symbol,
          name: sym.title ?? sym.symbol,
          trendScore: sym.trending_score ?? 0,
          summary: sym.trends?.summary ?? '',
          sentiment: streamData.bullPct >= 60 ? 'bullish' : streamData.bullPct <= 40 ? 'bearish' : 'neutral',
          bullPct: streamData.bullPct,
          watchers: sym.watchlist_count ?? 0,
          beta: f.Beta ? Number(f.Beta) : undefined,
          peRatio: f.PERatio ? Number(f.PERatio) : undefined,
          marketCap: formatMktCap(f.MarketCap),
          // Price + chart from Yahoo
          price: chartData?.price ?? 0,
          change: chartData?.change ?? 0,
          changePercent: chartData?.changePercent ?? 0,
          previousClose: chartData?.previousClose ?? 0,
          chart: chartData?.chart ?? [],
          // Engagement
          messageCount: streamData.messageCount,
          totalLikes: streamData.totalLikes,
          topMessages: streamData.topMessages,
        };
      })
    );

    enriched.sort((a, b) => b.trendScore - a.trendScore);

    res.json({ bets: enriched });
  } catch (err) {
    console.error('WSB trending error:', err);
    res.status(500).json({ error: 'Failed to fetch trending' });
  }
});

interface StreamResult {
  bullPct: number;
  messageCount: number;
  totalLikes: number;
  topMessages: { body: string; sentiment: string; likes: number }[];
}

async function fetchSymbolStream(symbol: string): Promise<StreamResult> {
  try {
    const url = `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(symbol)}.json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { bullPct: 50, messageCount: 0, totalLikes: 0, topMessages: [] };
    const data = await res.json() as any;
    const msgs = data?.messages ?? [];

    let bull = 0;
    let bear = 0;
    let totalLikes = 0;
    const topMessages: { body: string; sentiment: string; likes: number }[] = [];

    for (const m of msgs) {
      const st = ((m.entities ?? null)?.sentiment ?? null)?.basic;
      if (st === 'Bullish') bull++;
      else if (st === 'Bearish') bear++;

      const likes = m.likes?.total ?? 0;
      totalLikes += likes;

      if (topMessages.length < 4) {
        topMessages.push({
          body: (m.body ?? '').substring(0, 160),
          sentiment: st === 'Bullish' ? 'bullish' : st === 'Bearish' ? 'bearish' : 'neutral',
          likes,
        });
      }
    }

    // Sort top messages by likes descending so most-upvoted appear first
    topMessages.sort((a, b) => b.likes - a.likes);

    const total = bull + bear;
    const bullPct = total > 0 ? Math.round((bull / total) * 100) : 50;
    return { bullPct, messageCount: msgs.length, totalLikes, topMessages };
  } catch {
    return { bullPct: 50, messageCount: 0, totalLikes: 0, topMessages: [] };
  }
}

function formatMktCap(num: any): string | undefined {
  if (num == null) return undefined;
  const n = Number(num);
  if (isNaN(n)) return undefined;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}T`;
  if (n >= 1) return `${n.toFixed(1)}B`;
  return `${(n * 1000).toFixed(0)}M`;
}
