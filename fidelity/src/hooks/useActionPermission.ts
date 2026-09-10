import { usePermissionContext } from '../context/PermissionContext';

/**
 * Hook per controllo permessi a livello di azione.
 * Restituisce il booleano di autorizzazione e un tooltip per lo stato disabilitato.
 *
 * @example
 * const canDelete = useActionPermission(PERMISSIONS.PROMO.ELIMINA);
 * <Button disabled={!canDelete.allowed} title={canDelete.tooltip}>Elimina</Button>
 */
export function useActionPermission(codice: string): {
  allowed: boolean;
  tooltip: string | undefined;
} {
  const { hasPermission } = usePermissionContext();
  const allowed = hasPermission(codice);
  return {
    allowed,
    tooltip: allowed ? undefined : 'Non hai i permessi per eseguire questa azione',
  };
}
