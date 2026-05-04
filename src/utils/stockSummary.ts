import { StockData } from '../types';

export function generateStockSummary(data: StockData): string | null {
  const { sentiment } = data;
  if (!sentiment || !sentiment.summary) return null;
  return sentiment.summary;
}
