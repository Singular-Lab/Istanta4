import { Op } from 'sequelize';
import { log } from '../logger';
import { Utente } from '../models/utenti';

/**
 * Il nome di chi ha caricato i tracciati (spec ciclo-promozione-importazione, "Autore e date del
 * tracciato"): tracciati.caricato_da e' l'id dell'utente FP, il nome si legge dagli utenti con una
 * sola query per tutti i tracciati della promo.
 */

type UtenteConNome = { id_utenti: string; nome_utenti: string | null; cognome_utenti: string | null; email_utenti?: string | null };

/** "Nome Cognome"; senza nome e cognome l'email; null se non resta niente. */
export const nomeAutore = (utente: UtenteConNome): string | null => {
  const nome = [utente.nome_utenti, utente.cognome_utenti].map((parte) => parte?.trim()).filter(Boolean).join(' ');
  return nome || utente.email_utenti?.trim() || null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** id utente -> nome. Se la lettura non riesce i tracciati si mostrano lo stesso, senza nome. */
export async function nomiAutori(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
  const daCercare = [...new Set(ids.filter((id): id is string => typeof id === 'string' && UUID.test(id)))];
  if (daCercare.length === 0) return new Map();
  try {
    const utenti = await Utente.findAll({
      attributes: ['id_utenti', 'nome_utenti', 'cognome_utenti', 'email_utenti'],
      where: { id_utenti: { [Op.in]: daCercare } },
      raw: true,
    }) as unknown as UtenteConNome[];
    const nomi = new Map<string, string>();
    for (const utente of utenti) {
      const nome = nomeAutore(utente);
      if (nome) nomi.set(String(utente.id_utenti), nome);
    }
    return nomi;
  } catch (error) {
    log.warn('Nomi di chi ha caricato i tracciati non letti', { error: error instanceof Error ? error.message : String(error) });
    return new Map();
  }
}
