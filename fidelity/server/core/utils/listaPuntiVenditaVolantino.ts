import { chiaveIndirizzo, chiaveLocalita, chiaveTelefono, normalizePuntoVenditaText } from './puntoVenditaNormalization';

/**
 * Lettura della lista dei punti vendita stampata in un volantino, come la manda il Plugin InDesign
 * (campo `pv` di /external/sync_json_plugin e degli export JSON): il testo del riquadro, un
 * paragrafo per riga (\r, a volte \n o i separatori di riga di InDesign), con intestazioni di
 * regione, provincia o citta' e una voce per punto vendita, per esempio
 *
 *   LIGURIA
 *   Provincia di GENOVA
 *   PRA - Via Murtola 12/14 - tel. 010 6197180
 *
 * Non c'e' un formato fisso: la lettura e' tollerante (citta' in intestazione e voci senza citta',
 * telefono a capo, voci senza telefono, separatori diversi, titoli e orari da saltare) e quello che
 * non si capisce si lascia fuori invece di indovinarlo.
 */

export interface VoceListaPuntiVendita {
  /** Ordine nella lista, da 1. */
  posizione: number;
  /** La riga come era stampata (con il telefono andato a capo, se c'era). */
  riga: string;
  regione: string | null;
  provincia: string | null;
  /** L'ultima intestazione che non e' ne' una regione ne' una provincia: la citta' o l'insegna. */
  gruppo: string | null;
  localita: string | null;
  indirizzo: string | null;
  telefono: string | null;
}

/** Oltre tanto non e' piu' una lista di punti vendita: le voci in piu' non si leggono. */
export const MASSIMO_VOCI_LISTA = 5000;

type Voce = Omit<VoceListaPuntiVendita, 'posizione'>;

interface Contesto {
  regione: string | null;
  provincia: string | null;
  gruppo: string | null;
  /** La citta' dell'intestazione, per le voci che non la scrivono. */
  localita: string | null;
}

const REGIONI = new Set([
  'ABRUZZO', 'BASILICATA', 'CALABRIA', 'CAMPANIA', 'EMILIA ROMAGNA', 'FRIULI VENEZIA GIULIA', 'FRIULI', 'LAZIO',
  'LIGURIA', 'LOMBARDIA', 'MARCHE', 'MOLISE', 'PIEMONTE', 'PUGLIA', 'SARDEGNA', 'SICILIA', 'TOSCANA',
  'TRENTINO ALTO ADIGE', 'TRENTINO', 'ALTO ADIGE', 'UMBRIA', 'VALLE DAOSTA', 'VENETO',
]);

const PROVINCIA = /^(?:provincia|prov\.?)\s+(?:di\s+|del\s+|della\s+|dell'\s*)?(.+)$/i;

/** Tipi di strada che aprono un indirizzo, scritti per esteso o abbreviati. */
const STRADA = /(^|[\s\-–(,])(via|viale|v\.\s?le|vle|piazza|piazzale|piazzetta|p\.\s?zza|p\.\s?za|p\.\s?le|p\.\s?zzetta|corso|c\.\s?so|largo|l\.\s?go|strada|str\.|s\.\s?s\.|s\.\s?p\.|s\.\s?r\.|ss|sp|sr|vicolo|vico|v\.\s?lo|localit[aà]|loc\.|frazione|fraz\.|borgo|b\.\s?go|contrada|c\.\s?da|lungomare|lungarno|galleria|centro comm\w*|c\.\s?c\.|c\.\s?comm\w*\.?|zona ind\w*|z\.\s?i\.|z\.\s?a\.)(?=[\s.,]|$)/i;

/** Separatori fra citta', indirizzo e telefono: il trattino fra spazi (non quello di 12-14), barre, punti elenco, tabulazioni. */
const SEPARATORI = /\s+[-–—]\s+|\s*[|•·▪■►]\s*|\t+|\s{3,}/;

const PREFISSO_TELEFONO = /^(?:tel(?:efono)?|t|ph(?:one)?|cell(?:ulare)?)\b\.?\s*[:.]?\s*/i;
const FAX = /^fax\b/i;
/** Orari di apertura: si saltano, come riga ("Orari: lun-sab 8.00-20.00") o come parte di una voce. */
const ORARIO_IN_TESTA = /^(?:orari[oa]?|aperto|aperti|apertura|chiuso|chiusura|lun(?:edi)?|dom(?:enica)?|feriali|festivi)\b/i;
const FASCIA_ORARIA = /\b\d{1,2}[.:]\d{2}\s*[-–]\s*\d{1,2}(?:[.:]\d{2})?\b/;
/** Titoli del riquadro ("PUNTI VENDITA ADERENTI", "Offerta valida dal ... nei punti vendita"). */
const TITOLO = /\bPUNT[OI]\s+VENDITA\b|\bNEGOZI\b|\bADERENTI\b|\bVALID[AEIO]\b|\bOFFERT[AE]\b|\bELENCO\b|\bINDIRIZZI\b/i;
const CONTATTI = /@|\bwww\.|https?:/i;
/** Intestazioni che dicono l'insegna e non la citta': non danno la localita' alle voci che seguono. */
const INSEGNA = /\b(?:CONAD|SUPERSTORE|SUPERMERCAT\w*|IPERMERCAT\w*|IPER|MARKET|MINIMARKET|DISCOUNT|CITY|SAPORI)\b/i;
/** La sigla della provincia dopo la citta': "PRA (GE)". */
const SIGLA_PROVINCIA = /\s*\(([A-Za-z]{2})\)\s*$/;

const cifre = (testo: string): number => testo.replace(/\D/g, '').length;
const testo = (valore: unknown): string | null => {
  if (typeof valore !== 'string' && typeof valore !== 'number') return null;
  const pulito = String(valore).replace(/\s+/g, ' ').trim();
  return pulito || null;
};

/** Toglie oggetti ancorati, punti elenco iniziali e separatori in coda; gli spazi si compattano dopo la divisione. */
function pulisci(riga: string): string {
  return riga
    .replace(/\uFFFC/g, '')
    .replace(/^[\s•·▪■►*\-–—]+/, '')
    .replace(/[\s,;:\-–—|]+$/, '')
    .trim();
}

const compatta = (valore: string): string => valore.replace(/\s+/g, ' ').replace(/^[\s,;:]+|[\s,;:]+$/g, '').trim();

const eRegione = (valore: string): boolean => REGIONI.has(normalizePuntoVenditaText(valore));

function haStrada(valore: string): boolean {
  return STRADA.test(valore);
}

const eOrario = (segmento: string): boolean => ORARIO_IN_TESTA.test(segmento) || (FASCIA_ORARIA.test(segmento) && !haStrada(segmento));

/** Il numero di telefono di un segmento ("tel. 010 6197180", "010/6197180"), null se il segmento non e' un telefono. */
function telefonoDi(segmento: string): string | null {
  const conPrefisso = PREFISSO_TELEFONO.test(segmento);
  const resto = segmento.replace(PREFISSO_TELEFONO, '');
  if (!conPrefisso && !/^\+?[\d\s./\-()]+$/.test(resto)) return null;
  const numero = /\+?\d[\d\s./\-()]*\d/.exec(resto)?.[0];
  if (!numero) return null;
  // Due numeri di fila ("010 111111 / 222222"): conta il primo
  const primo = compatta(numero.split(/\s+\/\s+|\s*;\s*/)[0]);
  return cifre(primo) >= 6 ? primo : null;
}

/** Riga fatta solo di un telefono: e' quello della voce precedente, andato a capo. */
function soloTelefono(riga: string): boolean {
  const resto = riga.replace(PREFISSO_TELEFONO, '');
  return /^\+?[\d\s./\-()]+$/.test(resto) && cifre(resto) >= 6;
}

/** Stacca dal segmento il telefono (o il fax) scritto senza separatore: "Via Roma 1 tel. 010 123456". */
function separaTelefono(segmento: string): string[] {
  const inizio = segmento.search(/[\s,;](?:tel(?:efono)?|fax)\b/i);
  if (inizio > 0) {
    return [compatta(segmento.slice(0, inizio)), ...separaTelefono(compatta(segmento.slice(inizio + 1)))].filter(Boolean);
  }
  // Telefono in coda senza "tel": fisso (0...) o cellulare (3..), almeno 8 cifre
  const inCoda = /\s((?:0\d{1,4}|3\d{2})(?:[\s./-]?\d{2,4}){1,4})$/.exec(segmento);
  if (inCoda && cifre(inCoda[1]) >= 8 && inCoda.index > 0 && haStrada(segmento.slice(0, inCoda.index))) {
    return [compatta(segmento.slice(0, inCoda.index)), inCoda[1]];
  }
  return [segmento];
}

function segmenta(riga: string): string[] {
  return riga
    .split(SEPARATORI)
    .map(compatta)
    .filter(Boolean)
    .flatMap(separaTelefono);
}

/** Citta' e indirizzo scritti senza separatore ("SANREMO C.so Nazario Sauro 44"): si divide al tipo di strada. */
function dividiCittaIndirizzo(segmento: string): { localita: string | null; indirizzo: string } {
  const trovato = STRADA.exec(segmento);
  if (trovato && trovato.index + trovato[1].length > 0) {
    const inizio = trovato.index + trovato[1].length;
    const citta = compatta(segmento.slice(0, inizio));
    if (citta && !/\d/.test(citta)) return { localita: citta, indirizzo: compatta(segmento.slice(inizio)) };
  }
  return { localita: null, indirizzo: segmento };
}

/** Una voce della lista: citta' (se c'e', prima dell'indirizzo), indirizzo e telefono. Null se non c'e' ne' indirizzo ne' telefono. */
function leggiVoce(riga: string, contesto: Contesto): Voce | null {
  let telefono: string | null = null;
  const altri: string[] = [];
  for (const segmento of segmenta(riga)) {
    if (FAX.test(segmento) || eOrario(segmento)) continue;
    const numero = telefonoDi(segmento);
    if (numero !== null) {
      telefono ??= numero;
      continue;
    }
    if (PREFISSO_TELEFONO.test(segmento) && /^(?:tel|telefono)\b/i.test(segmento)) continue;
    altri.push(segmento);
  }

  let localita: string | null = null;
  let indirizzo: string | null = null;
  if (altri.length === 1) {
    ({ localita, indirizzo } = dividiCittaIndirizzo(altri[0]));
  } else if (altri.length > 1) {
    // L'indirizzo e' il primo segmento col civico; senza civico il primo (dopo la citta') col tipo di strada
    let indice = altri.findIndex(segmento => /\d/.test(segmento) || /\bs\.?\s?n\.?\s?c\b/i.test(segmento));
    if (indice < 0) indice = altri.findIndex((segmento, posizione) => posizione > 0 && haStrada(segmento));
    if (indice < 0) indice = 1;
    indirizzo = altri[indice];
    if (indice > 0 && !/\d/.test(altri[0])) localita = altri[0];
  }
  if (!indirizzo && !telefono) return null;

  let provincia = contesto.provincia;
  if (localita) {
    const sigla = SIGLA_PROVINCIA.exec(localita);
    if (sigla) {
      // La sigla sulla riga e' piu' precisa dell'intestazione
      localita = compatta(localita.slice(0, sigla.index)) || null;
      provincia = sigla[1].toUpperCase();
    }
  }
  return {
    riga: compatta(riga),
    regione: contesto.regione,
    provincia,
    gruppo: contesto.gruppo,
    localita: localita ?? contesto.localita,
    indirizzo,
    telefono,
  };
}

/** Intestazione di regione o di provincia: aggiorna il contesto. False se la riga non lo e'. */
function intestazioneGeografica(riga: string, contesto: Contesto): boolean {
  const provincia = PROVINCIA.exec(riga);
  if (provincia) {
    contesto.provincia = compatta(provincia[1]);
    contesto.gruppo = null;
    contesto.localita = null;
    return true;
  }
  if (eRegione(riga)) {
    contesto.regione = compatta(riga);
    contesto.provincia = null;
    contesto.gruppo = null;
    contesto.localita = null;
    return true;
  }
  return false;
}

/** Intestazione di citta' o di insegna ("BOLOGNA", "CONAD CITY", "FIRENZE - CONAD CITY"): l'insegna non e' una localita'. */
function intestazione(segmenti: string[], contesto: Contesto): void {
  contesto.gruppo = segmenti.join(' - ');
  const citta = segmenti.find(segmento => !INSEGNA.test(segmento));
  if (citta) contesto.localita = citta;
}

/** Stessa citta', indirizzo e telefono: la stessa lista ripetuta (due pagine, due capitoli del book) conta una volta. */
function senzaDoppioni(voci: Voce[]): VoceListaPuntiVendita[] {
  const viste = new Set<string>();
  const uniche: VoceListaPuntiVendita[] = [];
  for (const voce of voci) {
    const chiave = [chiaveLocalita(voce.localita), chiaveIndirizzo(voce.indirizzo), chiaveTelefono(voce.telefono)].join('|');
    if (viste.has(chiave)) continue;
    viste.add(chiave);
    uniche.push({ posizione: uniche.length + 1, ...voce });
    if (uniche.length >= MASSIMO_VOCI_LISTA) break;
  }
  return uniche;
}

/** Le voci della lista dei punti vendita di un volantino, nell'ordine in cui sono stampate. */
export function leggiListaPuntiVendita(lista: unknown): VoceListaPuntiVendita[] {
  if (typeof lista !== 'string' || lista.trim() === '') return [];
  const contesto: Contesto = { regione: null, provincia: null, gruppo: null, localita: null };
  const voci: Voce[] = [];

  for (const originale of lista.split(/[\r\n\u2028\u2029]+/)) {
    const riga = pulisci(originale);
    if (!riga) continue;
    const ultima = voci[voci.length - 1];
    if (soloTelefono(riga)) {
      // Il telefono andato a capo e' della voce sopra; un secondo numero non conta
      if (ultima && ultima.telefono === null) {
        ultima.telefono = telefonoDi(riga);
        ultima.riga = `${ultima.riga} ${compatta(riga)}`;
      }
      continue;
    }
    if (FAX.test(riga) || ORARIO_IN_TESTA.test(riga) || CONTATTI.test(riga)) continue;
    if (intestazioneGeografica(compatta(riga), contesto)) continue;

    const segmenti = segmenta(riga);
    const strada = haStrada(riga);
    const conTelefono = segmenti.some(segmento => telefonoDi(segmento) !== null);
    if (TITOLO.test(riga) && !strada && !conTelefono) continue;
    if (!/\d/.test(riga) && !strada && !conTelefono) {
      // "TOSCANA - Provincia di FIRENZE": piu' intestazioni sulla stessa riga
      if (segmenti.length > 1 && segmenti.every(segmento => PROVINCIA.test(segmento) || eRegione(segmento))) {
        segmenti.forEach(segmento => intestazioneGeografica(segmento, contesto));
        continue;
      }
      if (segmenti.length === 1 || segmenti.some(segmento => INSEGNA.test(segmento))) {
        // Riga breve senza numeri ne' vie: intestazione di citta' o di insegna. Le frasi lunghe sono note.
        const parole = segmenti.join(' ').split(' ').length;
        if (parole <= 6 && segmenti.join(' - ').length <= 50) intestazione(segmenti, contesto);
        continue;
      }
    }
    const voce = leggiVoce(riga, contesto);
    if (voce) voci.push(voce);
  }
  return senzaDoppioni(voci);
}

interface PuntoVenditaPvData {
  testo?: unknown;
  citta?: unknown;
  provincia?: unknown;
  regione?: unknown;
  indirizzo?: unknown;
  telefono?: unknown;
}

/**
 * Le voci di `pvData.gruppi`, se un plugin le manda gia' divise (oggi non succede): i campi
 * strutturati valgono piu' del testo, che serve solo a ricavare quelli che mancano.
 */
export function vociDaPvData(pvData: unknown): VoceListaPuntiVendita[] {
  const gruppi = pvData && typeof pvData === 'object' ? (pvData as { gruppi?: unknown }).gruppi : undefined;
  if (!Array.isArray(gruppi)) return [];
  const contesto: Contesto = { regione: null, provincia: null, gruppo: null, localita: null };
  const voci: Voce[] = [];
  for (const gruppo of gruppi) {
    if (!gruppo || typeof gruppo !== 'object') continue;
    const { intestazione: titolo, puntiVendita } = gruppo as { intestazione?: unknown; puntiVendita?: unknown };
    const testata = testo(titolo);
    if (testata && !intestazioneGeografica(testata, contesto)) intestazione([testata], contesto);
    if (!Array.isArray(puntiVendita)) continue;
    for (const elemento of puntiVendita) {
      if (!elemento || typeof elemento !== 'object') continue;
      const pv = elemento as PuntoVenditaPvData;
      const riga = testo(pv.testo);
      const daTesto = riga ? leggiVoce(riga, contesto) : null;
      const voce: Voce = {
        riga: riga ?? [testo(pv.citta), testo(pv.indirizzo), testo(pv.telefono)].filter(Boolean).join(' - '),
        regione: testo(pv.regione) ?? contesto.regione,
        provincia: testo(pv.provincia) ?? daTesto?.provincia ?? contesto.provincia,
        gruppo: contesto.gruppo,
        localita: testo(pv.citta) ?? daTesto?.localita ?? contesto.localita,
        indirizzo: testo(pv.indirizzo) ?? daTesto?.indirizzo ?? null,
        telefono: testo(pv.telefono) ?? daTesto?.telefono ?? null,
      };
      if (voce.riga && (voce.indirizzo || voce.telefono)) voci.push(voce);
    }
  }
  return senzaDoppioni(voci);
}

/**
 * Le voci della lista di un volantino, da un payload del Plugin o da un suo export: i gruppi
 * strutturati se ci sono, altrimenti il testo `pv` (o, in mancanza, quello di pvData).
 */
export function vociDelVolantino(payload: { pv?: unknown; pvData?: unknown }): VoceListaPuntiVendita[] {
  const daGruppi = vociDaPvData(payload.pvData);
  if (daGruppi.length > 0) return daGruppi;
  if (typeof payload.pv === 'string' && payload.pv.trim() !== '') return leggiListaPuntiVendita(payload.pv);
  const pvData = payload.pvData && typeof payload.pvData === 'object' ? payload.pvData as { testo?: unknown; paragrafi?: unknown } : {};
  if (typeof pvData.testo === 'string' && pvData.testo.trim() !== '') return leggiListaPuntiVendita(pvData.testo);
  if (Array.isArray(pvData.paragrafi)) {
    const paragrafi = pvData.paragrafi
      .map(paragrafo => (paragrafo && typeof paragrafo === 'object' ? testo((paragrafo as { text?: unknown }).text) : null))
      .filter((paragrafo): paragrafo is string => paragrafo !== null);
    return leggiListaPuntiVendita(paragrafi.join('\r'));
  }
  return [];
}
