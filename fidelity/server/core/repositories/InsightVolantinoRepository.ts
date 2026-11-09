import { QueryTypes } from 'sequelize';
import type { PdfVolantino } from '../../../lib/insightVolantino/tipi';
import type { ImportStorico } from '../../../lib/types';
import type { AmbitoGdo } from '../accessi/contestoAccesso';
import { sequelize } from '../db';
import type { RigaReferenza } from '../utils/referenzaStampata';
import { condizioneAmbitoGdo, NOME_AREA, NOME_CANALE } from './MaterialiRepository';
import { DATA_EDIZIONE, PDF_VOLANTINO, SOSTITUZIONI_FISSE } from './PuntiVenditaVolantinoRepository';

/**
 * Letture degli insight del volantino (lib/insightVolantino/tipi.ts), in SQL con le sostituzioni
 * come le altre letture dei volantini e con gli stessi frammenti: data dell'edizione, PDF del
 * volantino, nomi di area e canale, GDO della promo.
 *
 * Il kit si legge solo nella GDO della richiesta: per chi non la vede e' come se non esistesse.
 * Non si filtra sullo stato del kit ne' sul formato: gli insight si aprono anche dai link della
 * Dashboard e dalla storia dei punti vendita, che portano a kit non ancora pubblicati.
 */

/** Il kit di cui si leggono gli insight, con promo, area, canale e GDO. */
export interface KitInsight {
  id: string;
  titolo: string;
  idPromo: string;
  nomePromo: string | null;
  idArea: string;
  idCanale: string;
  area: string;
  canale: string;
  validitaDal: string | null;
  validitaAl: string | null;
  /** DATA_EDIZIONE YYYY-MM-DD */
  data: string;
  storico: boolean;
  importStorico: ImportStorico | null;
  gdo: string | null;
}

type Sostituzioni = Record<string, unknown>;

/** Gli id dei kit sono UUID: qualunque altro testo non e' un kit (e in SQL farebbe fallire il cast). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const giorno = (colonna: string) => `to_char(${colonna} AT TIME ZONE :fuso, 'YYYY-MM-DD')`;

async function seleziona<T extends object>(sql: string, sostituzioni: Sostituzioni = {}): Promise<T[]> {
  return sequelize.query<T>(sql, {
    replacements: { ...SOSTITUZIONI_FISSE, ...sostituzioni },
    type: QueryTypes.SELECT,
  });
}

interface RigaKit {
  id: string;
  titolo: string;
  id_promo: string;
  nome_promo: string | null;
  id_area: string;
  id_canale: string;
  area: string;
  canale: string;
  validita_dal: string | null;
  validita_al: string | null;
  data: string;
  storico: boolean;
  import_storico: ImportStorico | null;
  gdo: string | null;
}

/** Il kit, se esiste ed e' della GDO dell'ambito; null altrimenti, senza dire quale dei due. */
export async function kitNellAmbito(idKit: string, ambito: AmbitoGdo): Promise<KitInsight | null> {
  if (!UUID.test(idKit)) return null;
  const sostituzioni: Sostituzioni = { idKit };
  const condizioni = ['k.id = :idKit'];
  const gdo = condizioneAmbitoGdo(ambito, sostituzioni);
  if (gdo) condizioni.push(gdo);

  const [riga] = await seleziona<RigaKit>(
    `SELECT k.id::text AS id, k.titolo, k.id_promo::text AS id_promo, p.nome_promo,
            k.id_area::text AS id_area, k.id_canale::text AS id_canale,
            ${NOME_AREA} AS area, ${NOME_CANALE} AS canale,
            ${giorno('p.validita_dal')} AS validita_dal, ${giorno('p.validita_al')} AS validita_al,
            ${DATA_EDIZIONE} AS data,
            (jsonb_typeof(k.import_storico) = 'object') IS TRUE AS storico,
            CASE WHEN jsonb_typeof(k.import_storico) = 'object' THEN k.import_storico END AS import_storico,
            p.gdo::text AS gdo
     FROM runtime_kit k
     JOIN promo p ON p.id_promo = k.id_promo
     LEFT JOIN aree a ON a.id_aree = k.id_area
     LEFT JOIN canali c ON c.id_canali = k.id_canale
     WHERE ${condizioni.join(' AND ')}
     LIMIT 1`,
    sostituzioni
  );
  if (!riga) return null;
  return {
    id: riga.id,
    titolo: riga.titolo,
    idPromo: riga.id_promo,
    nomePromo: riga.nome_promo ?? null,
    idArea: riga.id_area,
    idCanale: riga.id_canale,
    area: riga.area ?? '',
    canale: riga.canale ?? '',
    validitaDal: riga.validita_dal ?? null,
    validitaAl: riga.validita_al ?? null,
    data: riga.data,
    storico: riga.storico === true,
    importStorico: riga.import_storico ?? null,
    gdo: riga.gdo ?? null,
  };
}

/**
 * Il PDF del volantino in Olimpo, scelto come nella storia dei punti vendita (PDF_VOLANTINO): il
 * primo file dell'export VOL che sta su Olimpo, meglio se PDF. pagine e' 0 quando il file non lo
 * dice: chi lo usa ripiega sulle pagine del volantino.
 */
export async function pdfDelKit(idKit: string): Promise<PdfVolantino | null> {
  if (!UUID.test(idKit)) return null;
  const [riga] = await seleziona<{ id_olimpo_cloud: string | null; pages: number | string | null }>(
    `SELECT vol.id_olimpo_cloud, vol.pages
     FROM runtime_kit k
     ${PDF_VOLANTINO}
     WHERE k.id = :idKit`,
    { idKit }
  );
  if (!riga?.id_olimpo_cloud) return null;
  const pagine = Number(riga.pages);
  return { idOlimpoCloud: riga.id_olimpo_cloud, pagine: Number.isInteger(pagine) && pagine > 0 ? pagine : 0 };
}

/**
 * Le referenze del kit per pagina e posizione, poi per creazione: l'ordine conta, perche' la prima
 * riga di un box e' la pilota (boxDelKit). Tutte le colonne: i campi della config degli insight
 * (dataMapping.referenzaFields) possono indicarne una qualunque.
 */
export async function righeDelKit(idKit: string): Promise<RigaReferenza[]> {
  if (!UUID.test(idKit)) return [];
  return seleziona<RigaReferenza>(
    `SELECT r.*
     FROM referenze r
     WHERE r.id_runtime_kit = :idKit
     ORDER BY r.pag NULLS LAST, r.y NULLS LAST, r.x NULLS LAST, r."createdAt", r.id`,
    { idKit }
  );
}
