import type { AvvisoVisibilitaMomento, DimensioneVisibilitaPromo, PromoMeta, VisibilitaPromo } from '../../../lib/types';

const normalizzaGuid = (value: unknown): string => String(value ?? '').trim().toLowerCase();

const listaGuid = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.map(normalizzaGuid).filter(Boolean))] : [];

/**
 * Visibilita come arriva dal client, ripulita: tiene solo le dimensioni abilitate
 * per il cliente. Null quando non resta nulla da filtrare.
 */
export function normalizzaVisibilita(
  input: unknown,
  dimensioniAbilitate: DimensioneVisibilitaPromo[] = [],
): VisibilitaPromo | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<Record<keyof VisibilitaPromo, unknown>>;
  const visibilita: VisibilitaPromo = {
    canali: dimensioniAbilitate.includes('canale') ? listaGuid(raw.canali) : [],
    aree: dimensioniAbilitate.includes('area') ? listaGuid(raw.aree) : [],
  };
  return visibilita.canali.length > 0 || visibilita.aree.length > 0 ? visibilita : null;
}

/**
 * Meta della promo dopo una scrittura dal client: aggiorna solo le chiavi ricevute
 * e lascia le altre come sono. Le chiavi sconosciute si scartano, quindi una chiave
 * nuova di PromoMeta va gestita qui.
 */
export function normalizzaMeta(
  input: unknown,
  attuale: PromoMeta | null | undefined,
  dimensioniAbilitate: DimensioneVisibilitaPromo[] = [],
): PromoMeta {
  const meta: PromoMeta = { ...(attuale ?? {}) };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return meta;
  if ('visibilita' in input) {
    const visibilita = normalizzaVisibilita((input as PromoMeta).visibilita, dimensioniAbilitate);
    if (visibilita) meta.visibilita = visibilita;
    else delete meta.visibilita;
  }
  return meta;
}

/** Tiene i tracciati con canale e area visibili nella promo; senza scelta li tiene tutti. */
export function filtraPerVisibilita<T extends { guidCanale: unknown; guidArea: unknown }>(
  tracciati: T[],
  visibilita?: VisibilitaPromo | null,
): T[] {
  if (!visibilita) return tracciati;
  const canali = new Set(listaGuid(visibilita.canali));
  const aree = new Set(listaGuid(visibilita.aree));
  return tracciati.filter(t =>
    (canali.size === 0 || canali.has(normalizzaGuid(t.guidCanale))) &&
    (aree.size === 0 || aree.has(normalizzaGuid(t.guidArea))),
  );
}

/**
 * Canali e aree del risultato di un momento confrontati con quelli visibili nella promo.
 * Null se combaciano, se la promo non ha una scelta o se il momento non ha risultato.
 */
export function confrontaConVisibilita(
  tracciati: Array<{ guidCanale: unknown; guidArea: unknown }> | null | undefined,
  visibilita?: VisibilitaPromo | null,
): AvvisoVisibilitaMomento | null {
  if (!visibilita || !Array.isArray(tracciati)) return null;
  const canaliScelti = listaGuid(visibilita.canali);
  const areeScelte = listaGuid(visibilita.aree);
  const canaliPresenti = new Set(tracciati.map(t => normalizzaGuid(t.guidCanale)));
  const areePresenti = new Set(tracciati.map(t => normalizzaGuid(t.guidArea)));
  const fuori = (presenti: Set<string>, scelti: string[]) =>
    scelti.length > 0 ? [...presenti].filter(g => !scelti.includes(g)) : [];
  const mancanti = (presenti: Set<string>, scelti: string[]) => scelti.filter(g => !presenti.has(g));

  const avviso: AvvisoVisibilitaMomento = {
    canaliFuori: fuori(canaliPresenti, canaliScelti),
    areeFuori: fuori(areePresenti, areeScelte),
    canaliMancanti: mancanti(canaliPresenti, canaliScelti),
    areeMancanti: mancanti(areePresenti, areeScelte),
  };
  return Object.values(avviso).some(lista => lista.length > 0) ? avviso : null;
}
