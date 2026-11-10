import type { ConfrontoEdizione, ViaggioProdotto } from '../../../lib/insightVolantino/tipi';
import type { AmbitoGdo } from '../accessi/contestoAccesso';

/**
 * Confronti degli insight del volantino (contratto in lib/insightVolantino/tipi.ts). Tutti limitati
 * all'ambito GDO della sessione: un kit di un'altra GDO risponde come inesistente (404). La pagina
 * degli insight non confronta il volantino con altri: l'edizione precedente serve al report PDF.
 */
export interface IInsightConfrontiService {
  /** Il confronto con l'edizione precedente della stessa area e canale (report PDF); null per la prima. */
  edizionePrecedente(idKit: string, ambito: AmbitoGdo): Promise<ConfrontoEdizione | null>;
  /** I volantini della GDO in cui compare il prodotto, dal piu' recente. */
  viaggioProdotto(idKit: string, chiave: string, ambito: AmbitoGdo): Promise<ViaggioProdotto>;
}
