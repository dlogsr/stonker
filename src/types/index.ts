export interface ChartPoint {
  t: number;
  p: number;
  phase: 'pre' | 'regular' | 'post';
}

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap?: string;
  volume?: string;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  chart?: ChartPoint[];
  afterHoursChange?: number;
  afterHoursPercent?: number;
  weekChange?: number;
  monthChange?: number;
  signals?: string[];
  earningsDate?: string;
}

export type SortMode = 'default' | 'alpha' | 'pctChange' | 'dollarChange' | 'sentiment';
export type TimeScale = '1D' | '1W' | '1M' | '1Y';

export interface SentimentData {
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sources: {
    type: 'news' | 'reddit' | 'stocktwits';
    title: string;
    url?: string;
    sentiment: 'bullish' | 'bearish' | 'neutral';
  }[];
}

export interface StockData {
  quote: StockQuote;
  sentiment: SentimentData | null;
  lastUpdated: number;
}

export interface Watchlist {
  name: string;
  symbols: string[];
}
