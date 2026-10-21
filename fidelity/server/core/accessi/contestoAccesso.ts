import type { Request, Response } from 'express';
import { TIPO_UTENTI } from '../../../lib/enums';
import { UtentiGDO } from '../models';

/**
 * Chi sta facendo la richiesta, ai fini dei permessi.
 *
 * Il tipo è quello della sessione (scelto e verificato al login), così menu, pagine
 * e azioni seguono sempre lo stesso tipo. GDO e sotto-ruolo vengono dall'anagrafica.
 */
export type ContestoAccesso = {
  idUtente: string;
  tipo: TIPO_UTENTI;
  idGdo: string | null;
  idRuoloGdo: string | null;
  superadmin: boolean;
};

/** Tipi che lavorano per più GDO e possono indicare su quale operano. */
const TIPI_MULTI_GDO: TIPO_UTENTI[] = [TIPO_UTENTI.SUPERADMIN, TIPO_UTENTI.AGENZIA];

const CHIAVE_LOCALS = 'contestoAccesso';

export const leggiContestoAccesso = async (req: Request, res?: Response): Promise<ContestoAccesso | null> => {
  const giaCalcolato = res?.locals?.[CHIAVE_LOCALS] as ContestoAccesso | undefined;
  if (giaCalcolato) return giaCalcolato;

  const idUtente = req.session?.id_utente as string | undefined;
  const tipo = req.session?.tipo_utente as TIPO_UTENTI | undefined;
  if (!idUtente || !tipo) return null;

  const associazione = await UtentiGDO.findOne({ where: { id_utente_utentegdo: idUtente } });
  const contesto: ContestoAccesso = {
    idUtente,
    tipo,
    idGdo: associazione?.id_gdo_utentegdo ?? ((req.session as any)?.id_gdo as string | undefined) ?? null,
    idRuoloGdo: associazione?.id_ruolo_utente_gdo ?? null,
    superadmin: tipo === TIPO_UTENTI.SUPERADMIN,
  };

  if (res?.locals) res.locals[CHIAVE_LOCALS] = contesto;
  return contesto;
};

export const operaPerPiuGdo = (tipo: TIPO_UTENTI | undefined | null): boolean =>
  !!tipo && TIPI_MULTI_GDO.indexOf(tipo) >= 0;

/**
 * GDO su cui un'operazione amministrativa deve agire.
 * Superadmin e Agenzia possono indicarla nella richiesta; per tutti gli altri vale
 * sempre la GDO della sessione, qualunque cosa arrivi dal client.
 */
export const gdoOperativa = (
  tipo: TIPO_UTENTI | undefined | null,
  gdoSessione: string | null | undefined,
  gdoRichiesta?: string | null
): string | null => {
  if (operaPerPiuGdo(tipo) && gdoRichiesta) return gdoRichiesta;
  return gdoSessione ?? null;
};

/**
 * Variante per i controller. Le chiamate di servizio già autenticate (bearer di
 * integrazione o richiesta interna firmata) non hanno sessione e indicano la GDO
 * nella richiesta; per gli utenti vale gdoOperativa, con la GDO dell'anagrafica
 * se la sessione non la riporta.
 */
export const gdoOperativaPerRichiesta = async (req: Request, res: Response, gdoRichiesta?: unknown): Promise<string | null> => {
  const richiesta = typeof gdoRichiesta === 'string' && gdoRichiesta.length > 0 ? gdoRichiesta : null;
  if (res.locals?.authVia === 'bearer' || res.locals?.authVia === 'internal') return richiesta;

  const tipo = req.session?.tipo_utente as TIPO_UTENTI | undefined;
  if (operaPerPiuGdo(tipo) && richiesta) return richiesta;
  const contesto = await leggiContestoAccesso(req, res);
  return contesto?.idGdo ?? null;
};
