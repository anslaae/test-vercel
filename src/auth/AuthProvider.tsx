import React, { createContext, useCallback, useEffect, useState } from 'react';
import type { LoginOptions, SessionInfo} from './oauth';
import { endSession, getSession, startLogin } from './oauth';

interface AuthCtx {
  session: SessionInfo | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (returnTo?: string, options?: LoginOptions) => void;
  logout: (returnTo?: string) => Promise<void>;
  refreshSession: () => Promise<SessionInfo | null>;
}

export const AuthContext = createContext<AuthCtx>({
  session: null,
  isAuthenticated: false,
  loading: true,
  login: () => {},
  logout: async () => {},
  refreshSession: async () => null
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      console.log('[AuthProvider] Refreshing BFF session state');
      const nextSession = await getSession();
      setSession(nextSession);
      return nextSession;
    } catch (error) {
      console.error('[AuthProvider] Failed to refresh session', error);
      setSession(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshSession().finally(() => {
      setLoading(false);
    });
  }, [refreshSession]);

  const logout = useCallback(async (returnTo = '/login') => {
    console.log('[AuthProvider] Logging out from BFF session');

    try {
      await endSession();
    } catch (error) {
      console.error('[AuthProvider] Logout request failed', error);
    } finally {
      setSession(null);
      globalThis.location.assign(returnTo);
    }
  }, []);

  const login = useCallback((returnTo?: string, options?: LoginOptions) => {
    console.log('[AuthProvider] Redirecting to BFF login');
    startLogin(returnTo, options);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: !!session,
        loading,
        login,
        logout,
        refreshSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
