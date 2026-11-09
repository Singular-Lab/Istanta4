import { randomUUID } from 'node:crypto';
import { QueryTypes } from 'sequelize';
import { MINUTI_IMPORT_INTERROTTO } from '../../../lib/vendite/tipi';
import { sequelize } from '../db';
import type { PuntoVenditaGdo, VenditaDaScrivere } from '../vendite/preparaImportVendite';
import { MESSAGGIO_IMPORT_VENDITE_INTERROTTO, type RigaImportVendite } from '../vendite/statoImport';

/**
 * Letture e scritture delle vendite importate (vendite_prodotti) e dei loro import
 * (importazioni_vendite), in SQL. Ogni valore passa dalle sostituzioni, mai concatenato nella query.
 *
 * Lo stato dell'import vive nel database, cosi' funziona da qualunque processo: un solo import
 * 'in_corso' per GDO (avviaImport, con un lock sulla GDO), annullamento con il flag annullato letto
 * dal lavoro a ogni blocco, battito_il rinnovato mentre il lavoro scrive. Un 'in_corso' senza
 * battito da MINUTI_IMPORT_INTERROTTO minuti (orologio del database) risulta interrotto.
 */

export interface NuovoImportVendite {
  id: string;
  idGdo: string;
  nomeFile: string;
  /** Righe del file, scartate comprese. */
  righe: number;
  /** Scartate prima di scrivere: contano gia' come elaborate. */
  scartate: number;
  avviatoDa: string | null;
}

export type AvvioImportVendite =
  | { avviato: true; import: RigaImportVendite }
  | { avviato: false; inCorso: RigaImportVendite };

/** Dopo il controllo fra due blocchi: si prosegue, si ferma per annullamento, o l'import non e' piu' in corso. */
export type ControlloImportVendite = 'continua' | 'annullato' | 'perso';

export interface EsitoImportVendite {
  stato: 'completato' | 'annullato' | 'fallito';
  elaborate: number;
  scritte: number;
  errore: string | null;
}

export interface TotaliVendite {
  righe: number;
  prodotti: number;
  puntiVendita: number;
  dal: string | null;
  al: string | null;
}

export interface IVenditeRepository {
  /** I punti vendita della GDO, con i meta in cui cercare la chiave del cliente. */
  puntiVenditaGdo(idGdo: string): Promise<PuntoVenditaGdo[]>;
  /**
   * Crea l'import 'in_corso' della GDO, se non ce n'e' gia' uno vivo: il controllo e la creazione
   * stanno sotto un lock sulla GDO, validi fra tutti i processi. Gli 'in_corso' senza battito
   * diventano 'interrotto' e non bloccano.
   */
  avviaImport(nuovo: NuovoImportVendite): Promise<AvvioImportVendite>;
  /** Salva l'avanzamento e il battito, e dice se l'annullamento e' stato chiesto (da qualunque processo). */
  avanzamento(id: string, conteggi: { elaborate: number; scritte: number }): Promise<ControlloImportVendite>;
  /** Rinnova il battito dell'import in corso. */
  battito(id: string): Promise<void>;
  /**
   * Scrive le vendite (upsert): una vendita gia' presente per prodotto, punto vendita e periodo si
   * sostituisce. Le vendite di PV che non sono (piu') della GDO si saltano. Restituisce le righe
   * scritte. Le vendite non devono ripetere la stessa chiave.
   */
  scriviVendite(idGdo: string, idImport: string, vendite: readonly VenditaDaScrivere[]): Promise<number>;
  /** Chiude l'import ancora in corso con il suo esito. */
  concludiImport(id: string, esito: EsitoImportVendite): Promise<void>;
  /** L'ultimo import della GDO; null se non ne ha mai fatti. */
  ultimoImport(idGdo: string): Promise<RigaImportVendite | null>;
  /** Chiede di fermare l'import in corso della GDO; restituisce l'ultimo import, null senza import. */
  richiediAnnullamento(idGdo: string): Promise<RigaImportVendite | null>;
  /** Righe, prodotti, punti vendita e periodo delle vendite della GDO. */
  totali(idGdo: string): Promise<TotaliVendite>;
  /** Nome della GDO; null se non esiste. */
  nomeGdo(idGdo: string): Promise<string | null>;
}

// Colonne dell'import, con lo stato del battito calcolato dal database
const COLONNE_IMPORT = `
  id, id_gdo, stato, nome_file, righe, elaborate, scritte, scartate, errore, avviato_da,
  avviato_il, terminato_il, battito_il, annullato,
  (stato = 'in_corso' AND battito_il < NOW() - make_interval(mins => :minuti)) AS senza_battito`;

const minuti = MINUTI_IMPORT_INTERROTTO;

export class VenditeRepository implements IVenditeRepository {
  async puntiVenditaGdo(idGdo: string): Promise<PuntoVenditaGdo[]> {
    return sequelize.query<PuntoVenditaGdo>(
      `SELECT id_puntivendita AS id, nome_puntivendita AS nome, meta_puntivendita AS meta
       FROM punti_vendita
       WHERE id_gdo_puntivendita = :idGdo`,
      { replacements: { idGdo }, type: QueryTypes.SELECT }
    );
  }

  async avviaImport(nuovo: NuovoImportVendite): Promise<AvvioImportVendite> {
    return sequelize.transaction(async transaction => {
      // Lock sulla GDO: due avvii concorrenti, anche da processi diversi, non creano due import in corso
      await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:chiave))', {
        replacements: { chiave: `importazioni_vendite:${nuovo.idGdo}` },
        type: QueryTypes.SELECT,
        transaction,
      });
      // Gli 'in_corso' senza battito li ha lasciati un server fermato: si chiudono e non bloccano piu'
      await sequelize.query(
        `UPDATE importazioni_vendite
         SET stato = 'interrotto', errore = COALESCE(errore, :messaggio), terminato_il = battito_il
         WHERE id_gdo = :idGdo AND stato = 'in_corso' AND battito_il < NOW() - make_interval(mins => :minuti)`,
        { replacements: { idGdo: nuovo.idGdo, messaggio: MESSAGGIO_IMPORT_VENDITE_INTERROTTO, minuti }, type: QueryTypes.UPDATE, transaction }
      );
      const [inCorso] = await sequelize.query<RigaImportVendite>(
        `SELECT ${COLONNE_IMPORT}
         FROM importazioni_vendite
         WHERE id_gdo = :idGdo AND stato = 'in_corso'
         ORDER BY avviato_il DESC, id DESC
         LIMIT 1`,
        { replacements: { idGdo: nuovo.idGdo, minuti }, type: QueryTypes.SELECT, transaction }
      );
      if (inCorso) return { avviato: false as const, inCorso };

      const [creato] = await sequelize.query<RigaImportVendite>(
        `INSERT INTO importazioni_vendite
           (id, id_gdo, stato, nome_file, righe, elaborate, scritte, scartate, avviato_da, avviato_il, battito_il, annullato)
         VALUES (:id, :idGdo, 'in_corso', :nomeFile, :righe, :scartate, 0, :scartate, :avviatoDa, NOW(), NOW(), false)
         RETURNING ${COLONNE_IMPORT}`,
        {
          replacements: {
            id: nuovo.id,
            idGdo: nuovo.idGdo,
            nomeFile: nuovo.nomeFile,
            righe: nuovo.righe,
            scartate: nuovo.scartate,
            avviatoDa: nuovo.avviatoDa,
            minuti,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      return { avviato: true as const, import: creato };
    });
  }

  async avanzamento(id: string, conteggi: { elaborate: number; scritte: number }): Promise<ControlloImportVendite> {
    const righe = await sequelize.query<{ annullato: boolean }>(
      `UPDATE importazioni_vendite
       SET elaborate = :elaborate, scritte = :scritte, battito_il = NOW()
       WHERE id = :id AND stato = 'in_corso'
       RETURNING annullato`,
      { replacements: { id, elaborate: conteggi.elaborate, scritte: conteggi.scritte }, type: QueryTypes.SELECT }
    );
    if (righe.length === 0) return 'perso';
    return righe[0].annullato ? 'annullato' : 'continua';
  }

  async battito(id: string): Promise<void> {
    await sequelize.query(
      `UPDATE importazioni_vendite SET battito_il = NOW() WHERE id = :id AND stato = 'in_corso'`,
      { replacements: { id }, type: QueryTypes.UPDATE }
    );
  }

  async scriviVendite(idGdo: string, idImport: string, vendite: readonly VenditaDaScrivere[]): Promise<number> {
    if (vendite.length === 0) return 0;
    // Un elenco per colonna, srotolato in righe da unnest: una sola istruzione per blocco
    const [esito] = await sequelize.query<{ scritte: number }>(
      `WITH nuove AS (
         SELECT *
         FROM unnest(
           ARRAY[:ids]::uuid[],
           ARRAY[:codici]::varchar[],
           ARRAY[:puntiVendita]::uuid[],
           ARRAY[:dal]::date[],
           ARRAY[:al]::date[],
           ARRAY[:pezzi]::numeric[],
           ARRAY[:valori]::numeric[]
         ) AS v(id, codice_prodotto, id_punto_vendita, dal, al, pezzi, valore)
       ), scritte AS (
         INSERT INTO vendite_prodotti
           (id, id_gdo, codice_prodotto, id_punto_vendita, dal, al, pezzi, valore, id_import, aggiornato_il)
         SELECT n.id, CAST(:idGdo AS uuid), n.codice_prodotto, n.id_punto_vendita, n.dal, n.al, n.pezzi, n.valore,
                CAST(:idImport AS uuid), NOW()
         FROM nuove n
         WHERE EXISTS (
           SELECT 1 FROM punti_vendita pv
           WHERE pv.id_puntivendita = n.id_punto_vendita AND pv.id_gdo_puntivendita = CAST(:idGdo AS uuid)
         )
         ON CONFLICT (id_gdo, codice_prodotto, id_punto_vendita, dal, al) DO UPDATE
           SET pezzi = EXCLUDED.pezzi,
               valore = EXCLUDED.valore,
               id_import = EXCLUDED.id_import,
               aggiornato_il = EXCLUDED.aggiornato_il
         RETURNING 1
       )
       SELECT COUNT(*)::int AS scritte FROM scritte`,
      {
        replacements: {
          idGdo,
          idImport,
          ids: vendite.map(() => randomUUID()),
          codici: vendite.map(v => v.codiceProdotto),
          puntiVendita: vendite.map(v => v.idPuntoVendita),
          dal: vendite.map(v => v.dal),
          al: vendite.map(v => v.al),
          pezzi: vendite.map(v => v.pezzi),
          valori: vendite.map(v => v.valore),
        },
        type: QueryTypes.SELECT,
      }
    );
    return Number(esito?.scritte ?? 0);
  }

  async concludiImport(id: string, esito: EsitoImportVendite): Promise<void> {
    await sequelize.query(
      `UPDATE importazioni_vendite
       SET stato = :stato, elaborate = :elaborate, scritte = :scritte, errore = :errore,
           terminato_il = NOW(), battito_il = NOW()
       WHERE id = :id AND stato = 'in_corso'`,
      { replacements: { id, ...esito }, type: QueryTypes.UPDATE }
    );
  }

  async ultimoImport(idGdo: string): Promise<RigaImportVendite | null> {
    const [riga] = await sequelize.query<RigaImportVendite>(
      `SELECT ${COLONNE_IMPORT}
       FROM importazioni_vendite
       WHERE id_gdo = :idGdo
       ORDER BY avviato_il DESC, id DESC
       LIMIT 1`,
      { replacements: { idGdo, minuti }, type: QueryTypes.SELECT }
    );
    return riga ?? null;
  }

  async richiediAnnullamento(idGdo: string): Promise<RigaImportVendite | null> {
    await sequelize.query(
      `UPDATE importazioni_vendite SET annullato = true WHERE id_gdo = :idGdo AND stato = 'in_corso'`,
      { replacements: { idGdo }, type: QueryTypes.UPDATE }
    );
    return this.ultimoImport(idGdo);
  }

  async totali(idGdo: string): Promise<TotaliVendite> {
    const [riga] = await sequelize.query<{ righe: number; prodotti: number; punti_vendita: number; dal: string | null; al: string | null }>(
      `SELECT COUNT(*)::int AS righe,
              COUNT(DISTINCT codice_prodotto)::int AS prodotti,
              COUNT(DISTINCT id_punto_vendita)::int AS punti_vendita,
              to_char(MIN(dal), 'YYYY-MM-DD') AS dal,
              to_char(MAX(al), 'YYYY-MM-DD') AS al
       FROM vendite_prodotti
       WHERE id_gdo = :idGdo`,
      { replacements: { idGdo }, type: QueryTypes.SELECT }
    );
    return {
      righe: Number(riga?.righe ?? 0),
      prodotti: Number(riga?.prodotti ?? 0),
      puntiVendita: Number(riga?.punti_vendita ?? 0),
      dal: riga?.dal ?? null,
      al: riga?.al ?? null,
    };
  }

  async nomeGdo(idGdo: string): Promise<string | null> {
    const [riga] = await sequelize.query<{ nome: string }>(
      'SELECT nome_gdo AS nome FROM gdo WHERE id_gdo = :idGdo',
      { replacements: { idGdo }, type: QueryTypes.SELECT }
    );
    return riga?.nome ?? null;
  }
}
