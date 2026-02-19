import 'dotenv/config';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import session from 'express-session';
import { fetchSentiment } from './sentiment.js';
import { authRouter } from './auth.js';
import { financeRouter } from './google-finance.js';
import { wsbRouter } from './wsb-trending.js';
import { redditWsbRouter } from './reddit-wsb.js';
import { fetchYahooChart, fetchHistoricalChanges, fetchEarningsDate, searchYahoo } from './yahoo-chart.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

// Node's native fetch doesn't respect HTTP_PROXY env vars — wire it up manually
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

const app = express();
const PORT = process.env.PORT || 3001;

// In production, frontend is served from the same origin — no CORS needed
if (!isProd) {
  app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }));
}

app.use(express.json());

if (isProd) {
  app.set('trust proxy', 1);
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'stonker-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
}));

// --- API routes ---
app.use('/api/auth', authRouter);
app.use('/api/finance', financeRouter);
app.use('/api/stocktwits', wsbRouter);
app.use('/api/wsb', redditWsbRouter);

// Get quotes for multiple symbols
app.get('/api/quotes', async (req, res) => {
  const symbols = (req.query.symbols as string)?.split(',').map(s => s.trim().toUpperCase());
  if (!symbols?.length) {
    res.status(400).json({ error: 'symbols query param required' });
    return;
  }

  try {
    const results = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const [data, hist, earningsDate] = await Promise.all([
          fetchYahooChart(symbol),
          fetchHistoricalChanges(symbol),
          fetchEarningsDate(symbol),
        ]);
        return {
          ...data,
          marketCap: formatLargeNumber(data.marketCap),
          volume: formatLargeNumber(data.volume),
          weekChange: hist.weekChange,
          monthChange: hist.monthChange,
          signals: hist.signals,
          earningsDate,
        };
      })
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

// --- Production: serve built frontend ---
if (isProd) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  // SPA fallback: serve index.html for all non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

function formatLargeNumber(num: number | undefined): string | undefined {
  if (num == null) return undefined;
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toString();
}

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Stonker ${isProd ? 'production' : 'dev'} running on http://0.0.0.0:${PORT}`);
});
