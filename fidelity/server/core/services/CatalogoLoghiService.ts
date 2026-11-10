import type { Request } from 'express';
import config from '../config';
import type { ICatalogoLoghiService, LogoDelCatalogo } from '../interfaces/ICatalogoLoghiService';
import { log } from '../logger';
import { ServerUtils } from '../utils/ServerUtils';
import { verificaRisposta } from '../utils/rispostaServizi';
import { LARGHEZZA_LOGO_PREDEFINITA, urlImmagineLogo } from '../utils/lineeDistributore';

export { LARGHEZZA_LOGO_PREDEFINITA, urlImmagineLogo };

/**
 * Il catalogo dei loghi e bolli del cliente (Istanta, FicoProcess/getLoghiBolli) per le linee del
 * distributore negli insight del volantino e nelle Impostazioni GDO.
 *
 * Istanta risponde solo con il passaporto Olimpo di un utente: il catalogo si legge con la richiesta
 * di chi apre la pagina (ServerUtils.sendToFICOApi, lettura idempotente) e si tiene un'ora in Redis
 * e in memoria, cosi' le richieste senza utente (e i worker senza Redis) lo trovano gia' letto. Senza
 * richiesta e senza cache il catalogo e' vuoto. Un errore di Istanta lascia il catalogo vuoto, con un
 * avviso nel log, e per un minuto non si riprova: le linee escono senza logo, mai un errore.
 */

const ENDPOINT = '/FicoProcess/getLoghiBolli';
const CHIAVE_CACHE = 'istanta:catalogo-loghi-bolli';
const DURATA_CACHE_SECONDI = 3600;
const PAUSA_DOPO_ERRORE_MS = 60_000;

type RispostaLoghiBolli = {
  esito?: boolean;
  content?: Array<{ sigla?: unknown; guidId?: unknown; tipo?: unknown; escluso?: unknown }>;
};

/** Le voci del catalogo per sigla in minuscolo; senza sigla o guidId, o escluse, non contano. */
export function vociDelCatalogo(risposta: RispostaLoghiBolli | null | undefined): LogoDelCatalogo[] {
  const voci = Array.isArray(risposta?.content) ? risposta.content : [];
  const perSigla = new Map<string, LogoDelCatalogo>();
  for (const voce of voci) {
    if (!voce || voce.escluso === true) continue;
    const sigla = typeof voce.sigla === 'string' ? voce.sigla.trim() : '';
    const guidId = typeof voce.guidId === 'string' ? voce.guidId.trim() : '';
    if (sigla === '' || guidId === '') continue;
    const chiave = sigla.toLowerCase();
    if (!perSigla.has(chiave)) perSigla.set(chiave, { sigla, guidId, tipo: typeof voce.tipo === 'number' ? voce.tipo : null });
  }
  return [...perSigla.values()];
}


/** Le operazioni di cache (cache.service): qui per poterle sostituire nei test. */
export interface CacheCatalogo {
  get<T>(chiave: string): Promise<T | null>;
  set(chiave: string, valore: unknown, ttlSecondi?: number): Promise<void>;
}

const CACHE_REDIS: CacheCatalogo = {
  get: async <T>(chiave: string) => (await import('../../src/shared/cache/cache.service.js')).get<T>(chiave),
  set: async (chiave, valore, ttlSecondi) => (await import('../../src/shared/cache/cache.service.js')).set(chiave, valore, ttlSecondi),
};

/** La lettura da Istanta con la richiesta dell'utente: qui per poterla sostituire nei test. */
export type LettoreCatalogo = (richiesta: Request) => Promise<RispostaLoghiBolli>;

const LETTORE_ISTANTA: LettoreCatalogo = async (richiesta) => verificaRisposta<RispostaLoghiBolli>(
  await ServerUtils.sendToFICOApi<RispostaLoghiBolli>(
    richiesta,
    `${config.ISTANTA_IP_ADDRESS}${ENDPOINT}`,
    'GET',
    {},
    undefined,
    undefined,
    { categoria: 'lettura', idempotente: true },
  ),
  'ISTANTA',
  ENDPOINT,
);

const messaggio = (errore: unknown): string => (errore instanceof Error ? errore.message : String(errore));

export class CatalogoLoghiService implements ICatalogoLoghiService {
  private inMemoria: { voci: LogoDelCatalogo[]; scade: number } | null = null;
  private pausaFinoA = 0;
  private inVolo: Promise<LogoDelCatalogo[] | null> | null = null;

  constructor(
    private readonly leggi: LettoreCatalogo = LETTORE_ISTANTA,
    private readonly cache: CacheCatalogo = CACHE_REDIS,
    private readonly adesso: () => number = () => Date.now(),
  ) {}

  async catalogo(richiesta?: Request): Promise<Map<string, LogoDelCatalogo>> {
    const voci = await this.voci(richiesta);
    return new Map(voci.map(voce => [voce.sigla.toLowerCase(), voce] as const));
  }

  async urlLogo(sigla: string, larghezza = LARGHEZZA_LOGO_PREDEFINITA, richiesta?: Request): Promise<string | null> {
    const voce = (await this.catalogo(richiesta)).get(sigla.trim().toLowerCase());
    return voce ? urlImmagineLogo(voce.guidId, larghezza) : null;
  }

  private async voci(richiesta?: Request): Promise<LogoDelCatalogo[]> {
    if (this.inMemoria && this.inMemoria.scade > this.adesso()) return this.inMemoria.voci;

    const dallaCache = await this.cache.get<LogoDelCatalogo[]>(CHIAVE_CACHE).catch(() => null);
    if (Array.isArray(dallaCache)) {
      this.ricorda(dallaCache);
      return dallaCache;
    }

    const conUtente = !!richiesta && (!!richiesta.session?.id_utente || !!richiesta.headers?.authorization);
    if (!richiesta || !conUtente || this.adesso() < this.pausaFinoA) return [];
    // Piu' richieste insieme: una sola lettura da Istanta
    this.inVolo ??= this.daIstanta(richiesta).finally(() => {
      this.inVolo = null;
    });
    return (await this.inVolo) ?? [];
  }

  private async daIstanta(richiesta: Request): Promise<LogoDelCatalogo[] | null> {
    try {
      const voci = vociDelCatalogo(await this.leggi(richiesta));
      this.ricorda(voci);
      await this.cache.set(CHIAVE_CACHE, voci, DURATA_CACHE_SECONDI).catch(() => undefined);
      return voci;
    } catch (errore) {
      this.pausaFinoA = this.adesso() + PAUSA_DOPO_ERRORE_MS;
      log.warn('Catalogo loghi e bolli di Istanta non disponibile: linee e bolli senza logo', { motivo: messaggio(errore) });
      return null;
    }
  }

  private ricorda(voci: LogoDelCatalogo[]): void {
    this.inMemoria = { voci, scade: this.adesso() + DURATA_CACHE_SECONDI * 1000 };
  }
}
