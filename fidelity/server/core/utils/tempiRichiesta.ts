import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * I tempi delle fasi di una richiesta (query, calcolo degli insight, cache), per vedere dove va il
 * tempo senza strumenti esterni: finiscono nell'intestazione Server-Timing (la mostrano gli
 * strumenti del browser, scheda Rete) e, sopra una soglia, in un avviso nel log.
 *
 * `misura` si puo' chiamare ovunque: fuori da una richiesta misurata esegue il lavoro e basta.
 */

export interface VoceTempo {
  nome: string;
  ms: number;
}

interface Registro {
  voci: VoceTempo[];
}

const contesto = new AsyncLocalStorage<Registro>();

/** Soglia sopra cui una richiesta misurata finisce nel log come lenta (FIDELITY_SOGLIA_RICHIESTA_LENTA_MS). */
export function sogliaRichiestaLentaMs(): number {
  const valore = Number(process.env.FIDELITY_SOGLIA_RICHIESTA_LENTA_MS);
  return Number.isFinite(valore) && valore > 0 ? valore : 1000;
}

const arrotonda = (ms: number): number => Math.round(ms * 10) / 10;

/** Esegue `lavoro` e, dentro una richiesta misurata, ne registra il tempo con questo nome. */
export async function misura<T>(nome: string, lavoro: () => Promise<T>): Promise<T> {
  const registro = contesto.getStore();
  if (!registro) return lavoro();
  const inizio = performance.now();
  try {
    return await lavoro();
  } finally {
    registro.voci.push({ nome, ms: arrotonda(performance.now() - inizio) });
  }
}

/** Esegue `lavoro` raccogliendo i tempi delle fasi misurate; restituisce anche il totale. */
export async function eseguiMisurando<T>(lavoro: () => Promise<T>): Promise<{ valore: T; voci: VoceTempo[]; totaleMs: number }> {
  const registro: Registro = { voci: [] };
  const inizio = performance.now();
  let valore: T | undefined;
  let errore: unknown;
  let fallito = false;
  await contesto.run(registro, async () => {
    try {
      valore = await lavoro();
    } catch (e) {
      fallito = true;
      errore = e;
    }
  });
  const totaleMs = arrotonda(performance.now() - inizio);
  if (fallito) throw errore;
  return { valore: valore as T, voci: registro.voci, totaleMs };
}

/** Nomi ammessi da Server-Timing: lettere, cifre e pochi segni. */
const nomeServerTiming = (nome: string): string => nome.replace(/[^A-Za-z0-9_.-]/g, '_');

/** Il valore dell'intestazione Server-Timing: ogni fase con la sua durata e il totale. */
export function intestazioneServerTiming(voci: readonly VoceTempo[], totaleMs: number): string {
  return [...voci.map(({ nome, ms }) => `${nomeServerTiming(nome)};dur=${ms}`), `totale;dur=${totaleMs}`].join(', ');
}
