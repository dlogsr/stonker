import { useState, useEffect, useCallback, useRef } from 'react';
import { StockData, StockQuote, SentimentData, TimeScale } from '../types';
import { API_BASE } from '../config';
const REFRESH_INTERVAL = 30_000; // 30 seconds for quotes
const SENTIMENT_REFRESH_INTERVAL = 300_000; // 5 minutes for sentiment

export function useStockData(symbols: string[], timeScale: TimeScale = '1D') {
  const [stocks, setStocks] = useState<Map<string, StockData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentimentCache = useRef<Map<string, { data: SentimentData; ts: number }>>(new Map());

  const fetchQuotes = useCallback(async () => {
    if (symbols.length === 0) return;

    try {
      const res = await fetch(`${API_BASE}/quotes?symbols=${symbols.join(',')}&timeScale=${timeScale}`);
      if (!res.ok) throw new Error('Failed to fetch quotes');
      const data = await res.json();

      setStocks(prev => {
        const next = new Map(prev);
        for (const quote of data.quotes as StockQuote[]) {
          const existing = next.get(quote.symbol);
          next.set(quote.symbol, {
            quote,
            sentiment: existing?.sentiment ?? null,
            lastUpdated: Date.now(),
          });
        }
        return next;
      });
      setError(null);
    } catch (err) {
      setError('Failed to fetch stock data. Is the server running?');
      console.error(err);
    }
  }, [symbols, timeScale]);

  const fetchSentimentForSymbol = useCallback(async (symbol: string) => {
    const cached = sentimentCache.current.get(symbol);
    if (cached && Date.now() - cached.ts < SENTIMENT_REFRESH_INTERVAL) {
      return cached.data;
    }

    try {
      const res = await fetch(`${API_BASE}/sentiment/${symbol}`);
      if (!res.ok) return null;
      const data: SentimentData = await res.json();
      sentimentCache.current.set(symbol, { data, ts: Date.now() });
      return data;
    } catch {
      return null;
    }
  }, []);

  const fetchAllSentiment = useCallback(async () => {
    if (symbols.length === 0) return;

    // Fetch sentiment in batches to avoid overwhelming
    const batchSize = 3;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(s => fetchSentimentForSymbol(s))
      );

      setStocks(prev => {
        const next = new Map(prev);
        batch.forEach((symbol, idx) => {
          const existing = next.get(symbol);
          if (existing && results[idx]) {
            next.set(symbol, { ...existing, sentiment: results[idx] });
          }
        });
        return next;
      });
    }
  }, [symbols, fetchSentimentForSymbol]);

  // Initial load + refetch on timeScale change
  useEffect(() => {
    if (symbols.length === 0) {
      setStocks(new Map());
      return;
    }

    setLoading(true);
    fetchQuotes().then(() => {
      setLoading(false);
      fetchAllSentiment();
    });
  }, [symbols.join(','), timeScale]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic refresh
  useEffect(() => {
    if (symbols.length === 0) return;

    const quoteInterval = setInterval(fetchQuotes, REFRESH_INTERVAL);
    const sentimentInterval = setInterval(fetchAllSentiment, SENTIMENT_REFRESH_INTERVAL);

    return () => {
      clearInterval(quoteInterval);
      clearInterval(sentimentInterval);
    };
  }, [symbols.join(','), fetchQuotes, fetchAllSentiment]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    setLoading(true);
    sentimentCache.current.clear();
    await fetchQuotes();
    await fetchAllSentiment();
    setLoading(false);
  }, [fetchQuotes, fetchAllSentiment]);

  return { stocks, loading, error, refresh };
}
