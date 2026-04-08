import { Router } from 'express';
import cors from 'cors';

export const proxyRouter = Router();

const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' };

// Wide-open CORS for these proxy endpoints (called from Claude artifacts / iframes)
proxyRouter.use(cors({ origin: '*' }));

// ── GET /api/proxy/quote?ticker=INTC ──
proxyRouter.get('/quote', async (req, res) => {
  const ticker = (req.query.ticker as string)?.trim().toUpperCase();
  if (!ticker) {
    res.status(400).json({ error: 'ticker query param required' });
    return;
  }

  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=5m&range=1d&includePrePost=true`;
    const yRes = await fetch(url, {
      headers: YF_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!yRes.ok) {
      res.status(502).json({ error: `Yahoo returned ${yRes.status}` });
      return;
    }
    const json: any = await yRes.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      res.status(404).json({ error: `No data for ${ticker}` });
      return;
    }

    const meta = result.meta;
    const ohlcv = result.indicators?.quote?.[0] ?? {};
    const previousClose = meta.chartPreviousClose ?? 0;
    const price = meta.regularMarketPrice ?? 0;
    const change = price - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;

    res.json({
      symbol: meta.symbol ?? ticker,
      name: meta.shortName || meta.longName || ticker,
      price,
      change: +change.toFixed(2),
      changePercent: +changePercent.toFixed(2),
      previousClose,
      open: ohlcv.open?.[0] ?? meta.regularMarketOpen,
      high: meta.regularMarketDayHigh,
      low: meta.regularMarketDayLow,
      volume: meta.regularMarketVolume,
      marketCap: meta.marketCap,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
    });
  } catch (err) {
    console.error(`Proxy quote error for ${ticker}:`, err);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

// ── GET /api/proxy/options?ticker=INTC ──
proxyRouter.get('/options', async (req, res) => {
  const ticker = (req.query.ticker as string)?.trim().toUpperCase();
  if (!ticker) {
    res.status(400).json({ error: 'ticker query param required' });
    return;
  }

  // Optional: ?date=1234567890 to fetch a specific expiry
  const dateParam = req.query.date as string | undefined;

  try {
    let url = `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(ticker)}`;
    if (dateParam) url += `?date=${dateParam}`;

    const yRes = await fetch(url, {
      headers: YF_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    if (!yRes.ok) {
      res.status(502).json({ error: `Yahoo returned ${yRes.status}` });
      return;
    }
    const json: any = await yRes.json();
    const result = json?.optionChain?.result?.[0];
    if (!result) {
      res.status(404).json({ error: `No options data for ${ticker}` });
      return;
    }

    const quote = result.quote ?? {};
    const expirationDates: number[] = result.expirationDates ?? [];
    const options = result.options?.[0] ?? {};

    const mapContract = (c: any) => ({
      strike: c.strike,
      expiry: c.expiration,
      bid: c.bid,
      ask: c.ask,
      lastPrice: c.lastPrice,
      change: c.change,
      percentChange: c.percentChange,
      volume: c.volume,
      openInterest: c.openInterest,
      impliedVolatility: c.impliedVolatility,
      inTheMoney: c.inTheMoney,
      contractSymbol: c.contractSymbol,
    });

    res.json({
      symbol: quote.symbol ?? ticker,
      underlyingPrice: quote.regularMarketPrice,
      expirationDates,
      // Current expiry date being viewed
      currentExpiry: options.expirationDate,
      calls: (options.calls ?? []).map(mapContract),
      puts: (options.puts ?? []).map(mapContract),
    });
  } catch (err) {
    console.error(`Proxy options error for ${ticker}:`, err);
    res.status(500).json({ error: 'Failed to fetch options chain' });
  }
});
