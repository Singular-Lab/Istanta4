import { CSSProperties, ReactNode } from 'react';
import Tippy from '@/components/Base/Tippy';
import { usePermissionContext } from '../../context/PermissionContext';

interface PermissionGateProps {
  /** Codice permesso richiesto. Es. "promo.elimina" */
  permission: string;
  /** Contenuto da renderizzare se il permesso e attivo */
  children: ReactNode;
  /** Contenuto alternativo se il permesso non e attivo (opzionale) */
  fallback?: ReactNode;
  /**
   * Modalita di protezione:
   * - 'hide' (default): non renderizza nulla se il permesso manca
   * - 'disable': renderizza i children disabilitati con tooltip
   */
  mode?: 'hide' | 'disable';
  /** Tooltip personalizzato per la modalita 'disable' */
  disabledTooltip?: string;
}

const DISABLED_WRAPPER_STYLE: CSSProperties = {
  opacity: 0.5,
  pointerEvents: 'none' as const,
  cursor: 'not-allowed',
  position: 'relative' as const,
};

/**
 * Componente gate che protegge i children in base al permesso specificato.
 *
 * @example mode="hide" (default) — nasconde il contenuto
 * <PermissionGate permission="promo.elimina">
 *   <Button variant="danger">Elimina</Button>
 * </PermissionGate>
 *
 * @example mode="disable" — mostra disabilitato con tooltip
 * <PermissionGate permission="promo.modifica" mode="disable">
 *   <Button>Modifica</Button>
 * </PermissionGate>
 *
 * @example con fallback (solo mode="hide")
 * <PermissionGate permission="promo.modifica" fallback={<span>Non autorizzato</span>}>
 *   <Button>Modifica</Button>
 * </PermissionGate>
 */
export const PermissionGate = ({
  permission,
  children,
  fallback = null,
  mode = 'hide',
  disabledTooltip = 'Non hai i permessi per eseguire questa azione',
}: PermissionGateProps) => {
  const { hasPermission } = usePermissionContext();

  if (hasPermission(permission)) {
    return <>{children}</>;
  }

  if (mode === 'disable') {
    return (
      <Tippy
        as="div"
        content={disabledTooltip}
        className="inline-block !cursor-not-allowed"
        options={{ placement: 'top' }}
      >
        <div aria-disabled="true" style={DISABLED_WRAPPER_STYLE}>
          {children}
        </div>
      </Tippy>
    );
  }

  return <>{fallback}</>;
};

export default PermissionGate;
