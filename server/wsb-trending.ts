import { Router } from 'express';

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
  topMessages: { body: string; sentiment: string }[];
}

/**
 * GET /api/wsb/trending
 *
 * Fetches trending meme stocks from StockTwits (which heavily overlaps with WSB),
 * enriches with sentiment from the symbol stream, and returns ranked by trend score.
 */
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
      .slice(0, 12); // top 12 to enrich, we'll return top 8

    if (symbols.length === 0) {
      res.json({ bets: [] });
      return;
    }

    // 2. Enrich top symbols with sentiment from their streams (parallel, batched)
    const enriched = await Promise.all(
      symbols.slice(0, 8).map(async (sym: any): Promise<MemeBet> => {
        const { bullPct, topMessages } = await fetchSymbolSentiment(sym.symbol);

        const f = sym.fundamentals ?? {};

        return {
          rank: sym.rank ?? 0,
          symbol: sym.symbol,
          name: sym.title ?? sym.symbol,
          trendScore: sym.trending_score ?? 0,
          summary: sym.trends?.summary ?? '',
          sentiment: bullPct >= 60 ? 'bullish' : bullPct <= 40 ? 'bearish' : 'neutral',
          bullPct,
          watchers: sym.watchlist_count ?? 0,
          beta: f.Beta ? Number(f.Beta) : undefined,
          peRatio: f.PERatio ? Number(f.PERatio) : undefined,
          marketCap: formatMktCap(f.MarketCap),
          topMessages,
        };
      })
    );

    // Sort by trend score (already ranked, but be safe)
    enriched.sort((a, b) => b.trendScore - a.trendScore);

    res.json({ bets: enriched });
  } catch (err) {
    console.error('WSB trending error:', err);
    res.status(500).json({ error: 'Failed to fetch trending' });
  }
});

async function fetchSymbolSentiment(symbol: string): Promise<{
  bullPct: number;
  topMessages: { body: string; sentiment: string }[];
}> {
  try {
    const url = `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(symbol)}.json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { bullPct: 50, topMessages: [] };
    const data = await res.json() as any;
    const msgs = data?.messages ?? [];

    let bull = 0;
    let bear = 0;
    const topMessages: { body: string; sentiment: string }[] = [];

    for (const m of msgs) {
      const st = ((m.entities ?? null)?.sentiment ?? null)?.basic;
      if (st === 'Bullish') bull++;
      else if (st === 'Bearish') bear++;

      if (topMessages.length < 3) {
        topMessages.push({
          body: (m.body ?? '').substring(0, 160),
          sentiment: st === 'Bullish' ? 'bullish' : st === 'Bearish' ? 'bearish' : 'neutral',
        });
      }
    }

    const total = bull + bear;
    const bullPct = total > 0 ? Math.round((bull / total) * 100) : 50;
    return { bullPct, topMessages };
  } catch {
    return { bullPct: 50, topMessages: [] };
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
