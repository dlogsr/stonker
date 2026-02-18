import 'dotenv/config';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { fetchSentiment } from './sentiment.js';
import { authRouter } from './auth.js';
import { financeRouter } from './google-finance.js';

// Node's native fetch doesn't respect HTTP_PROXY env vars — wire it up manually
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'stonker-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use('/api/auth', authRouter);
app.use('/api/finance', financeRouter);

// --- Yahoo Finance direct fetch ---

const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' };

async function fetchYahooQuote(symbol: string) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d&includePrePost=true`;
  const res = await fetch(url, {
    headers: YF_HEADERS,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Yahoo returned ${res.status} for ${symbol}`);
  const json: any = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${symbol}`);

  const meta = result.meta;
  const timestamps: number[] = result.timestamp ?? [];
  const ohlcv = result.indicators?.quote?.[0] ?? {};
  const closes: (number | null)[] = ohlcv.close ?? [];

  const price = meta.regularMarketPrice ?? 0;
  const previousClose = meta.chartPreviousClose ?? 0;
  const change = price - previousClose;
  const changePercent = previousClose ? (change / previousClose) * 100 : 0;

  // Build chart data — separate pre-market, regular, post-market
  const tradingPeriod = meta.currentTradingPeriod ?? {};
  const preStart = tradingPeriod.pre?.start ?? 0;
  const regularStart = tradingPeriod.regular?.start ?? 0;
  const regularEnd = tradingPeriod.regular?.end ?? 0;
  const postEnd = tradingPeriod.post?.end ?? 0;

  const chartPoints: { t: number; p: number; phase: 'pre' | 'regular' | 'post' }[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] == null) continue;
    const t = timestamps[i];
    let phase: 'pre' | 'regular' | 'post' = 'regular';
    if (t < regularStart) phase = 'pre';
    else if (t >= regularEnd) phase = 'post';
    chartPoints.push({ t, p: closes[i]!, phase });
  }

  return {
    symbol: meta.symbol ?? symbol,
    name: meta.shortName || meta.longName || symbol,
    price,
    change,
    changePercent,
    marketCap: formatLargeNumber(meta.marketCap),
    volume: formatLargeNumber(meta.regularMarketVolume),
    high: meta.regularMarketDayHigh,
    low: meta.regularMarketDayLow,
    open: ohlcv.open?.[0] ?? meta.regularMarketOpen,
    previousClose,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
    chart: chartPoints,
  };
}

async function searchYahoo(query: string) {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;
  const res = await fetch(url, {
    headers: YF_HEADERS,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Yahoo search returned ${res.status}`);
  const json: any = await res.json();
  return (json.quotes ?? [])
    .filter((q: any) => q.quoteType === 'EQUITY')
    .slice(0, 10)
    .map((q: any) => ({
      symbol: q.symbol,
      name: q.shortname || q.longname || q.symbol,
      exchange: q.exchange,
    }));
}

// Get quotes for multiple symbols
app.get('/api/quotes', async (req, res) => {
  const symbols = (req.query.symbols as string)?.split(',').map(s => s.trim().toUpperCase());
  if (!symbols?.length) {
    res.status(400).json({ error: 'symbols query param required' });
    return;
  }

  try {
    const results = await Promise.allSettled(
      symbols.map(symbol => fetchYahooQuote(symbol))
    );

    const quotes = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value);

    const errors = results
      .map((r, i) => r.status === 'rejected' ? symbols[i] : null)
      .filter(Boolean);

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Quote failed for ${symbols[i]}:`, r.reason?.message ?? r.reason);
      }
    });

    res.json({ quotes, errors });
  } catch (err) {
    console.error('Quote fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

// Get sentiment for a single symbol
app.get('/api/sentiment/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const sentiment = await fetchSentiment(symbol);
    res.json(sentiment);
  } catch (err) {
    console.error(`Sentiment fetch error for ${symbol}:`, err);
    res.status(500).json({ error: 'Failed to fetch sentiment' });
  }
});

// Search for symbols
app.get('/api/search', async (req, res) => {
  const query = req.query.q as string;
  if (!query) {
    res.status(400).json({ error: 'q query param required' });
    return;
  }

  try {
    const results = await searchYahoo(query);
    res.json({ results });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

function formatLargeNumber(num: number | undefined): string | undefined {
  if (num == null) return undefined;
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toString();
}

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Stonker API running on http://0.0.0.0:${PORT}`);
});
