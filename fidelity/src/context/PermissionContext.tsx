import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CodicePermesso } from '../../lib/accessi/catalogo';
import { ServerCall } from '../../lib/server_call';
import { useUser } from './UserContext';

interface PermissionContextType {
  permessi: string[];
  /** Vero per il Superadmin, che ha tutti i permessi. */
  superadmin: boolean;
  hasPermission: (codice: CodicePermesso) => boolean;
  /** True finché i permessi dell'utente collegato non sono arrivati. */
  loading: boolean;
  refreshPermessi: () => Promise<void>;
}

/** Evento con cui la gestione accessi chiede di ricaricare i permessi dopo un salvataggio. */
export const EVENTO_PERMESSI_AGGIORNATI = 'fidelity:permessi-aggiornati';

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [permessi, setPermessi] = useState<string[]>([]);
  const [superadmin, setSuperadmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPermessi = useCallback(async () => {
    if (!user) {
      setPermessi([]);
      setSuperadmin(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await ServerCall.get<{ permessi: string[]; superadmin?: boolean }>('/permessi/effettivi');
      setPermessi(response.permessi);
      setSuperadmin(!!response.superadmin);
    } catch (error) {
      console.error('Errore nel caricamento dei permessi:', error);
      setPermessi([]);
      setSuperadmin(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPermessi();
  }, [fetchPermessi]);

  useEffect(() => {
    const ricarica = () => { void fetchPermessi(); };
    window.addEventListener(EVENTO_PERMESSI_AGGIORNATI, ricarica);
    return () => window.removeEventListener(EVENTO_PERMESSI_AGGIORNATI, ricarica);
  }, [fetchPermessi]);

  const insieme = useMemo(() => new Set(permessi), [permessi]);

  const hasPermission = useCallback(
    (codice: CodicePermesso): boolean => superadmin || insieme.has(codice),
    [insieme, superadmin]
  );

  const valore = useMemo(
    () => ({ permessi, superadmin, hasPermission, loading, refreshPermessi: fetchPermessi }),
    [permessi, superadmin, hasPermission, loading, fetchPermessi]
  );

  return (
    <PermissionContext.Provider value={valore}>
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
 * @param codice - Es. "promo.elimina", "kit_runtime.pubblica"
 */
export const usePermission = (codice: CodicePermesso): boolean => {
  const { hasPermission } = usePermissionContext();
  return hasPermission(codice);
};
