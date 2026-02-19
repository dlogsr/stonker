import { useState, useEffect, useCallback } from 'react';
import { ChartPoint } from '../types';

export interface MemeBet {
  rank: number;
  symbol: string;
  name: string;
  trendScore: number;
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  bullPct: number;
  watchers: number;
  beta?: number;
  peRatio?: number;
  marketCap?: string;
  // Price + chart
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  chart: ChartPoint[];
  // Engagement volume
  messageCount: number;
  totalLikes: number;
  topMessages: { body: string; sentiment: string; likes: number }[];
}

export function useMemeBets() {
  const [bets, setBets] = useState<MemeBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/wsb/trending');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setBets(data.bets ?? []);
      setError(null);
    } catch {
      setError('Could not load trending bets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetch_]);

  return { bets, loading, error, refresh: fetch_ };
}
