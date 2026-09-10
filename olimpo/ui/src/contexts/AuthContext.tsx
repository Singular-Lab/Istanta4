import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { checkIdentity, dashboardLogout, type Identity } from '@/lib/api';

interface AuthState {
  identity: Identity | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  identity: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const id = await checkIdentity();
      setIdentity(id.autorizzato ? id : null);
    } catch {
      setIdentity(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await dashboardLogout();
    } catch {
      // ignore, clear state anyway
    }
    setIdentity(null);
    window.location.href = '/olimpo/private-login';
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ identity, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
