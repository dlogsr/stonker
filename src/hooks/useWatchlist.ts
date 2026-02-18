import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'stonker_watchlist';
const DEFAULT_SYMBOLS = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META'];

function loadSymbols(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_SYMBOLS;
}

function saveSymbols(symbols: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
}

export function useWatchlist() {
  const [symbols, setSymbols] = useState<string[]>(loadSymbols);

  useEffect(() => {
    saveSymbols(symbols);
  }, [symbols]);

  const addSymbol = useCallback((symbol: string) => {
    const s = symbol.toUpperCase().trim();
    if (!s) return;
    setSymbols(prev => {
      if (prev.includes(s)) return prev;
      return [...prev, s];
    });
  }, []);

  const removeSymbol = useCallback((symbol: string) => {
    setSymbols(prev => prev.filter(s => s !== symbol));
  }, []);

  const reorderSymbols = useCallback((newOrder: string[]) => {
    setSymbols(newOrder);
  }, []);

  const importFromText = useCallback((text: string) => {
    // Parse comma or newline separated tickers, also handles Google Finance CSV format
    const tickers = text
      .split(/[,\n\r]+/)
      .map(line => {
        // Handle "NASDAQ:AAPL" or "NYSE:MSFT" format from Google Finance
        const parts = line.trim().split(':');
        return (parts.length > 1 ? parts[1] : parts[0]).trim().toUpperCase();
      })
      .filter(t => /^[A-Z]{1,5}$/.test(t));

    if (tickers.length > 0) {
      setSymbols(prev => {
        const set = new Set(prev);
        for (const t of tickers) set.add(t);
        return Array.from(set);
      });
      return tickers.length;
    }
    return 0;
  }, []);

  return { symbols, addSymbol, removeSymbol, reorderSymbols, importFromText };
}
