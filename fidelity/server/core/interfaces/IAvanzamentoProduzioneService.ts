import type { Request } from 'express';
import type { AvanzamentoProduzione } from '../../../lib/produzione/avanzamento';

/**
 * Pagina Avanzamento produzione (contratto in lib/produzione/avanzamento.ts). La richiesta serve
 * solo per chiedere a Istanta i kit non ancora avviati delle promo.
 */
export interface IAvanzamentoProduzioneService {
  /** Promo in corso della GDO indicata (tutte con null), con i loro kit volantino e POP. */
  getAvanzamento(idGdo: string | null, req: Request): Promise<AvanzamentoProduzione>;
}
