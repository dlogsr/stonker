import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { StockCard } from './components/StockCard';
import { AddStock } from './components/AddStock';
import { ImportModal } from './components/ImportModal';
import { useWatchlist } from './hooks/useWatchlist';
import { useStockData } from './hooks/useStockData';
import { useAuth } from './hooks/useAuth';
import './App.css';

export const App: React.FC = () => {
  const { symbols, addSymbol, removeSymbol, importFromText } = useWatchlist();
  const { stocks, loading, error, refresh } = useStockData(symbols);
  const { authenticated, user, login, logout, syncWatchlist } = useAuth();
  const [showImport, setShowImport] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const handleSyncGoogle = useCallback(async () => {
    setSyncing(true);
    setSyncMessage(null);
    const { tickers, message } = await syncWatchlist();
    if (tickers.length > 0) {
      const count = importFromText(tickers.join(','));
      setSyncMessage(`Synced ${count} ticker${count !== 1 ? 's' : ''} from Google Finance`);
    } else if (message) {
      setSyncMessage(message);
    }
    setSyncing(false);
    setTimeout(() => setSyncMessage(null), 5000);
  }, [syncWatchlist, importFromText]);

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
        authenticated={authenticated}
        user={user}
        onLogin={login}
        onLogout={logout}
        onSyncGoogle={handleSyncGoogle}
        syncing={syncing}
      />

      {syncMessage && (
        <div className={`sync-banner ${syncMessage.startsWith('Synced') ? 'success' : 'info'}`}>
          {syncMessage}
        </div>
      )}

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
            <p>Add stocks above, sign in with Google to sync your watchlist, or use Import</p>
          </div>
        )}

        <div className="stock-list">
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
