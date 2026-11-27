import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type Redis from 'ioredis';
import { getRedisClient } from '../../src/shared/cache/redis.client';
import { log } from '../logger';

/**
 * Una richiesta di scrittura ripetuta (doppio click, invio ripetuto, nuovo tentativo del client) si
 * esegue una volta sola e tutte le copie ricevono l'esito della prima (spec interfaccia-operatore,
 * "Richieste di creazione, modifica ed eliminazione ripetute").
 *
 * Il client manda `Idempotency-Key`. La chiave vale per utente, metodo, percorso e contenuto: la stessa
 * chiave di un altro utente, o con un altro contenuto, e' un'altra richiesta. Una copia che arriva
 * mentre la prima e' in corso aspetta e riceve la stessa risposta; una copia che arriva dopo, entro
 * TTL, riceve quella salvata. Si salvano solo le risposte di successo (2xx): dopo un errore il nuovo
 * tentativo e' eseguito. Le risposte grandi o che non sono testo (file) non si salvano.
 */

export const TTL_IDEMPOTENZA_SECONDI = 10 * 60;
export const MASSIMO_RISPOSTA_SALVATA_BYTE = 256 * 1024;
const ATTESA_MASSIMA_MS = 30_000;
const CHIAVE_VALIDA = /^[A-Za-z0-9_-]{8,100}$/;
const METODI = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface RispostaSalvata {
  stato: number;
  tipo: string;
  corpo: string;
}

/** Dove si tengono le risposte salvate. */
export interface DepositoIdempotenza {
  leggi(chiave: string): Promise<RispostaSalvata | null>;
  salva(chiave: string, risposta: RispostaSalvata, ttlSecondi: number): Promise<void>;
}

export class DepositoInMemoria implements DepositoIdempotenza {
  private readonly voci = new Map<string, { risposta: RispostaSalvata; scade: number }>();
  constructor(private readonly adesso: () => number = Date.now, private readonly massimo = 2000) {}

  async leggi(chiave: string): Promise<RispostaSalvata | null> {
    const voce = this.voci.get(chiave);
    if (!voce) return null;
    if (voce.scade <= this.adesso()) {
      this.voci.delete(chiave);
      return null;
    }
    return voce.risposta;
  }

  async salva(chiave: string, risposta: RispostaSalvata, ttlSecondi: number): Promise<void> {
    if (this.voci.size >= this.massimo) {
      const ora = this.adesso();
      for (const [k, v] of this.voci) if (v.scade <= ora) this.voci.delete(k);
      if (this.voci.size >= this.massimo) this.voci.delete(this.voci.keys().next().value as string);
    }
    this.voci.set(chiave, { risposta, scade: this.adesso() + ttlSecondi * 1000 });
  }
}

export class DepositoRedis implements DepositoIdempotenza {
  constructor(private readonly redis: Redis, private readonly prefisso = 'idem:') {}

  async leggi(chiave: string): Promise<RispostaSalvata | null> {
    const testo = await this.redis.get(this.prefisso + chiave);
    if (!testo) return null;
    try {
      return JSON.parse(testo) as RispostaSalvata;
    } catch {
      return null;
    }
  }

  async salva(chiave: string, risposta: RispostaSalvata, ttlSecondi: number): Promise<void> {
    await this.redis.set(this.prefisso + chiave, JSON.stringify(risposta), 'EX', ttlSecondi);
  }
}

/** Redis se c'e' e risponde, altrimenti la memoria del processo: un Redis che cade non ferma le scritture. */
class DepositoPredefinito implements DepositoIdempotenza {
  private readonly memoria = new DepositoInMemoria();

  async leggi(chiave: string): Promise<RispostaSalvata | null> {
    const redis = getRedisClient();
    if (redis) {
      try {
        const salvata = await new DepositoRedis(redis).leggi(chiave);
        if (salvata) return salvata;
      } catch (errore) {
        log.warn('Idempotenza: lettura da Redis non riuscita, uso la memoria', { errore: (errore as Error).message });
      }
    }
    return this.memoria.leggi(chiave);
  }

  async salva(chiave: string, risposta: RispostaSalvata, ttlSecondi: number): Promise<void> {
    await this.memoria.salva(chiave, risposta, ttlSecondi);
    const redis = getRedisClient();
    if (!redis) return;
    try {
      await new DepositoRedis(redis).salva(chiave, risposta, ttlSecondi);
    } catch (errore) {
      log.warn('Idempotenza: salvataggio su Redis non riuscito, resta in memoria', { errore: (errore as Error).message });
    }
  }
}

/** La chiave completa: utente (o indirizzo, senza sessione), metodo, percorso, contenuto e chiave del client. */
export function chiaveIdempotenza(req: Request, chiaveClient: string): string {
  const chi = req.session?.id_utente ?? `ip:${req.ip ?? ''}`;
  const contenuto = createHash('sha256').update(JSON.stringify(req.body ?? null)).digest('hex').slice(0, 32);
  return createHash('sha256').update(`${chi}|${req.method}|${(req.originalUrl ?? req.url).split('?')[0]}|${contenuto}|${chiaveClient}`).digest('hex');
}

const attendi = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export function idempotenza(deposito: DepositoIdempotenza = new DepositoPredefinito()) {
  // Le richieste in corso in questo processo: chi arriva con la stessa chiave aspetta la prima
  const inCorso = new Map<string, Promise<void>>();

  const rispondi = (res: Response, salvata: RispostaSalvata): void => {
    res.status(salvata.stato);
    res.setHeader('Idempotent-Replay', 'true');
    if (salvata.tipo) res.setHeader('Content-Type', salvata.tipo);
    res.send(salvata.corpo);
  };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const chiaveClient = req.get('idempotency-key');
    if (!METODI.has(req.method) || !chiaveClient || !CHIAVE_VALIDA.test(chiaveClient)) {
      next();
      return;
    }

    let chiave: string;
    try {
      chiave = chiaveIdempotenza(req, chiaveClient);
    } catch (errore) {
      log.warn('Idempotenza non applicata: chiave non calcolabile', { errore: (errore as Error).message });
      next();
      return;
    }

    // Una copia arrivata mentre la prima e' in corso: aspetta che finisca, poi risponde come lei. Il
    // controllo e' prima di ogni attesa, cosi' due copie arrivate insieme non passano entrambe
    const precedente = inCorso.get(chiave);
    if (precedente !== undefined) {
      await Promise.race([precedente, attendi(ATTESA_MASSIMA_MS)]);
      const salvata = await deposito.leggi(chiave).catch(() => null);
      if (salvata) {
        rispondi(res, salvata);
        return;
      }
      // La prima e' finita senza un esito da salvare (un errore): questa e' un nuovo tentativo
      if (inCorso.has(chiave)) {
        // Un'altra copia lo sta gia' ritentando: aspetta anche lei
        await Promise.race([inCorso.get(chiave) as Promise<void>, attendi(ATTESA_MASSIMA_MS)]);
        const dopo = await deposito.leggi(chiave).catch(() => null);
        if (dopo) {
          rispondi(res, dopo);
          return;
        }
      }
    }

    let finita!: () => void;
    inCorso.set(chiave, new Promise<void>(resolve => { finita = resolve; }));
    let rilasciata = false;
    const rilascia = () => {
      if (rilasciata) return;
      rilasciata = true;
      if (inCorso.get(chiave) !== undefined) inCorso.delete(chiave);
      finita();
    };

    // Una risposta salvata da un'altra richiesta (un altro processo, o arrivata mentre si controllava)
    try {
      const salvata = await deposito.leggi(chiave);
      if (salvata) {
        rilascia();
        rispondi(res, salvata);
        return;
      }
    } catch (errore) {
      log.warn('Idempotenza: lettura non riuscita, la richiesta si esegue', { errore: (errore as Error).message });
    }

    // Cattura la risposta per salvarla se e' di successo
    const pezzi: Buffer[] = [];
    let dimensione = 0;
    let troppoGrande = false;
    const scriviOriginale = res.write.bind(res) as (...argomenti: unknown[]) => boolean;
    const terminaOriginale = res.end.bind(res) as (...argomenti: unknown[]) => Response;
    const raccogli = (pezzo: unknown, codifica?: unknown): void => {
      if (pezzo === undefined || pezzo === null || typeof pezzo === 'function') return;
      const buffer = Buffer.isBuffer(pezzo)
        ? pezzo
        : Buffer.from(String(pezzo), typeof codifica === 'string' ? (codifica as BufferEncoding) : 'utf8');
      dimensione += buffer.length;
      if (dimensione > MASSIMO_RISPOSTA_SALVATA_BYTE) {
        troppoGrande = true;
        pezzi.length = 0;
      } else if (!troppoGrande) {
        pezzi.push(buffer);
      }
    };
    res.write = ((pezzo: unknown, ...resto: unknown[]) => { raccogli(pezzo, resto[0]); return scriviOriginale(pezzo, ...resto); }) as typeof res.write;
    res.end = ((pezzo?: unknown, ...resto: unknown[]) => { raccogli(pezzo, resto[0]); return terminaOriginale(pezzo, ...resto); }) as typeof res.end;

    const concludi = () => {
      void (async () => {
        try {
          const tipo = String(res.getHeader('content-type') ?? '');
          const testuale = /json|text/i.test(tipo);
          const esito = res.statusCode >= 200 && res.statusCode < 300;
          if (res.writableFinished && esito && testuale && !troppoGrande && !res.getHeader('content-disposition')) {
            await deposito.salva(chiave, { stato: res.statusCode, tipo, corpo: Buffer.concat(pezzi).toString('utf8') }, TTL_IDEMPOTENZA_SECONDI);
          }
        } catch (errore) {
          log.warn('Idempotenza: risposta non salvata', { errore: (errore as Error).message });
        } finally {
          rilascia();
        }
      })();
    };
    res.once('finish', concludi);
    // Connessione chiusa prima della fine: niente da salvare, ma la chiave si libera
    res.once('close', () => { if (!res.writableFinished) rilascia(); });

    next();
  };
}
