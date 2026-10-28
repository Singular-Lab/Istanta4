import config from '../config';
import { chiamaHttp, ErroreHttp } from './clienteHttp';

/**
 * Chiamate dirette a Olimpo che non passano dal passaporto dell'utente (ServerUtils):
 * upload con la chiave gia' in mano a chi chiama e scaricamento dei PDF dei materiali.
 * Tutte con il tempo massimo delle chiamate lunghe del client comune.
 */

/** Olimpo ha risposto, ma con uno stato di errore. */
export class ErroreRispostaOlimpo extends Error {
  constructor(readonly percorso: string, readonly status: number) {
    super(`Olimpo ha risposto HTTP ${status} a ${percorso}`);
    this.name = 'ErroreRispostaOlimpo';
  }
}

/**
 * Upload multipart verso Olimpo. Come l'axios.post che sostituisce restituisce { data } con il
 * JSON della risposta e lancia se Olimpo risponde con uno stato di errore o non risponde.
 */
export async function inviaFormDataAOlimpo<T>(
  percorso: string,
  formData: FormData,
  authorization?: string | null,
): Promise<{ data: T; status: number }> {
  const risposta = await chiamaHttp(`${config.OLYMPUS_IP_ADDRESS}${percorso}`, {
    method: 'POST',
    body: formData,
    categoria: 'lunga',
    // Un Authorization assente non deve partire come "undefined"
    headers: authorization ? { Authorization: authorization } : undefined,
  });
  if (!risposta.ok) {
    await risposta.body?.cancel().catch(() => undefined);
    throw new ErroreRispostaOlimpo(percorso, risposta.status);
  }
  return { data: (await risposta.json()) as T, status: risposta.status };
}

/** PDF di un materiale di Olimpo, letto per intero. Lettura ripetibile. */
export async function scaricaMaterialePdf(idOlimpo: string): Promise<Buffer> {
  const percorso = '/materiali/getMaterialePDF';
  const risposta = await chiamaHttp(`${config.OLYMPUS_IP_ADDRESS}${percorso}?id=${encodeURIComponent(idOlimpo)}`, {
    categoria: 'lunga',
    idempotente: true,
  });
  if (!risposta.ok) {
    await risposta.body?.cancel().catch(() => undefined);
    throw new ErroreRispostaOlimpo(percorso, risposta.status);
  }
  return Buffer.from(await risposta.arrayBuffer());
}

/** Motivo leggibile per l'operatore, senza dettagli tecnici, di un file non scaricato. */
export function motivoFileNonScaricato(errore: unknown): string {
  if (errore instanceof ErroreHttp) {
    return errore.motivo === 'timeout' ? 'Olimpo non ha risposto in tempo' : 'Olimpo non raggiungibile';
  }
  if (errore instanceof ErroreRispostaOlimpo) {
    return errore.status === 404 ? 'file non trovato su Olimpo' : 'Olimpo ha risposto con un errore';
  }
  return 'errore durante lo scaricamento';
}
