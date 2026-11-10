import { QueryTypes } from 'sequelize';
import { TIPO_LAVORAZIONE } from '../../../lib/enums';
import type { ImportStorico } from '../../../lib/types';
import { sequelize } from '../db';
import type { KitInsight } from './InsightVolantinoRepository';
import { NOME_AREA, NOME_CANALE } from './MaterialiRepository';
import { DATA_EDIZIONE, KIT_VALIDI, SOSTITUZIONI_FISSE } from './PuntiVenditaVolantinoRepository';

/**
 * I volantini con cui gli insight confrontano un kit (contratto in lib/insightVolantino/tipi.ts):
 * l'edizione precedente della stessa area e dello stesso canale (report PDF) e i volantini della GDO
 * in cui cercare il viaggio di un prodotto.
 *
 * Sono volantini (formato con tipo di lavorazione VOLANTINO) validi come nella storia dei punti
 * vendita (kit e promo non eliminati, stessa data dell'edizione), di qualunque stato di lavorazione:
 * come la pagina degli insight, che si apre anche dai link della Dashboard e della storia dei PV.
 * Sempre della GDO del kit di partenza, che il servizio ha gia' verificato nell'ambito della sessione.
 * Ogni valore passa dalle sostituzioni.
 */

/**
 * Volantini della GDO fra cui cercare un prodotto, dai piu' recenti. Il viaggio calcola (una volta,
 * poi restano in analisi_kit) i riepiloghi di tutti: 300 tiene la prima apertura entro tempi
 * accettabili e copre mesi di promo anche per una GDO con molte varianti area e canale.
 */
export const KIT_PER_VIAGGIO = 300;

export interface IInsightConfrontiRepository {
  /**
   * L'edizione precedente: il volantino piu' recente della stessa GDO, area e canale di un'altra promo
   * con la data dell'edizione prima di quella del kit; null per la prima edizione.
   */
  edizionePrecedente(kit: KitInsight): Promise<KitInsight | null>;
  /**
   * I volantini della GDO del kit, dal piu' recente, al massimo KIT_PER_VIAGGIO. Senza importStorico:
   * al viaggio servono solo identita' e date, e l'import dello storico di centinaia di kit pesa.
   */
  kitDellaGdoPerViaggio(kit: KitInsight): Promise<KitInsight[]>;
}

type Sostituzioni = Record<string, unknown>;

interface RigaKit {
  id: string;
  titolo: string | null;
  id_promo: string;
  nome_promo: string | null;
  id_area: string | null;
  id_canale: string | null;
  area: string | null;
  canale: string | null;
  validita_dal: string | null;
  validita_al: string | null;
  data: string;
  storico: boolean | null;
  import_storico: ImportStorico | null;
  gdo: string | null;
}

const giorno = (colonna: string) => `to_char(${colonna} AT TIME ZONE :fuso, 'YYYY-MM-DD')`;

const colonneKit = (conImportStorico: boolean) => `
  k.id::text AS id, k.titolo, k.id_promo::text AS id_promo, p.nome_promo,
  k.id_area::text AS id_area, k.id_canale::text AS id_canale,
  ${NOME_AREA} AS area, ${NOME_CANALE} AS canale,
  ${giorno('p.validita_dal')} AS validita_dal, ${giorno('p.validita_al')} AS validita_al,
  ${DATA_EDIZIONE} AS data,
  (jsonb_typeof(k.import_storico) = 'object') IS TRUE AS storico,
  ${conImportStorico ? `CASE WHEN jsonb_typeof(k.import_storico) = 'object' THEN k.import_storico END` : 'NULL::jsonb'} AS import_storico,
  p.gdo::text AS gdo`;

const DA_VOLANTINI = `
  FROM runtime_kit k
  JOIN promo p ON p.id_promo = k.id_promo
  JOIN formati fo ON fo.id_formati = k.id_formato
  LEFT JOIN aree a ON a.id_aree = k.id_area
  LEFT JOIN canali c ON c.id_canali = k.id_canale`;

/** Dall'edizione piu' recente; a parita' di data la promo che finisce dopo, poi titolo e id per un ordine stabile. */
const DAL_PIU_RECENTE = `${DATA_EDIZIONE} DESC, p.validita_al DESC NULLS LAST, k.titolo, k.id`;

/** Volantini validi della GDO del kit: senza GDO (dati vecchi) nessuna condizione sulla GDO. */
function condizioniVolantini(kit: KitInsight, sostituzioni: Sostituzioni): string[] {
  sostituzioni.tipoVolantino = TIPO_LAVORAZIONE.VOLANTINO;
  const condizioni = ['fo.tipo_lavorazione_formati = :tipoVolantino', KIT_VALIDI];
  if (kit.gdo) {
    sostituzioni.gdo = kit.gdo;
    condizioni.push('p.gdo = :gdo');
  }
  return condizioni;
}

const kitDaRiga = (riga: RigaKit): KitInsight => ({
  id: riga.id,
  titolo: riga.titolo ?? '',
  idPromo: riga.id_promo,
  nomePromo: riga.nome_promo ?? null,
  idArea: riga.id_area ?? '',
  idCanale: riga.id_canale ?? '',
  area: riga.area ?? '',
  canale: riga.canale ?? '',
  validitaDal: riga.validita_dal ?? null,
  validitaAl: riga.validita_al ?? null,
  data: riga.data,
  storico: riga.storico === true,
  importStorico: riga.import_storico ?? null,
  gdo: riga.gdo ?? null,
});

export class InsightConfrontiRepository implements IInsightConfrontiRepository {
  private async seleziona(sql: string, sostituzioni: Sostituzioni): Promise<KitInsight[]> {
    const righe = await sequelize.query<RigaKit>(sql, {
      replacements: { ...SOSTITUZIONI_FISSE, ...sostituzioni },
      type: QueryTypes.SELECT,
    });
    return righe.map(kitDaRiga);
  }

  async edizionePrecedente(kit: KitInsight): Promise<KitInsight | null> {
    const sostituzioni: Sostituzioni = { idArea: kit.idArea, idCanale: kit.idCanale, idPromo: kit.idPromo, data: kit.data };
    const condizioni = [
      ...condizioniVolantini(kit, sostituzioni),
      'k.id_area::text = :idArea',
      'k.id_canale::text = :idCanale',
      'k.id_promo::text <> :idPromo',
      // Testi YYYY-MM-DD: l'ordine alfabetico e' quello delle date
      `${DATA_EDIZIONE} < :data`,
    ];
    const [precedente] = await this.seleziona(
      `SELECT ${colonneKit(true)}
       ${DA_VOLANTINI}
       WHERE ${condizioni.join(' AND ')}
       ORDER BY ${DAL_PIU_RECENTE}
       LIMIT 1`,
      sostituzioni
    );
    return precedente ?? null;
  }

  async kitDellaGdoPerViaggio(kit: KitInsight): Promise<KitInsight[]> {
    const sostituzioni: Sostituzioni = { limite: KIT_PER_VIAGGIO };
    const condizioni = condizioniVolantini(kit, sostituzioni);
    return this.seleziona(
      `SELECT ${colonneKit(false)}
       ${DA_VOLANTINI}
       WHERE ${condizioni.join(' AND ')}
       ORDER BY ${DAL_PIU_RECENTE}
       LIMIT :limite`,
      sostituzioni
    );
  }
}
