import { QueryTypes } from 'sequelize';
import { EXPORT_DI_SISTEMA, STATO_LAVORAZIONE_KIT_RUNTIME, STATO_PROMO } from '../../../lib/enums';
import type { TipoAbbinamento, VolantinoNellaStoria } from '../../../lib/puntiVendita/storia';
import { sequelize } from '../db';
import { PuntoVenditaVolantino, type PuntoVenditaVolantinoAttributes } from '../models/punto_vendita/punti_vendita_volantino';
import type { PuntoVenditaAnagrafica } from '../utils/abbinamentoPuntiVendita';
import type { ApparizioneStoria, VolantinoSenzaPuntoVendita } from '../utils/storiaPuntoVendita';

/**
 * Letture e scritture della tabella punti_vendita_volantino (i PV stampati nelle liste dei
 * volantini), in SQL come le viste Volantini e POP: ogni valore passa dalle sostituzioni.
 *
 * Nella storia di un PV contano solo i kit non eliminati di promo non eliminate. La data di un
 * volantino e' il giorno d'inizio della promo nel calendario italiano (o, se manca, la fine o la
 * creazione del kit).
 */

/** Il kit a cui appartiene una lista, con la GDO della sua combinazione canale/area. */
export interface KitVolantino {
  id: string;
  titolo: string;
  statoLavorazione: string;
  idPromo: string;
  nomePromo: string | null;
  idCanale: string;
  idArea: string;
  /** Dalla combinazione canale/area del kit, o dal canale; null se non si trova. */
  idGdo: string | null;
}

export type NuovaRigaVolantino = Omit<PuntoVenditaVolantinoAttributes, 'id' | 'createdat' | 'id_punto_vendita' | 'abbinamento'>;

export interface RigaDaRiabbinare {
  id: string;
  localita: string | null;
  chiave_indirizzo: string | null;
  chiave_telefono: string | null;
  id_punto_vendita: string | null;
  abbinamento: TipoAbbinamento | null;
}

export interface CambioAbbinamento {
  id: string;
  idPuntoVendita: string | null;
  abbinamento: TipoAbbinamento | null;
}

export interface PuntoVenditaDellaStoria extends PuntoVenditaAnagrafica {
  idGdo: string;
}

export interface IPuntiVenditaVolantinoRepository {
  trovaKit(idKit: string): Promise<KitVolantino | null>;
  /** Toglie le righe del kit e scrive quelle nuove, in una transazione. */
  sostituisciRigheKit(idKit: string, righe: readonly NuovaRigaVolantino[]): Promise<void>;
  contaRigheKit(idKit: string): Promise<{ righe: number; abbinate: number }>;
  puntiVenditaGdo(idGdo: string): Promise<PuntoVenditaAnagrafica[]>;
  /**
   * Righe della GDO senza PV; con soloKit, solo quelle di quei kit. Le righe collegate a un PV non si
   * riabbinano mai: perdono il collegamento solo se il PV si elimina (ON DELETE SET NULL).
   */
  righeDaRiabbinare(idGdo: string, soloKit?: readonly string[]): Promise<RigaDaRiabbinare[]>;
  aggiornaAbbinamenti(cambi: readonly CambioAbbinamento[]): Promise<void>;
  trovaPuntoVendita(id: string): Promise<PuntoVenditaDellaStoria | null>;
  /** Le apparizioni del PV nei volantini, dalla piu' vecchia. */
  apparizioni(idPuntoVendita: string): Promise<ApparizioneStoria[]>;
  /** Volantini con la lista registrata della stessa insegna e area, dopo la data indicata, in cui il PV non c'e'. */
  volantiniSenzaPuntoVendita(criteri: {
    idPuntoVendita: string;
    idGdo: string;
    idCanale: string;
    idArea: string;
    dopo: string;
  }): Promise<VolantinoSenzaPuntoVendita[]>;
  /** I volantini in cui compare il PV, dal piu' recente, una volta per kit. */
  paginaVolantini(idPuntoVendita: string, limite: number, scarto: number): Promise<{ volantini: VolantinoNellaStoria[]; totale: number }>;
}

type Sostituzioni = Record<string, unknown>;

/** Le date delle promo sono giorni del calendario italiano, qualunque sia il fuso della connessione. */
const FUSO_PROMO = 'Europe/Rome';
// Righe per istruzione nelle scritture a blocchi
const BLOCCO = 1000;

/** Sostituzioni dei frammenti qui sotto: le usano anche le letture dell'analisi dei punti vendita. */
export const SOSTITUZIONI_FISSE: Sostituzioni = {
  fuso: FUSO_PROMO,
  kitEliminato: STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO,
  promoEliminata: STATO_PROMO.ELIMINATA,
  codiceVolantino: EXPORT_DI_SISTEMA.VOL,
};

const giorno = (colonna: string) => `to_char(${colonna} AT TIME ZONE :fuso, 'YYYY-MM-DD')`;
export const DATA_EDIZIONE = giorno('COALESCE(p.validita_dal, p.validita_al, k."createdAt")');

/** Kit e promo che contano nella storia: non eliminati. */
export const KIT_VALIDI = `k.stato_lavorazione::text <> :kitEliminato AND p.stato::text <> :promoEliminata`;

const COLONNE_APPARIZIONE = `
  k.id::text AS id_kit, k.titolo AS titolo_kit,
  p.id_promo, p.nome_promo, p.stato::text AS stato_promo,
  ${giorno('p.validita_dal')} AS validita_dal, ${giorno('p.validita_al')} AS validita_al,
  ${DATA_EDIZIONE} AS data_edizione,
  k.id_canale::text AS id_canale, COALESCE(c.nome_canali, k.nome_canale, '') AS nome_canale,
  k.id_area::text AS id_area, COALESCE(a.nome_aree, k.nome_area, '') AS nome_area`;

const DA_KIT = `
  JOIN runtime_kit k ON k.id = r.id_kit_runtime
  JOIN promo p ON p.id_promo = k.id_promo
  LEFT JOIN canali c ON c.id_canali = k.id_canale
  LEFT JOIN aree a ON a.id_aree = k.id_area`;

/** Il PDF del volantino: il primo file dell'export VOL che sta su Olimpo, meglio se PDF (come la copertina dei Volantini). */
export const PDF_VOLANTINO = `
  LEFT JOIN LATERAL (
    SELECT f.id::text AS id, f.id_olimpo_cloud, f.nome, f.pages
    FROM files_runtime f
    WHERE f.id_runtime = k.id
      AND COALESCE(f.id_olimpo_cloud, '') <> ''
      AND (
        COALESCE(f.tipo_export_codice, '') = :codiceVolantino
        OR EXISTS (
          SELECT 1 FROM tipi_export te
          WHERE te.codice_tipiexport = :codiceVolantino AND te.id_tipiexport::text = f.tipo_export
        )
      )
    ORDER BY (COALESCE(f.mime, '') ILIKE '%pdf%') DESC, f.nome, f."createdAt"
    LIMIT 1
  ) vol ON TRUE`;

interface RigaApparizione {
  id_kit: string;
  titolo_kit: string;
  id_promo: string;
  nome_promo: string;
  stato_promo: string;
  validita_dal: string | null;
  validita_al: string | null;
  data_edizione: string;
  id_canale: string;
  nome_canale: string;
  id_area: string;
  nome_area: string;
  riga: string;
  localita: string | null;
  indirizzo: string | null;
  telefono: string | null;
  chiave_indirizzo: string | null;
  chiave_telefono: string | null;
  abbinamento: TipoAbbinamento;
}

interface RigaVolantino extends RigaApparizione {
  numero_referenze: number | null;
  pdf_id: string | null;
  pdf_id_olimpo: string | null;
  pdf_nome: string | null;
  pdf_pagine: number | null;
}

const apparizioneDa = (riga: RigaApparizione): ApparizioneStoria => ({
  idKit: riga.id_kit,
  titoloKit: riga.titolo_kit,
  promo: {
    id: riga.id_promo,
    nome: riga.nome_promo,
    stato: riga.stato_promo as STATO_PROMO,
    validitaDal: riga.validita_dal,
    validitaAl: riga.validita_al,
  },
  canale: { id: riga.id_canale, nome: riga.nome_canale },
  area: { id: riga.id_area, nome: riga.nome_area },
  data: riga.data_edizione,
  rigaStampata: riga.riga,
  localita: riga.localita,
  indirizzo: riga.indirizzo,
  telefono: riga.telefono,
  chiaveIndirizzo: riga.chiave_indirizzo,
  chiaveTelefono: riga.chiave_telefono,
  abbinamento: riga.abbinamento,
});

const volantinoDa = (riga: RigaVolantino): VolantinoNellaStoria => {
  const { idKit, titoloKit, promo, canale, area, rigaStampata, localita, indirizzo, telefono, abbinamento } = apparizioneDa(riga);
  return {
    idKit, titoloKit, promo, canale, area, rigaStampata, localita, indirizzo, telefono, abbinamento,
    numeroReferenze: riga.numero_referenze === null ? null : Number(riga.numero_referenze),
    pdf: riga.pdf_id && riga.pdf_id_olimpo
      ? { idFile: riga.pdf_id, idOlimpoCloud: riga.pdf_id_olimpo, nome: riga.pdf_nome ?? '', pagine: riga.pdf_pagine ?? null }
      : null,
  };
};

const blocchi = <T>(elenco: readonly T[]): T[][] => {
  const risultato: T[][] = [];
  for (let inizio = 0; inizio < elenco.length; inizio += BLOCCO) risultato.push(elenco.slice(inizio, inizio + BLOCCO));
  return risultato;
};

export class PuntiVenditaVolantinoRepository implements IPuntiVenditaVolantinoRepository {
  private async seleziona<T extends object>(sql: string, sostituzioni: Sostituzioni = {}): Promise<T[]> {
    return sequelize.query<T>(sql, {
      replacements: { ...SOSTITUZIONI_FISSE, ...sostituzioni },
      type: QueryTypes.SELECT,
    });
  }

  async trovaKit(idKit: string): Promise<KitVolantino | null> {
    const [riga] = await this.seleziona<{
      id: string; titolo: string; stato_lavorazione: string; id_promo: string; nome_promo: string | null;
      id_canale: string; id_area: string; id_gdo: string | null;
    }>(
      `SELECT k.id::text AS id, k.titolo, k.stato_lavorazione::text AS stato_lavorazione, k.id_promo, p.nome_promo,
              k.id_canale::text AS id_canale, k.id_area::text AS id_area,
              COALESCE(
                (SELECT cca.id_gdo_combinazione_canale_area::text
                 FROM combinazione_canale_area cca
                 WHERE cca.id_canale_combinazione_canale_area = k.id_canale
                   AND cca.id_area_combinazione_canale_area = k.id_area
                 LIMIT 1),
                c.id_gdo_canali::text
              ) AS id_gdo
       FROM runtime_kit k
       LEFT JOIN promo p ON p.id_promo = k.id_promo
       LEFT JOIN canali c ON c.id_canali = k.id_canale
       WHERE k.id = :idKit`,
      { idKit }
    );
    if (!riga) return null;
    return {
      id: riga.id,
      titolo: riga.titolo,
      statoLavorazione: riga.stato_lavorazione,
      idPromo: riga.id_promo,
      nomePromo: riga.nome_promo,
      idCanale: riga.id_canale,
      idArea: riga.id_area,
      idGdo: riga.id_gdo,
    };
  }

  async sostituisciRigheKit(idKit: string, righe: readonly NuovaRigaVolantino[]): Promise<void> {
    await sequelize.transaction(async (transaction) => {
      await PuntoVenditaVolantino.destroy({ where: { id_kit_runtime: idKit }, transaction });
      for (const blocco of blocchi(righe)) {
        await PuntoVenditaVolantino.bulkCreate(blocco.map(riga => ({ ...riga })), { transaction });
      }
    });
  }

  async contaRigheKit(idKit: string): Promise<{ righe: number; abbinate: number }> {
    const [riga] = await this.seleziona<{ righe: number; abbinate: number }>(
      `SELECT COUNT(*)::int AS righe, COUNT(id_punto_vendita)::int AS abbinate
       FROM punti_vendita_volantino
       WHERE id_kit_runtime = :idKit`,
      { idKit }
    );
    return { righe: Number(riga?.righe ?? 0), abbinate: Number(riga?.abbinate ?? 0) };
  }

  async puntiVenditaGdo(idGdo: string): Promise<PuntoVenditaAnagrafica[]> {
    return this.seleziona<PuntoVenditaAnagrafica>(
      `SELECT id_puntivendita::text AS id, citta_puntivendita AS citta,
              indirizzo_puntivendita AS indirizzo, telefono_puntivendita AS telefono
       FROM punti_vendita
       WHERE id_gdo_puntivendita = :idGdo`,
      { idGdo }
    );
  }

  async righeDaRiabbinare(idGdo: string, soloKit?: readonly string[]): Promise<RigaDaRiabbinare[]> {
    if (soloKit && soloKit.length === 0) return [];
    const deiKit = soloKit ? 'AND r.id_kit_runtime IN (:soloKit)' : '';
    // Dall'indice parziale delle righe senza PV della GDO
    return this.seleziona<RigaDaRiabbinare>(
      `SELECT r.id::text AS id, r.localita, r.chiave_indirizzo, r.chiave_telefono,
              r.id_punto_vendita::text AS id_punto_vendita, r.abbinamento
       FROM punti_vendita_volantino r
       WHERE r.id_gdo = :idGdo AND r.id_punto_vendita IS NULL
         ${deiKit}
       ORDER BY r.id_kit_runtime, r.posizione`,
      { idGdo, soloKit: [...(soloKit ?? [])] }
    );
  }

  async aggiornaAbbinamenti(cambi: readonly CambioAbbinamento[]): Promise<void> {
    if (cambi.length === 0) return;
    // Un UPDATE per ogni coppia (PV, tipo): le righe che finiscono allo stesso modo vanno insieme
    const gruppi = new Map<string, CambioAbbinamento[]>();
    for (const cambio of cambi) {
      const chiave = `${cambio.idPuntoVendita ?? ''}|${cambio.abbinamento ?? ''}`;
      gruppi.set(chiave, [...(gruppi.get(chiave) ?? []), cambio]);
    }
    await sequelize.transaction(async (transaction) => {
      for (const gruppo of gruppi.values()) {
        const { idPuntoVendita, abbinamento } = gruppo[0];
        for (const blocco of blocchi(gruppo)) {
          await PuntoVenditaVolantino.update(
            { id_punto_vendita: idPuntoVendita, abbinamento },
            { where: { id: blocco.map(cambio => cambio.id) }, transaction }
          );
        }
      }
    });
  }

  async trovaPuntoVendita(id: string): Promise<PuntoVenditaDellaStoria | null> {
    const [riga] = await this.seleziona<PuntoVenditaDellaStoria>(
      `SELECT id_puntivendita::text AS id, id_gdo_puntivendita::text AS "idGdo", citta_puntivendita AS citta,
              indirizzo_puntivendita AS indirizzo, telefono_puntivendita AS telefono
       FROM punti_vendita
       WHERE id_puntivendita = :id`,
      { id }
    );
    return riga ?? null;
  }

  async apparizioni(idPuntoVendita: string): Promise<ApparizioneStoria[]> {
    const righe = await this.seleziona<RigaApparizione>(
      `SELECT ${COLONNE_APPARIZIONE},
              r.riga, r.localita, r.indirizzo, r.telefono, r.chiave_indirizzo, r.chiave_telefono, r.abbinamento
       FROM punti_vendita_volantino r
       ${DA_KIT}
       WHERE r.id_punto_vendita = :idPuntoVendita AND ${KIT_VALIDI}
       ORDER BY data_edizione, k.id, r.posizione`,
      { idPuntoVendita }
    );
    return righe.map(apparizioneDa);
  }

  async volantiniSenzaPuntoVendita(criteri: {
    idPuntoVendita: string;
    idGdo: string;
    idCanale: string;
    idArea: string;
    dopo: string;
  }): Promise<VolantinoSenzaPuntoVendita[]> {
    const righe = await this.seleziona<{ id_kit: string; data: string }>(
      `SELECT k.id::text AS id_kit, ${DATA_EDIZIONE} AS data
       FROM runtime_kit k
       JOIN promo p ON p.id_promo = k.id_promo
       WHERE k.id_canale = :idCanale AND k.id_area = :idArea AND ${KIT_VALIDI}
         AND ${DATA_EDIZIONE} > :dopo
         AND EXISTS (SELECT 1 FROM punti_vendita_volantino r WHERE r.id_kit_runtime = k.id AND r.id_gdo = :idGdo)
         AND NOT EXISTS (
           SELECT 1 FROM punti_vendita_volantino r WHERE r.id_kit_runtime = k.id AND r.id_punto_vendita = :idPuntoVendita
         )
       ORDER BY data, k.id`,
      criteri
    );
    return righe.map(riga => ({ idKit: riga.id_kit, data: riga.data }));
  }

  async paginaVolantini(idPuntoVendita: string, limite: number, scarto: number): Promise<{ volantini: VolantinoNellaStoria[]; totale: number }> {
    // Una riga per kit: se il PV compare due volte nella stessa lista conta la prima
    const apparizioni = `
      WITH ap AS (
        SELECT DISTINCT ON (r.id_kit_runtime) r.*
        FROM punti_vendita_volantino r
        WHERE r.id_punto_vendita = :idPuntoVendita
        ORDER BY r.id_kit_runtime, r.posizione
      )`;
    const [righe, [conteggio]] = await Promise.all([
      this.seleziona<RigaVolantino>(
        `${apparizioni}
         SELECT ${COLONNE_APPARIZIONE},
                r.riga, r.localita, r.indirizzo, r.telefono, r.chiave_indirizzo, r.chiave_telefono, r.abbinamento,
                (SELECT COUNT(*) FROM referenze rf WHERE rf.id_runtime_kit = k.id)::int AS numero_referenze,
                vol.id AS pdf_id, vol.id_olimpo_cloud AS pdf_id_olimpo, vol.nome AS pdf_nome, vol.pages AS pdf_pagine
         FROM ap r
         ${DA_KIT}
         ${PDF_VOLANTINO}
         WHERE ${KIT_VALIDI}
         ORDER BY data_edizione DESC, p.validita_al DESC NULLS LAST, k.titolo, k.id
         LIMIT :limite OFFSET :scarto`,
        { idPuntoVendita, limite, scarto }
      ),
      this.seleziona<{ totale: number }>(
        `${apparizioni}
         SELECT COUNT(*)::int AS totale
         FROM ap r
         JOIN runtime_kit k ON k.id = r.id_kit_runtime
         JOIN promo p ON p.id_promo = k.id_promo
         WHERE ${KIT_VALIDI}`,
        { idPuntoVendita }
      ),
    ]);
    return { volantini: righe.map(volantinoDa), totale: Number(conteggio?.totale ?? 0) };
  }
}
