import type { NextFunction, Request, Response } from 'express';
import { BadRequestError } from '../../../lib/errors/application/BadRequestError';
import { sendAppError } from '../../../lib/errors/errorUtils';
import type { IAgenziaLib } from '../agenzia_lib/types';

export const MESSAGGIO_STORICO_NON_DISPONIBILE = "L'import del volantino da storico non e disponibile per questo cliente";

/**
 * Le API in blocco dell'archivio storico (promo, contesti e liste) servono solo all'import da
 * storico: dove la libreria agenzia non lo dichiara (oggi tutti tranne ConadCNO) rispondono con
 * lo stesso errore di /external/sync_json_plugin, prima di leggere il corpo della richiesta.
 * Il container si carica qui e non all'import: i controller che lo usano restano leggeri.
 */
export async function soloImportStorico(_req: Request, res: Response, next: NextFunction): Promise<void> {
  const { container, TYPES } = await import('../di');
  const agenzia = container.get<IAgenziaLib>(TYPES.AgenziaLib);
  if (!agenzia?.supportaImportStorico) {
    sendAppError(res, new BadRequestError({ message: MESSAGGIO_STORICO_NON_DISPONIBILE }));
    return;
  }
  next();
}
