import type { NextFunction, Request, Response } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import { log } from '../logger';
import { AuthProviderRepository, type IAuthProviderRepository } from '../repositories/AuthProviderRepository';

/**
 * Rifiuta l'accesso con un metodo disattivato dalla gestione dei metodi di accesso:
 * nascondere il pulsante nella pagina di login non basta, la chiamata diretta deve
 * essere respinta. Un metodo senza riga (installazione mai inizializzata) resta usabile.
 */
export function metodoAccessoAttivo(codice: string, repository: IAuthProviderRepository = new AuthProviderRepository()) {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const provider = await repository.findByCode(codice);
      if (provider && !provider.attivo) {
        res.status(HttpStatusCode.FORBIDDEN).json({
          code: 'METODO_ACCESSO_DISATTIVATO',
          message: 'L\'accesso con questo metodo e\' disattivato: usa un altro metodo di accesso',
        });
        return;
      }
      next();
    } catch (error) {
      log.error(`[metodoAccessoAttivo] Verifica del metodo "${codice}" non riuscita`, error);
      next(error);
    }
  };
}
