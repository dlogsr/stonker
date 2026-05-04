import { StockData } from '../types';

export function generateStockSummary(data: StockData): string {
  const { quote, sentiment } = data;
  const parts: string[] = [];

  const isUp = quote.change >= 0;
  const absChange = Math.abs(quote.changePercent);
  const direction = isUp ? 'up' : 'down';
  const intensity =
    absChange >= 5 ? (isUp ? 'surging' : 'plunging') :
    absChange >= 2 ? (isUp ? 'rallying' : 'sliding') :
    absChange >= 0.5 ? (isUp ? 'climbing' : 'dipping') :
    'flat';

  if (intensity === 'flat') {
    parts.push(`$${quote.symbol} is trading flat at $${quote.price.toFixed(2)}.`);
  } else {
    parts.push(`$${quote.symbol} is ${intensity} ${direction} ${absChange.toFixed(1)}% to $${quote.price.toFixed(2)}.`);
  }

  const signals = quote.signals ?? [];
  const near52High = signals.includes('52W HIGH');
  const near52Low = signals.includes('52W LOW');
  const momentumUp = signals.includes('MOMENTUM UP');
  const momentumDn = signals.includes('MOMENTUM DN');
  const smaCrossUp = signals.includes('SMA CROSS UP');
  const smaCrossDn = signals.includes('SMA CROSS DN');
  const bigWeek = signals.includes('BIG WEEK');

  if (near52High) {
    parts.push('Trading near its 52-week high.');
  } else if (near52Low) {
    parts.push('Hovering near its 52-week low.');
  }

  if (smaCrossUp) {
    parts.push('5-day SMA just crossed above the 20-day — a bullish technical signal.');
  } else if (smaCrossDn) {
    parts.push('5-day SMA crossed below the 20-day — a bearish technical signal.');
  }

  if (momentumUp) {
    parts.push('Three consecutive up days show building momentum.');
  } else if (momentumDn) {
    parts.push('Three straight down days indicate selling pressure.');
  }

  const wk = quote.weekChange;
  const mo = quote.monthChange;
  if (wk != null && mo != null) {
    const wkDir = wk >= 0 ? 'up' : 'down';
    const moDir = mo >= 0 ? 'up' : 'down';
    if (bigWeek) {
      parts.push(`Big week: ${wkDir} ${Math.abs(wk).toFixed(1)}% over 5 days, ${moDir} ${Math.abs(mo).toFixed(1)}% for the month.`);
    } else if (Math.abs(wk) >= 2 || Math.abs(mo) >= 5) {
      parts.push(`${wkDir === 'up' ? 'Up' : 'Down'} ${Math.abs(wk).toFixed(1)}% this week, ${moDir} ${Math.abs(mo).toFixed(1)}% over the past month.`);
    }
  }

  const ahPct = quote.afterHoursPercent ?? 0;
  if (Math.abs(ahPct) >= 0.5) {
    const ahDir = ahPct >= 0 ? 'up' : 'down';
    parts.push(`After-hours ${ahDir} ${Math.abs(ahPct).toFixed(1)}%.`);
  }

  if (sentiment) {
    const s = sentiment.sentiment;
    const srcCount = sentiment.sources.length;
    if (srcCount > 0) {
      const label = s === 'bullish' ? 'Bullish' : s === 'bearish' ? 'Bearish' : 'Mixed';
      parts.push(`${label} sentiment across ${srcCount} social and news signals.`);
    }
  }

  if (quote.earningsDate) {
    parts.push(`Earnings expected ${quote.earningsDate}.`);
  }

  return parts.join(' ');
}
