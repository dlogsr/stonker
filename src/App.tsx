import React, { useState, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { StockCard } from './components/StockCard';
import { AddStock } from './components/AddStock';
import { ImportModal } from './components/ImportModal';
import { MemeBets } from './components/MemeBets';
import { useWatchlist } from './hooks/useWatchlist';
import { useStockData } from './hooks/useStockData';
import { useAuth } from './hooks/useAuth';
import { useMemeBets } from './hooks/useMemeBets';
import { SortMode, StockData } from './types';
import './App.css';

export const App: React.FC = () => {
  const { symbols, addSymbol, removeSymbol, importFromText } = useWatchlist();
  const { stocks, loading, error, refresh } = useStockData(symbols);
  const { authenticated, user, login, logout, syncWatchlist } = useAuth();
  const stocktwitsBets = useMemeBets('stocktwits');
  const wsbBets = useMemeBets('wsb');
  const [showImport, setShowImport] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [activeTab, setActiveTab] = useState<'stable' | 'meme'>('stable');

  const handleExportCSV = useCallback(() => {
    if (symbols.length === 0) return;
    const rows = [['Symbol', 'Name', 'Price', 'Change', 'Change %', 'Market Cap', 'Volume']];
    for (const sym of symbols) {
      const s = stocks.get(sym);
      if (s) {
        rows.push([
          s.quote.symbol,
          s.quote.name,
          s.quote.price.toFixed(2),
          s.quote.change.toFixed(2),
          s.quote.changePercent.toFixed(2) + '%',
          s.quote.marketCap ?? '',
          s.quote.volume ?? '',
        ]);
      } else {
        rows.push([sym, '', '', '', '', '', '']);
      }
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stonker-watchlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [symbols, stocks]);

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

  // Sort stocks
  const orderedStocks = useMemo(() => {
    const list = symbols
      .map(s => stocks.get(s))
      .filter((s): s is StockData => s != null);

    if (sortMode === 'default') return list;

    return [...list].sort((a, b) => {
      switch (sortMode) {
        case 'alpha':
          return a.quote.symbol.localeCompare(b.quote.symbol);
        case 'pctChange':
          return b.quote.changePercent - a.quote.changePercent;
        case 'dollarChange':
          return b.quote.change - a.quote.change;
        case 'sentiment': {
          const sentVal = (s: StockData) =>
            s.sentiment?.sentiment === 'bullish' ? 2 : s.sentiment?.sentiment === 'bearish' ? 0 : 1;
          return sentVal(b) - sentVal(a);
        }
        default: return 0;
      }
    });
  }, [symbols, stocks, sortMode]);

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
        <div className="tab-bar">
          <button
            className={`tab-btn ${activeTab === 'stable' ? 'active' : ''}`}
            onClick={() => setActiveTab('stable')}
          >
            <svg width="14" height="14" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 70 L30 45 L50 55 L70 25 L85 30" />
            </svg>
            STABLE STONKS
            {symbols.length > 0 && <span className="tab-count">{symbols.length}</span>}
          </button>
          <button
            className={`tab-btn ${activeTab === 'meme' ? 'active' : ''}`}
            onClick={() => setActiveTab('meme')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            CRAZY MEME BETS
          </button>
        </div>

        {activeTab === 'stable' && (
          <div className="tab-panel">
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

            {symbols.length > 0 && (
              <div className="section-header">
                <div className="sort-controls">
                  <span className="sort-label">Sort:</span>
                  {([
                    ['default', 'Default'],
                    ['alpha', 'A-Z'],
                    ['pctChange', '% Change'],
                    ['dollarChange', '$ Change'],
                    ['sentiment', 'Bull/Bear'],
                  ] as [SortMode, string][]).map(([mode, label]) => (
                    <button
                      key={mode}
                      className={`sort-chip ${sortMode === mode ? 'active' : ''}`}
                      onClick={() => setSortMode(mode)}
                    >
                      {label}
                    </button>
                  ))}
                  <button className="export-btn" onClick={handleExportCSV} title="Export watchlist to CSV">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                      <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                    </svg>
                    CSV
                  </button>
                </div>
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
          </div>
        )}

        {activeTab === 'meme' && (
          <div className="tab-panel">
            <MemeBets
              bets={stocktwitsBets.bets}
              loading={stocktwitsBets.loading}
              error={stocktwitsBets.error}
              onAddTicker={addSymbol}
              existingSymbols={symbols}
              source="stocktwits"
            />

            <MemeBets
              bets={wsbBets.bets}
              loading={wsbBets.loading}
              error={wsbBets.error}
              onAddTicker={addSymbol}
              existingSymbols={symbols}
              source="wsb"
            />
          </div>
        )}
      </main>

      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={importFromText}
      />

      <footer className="app-footer">
        vibe coded by{' '}
        <a href="https://ryandumlao.com" target="_blank" rel="noopener noreferrer">
          Ryan Dumlao
        </a>
        {' '}&copy; 2026
      </footer>
    </div>
  );
};
