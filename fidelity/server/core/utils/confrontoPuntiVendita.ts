import {
  type CombinazioneRiga,
  type ConfrontoConPuntoVendita,
  type ConfrontoDato,
  type PosizioneRiga,
  type PuntoVenditaConfrontato,
} from '../../../lib/puntiVendita/analisi';
import { chiaveIndirizzo, chiaveLocalita, chiaveTelefono, editDistance, normalizePuntoVenditaText } from './puntoVenditaNormalization';

/**
 * Il confronto fra le righe stampate nei volantini e un punto vendita dell'anagrafica, comune ai
 * suggerimenti per collegare una riga non abbinata e alla verifica dei collegamenti (contratto in
 * lib/puntiVendita/analisi.ts): telefono, indirizzo, località, provincia, canale e area, distanza
 * fra la posizione della riga e le coordinate del PV. Funzioni pure.
 */

/** Distanza oltre la quale due indirizzi della stessa località non sono più "simili". */
export const DISTANZA_INDIRIZZO_SIMILE = 3;
/** Distanza di caratteri entro la quale due località sono "simili" (un refuso, un'abbreviazione). */
const DISTANZA_LOCALITA_SIMILE = 2;
/** Le parole più corte non bastano a dire che due località sono la stessa ("S", "DI"). */
const MINIMO_PAROLA_LOCALITA = 3;
const RAGGIO_TERRA_M = 6_371_000;

/** Canale e area di un volantino o di un PV come chiave: "<idCanale>|<idArea>", null se ne manca uno. */
export function chiaveCombinazione(idCanale: string | null | undefined, idArea: string | null | undefined): string | null {
  return idCanale && idArea ? `${idCanale}|${idArea}`.toLowerCase() : null;
}

/** Il nome di una combinazione per i messaggi: "Conad City · Liguria". */
export function nomeCombinazione(combinazione: CombinazioneRiga): string {
  return [combinazione.canale?.nome || 'canale sconosciuto', combinazione.area?.nome || 'area sconosciuta'].join(' · ');
}

/** La via senza civici: "VIA MURTOLA 12 14" -> "VIA MURTOLA". */
export const viaSenzaCivici = (chiave: string): string => chiave.replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim();

/** Metri fra due punti (formula dell'emisenoverso), arrotondati al metro. */
export function distanzaMetri(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const radianti = (gradi: number) => (gradi * Math.PI) / 180;
  const dLat = radianti(b.lat - a.lat);
  const dLon = radianti(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radianti(a.lat)) * Math.cos(radianti(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * RAGGIO_TERRA_M * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** "450 m", "1,2 km", "95 km". */
export function formattaDistanza(metri: number): string {
  if (metri < 1000) return `${Math.round(metri)} m`;
  const km = metri / 1000;
  return `${km.toLocaleString('it-IT', { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}

const coordinata = (valore: unknown): number | null => {
  if (valore === null || valore === undefined || valore === '') return null;
  const numero = Number(valore);
  return Number.isFinite(numero) ? numero : null;
};

/** Le coordinate di un PV o di una posizione, se ci sono tutte e due. */
export function coordinate(punto: { lat?: unknown; lon?: unknown } | null | undefined): { lat: number; lon: number } | null {
  const lat = coordinata(punto?.lat);
  const lon = coordinata(punto?.lon);
  return lat !== null && lon !== null ? { lat, lon } : null;
}

/** Una posizione abbastanza precisa per misurare distanze di poche centinaia di metri. */
export const posizionePrecisa = (posizione: PosizioneRiga | null | undefined): boolean =>
  Boolean(posizione && coordinate(posizione) && (posizione.precisione === 'civico' || posizione.precisione === 'via'));

/** Una località stampata come la cerca Nominatim: "BOLOGNA e provincia" -> "BOLOGNA". */
export function localitaDaCercare(localita: string | null | undefined): string | null {
  const testo = String(localita ?? '').replace(/\s+e\s+provincia\s*$/i, '').replace(/\s*-\s*$/, '').trim();
  return testo || null;
}

/**
 * La chiave della posizione di una riga stampata: la località con l'indirizzo come nella chiave
 * "ind:" della riga, oppure la sola località ("loc:"). Null senza né l'una né l'altro.
 */
export function chiavePosizione(riga: { localita: string | null; chiaveIndirizzo: string | null }): string | null {
  const localita = chiaveLocalita(localitaDaCercare(riga.localita));
  if (riga.chiaveIndirizzo) return `ind:${localita ?? ''}|${riga.chiaveIndirizzo}`;
  return localita ? `loc:${localita}` : null;
}

/** Una riga stampata con quello che serve al confronto. */
export interface RigaDaConfrontare {
  localita: string | null;
  telefono?: string | null;
  provincia?: string | null;
  chiaveIndirizzo: string | null;
  chiaveTelefono: string | null;
  idCanale: string | null;
  idArea: string | null;
}

/** Quello che le righe di un gruppo hanno stampato, normalizzato. */
export interface DatiStampati {
  telefoni: ReadonlySet<string>;
  indirizzi: ReadonlySet<string>;
  localita: ReadonlySet<string>;
  province: ReadonlySet<string>;
  combinazioni: ReadonlySet<string>;
}

export function datiStampati(righe: readonly RigaDaConfrontare[]): DatiStampati {
  const telefoni = new Set<string>();
  const indirizzi = new Set<string>();
  const localita = new Set<string>();
  const province = new Set<string>();
  const combinazioni = new Set<string>();
  for (const riga of righe) {
    const telefono = riga.chiaveTelefono ?? chiaveTelefono(riga.telefono);
    if (telefono) telefoni.add(telefono);
    if (riga.chiaveIndirizzo) indirizzi.add(riga.chiaveIndirizzo);
    const chiave = chiaveLocalita(localitaDaCercare(riga.localita));
    if (chiave) localita.add(chiave);
    const provincia = normalizePuntoVenditaText(riga.provincia);
    if (provincia) province.add(provincia);
    const combinazione = chiaveCombinazione(riga.idCanale, riga.idArea);
    if (combinazione) combinazioni.add(combinazione);
  }
  return { telefoni, indirizzi, localita, province, combinazioni };
}

/** Le parole significative di una località: "S STEFANO MAGRA" -> STEFANO, MAGRA. */
const paroleLocalita = (chiave: string) => chiave.split(' ').filter(parola => parola.length >= MINIMO_PAROLA_LOCALITA);

function localitaSimili(a: string, b: string): boolean {
  if (editDistance(a, b) <= DISTANZA_LOCALITA_SIMILE) return true;
  const [corta, lunga] = paroleLocalita(a).length <= paroleLocalita(b).length ? [a, b] : [b, a];
  const parole = paroleLocalita(corta);
  const altre = new Set(paroleLocalita(lunga));
  return parole.length > 0 && parole.every(parola => altre.has(parola));
}

function confrontaTelefono(dati: DatiStampati, telefono: string | null): ConfrontoDato {
  const chiave = chiaveTelefono(telefono);
  if (!chiave || dati.telefoni.size === 0) return 'assente';
  return dati.telefoni.has(chiave) ? 'uguale' : 'diverso';
}

function confrontaIndirizzo(dati: DatiStampati, indirizzo: string | null): ConfrontoDato {
  const chiave = chiaveIndirizzo(indirizzo);
  if (!chiave || dati.indirizzi.size === 0) return 'assente';
  if (dati.indirizzi.has(chiave)) return 'uguale';
  const via = viaSenzaCivici(chiave);
  for (const stampato of dati.indirizzi) {
    if ((via !== '' && viaSenzaCivici(stampato) === via) || editDistance(stampato, chiave) <= DISTANZA_INDIRIZZO_SIMILE) return 'simile';
  }
  return 'diverso';
}

function confrontaLocalita(dati: DatiStampati, citta: string | null): ConfrontoDato {
  const chiave = chiaveLocalita(citta);
  if (!chiave || dati.localita.size === 0) return 'assente';
  if (dati.localita.has(chiave)) return 'uguale';
  return [...dati.localita].some(stampata => localitaSimili(stampata, chiave)) ? 'simile' : 'diverso';
}

/** Le province si confrontano se sono scritte allo stesso modo o se sono due sigle. */
function confrontaProvincia(dati: DatiStampati, provincia: string | null): ConfrontoDato {
  const chiave = normalizePuntoVenditaText(provincia);
  if (!chiave || dati.province.size === 0) return 'assente';
  if (dati.province.has(chiave)) return 'uguale';
  const sigle = chiave.length === 2 && [...dati.province].every(stampata => stampata.length === 2);
  return sigle ? 'diverso' : 'assente';
}

/** La combinazione di un PV come chiave. */
export const combinazioneDelPuntoVendita = (puntoVendita: PuntoVenditaConfrontato): string | null =>
  chiaveCombinazione(puntoVendita.combinazione.canale?.id, puntoVendita.combinazione.area?.id);

/** Il PV ha la combinazione di uno dei volantini; senza combinazioni note nelle righe va bene qualunque. */
export function stessaCombinazione(dati: DatiStampati, puntoVendita: PuntoVenditaConfrontato): boolean {
  if (dati.combinazioni.size === 0) return true;
  const combinazione = combinazioneDelPuntoVendita(puntoVendita);
  return combinazione !== null && dati.combinazioni.has(combinazione);
}

export function confronta(dati: DatiStampati, puntoVendita: PuntoVenditaConfrontato, posizione: PosizioneRiga | null): ConfrontoConPuntoVendita {
  const daRiga = coordinate(posizione);
  const daPuntoVendita = coordinate(puntoVendita);
  return {
    telefono: confrontaTelefono(dati, puntoVendita.telefono),
    indirizzo: confrontaIndirizzo(dati, puntoVendita.indirizzo),
    localita: confrontaLocalita(dati, puntoVendita.citta),
    provincia: confrontaProvincia(dati, puntoVendita.provincia),
    stessaCombinazione: stessaCombinazione(dati, puntoVendita),
    distanzaMetri: daRiga && daPuntoVendita ? distanzaMetri(daRiga, daPuntoVendita) : null,
  };
}

/** Un PV dell'anagrafica con i campi del confronto, come arriva dal repository. */
export interface PuntoVenditaDaConfrontare {
  id: string;
  nome: string;
  telefono: string | null;
  citta?: string | null;
  indirizzo?: string | null;
  ragioneSociale?: string | null;
  provincia?: string | null;
  idCanale?: string | null;
  nomeCanale?: string | null;
  idArea?: string | null;
  nomeArea?: string | null;
  lat?: number | string | null;
  lon?: number | string | null;
}

export function puntoVenditaConfrontato(puntoVendita: PuntoVenditaDaConfrontare): PuntoVenditaConfrontato {
  const posizione = coordinate(puntoVendita);
  return {
    id: puntoVendita.id,
    nome: puntoVendita.nome,
    ragioneSociale: puntoVendita.ragioneSociale ?? null,
    indirizzo: puntoVendita.indirizzo ?? null,
    citta: puntoVendita.citta ?? null,
    provincia: puntoVendita.provincia ?? null,
    telefono: puntoVendita.telefono ?? null,
    lat: posizione?.lat ?? null,
    lon: posizione?.lon ?? null,
    combinazione: {
      canale: puntoVendita.idCanale ? { id: puntoVendita.idCanale, nome: puntoVendita.nomeCanale ?? '' } : null,
      area: puntoVendita.idArea ? { id: puntoVendita.idArea, nome: puntoVendita.nomeArea ?? '' } : null,
    },
  };
}

/** Le combinazioni diverse delle righe, con i nomi, nell'ordine in cui compaiono. */
export function combinazioniDelleRighe(
  righe: ReadonlyArray<{ idCanale: string | null; nomeCanale?: string | null; idArea: string | null; nomeArea?: string | null }>,
): CombinazioneRiga[] {
  const viste = new Map<string, CombinazioneRiga>();
  for (const riga of righe) {
    const chiave = `${riga.idCanale ?? ''}|${riga.idArea ?? ''}`.toLowerCase();
    if (viste.has(chiave)) continue;
    viste.set(chiave, {
      canale: riga.idCanale ? { id: riga.idCanale, nome: riga.nomeCanale ?? '' } : null,
      area: riga.idArea ? { id: riga.idArea, nome: riga.nomeArea ?? '' } : null,
    });
  }
  return [...viste.values()];
}

/**
 * La posizione di un gruppo di righe, dalla più recente: la prima abbastanza precisa, altrimenti
 * la prima con le coordinate, altrimenti la prima cercata e non trovata. Null se nessuna è stata cercata.
 */
export function posizioneDelGruppo(
  righeDallaPiuRecente: ReadonlyArray<{ localita: string | null; chiaveIndirizzo: string | null }>,
  posizioni: ReadonlyMap<string, PosizioneRiga>,
): PosizioneRiga | null {
  const trovate = righeDallaPiuRecente
    .map(riga => chiavePosizione(riga))
    .filter((chiave): chiave is string => chiave !== null)
    .map(chiave => posizioni.get(chiave))
    .filter((posizione): posizione is PosizioneRiga => posizione !== undefined);
  return trovate.find(posizionePrecisa) ?? trovate.find(posizione => coordinate(posizione) !== null) ?? trovate[0] ?? null;
}
