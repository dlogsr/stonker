// Shared Yahoo Finance chart fetching used by both quotes and meme bets

const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' };

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
}

export async function fetchYahooChart(symbol: string): Promise<YahooChartResult> {
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

  const tradingPeriod = meta.currentTradingPeriod ?? {};
  const regularStart = tradingPeriod.regular?.start ?? 0;
  const regularEnd = tradingPeriod.regular?.end ?? 0;

  const chart: ChartPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] == null) continue;
    const t = timestamps[i];
    let phase: 'pre' | 'regular' | 'post' = 'regular';
    if (t < regularStart) phase = 'pre';
    else if (t >= regularEnd) phase = 'post';
    chart.push({ t, p: closes[i]!, phase });
  }

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
  };
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
