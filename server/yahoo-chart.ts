// Shared Yahoo Finance chart fetching used by both quotes and meme bets

const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' };

// Yahoo's v10 endpoints require crumb + cookie auth. Cache them.
let cachedCrumb: string | null = null;
let cachedCookie: string | null = null;
let crumbExpiry = 0;

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (cachedCrumb && cachedCookie && Date.now() < crumbExpiry) {
    return { crumb: cachedCrumb, cookie: cachedCookie };
  }
  try {
    // Step 1: Hit fc.yahoo.com to get consent cookies
    const initRes = await fetch('https://fc.yahoo.com', {
      headers: YF_HEADERS,
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    const setCookies = initRes.headers.getSetCookie?.() ?? [];
    const cookieStr = setCookies.map(c => c.split(';')[0]).join('; ');

    // Step 2: Get crumb using cookies
    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { ...YF_HEADERS, Cookie: cookieStr },
      signal: AbortSignal.timeout(5000),
    });
    if (!crumbRes.ok) return null;
    const crumb = await crumbRes.text();
    if (!crumb || crumb.includes('{')) return null;

    cachedCrumb = crumb;
    cachedCookie = cookieStr;
    crumbExpiry = Date.now() + 15 * 60 * 1000; // cache for 15 minutes
    return { crumb, cookie: cookieStr };
  } catch {
    return null;
  }
}

export interface ChartPoint {
  t: number;
  p: number;
  phase: 'pre' | 'regular' | 'post';
}

export interface YahooChartResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  high?: number;
  low?: number;
  open?: number;
  volume?: number;
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  chart: ChartPoint[];
  afterHoursChange: number;
  afterHoursPercent: number;
}

export interface HistoricalChanges {
  weekChange: number;
  monthChange: number;
  signals: string[];
}

// Map time scale to Yahoo API range + interval
const SCALE_PARAMS: Record<string, { range: string; interval: string; includePrePost: boolean }> = {
  '1D': { range: '1d', interval: '5m', includePrePost: true },
  '1W': { range: '5d', interval: '30m', includePrePost: false },
  '1M': { range: '1mo', interval: '1d', includePrePost: false },
  '1Y': { range: '1y', interval: '1d', includePrePost: false },
};

export async function fetchYahooChart(symbol: string, timeScale: string = '1D'): Promise<YahooChartResult> {
  const params = SCALE_PARAMS[timeScale] ?? SCALE_PARAMS['1D'];
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${params.interval}&range=${params.range}&includePrePost=${params.includePrePost}`;
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

  const isIntraday = timeScale === '1D';
  const tradingPeriod = meta.currentTradingPeriod ?? {};
  const regularStart = tradingPeriod.regular?.start ?? 0;
  const regularEnd = tradingPeriod.regular?.end ?? 0;

  const chart: ChartPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] == null) continue;
    const t = timestamps[i];
    let phase: 'pre' | 'regular' | 'post' = 'regular';
    if (isIntraday) {
      if (t < regularStart) phase = 'pre';
      else if (t >= regularEnd) phase = 'post';
    }
    chart.push({ t, p: closes[i]!, phase });
  }

  const { afterHoursChange, afterHoursPercent } = computeAfterHours(chart, previousClose);

  return {
    symbol: meta.symbol ?? symbol,
    name: meta.shortName || meta.longName || symbol,
    price,
    change,
    changePercent,
    previousClose,
    high: meta.regularMarketDayHigh,
    low: meta.regularMarketDayLow,
    open: ohlcv.open?.[0] ?? meta.regularMarketOpen,
    volume: meta.regularMarketVolume,
    marketCap: meta.marketCap,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
    chart,
    afterHoursChange,
    afterHoursPercent,
  };
}

function computeAfterHours(chart: ChartPoint[], previousClose: number): { afterHoursChange: number; afterHoursPercent: number } {
  const regularPoints = chart.filter(p => p.phase === 'regular');
  const postPoints = chart.filter(p => p.phase === 'post');
  const prePoints = chart.filter(p => p.phase === 'pre');

  if (postPoints.length > 0 && regularPoints.length > 0) {
    const lastRegular = regularPoints[regularPoints.length - 1].p;
    const lastPost = postPoints[postPoints.length - 1].p;
    const diff = lastPost - lastRegular;
    return {
      afterHoursChange: diff,
      afterHoursPercent: lastRegular ? (diff / lastRegular) * 100 : 0,
    };
  }
  if (prePoints.length > 0 && previousClose > 0) {
    const lastPre = prePoints[prePoints.length - 1].p;
    const diff = lastPre - previousClose;
    return {
      afterHoursChange: diff,
      afterHoursPercent: (diff / previousClose) * 100,
    };
  }
  return { afterHoursChange: 0, afterHoursPercent: 0 };
}

export async function fetchHistoricalChanges(symbol: string): Promise<HistoricalChanges> {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`;
    const res = await fetch(url, {
      headers: YF_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { weekChange: 0, monthChange: 0, signals: [] };
    const json: any = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return { weekChange: 0, monthChange: 0, signals: [] };

    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const validCloses = closes.filter((c): c is number => c != null);
    if (validCloses.length < 2) return { weekChange: 0, monthChange: 0, signals: [] };

    const current = validCloses[validCloses.length - 1];
    const monthAgo = validCloses[0];
    const weekIdx = Math.max(0, validCloses.length - 6);
    const weekAgo = validCloses[weekIdx];

    const weekChange = weekAgo ? ((current - weekAgo) / weekAgo) * 100 : 0;
    const monthChange = monthAgo ? ((current - monthAgo) / monthAgo) * 100 : 0;

    const signals: string[] = [];
    const meta = result.meta;
    const fiftyTwoHigh = meta?.fiftyTwoWeekHigh;
    const fiftyTwoLow = meta?.fiftyTwoWeekLow;

    if (fiftyTwoHigh && current >= fiftyTwoHigh * 0.95) signals.push('52W HIGH');
    if (fiftyTwoLow && current <= fiftyTwoLow * 1.05) signals.push('52W LOW');

    if (validCloses.length >= 20) {
      const sma5 = avg(validCloses.slice(-5));
      const sma20 = avg(validCloses.slice(-20));
      const prevSma5 = avg(validCloses.slice(-6, -1));
      const prevSma20 = avg(validCloses.slice(-21, -1));
      if (prevSma5 <= prevSma20 && sma5 > sma20) signals.push('SMA CROSS UP');
      if (prevSma5 >= prevSma20 && sma5 < sma20) signals.push('SMA CROSS DN');
    }

    if (validCloses.length >= 4) {
      const last4 = validCloses.slice(-4);
      const allUp = last4[1] > last4[0] && last4[2] > last4[1] && last4[3] > last4[2];
      const allDn = last4[1] < last4[0] && last4[2] < last4[1] && last4[3] < last4[2];
      if (allUp) signals.push('MOMENTUM UP');
      if (allDn) signals.push('MOMENTUM DN');
    }

    if (Math.abs(weekChange) >= 10) signals.push('BIG WEEK');

    return { weekChange, monthChange, signals };
  } catch {
    return { weekChange: 0, monthChange: 0, signals: [] };
  }
}

function avg(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export async function fetchEarningsDate(symbol: string): Promise<string | null> {
  try {
    const auth = await getYahooCrumb();
    if (!auth) return null;
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=calendarEvents&crumb=${encodeURIComponent(auth.crumb)}`;
    const res = await fetch(url, {
      headers: { ...YF_HEADERS, Cookie: auth.cookie },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const dates = json?.quoteSummary?.result?.[0]?.calendarEvents?.earnings?.earningsDate;
    if (!dates || dates.length === 0) return null;
    const epoch = dates[0]?.raw;
    if (!epoch) return null;
    const d = new Date(epoch * 1000);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return null;
  }
}

export async function searchYahoo(query: string) {
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
