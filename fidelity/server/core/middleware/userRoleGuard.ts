
import * as Express from 'express';
import type { TIPO_UTENTI } from '../../../lib/enums';
import { ForbiddenError } from '../../../lib/errors/application/ForbiddenError';
import { AuditLogService } from '../services/AuditLogService';


export const userRoleGuard = (allowedRoles: TIPO_UTENTI[]) => {
    return (req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
        const userRole = req.session.tipo_utente;
        if (!userRole || !allowedRoles.includes(userRole)) {
            AuditLogService.getInstance().accessDenied(req, req.path, JSON.stringify({ userRole: req.session?.tipo_utente, allowedRoles }));
            return next(new ForbiddenError({
                message: 'Accesso negato: ruolo utente non autorizzato.',
                resource: req.path,
                action: req.method,
                details: { userRole: userRole || null, allowedRoles }
            }));
        }
        next();
    };
}
