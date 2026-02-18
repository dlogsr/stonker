import React, { useState } from 'react';
import { Header } from './components/Header';
import { StockCard } from './components/StockCard';
import { AddStock } from './components/AddStock';
import { ImportModal } from './components/ImportModal';
import { useWatchlist } from './hooks/useWatchlist';
import { useStockData } from './hooks/useStockData';
import './App.css';

export const App: React.FC = () => {
  const { symbols, addSymbol, removeSymbol, importFromText } = useWatchlist();
  const { stocks, loading, error, refresh } = useStockData(symbols);
  const [showImport, setShowImport] = useState(false);

  // Sort stocks by the order in the symbols array
  const orderedStocks = symbols
    .map(s => stocks.get(s))
    .filter((s): s is NonNullable<typeof s> => s != null);

  return (
    <div className="app">
      <Header
        stockCount={symbols.length}
        loading={loading}
        onRefresh={refresh}
        onImport={() => setShowImport(true)}
      />

      <main className="app-main">
        <AddStock onAdd={addSymbol} existingSymbols={symbols} />

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={refresh}>Retry</button>
          </div>
        )}

        {loading && orderedStocks.length === 0 && (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Fetching stock data...</p>
          </div>
        )}

        {!loading && symbols.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 100 100">
                <rect width="100" height="100" rx="16" fill="var(--bg-card)"/>
                <path d="M20 70 L35 45 L50 55 L65 30 L80 35" stroke="var(--text-muted)" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3>No tickers yet</h3>
            <p>Add stocks above or import your Google Finance watchlist</p>
          </div>
        )}

        <div className="stock-grid">
          {orderedStocks.map(stock => (
            <StockCard
              key={stock.quote.symbol}
              data={stock}
              onRemove={removeSymbol}
            />
          ))}
        </div>

        {orderedStocks.length > 0 && (
          <div className="last-updated">
            Auto-refreshes every 30s &middot; Sentiment updates every 5m
          </div>
        )}
      </main>

      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={importFromText}
      />
    </div>
  );
};
