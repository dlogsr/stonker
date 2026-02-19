import 'dotenv/config';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { fetchSentiment } from './sentiment.js';
import { authRouter } from './auth.js';
import { financeRouter } from './google-finance.js';
import { wsbRouter } from './wsb-trending.js';
import { fetchYahooChart, searchYahoo } from './yahoo-chart.js';

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
app.use('/api/wsb', wsbRouter);

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
        const data = await fetchYahooChart(symbol);
        return {
          ...data,
          marketCap: formatLargeNumber(data.marketCap),
          volume: formatLargeNumber(data.volume),
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
