import React, { createContext, useEffect, useState } from 'react';
import { getStoredTokens, clearTokens, Tokens, startLogin, KEY } from './oauth';

interface AuthCtx {
  tokens: Tokens | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthCtx>({
  tokens: null,
  isAuthenticated: false,
  loading: true,
  login: () => {},
  logout: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[AuthProvider] Initializing, checking for stored tokens');
    const storedTokens = getStoredTokens();
    console.log('[AuthProvider] Stored tokens:', {
      hasTokens: !!storedTokens,
      isAuthenticated: !!storedTokens,
      expiresAt: storedTokens?.expires_at
    });
    setTokens(storedTokens);
    setLoading(false);
  }, []);

  // Listen for custom event and storage changes to keep tokens in sync
  useEffect(() => {
    const update = () => {
      console.log('[AuthProvider] Token update event received');
      const updatedTokens = getStoredTokens();
      console.log('[AuthProvider] Updated tokens:', {
        hasTokens: !!updatedTokens,
        isAuthenticated: !!updatedTokens
      });
      setTokens(updatedTokens);
    };
    window.addEventListener('oauth_tokens_updated', update);
    const storageHandler = (e: StorageEvent) => {
      if (e.key === KEY) {
        console.log('[AuthProvider] Storage event for oauth tokens');
        update();
      }
    };
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener('oauth_tokens_updated', update);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  const logout = () => {
    console.log('[AuthProvider] Logout called');
    clearTokens();
    setTokens(null);
    console.log('[AuthProvider] Tokens cleared');
  };

  const login = () => {
    console.log('[AuthProvider] Login called, starting OAuth flow');
    startLogin();
  };

  return (
    <AuthContext.Provider value={{ tokens, isAuthenticated: !!tokens, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
