import type { Request } from 'express';
import config from '../config/index';
import { log } from '../logger';
import { verificaRisposta } from './rispostaServizi';
import { ServerUtils } from './ServerUtils';

/** Header con cui il server avvisa il client che una scrittura e rimasta solo in FP. */
export const HEADER_DISSINCRONIA = 'X-Istanta-Dissincronia';

// In sviluppo Istanta spesso non c'e: inutile aspettare il timeout di produzione (10 minuti)
export const TIMEOUT_SVILUPPO_MS = 10_000;

export type EsitoScritturaIstanta = { sincronizzato: boolean };

/**
 * Scrive su Istanta (salvataggi ed eliminazioni di PV, canali, aree e combinazioni).
 * Se Istanta rifiuta lancia ExternalApiError come verificaRisposta. Solo in development, se
 * Istanta non risponde affatto (rete o timeout, status 0), l'operazione prosegue in FP: il
 * server lo scrive nel log e lo segnala al client con HEADER_DISSINCRONIA.
 */
export async function scriviSuIstanta(
  req: Request,
  endpoint: string,
  method: 'PUT' | 'DELETE' | 'POST',
  data: unknown,
  ambiente: string = config.NODE_ENV
): Promise<EsitoScritturaIstanta> {
  const sviluppo = ambiente === 'development';
  // Senza il GUID finale: e il nome dell'operazione, per log e messaggi
  const percorso = endpoint.split('/').slice(0, 3).join('/');
  const risposta = await ServerUtils.sendToFICOApi<{ esito: boolean; error: string }>(
    req,
    config.ISTANTA_IP_ADDRESS + endpoint,
    method,
    data,
    undefined,
    sviluppo ? TIMEOUT_SVILUPPO_MS : undefined,
    { categoria: 'scrittura' }
  );
  if (sviluppo && risposta.status === 0) {
    log.warn('Istanta non raggiungibile: operazione salvata solo in FP', { endpoint: percorso, motivo: risposta.motivo ?? risposta.statusText });
    if (!req.res?.headersSent) req.res?.setHeader(HEADER_DISSINCRONIA, percorso);
    return { sincronizzato: false };
  }
  verificaRisposta(risposta, 'ISTANTA', percorso);
  return { sincronizzato: true };
}
