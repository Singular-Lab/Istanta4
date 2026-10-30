import { QueryTypes } from 'sequelize';
import { EXPORT_DI_SISTEMA, TIPO_KIT_DESIGN, TIPO_LAVORAZIONE } from '../../../lib/enums';
import { sequelize } from '../db';

/**
 * Letture delle viste Volantini e POP (/api/materiali), in SQL: paginazione, conteggi e ultimo
 * log dei file stanno nel database, non in memoria. Ogni valore che arriva dall'utente passa
 * dalle sostituzioni (replacements), mai concatenato nel testo della query.
 *
 * Regole comuni a ogni lettura:
 * - volantino o POP lo decide il formato del kit (formati.tipo_lavorazione_formati): un kit
 *   il cui formato non ha tipo non compare in nessuna delle due viste;
 * - i kit MANUALI restano nella pagina dei contenuti digitali;
 * - i file dell'export CORREGGO non si contano e non si elencano.
 */

/** Regole del periodo e della vista: quali promo, quali kit, quale tipo di formato. */
export interface CriteriKit {
  /** Stati delle promo del periodo. */
  statiPromo: readonly string[];
  /** Stati dei kit ammessi: solo PUBBLICATO in Attivi e Storico, tutti tranne ELIMINATO In corso. */
  statiKit: readonly string[];
  tipoLavorazione: TIPO_LAVORAZIONE;
  idPromo?: string;
  idFormato?: string;
}

/** Filtri dell'utente sui kit (vista Volantini). */
export interface FiltriSqlKit {
  cerca?: string;
  idPromo?: string;
  idArea?: string;
  idCanale?: string;
}

/** Filtri dell'utente sulle promozioni della vista Volantini (Attivi e Storico). */
export interface FiltriSqlPromoVolantini extends FiltriSqlKit {
  /** Anno dell'inizio di validita' della promo, nel calendario italiano. */
  anno?: number;
}

/** Filtri dell'utente sui file di un formato (vista POP). */
export interface FiltriSqlFile {
  cerca?: string;
  /** Stato dell'ultimo log del file. */
  stato?: string;
  idArea?: string;
  idCanale?: string;
  reparto?: string;
  /** Solo questi file (UUID gia' verificati). */
  idFile?: string[];
}

export interface RigaPromo {
  id_promo: string;
  nome_promo: string;
  stato_promo: string;
  validita_dal: Date | string | null;
  validita_al: Date | string | null;
}

export interface RigaPromoPop extends RigaPromo {
  numero_file: number;
  numero_formati: number;
}

export interface RigaFormato {
  id_formati: string;
  nome_formati: string;
  tipo_lavorazione_formati: number | null;
}

export interface RigaKit extends RigaPromo {
  id: string;
  id_design: string | null;
  titolo: string;
  stato_kit: string;
  tipo: string | null;
  id_area: string;
  nome_area: string;
  id_canale: string;
  nome_canale: string;
  id_formato: string;
  nome_formato: string;
  numero_file: number;
  copertina_id_olimpo: string | null;
  copertina_nome: string | null;
  copertina_mime: string | null;
  copertina_pagine: number | null;
}

/** Combinazione promo/area/canale presente nel periodo: le tendine dei filtri. */
export interface RigaCombinazioneKit extends RigaPromo {
  id_area: string;
  nome_area: string;
  id_canale: string;
  nome_canale: string;
}

/** Promo e kit della vista Volantini per promozione. */
export interface RigaTotaliPromoVolantini {
  promozioni: number;
  kit: number;
}

/** Kit di una promo della pagina (vista Volantini per promozione), con o senza corrispondenza ai filtri. */
export interface RigaVarianteVolantino {
  id: string;
  id_promo: string;
  titolo: string;
  id_area: string;
  nome_area: string;
  id_canale: string;
  nome_canale: string;
  numero_file: number;
  /** Righe della lista dei punti vendita stampata nel volantino (punti_vendita_volantino). */
  numero_punti_vendita: number;
  copertina_id_olimpo: string | null;
  copertina_nome: string | null;
  copertina_mime: string | null;
  copertina_pagine: number | null;
  /** Il kit corrisponde ai filtri dell'utente: solo questi si mostrano, gli altri si contano. */
  corrisponde: boolean;
}

/** Area e canale proposti nei filtri della vista Volantini per promozione. */
export interface RigaAreaCanale {
  id_area: string;
  nome_area: string;
  id_canale: string;
  nome_canale: string;
}

export interface RigaFile {
  id: string;
  nome: string | null;
  id_olimpo_cloud: string | null;
  mime: string | null;
  pagine: number | null;
  id_kit: string;
  titolo_kit: string;
  stato_kit: string;
  id_area: string;
  nome_area: string;
  id_canale: string;
  nome_canale: string;
  codice_referenza: string | null;
  descrizione_referenza: string | null;
  reparto: string | null;
  stato_log: string | null;
  versione_log: number | null;
}

export interface RigaOpzioneFile {
  id_area: string;
  nome_area: string;
  id_canale: string;
  nome_canale: string;
  reparto: string | null;
}

export interface IMaterialiRepository {
  trovaPromo(idPromo: string): Promise<RigaPromo | null>;
  /** Promo negli stati indicati, dalla piu' recente. */
  elencaPromo(statiPromo: readonly string[]): Promise<RigaPromo[]>;
  trovaFormati(idFormati: readonly string[]): Promise<RigaFormato[]>;
  /** Kit ordinati per validita' della promo (dalla piu' recente), nome della promo e titolo. */
  elencaKit(criteri: CriteriKit, opzioni?: { filtri?: FiltriSqlKit; limite?: number; scarto?: number; conCopertina?: boolean }): Promise<RigaKit[]>;
  contaKit(criteri: CriteriKit, filtri?: FiltriSqlKit): Promise<number>;
  elencaCombinazioniKit(criteri: CriteriKit): Promise<RigaCombinazioneKit[]>;
  /**
   * Promo con almeno un kit ammesso che corrisponde ai filtri, dalla validita' piu' recente (le
   * promo senza data in fondo), poi per nome. Senza pagina, tutte.
   */
  elencaPromoVolantini(
    criteri: CriteriKit,
    filtri?: FiltriSqlPromoVolantini,
    pagina?: { limite: number; scarto: number }
  ): Promise<RigaPromo[]>;
  /** Promo e kit ammessi che corrispondono ai filtri. */
  contaPromoVolantini(criteri: CriteriKit, filtri?: FiltriSqlPromoVolantini): Promise<RigaTotaliPromoVolantini>;
  /** Tutti i kit ammessi delle promo indicate, ciascuno con `corrisponde` ai filtri. */
  elencaVariantiVolantini(
    criteri: CriteriKit,
    idPromo: readonly string[],
    filtri?: FiltriSqlPromoVolantini
  ): Promise<RigaVarianteVolantino[]>;
  /**
   * Aree e canali dei kit ammessi; con combinazioniGdo anche quelli delle combinazioni canale/area
   * delle GDO che hanno promo nel periodo, comprese le disattivate. Senza nome vale il codice.
   */
  elencaAreeCanaliVolantini(criteri: CriteriKit, combinazioniGdo: boolean): Promise<RigaAreaCanale[]>;
  /** Anni dell'inizio di validita' delle promo con kit ammessi, nel calendario italiano, dal piu' recente. */
  elencaAnniPromoVolantini(criteri: CriteriKit): Promise<number[]>;
  /**
   * Promo del periodo con almeno un kit ammesso, con file e formati dei loro kit. Le promo che
   * hanno solo kit non avviati non ci sono: quei kit li conosce Istanta, non il database.
   */
  elencaPromoConKit(criteri: CriteriKit): Promise<RigaPromoPop[]>;
  /** File dei kit, ordinati per area, canale e nome. */
  elencaFile(criteri: CriteriKit, filtri?: FiltriSqlFile, pagina?: { limite: number; scarto: number }): Promise<RigaFile[]>;
  contaFile(criteri: CriteriKit, filtri?: FiltriSqlFile): Promise<number>;
  elencaOpzioniFile(criteri: CriteriKit): Promise<RigaOpzioneFile[]>;
}

type Sostituzioni = Record<string, unknown>;

/** Testo di un campo dei metadati del file: stringa, o oggetto con `content`. Solo chiavi fisse. */
const testoMeta = (chiave: 'codice_referenza' | 'descrizione_uno' | 'reparto') =>
  `COALESCE(f.meta_olimpo_cloud -> '${chiave}' ->> 'content', f.meta_olimpo_cloud ->> '${chiave}')`;

const NOME_AREA = `COALESCE(a.nome_aree, k.nome_area, '')`;
const NOME_CANALE = `COALESCE(c.nome_canali, k.nome_canale, '')`;

/** Il file e' dell'export indicato, per codice salvato o per tipo di export. Mai NULL: si puo' negare. */
const fileDellExport = (sostituzione: string) => `(
  COALESCE(f.tipo_export_codice, '') = :${sostituzione}
  OR EXISTS (
    SELECT 1 FROM tipi_export te
    WHERE te.codice_tipiexport = :${sostituzione} AND te.id_tipiexport::text = f.tipo_export
  )
)`;

/** I file dell'export CORREGGO non compaiono nelle viste, come nelle vecchie pagine Materiali. */
const FILE_NON_CORREGGO = `NOT ${fileDellExport('codiceCorreggo')}`;

const SOSTITUZIONI_FISSE: Sostituzioni = {
  codiceCorreggo: EXPORT_DI_SISTEMA.CORREGGO,
  codiceVolantino: EXPORT_DI_SISTEMA.VOL,
  tipoManuale: TIPO_KIT_DESIGN.MANUALE,
};

const DA_KIT = `
  FROM runtime_kit k
  JOIN promo p ON p.id_promo = k.id_promo
  JOIN formati fo ON fo.id_formati = k.id_formato
  LEFT JOIN aree a ON a.id_aree = k.id_area
  LEFT JOIN canali c ON c.id_canali = k.id_canale`;

const COLONNE_PROMO = `
  p.id_promo, p.nome_promo, p.stato::text AS stato_promo, p.validita_dal, p.validita_al`;

/** Ultimo log del file (versione piu' alta), dall'indice (id_kit_runtime, nome_file, versione DESC). */
const ULTIMO_LOG = `
  LEFT JOIN LATERAL (
    SELECT l.stato, l.versione
    FROM files_runtime_log l
    WHERE l.id_kit_runtime = k.id AND l.nome_file = f.nome
    ORDER BY l.versione DESC
    LIMIT 1
  ) ul ON TRUE`;

/** Testo cercato dentro un ILIKE: % e _ dell'utente valgono come caratteri. */
export const comeRicercaParziale = (testo: string): string => `%${testo.replace(/[\\%_]/g, '\\$&')}%`;

function condizioniKit(criteri: CriteriKit, sostituzioni: Sostituzioni): string[] {
  sostituzioni.statiPromo = [...criteri.statiPromo];
  sostituzioni.statiKit = [...criteri.statiKit];
  sostituzioni.tipoLavorazione = criteri.tipoLavorazione;
  const condizioni = [
    'p.stato IN (:statiPromo)',
    'fo.tipo_lavorazione_formati = :tipoLavorazione',
    'k.tipo <> :tipoManuale',
    'k.stato_lavorazione IN (:statiKit)',
  ];
  if (criteri.idPromo !== undefined) {
    condizioni.push('k.id_promo = :criterioPromo');
    sostituzioni.criterioPromo = criteri.idPromo;
  }
  if (criteri.idFormato !== undefined) {
    condizioni.push('k.id_formato = :criterioFormato');
    sostituzioni.criterioFormato = criteri.idFormato;
  }
  return condizioni;
}

function condizioniFiltriKit(filtri: FiltriSqlKit | undefined, sostituzioni: Sostituzioni): string[] {
  const condizioni: string[] = [];
  if (!filtri) return condizioni;
  if (filtri.cerca) {
    condizioni.push('(k.titolo ILIKE :cerca OR p.nome_promo ILIKE :cerca)');
    sostituzioni.cerca = comeRicercaParziale(filtri.cerca);
  }
  if (filtri.idPromo) {
    condizioni.push('k.id_promo = :filtroPromo');
    sostituzioni.filtroPromo = filtri.idPromo;
  }
  if (filtri.idArea) {
    condizioni.push('k.id_area = :filtroArea');
    sostituzioni.filtroArea = filtri.idArea;
  }
  if (filtri.idCanale) {
    condizioni.push('k.id_canale = :filtroCanale');
    sostituzioni.filtroCanale = filtri.idCanale;
  }
  return condizioni;
}

/** Le date delle promo sono giorni del calendario italiano, qualunque sia il fuso del database. */
const FUSO_PROMO = 'Europe/Rome';

/** I filtri dei kit e l'anno: dal 1 gennaio dell'anno, ora italiana, al 1 gennaio successivo (escluso). */
function condizioniFiltriPromoVolantini(filtri: FiltriSqlPromoVolantini | undefined, sostituzioni: Sostituzioni): string[] {
  const condizioni = condizioniFiltriKit(filtri, sostituzioni);
  if (filtri?.anno !== undefined) {
    condizioni.push(`p.validita_dal >= make_timestamptz(:anno, 1, 1, 0, 0, 0, :fusoPromo)
      AND p.validita_dal < make_timestamptz(:anno + 1, 1, 1, 0, 0, 0, :fusoPromo)`);
    sostituzioni.anno = filtri.anno;
    sostituzioni.fusoPromo = FUSO_PROMO;
  }
  return condizioni;
}

/** Nome di area e canale nei filtri e nelle varianti dei volantini: senza nome vale il codice. */
const NOME_O_CODICE_AREA = `COALESCE(NULLIF(a.nome_aree, ''), NULLIF(k.nome_area, ''), a.codice_aree, '')`;
const NOME_O_CODICE_CANALE = `COALESCE(NULLIF(c.nome_canali, ''), NULLIF(k.nome_canale, ''), c.codice_canali, '')`;

/** Copertina del kit: il primo file dell'export volantino che sta su Olimpo, meglio se PDF. */
const COPERTINA_VOLANTINO = `
  LEFT JOIN LATERAL (
    SELECT f.id_olimpo_cloud, f.nome, f.mime, f.pages
    FROM files_runtime f
    WHERE f.id_runtime = k.id
      AND COALESCE(f.id_olimpo_cloud, '') <> ''
      AND ${fileDellExport('codiceVolantino')}
    ORDER BY (COALESCE(f.mime, '') ILIKE '%pdf%') DESC, f.nome, f."createdAt"
    LIMIT 1
  ) cop ON TRUE`;

function condizioniFiltriFile(filtri: FiltriSqlFile | undefined, sostituzioni: Sostituzioni): string[] {
  const condizioni: string[] = [];
  if (!filtri) return condizioni;
  if (filtri.cerca) {
    condizioni.push(`(
      f.nome ILIKE :cerca
      OR ${testoMeta('codice_referenza')} ILIKE :cerca
      OR ${testoMeta('descrizione_uno')} ILIKE :cerca
    )`);
    sostituzioni.cerca = comeRicercaParziale(filtri.cerca);
  }
  if (filtri.stato) {
    condizioni.push('ul.stato = :statoLog');
    sostituzioni.statoLog = filtri.stato;
  }
  if (filtri.idArea) {
    condizioni.push('k.id_area = :filtroArea');
    sostituzioni.filtroArea = filtri.idArea;
  }
  if (filtri.idCanale) {
    condizioni.push('k.id_canale = :filtroCanale');
    sostituzioni.filtroCanale = filtri.idCanale;
  }
  if (filtri.reparto) {
    condizioni.push(`${testoMeta('reparto')} = :reparto`);
    sostituzioni.reparto = filtri.reparto;
  }
  if (filtri.idFile) {
    // Elenco vuoto: nessun file (IN () non e' SQL valido)
    if (filtri.idFile.length === 0) {
      condizioni.push('FALSE');
    } else {
      condizioni.push('f.id IN (:idFile)');
      sostituzioni.idFile = filtri.idFile;
    }
  }
  return condizioni;
}

const DA_FILE = `
  FROM files_runtime f
  JOIN runtime_kit k ON k.id = f.id_runtime
  JOIN promo p ON p.id_promo = k.id_promo
  JOIN formati fo ON fo.id_formati = k.id_formato
  LEFT JOIN aree a ON a.id_aree = k.id_area
  LEFT JOIN canali c ON c.id_canali = k.id_canale`;

export class MaterialiRepository implements IMaterialiRepository {
  private async seleziona<T extends object>(sql: string, sostituzioni: Sostituzioni): Promise<T[]> {
    return sequelize.query<T>(sql, {
      replacements: { ...SOSTITUZIONI_FISSE, ...sostituzioni },
      type: QueryTypes.SELECT,
    });
  }

  async trovaPromo(idPromo: string): Promise<RigaPromo | null> {
    const righe = await this.seleziona<RigaPromo>(
      `SELECT ${COLONNE_PROMO} FROM promo p WHERE p.id_promo = :idPromo`,
      { idPromo }
    );
    return righe[0] ?? null;
  }

  async elencaPromo(statiPromo: readonly string[]): Promise<RigaPromo[]> {
    if (statiPromo.length === 0) return [];
    return this.seleziona<RigaPromo>(
      `SELECT ${COLONNE_PROMO} FROM promo p
       WHERE p.stato IN (:statiPromo)
       ORDER BY p.validita_dal DESC, p.nome_promo, p.id_promo`,
      { statiPromo: [...statiPromo] }
    );
  }

  async trovaFormati(idFormati: readonly string[]): Promise<RigaFormato[]> {
    if (idFormati.length === 0) return [];
    // Confronto come testo: gli id arrivano anche da Istanta e un id malformato non deve rompere la query
    return this.seleziona<RigaFormato>(
      `SELECT fo.id_formati::text AS id_formati, fo.nome_formati, fo.tipo_lavorazione_formati
       FROM formati fo
       WHERE fo.id_formati::text IN (:idFormati)`,
      { idFormati: [...idFormati] }
    );
  }

  async elencaKit(
    criteri: CriteriKit,
    opzioni: { filtri?: FiltriSqlKit; limite?: number; scarto?: number; conCopertina?: boolean } = {}
  ): Promise<RigaKit[]> {
    const sostituzioni: Sostituzioni = {};
    const condizioni = [...condizioniKit(criteri, sostituzioni), ...condizioniFiltriKit(opzioni.filtri, sostituzioni)];
    // Copertina: il primo file dell'export volantino che sta su Olimpo, meglio se PDF
    const copertina = opzioni.conCopertina
      ? `LEFT JOIN LATERAL (
          SELECT f.id_olimpo_cloud, f.nome, f.mime, f.pages
          FROM files_runtime f
          WHERE f.id_runtime = k.id
            AND COALESCE(f.id_olimpo_cloud, '') <> ''
            AND ${fileDellExport('codiceVolantino')}
          ORDER BY (COALESCE(f.mime, '') ILIKE '%pdf%') DESC, f.nome, f."createdAt"
          LIMIT 1
        ) cop ON TRUE`
      : '';
    const colonneCopertina = opzioni.conCopertina
      ? 'cop.id_olimpo_cloud AS copertina_id_olimpo, cop.nome AS copertina_nome, cop.mime AS copertina_mime, cop.pages AS copertina_pagine'
      : 'NULL AS copertina_id_olimpo, NULL AS copertina_nome, NULL AS copertina_mime, NULL AS copertina_pagine';
    let pagina = '';
    if (opzioni.limite !== undefined) {
      pagina = 'LIMIT :limite OFFSET :scarto';
      sostituzioni.limite = opzioni.limite;
      sostituzioni.scarto = opzioni.scarto ?? 0;
    }
    return this.seleziona<RigaKit>(
      `SELECT
         k.id::text AS id, k.id_design::text AS id_design, k.titolo, k.stato_lavorazione::text AS stato_kit, k.tipo::text AS tipo,
         ${COLONNE_PROMO},
         k.id_area::text AS id_area, ${NOME_AREA} AS nome_area,
         k.id_canale::text AS id_canale, ${NOME_CANALE} AS nome_canale,
         k.id_formato::text AS id_formato, fo.nome_formati AS nome_formato,
         (SELECT COUNT(*) FROM files_runtime f WHERE f.id_runtime = k.id AND ${FILE_NON_CORREGGO})::int AS numero_file,
         ${colonneCopertina}
       ${DA_KIT}
       ${copertina}
       WHERE ${condizioni.join(' AND ')}
       ORDER BY p.validita_dal DESC, p.nome_promo, k.titolo, k.id
       ${pagina}`,
      sostituzioni
    );
  }

  async contaKit(criteri: CriteriKit, filtri?: FiltriSqlKit): Promise<number> {
    const sostituzioni: Sostituzioni = {};
    const condizioni = [...condizioniKit(criteri, sostituzioni), ...condizioniFiltriKit(filtri, sostituzioni)];
    const [riga] = await this.seleziona<{ totale: number }>(
      `SELECT COUNT(*)::int AS totale
       FROM runtime_kit k
       JOIN promo p ON p.id_promo = k.id_promo
       JOIN formati fo ON fo.id_formati = k.id_formato
       WHERE ${condizioni.join(' AND ')}`,
      sostituzioni
    );
    return Number(riga?.totale ?? 0);
  }

  async elencaCombinazioniKit(criteri: CriteriKit): Promise<RigaCombinazioneKit[]> {
    const sostituzioni: Sostituzioni = {};
    const condizioni = condizioniKit(criteri, sostituzioni);
    return this.seleziona<RigaCombinazioneKit>(
      `SELECT DISTINCT ${COLONNE_PROMO},
         k.id_area::text AS id_area, ${NOME_AREA} AS nome_area,
         k.id_canale::text AS id_canale, ${NOME_CANALE} AS nome_canale
       ${DA_KIT}
       WHERE ${condizioni.join(' AND ')}`,
      sostituzioni
    );
  }

  async elencaPromoVolantini(
    criteri: CriteriKit,
    filtri?: FiltriSqlPromoVolantini,
    pagina?: { limite: number; scarto: number }
  ): Promise<RigaPromo[]> {
    const sostituzioni: Sostituzioni = {};
    const condizioni = [...condizioniKit(criteri, sostituzioni), ...condizioniFiltriPromoVolantini(filtri, sostituzioni)];
    let limite = '';
    if (pagina) {
      limite = 'LIMIT :limite OFFSET :scarto';
      sostituzioni.limite = pagina.limite;
      sostituzioni.scarto = pagina.scarto;
    }
    // Una riga per promo senza GROUP BY: la pagina si taglia sulle promo, non sui kit
    return this.seleziona<RigaPromo>(
      `SELECT ${COLONNE_PROMO}
       FROM promo p
       WHERE EXISTS (
         SELECT 1
         FROM runtime_kit k
         JOIN formati fo ON fo.id_formati = k.id_formato
         WHERE k.id_promo = p.id_promo AND ${condizioni.join(' AND ')}
       )
       ORDER BY p.validita_dal DESC NULLS LAST, p.nome_promo, p.id_promo
       ${limite}`,
      sostituzioni
    );
  }

  async contaPromoVolantini(criteri: CriteriKit, filtri?: FiltriSqlPromoVolantini): Promise<RigaTotaliPromoVolantini> {
    const sostituzioni: Sostituzioni = {};
    const condizioni = [...condizioniKit(criteri, sostituzioni), ...condizioniFiltriPromoVolantini(filtri, sostituzioni)];
    const [riga] = await this.seleziona<RigaTotaliPromoVolantini>(
      `SELECT COUNT(DISTINCT k.id_promo)::int AS promozioni, COUNT(*)::int AS kit
       FROM runtime_kit k
       JOIN promo p ON p.id_promo = k.id_promo
       JOIN formati fo ON fo.id_formati = k.id_formato
       WHERE ${condizioni.join(' AND ')}`,
      sostituzioni
    );
    return { promozioni: Number(riga?.promozioni ?? 0), kit: Number(riga?.kit ?? 0) };
  }

  async elencaVariantiVolantini(
    criteri: CriteriKit,
    idPromo: readonly string[],
    filtri?: FiltriSqlPromoVolantini
  ): Promise<RigaVarianteVolantino[]> {
    if (idPromo.length === 0) return [];
    const sostituzioni: Sostituzioni = { idPromoPagina: [...idPromo] };
    const condizioni = condizioniKit(criteri, sostituzioni);
    // I filtri non escludono i kit: dicono quali mostrare. Gli altri servono per contare i kit della promo
    const filtriKit = condizioniFiltriPromoVolantini(filtri, sostituzioni);
    const corrisponde = filtriKit.length > 0 ? filtriKit.join(' AND ') : 'TRUE';
    return this.seleziona<RigaVarianteVolantino>(
      `SELECT
         k.id::text AS id, k.id_promo, k.titolo,
         k.id_area::text AS id_area, ${NOME_O_CODICE_AREA} AS nome_area,
         k.id_canale::text AS id_canale, ${NOME_O_CODICE_CANALE} AS nome_canale,
         (SELECT COUNT(*) FROM files_runtime f WHERE f.id_runtime = k.id AND ${FILE_NON_CORREGGO})::int AS numero_file,
         (SELECT COUNT(*) FROM punti_vendita_volantino pvv WHERE pvv.id_kit_runtime = k.id)::int AS numero_punti_vendita,
         cop.id_olimpo_cloud AS copertina_id_olimpo, cop.nome AS copertina_nome,
         cop.mime AS copertina_mime, cop.pages AS copertina_pagine,
         (${corrisponde}) AS corrisponde
       ${DA_KIT}
       ${COPERTINA_VOLANTINO}
       WHERE ${condizioni.join(' AND ')} AND k.id_promo IN (:idPromoPagina)
       ORDER BY k.id_promo, k.titolo, k.id`,
      sostituzioni
    );
  }

  async elencaAreeCanaliVolantini(criteri: CriteriKit, combinazioniGdo: boolean): Promise<RigaAreaCanale[]> {
    const sostituzioni: Sostituzioni = {};
    const condizioni = condizioniKit(criteri, sostituzioni);
    // Le combinazioni della GDO, anche disattivate: nello Storico un volantino puo' essere di una
    // combinazione che oggi non c'e' piu'. Le GDO sono quelle delle promo del periodo
    const combinazioni = combinazioniGdo
      ? `UNION
         SELECT
           cca.id_area_combinazione_canale_area::text, COALESCE(NULLIF(a.nome_aree, ''), a.codice_aree, ''),
           cca.id_canale_combinazione_canale_area::text, COALESCE(NULLIF(c.nome_canali, ''), c.codice_canali, '')
         FROM combinazione_canale_area cca
         LEFT JOIN aree a ON a.id_aree = cca.id_area_combinazione_canale_area
         LEFT JOIN canali c ON c.id_canali = cca.id_canale_combinazione_canale_area
         WHERE cca.id_gdo_combinazione_canale_area::text IN (
           SELECT lower(pg.gdo) FROM promo pg WHERE pg.stato IN (:statiPromo)
         )`
      : '';
    return this.seleziona<RigaAreaCanale>(
      `SELECT DISTINCT
         k.id_area::text AS id_area, ${NOME_O_CODICE_AREA} AS nome_area,
         k.id_canale::text AS id_canale, ${NOME_O_CODICE_CANALE} AS nome_canale
       ${DA_KIT}
       WHERE ${condizioni.join(' AND ')}
       ${combinazioni}`,
      sostituzioni
    );
  }

  async elencaAnniPromoVolantini(criteri: CriteriKit): Promise<number[]> {
    const sostituzioni: Sostituzioni = { fusoPromo: FUSO_PROMO };
    const condizioni = condizioniKit(criteri, sostituzioni);
    const righe = await this.seleziona<{ anno: number }>(
      `SELECT DISTINCT EXTRACT(YEAR FROM (p.validita_dal AT TIME ZONE :fusoPromo))::int AS anno
       FROM runtime_kit k
       JOIN promo p ON p.id_promo = k.id_promo
       JOIN formati fo ON fo.id_formati = k.id_formato
       WHERE ${condizioni.join(' AND ')} AND p.validita_dal IS NOT NULL
       ORDER BY anno DESC`,
      sostituzioni
    );
    return righe.map(riga => Number(riga.anno)).filter(Number.isInteger);
  }

  async elencaPromoConKit(criteri: CriteriKit): Promise<RigaPromoPop[]> {
    const sostituzioni: Sostituzioni = {};
    const condizioni = condizioniKit(criteri, sostituzioni);
    // Solo le promo con kit ammessi: i kit non avviati (In corso) li aggiunge il servizio
    return this.seleziona<RigaPromoPop>(
      `SELECT ${COLONNE_PROMO},
         COUNT(DISTINCT k.id_formato)::int AS numero_formati,
         COALESCE(SUM(nf.numero), 0)::int AS numero_file
       FROM runtime_kit k
       JOIN promo p ON p.id_promo = k.id_promo
       JOIN formati fo ON fo.id_formati = k.id_formato
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS numero FROM files_runtime f WHERE f.id_runtime = k.id AND ${FILE_NON_CORREGGO}
       ) nf ON TRUE
       WHERE ${condizioni.join(' AND ')}
       GROUP BY p.id_promo, p.nome_promo, p.stato, p.validita_dal, p.validita_al
       ORDER BY p.validita_dal DESC, p.nome_promo, p.id_promo`,
      sostituzioni
    );
  }

  async elencaFile(criteri: CriteriKit, filtri?: FiltriSqlFile, pagina?: { limite: number; scarto: number }): Promise<RigaFile[]> {
    const sostituzioni: Sostituzioni = {};
    const condizioni = [
      ...condizioniKit(criteri, sostituzioni),
      FILE_NON_CORREGGO,
      ...condizioniFiltriFile(filtri, sostituzioni),
    ];
    let limite = '';
    if (pagina) {
      limite = 'LIMIT :limite OFFSET :scarto';
      sostituzioni.limite = pagina.limite;
      sostituzioni.scarto = pagina.scarto;
    }
    return this.seleziona<RigaFile>(
      `SELECT
         f.id::text AS id, f.nome, f.id_olimpo_cloud, f.mime, f.pages AS pagine,
         k.id::text AS id_kit, k.titolo AS titolo_kit, k.stato_lavorazione::text AS stato_kit,
         k.id_area::text AS id_area, ${NOME_AREA} AS nome_area,
         k.id_canale::text AS id_canale, ${NOME_CANALE} AS nome_canale,
         ${testoMeta('codice_referenza')} AS codice_referenza,
         ${testoMeta('descrizione_uno')} AS descrizione_referenza,
         ${testoMeta('reparto')} AS reparto,
         ul.stato::text AS stato_log, ul.versione AS versione_log
       ${DA_FILE}
       ${ULTIMO_LOG}
       WHERE ${condizioni.join(' AND ')}
       ORDER BY ${NOME_AREA}, ${NOME_CANALE}, f.nome, f.id
       ${limite}`,
      sostituzioni
    );
  }

  async contaFile(criteri: CriteriKit, filtri?: FiltriSqlFile): Promise<number> {
    const sostituzioni: Sostituzioni = {};
    const condizioni = [
      ...condizioniKit(criteri, sostituzioni),
      FILE_NON_CORREGGO,
      ...condizioniFiltriFile(filtri, sostituzioni),
    ];
    // L'ultimo log serve solo per filtrare per stato
    const [riga] = await this.seleziona<{ totale: number }>(
      `SELECT COUNT(*)::int AS totale
       ${DA_FILE}
       ${filtri?.stato ? ULTIMO_LOG : ''}
       WHERE ${condizioni.join(' AND ')}`,
      sostituzioni
    );
    return Number(riga?.totale ?? 0);
  }

  async elencaOpzioniFile(criteri: CriteriKit): Promise<RigaOpzioneFile[]> {
    const sostituzioni: Sostituzioni = {};
    const condizioni = [...condizioniKit(criteri, sostituzioni), FILE_NON_CORREGGO];
    return this.seleziona<RigaOpzioneFile>(
      `SELECT DISTINCT
         k.id_area::text AS id_area, ${NOME_AREA} AS nome_area,
         k.id_canale::text AS id_canale, ${NOME_CANALE} AS nome_canale,
         ${testoMeta('reparto')} AS reparto
       ${DA_FILE}
       WHERE ${condizioni.join(' AND ')}`,
      sostituzioni
    );
  }
}
