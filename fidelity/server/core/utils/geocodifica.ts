import { numeroWorkerHttp } from '../cluster';
import type { PrecisionePosizione } from '../../../lib/puntiVendita/analisi';
import type { IndirizzoTrovatoDTO } from '../dto';
import { log } from '../logger';

/**
 * La policy d'uso di Nominatim (OpenStreetMap) ammette al massimo una richiesta al
 * secondo: le chiamate passano da una coda e partono distanziate, anche quando arrivano
 * da sync concorrenti. Il timeout evita che un Nominatim lento tenga ferma la
 * sincronizzazione del plugin o la registrazione di un utente.
 */
export const INTERVALLO_MS = 1200;
const TIMEOUT_MS = 5000;

// ponytail: la coda e' in memoria, una per processo. Il server ha fino a numeroWorkerHttp()
// worker HTTP (cluster.ts): ognuno distanzia le proprie chiamate di INTERVALLO_MS per il numero
// di worker, cosi' insieme restano entro 1 richiesta al secondo. Un limitatore condiviso
// (per esempio su Redis) permetterebbe di non rallentare il worker che geocodifica da solo.
let coda: Promise<unknown> = Promise.resolve();
let ultimaChiamata = 0;

/** Distanza fra due chiamate di questo processo. */
export function intervalloProcessoMs(): number {
  return INTERVALLO_MS * numeroWorkerHttp();
}

/**
 * Coordinate dell'indirizzo, oppure {} se Nominatim non lo trova, sbaglia o non risponde in tempo.
 * paese (codice ISO, es. "it") limita la ricerca a quel paese.
 */
export function geocodifica(query: string, paese?: string): Promise<{ lat?: number; lon?: number }> {
  return inCoda(() => chiamaNominatim(query, paese));
}

/** Mette la chiamata in coda dietro le altre, distanziata di intervalloProcessoMs() dalla precedente. */
function inCoda<T>(chiamata: () => Promise<T>): Promise<T> {
  const turno = coda.then(async () => {
    const attesa = ultimaChiamata + intervalloProcessoMs() - Date.now();
    if (attesa > 0) await new Promise((resolve) => setTimeout(resolve, attesa));
    ultimaChiamata = Date.now();
    return chiamata();
  });
  coda = turno.catch(() => undefined);
  return turno;
}

type RisultatoNominatim = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
};

// Sigle delle province nel campo ISO3166-2-lvl6 di Nominatim (es. IT-LU)
const siglaProvincia = (iso?: string) => (iso?.startsWith('IT-') ? iso.slice(3) : undefined);

/** Risultato di Nominatim scomposto nei campi del punto vendita. */
function indirizzoTrovato(r: RisultatoNominatim): IndirizzoTrovatoDTO | undefined {
  const lat = Number(r.lat);
  const lon = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  const a = r.address ?? {};
  const via = a.road ?? a.pedestrian ?? a.square ?? a.hamlet ?? '';
  return {
    etichetta: r.display_name ?? via,
    lat,
    lon,
    indirizzo: [via, a.house_number].filter(Boolean).join(' '),
    cap: a.postcode,
    citta: a.city ?? a.town ?? a.village ?? a.municipality,
    provincia: siglaProvincia(a['ISO3166-2-lvl6']),
    regione: a.state,
  };
}

/**
 * Indirizzi italiani che corrispondono alla ricerca, per far scegliere all'utente quello giusto
 * sulla mappa. Passa dalla stessa coda di geocodifica; se Nominatim non risponde lancia un errore.
 */
export function cercaIndirizzi(query: string, limite = 5): Promise<IndirizzoTrovatoDTO[]> {
  return inCoda(async () => {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=it&limit=${limite}&q=${encodeURIComponent(query)}`;
    let response: Response;
    try {
      response = await fetch(url, { headers: { 'User-Agent': 'fidelity-promotion/2.18' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      // Rete, DNS o timeout: il motivo arriva a chi importa o cerca, non solo nel log
      throw new Error(`Nominatim non raggiungibile: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) throw new Error(`Nominatim non disponibile (HTTP ${response.status})`);
    const risultati = (await response.json()) as RisultatoNominatim[];
    return risultati.map(indirizzoTrovato).filter((r): r is IndirizzoTrovatoDTO => Boolean(r));
  });
}

async function chiamaNominatim(query: string, paese?: string): Promise<{ lat?: number; lon?: number }> {
  const filtroPaese = paese ? `&countrycodes=${encodeURIComponent(paese)}` : '';
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1${filtroPaese}&q=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'fidelity-promotion/2.18' }, signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!response.ok) return {};
    const results = await response.json() as Array<{ lat?: string; lon?: string }>;
    const lat = Number(results[0]?.lat);
    const lon = Number(results[0]?.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : {};
  } catch (error) {
    log.warn('Geolocalizzazione del punto vendita del plugin non riuscita', {
      error: error instanceof Error ? error.message : String(error),
      query,
    });
    return {};
  }
}

/** Dove si trova una riga stampata secondo Nominatim, con la precisione del risultato. */
export interface PosizioneTrovata {
  lat: number;
  lon: number;
  precisione: Exclude<PrecisionePosizione, 'non_trovata'>;
  /** Il testo cercato che l'ha trovata. */
  ricerca: string;
}

type RisultatoPosizione = RisultatoNominatim & { category?: string; type?: string; addresstype?: string };

/** Tipi di luogo di Nominatim che sono una strada. */
const TIPI_STRADA = new Set(['road', 'street', 'pedestrian', 'square', 'residential', 'living_street', 'tertiary', 'secondary', 'primary', 'unclassified', 'service', 'trunk']);

/** Quanto è preciso un risultato: col civico, la strada, oppure un luogo (comune, frazione, quartiere). */
function precisioneRisultato(risultato: RisultatoPosizione, cercavoLaVia: boolean): PosizioneTrovata['precisione'] {
  if (!cercavoLaVia) return 'comune';
  if (risultato.address?.house_number) return 'civico';
  if (risultato.category === 'highway' || TIPI_STRADA.has(risultato.addresstype ?? '') || TIPI_STRADA.has(risultato.type ?? '')) return 'via';
  if (risultato.category === 'place' || risultato.category === 'boundary') return 'comune';
  // Un edificio o un negozio della via cercata
  return 'via';
}

/** Una ricerca libera, limitata all'Italia; lancia un errore se Nominatim non risponde. */
async function primoRisultato(query: string): Promise<RisultatoPosizione | undefined> {
  return inCoda(async () => {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=it&limit=1&q=${encodeURIComponent(query)}`;
    let response: Response;
    try {
      response = await fetch(url, { headers: { 'User-Agent': 'fidelity-promotion/2.18' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      throw new Error(`Nominatim non raggiungibile: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) throw new Error(`Nominatim non disponibile (HTTP ${response.status})`);
    const [primo] = (await response.json()) as RisultatoPosizione[];
    return primo;
  });
}

/**
 * La posizione di una riga stampata in un volantino, dalla più precisa: indirizzo e località (con
 * il civico, se OpenStreetMap ce l'ha, altrimenti la via), poi la via senza civici, poi la sola
 * località. Undefined se non la trova; un errore se Nominatim non risponde, perché chi cerca
 * possa contare gli errori di fila. Le chiamate passano dalla coda di geocodifica.
 */
export async function cercaPosizione(dati: { indirizzo: string | null; localita: string | null; provincia?: string | null }): Promise<PosizioneTrovata | undefined> {
  const indirizzo = dati.indirizzo?.trim() || null;
  const localita = dati.localita?.trim() || null;
  const provincia = dati.provincia?.trim() || null;
  const tentativi: Array<{ query: string; via: boolean }> = [];
  const aggiungi = (parti: Array<string | null>, via: boolean) => {
    const query = parti.filter(Boolean).join(', ');
    if (query && !tentativi.some(tentativo => tentativo.query === query)) tentativi.push({ query, via });
  };
  if (indirizzo && localita) {
    aggiungi([indirizzo, localita], true);
    // "Via Murtola 12/14" -> "Via Murtola": il civico non c'e' in OpenStreetMap
    const senzaCivici = indirizzo.replace(/\b\d+[A-Za-z]?(?:\s*[/-]\s*\d*[A-Za-z]?)*\b/g, ' ').replace(/\s+/g, ' ').replace(/[\s,]+$/, '').trim();
    if (senzaCivici && senzaCivici !== indirizzo) aggiungi([senzaCivici, localita], true);
  }
  if (localita) aggiungi([localita, provincia && provincia.length === 2 ? provincia : null], false);
  for (const { query, via } of tentativi) {
    const risultato = await primoRisultato(query);
    const lat = Number(risultato?.lat);
    const lon = Number(risultato?.lon);
    if (risultato && Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lon, precisione: precisioneRisultato(risultato, via), ricerca: query };
    }
  }
  return undefined;
}
