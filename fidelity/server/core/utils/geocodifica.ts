import { log } from '../logger';

/**
 * La policy d'uso di Nominatim (OpenStreetMap) ammette al massimo una richiesta al
 * secondo: le chiamate passano da una coda e partono distanziate di INTERVALLO_MS,
 * anche quando arrivano da sync concorrenti. Il timeout evita che un Nominatim lento
 * tenga ferma la sincronizzazione del plugin.
 */
export const INTERVALLO_MS = 1100;
const TIMEOUT_MS = 5000;

// ponytail: coda in memoria, vale perche il server gira in un solo processo (ecosystem.config.cjs:
// fork, instances 1). Con piu processi serve un limitatore condiviso, per esempio su Redis.
let coda: Promise<unknown> = Promise.resolve();
let ultimaChiamata = 0;

/** Coordinate dell'indirizzo, oppure {} se Nominatim non lo trova, sbaglia o non risponde in tempo. */
export function geocodifica(query: string): Promise<{ lat?: number; lon?: number }> {
  const turno = coda.then(async () => {
    const attesa = ultimaChiamata + INTERVALLO_MS - Date.now();
    if (attesa > 0) await new Promise((resolve) => setTimeout(resolve, attesa));
    ultimaChiamata = Date.now();
    return chiamaNominatim(query);
  });
  coda = turno.catch(() => undefined);
  return turno;
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
