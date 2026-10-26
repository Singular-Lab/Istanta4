import type { EsitoRigaImportPuntoVenditaDTO, IndirizzoTrovatoDTO, StatoImportPuntiVenditaDTO } from "../../server/core/dto";

/** Il server invia i payload socket come Buffer JSON: arrivano come ArrayBuffer, vista o stringa. */
export function decodificaPayloadSocket<T>(valore: unknown): T {
  let testo: unknown = valore;
  if (valore instanceof ArrayBuffer) testo = new TextDecoder().decode(new Uint8Array(valore));
  else if (ArrayBuffer.isView(valore)) {
    testo = new TextDecoder().decode(new Uint8Array(valore.buffer, valore.byteOffset, valore.byteLength));
  }
  if (typeof testo === "string") {
    try {
      return JSON.parse(testo) as T;
    } catch {
      return testo as T;
    }
  }
  return testo as T;
}

/** Colore del punteggio di affidabilita: alto verde, sotto soglia rosso, in mezzo giallo. */
export function classePunteggio(punteggio: number, soglia = 70): "success" | "warning" | "danger" {
  if (punteggio < soglia) return "danger";
  return punteggio < 90 ? "warning" : "success";
}

/** Classi del badge del punteggio, scritte per intero perche Tailwind le trovi nel sorgente. */
export const BADGE_PUNTEGGIO: Record<ReturnType<typeof classePunteggio>, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-danger/10 text-danger border-danger/20",
};

/** Conteggi dell'anteprima: cosa si importera da solo, cosa si inserisce a mano, cosa si scarta. */
export function riepilogoAnteprima(righe: EsitoRigaImportPuntoVenditaDTO[]) {
  return {
    importabili: righe.filter(r => r.azione === "crea" || r.azione === "aggiorna").length,
    daInserireAMano: righe.filter(r => r.azione === "revisiona").length,
    scartate: righe.filter(r => r.azione === "scarta").length,
  };
}

/** Percentuale di righe elaborate, da 0 a 100. */
export function percentualeImport(stato: Pick<StatoImportPuntiVenditaDTO, "elaborate" | "totale">): number {
  return stato.totale > 0 ? Math.round((stato.elaborate / stato.totale) * 100) : 100;
}

/** Testo del riepilogo di un import terminato o annullato. */
export function testoRiepilogoImport(stato: StatoImportPuntiVenditaDTO): string {
  const parti = [
    `${stato.creati} creati`,
    `${stato.aggiornati} aggiornati`,
    `${stato.scartati} scartati`,
  ];
  if (stato.inseritiAMano) parti.push(`${stato.inseritiAMano} inseriti a mano`);
  if (stato.stato === "annullato" || stato.stato === "errore") parti.push(`${stato.nonElaborate} non elaborati`);
  if (stato.senzaCoordinate) parti.push(`${stato.senzaCoordinate} senza coordinate`);
  if (stato.erroriNominatim) parti.push(`${stato.erroriNominatim} errori di Nominatim`);
  if (stato.soloFp) parti.push(`${stato.soloFp} salvati solo in FP (Istanta non raggiungibile)`);
  return parti.join(", ");
}

/** Import ancora attivo: in corso, o fermo su una riga in attesa della decisione dell'utente. */
export const importAttivo = (stato?: Pick<StatoImportPuntiVenditaDTO, "stato"> | null) =>
  stato?.stato === "in_corso" || stato?.stato === "in_attesa";

/** Campi del modale di inserimento manuale, inviati con la decisione "inserisci". */
export interface DatiInserimentoManuale {
  nome: string;
  indirizzo: string;
  citta: string;
  cap: string;
  provincia: string;
  regione: string;
  telefono: string;
  ragioneSociale: string;
  guidIDCombinazione: string;
  lat?: number;
  lon?: number;
}

/** Combinazione disponibile per la GDO, come la restituisce /all_combinazion_for_gdo. */
export interface CombinazioneDisponibile {
  id: string;
  sigla_combinazione: string;
  id_canale: string;
  id_area?: string;
  nome_canale?: string;
  nome_area?: string;
  codice_canale?: string;
  codice_area?: string;
}

/**
 * Canali e aree che compaiono nelle combinazioni della GDO, per nome, senza doppioni e ordinati.
 * Senza nome si mostra il codice; due voci con lo stesso nome (in CONAD CNO capita) portano
 * anche il codice, altrimenti nel menu non si distinguerebbero.
 */
export function canaliEAree(combinazioni: CombinazioneDisponibile[]) {
  const canali = new Map<string, { nome?: string; codice: string }>();
  const aree = new Map<string, { nome?: string; codice: string }>();
  for (const c of combinazioni) {
    canali.set(c.id_canale, { nome: c.nome_canale, codice: c.codice_canale ?? c.sigla_combinazione });
    if (c.id_area) aree.set(c.id_area, { nome: c.nome_area, codice: c.codice_area ?? c.sigla_combinazione });
  }
  const ordina = (voci: Map<string, { nome?: string; codice: string }>) => {
    const nomi = [...voci.values()].map(v => v.nome?.trim() || v.codice);
    const ripetuti = new Set(nomi.filter((n, i) => nomi.indexOf(n) !== i));
    return [...voci]
      .map(([id, v]) => {
        const nome = v.nome?.trim() || v.codice;
        return { id, nome: ripetuti.has(nome) && nome !== v.codice ? `${nome} (${v.codice})` : nome };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  };
  return { canali: ordina(canali), aree: ordina(aree) };
}

/**
 * Coordinate incollate da Google Maps: la coppia "lat, lon" che copia il tasto destro sul punto,
 * oppure un link che le contiene (".../@43.84,10.50,17z" o "...?q=43.84,10.50").
 * Null se il testo non ha coordinate, se sono fuori dai limiti o se sono 0,0.
 */
export function coordinateDaTesto(testo: string): { lat: number; lon: number } | null {
  const numero = "(-?\\d{1,3}(?:\\.\\d+)?)";
  const coppia = new RegExp(`${numero}\\s*,\\s*${numero}`);
  let t = testo.trim().replace(/\s+/g, " ");
  try {
    t = decodeURIComponent(t);
  } catch {
    // Un "%" che non e una sequenza URL: si usa il testo cosi com'e
  }
  const trovata =
    t.match(new RegExp(`@${numero},${numero}`)) ?? t.match(new RegExp(`[?&](?:q|query|ll)=${numero},\\s*${numero}`)) ?? t.match(new RegExp(`^${coppia.source}$`));
  if (!trovata) return null;
  const lat = Number(trovata[1]);
  const lon = Number(trovata[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

/** Combinazione di canale e area scelti, se esiste. */
export const combinazioneDi = (combinazioni: CombinazioneDisponibile[], idCanale: string, idArea: string) =>
  idCanale && idArea ? combinazioni.find(c => c.id_canale === idCanale && c.id_area === idArea) : undefined;

/** Chiave dell'indirizzo: se cambia dopo la conferma (mappa o coordinate incollate), la conferma non vale piu. */
export const chiaveIndirizzo = (dati: Pick<DatiInserimentoManuale, "indirizzo" | "cap" | "citta">) =>
  [dati.indirizzo, dati.cap, dati.citta].map(v => v.trim().toLowerCase()).join("|");

/**
 * Applica al modale il risultato di Nominatim scelto dall'utente: indirizzo e coordinate
 * dalla mappa; CAP, citta, provincia e regione solo se Nominatim li conosce.
 */
export function applicaIndirizzo(dati: DatiInserimentoManuale, trovato: IndirizzoTrovatoDTO): DatiInserimentoManuale {
  return {
    ...dati,
    indirizzo: trovato.indirizzo || dati.indirizzo,
    cap: trovato.cap && /^\d{5}$/.test(trovato.cap) ? trovato.cap : dati.cap,
    citta: trovato.citta || dati.citta,
    provincia: trovato.provincia || dati.provincia,
    regione: trovato.regione || dati.regione,
    lat: trovato.lat,
    lon: trovato.lon,
  };
}

/** Il modale si salva solo con indirizzo confermato sulla mappa, campi obbligatori e combinazione esistente. */
export function inserimentoCompleto(dati: DatiInserimentoManuale, indirizzoConfermato: string | null): boolean {
  return Boolean(
    dati.nome.trim() &&
      dati.indirizzo.trim() &&
      dati.citta.trim() &&
      /^\d{5}$/.test(dati.cap) &&
      dati.guidIDCombinazione &&
      indirizzoConfermato !== null &&
      indirizzoConfermato === chiaveIndirizzo(dati)
  );
}
