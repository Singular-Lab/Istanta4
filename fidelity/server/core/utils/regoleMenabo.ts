import {
  OPERATORI_REGOLA_MENABO,
  TRASFORMAZIONI_NOME_MENABO,
  type CondizioneRegolaMenabo,
  type GruppoRegolaMenabo,
  type NodoRegolaMenabo,
  type OperatoreRegolaMenabo,
  type RegolaMenabo,
  type TrasformazioneNomeMenabo,
} from '../../../lib/impostazioniGdo/tipi';

/*
 * Le regole delle sezioni del menabò degli insight (spec impostazioni-gdo, "Regole delle sezioni del
 * menabò del volantino"): lettura dal JSONB, verifica prima del salvataggio, valutazione delle condizioni
 * (gruppi annidati, operatori di testo, numerici e regex) e composizione del nome da un modello.
 * Il confronto di testo non distingue maiuscole e accenti. Nessun accesso al database: funzioni pure.
 */

/** Il risultato di una regola: la sezione (null: non è una sezione), il colore e la regola che l'ha decisa. */
export interface RisultatoRegolaMenabo {
  nome: string | null;
  colore: string | null;
  /** Il titolo della regola, o il suo id. */
  regola: string;
}

/** Come si legge un campo del box che la regola sta valutando (campi derivati compresi). */
export type LeggiCampoRegola = (campo: string) => string | null;

const LUNGHEZZA_MASSIMA_REGEX = 200;
const LUNGHEZZA_MASSIMA_TESTO = 500;
const PROFONDITA_MASSIMA = 6;
const MASSIMO_NODI = 60;
const COLORE = /^#[0-9a-f]{6}$/i;

const oggetto = (valore: unknown): Record<string, unknown> | null =>
  valore !== null && typeof valore === 'object' && !Array.isArray(valore) ? valore as Record<string, unknown> : null;

const testoPulito = (valore: unknown): string =>
  typeof valore === 'string' ? valore.trim() : typeof valore === 'number' && Number.isFinite(valore) ? String(valore) : '';

/** Minuscolo e senza accenti, per confrontare "Pulizia" con "pulizia" e "Perù" con "peru". */
export const normalizzaPerRegola = (valore: string): string =>
  valore.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').trim();

/** Stesso valore: due numeri si confrontano come numeri ("1" = "01"), il resto senza maiuscole e accenti. */
const stessoValore = (a: string, b: string): boolean =>
  /^\d+$/.test(a) && /^\d+$/.test(b) ? Number(a) === Number(b) : a === b;

const eOperatore = (valore: unknown): valore is OperatoreRegolaMenabo =>
  typeof valore === 'string' && (OPERATORI_REGOLA_MENABO as readonly string[]).includes(valore);

const eTrasformazione = (valore: string): valore is TrasformazioneNomeMenabo =>
  (TRASFORMAZIONI_NOME_MENABO as readonly string[]).includes(valore);

/** Un numero scritto all'italiana ("12,5") o all'inglese; null se non lo è. */
function comeNumero(valore: string): number | null {
  const pulito = valore.trim().replace('%', '').replace(',', '.');
  if (pulito === '') return null;
  const numero = Number(pulito);
  return Number.isFinite(numero) ? numero : null;
}

// ─── Espressioni regolari ────────────────────────────────────────────

/** Una regex con quantificatori annidati ("(a+)+") può impiegare un tempo esponenziale: non si accetta. */
const QUANTIFICATORI_ANNIDATI = /\([^)]*[+*][^)]*\)[+*{]/;

/** Perché l'espressione non è accettabile; null se lo è. */
export function erroreEspressione(espressione: string): string | null {
  if (espressione.length > LUNGHEZZA_MASSIMA_REGEX) return `l'espressione supera ${LUNGHEZZA_MASSIMA_REGEX} caratteri`;
  if (QUANTIFICATORI_ANNIDATI.test(espressione)) return 'l\'espressione ha quantificatori annidati e potrebbe essere troppo lenta';
  try {
    new RegExp(espressione, 'iu');
    return null;
  } catch (errore) {
    return `espressione non valida (${errore instanceof Error ? errore.message : 'errore'})`;
  }
}

const REGEX_COMPILATE = new Map<string, RegExp | null>();
function compilata(espressione: string): RegExp | null {
  if (REGEX_COMPILATE.has(espressione)) return REGEX_COMPILATE.get(espressione) ?? null;
  const regex = erroreEspressione(espressione) === null ? new RegExp(espressione, 'iu') : null;
  if (REGEX_COMPILATE.size > 500) REGEX_COMPILATE.clear();
  REGEX_COMPILATE.set(espressione, regex);
  return regex;
}

// ─── Modello del nome ────────────────────────────────────────────────

const SEGNAPOSTO = /\{([^{}]*)\}/g;

/** I campi di un segnaposto: `tema/mastro` dà tema e, se è vuoto, mastro (il primo che ha un valore). */
const campiDelSegnaposto = (campo: string | undefined): string[] =>
  (campo ?? '').split('/').map(parte => parte.trim()).filter(parte => parte !== '');

/** Perché il modello non è valido (graffe spaiate, campo mancante, trasformazione sconosciuta); null se lo è. */
export function erroreModelloNome(modello: string): string | null {
  const senzaSegnaposto = modello.replace(SEGNAPOSTO, '');
  if (/[{}]/.test(senzaSegnaposto)) return 'graffe non chiuse nel modello';
  for (const trovato of modello.matchAll(SEGNAPOSTO)) {
    const [campo, ...trasformazioni] = trovato[1].split('|').map(parte => parte.trim());
    if (campiDelSegnaposto(campo).length === 0) return 'un segnaposto non ha il campo';
    const sconosciuta = trasformazioni.find(trasformazione => !eTrasformazione(trasformazione));
    if (sconosciuta !== undefined) return `trasformazione sconosciuta «${sconosciuta}»`;
  }
  return null;
}

function applicaTrasformazione(valore: string, trasformazione: TrasformazioneNomeMenabo, leggibile?: (valore: string) => string | null): string {
  switch (trasformazione) {
    case 'parte-1':
    case 'parte-2':
    case 'parte-3':
      // Le parti sono quelle separate da « - »; se manca, il nome resta vuoto e la regola non decide
      return valore.split(' - ')[Number(trasformazione.slice(-1)) - 1]?.trim() ?? '';
    case 'senza-sigla': {
      const trattino = valore.indexOf('-');
      return trattino > 0 ? valore.slice(trattino + 1) : valore;
    }
    case 'spazi': return valore.replace(/[_]+/g, ' ');
    case 'minuscolo': return valore.toLocaleLowerCase('it-IT');
    case 'maiuscolo': return valore.toLocaleUpperCase('it-IT');
    case 'titolo': {
      const minuscolo = valore.toLocaleLowerCase('it-IT');
      return minuscolo.charAt(0).toLocaleUpperCase('it-IT') + minuscolo.slice(1);
    }
    case 'taglia': return valore.replace(/\s+/g, ' ').trim();
    case 'leggibile': return leggibile ? (leggibile(valore) ?? '') : valore;
  }
}

/**
 * Il nome da un modello: `{campo|trasformazione|...}` si sostituisce col valore del campo (vuoto se manca; con
 * `{tema/mastro}` quello del primo campo che ha un valore),
 * il resto resta com'è. Gli spazi doppi e ai lati si tolgono. Un modello senza segnaposto è un nome fisso.
 * `leggibile` è il nome leggibile che dichiara la libreria agenzia (per Conad CNO quello della mastro).
 */
export function nomeDaModello(modello: string, leggi: LeggiCampoRegola, leggibile?: (valore: string) => string | null): string {
  const nome = modello.replace(SEGNAPOSTO, (_trovato, dentro: string) => {
    const [campo, ...trasformazioni] = dentro.split('|').map(parte => parte.trim());
    // Più campi separati da «/»: vale il primo che ha un valore, come un rinvio ad un altro campo
    let valore = '';
    for (const nomeCampo of campiDelSegnaposto(campo)) {
      const letto = leggi(nomeCampo)?.trim();
      if (letto) {
        valore = letto;
        break;
      }
    }
    for (const trasformazione of trasformazioni) {
      if (!eTrasformazione(trasformazione)) continue;
      valore = applicaTrasformazione(valore, trasformazione, leggibile);
    }
    return valore;
  });
  return nome.replace(/\s+/g, ' ').trim();
}

// ─── Lettura e verifica ──────────────────────────────────────────────

function leggiNodo(valore: unknown, profondita: number, conta: { nodi: number }): NodoRegolaMenabo | null {
  const nodo = oggetto(valore);
  if (!nodo || profondita > PROFONDITA_MASSIMA || conta.nodi >= MASSIMO_NODI) return null;
  conta.nodi += 1;
  if (nodo.tipo === 'gruppo' || Array.isArray(nodo.figli)) {
    const logica = nodo.logica === 'una' || nodo.logica === 'nessuna' ? nodo.logica : 'tutte';
    const figli = (Array.isArray(nodo.figli) ? nodo.figli : [])
      .map(figlio => leggiNodo(figlio, profondita + 1, conta))
      .filter((figlio): figlio is NodoRegolaMenabo => figlio !== null);
    return { tipo: 'gruppo', logica, figli };
  }
  const campo = testoPulito(nodo.campo);
  if (campo === '' || !eOperatore(nodo.operatore)) return null;
  return {
    tipo: 'condizione',
    campo,
    operatore: nodo.operatore,
    valore: testoPulito(nodo.valore),
    valori: Array.isArray(nodo.valori) ? nodo.valori.map(testoPulito).filter(v => v !== '') : [],
  };
}

/** Le regole lette dal JSONB: solo quelle ben formate, le altre si scartano senza rompere il menabò. */
export function regoleMenaboDa(valore: unknown): RegolaMenabo[] {
  if (!Array.isArray(valore)) return [];
  return valore.flatMap((voce: unknown, indice): RegolaMenabo[] => {
    const regola = oggetto(voce);
    if (!regola) return [];
    const radice = leggiNodo({ tipo: 'gruppo', ...(oggetto(regola.condizione) ?? {}) }, 0, { nodi: 0 });
    if (!radice || radice.tipo !== 'gruppo' || radice.figli.length === 0) return [];
    const sezione = testoPulito(regola.sezione);
    const colore = testoPulito(regola.colore);
    return [{
      id: testoPulito(regola.id) || `regola-${indice + 1}`,
      titolo: testoPulito(regola.titolo) || null,
      livello: regola.livello === 'pagina' ? 'pagina' : 'box',
      sezione: regola.sezione === null || sezione === '' ? null : sezione,
      colore: COLORE.test(colore) ? colore : null,
      condizione: radice,
    }];
  });
}

export interface EsitoRegoleMenabo {
  regole: RegolaMenabo[];
  errori: string[];
}

function verificaNodo(valore: unknown, dove: string, profondita: number, conta: { nodi: number }, errori: string[]): NodoRegolaMenabo | null {
  const nodo = oggetto(valore);
  if (!nodo) {
    errori.push(`${dove}: non è una condizione`);
    return null;
  }
  conta.nodi += 1;
  if (conta.nodi > MASSIMO_NODI) {
    if (conta.nodi === MASSIMO_NODI + 1) errori.push(`${dove}: troppe condizioni (al massimo ${MASSIMO_NODI} per regola)`);
    return null;
  }
  if (profondita > PROFONDITA_MASSIMA) {
    errori.push(`${dove}: troppi gruppi annidati (al massimo ${PROFONDITA_MASSIMA})`);
    return null;
  }
  if (nodo.tipo === 'gruppo') {
    if (nodo.logica !== 'tutte' && nodo.logica !== 'una' && nodo.logica !== 'nessuna') {
      errori.push(`${dove}: la logica del gruppo deve essere tutte, una o nessuna`);
      return null;
    }
    if (!Array.isArray(nodo.figli)) {
      errori.push(`${dove}: il gruppo non ha l'elenco delle condizioni`);
      return null;
    }
    const figli = nodo.figli
      .map((figlio, i) => verificaNodo(figlio, `${dove}, voce ${i + 1}`, profondita + 1, conta, errori))
      .filter((figlio): figlio is NodoRegolaMenabo => figlio !== null);
    return { tipo: 'gruppo', logica: nodo.logica, figli };
  }
  const campo = testoPulito(nodo.campo);
  if (campo === '') {
    errori.push(`${dove}: manca il campo`);
    return null;
  }
  if (!eOperatore(nodo.operatore)) {
    errori.push(`${dove}: operatore non valido`);
    return null;
  }
  const valoreTesto = testoPulito(nodo.valore);
  const valori = Array.isArray(nodo.valori) ? nodo.valori.map(testoPulito).filter(v => v !== '') : [];
  const operatore = nodo.operatore;
  if (operatore === 'uno_di' && valori.length === 0) errori.push(`${dove}: manca l'elenco dei valori`);
  else if (operatore === 'tra') {
    const [minimo, massimo] = valori.map(comeNumero);
    if (valori.length !== 2 || minimo === null || massimo === null) errori.push(`${dove}: «tra» vuole due numeri`);
    else if (minimo > massimo) errori.push(`${dove}: il minimo è maggiore del massimo`);
  } else if (operatore === 'maggiore' || operatore === 'minore') {
    if (comeNumero(valoreTesto) === null) errori.push(`${dove}: il valore deve essere un numero`);
  } else if (operatore === 'regex') {
    const errore = valoreTesto === '' ? 'manca l\'espressione' : erroreEspressione(valoreTesto);
    if (errore) errori.push(`${dove}: ${errore}`);
  } else if (operatore !== 'vuoto' && operatore !== 'non_vuoto' && valoreTesto === '') {
    errori.push(`${dove}: manca il valore`);
  }
  return { tipo: 'condizione', campo, operatore, valore: valoreTesto, valori };
}

/**
 * Le regole da salvare, dal corpo della richiesta ({ regole: [...] }). Gli errori dicono quale regola
 * (contando da 1) e cosa non va; con errori non si salva niente.
 */
export function verificaRegoleMenabo(dati: unknown): EsitoRegoleMenabo {
  const elenco = oggetto(dati)?.regole;
  if (!Array.isArray(elenco)) return { regole: [], errori: ['regole deve essere un elenco'] };
  const errori: string[] = [];
  const regole: RegolaMenabo[] = [];
  const idVisti = new Set<string>();
  elenco.forEach((voce: unknown, indice) => {
    const dove = `regola ${indice + 1}`;
    const regola = oggetto(voce);
    if (!regola) {
      errori.push(`${dove}: non è una regola`);
      return;
    }
    const livello = regola.livello === 'pagina' ? 'pagina' : regola.livello === 'box' ? 'box' : null;
    if (livello === null) errori.push(`${dove}: il livello deve essere box o pagina`);
    const nonSezione = regola.sezione === null;
    const sezione = testoPulito(regola.sezione);
    if (!nonSezione) {
      if (sezione === '') errori.push(`${dove}: manca il nome della sezione`);
      else {
        const errore = erroreModelloNome(sezione);
        if (errore) errori.push(`${dove}: ${errore}`);
      }
    }
    const colore = testoPulito(regola.colore);
    if (colore !== '' && !COLORE.test(colore)) errori.push(`${dove}: il colore deve essere #rrggbb`);
    const grezza = oggetto(regola.condizione);
    const dentro = errori.length;
    const radice = grezza && grezza.tipo === 'gruppo'
      ? verificaNodo(grezza, dove, 0, { nodi: 0 }, errori)
      : (errori.push(`${dove}: manca la condizione`), null);
    if (radice && radice.tipo === 'gruppo' && radice.figli.length === 0 && errori.length === dentro) errori.push(`${dove}: serve almeno una condizione`);
    const id = testoPulito(regola.id) || `regola-${indice + 1}`;
    if (idVisti.has(id)) errori.push(`${dove}: l'id «${id}» è già usato`);
    idVisti.add(id);
    if (radice && radice.tipo === 'gruppo' && livello !== null) {
      regole.push({
        id,
        titolo: testoPulito(regola.titolo) || null,
        livello,
        sezione: nonSezione ? null : sezione,
        colore: colore === '' ? null : colore,
        condizione: radice,
      });
    }
  });
  return { regole: errori.length > 0 ? [] : regole, errori };
}

// ─── Valutazione ─────────────────────────────────────────────────────

function condizioneVale(condizione: CondizioneRegolaMenabo, letto: string | null): boolean {
  const dato = letto === null ? '' : letto.slice(0, LUNGHEZZA_MASSIMA_TESTO);
  const normalizzato = normalizzaPerRegola(dato);
  const valore = normalizzaPerRegola(condizione.valore);
  switch (condizione.operatore) {
    case 'vuoto': return dato.trim() === '';
    case 'non_vuoto': return dato.trim() !== '';
    case 'uguale': return letto !== null && stessoValore(normalizzato, valore);
    case 'diverso': return !stessoValore(normalizzato, valore);
    case 'contiene': return letto !== null && normalizzato.includes(valore);
    case 'non_contiene': return !normalizzato.includes(valore);
    case 'inizia': return letto !== null && normalizzato.startsWith(valore);
    case 'finisce': return letto !== null && normalizzato.endsWith(valore);
    case 'uno_di': return letto !== null && condizione.valori.some(alternativa => stessoValore(normalizzato, normalizzaPerRegola(alternativa)));
    case 'regex': {
      const regex = compilata(condizione.valore);
      return letto !== null && regex !== null && regex.test(dato);
    }
    case 'maggiore': {
      const numero = comeNumero(dato);
      const soglia = comeNumero(condizione.valore);
      return numero !== null && soglia !== null && numero > soglia;
    }
    case 'minore': {
      const numero = comeNumero(dato);
      const soglia = comeNumero(condizione.valore);
      return numero !== null && soglia !== null && numero < soglia;
    }
    case 'tra': {
      const numero = comeNumero(dato);
      const [minimo, massimo] = condizione.valori.map(comeNumero);
      return numero !== null && minimo !== null && massimo !== null && numero >= minimo && numero <= massimo;
    }
  }
}

/** Una condizione, o un gruppo, vale per quello che `leggi` dà. Un gruppo senza voci non vale mai. */
export function nodoVale(nodo: NodoRegolaMenabo, leggi: LeggiCampoRegola): boolean {
  if (nodo.tipo === 'condizione') return condizioneVale(nodo, leggi(nodo.campo));
  if (nodo.figli.length === 0) return false;
  switch (nodo.logica) {
    case 'tutte': return nodo.figli.every(figlio => nodoVale(figlio, leggi));
    case 'una': return nodo.figli.some(figlio => nodoVale(figlio, leggi));
    case 'nessuna': return !nodo.figli.some(figlio => nodoVale(figlio, leggi));
  }
}

export const gruppoVale = (gruppo: GruppoRegolaMenabo, leggi: LeggiCampoRegola): boolean => nodoVale(gruppo, leggi);

export interface OpzioniValutazione {
  /** Il nome leggibile che dichiara la libreria agenzia, per la trasformazione «leggibile». */
  leggibile?: (valore: string) => string | null;
}

/**
 * Il risultato della prima regola del livello indicato che vale per almeno uno dei `contesti` (le referenze
 * di un box, o di tutti i box di una pagina). Un modello che dà un nome vuoto non decide: si passa alla
 * regola successiva. Null: nessuna regola vale.
 */
export function primaRegolaChe(
  regole: readonly RegolaMenabo[],
  livello: 'box' | 'pagina',
  contesti: readonly LeggiCampoRegola[],
  opzioni: OpzioniValutazione = {},
): RisultatoRegolaMenabo | null {
  for (const regola of regole) {
    if (regola.livello !== livello) continue;
    const contesto = contesti.find(leggi => gruppoVale(regola.condizione, leggi));
    if (!contesto) continue;
    const nome = regola.sezione === null ? null : nomeDaModello(regola.sezione, contesto, opzioni.leggibile);
    if (nome === '') continue;
    return { nome, colore: regola.colore, regola: regola.titolo ?? regola.id };
  }
  return null;
}
