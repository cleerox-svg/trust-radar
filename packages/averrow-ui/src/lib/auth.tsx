import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar_url?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    // Check URL for OAuth callback tokens (hash fragment from server redirect)
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hashParams.get('token');
    const refreshToken = hashParams.get('refresh_token');

    // Also check query params for backwards compatibility
    const queryParams = new URLSearchParams(window.location.search);
    const accessTokenQuery = queryParams.get('access_token');
    const refreshTokenQuery = queryParams.get('refresh_token');

    if (accessToken) {
      api.setTokens(accessToken, refreshToken ?? '');
      const returnTo = hashParams.get('return_to');
      if (returnTo && returnTo.startsWith('/v2')) {
        window.history.replaceState({}, '', returnTo);
      } else {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } else if (accessTokenQuery && refreshTokenQuery) {
      api.setTokens(accessTokenQuery, refreshTokenQuery);
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (!api.getToken()) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get<User>('/api/auth/me');
      if (res.success && res.data) {
        setUser(res.data);
      }
    } catch {
      api.clearTokens();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.onAuthError(() => {
      setUser(null);
      api.clearTokens();
    });
    checkAuth();
  }, [checkAuth]);

  const login = () => {
    window.location.href = '/api/auth/login?return_to=/v2/observatory';
  };

  const logout = () => {
    api.clearTokens();
    setUser(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      isSuperAdmin: user?.role === 'super_admin',
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
