import { QueryTypes } from 'sequelize';
import { sequelize } from '../db';
import type { CampoSuggerito, RegolaMenabo, ValoreSuggerito, VolantinoProvaMenabo } from '../../../lib/impostazioniGdo/tipi';
import type { PercorsoCampo } from '../utils/campiInsights';
import { regoleMenaboDa } from '../utils/regoleMenabo';
import type { FonteRepartiGdo, RepartoNelleReferenze, RepartoSalvato } from '../utils/repartiGdo';
import { KIT_VALIDI, SOSTITUZIONI_FISSE } from './PuntiVenditaVolantinoRepository';

/**
 * Le Impostazioni GDO nel database (spec impostazioni-gdo): la riga di impostazioni_gdo della GDO
 * (reparti per il marketing, configurazione degli insight), la GDO stessa e i reparti che compaiono
 * nelle referenze dei suoi volantini. Ogni valore passa dalle sostituzioni; un salvataggio crea la
 * riga se manca e cambia solo le sue colonne.
 */

export interface ImpostazioniGdoSalvate {
  idGdo: string;
  reparti: RepartoSalvato[];
  /** La configurazione degli insight salvata per la GDO; null: vale quella del file. */
  insightVolantino: Record<string, unknown> | null;
  insightAggiornatoIl: Date | null;
  insightAggiornatoDa: string | null;
  aggiornatoIl: Date;
  /** Le regole delle sezioni del menabò degli insight; vuoto: vale la sezione della libreria agenzia. */
  regoleMenabo: RegolaMenabo[];
}

export interface GdoDelleImpostazioni {
  id: string;
  nome: string;
  haIcona: boolean;
}

/** Dove leggere codice e descrizione del reparto nelle referenze: i percorsi della config degli insight. */
export interface PercorsiReparto {
  codice: PercorsoCampo | null;
  descrizione: PercorsoCampo | null;
}

export interface IImpostazioniGdoRepository extends FonteRepartiGdo {
  trova(idGdo: string): Promise<ImpostazioniGdoSalvate | null>;
  gdo(idGdo: string): Promise<GdoDelleImpostazioni | null>;
  salvaReparti(idGdo: string, reparti: readonly RepartoSalvato[]): Promise<void>;
  salvaRegoleMenabo(idGdo: string, regole: readonly RegolaMenabo[]): Promise<void>;
  /** I campi dei dati delle referenze degli ultimi volantini della GDO, dal più usato, per suggerirli nelle regole. */
  campiDelleReferenze(idGdo: string, limite: number): Promise<CampoSuggerito[]>;
  /** I valori (testo o numero) di un campo nelle referenze degli ultimi volantini della GDO, dal più frequente. */
  valoriDelCampo(idGdo: string, campo: string, limite: number): Promise<Array<Omit<ValoreSuggerito, 'nomeLeggibile'>>>;
  /** Gli ultimi volantini (kit non eliminati) della GDO, dal più recente, per provare le regole del menabò. */
  volantiniDellaGdo(idGdo: string, limite: number): Promise<VolantinoProvaMenabo[]>;
  salvaInsightVolantino(idGdo: string, configurazione: Record<string, unknown>, aggiornatoDa: string | null): Promise<void>;
  /** Toglie la configurazione degli insight della GDO: si torna a quella del file. */
  eliminaInsightVolantino(idGdo: string): Promise<void>;
  /** I reparti nelle referenze dei volantini (kit e promo non eliminati) della GDO, con quante referenze. */
  repartiNelleReferenze(idGdo: string, percorsi: PercorsiReparto): Promise<RepartoNelleReferenze[]>;
}

type Sostituzioni = Record<string, unknown>;

interface RigaImpostazioni {
  id_gdo: string;
  reparti: unknown;
  insight_volantino: unknown;
  insight_aggiornato_il: Date | string | null;
  insight_aggiornato_da: string | null;
  aggiornato_il: Date | string;
  regole_menabo: unknown;
}

const comeData = (valore: Date | string | null): Date | null => (valore === null ? null : new Date(valore));

const oggetto = (valore: unknown): Record<string, unknown> | null =>
  valore !== null && typeof valore === 'object' && !Array.isArray(valore) ? valore as Record<string, unknown> : null;

/** Le voci salvate lette dal JSONB: solo quelle con un codice; il resto ripulito. */
export function repartiSalvatiDa(valore: unknown): RepartoSalvato[] {
  if (!Array.isArray(valore)) return [];
  return valore.flatMap((voce: unknown): RepartoSalvato[] => {
    const campi = oggetto(voce);
    if (!campi || typeof campi.codice !== 'string' || campi.codice.trim() === '') return [];
    const testo = (chiave: string): string | null =>
      typeof campi[chiave] === 'string' && (campi[chiave] as string).trim() !== '' ? (campi[chiave] as string).trim() : null;
    return [{
      codice: campi.codice.trim(),
      nomeDati: testo('nomeDati') ?? '',
      nomeMarketing: testo('nomeMarketing'),
      colore: testo('colore'),
    }];
  });
}

// ─── Percorsi della config in SQL ───────────────────────────────────

/** Colonne di referenze che un percorso della config puo' indicare come testo. */
const COLONNE_TESTO = new Set(['meccanica', 'codice_box']);

/** Profondita' massima di un percorso nei data_fields: oltre, la combinazione delle chiavi cresce troppo. */
const MASSIMA_PROFONDITA = 4;

/**
 * Le chiavi con cui seguire un percorso nei data_fields, nell'ordine di campiInsights.valoreCampo:
 * prima la chiave piu' lunga ("Referenza.Codice" come chiave intera), poi le parti.
 */
export function chiaviDelPercorso(parti: readonly string[]): string[][] {
  if (parti.length === 0) return [[]];
  const risultato: string[][] = [];
  for (let fine = parti.length; fine >= 1; fine--) {
    const chiave = parti.slice(0, fine).join('.');
    for (const resto of chiaviDelPercorso(parti.slice(fine))) risultato.push([chiave, ...resto]);
  }
  return risultato;
}

/**
 * L'espressione SQL del valore di un campo della config degli insight su una riga di referenze (r),
 * come lo legge campiInsights.valoreCampo: le alternative in ordine, vale la prima non vuota; solo
 * testi e numeri. Percorsi nei data_fields ("data_fields.reparto", "dataFields.Referenza.Codice") o
 * colonne di testo note; gli altri si ignorano. null se non resta nessuna alternativa. Le chiavi
 * vanno nelle sostituzioni, con il prefisso indicato.
 */
export function espressioneCampo(percorso: PercorsoCampo | null, sostituzioni: Sostituzioni, prefisso: string): string | null {
  if (percorso === null) return null;
  const percorsi = typeof percorso === 'string' ? [percorso] : [...percorso];
  const alternative: string[] = [];
  let progressivo = 0;
  const parametro = (valore: string): string => {
    const nome = `${prefisso}${progressivo++}`;
    sostituzioni[nome] = valore;
    return `:${nome}`;
  };
  for (const voce of percorsi) {
    const parti = voce.split('.').filter(parte => parte !== '');
    if (parti.length === 0) continue;
    const [radice, ...resto] = parti;
    if ((radice === 'data_fields' || radice === 'dataFields') && resto.length > 0 && resto.length <= MASSIMA_PROFONDITA) {
      for (const chiavi of chiaviDelPercorso(resto)) {
        const valore = `r.data_fields${chiavi.map(chiave => ` -> ${parametro(chiave)}`).join('')}`;
        alternative.push(`NULLIF(btrim(CASE WHEN jsonb_typeof(${valore}) IN ('string', 'number') THEN ${valore} #>> '{}' END), '')`);
      }
    } else if (parti.length === 1 && COLONNE_TESTO.has(radice)) {
      alternative.push(`NULLIF(btrim(r.${radice}::text), '')`);
    }
  }
  return alternative.length > 0 ? `COALESCE(${alternative.join(', ')})` : null;
}

/** Senza config: i campi del reparto di Istanta e dello storico. */
export const PERCORSI_REPARTO_PREDEFINITI: PercorsiReparto = {
  codice: 'data_fields.reparto',
  descrizione: 'data_fields.descrizione_reparto',
};

/** Quanti volantini recenti si guardano per i suggerimenti delle regole: abbastanza per vedere le mastro in uso, senza leggere tutto lo storico. */
const KIT_PER_SUGGERIMENTI = 40;

/** Gli ultimi volantini della GDO con referenze (CTE `ultimi`), dal più recente. */
const ULTIMI_KIT = `
  SELECT k.id FROM runtime_kit k
  JOIN promo p ON p.id_promo = k.id_promo
  WHERE p.gdo = :idGdo AND ${KIT_VALIDI}
    AND EXISTS (SELECT 1 FROM referenze x WHERE x.id_runtime_kit = k.id)
  ORDER BY COALESCE(p.validita_dal, p.validita_al, k."createdAt") DESC, k.id
  LIMIT :limiteKit`;

export class ImpostazioniGdoRepository implements IImpostazioniGdoRepository {
  private async seleziona<T extends object>(sql: string, sostituzioni: Sostituzioni): Promise<T[]> {
    return sequelize.query<T>(sql, { replacements: { ...SOSTITUZIONI_FISSE, ...sostituzioni }, type: QueryTypes.SELECT });
  }

  async trova(idGdo: string): Promise<ImpostazioniGdoSalvate | null> {
    const [riga] = await this.seleziona<RigaImpostazioni>(
      `SELECT id_gdo::text AS id_gdo, reparti, insight_volantino, insight_aggiornato_il, insight_aggiornato_da, aggiornato_il, regole_menabo
       FROM impostazioni_gdo WHERE id_gdo = :idGdo`,
      { idGdo }
    );
    if (!riga) return null;
    return {
      idGdo: riga.id_gdo,
      reparti: repartiSalvatiDa(riga.reparti),
      insightVolantino: oggetto(riga.insight_volantino),
      insightAggiornatoIl: comeData(riga.insight_aggiornato_il),
      insightAggiornatoDa: riga.insight_aggiornato_da ?? null,
      aggiornatoIl: comeData(riga.aggiornato_il) ?? new Date(0),
      regoleMenabo: regoleMenaboDa(riga.regole_menabo),
    };
  }

  async repartiSalvati(idGdo: string): Promise<RepartoSalvato[]> {
    const [riga] = await this.seleziona<{ reparti: unknown }>(`SELECT reparti FROM impostazioni_gdo WHERE id_gdo = :idGdo`, { idGdo });
    return repartiSalvatiDa(riga?.reparti);
  }

  async gdo(idGdo: string): Promise<GdoDelleImpostazioni | null> {
    const [riga] = await this.seleziona<{ id: string; nome: string | null; ha_icona: boolean }>(
      `SELECT g.id_gdo::text AS id, g.nome_gdo AS nome, (g.icona_gdo IS NOT NULL) AS ha_icona FROM gdo g WHERE g.id_gdo = :idGdo`,
      { idGdo }
    );
    return riga ? { id: riga.id, nome: riga.nome ?? '', haIcona: riga.ha_icona === true } : null;
  }

  async salvaReparti(idGdo: string, reparti: readonly RepartoSalvato[]): Promise<void> {
    await sequelize.query(
      `INSERT INTO impostazioni_gdo (id_gdo, reparti, aggiornato_il)
       VALUES (:idGdo, CAST(:reparti AS jsonb), NOW())
       ON CONFLICT (id_gdo) DO UPDATE SET reparti = EXCLUDED.reparti, aggiornato_il = NOW()`,
      { replacements: { idGdo, reparti: JSON.stringify(reparti) } }
    );
  }

  async salvaRegoleMenabo(idGdo: string, regole: readonly RegolaMenabo[]): Promise<void> {
    await sequelize.query(
      `INSERT INTO impostazioni_gdo (id_gdo, regole_menabo, aggiornato_il)
       VALUES (:idGdo, CAST(:regole AS jsonb), NOW())
       ON CONFLICT (id_gdo) DO UPDATE SET regole_menabo = EXCLUDED.regole_menabo, aggiornato_il = NOW()`,
      { replacements: { idGdo, regole: JSON.stringify(regole) } }
    );
  }

  async campiDelleReferenze(idGdo: string, limite: number): Promise<CampoSuggerito[]> {
    const righe = await this.seleziona<{ campo: string; referenze: number | string }>(
      `WITH ultimi AS (${ULTIMI_KIT})
       SELECT chiave AS campo, count(*)::int AS referenze
       FROM referenze r
       CROSS JOIN LATERAL jsonb_object_keys(CASE WHEN jsonb_typeof(r.data_fields) = 'object' THEN r.data_fields ELSE '{}'::jsonb END) AS chiave
       WHERE r.id_runtime_kit IN (SELECT id FROM ultimi)
       GROUP BY chiave
       ORDER BY referenze DESC, chiave
       LIMIT :limite`,
      { idGdo, limiteKit: KIT_PER_SUGGERIMENTI, limite }
    );
    return righe.map(riga => ({ campo: riga.campo, referenze: Number(riga.referenze) || 0 }));
  }

  async valoriDelCampo(idGdo: string, campo: string, limite: number): Promise<Array<Omit<ValoreSuggerito, 'nomeLeggibile'>>> {
    const righe = await this.seleziona<{ valore: string; referenze: number | string }>(
      `WITH ultimi AS (${ULTIMI_KIT})
       SELECT btrim(r.data_fields ->> :campo) AS valore, count(*)::int AS referenze
       FROM referenze r
       WHERE r.id_runtime_kit IN (SELECT id FROM ultimi)
         AND jsonb_typeof(r.data_fields -> :campo) IN ('string', 'number')
         AND btrim(r.data_fields ->> :campo) <> ''
       GROUP BY 1
       ORDER BY referenze DESC, valore
       LIMIT :limite`,
      { idGdo, limiteKit: KIT_PER_SUGGERIMENTI, campo, limite }
    );
    return righe.map(riga => ({ valore: riga.valore, referenze: Number(riga.referenze) || 0 }));
  }

  async volantiniDellaGdo(idGdo: string, limite: number): Promise<VolantinoProvaMenabo[]> {
    const righe = await this.seleziona<{ id_kit: string; titolo: string | null; nome_promo: string | null }>(
      `SELECT k.id::text AS id_kit, k.titolo, p.nome_promo
       FROM runtime_kit k
       JOIN promo p ON p.id_promo = k.id_promo
       WHERE p.gdo = :idGdo AND ${KIT_VALIDI}
         AND EXISTS (SELECT 1 FROM referenze r WHERE r.id_runtime_kit = k.id)
       ORDER BY COALESCE(p.validita_dal, p.validita_al, k."createdAt") DESC, k.id
       LIMIT :limite`,
      { idGdo, limite }
    );
    return righe.map(riga => ({ idKit: riga.id_kit, titolo: riga.titolo ?? '', nomePromo: riga.nome_promo ?? '' }));
  }

  async salvaInsightVolantino(idGdo: string, configurazione: Record<string, unknown>, aggiornatoDa: string | null): Promise<void> {
    await sequelize.query(
      `INSERT INTO impostazioni_gdo (id_gdo, insight_volantino, insight_aggiornato_il, insight_aggiornato_da, aggiornato_il)
       VALUES (:idGdo, CAST(:configurazione AS jsonb), NOW(), :aggiornatoDa, NOW())
       ON CONFLICT (id_gdo) DO UPDATE SET
         insight_volantino = EXCLUDED.insight_volantino,
         insight_aggiornato_il = EXCLUDED.insight_aggiornato_il,
         insight_aggiornato_da = EXCLUDED.insight_aggiornato_da,
         aggiornato_il = NOW()`,
      { replacements: { idGdo, configurazione: JSON.stringify(configurazione), aggiornatoDa } }
    );
  }

  async eliminaInsightVolantino(idGdo: string): Promise<void> {
    await sequelize.query(
      `UPDATE impostazioni_gdo
       SET insight_volantino = NULL, insight_aggiornato_il = NULL, insight_aggiornato_da = NULL, aggiornato_il = NOW()
       WHERE id_gdo = :idGdo`,
      { replacements: { idGdo } }
    );
  }

  /**
   * Una riga per coppia codice e descrizione, come le scrivono i dati, con quante referenze: il
   * servizio le riconduce ai reparti della GDO (codici "1" e "01" insieme). Si legge in SQL con i
   * percorsi della config, senza portare le referenze in memoria; senza percorsi utilizzabili quelli
   * predefiniti di Istanta e dello storico.
   */
  async repartiNelleReferenze(idGdo: string, percorsi: PercorsiReparto): Promise<RepartoNelleReferenze[]> {
    const sostituzioni: Sostituzioni = { idGdo };
    const codice = espressioneCampo(percorsi.codice, sostituzioni, 'codice')
      ?? espressioneCampo(PERCORSI_REPARTO_PREDEFINITI.codice, sostituzioni, 'codice');
    const descrizione = espressioneCampo(percorsi.descrizione, sostituzioni, 'descrizione')
      ?? espressioneCampo(PERCORSI_REPARTO_PREDEFINITI.descrizione, sostituzioni, 'descrizione');
    const righe = await this.seleziona<{ codice: string | null; descrizione: string | null; referenze: number | string }>(
      `SELECT valori.codice, valori.descrizione, count(*)::int AS referenze
       FROM referenze r
       JOIN runtime_kit k ON k.id = r.id_runtime_kit
       JOIN promo p ON p.id_promo = k.id_promo
       CROSS JOIN LATERAL (SELECT ${codice} AS codice, ${descrizione} AS descrizione) valori
       WHERE p.gdo = :idGdo AND ${KIT_VALIDI}
         AND (valori.codice IS NOT NULL OR valori.descrizione IS NOT NULL)
       GROUP BY valori.codice, valori.descrizione`,
      sostituzioni
    );
    return righe.map(riga => ({ codice: riga.codice ?? null, descrizione: riga.descrizione ?? null, referenze: Number(riga.referenze) || 0 }));
  }
}
