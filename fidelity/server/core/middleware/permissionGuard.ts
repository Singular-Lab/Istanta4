import { NextFunction, Request, Response } from 'express';
import { TIPO_UTENTI } from '../../../lib/enums';
import { ForbiddenError } from '../../../lib/errors/application/ForbiddenError';
import { UnauthorizedError } from '../../../lib/errors/application/UnauthorizedError';
import { InfrastructureError } from '../../../lib/errors/InfrastructureError';
import { ErrorCodes } from '../../../lib/errors/ErrorCodes';
import { log } from '../logger';
import { PermessiRepository } from '../repositories/PermessiRepository';
import { AuditLogService } from '../services/AuditLogService';
import { PermessiService } from '../services/PermessiService';

// Singleton lazy-initialized service
let _permessiService: PermessiService | null = null;
function getPermessiService(): PermessiService {
  if (!_permessiService) {
    _permessiService = new PermessiService(new PermessiRepository());
  }
  return _permessiService;
}

/**
 * Middleware per verificare che l'utente abbia un permesso specifico.
 * Superadmin ha sempre bypass.
 * I permessi vengono cachati nella sessione per evitare query ripetute.
 *
 * @param codicePermesso - Es. "promo.elimina", "kit.pubblica"
 */
export const permissionGuard = (codicePermesso: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tipoUtente = req.session.tipo_utente;
      const userId = req.session.id_utente;

      if (!userId || !tipoUtente) {
        return next(new UnauthorizedError({
          message: 'Non autenticato'
        }));
      }

      // Superadmin bypass
      if (tipoUtente === TIPO_UTENTI.SUPERADMIN) {
        return next();
      }

      // Controlla cache nella sessione
      let permessiCache = (req.session as any).permessi_cache as string[] | undefined;

      if (!permessiCache) {
        const service = getPermessiService();
        permessiCache = await service.getPermessiUtente(userId);
        (req.session as any).permessi_cache = permessiCache;
      }

      if (!permessiCache.includes(codicePermesso)) {
        log.warn(`Permesso negato: ${codicePermesso} per utente ${userId} (${tipoUtente})`);
        AuditLogService.getInstance().accessDenied(req, codicePermesso || req.path, 'permission_denied');
        return next(new ForbiddenError({
          message: 'Permesso negato',
          resource: req.path,
          action: codicePermesso,
          details: { codicePermesso, tipoUtente }
        }));
      }

      next();
    } catch (error) {
      log.error('Errore nel permissionGuard:', error);
      return next(new InfrastructureError({
        name: 'PermissionGuardError',
        message: 'Errore interno durante la verifica dei permessi',
        code: ErrorCodes.DATABASE_ERROR,
        httpStatus: 500,
        cause: error instanceof Error ? error : undefined
      }));
    }
  };
};

/**
 * Middleware per invalidare la cache dei permessi nella sessione.
 * Da chiamare quando i permessi vengono aggiornati.
 */
export const invalidatePermissionCache = (req: Request) => {
  delete (req.session as any).permessi_cache;
};
