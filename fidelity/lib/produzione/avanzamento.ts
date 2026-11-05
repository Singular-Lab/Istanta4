import type { STATO_PROMO } from '../enums';
import type { Riferimento, StatoKitMateriali } from '../materiali/tipi';

/**
 * Contratto di GET /api/produzione/avanzamento: le promo in corso della GDO con i loro kit
 * volantino e POP, avviati e non avviati, per la pagina Avanzamento produzione.
 */

export const PERCORSO_AVANZAMENTO_PRODUZIONE = '/avanzamento-produzione';

/** Volantino o POP, come lo decide il formato del kit. */
export type TipoKitAvanzamento = 'VOL' | 'POP';

export interface KitAvanzamento {
  /** Id del kit runtime; null per un kit non ancora avviato. */
  id: string | null;
  idDesign: string | null;
  titolo: string;
  tipo: TipoKitAvanzamento;
  stato: StatoKitMateriali;
  area: Riferimento;
  canale: Riferimento;
  /** File del kit, senza quelli dell'export CORREGGO; 0 per un kit non avviato. */
  numeroFile: number;
  /** File la cui ultima versione è accettata o pubblicata. */
  fileAccettati: number;
  /** File la cui ultima versione è in errore. */
  fileInErrore: number;
  /** Data (YYYY-MM-DD, ora italiana) in cui il kit è stato avviato; null se non avviato. */
  avviatoIl: string | null;
}

export interface PromoAvanzamento {
  id: string;
  nome: string;
  stato: STATO_PROMO;
  validitaDal: string | null;
  validitaAl: string | null;
  /** Scadenza della lavorazione (YYYY-MM-DD, ora italiana), se la promo ne ha una. */
  scadenzaLavorazione: string | null;
  /** Giorni da oggi (ora italiana) alla scadenza della lavorazione: negativi se passata. */
  giorniAllaScadenza: number | null;
  kit: KitAvanzamento[];
  /** False se Istanta non ha risposto: i kit non avviati della promo non sono nell'elenco. */
  nonAvviatiDisponibili: boolean;
}

export interface AvanzamentoProduzione {
  /** Dalla scadenza della lavorazione più vicina (in ritardo per prime); senza scadenza in fondo. */
  promozioni: PromoAvanzamento[];
}
