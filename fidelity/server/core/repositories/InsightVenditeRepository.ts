import { QueryTypes } from 'sequelize';
import { TIPO_LAVORAZIONE } from '../../../lib/enums';
import type { PdfVolantino } from '../../../lib/insightVolantino/tipi';
import { sequelize } from '../db';
import type { VenditeCodice, VenditeDelPeriodo } from '../utils/rendimentoInsight';
import type { KitInsight } from './InsightVolantinoRepository';
import { NOME_AREA, NOME_CANALE } from './MaterialiRepository';
import { DATA_EDIZIONE, KIT_VALIDI, PDF_VOLANTINO, SOSTITUZIONI_FISSE } from './PuntiVenditaVolantinoRepository';

/**
 * Le vendite importate (tabella vendite_prodotti, lib/vendite/tipi.ts) lette per gli insight del
 * volantino: rendimento dei box, previsione e simulazione (lib/insightVolantino/rendimento.ts).
 *
 * Le vendite di un volantino sono quelle dei suoi codici prodotto nei punti vendita della GDO con la
 * stessa area e lo stesso canale del volantino (punti_vendita -> combinazione_canale_area), nel
 * periodo di validita' della sua promo.
 *
 * Periodo: una riga di vendita conta in proporzione ai suoi giorni dentro la validita' della promo
 * (vendite uniformi nei giorni della riga). Una riga tutta dentro conta per intero; una settimana
 * da lunedi' a domenica con la promo da giovedi' a mercoledi' conta per 4/7 nella prima settimana e
 * 3/7 nella seconda. Contare solo le righe tutte dentro sarebbe piu' semplice, ma con file
 * settimanali e promo non allineate alla settimana non conterebbe niente.
 *
 * Le query usano l'indice (id_gdo, codice_prodotto, dal, al) della migrazione delle vendite: sempre
 * GDO e codici, poi le date. Ogni valore passa dalle sostituzioni.
 */

/** Un periodo di validita' di cui sommare le vendite, per kit. */
export interface PeriodoDiVendita {
  idKit: string;
  /** YYYY-MM-DD inclusi. */
  dal: string;
  al: string;
}

/** GDO, area e canale delle vendite: quelli del volantino. */
export interface AmbitoVendite {
  idGdo: string;
  idArea: string;
  idCanale: string;
}

/** Un volantino precedente della stessa GDO, area e canale, con il suo PDF (per le pagine). */
export interface EdizionePrecedente {
  kit: KitInsight;
  pdf: PdfVolantino | null;
}

export interface IInsightVenditeRepository {
  /**
   * Le vendite dei codici indicati in ogni periodo, per id del kit: solo i kit con almeno una riga.
   * Un codice senza righe nel periodo manca da perCodice.
   */
  venditeNeiPeriodi(ambito: AmbitoVendite, periodi: readonly PeriodoDiVendita[], codici: readonly string[]): Promise<Map<string, VenditeDelPeriodo>>;
  /**
   * Le ultime `quante` edizioni prima del kit: volantini validi (kit e promo non eliminati, formato
   * volantino) della stessa GDO, area e canale, di un'altra promo, con la data dell'edizione prima
   * di quella del kit; dalla piu' recente. Senza GDO del kit nessuna.
   */
  edizioniPrecedenti(kit: KitInsight, quante: number): Promise<EdizionePrecedente[]>;
}

type Sostituzioni = Record<string, unknown>;

/** La parte di una riga di vendita (v) che cade nel periodo (e), da 0 a 1, in giorni. */
const QUOTA_NEL_PERIODO = `
  (LEAST(v.al, e.al) - GREATEST(v.dal, e.dal) + 1)::numeric / GREATEST(v.al - v.dal + 1, 1)`;

interface RigaVendite {
  id_kit: string;
  codice: string | null;
  /** La riga dei totali del kit (GROUPING SETS): codice NULL. */
  totale: boolean;
  pezzi: string | number | null;
  valore: string | number | null;
  senza_valore: string | number;
  punti_vendita: string | number;
}

interface RigaEdizione {
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
  gdo: string | null;
}

const numero = (valore: string | number | null): number => {
  const convertito = Number(valore ?? 0);
  return Number.isFinite(convertito) ? convertito : 0;
};

const giorno = (colonna: string) => `to_char(${colonna} AT TIME ZONE :fuso, 'YYYY-MM-DD')`;

export class InsightVenditeRepository implements IInsightVenditeRepository {
  private async seleziona<T extends object>(sql: string, sostituzioni: Sostituzioni): Promise<T[]> {
    return sequelize.query<T>(sql, {
      replacements: { ...SOSTITUZIONI_FISSE, ...sostituzioni },
      type: QueryTypes.SELECT,
    });
  }

  async venditeNeiPeriodi(ambito: AmbitoVendite, periodi: readonly PeriodoDiVendita[], codici: readonly string[]): Promise<Map<string, VenditeDelPeriodo>> {
    const risultato = new Map<string, VenditeDelPeriodo>();
    if (periodi.length === 0 || codici.length === 0) return risultato;

    // Per kit e codice, e per kit (GROUPING SETS): i punti vendita distinti si contano sul kit intero
    const righe = await this.seleziona<RigaVendite>(
      `SELECT e.id_kit,
              v.codice_prodotto AS codice,
              GROUPING(v.codice_prodotto) = 1 AS totale,
              SUM(v.pezzi * q.quota) AS pezzi,
              SUM(v.valore * q.quota) AS valore,
              COUNT(*) FILTER (WHERE v.valore IS NULL) AS senza_valore,
              COUNT(DISTINCT v.id_punto_vendita) AS punti_vendita
       FROM unnest(ARRAY[:idKit]::text[], ARRAY[:dal]::date[], ARRAY[:al]::date[]) AS e(id_kit, dal, al)
       JOIN vendite_prodotti v
         ON v.id_gdo = CAST(:idGdo AS uuid)
        AND v.codice_prodotto IN (:codici)
        AND v.dal <= e.al
        AND v.al >= e.dal
       JOIN punti_vendita pv ON pv.id_puntivendita = v.id_punto_vendita
       JOIN combinazione_canale_area cca ON cca.id_combinazione_canale_area = pv.id_combinazione_canale_area_puntivendita
       CROSS JOIN LATERAL (SELECT ${QUOTA_NEL_PERIODO} AS quota) q
       WHERE cca.id_area_combinazione_canale_area::text = :idArea
         AND cca.id_canale_combinazione_canale_area::text = :idCanale
       GROUP BY GROUPING SETS ((e.id_kit, v.codice_prodotto), (e.id_kit))`,
      {
        idKit: periodi.map(periodo => periodo.idKit),
        dal: periodi.map(periodo => periodo.dal),
        al: periodi.map(periodo => periodo.al),
        idGdo: ambito.idGdo,
        idArea: ambito.idArea,
        idCanale: ambito.idCanale,
        codici: [...codici],
      }
    );

    const periodoDi = new Map(periodi.map(periodo => [periodo.idKit, periodo] as const));
    const perKit = new Map<string, { perCodice: Map<string, VenditeCodice>; puntiVendita: number; senzaValore: number }>();
    const delKit = (idKit: string) => {
      const voce = perKit.get(idKit) ?? { perCodice: new Map<string, VenditeCodice>(), puntiVendita: 0, senzaValore: 0 };
      perKit.set(idKit, voce);
      return voce;
    };
    for (const riga of righe) {
      const voce = delKit(riga.id_kit);
      if (riga.totale) {
        voce.puntiVendita = numero(riga.punti_vendita);
        voce.senzaValore = numero(riga.senza_valore);
      } else if (riga.codice !== null) {
        voce.perCodice.set(riga.codice, {
          pezzi: numero(riga.pezzi),
          valore: numero(riga.senza_valore) > 0 || riga.valore === null ? null : numero(riga.valore),
        });
      }
    }
    for (const [idKit, voce] of perKit) {
      const periodo = periodoDi.get(idKit);
      if (!periodo || voce.perCodice.size === 0) continue;
      risultato.set(idKit, {
        periodo: { dal: periodo.dal, al: periodo.al },
        puntiVendita: voce.puntiVendita,
        perCodice: voce.perCodice,
        conValore: voce.senzaValore === 0,
      });
    }
    return risultato;
  }

  async edizioniPrecedenti(kit: KitInsight, quante: number): Promise<EdizionePrecedente[]> {
    if (!kit.gdo || quante <= 0) return [];
    const sostituzioni: Sostituzioni = {
      tipoVolantino: TIPO_LAVORAZIONE.VOLANTINO,
      gdo: kit.gdo,
      idArea: kit.idArea,
      idCanale: kit.idCanale,
      idPromo: kit.idPromo,
      data: kit.data,
      quante: Math.floor(quante),
    };
    const righe = await this.seleziona<RigaEdizione>(
      `SELECT k.id::text AS id, k.titolo, k.id_promo::text AS id_promo, p.nome_promo,
              k.id_area::text AS id_area, k.id_canale::text AS id_canale,
              ${NOME_AREA} AS area, ${NOME_CANALE} AS canale,
              ${giorno('p.validita_dal')} AS validita_dal, ${giorno('p.validita_al')} AS validita_al,
              ${DATA_EDIZIONE} AS data,
              (jsonb_typeof(k.import_storico) = 'object') IS TRUE AS storico,
              p.gdo::text AS gdo
       FROM runtime_kit k
       JOIN promo p ON p.id_promo = k.id_promo
       JOIN formati fo ON fo.id_formati = k.id_formato
       LEFT JOIN aree a ON a.id_aree = k.id_area
       LEFT JOIN canali c ON c.id_canali = k.id_canale
       WHERE fo.tipo_lavorazione_formati = :tipoVolantino
         AND ${KIT_VALIDI}
         AND p.gdo = :gdo
         AND k.id_area::text = :idArea
         AND k.id_canale::text = :idCanale
         AND k.id_promo::text <> :idPromo
         AND ${DATA_EDIZIONE} < :data
       ORDER BY ${DATA_EDIZIONE} DESC, p.validita_al DESC NULLS LAST, k.titolo, k.id
       LIMIT :quante`,
      sostituzioni
    );
    if (righe.length === 0) return [];

    // Il PDF dopo, solo per le edizioni scelte: come pdfDelKit (PDF_VOLANTINO)
    const pdf = await this.seleziona<{ id: string; id_olimpo_cloud: string | null; pages: number | string | null }>(
      `SELECT k.id::text AS id, vol.id_olimpo_cloud, vol.pages
       FROM runtime_kit k
       ${PDF_VOLANTINO}
       WHERE k.id IN (:idKit)`,
      { idKit: righe.map(riga => riga.id) }
    );
    const pdfPerKit = new Map(pdf.flatMap((riga): Array<[string, PdfVolantino]> => {
      if (!riga.id_olimpo_cloud) return [];
      const pagine = Number(riga.pages);
      return [[riga.id, { idOlimpoCloud: riga.id_olimpo_cloud, pagine: Number.isInteger(pagine) && pagine > 0 ? pagine : 0 }]];
    }));

    return righe.map(riga => ({
      kit: {
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
        // Alle previsioni non serve l'import dello storico (le sole fuori listino), e pesa
        importStorico: null,
        gdo: riga.gdo ?? null,
      },
      pdf: pdfPerKit.get(riga.id) ?? null,
    }));
  }
}
