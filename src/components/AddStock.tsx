import React, { useState, useRef, useEffect } from 'react';

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

interface Props {
  onAdd: (symbol: string) => void;
  existingSymbols: string[];
}

export const AddStock: React.FC<Props> = ({ onAdd, existingSymbols }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results);
          setShowResults(true);
        }
      } catch {
        // ignore search errors
      }
      setSearching(false);
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = query.trim().toUpperCase();
    if (symbol && /^[A-Z]{1,5}$/.test(symbol)) {
      onAdd(symbol);
      setQuery('');
      setShowResults(false);
    }
  };

  const handleSelect = (symbol: string) => {
    onAdd(symbol);
    setQuery('');
    setShowResults(false);
    inputRef.current?.focus();
  };

  return (
    <div className="add-stock">
      <form onSubmit={handleSubmit} className="add-stock-form">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder="Add ticker (e.g. AAPL)..."
          className="add-stock-input"
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" className="add-stock-btn">+</button>
      </form>

      {showResults && results.length > 0 && (
        <div className="search-results">
          {results.map(r => (
            <button
              key={r.symbol}
              className={`search-result-item ${existingSymbols.includes(r.symbol) ? 'already-added' : ''}`}
              onClick={() => handleSelect(r.symbol)}
              disabled={existingSymbols.includes(r.symbol)}
            >
              <span className="search-symbol">{r.symbol}</span>
              <span className="search-name">{r.name}</span>
              {existingSymbols.includes(r.symbol) && (
                <span className="search-added">Added</span>
              )}
            </button>
          ))}
        </div>
      )}

      {searching && <div className="search-loading">Searching...</div>}
    </div>
  );
};
