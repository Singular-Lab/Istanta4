import { QueryTypes, Transaction } from 'sequelize';
import { CodicePermesso, PERMESSI as P } from '../../../lib/accessi/catalogo';
import { TIPO_UTENTI } from '../../../lib/enums';
import { sequelize } from '../db/SequelizeConnector';
import type { PermessiRepository } from '../repositories/PermessiRepository';
import { permessiPredefinitiDelSottoRuolo } from './predefiniti';

/**
 * Schema 3 degli accessi, applicato una volta sola all'avvio da preparaAccessiAllAvvio: l'import
 * delle vendite del cliente ("analisi.importa_vendite") arriva alle installazioni esistenti come su
 * quelle nuove, cioe' ai sotto-ruoli GDO che lo hanno fra i permessi predefiniti (l'ADMIN, vedi
 * PERMESSI_PREDEFINITI_SOTTORUOLO_GDO). Il Superadmin lo ha gia', come tutti i permessi.
 *
 * Si concede sul sotto-ruolo, non sul tipo GDO, e solo dove nessuno lo ha ancora impostato: un
 * valore deciso dall'amministratore resta. L'azione vale con l'accesso all'area Report e analisi
 * ("analisi.visualizza"), che i ruoli GDO hanno dallo schema 2: qui non si concede.
 */

/** I permessi che lo schema 3 porta alle installazioni esistenti. */
export const PERMESSI_SCHEMA_VENDITE: readonly CodicePermesso[] = [P.ANALISI.IMPORTA_VENDITE];

export type SottoRuoloGdo = { id_ruolo_utente_gdo: string; ruolo_ruolo_utente_gdo: string };

/** Un valore gia' scritto per un sotto-ruolo GDO (abilitato o no), su uno dei permessi dello schema. */
export type ValoreSottoRuolo = { id_ruolo_utente_gdo: string; codice: string };

export type ConcessioneVendite = { idRuoloGdo: string; nomeRuolo: string; codice: CodicePermesso };

/** Cosa concedere, senza scrivere nulla: dai sotto-ruoli GDO e dai valori gia' impostati per loro. */
export const calcolaPianoVendite = (
  sottoRuoli: readonly SottoRuoloGdo[],
  impostati: readonly ValoreSottoRuolo[]
): ConcessioneVendite[] => {
  const gia = new Set(impostati.map(v => `${v.id_ruolo_utente_gdo}|${v.codice}`));
  const concessioni: ConcessioneVendite[] = [];
  for (const ruolo of sottoRuoli) {
    for (const codice of permessiPredefinitiDelSottoRuolo(ruolo.ruolo_ruolo_utente_gdo)) {
      if (PERMESSI_SCHEMA_VENDITE.indexOf(codice) < 0) continue;
      const chiave = `${ruolo.id_ruolo_utente_gdo}|${codice}`;
      if (gia.has(chiave)) continue;
      gia.add(chiave);
      concessioni.push({ idRuoloGdo: ruolo.id_ruolo_utente_gdo, nomeRuolo: ruolo.ruolo_ruolo_utente_gdo, codice });
    }
  }
  return concessioni;
};

/** Sotto-ruoli GDO e valori gia' impostati, nella transazione della preparazione degli accessi. */
export const leggiPianoVendite = async (transaction: Transaction): Promise<ConcessioneVendite[]> => {
  const sottoRuoli = await sequelize.query<SottoRuoloGdo>(
    `SELECT id_ruolo_utente_gdo::text AS id_ruolo_utente_gdo, ruolo_ruolo_utente_gdo FROM ruolo_utente_gdo`,
    { type: QueryTypes.SELECT, transaction }
  );
  const impostati = await sequelize.query<ValoreSottoRuolo>(
    `SELECT pr.id_ruolo_utente_gdo::text AS id_ruolo_utente_gdo, p.codice
       FROM permessi_ruolo pr JOIN permessi p ON p.id_permesso = pr.id_permesso
      WHERE pr.tipo_utente::text = :tipo AND pr.id_ruolo_utente_gdo IS NOT NULL AND p.codice IN (:codici)`,
    { type: QueryTypes.SELECT, transaction, replacements: { tipo: TIPO_UTENTI.GDO, codici: [...PERMESSI_SCHEMA_VENDITE] } }
  );
  return calcolaPianoVendite(sottoRuoli, impostati);
};

export const applicaPianoVendite = async (
  piano: readonly ConcessioneVendite[],
  repository: Pick<PermessiRepository, 'scriviLivello'>,
  idPerCodice: Map<string, string>,
  transaction: Transaction
): Promise<void> => {
  const perRuolo = new Map<string, Map<string, boolean | null>>();
  for (const c of piano) {
    const id = idPerCodice.get(c.codice);
    if (!id) continue;
    if (!perRuolo.has(c.idRuoloGdo)) perRuolo.set(c.idRuoloGdo, new Map());
    perRuolo.get(c.idRuoloGdo)!.set(id, true);
  }
  for (const [idRuoloGdo, valori] of perRuolo) {
    await repository.scriviLivello({ tipo: TIPO_UTENTI.GDO, idRuoloGdo }, valori, transaction);
  }
};

/** Il registro di cosa cambia, per il log dell'avvio. */
export const descriviPianoVendite = (piano: readonly ConcessioneVendite[]): string => {
  const righe = [`Permessi dell'import delle vendite concessi ai sotto-ruoli GDO: ${piano.length}`];
  for (const c of piano) righe.push(`  GDO · ${c.nomeRuolo}  + ${c.codice}`);
  return righe.join('\n');
};
