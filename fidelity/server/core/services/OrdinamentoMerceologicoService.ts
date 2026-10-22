import { Request } from 'express';
import {
  LIVELLI_MERCEOLOGICI,
  ORDINAMENTO_MERCEOLOGICO_VUOTO,
  ordinaPerMerceologia,
  type OrdinamentoMerceologico,
  type VoceOrdinamentoMerceologico,
} from '../../../lib/ordinamentoMerceologico';
import config from '../config';
import { log } from '../logger';
import { ServerUtils } from '../utils/ServerUtils';
import { verificaRisposta } from '../utils/rispostaServizi';

const ENDPOINT = '/FicoProcess/getOrdinamentoMerceologico';
const CHIAVE_CACHE = 'istanta:ordinamento-merceologico';
// L'ordinamento cambia solo quando lo si modifica nelle impostazioni del menabò di Istanta
const DURATA_CACHE_SECONDI = 300;

type RispostaIstanta = {
  universale?: boolean;
  campi?: Partial<Record<string, string>>;
  voci?: Partial<VoceOrdinamentoMerceologico>[];
  esito?: boolean;
  error?: string;
};

/** Riduce la risposta di Istanta alla forma attesa, scartando ciò che non serve o non è valido. */
export function normalizzaOrdinamento(data: RispostaIstanta | null | undefined): OrdinamentoMerceologico {
  if (!data || data.universale !== true || !Array.isArray(data.voci)) return ORDINAMENTO_MERCEOLOGICO_VUOTO;
  const campi = { ...ORDINAMENTO_MERCEOLOGICO_VUOTO.campi };
  for (const livello of LIVELLI_MERCEOLOGICI) {
    const campo = data.campi?.[livello];
    campi[livello] = typeof campo === 'string' ? campo : '';
  }
  const voci = data.voci
    .filter(voce => voce && typeof voce.orderIndex === 'number' && Number.isFinite(voce.orderIndex))
    .map(voce => ({
      area: String(voce.area ?? ''),
      settore: String(voce.settore ?? ''),
      reparto: String(voce.reparto ?? ''),
      categoria: String(voce.categoria ?? ''),
      orderIndex: voce.orderIndex as number,
    }))
    .sort((a, b) => a.orderIndex - b.orderIndex);
  return { universale: true, campi, voci };
}

export class OrdinamentoMerceologicoService {
  /**
   * Ordinamento merceologico del cliente letto da Istanta. Se Istanta non risponde o lo rifiuta
   * restituisce l'ordinamento vuoto: le referenze restano nell'ordine ricevuto e la pagina
   * che le mostra non si blocca.
   */
  async getOrdinamento(req: Request): Promise<OrdinamentoMerceologico> {
    const leggiDaIstanta = async (): Promise<OrdinamentoMerceologico> => {
      const data = verificaRisposta<RispostaIstanta>(
        await ServerUtils.sendToFICOApi<RispostaIstanta>(req, `${config.ISTANTA_IP_ADDRESS}${ENDPOINT}`, 'GET', {}),
        'ISTANTA',
        ENDPOINT,
      );
      return normalizzaOrdinamento(data);
    };

    try {
      const { remember } = await import('../../src/shared/cache/cache.service.js');
      return await remember(CHIAVE_CACHE, DURATA_CACHE_SECONDI, leggiDaIstanta);
    } catch (error) {
      log.warn('Ordinamento merceologico non disponibile: referenze nell\'ordine ricevuto', {
        motivo: error instanceof Error ? error.message : String(error),
      });
      return ORDINAMENTO_MERCEOLOGICO_VUOTO;
    }
  }

  /** I record nell'ordine merceologico del cliente, o nell'ordine ricevuto se non è disponibile. */
  async ordina<T extends Record<string, unknown>>(req: Request, records: readonly T[]): Promise<T[]> {
    return ordinaPerMerceologia(records, await this.getOrdinamento(req));
  }
}
