import type { Response } from 'express';

/**
 * Una funzione di un servizio puo' dichiarare a quale GDO appartiene il cambio quando la richiesta non
 * ha una sessione con una GDO (il Plugin, un'integrazione) o quando la GDO non e' quella dell'utente (il
 * Superadmin che opera per una GDO). Ha la precedenza sulla GDO della sessione.
 */
export function segnalaGdoDelCambio(res: Response, idGdo: string | null | undefined): void {
  if (idGdo && res.locals) res.locals.idGdoCambioDati = idGdo;
}

/** La GDO dichiarata con `segnalaGdoDelCambio`, se c'e'. */
export function gdoDichiarataDelCambio(res: Response): string | null {
  const valore = res.locals?.idGdoCambioDati;
  return typeof valore === 'string' && valore !== '' ? valore : null;
}
