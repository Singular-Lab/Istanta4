import { ReactNode, useCallback } from 'react';
import Tippy from '@/components/Base/Tippy';
import { CodicePermesso, voceDi } from '../../../lib/accessi/catalogo';
import { usePermissionContext } from '../../context/PermissionContext';

interface PermissionGateProps {
  /** Codice permesso richiesto. Es. "promo.elimina" */
  permission: CodicePermesso;
  /** Contenuto da renderizzare se il permesso e attivo */
  children: ReactNode;
  /** Contenuto alternativo se il permesso non e attivo (opzionale) */
  fallback?: ReactNode;
  /**
   * Modalita di protezione:
   * - 'hide' (default): non renderizza nulla se il permesso manca
   * - 'disable': mostra i children disattivati (anche da tastiera) con il permesso mancante
   */
  mode?: 'hide' | 'disable';
  /** Tooltip personalizzato per la modalita 'disable' */
  disabledTooltip?: string;
}

/** Testo del tooltip: nomina il permesso che manca, come appare nella gestione accessi. */
export const testoPermessoMancante = (permission: string): string => {
  const voce = voceDi(permission);
  return voce ? `Serve il permesso "${voce.nome}" (${voce.area.nome})` : 'Non hai il permesso per questa azione';
};

/**
 * Componente gate che protegge i children in base al permesso specificato.
 *
 * In modalita 'disable' il contenuto e reso `inert`: non riceve click, focus ne
 * tasti, quindi un comando non consentito non si attiva nemmeno con Tab e Invio.
 * Mentre i permessi si caricano non mostra nulla, per non far lampeggiare
 * comandi disattivati.
 *
 * @example
 * <PermissionGate permission={PERMISSIONS.PROMO.ELIMINA}>
 *   <Button variant="danger">Elimina</Button>
 * </PermissionGate>
 *
 * <PermissionGate permission={PERMISSIONS.PROMO.MODIFICA} mode="disable">
 *   <Button>Modifica</Button>
 * </PermissionGate>
 */
export const PermissionGate = ({
  permission,
  children,
  fallback = null,
  mode = 'hide',
  disabledTooltip,
}: PermissionGateProps) => {
  const { hasPermission, loading } = usePermissionContext();

  // React 18 non conosce ancora l'attributo `inert`: lo si imposta sul nodo.
  const rendiInerte = useCallback((nodo: HTMLDivElement | null) => {
    if (nodo) nodo.setAttribute('inert', '');
  }, []);

  if (hasPermission(permission)) {
    return <>{children}</>;
  }

  if (loading) {
    return null;
  }

  if (mode === 'disable') {
    return (
      <Tippy
        as="div"
        content={disabledTooltip ?? testoPermessoMancante(permission)}
        className="inline-block !cursor-not-allowed"
        options={{ placement: 'top' }}
      >
        <div ref={rendiInerte} aria-disabled="true" className="relative opacity-50 select-none">
          {children}
        </div>
      </Tippy>
    );
  }

  return <>{fallback}</>;
};

export default PermissionGate;
