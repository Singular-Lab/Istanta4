import { NextFunction, Request, Response } from 'express';
import type { CodicePermesso } from '../../../lib/accessi/catalogo';
import { ForbiddenError } from '../../../lib/errors/application/ForbiddenError';
import { UnauthorizedError } from '../../../lib/errors/application/UnauthorizedError';
import { InfrastructureError } from '../../../lib/errors/InfrastructureError';
import { ErrorCodes } from '../../../lib/errors/ErrorCodes';
import { leggiContestoAccesso } from '../accessi/contestoAccesso';
import { RisolutoreAccessi } from '../accessi/RisolutoreAccessi';
import { log } from '../logger';
import { AuditLogService } from '../services/AuditLogService';

/**
 * Middleware che richiede un permesso del catalogo (lib/accessi/catalogo.ts).
 *
 * I permessi effettivi vengono dal RisolutoreAccessi, lo stesso usato da menu e
 * controllo pagine; il Superadmin li ha tutti, compresi quelli di sistema.
 * Le modifiche ai permessi valgono dalla richiesta successiva (versione nel DB).
 *
 * @param codicePermesso - Es. "promo.elimina", "sistema.gestisci_accessi"
 */
export const permissionGuard = (codicePermesso: CodicePermesso) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Chiamate di servizio gia' autenticate da authMiddleware (bearer di integrazione
      // o richiesta interna firmata): non hanno sessione ne' ruolo da controllare.
      if (res.locals.authVia === 'bearer' || res.locals.authVia === 'internal') {
        return next();
      }

      const contesto = await leggiContestoAccesso(req, res);
      if (!contesto) {
        return next(new UnauthorizedError({
          message: 'Non autenticato'
        }));
      }

      if (await RisolutoreAccessi.get().puo(contesto, codicePermesso)) {
        return next();
      }

      log.warn(`Permesso negato: ${codicePermesso} per utente ${contesto.idUtente} (${contesto.tipo})`);
      AuditLogService.getInstance().accessDenied(req, codicePermesso || req.path, 'permission_denied');
      return next(new ForbiddenError({
        message: 'Permesso negato',
        resource: req.path,
        action: codicePermesso,
        details: { codicePermesso, tipoUtente: contesto.tipo }
      }));
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
