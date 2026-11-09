import type {
  PrevisioneVolantino,
  RendimentoVolantino,
  RichiestaSimulazione,
  SimulazioneProdotto,
} from '../../../lib/insightVolantino/rendimento';
import type { AmbitoGdo } from '../accessi/contestoAccesso';

/**
 * Rendimento dalle vendite, previsione e simulazione del volantino (contratto in
 * lib/insightVolantino/rendimento.ts). Limitati all'ambito GDO della sessione: un kit di un'altra
 * GDO, o un id che non e' un UUID, risponde come inesistente (NotFoundError, 404).
 * Le regole (pesi di visibilita', regole di previsione) vengono dalla libreria agenzia del cliente.
 */
export interface IInsightVenditeService {
  /** null quando nessuna vendita importata cade nel periodo di validita' della promo. */
  rendimento(idKit: string, ambito: AmbitoGdo): Promise<RendimentoVolantino | null>;
  /** null quando il volantino non ha box con geometria. */
  previsione(idKit: string, ambito: AmbitoGdo): Promise<PrevisioneVolantino | null>;
  /** 400 (ValidationError) con una richiesta non valida. */
  simula(idKit: string, richiesta: RichiestaSimulazione, ambito: AmbitoGdo): Promise<SimulazioneProdotto>;
}
