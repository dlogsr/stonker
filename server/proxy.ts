import { Router } from 'express';
import cors from 'cors';

export const proxyRouter = Router();

const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' };

// Yahoo's v7/v10 endpoints may require crumb + cookie auth. Cache them.
let cachedCrumb: string | null = null;
let cachedCookie: string | null = null;
let crumbExpiry = 0;

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (cachedCrumb && cachedCookie && Date.now() < crumbExpiry) {
    return { crumb: cachedCrumb, cookie: cachedCookie };
  }
  try {
    const initRes = await fetch('https://fc.yahoo.com', {
      headers: YF_HEADERS,
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    const setCookies = initRes.headers.getSetCookie?.() ?? [];
    const cookieStr = setCookies.map(c => c.split(';')[0]).join('; ');

    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { ...YF_HEADERS, Cookie: cookieStr },
      signal: AbortSignal.timeout(5000),
    });
    if (!crumbRes.ok) return null;
    const crumb = await crumbRes.text();
    if (!crumb || crumb.includes('{')) return null;

    cachedCrumb = crumb;
    cachedCookie = cookieStr;
    crumbExpiry = Date.now() + 15 * 60 * 1000;
    return { crumb, cookie: cookieStr };
  } catch (err) {
    console.error('Failed to get Yahoo crumb:', err);
    return null;
  }
}

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
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=5m&range=1d&includePrePost=true`;
    console.log(`[proxy/quote] Fetching ${url}`);
    const yRes = await fetch(url, {
      headers: YF_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    console.log(`[proxy/quote] Yahoo returned status ${yRes.status} for ${ticker}`);
    if (!yRes.ok) {
      const body = await yRes.text().catch(() => '');
      console.log(`[proxy/quote] Error body: ${body.slice(0, 300)}`);
      res.status(502).json({ error: `Yahoo returned ${yRes.status}`, detail: body.slice(0, 200) });
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
    // Try with crumb auth first (Yahoo increasingly requires it)
    const auth = await getYahooCrumb();

    // Build URL — try query1 first, fallback to query2
    const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
    let json: any = null;
    let lastStatus = 0;
    let lastBody = '';

    for (const host of hosts) {
      let url = `https://${host}/v7/finance/options/${encodeURIComponent(ticker)}`;
      const params: string[] = [];
      if (dateParam) params.push(`date=${dateParam}`);
      if (auth) params.push(`crumb=${encodeURIComponent(auth.crumb)}`);
      if (params.length) url += '?' + params.join('&');

      console.log(`[proxy/options] Trying ${url}`);

      const headers: Record<string, string> = { ...YF_HEADERS };
      if (auth) headers['Cookie'] = auth.cookie;

      const yRes = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(10000),
      });

      lastStatus = yRes.status;
      console.log(`[proxy/options] ${host} returned status ${yRes.status}`);

      if (!yRes.ok) {
        lastBody = await yRes.text().catch(() => '(unreadable)');
        console.log(`[proxy/options] ${host} error body: ${lastBody.slice(0, 500)}`);
        continue; // try next host
      }

      const text = await yRes.text();
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        console.error(`[proxy/options] JSON parse failed for ${host}:`, text.slice(0, 500));
        lastBody = text.slice(0, 500);
        continue;
      }
      break; // success
    }

    if (!json) {
      console.error(`[proxy/options] All hosts failed for ${ticker}. Last status: ${lastStatus}`);
      res.status(502).json({
        error: `Yahoo returned ${lastStatus} for ${ticker}`,
        detail: lastBody.slice(0, 200),
      });
      return;
    }

    const result = json?.optionChain?.result?.[0];
    if (!result) {
      console.log(`[proxy/options] No optionChain.result for ${ticker}. Keys:`, Object.keys(json));
      res.status(404).json({ error: `No options data for ${ticker}` });
      return;
    }

    const quote = result.quote ?? {};
    const expirationDates: number[] = result.expirationDates ?? [];
    const options = result.options?.[0] ?? {};

    console.log(`[proxy/options] ${ticker}: ${(options.calls ?? []).length} calls, ${(options.puts ?? []).length} puts, ${expirationDates.length} expiries`);

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
      currentExpiry: options.expirationDate,
      calls: (options.calls ?? []).map(mapContract),
      puts: (options.puts ?? []).map(mapContract),
    });
  } catch (err) {
    console.error(`[proxy/options] Unhandled error for ${ticker}:`, err);
    res.status(500).json({
      error: 'Failed to fetch options chain',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});
