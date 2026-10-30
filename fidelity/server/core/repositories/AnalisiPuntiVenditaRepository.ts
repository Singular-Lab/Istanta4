import { QueryTypes } from 'sequelize';
import type { TipoAbbinamento } from '../../../lib/puntiVendita/storia';
import { sequelize } from '../db';
import { TIPO_LAVORO_IMPORT_PV } from '../services/ImportPuntiVenditaJob';
import {
  type AggregatiKit,
  type DescrizioneCompatta,
  descrizioneDaCompatta,
  type DescrizioneProdotto,
  type ProdottoCompatto,
  prodottoDaCompatto,
  type ProdottoNelKit,
  type RiepilogoKit,
} from '../utils/analisiKit';
import {
  type CanaleInAnagrafica,
  type CanaleNelleListe,
  chiaveDescrizione,
  type ProdottoFrequente,
  type RigaListaVolantino,
  type StatisticheProdotti,
} from '../utils/analisiPuntoVendita';
import type { EdizioneConLista, PuntoVenditaConTelefono, RigaSenzaPuntoVendita } from '../utils/gestionePuntiVendita';
import type { RigaReferenza } from '../utils/referenzaStampata';
import { DATA_EDIZIONE, KIT_VALIDI, PDF_VOLANTINO, SOSTITUZIONI_FISSE } from './PuntiVenditaVolantinoRepository';

/**
 * Letture delle pagine del punto vendita costruite sulla timeline dei volantini
 * (lib/puntiVendita/analisi.ts), in SQL come la storia del PV (stessi frammenti: data
 * dell'edizione, kit validi, PDF del volantino), e scrittura dei riepiloghi dei kit in analisi_kit.
 * Ogni valore passa dalle sostituzioni.
 *
 * Dei riepiloghi la scheda del PV legge solo gli aggregati (dati senza marche ne' prodotti): marche
 * e prodotti di tutti i volantini si aggregano in SQL e dal database escono solo i risultati, e le
 * descrizioni si leggono per i pochi prodotti da mostrare. Cosi' un PV con centinaia di volantini
 * non sposta i prodotti di tutti.
 */

/** Una referenza del kit, con l'ultima modifica e l'origine del kit. */
export interface RigaReferenzaKit extends RigaReferenza {
  id_runtime_kit: string;
  aggiornata_il: Date | string | null;
  /** Il kit viene dallo storico (import_storico): codice e dati arrivano da DB1. */
  storico: boolean;
}

export interface RiepilogoDaSalvare {
  idKit: string;
  versione: number;
  riepilogo: RiepilogoKit;
  /** L'ultima modifica fra le referenze lette; null se il kit non ne ha. */
  referenzeAl: Date | null;
}

/** Un volantino del PV per le statistiche dei prodotti: il kit e il giorno dell'edizione. */
export interface EdizionePerStatistiche {
  idKit: string;
  /** YYYY-MM-DD. */
  data: string;
}

export interface LimitiStatistiche {
  /** Un prodotto e' frequente oltre questi volantini. */
  soglia: number;
  ricorrenti: number;
  marche: number;
}

export interface KitDelVolantino {
  id: string;
  titolo: string;
  storico: boolean;
  /** Dall'import dello storico: referenze arrivate dal listino e compilate a mano; null se non si sa. */
  daListino: number | null;
  manuali: number | null;
  pdf: { idFile: string; idOlimpoCloud: string; nome: string; pagine: number | null } | null;
}

export interface QualitaGrezza {
  totale: number;
  senzaCoordinate: number;
  senzaCodice: number;
  conStoria: number;
  dispositiviOffline: number;
  /** L'avanzamento dell'ultimo import Excel dei PV della GDO, se c'e' ancora nel registro. */
  ultimoImport: unknown;
}

export interface IAnalisiPuntiVenditaRepository {
  /**
   * Gli aggregati dei riepiloghi salvati ancora validi: stessa versione e nessuna referenza del kit
   * modificata dopo il calcolo. Quelli che mancano si ricalcolano e si salvano.
   */
  aggregatiKit(idKit: readonly string[], versione: number): Promise<Map<string, AggregatiKit>>;
  /** Le referenze dei kit, per kit, pagina e posizione (la prima di un box e' la pilota). */
  referenzeDeiKit(idKit: readonly string[]): Promise<RigaReferenzaKit[]>;
  /** Salva (o sostituisce) i riepiloghi; quelli di un kit eliminato nel frattempo si saltano. */
  salvaRiepiloghi(riepiloghi: readonly RiepilogoDaSalvare[]): Promise<void>;
  /** Prodotti diversi e frequenti, i piu' presenti e le marche dei volantini indicati, dai riepiloghi salvati. */
  statisticheProdotti(edizioni: readonly EdizionePerStatistiche[], limiti: LimitiStatistiche): Promise<StatisticheProdotti>;
  /** Le descrizioni dei prodotti nei kit indicati, per chiaveDescrizione(idKit, chiave). */
  descrizioniProdotti(coppie: ReadonlyArray<{ idKit: string; chiave: string }>): Promise<Map<string, DescrizioneProdotto>>;
  /** Il prodotto in ognuno dei kit indicati che lo contiene. */
  presenzeProdotto(idKit: readonly string[], chiave: string): Promise<Map<string, ProdottoNelKit>>;
  kitDelVolantino(idKit: string): Promise<KitDelVolantino | null>;
  /** La lista dei PV stampata nel volantino, in ordine. */
  listaDelVolantino(idKit: string): Promise<RigaListaVolantino[]>;
  /** I canali della GDO con i PV dell'anagrafica oggi. */
  canaliConPuntiVendita(idGdo: string): Promise<CanaleInAnagrafica[]>;
  /** Per canale e anno, i PV diversi stampati nelle liste dei volantini della GDO. */
  puntiVenditaNelleListe(idGdo: string): Promise<CanaleNelleListe[]>;
  /**
   * I conteggi della qualita' dell'anagrafica. Senza codice: senza il campo chiaveMeta nei meta o,
   * se la GDO non ne dichiara uno, con i meta vuoti.
   */
  qualita(idGdo: string, chiaveMeta: string | null, minutiOffline: number): Promise<QualitaGrezza>;
  righeSenzaPuntoVendita(idGdo: string): Promise<RigaSenzaPuntoVendita[]>;
  edizioniConLista(idGdo: string): Promise<EdizioneConLista[]>;
  puntiVenditaConTelefono(idGdo: string): Promise<PuntoVenditaConTelefono[]>;
}

type Sostituzioni = Record<string, unknown>;

const ANNO_EDIZIONE = `substr(${DATA_EDIZIONE}, 1, 4)::int`;

/** Il PV stampato, per contarlo una volta: il PV abbinato, altrimenti il telefono, l'indirizzo, la riga. */
const CHIAVE_PV_STAMPATO = `COALESCE(
  'pv:' || r.id_punto_vendita::text,
  'tel:' || r.chiave_telefono,
  'ind:' || COALESCE(upper(btrim(r.localita)), '') || '|' || r.chiave_indirizzo,
  'riga:' || upper(btrim(r.riga))
)`;

const numero = (valore: unknown): number => {
  const convertito = Number(valore ?? 0);
  return Number.isFinite(convertito) ? convertito : 0;
};

export class AnalisiPuntiVenditaRepository implements IAnalisiPuntiVenditaRepository {
  private async seleziona<T extends object>(sql: string, sostituzioni: Sostituzioni = {}): Promise<T[]> {
    return sequelize.query<T>(sql, {
      replacements: { ...SOSTITUZIONI_FISSE, ...sostituzioni },
      type: QueryTypes.SELECT,
    });
  }

  async aggregatiKit(idKit: readonly string[], versione: number): Promise<Map<string, AggregatiKit>> {
    if (idKit.length === 0) return new Map();
    // Marche e prodotti restano nel database
    const righe = await this.seleziona<{ id_kit: string; aggregati: AggregatiKit }>(
      `SELECT a.id_kit_runtime::text AS id_kit, a.dati - 'marche' - 'prodotti' AS aggregati
       FROM analisi_kit a
       WHERE a.id_kit_runtime IN (:idKit) AND a.versione = :versione
         AND NOT EXISTS (
           SELECT 1 FROM referenze r
           WHERE r.id_runtime_kit = a.id_kit_runtime
             AND r."updatedAt" > COALESCE(a.referenze_al, '-infinity'::timestamptz)
         )`,
      { idKit: [...idKit], versione }
    );
    return new Map(righe.map(riga => [riga.id_kit, riga.aggregati]));
  }

  async referenzeDeiKit(idKit: readonly string[]): Promise<RigaReferenzaKit[]> {
    if (idKit.length === 0) return [];
    return this.seleziona<RigaReferenzaKit>(
      `SELECT r.id::text AS id, r.id_runtime_kit::text AS id_runtime_kit,
              r.compiled_fields, r.data_fields, r.foto, r.meccanica, r.codice_box, r.group_elements,
              r.pag, r.x, r.y, r.w, r.h, r.w_page, r.h_page, r.perc_ingombro,
              r."updatedAt" AS aggiornata_il,
              (jsonb_typeof(k.import_storico) = 'object') IS TRUE AS storico
       FROM referenze r
       JOIN runtime_kit k ON k.id = r.id_runtime_kit
       WHERE r.id_runtime_kit IN (:idKit)
       ORDER BY r.id_runtime_kit, r.pag NULLS LAST, r.y NULLS LAST, r.x NULLS LAST, r."createdAt", r.id`,
      { idKit: [...idKit] }
    );
  }

  async salvaRiepiloghi(riepiloghi: readonly RiepilogoDaSalvare[]): Promise<void> {
    if (riepiloghi.length === 0) return;
    const voci = riepiloghi.map(voce => ({
      id_kit: voce.idKit,
      versione: voce.versione,
      dati: voce.riepilogo.dati,
      descrizioni: voce.riepilogo.descrizioni,
      referenze_al: voce.referenzeAl ? voce.referenzeAl.toISOString() : null,
    }));
    // Un kit eliminato mentre si calcolava non ha piu' un riepilogo da salvare
    await sequelize.query(
      `INSERT INTO analisi_kit (id_kit_runtime, versione, dati, descrizioni, aggiornato_il, referenze_al)
       SELECT v.id_kit, v.versione, v.dati, v.descrizioni, NOW(), v.referenze_al
       FROM jsonb_to_recordset(CAST(:voci AS jsonb)) AS v(id_kit uuid, versione int, dati jsonb, descrizioni jsonb, referenze_al timestamptz)
       WHERE EXISTS (SELECT 1 FROM runtime_kit k WHERE k.id = v.id_kit)
       ON CONFLICT (id_kit_runtime) DO UPDATE
         SET versione = EXCLUDED.versione, dati = EXCLUDED.dati, descrizioni = EXCLUDED.descrizioni,
             aggiornato_il = EXCLUDED.aggiornato_il, referenze_al = EXCLUDED.referenze_al`,
      { replacements: { voci: JSON.stringify(voci) } }
    );
  }

  async statisticheProdotti(edizioni: readonly EdizionePerStatistiche[], limiti: LimitiStatistiche): Promise<StatisticheProdotti> {
    if (edizioni.length === 0) return { prodotti: 0, frequenti: 0, ricorrenti: [], marche: [], referenzeConMarca: 0 };
    const voci = edizioni.map(edizione => ({ id_kit: edizione.idKit, data: edizione.data, anno: Number(edizione.data.slice(0, 4)) }));
    // Un prodotto compare una volta per kit (riassumiKit): le righe di un prodotto sono i suoi volantini.
    // L'ultimo kit e' il massimo di "giorno|kit" (larghezza fissa, collation "C"): niente ordinamenti per
    // prodotto, l'aggregazione resta in memoria. Ordinamenti col collation "C": gli stessi di JavaScript.
    const [riga] = await this.seleziona<{
      prodotti: number; frequenti: number; referenze_con_marca: number;
      ricorrenti: Array<Omit<ProdottoFrequente, 'prezzoMinimo' | 'prezzoMassimo'> & { prezzoMinimo: number | string | null; prezzoMassimo: number | string | null }>;
      marche: Array<{ marca: string; referenze: number }>;
    }>(
      `WITH e AS (
         SELECT * FROM jsonb_to_recordset(CAST(:edizioni AS jsonb)) AS e(id_kit uuid, data text, anno int)
       ),
       p AS MATERIALIZED (
         SELECT e.anno, (e.data || '|' || e.id_kit::text) COLLATE "C" AS volantino,
                t ->> 0 AS chiave, (t ->> 1)::numeric AS prezzo, (t ->> 7) = '1' AS con_foto
         FROM e
         JOIN analisi_kit a ON a.id_kit_runtime = e.id_kit
         CROSS JOIN LATERAL jsonb_array_elements(a.dati -> 'prodotti') t
       ),
       per_prodotto AS MATERIALIZED (
         SELECT chiave, COUNT(*)::int AS volantini, MAX(volantino) AS ultimo,
                MAX(volantino) FILTER (WHERE con_foto) AS ultimo_con_foto,
                MIN(prezzo) AS prezzo_minimo, MAX(prezzo) AS prezzo_massimo
         FROM p
         GROUP BY chiave
       ),
       conteggi AS (
         SELECT COUNT(*)::int AS prodotti, (COUNT(*) FILTER (WHERE volantini > :soglia))::int AS frequenti
         FROM per_prodotto
       ),
       ricorrenti AS MATERIALIZED (
         SELECT * FROM per_prodotto
         ORDER BY volantini DESC, ultimo DESC, chiave COLLATE "C"
         LIMIT :ricorrenti
       ),
       per_anno AS MATERIALIZED (
         SELECT p.chiave, p.anno, COUNT(*)::int AS volantini
         FROM p
         WHERE p.chiave IN (SELECT chiave FROM ricorrenti)
         GROUP BY p.chiave, p.anno
       ),
       nomi_marca AS (
         SELECT m ->> 0 AS chiave, m ->> 1 AS marca, SUM((m ->> 2)::int)::int AS referenze
         FROM e
         JOIN analisi_kit a ON a.id_kit_runtime = e.id_kit
         CROSS JOIN LATERAL jsonb_array_elements(a.dati -> 'marche') m
         GROUP BY 1, 2
       ),
       per_marca AS MATERIALIZED (
         SELECT chiave, SUM(referenze)::int AS referenze,
                (array_agg(marca ORDER BY referenze DESC, marca COLLATE "C"))[1] AS marca
         FROM nomi_marca
         GROUP BY chiave
       )
       SELECT
         c.prodotti,
         c.frequenti,
         (SELECT COALESCE(SUM(referenze), 0) FROM per_marca)::int AS referenze_con_marca,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'chiave', r.chiave,
             'volantini', r.volantini,
             'perAnno', COALESCE((SELECT jsonb_object_agg(pa.anno::text, pa.volantini) FROM per_anno pa WHERE pa.chiave = r.chiave), '{}'::jsonb),
             'prezzoMinimo', r.prezzo_minimo,
             'prezzoMassimo', r.prezzo_massimo,
             'ultimoKit', split_part(r.ultimo, '|', 2),
             'ultimoKitConFoto', NULLIF(split_part(r.ultimo_con_foto, '|', 2), '')
           ) ORDER BY r.volantini DESC, r.ultimo DESC, r.chiave COLLATE "C")
           FROM ricorrenti r
         ), '[]'::jsonb) AS ricorrenti,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object('marca', pm.marca, 'referenze', pm.referenze) ORDER BY pm.referenze DESC, pm.chiave COLLATE "C")
           FROM (SELECT * FROM per_marca ORDER BY referenze DESC, chiave COLLATE "C" LIMIT :marche) pm
         ), '[]'::jsonb) AS marche
       FROM conteggi c`,
      { edizioni: JSON.stringify(voci), soglia: limiti.soglia, ricorrenti: limiti.ricorrenti, marche: limiti.marche }
    );
    const prezzo = (valore: number | string | null): number | null => (valore === null ? null : Number(valore));
    return {
      prodotti: numero(riga?.prodotti),
      frequenti: numero(riga?.frequenti),
      ricorrenti: (riga?.ricorrenti ?? []).map(voce => ({ ...voce, prezzoMinimo: prezzo(voce.prezzoMinimo), prezzoMassimo: prezzo(voce.prezzoMassimo) })),
      marche: riga?.marche ?? [],
      referenzeConMarca: numero(riga?.referenze_con_marca),
    };
  }

  async descrizioniProdotti(coppie: ReadonlyArray<{ idKit: string; chiave: string }>): Promise<Map<string, DescrizioneProdotto>> {
    if (coppie.length === 0) return new Map();
    const righe = await this.seleziona<{ id_kit: string; chiave: string; descrizione: DescrizioneCompatta | null }>(
      `SELECT v.id_kit::text AS id_kit, v.chiave, a.descrizioni -> v.chiave AS descrizione
       FROM jsonb_to_recordset(CAST(:coppie AS jsonb)) AS v(id_kit uuid, chiave text)
       JOIN analisi_kit a ON a.id_kit_runtime = v.id_kit`,
      { coppie: JSON.stringify(coppie.map(coppia => ({ id_kit: coppia.idKit, chiave: coppia.chiave }))) }
    );
    return new Map(righe
      .filter(riga => Array.isArray(riga.descrizione))
      .map(riga => [chiaveDescrizione(riga.id_kit, riga.chiave), descrizioneDaCompatta(riga.descrizione as DescrizioneCompatta)]));
  }

  async presenzeProdotto(idKit: readonly string[], chiave: string): Promise<Map<string, ProdottoNelKit>> {
    if (idKit.length === 0) return new Map();
    const righe = await this.seleziona<{ id_kit: string; prodotto: ProdottoCompatto }>(
      `SELECT a.id_kit_runtime::text AS id_kit, t AS prodotto
       FROM analisi_kit a
       CROSS JOIN LATERAL jsonb_array_elements(a.dati -> 'prodotti') t
       WHERE a.id_kit_runtime IN (:idKit) AND t ->> 0 = :chiave`,
      { idKit: [...idKit], chiave }
    );
    return new Map(righe.map(riga => [riga.id_kit, prodottoDaCompatto(riga.prodotto)]));
  }

  async kitDelVolantino(idKit: string): Promise<KitDelVolantino | null> {
    const [riga] = await this.seleziona<{
      id: string; titolo: string; storico: boolean; da_listino: number | null; manuali: number | null;
      pdf_id: string | null; pdf_id_olimpo: string | null; pdf_nome: string | null; pdf_pagine: number | null;
    }>(
      `SELECT k.id::text AS id, k.titolo,
              (jsonb_typeof(k.import_storico) = 'object') IS TRUE AS storico,
              CASE WHEN jsonb_typeof(k.import_storico -> 'referenzeDaListino') = 'number'
                   THEN (k.import_storico ->> 'referenzeDaListino')::numeric::int END AS da_listino,
              CASE WHEN jsonb_typeof(k.import_storico -> 'fuoriListino') = 'array'
                   THEN jsonb_array_length(k.import_storico -> 'fuoriListino') END AS manuali,
              vol.id AS pdf_id, vol.id_olimpo_cloud AS pdf_id_olimpo, vol.nome AS pdf_nome, vol.pages AS pdf_pagine
       FROM runtime_kit k
       ${PDF_VOLANTINO}
       WHERE k.id = :idKit`,
      { idKit }
    );
    if (!riga) return null;
    return {
      id: riga.id,
      titolo: riga.titolo,
      storico: riga.storico === true,
      daListino: riga.da_listino === null ? null : numero(riga.da_listino),
      manuali: riga.manuali === null ? null : numero(riga.manuali),
      pdf: riga.pdf_id && riga.pdf_id_olimpo
        ? { idFile: riga.pdf_id, idOlimpoCloud: riga.pdf_id_olimpo, nome: riga.pdf_nome ?? '', pagine: riga.pdf_pagine ?? null }
        : null,
    };
  }

  async listaDelVolantino(idKit: string): Promise<RigaListaVolantino[]> {
    const righe = await this.seleziona<{
      posizione: number; riga: string; regione: string | null; provincia: string | null;
      id_punto_vendita: string | null; abbinamento: TipoAbbinamento | null;
    }>(
      `SELECT r.posizione, r.riga, r.regione, r.provincia, r.id_punto_vendita::text AS id_punto_vendita, r.abbinamento
       FROM punti_vendita_volantino r
       WHERE r.id_kit_runtime = :idKit
       ORDER BY r.posizione, r.id`,
      { idKit }
    );
    return righe.map(riga => ({
      posizione: numero(riga.posizione),
      riga: riga.riga,
      regione: riga.regione,
      provincia: riga.provincia,
      idPuntoVendita: riga.id_punto_vendita,
      abbinamento: riga.abbinamento,
    }));
  }

  async canaliConPuntiVendita(idGdo: string): Promise<CanaleInAnagrafica[]> {
    const righe = await this.seleziona<{ id: string; nome: string | null; punti_vendita: number }>(
      `SELECT c.id_canali::text AS id, COALESCE(c.nome_canali, c.codice_canali, '') AS nome,
              COUNT(DISTINCT pv.id_puntivendita)::int AS punti_vendita
       FROM canali c
       LEFT JOIN combinazione_canale_area cca ON cca.id_canale_combinazione_canale_area = c.id_canali
       LEFT JOIN punti_vendita pv
         ON pv.id_combinazione_canale_area_puntivendita = cca.id_combinazione_canale_area
        AND pv.id_gdo_puntivendita = :idGdo
       WHERE c.id_gdo_canali = :idGdo
       GROUP BY c.id_canali, c.nome_canali, c.codice_canali`,
      { idGdo }
    );
    return righe.map(riga => ({ id: riga.id, nome: riga.nome ?? '', puntiVendita: numero(riga.punti_vendita) }));
  }

  async puntiVenditaNelleListe(idGdo: string): Promise<CanaleNelleListe[]> {
    const righe = await this.seleziona<{ id_canale: string; nome_canale: string; anno: number; punti_vendita: number }>(
      `SELECT k.id_canale::text AS id_canale, MAX(COALESCE(c.nome_canali, k.nome_canale, '')) AS nome_canale,
              ${ANNO_EDIZIONE} AS anno,
              COUNT(DISTINCT ${CHIAVE_PV_STAMPATO})::int AS punti_vendita
       FROM punti_vendita_volantino r
       JOIN runtime_kit k ON k.id = r.id_kit_runtime
       JOIN promo p ON p.id_promo = k.id_promo
       LEFT JOIN canali c ON c.id_canali = k.id_canale
       WHERE r.id_gdo = :idGdo AND ${KIT_VALIDI}
       GROUP BY 1, 3`,
      { idGdo }
    );
    return righe.map(riga => ({
      idCanale: riga.id_canale,
      nomeCanale: riga.nome_canale,
      anno: numero(riga.anno),
      puntiVendita: numero(riga.punti_vendita),
    }));
  }

  async qualita(idGdo: string, chiaveMeta: string | null, minutiOffline: number): Promise<QualitaGrezza> {
    const senzaCodice = chiaveMeta
      ? `NULLIF(btrim(pv.meta_puntivendita ->> :chiaveMeta), '') IS NULL`
      : `(pv.meta_puntivendita IS NULL OR jsonb_typeof(pv.meta_puntivendita) <> 'object' OR pv.meta_puntivendita = '{}'::jsonb)`;
    const [riga] = await this.seleziona<{
      totale: number; senza_coordinate: number; senza_codice: number; con_storia: number; dispositivi_offline: number; ultimo_import: unknown;
    }>(
      `SELECT COUNT(*)::int AS totale,
              COUNT(*) FILTER (WHERE pv.lat_puntivendita IS NULL OR pv.lon_puntivendita IS NULL)::int AS senza_coordinate,
              COUNT(*) FILTER (WHERE ${senzaCodice})::int AS senza_codice,
              COUNT(*) FILTER (
                WHERE EXISTS (SELECT 1 FROM punti_vendita_volantino r WHERE r.id_punto_vendita = pv.id_puntivendita)
              )::int AS con_storia,
              (SELECT COUNT(*)
               FROM dispositivi_punto_vendita d
               JOIN punti_vendita p2 ON p2.id_puntivendita = d.id_puntivendita
               WHERE p2.id_gdo_puntivendita = :idGdo AND d.is_active_dispositivo
                 AND (d.last_seen_at_dispositivo IS NULL OR d.last_seen_at_dispositivo < NOW() - make_interval(mins => :minutiOffline))
              )::int AS dispositivi_offline,
              (SELECT l.avanzamento
               FROM lavori_in_background l
               WHERE l.tipo = :tipoImport AND l.chiave = :idGdo
               ORDER BY l.createdat DESC
               LIMIT 1) AS ultimo_import
       FROM punti_vendita pv
       WHERE pv.id_gdo_puntivendita = :idGdo`,
      { idGdo, chiaveMeta, minutiOffline: Math.round(minutiOffline), tipoImport: TIPO_LAVORO_IMPORT_PV }
    );
    return {
      totale: numero(riga?.totale),
      senzaCoordinate: numero(riga?.senza_coordinate),
      senzaCodice: numero(riga?.senza_codice),
      conStoria: numero(riga?.con_storia),
      dispositiviOffline: numero(riga?.dispositivi_offline),
      ultimoImport: riga?.ultimo_import ?? null,
    };
  }

  async righeSenzaPuntoVendita(idGdo: string): Promise<RigaSenzaPuntoVendita[]> {
    // Dall'indice parziale delle righe senza PV della GDO
    const righe = await this.seleziona<{
      id_kit: string; data: string; id_canale: string | null; nome_canale: string | null; id_area: string | null; posizione: number;
      riga: string; localita: string | null; indirizzo: string | null; telefono: string | null;
      chiave_indirizzo: string | null; chiave_telefono: string | null;
    }>(
      `SELECT k.id::text AS id_kit, ${DATA_EDIZIONE} AS data,
              k.id_canale::text AS id_canale, COALESCE(c.nome_canali, k.nome_canale) AS nome_canale, k.id_area::text AS id_area,
              r.posizione, r.riga, r.localita, r.indirizzo, r.telefono, r.chiave_indirizzo, r.chiave_telefono
       FROM punti_vendita_volantino r
       JOIN runtime_kit k ON k.id = r.id_kit_runtime
       JOIN promo p ON p.id_promo = k.id_promo
       LEFT JOIN canali c ON c.id_canali = k.id_canale
       WHERE r.id_gdo = :idGdo AND r.id_punto_vendita IS NULL AND ${KIT_VALIDI}
       ORDER BY data, k.id, r.posizione`,
      { idGdo }
    );
    return righe.map(riga => ({
      idKit: riga.id_kit,
      data: riga.data,
      idCanale: riga.id_canale,
      nomeCanale: riga.nome_canale,
      idArea: riga.id_area,
      posizione: numero(riga.posizione),
      riga: riga.riga,
      localita: riga.localita,
      indirizzo: riga.indirizzo,
      telefono: riga.telefono,
      chiaveIndirizzo: riga.chiave_indirizzo,
      chiaveTelefono: riga.chiave_telefono,
    }));
  }

  async edizioniConLista(idGdo: string): Promise<EdizioneConLista[]> {
    const righe = await this.seleziona<{ id_canale: string; id_area: string; data: string }>(
      `SELECT DISTINCT k.id_canale::text AS id_canale, k.id_area::text AS id_area, ${DATA_EDIZIONE} AS data
       FROM runtime_kit k
       JOIN promo p ON p.id_promo = k.id_promo
       WHERE ${KIT_VALIDI}
         AND EXISTS (SELECT 1 FROM punti_vendita_volantino r WHERE r.id_kit_runtime = k.id AND r.id_gdo = :idGdo)`,
      { idGdo }
    );
    return righe.map(riga => ({ idCanale: riga.id_canale, idArea: riga.id_area, data: riga.data }));
  }

  async puntiVenditaConTelefono(idGdo: string): Promise<PuntoVenditaConTelefono[]> {
    return this.seleziona<PuntoVenditaConTelefono>(
      `SELECT id_puntivendita::text AS id, nome_puntivendita AS nome, telefono_puntivendita AS telefono
       FROM punti_vendita
       WHERE id_gdo_puntivendita = :idGdo AND COALESCE(btrim(telefono_puntivendita), '') <> ''`,
      { idGdo }
    );
  }
}
