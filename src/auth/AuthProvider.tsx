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
    setTokens(getStoredTokens());
    setLoading(false);
  }, []);

  // Listen for custom event and storage changes to keep tokens in sync
  useEffect(() => {
    const update = () => setTokens(getStoredTokens());
    window.addEventListener('oauth_tokens_updated', update);
    const storageHandler = (e: StorageEvent) => {
      if (e.key === KEY) update();
    };
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener('oauth_tokens_updated', update);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  const logout = () => {
    clearTokens();
    setTokens(null);
  };

  const login = () => startLogin();

  return (
    <AuthContext.Provider value={{ tokens, isAuthenticated: !!tokens, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
