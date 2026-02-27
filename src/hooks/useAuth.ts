import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config';

interface User {
  email: string;
  name: string;
  picture: string;
}

interface AuthState {
  authenticated: boolean;
  user: User | null;
  loading: boolean;
}

const AUTH_BASE = `${API_BASE}/auth`;

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
    authenticated: false,
    user: null,
    loading: true,
  });

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch(`${AUTH_BASE}/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAuth({
          authenticated: data.authenticated,
          user: data.user ?? null,
          loading: false,
        });
      } else {
        setAuth({ authenticated: false, user: null, loading: false });
      }
    } catch {
      setAuth({ authenticated: false, user: null, loading: false });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(() => {
    // Redirect to backend OAuth flow
    window.location.href = `${AUTH_BASE}/login`;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${AUTH_BASE}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    setAuth({ authenticated: false, user: null, loading: false });
  }, []);

  const syncWatchlist = useCallback(async (): Promise<{ tickers: string[]; message?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/finance/watchlist`, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json();
        return { tickers: [], message: err.error || 'Failed to sync watchlist' };
      }
      const data = await res.json();
      return { tickers: data.tickers, message: data.message };
    } catch {
      return { tickers: [], message: 'Network error fetching watchlist' };
    }
  }, []);

  return { ...auth, login, logout, syncWatchlist };
}
