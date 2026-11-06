import { QueryTypes } from 'sequelize';
import { STATO_LAVORAZIONE_KIT_RUNTIME } from '../../../lib/enums';
import { STATI_PROMO_CONSULTABILI } from '../../../lib/consultazione/periodi';
import type { AmbitoGdo } from '../accessi/contestoAccesso';
import { sequelize } from '../db';
import {
  comeRicercaParziale,
  condizioneAmbitoGdo,
  FILE_NON_CORREGGO,
  NOME_AREA,
  NOME_CANALE,
  type RigaPromo,
  SOSTITUZIONI_FISSE,
} from './MaterialiRepository';

/**
 * Letture dei dati di consultazione (/api/consultazione) che non passano da MaterialiRepository:
 * dettaglio di un kit, file scaricabili, contenuti digitali. Solo kit PUBBLICATI di promo non
 * eliminate della GDO dell'ambito; mai i file dell'export CORREGGO. Ogni valore dell'utente passa
 * dalle sostituzioni, mai concatenato nel testo della query.
 */

type Sostituzioni = Record<string, unknown>;

export interface RigaKitConsultazione extends RigaPromo {
  id: string;
  titolo: string;
  id_area: string;
  nome_area: string;
  id_canale: string;
  nome_canale: string;
}

export interface RigaFileConsultazione {
  id: string;
  nome: string | null;
  nome_originale: string | null;
  mime: string | null;
  pagine: number | null;
  id_olimpo_cloud: string | null;
  tipo_export: string | null;
}

export interface RigaContenutoDigitale extends RigaFileConsultazione, RigaPromo {
  id_kit: string;
  titolo_kit: string;
  id_area: string;
  nome_area: string;
  id_canale: string;
  nome_canale: string;
  id_formato: string | null;
  nome_formato: string | null;
}

export interface RigaOpzioneContenutoDigitale {
  id_promo: string;
  nome_promo: string;
  validita_dal: Date | string | null;
  id_tipo_export: string | null;
  nome_tipo_export: string | null;
  id_formato: string | null;
  nome_formato: string | null;
  id_area: string;
  nome_area: string;
  id_canale: string;
  nome_canale: string;
}

export interface FiltriSqlContenutiDigitali {
  cerca?: string;
  /** Campi dei metadati del file in cui cercare (configurazione dell'installazione). */
  campiRicerca?: readonly string[];
  idPromo?: string;
  idTipoExport?: string;
  idFormato?: string;
  idArea?: string;
  idCanale?: string;
}

export interface IConsultazioneRepository {
  /** La promo, se e' in uno degli stati indicati ed e' della GDO dell'ambito. */
  trovaPromo(idPromo: string, statiPromo: readonly string[], ambito: AmbitoGdo): Promise<RigaPromo | null>;
  /** Kit pubblicato di una promo consultabile della GDO dell'ambito. */
  trovaKitPubblicato(idKit: string, ambito: AmbitoGdo): Promise<RigaKitConsultazione | null>;
  /** File del kit, senza l'export CORREGGO: prima i PDF, poi per nome. */
  elencaFileKit(idKit: string): Promise<RigaFileConsultazione[]>;
  /** File che la consultazione puo' scaricare: di un kit pubblicato della GDO, su Olimpo, non CORREGGO. */
  trovaFileScaricabile(idFile: string, ambito: AmbitoGdo): Promise<RigaFileConsultazione | null>;
  elencaContenutiDigitali(
    filtri: FiltriSqlContenutiDigitali,
    ambito: AmbitoGdo,
    pagina: { limite: number; scarto: number }
  ): Promise<RigaContenutoDigitale[]>;
  contaContenutiDigitali(filtri: FiltriSqlContenutiDigitali, ambito: AmbitoGdo): Promise<number>;
  elencaOpzioniContenutiDigitali(ambito: AmbitoGdo): Promise<RigaOpzioneContenutoDigitale[]>;
}

const COLONNE_PROMO = `p.id_promo, p.nome_promo, p.stato::text AS stato_promo, p.validita_dal, p.validita_al`;

/** Codice del tipo di export del file: quello salvato, o quello del tipo di export collegato. */
const CODICE_TIPO_EXPORT = `COALESCE(NULLIF(f.tipo_export_codice, ''), te.codice_tipiexport)`;

const COLONNE_FILE = `
  f.id::text AS id, f.nome, f.nome_originale, f.mime, f.pages AS pagine, f.id_olimpo_cloud,
  ${CODICE_TIPO_EXPORT} AS tipo_export`;

/** Kit pubblicato di una promo consultabile: le condizioni comuni a ogni lettura. */
function condizioniKitPubblicato(ambito: AmbitoGdo, sostituzioni: Sostituzioni): string[] {
  sostituzioni.statoPubblicato = STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO;
  sostituzioni.statiConsultabili = [...STATI_PROMO_CONSULTABILI];
  const condizioni = ['k.stato_lavorazione = :statoPubblicato', 'p.stato IN (:statiConsultabili)'];
  const gdo = condizioneAmbitoGdo(ambito, sostituzioni);
  if (gdo) condizioni.push(gdo);
  return condizioni;
}

/** Testo di un campo dei metadati del file: stringa, o oggetto con `content`. */
const testoMeta = (sostituzione: string) =>
  `COALESCE(f.meta_olimpo_cloud -> :${sostituzione} ->> 'content', f.meta_olimpo_cloud ->> :${sostituzione})`;

function condizioniContenutiDigitali(filtri: FiltriSqlContenutiDigitali, ambito: AmbitoGdo, sostituzioni: Sostituzioni): string[] {
  const condizioni = [...condizioniKitPubblicato(ambito, sostituzioni), 'k.tipo = :tipoManuale', FILE_NON_CORREGGO];
  if (filtri.cerca) {
    sostituzioni.cerca = comeRicercaParziale(filtri.cerca);
    const campi = (filtri.campiRicerca ?? []).map((campo, indice) => {
      sostituzioni[`campoRicerca${indice}`] = campo;
      return `${testoMeta(`campoRicerca${indice}`)} ILIKE :cerca`;
    });
    condizioni.push(`(${['k.titolo ILIKE :cerca', 'f.nome ILIKE :cerca', ...campi].join(' OR ')})`);
  }
  if (filtri.idPromo) {
    condizioni.push('k.id_promo = :filtroPromo');
    sostituzioni.filtroPromo = filtri.idPromo;
  }
  if (filtri.idTipoExport) {
    condizioni.push('te.id_tipiexport::text = :filtroTipoExport');
    sostituzioni.filtroTipoExport = filtri.idTipoExport;
  }
  if (filtri.idFormato) {
    condizioni.push('k.id_formato::text = :filtroFormato');
    sostituzioni.filtroFormato = filtri.idFormato;
  }
  if (filtri.idArea) {
    condizioni.push('k.id_area::text = :filtroArea');
    sostituzioni.filtroArea = filtri.idArea;
  }
  if (filtri.idCanale) {
    condizioni.push('k.id_canale::text = :filtroCanale');
    sostituzioni.filtroCanale = filtri.idCanale;
  }
  return condizioni;
}

const DA_FILE_CONTENUTI = `
  FROM files_runtime f
  JOIN runtime_kit k ON k.id = f.id_runtime
  JOIN promo p ON p.id_promo = k.id_promo
  LEFT JOIN formati fo ON fo.id_formati = k.id_formato
  LEFT JOIN aree a ON a.id_aree = k.id_area
  LEFT JOIN canali c ON c.id_canali = k.id_canale
  LEFT JOIN tipi_export te ON te.id_tipiexport::text = f.tipo_export`;

export class ConsultazioneRepository implements IConsultazioneRepository {
  private async seleziona<T extends object>(sql: string, sostituzioni: Sostituzioni): Promise<T[]> {
    return sequelize.query<T>(sql, {
      replacements: { ...SOSTITUZIONI_FISSE, ...sostituzioni },
      type: QueryTypes.SELECT,
    });
  }

  async trovaPromo(idPromo: string, statiPromo: readonly string[], ambito: AmbitoGdo): Promise<RigaPromo | null> {
    if (statiPromo.length === 0) return null;
    const sostituzioni: Sostituzioni = { idPromo, statiPromo: [...statiPromo] };
    const condizioni = ['p.id_promo = :idPromo', 'p.stato IN (:statiPromo)'];
    const gdo = condizioneAmbitoGdo(ambito, sostituzioni);
    if (gdo) condizioni.push(gdo);
    const righe = await this.seleziona<RigaPromo>(
      `SELECT ${COLONNE_PROMO} FROM promo p WHERE ${condizioni.join(' AND ')}`,
      sostituzioni
    );
    return righe[0] ?? null;
  }

  async trovaKitPubblicato(idKit: string, ambito: AmbitoGdo): Promise<RigaKitConsultazione | null> {
    const sostituzioni: Sostituzioni = { idKit };
    const condizioni = ['k.id = :idKit', ...condizioniKitPubblicato(ambito, sostituzioni)];
    const righe = await this.seleziona<RigaKitConsultazione>(
      `SELECT k.id::text AS id, k.titolo, ${COLONNE_PROMO},
         k.id_area::text AS id_area, ${NOME_AREA} AS nome_area,
         k.id_canale::text AS id_canale, ${NOME_CANALE} AS nome_canale
       FROM runtime_kit k
       JOIN promo p ON p.id_promo = k.id_promo
       LEFT JOIN aree a ON a.id_aree = k.id_area
       LEFT JOIN canali c ON c.id_canali = k.id_canale
       WHERE ${condizioni.join(' AND ')}`,
      sostituzioni
    );
    return righe[0] ?? null;
  }

  async elencaFileKit(idKit: string): Promise<RigaFileConsultazione[]> {
    return this.seleziona<RigaFileConsultazione>(
      `SELECT ${COLONNE_FILE}
       FROM files_runtime f
       LEFT JOIN tipi_export te ON te.id_tipiexport::text = f.tipo_export
       WHERE f.id_runtime = :idKit AND ${FILE_NON_CORREGGO}
       ORDER BY (COALESCE(f.mime, '') ILIKE '%pdf%') DESC, f.nome, f.id`,
      { idKit }
    );
  }

  async trovaFileScaricabile(idFile: string, ambito: AmbitoGdo): Promise<RigaFileConsultazione | null> {
    const sostituzioni: Sostituzioni = { idFile };
    const condizioni = [
      'f.id = :idFile',
      "COALESCE(f.id_olimpo_cloud, '') <> ''",
      FILE_NON_CORREGGO,
      ...condizioniKitPubblicato(ambito, sostituzioni),
    ];
    const righe = await this.seleziona<RigaFileConsultazione>(
      `SELECT ${COLONNE_FILE}
       FROM files_runtime f
       JOIN runtime_kit k ON k.id = f.id_runtime
       JOIN promo p ON p.id_promo = k.id_promo
       LEFT JOIN tipi_export te ON te.id_tipiexport::text = f.tipo_export
       WHERE ${condizioni.join(' AND ')}`,
      sostituzioni
    );
    return righe[0] ?? null;
  }

  async elencaContenutiDigitali(
    filtri: FiltriSqlContenutiDigitali,
    ambito: AmbitoGdo,
    pagina: { limite: number; scarto: number }
  ): Promise<RigaContenutoDigitale[]> {
    const sostituzioni: Sostituzioni = { limite: pagina.limite, scarto: pagina.scarto };
    const condizioni = condizioniContenutiDigitali(filtri, ambito, sostituzioni);
    return this.seleziona<RigaContenutoDigitale>(
      `SELECT ${COLONNE_FILE}, ${COLONNE_PROMO},
         k.id::text AS id_kit, k.titolo AS titolo_kit,
         k.id_area::text AS id_area, ${NOME_AREA} AS nome_area,
         k.id_canale::text AS id_canale, ${NOME_CANALE} AS nome_canale,
         k.id_formato::text AS id_formato, fo.nome_formati AS nome_formato
       ${DA_FILE_CONTENUTI}
       WHERE ${condizioni.join(' AND ')}
       ORDER BY p.validita_dal DESC NULLS LAST, p.nome_promo, k.titolo, f.nome, f.id
       LIMIT :limite OFFSET :scarto`,
      sostituzioni
    );
  }

  async contaContenutiDigitali(filtri: FiltriSqlContenutiDigitali, ambito: AmbitoGdo): Promise<number> {
    const sostituzioni: Sostituzioni = {};
    const condizioni = condizioniContenutiDigitali(filtri, ambito, sostituzioni);
    const [riga] = await this.seleziona<{ totale: number }>(
      `SELECT COUNT(*)::int AS totale
       ${DA_FILE_CONTENUTI}
       WHERE ${condizioni.join(' AND ')}`,
      sostituzioni
    );
    return Number(riga?.totale ?? 0);
  }

  async elencaOpzioniContenutiDigitali(ambito: AmbitoGdo): Promise<RigaOpzioneContenutoDigitale[]> {
    const sostituzioni: Sostituzioni = {};
    const condizioni = condizioniContenutiDigitali({}, ambito, sostituzioni);
    return this.seleziona<RigaOpzioneContenutoDigitale>(
      `SELECT DISTINCT
         p.id_promo, p.nome_promo, p.validita_dal,
         te.id_tipiexport::text AS id_tipo_export, te.nome_tipiexport AS nome_tipo_export,
         k.id_formato::text AS id_formato, fo.nome_formati AS nome_formato,
         k.id_area::text AS id_area, ${NOME_AREA} AS nome_area,
         k.id_canale::text AS id_canale, ${NOME_CANALE} AS nome_canale
       ${DA_FILE_CONTENUTI}
       WHERE ${condizioni.join(' AND ')}`,
      sostituzioni
    );
  }
}
