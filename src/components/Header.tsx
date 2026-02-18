import React from 'react';

interface User {
  email: string;
  name: string;
  picture: string;
}

interface Props {
  stockCount: number;
  loading: boolean;
  onRefresh: () => void;
  onImport: () => void;
  // Auth props
  authenticated: boolean;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  onSyncGoogle: () => void;
  syncing: boolean;
}

export const Header: React.FC<Props> = ({
  stockCount, loading, onRefresh, onImport,
  authenticated, user, onLogin, onLogout, onSyncGoogle, syncing,
}) => {
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
        {authenticated && user ? (
          <div className="user-section">
            <button
              className={`header-btn google-sync-btn ${syncing ? 'spinning' : ''}`}
              onClick={onSyncGoogle}
              disabled={syncing}
              title="Sync from Google Finance watchlist"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="refresh-icon">
                <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.418A6 6 0 1 1 8 2v1z"/>
                <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
              </svg>
              {syncing ? 'Syncing...' : 'Sync Google'}
            </button>
            <div className="user-info">
              <img src={user.picture} alt="" className="user-avatar" referrerPolicy="no-referrer" />
              <button className="user-logout" onClick={onLogout} title={`Logged in as ${user.email}`}>
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <button className="header-btn google-login-btn" onClick={onLogin}>
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Sign in with Google
          </button>
        )}
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
