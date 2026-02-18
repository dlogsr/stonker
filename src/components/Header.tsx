import React from 'react';

interface Props {
  stockCount: number;
  loading: boolean;
  onRefresh: () => void;
  onImport: () => void;
}

export const Header: React.FC<Props> = ({ stockCount, loading, onRefresh, onImport }) => {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo">
          <svg width="28" height="28" viewBox="0 0 100 100">
            <rect width="100" height="100" rx="16" fill="var(--bg-card)"/>
            <path d="M20 70 L35 45 L50 55 L65 30 L80 35" stroke="var(--green)" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M72 28 L82 26 L84 36" stroke="var(--green)" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h1>Stonker</h1>
        </div>
        <span className="stock-count">{stockCount} ticker{stockCount !== 1 ? 's' : ''}</span>
      </div>
      <div className="header-right">
        <button className="header-btn" onClick={onImport} title="Import watchlist">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 1z"/>
          </svg>
          Import
        </button>
        <button
          className={`header-btn ${loading ? 'spinning' : ''}`}
          onClick={onRefresh}
          disabled={loading}
          title="Refresh all data"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="refresh-icon">
            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.418A6 6 0 1 1 8 2v1z"/>
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
          </svg>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
    </header>
  );
};
