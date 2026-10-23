import type { IndirizzoTrovatoDTO } from '../dto';
import { log } from '../logger';

/**
 * La policy d'uso di Nominatim (OpenStreetMap) ammette al massimo una richiesta al
 * secondo: le chiamate passano da una coda e partono distanziate di INTERVALLO_MS,
 * anche quando arrivano da sync concorrenti. Il timeout evita che un Nominatim lento
 * tenga ferma la sincronizzazione del plugin.
 */
export const INTERVALLO_MS = 1200;
const TIMEOUT_MS = 5000;

// ponytail: coda in memoria, vale perche il server gira in un solo processo (ecosystem.config.cjs:
// fork, instances 1). Con piu processi serve un limitatore condiviso, per esempio su Redis.
let coda: Promise<unknown> = Promise.resolve();
let ultimaChiamata = 0;

/** Coordinate dell'indirizzo, oppure {} se Nominatim non lo trova, sbaglia o non risponde in tempo. */
export function geocodifica(query: string): Promise<{ lat?: number; lon?: number }> {
  return inCoda(() => chiamaNominatim(query));
}

/** Mette la chiamata in coda dietro le altre, distanziata di INTERVALLO_MS dalla precedente. */
function inCoda<T>(chiamata: () => Promise<T>): Promise<T> {
  const turno = coda.then(async () => {
    const attesa = ultimaChiamata + INTERVALLO_MS - Date.now();
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

async function chiamaNominatim(query: string): Promise<{ lat?: number; lon?: number }> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
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
