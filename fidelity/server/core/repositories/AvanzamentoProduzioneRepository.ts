import { QueryTypes } from 'sequelize';
import { STATO_LAVORAZIONE_KIT_RUNTIME, STATO_LOG_FILE, TIPO_LAVORAZIONE } from '../../../lib/enums';
import { sequelize } from '../db';
import { FILE_NON_CORREGGO, NOME_AREA, NOME_CANALE, type RigaPromo, SOSTITUZIONI_FISSE } from './MaterialiRepository';

/**
 * Letture della pagina Avanzamento produzione (/api/produzione/avanzamento), in SQL e con le
 * stesse regole delle viste Volantini e POP: volantino o POP lo decide il formato del kit, i kit
 * MANUALI e quelli eliminati non compaiono, i file dell'export CORREGGO non si contano.
 */

export interface RigaPromoAvanzamento extends RigaPromo {
  data_scadenza: Date | string | null;
}

export interface RigaKitAvanzamento {
  id: string;
  id_design: string | null;
  id_promo: string;
  titolo: string;
  stato_kit: string;
  tipo_lavorazione: number;
  id_area: string;
  nome_area: string;
  id_canale: string;
  nome_canale: string;
  avviato_il: Date | string;
  numero_file: number;
  file_accettati: number;
  file_in_errore: number;
}

export interface RigaTipoFormato {
  id_formati: string;
  tipo_lavorazione_formati: number | null;
}

export interface IAvanzamentoProduzioneRepository {
  /**
   * Promo negli stati indicati, della GDO indicata (tutte con null), dalla scadenza della
   * lavorazione più vicina; quelle senza scadenza in fondo.
   */
  elencaPromo(statiPromo: readonly string[], idGdo: string | null): Promise<RigaPromoAvanzamento[]>;
  /** Kit volantino e POP non eliminati delle promo indicate, con i file per stato dell'ultima versione. */
  elencaKit(idPromo: readonly string[]): Promise<RigaKitAvanzamento[]>;
  trovaTipiFormati(idFormati: readonly string[]): Promise<RigaTipoFormato[]>;
}

/** Tipi di formato della pagina: i formati senza tipo non sono né volantino né POP. */
export const TIPI_LAVORAZIONE_AVANZAMENTO: readonly TIPO_LAVORAZIONE[] = [TIPO_LAVORAZIONE.VOLANTINO, TIPO_LAVORAZIONE.POP];

const STATI_FILE_ACCETTATI: readonly string[] = [STATO_LOG_FILE.ACCETTATO, STATO_LOG_FILE.PUBBLICATO];

export class AvanzamentoProduzioneRepository implements IAvanzamentoProduzioneRepository {
  private async seleziona<T extends object>(sql: string, sostituzioni: Record<string, unknown>): Promise<T[]> {
    return sequelize.query<T>(sql, {
      replacements: { ...SOSTITUZIONI_FISSE, ...sostituzioni },
      type: QueryTypes.SELECT,
    });
  }

  async elencaPromo(statiPromo: readonly string[], idGdo: string | null): Promise<RigaPromoAvanzamento[]> {
    if (statiPromo.length === 0) return [];
    return this.seleziona<RigaPromoAvanzamento>(
      `SELECT p.id_promo, p.nome_promo, p.stato::text AS stato_promo, p.validita_dal, p.validita_al, p.data_scadenza
       FROM promo p
       WHERE p.stato IN (:statiPromo)
         ${idGdo === null ? '' : 'AND p.gdo = :idGdo'}
       ORDER BY p.data_scadenza ASC NULLS LAST, p.validita_dal ASC NULLS LAST, p.nome_promo, p.id_promo`,
      { statiPromo: [...statiPromo], idGdo }
    );
  }

  async elencaKit(idPromo: readonly string[]): Promise<RigaKitAvanzamento[]> {
    if (idPromo.length === 0) return [];
    // Stato di ogni file: quello della sua versione più alta, dall'indice (id_kit_runtime, nome_file, versione DESC)
    return this.seleziona<RigaKitAvanzamento>(
      `SELECT
         k.id::text AS id, k.id_design::text AS id_design, k.id_promo::text AS id_promo, k.titolo,
         k.stato_lavorazione::text AS stato_kit, fo.tipo_lavorazione_formati AS tipo_lavorazione,
         k.id_area::text AS id_area, ${NOME_AREA} AS nome_area,
         k.id_canale::text AS id_canale, ${NOME_CANALE} AS nome_canale,
         k."createdAt" AS avviato_il,
         fi.numero_file, fi.file_accettati, fi.file_in_errore
       FROM runtime_kit k
       JOIN formati fo ON fo.id_formati = k.id_formato
       LEFT JOIN aree a ON a.id_aree = k.id_area
       LEFT JOIN canali c ON c.id_canali = k.id_canale
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)::int AS numero_file,
           (COUNT(*) FILTER (WHERE ul.stato IN (:statiAccettati)))::int AS file_accettati,
           (COUNT(*) FILTER (WHERE ul.stato = :statoErrore))::int AS file_in_errore
         FROM files_runtime f
         LEFT JOIN LATERAL (
           SELECT l.stato::text AS stato
           FROM files_runtime_log l
           WHERE l.id_kit_runtime = k.id AND l.nome_file = f.nome
           ORDER BY l.versione DESC
           LIMIT 1
         ) ul ON TRUE
         WHERE f.id_runtime = k.id AND ${FILE_NON_CORREGGO}
       ) fi ON TRUE
       WHERE k.id_promo IN (:idPromo)
         AND fo.tipo_lavorazione_formati IN (:tipiLavorazione)
         AND k.tipo <> :tipoManuale
         AND k.stato_lavorazione <> :statoEliminato
       ORDER BY k.titolo, k.id`,
      {
        idPromo: [...idPromo],
        tipiLavorazione: [...TIPI_LAVORAZIONE_AVANZAMENTO],
        statiAccettati: [...STATI_FILE_ACCETTATI],
        statoErrore: STATO_LOG_FILE.ERRORE,
        statoEliminato: STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO,
      }
    );
  }

  async trovaTipiFormati(idFormati: readonly string[]): Promise<RigaTipoFormato[]> {
    if (idFormati.length === 0) return [];
    // Confronto come testo: gli id arrivano da Istanta e un id malformato non deve rompere la query
    return this.seleziona<RigaTipoFormato>(
      `SELECT fo.id_formati::text AS id_formati, fo.tipo_lavorazione_formati
       FROM formati fo
       WHERE fo.id_formati::text IN (:idFormati)`,
      { idFormati: [...idFormati] }
    );
  }
}
