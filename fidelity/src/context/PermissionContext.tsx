import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { ServerCall } from '../../lib/server_call';
import { useUser } from './UserContext';

interface PermissionContextType {
  permessi: string[];
  hasPermission: (codice: string) => boolean;
  loading: boolean;
  refreshPermessi: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [permessi, setPermessi] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPermessi = useCallback(async () => {
    if (!user) {
      setPermessi([]);
      return;
    }

    try {
      setLoading(true);
      const response = await ServerCall.get<{ permessi: string[] }>('/permessi/effettivi');
      setPermessi(response.permessi);
    } catch (error) {
      console.error('Errore nel caricamento dei permessi:', error);
      setPermessi([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPermessi();
  }, [fetchPermessi]);

  const hasPermission = useCallback((codice: string): boolean => {
    // Se l'utente e superadmin, ha sempre tutti i permessi
    if (user?.is_admin) return true;
    return permessi.includes(codice);
  }, [permessi, user?.is_admin]);

  return (
    <PermissionContext.Provider value={{ permessi, hasPermission, loading, refreshPermessi: fetchPermessi }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissionContext = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissionContext must be used within a PermissionProvider');
  }
  return context;
};

/**
 * Hook per verificare se l'utente ha un permesso specifico.
 * @param codice - Es. "promo.elimina", "kit.pubblica"
 * @returns boolean
 */
export const usePermission = (codice: string): boolean => {
  const { hasPermission } = usePermissionContext();
  return hasPermission(codice);
};
