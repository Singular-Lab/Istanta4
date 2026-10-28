import dayjs from 'dayjs';
import type { Request, Response } from 'express';
import { permissionGuard } from '../middleware/permissionGuard';

/** Chi configura WebPliant: solo a lui la modalita' editor e la consultazione a una data scelta. */
export function puoConfigurareWebpliant(req: Request, res: Response): Promise<boolean> {
  if (!req.session?.id_utente) {
    return Promise.resolve(false);
  }
  return new Promise(resolve => {
    // Il guard passa i propri errori a next(err); un rifiuto imprevisto vale come "non puo'"
    permissionGuard('webpliant.configura')(req, res, (err?: unknown) => resolve(!err)).catch(() => resolve(false));
  });
}

/**
 * Data di consultazione richiesta dal browser, se e' lecito usarla (spec referenze-webpliant,
 * Visibilita temporale). Il pubblico vede cio' che e' visibile oggi: con una data futura vedrebbe
 * in anticipo le promo non ancora visibili. Solo chi configura WebPliant puo' indicarne un'altra.
 * Senza data richiesta restituisce undefined.
 */
export async function dataConsultazioneConsentita(req: Request, res: Response, richiesta: unknown): Promise<string | undefined> {
  if (typeof richiesta !== 'string' || richiesta === '') {
    return undefined;
  }
  const oggi = dayjs().format('YYYY-MM-DD');
  // Le pagine pubbliche mandano sempre la data di oggi: niente controllo dei permessi
  if (richiesta === oggi) {
    return richiesta;
  }
  return (await puoConfigurareWebpliant(req, res)) ? richiesta : oggi;
}
