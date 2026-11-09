import type { ConfrontiVolantino, DifferenzeVarianti, ViaggioProdotto } from '../../../lib/insightVolantino/tipi';
import type { AmbitoGdo } from '../accessi/contestoAccesso';

/**
 * Confronti degli insight del volantino (contratto in lib/insightVolantino/tipi.ts). Tutti limitati
 * all'ambito GDO della sessione: un kit di un'altra GDO risponde come inesistente (404).
 */
export interface IInsightConfrontiService {
  /** Edizione precedente della stessa area e canale (null per la prima) e varianti della stessa promo. */
  confronti(idKit: string, ambito: AmbitoGdo): Promise<ConfrontiVolantino>;
  /** Differenze con un'altra variante della stessa promo; 400 se idAltra non lo e'. */
  differenzeVarianti(idKit: string, idAltra: string, ambito: AmbitoGdo): Promise<DifferenzeVarianti>;
  /** I volantini della GDO in cui compare il prodotto, dal piu' recente. */
  viaggioProdotto(idKit: string, chiave: string, ambito: AmbitoGdo): Promise<ViaggioProdotto>;
}
