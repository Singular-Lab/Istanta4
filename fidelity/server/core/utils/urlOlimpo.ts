/**
 * URL dei materiali Olimpo da mostrare nel browser.
 *
 * Il browser non raggiunge Olimpo direttamente (in Docker OLYMPUS_IP_ADDRESS e' un
 * nome interno): passa dal proxy di Fidelity montato su PREFISSO_PROXY_OLIMPO, che
 * inoltra solo le letture elencate qui. Gli URL salvati nel DB sono quindi relativi
 * all'origine di Fidelity e non dipendono dall'indirizzo di Olimpo.
 */
export const PREFISSO_PROXY_OLIMPO = '/olimpo';

/** Endpoint di sola lettura di Olimpo che il proxy inoltra. */
export const PERCORSI_OLIMPO_LETTURA = [
  '/foto/getThumbNailOnDemand',
  '/materiali/getThumbnailMaterialePdfs',
  '/materiali/getMaterialePDF',
  '/materiali/getMaterialeSVG',
  '/materiali/getVideoOnDemand',
] as const;

export type PercorsoOlimpoLettura = (typeof PERCORSI_OLIMPO_LETTURA)[number];

/** URL relativo, servito dal proxy, di un endpoint di lettura di Olimpo. */
export function urlOlimpo(
  percorso: PercorsoOlimpoLettura,
  parametri: Record<string, string | number | boolean | undefined>
): string {
  const query = new URLSearchParams();
  for (const [chiave, valore] of Object.entries(parametri)) {
    if (valore !== undefined) query.set(chiave, String(valore));
  }
  return `${PREFISSO_PROXY_OLIMPO}${percorso}?${query.toString()}`;
}

/**
 * Converte un URL assoluto di Olimpo, con qualunque host, nella forma relativa servita
 * dal proxy. L'endpoint puo' essere preceduto da un percorso, quando Olimpo sta dietro
 * un gateway (OLYMPUS_IP_ADDRESS=http://host:4000/olimpo). Restituisce null per URL che
 * non puntano a una lettura di Olimpo, e l'URL invariato se e' gia' relativo al proxy.
 */
export function inUrlOlimpoRelativo(url: string): string | null {
  if (url.startsWith(`${PREFISSO_PROXY_OLIMPO}/`)) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  // Ogni percorso inizia con '/': endsWith confronta segmenti interi
  const percorso = PERCORSI_OLIMPO_LETTURA.find(p => parsed.pathname.endsWith(p));
  if (!percorso) return null;
  return `${PREFISSO_PROXY_OLIMPO}${percorso}${parsed.search}`;
}

/**
 * Riscrive in forma relativa tutti gli URL assoluti di lettura Olimpo contenuti in un
 * valore JSON (stringhe, array e oggetti annidati). Usata dalla migrazione dei dati gia'
 * salvati: restituisce il valore aggiornato e quante stringhe sono cambiate.
 */
export function riscriviUrlOlimpo<T>(valore: T): { valore: T; modifiche: number } {
  let modifiche = 0;
  const visita = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const relativo = inUrlOlimpoRelativo(v);
      if (relativo !== null && relativo !== v) {
        modifiche++;
        return relativo;
      }
      return v;
    }
    if (Array.isArray(v)) return v.map(visita);
    if (v !== null && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, visita(x)]));
    }
    return v;
  };
  const risultato = visita(valore) as T;
  return { valore: modifiche > 0 ? risultato : valore, modifiche };
}

/**
 * URL assoluto, servito dal proxy di Fidelity, per chi sta fuori da Fidelity:
 * widget incorporati in siti di terzi, client delle API esterne, webhook.
 * baseFidelity e' l'indirizzo pubblico di Fidelity (config.CLIENT_URL); un suo
 * eventuale percorso viene conservato.
 */
export function urlOlimpoPubblico(
  baseFidelity: string,
  percorso: PercorsoOlimpoLettura,
  parametri: Record<string, string | number | boolean | undefined>
): string {
  return `${baseFidelity.replace(/\/+$/, '')}${urlOlimpo(percorso, parametri)}`;
}

/** true se il valore e' un URL di Olimpo, assoluto o gia' relativo al proxy. */
export function isUrlOlimpo(valore: unknown): valore is string {
  return typeof valore === 'string'
    && (valore.startsWith(`${PREFISSO_PROXY_OLIMPO}/`) || /^https?:\/\//i.test(valore));
}

/**
 * Riporta al GUID un riferimento Olimpo che il frontend rimanda indietro come URL
 * (assoluto o /olimpo/...), leggendo guidId o id dalla query. Un valore che non e'
 * un URL e' gia' un GUID e torna invariato.
 */
export function guidDaRiferimentoOlimpo(valore: string): string {
  if (!isUrlOlimpo(valore) || inUrlOlimpoRelativo(valore) === null) return valore;
  try {
    const url = new URL(valore, 'http://fidelity.invalid');
    return url.searchParams.get('guidId') ?? url.searchParams.get('id') ?? valore;
  } catch {
    return valore;
  }
}

/**
 * URL della miniatura di una foto Olimpo a partire da un riferimento salvato, che puo'
 * essere un GUID o un URL Olimpo (anche legacy, con l'indirizzo interno). Un URL che
 * non e' di Olimpo (immagine esterna) torna invariato. Con baseFidelity l'URL e'
 * assoluto pubblico, per chi sta fuori da Fidelity.
 */
export function urlFotoOlimpo(
  riferimento: string,
  opzioni: { performante?: boolean; baseFidelity?: string } = {}
): string {
  if (isUrlOlimpo(riferimento) && inUrlOlimpoRelativo(riferimento) === null) return riferimento;
  const parametri = { guidId: guidDaRiferimentoOlimpo(riferimento), performante: opzioni.performante || undefined };
  return opzioni.baseFidelity
    ? urlOlimpoPubblico(opzioni.baseFidelity, '/foto/getThumbNailOnDemand', parametri)
    : urlOlimpo('/foto/getThumbNailOnDemand', parametri);
}
