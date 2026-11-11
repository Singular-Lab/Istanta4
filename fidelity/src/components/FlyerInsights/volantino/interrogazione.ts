import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import { ETICHETTA_MECCANICA, MECCANICHE } from "../../../../lib/puntiVendita/analisi";
import { normalizzaRicerca, ordineLettura } from "./analisiPagina";

/**
 * L'interrogazione dei box del volantino (spec insight-volantino, "Interrogazione dei box del
 * volantino"): condizioni su reparto, settore, segmento, tema, ruolo, marca, linea, bolli,
 * meccanica, sottocosto, punti, EAN e origine, e intervalli su prezzo, sconto, spazio, pagine e
 * prodotti del box. Più valori della stessa condizione valgono in alternativa, condizioni diverse
 * tutte insieme. Solo dai box già restituiti dall'API: niente vendite, previsioni, calore o
 * visibilità stimata. Funzioni pure.
 */

export type IdScelta =
  | "reparto"
  | "settore"
  | "segmento"
  | "tema"
  | "ruolo"
  | "marca"
  | "linea"
  | "bolli"
  | "meccanica"
  | "meccanicaOriginale"
  | "sottocosto"
  | "punti"
  | "ean"
  | "origine";

export type IdIntervallo = "prezzo" | "sconto" | "spazio" | "pagine" | "prodotti";

export interface Intervallo {
  da: number | null;
  a: number | null;
}

export interface Interrogazione {
  /** Per ogni condizione, le chiavi dei valori scelti: almeno uno deve valere per il box. */
  scelte: Partial<Record<IdScelta, readonly string[]>>;
  intervalli: Partial<Record<IdIntervallo, Intervallo>>;
}

export const INTERROGAZIONE_VUOTA: Interrogazione = { scelte: {}, intervalli: {} };

/** Il valore dei box senza il dato (reparto non noto, meccanica non riconosciuta). */
export const SENZA = "senza";
const SI = "si";
const NO = "no";

export interface ValoreCondizione {
  chiave: string;
  etichetta: string;
}

type Box = BoxInsight;

/* ---------- Valori dei box ---------- */

/** I valori diversi di un testo, per chiave normalizzata: "CARNI" e "Carni" sono lo stesso valore. */
const valoriTesto = (testi: ReadonlyArray<string | null | undefined>): ValoreCondizione[] => {
  const valori = new Map<string, string>();
  for (const testo of testi) {
    const pulito = testo?.trim();
    if (!pulito) continue;
    const chiave = normalizzaRicerca(pulito);
    if (!valori.has(chiave)) valori.set(chiave, pulito);
  }
  return [...valori].map(([chiave, etichetta]) => ({ chiave, etichetta }));
};

const siNo = (vero: boolean, siEtichetta: string, noEtichetta: string): ValoreCondizione[] =>
  vero ? [{ chiave: SI, etichetta: siEtichetta }] : [{ chiave: NO, etichetta: noEtichetta }];

const dalProdotto = (voce: Box, campo: "settore" | "segmento" | "tema" | "ruolo"): ValoreCondizione[] =>
  valoriTesto((voce.dettaglioProdotti ?? []).map(prodotto => prodotto[campo]));

const ORIGINE: Readonly<Record<NonNullable<Box["origine"]>, string>> = { listino: "Dal listino", fuori_listino: "Fuori listino" };

interface DefinizioneScelta {
  id: IdScelta;
  etichetta: string;
  valori: (voce: Box) => ValoreCondizione[];
  /** Ordine dei valori quando non vanno per numero di box. */
  ordine?: readonly string[];
  /** Solo se almeno un box ha uno di questi valori: per sì/no, almeno un sì. */
  serve?: (chiave: string) => boolean;
}

const DEFINIZIONI: readonly DefinizioneScelta[] = [
  {
    id: "reparto",
    etichetta: "Reparto",
    valori: voce =>
      voce.reparto
        ? [{ chiave: voce.reparto.codice || voce.reparto.descrizione, etichetta: voce.reparto.descrizione || voce.reparto.codice }]
        : [{ chiave: SENZA, etichetta: "Reparto non noto" }],
  },
  { id: "settore", etichetta: "Settore", valori: voce => dalProdotto(voce, "settore") },
  { id: "segmento", etichetta: "Segmento", valori: voce => dalProdotto(voce, "segmento") },
  { id: "tema", etichetta: "Tema", valori: voce => dalProdotto(voce, "tema") },
  { id: "ruolo", etichetta: "Ruolo", valori: voce => dalProdotto(voce, "ruolo") },
  { id: "marca", etichetta: "Marca", valori: voce => valoriTesto([voce.marca, ...(voce.dettaglioProdotti ?? []).map(prodotto => prodotto.marca)]) },
  { id: "linea", etichetta: "Linea del distributore", valori: voce => (voce.linea ? [{ chiave: voce.linea.sigla, etichetta: voce.linea.nome || voce.linea.sigla }] : []) },
  { id: "bolli", etichetta: "Bolli", valori: voce => (voce.bolli ?? []).map(sigla => ({ chiave: sigla, etichetta: sigla })) },
  {
    id: "meccanica",
    etichetta: "Meccanica",
    valori: voce => (voce.meccanica ? [{ chiave: voce.meccanica, etichetta: ETICHETTA_MECCANICA[voce.meccanica] }] : [{ chiave: SENZA, etichetta: "Non riconosciuta" }]),
    ordine: MECCANICHE,
  },
  { id: "meccanicaOriginale", etichetta: "Meccanica nella fonte", valori: voce => valoriTesto([voce.meccanicaOriginale]) },
  { id: "sottocosto", etichetta: "Sottocosto", valori: voce => siNo(voce.sottocosto, "Sottocosto", "Non sottocosto"), ordine: [SI, NO], serve: chiave => chiave === SI },
  { id: "punti", etichetta: "Punti", valori: voce => siNo(Boolean(voce.punti), "Con punti", "Senza punti"), ordine: [SI, NO], serve: chiave => chiave === SI },
  {
    id: "ean",
    etichetta: "EAN",
    // Con i server non aggiornati i prodotti non arrivano: il dato non c'è, non "senza EAN"
    valori: voce =>
      voce.dettaglioProdotti ? siNo(voce.dettaglioProdotti.some(prodotto => prodotto.ean.length > 0), "Con EAN", "Senza EAN") : [],
    ordine: [SI, NO],
    serve: chiave => chiave === SI,
  },
  {
    id: "origine",
    etichetta: "Origine",
    valori: voce => (voce.origine ? [{ chiave: voce.origine, etichetta: ORIGINE[voce.origine] }] : []),
    ordine: ["listino", "fuori_listino"],
  },
];

const PER_ID = new Map(DEFINIZIONI.map(definizione => [definizione.id, definizione]));

/** Le chiavi dei valori di un box per una condizione. */
const chiaviDi = (voce: Box, id: IdScelta): string[] => (PER_ID.get(id)?.valori(voce) ?? []).map(valore => valore.chiave);

/* ---------- Intervalli ---------- */

export interface DefinizioneIntervallo {
  id: IdIntervallo;
  etichetta: string;
  /** "€", "%", "% della pagina" o "" (numeri interi). */
  unita: string;
  passo: number;
}

export const INTERVALLI: readonly DefinizioneIntervallo[] = [
  { id: "prezzo", etichetta: "Prezzo", unita: "€", passo: 0.01 },
  { id: "sconto", etichetta: "Sconto", unita: "%", passo: 1 },
  { id: "spazio", etichetta: "Spazio", unita: "% della pagina", passo: 1 },
  { id: "pagine", etichetta: "Pagine", unita: "", passo: 1 },
  { id: "prodotti", etichetta: "Prodotti nel box", unita: "", passo: 1 },
];

const numero = (valore: number | null | undefined): number | null => (typeof valore === "number" && Number.isFinite(valore) ? valore : null);

/** Il valore del box per un intervallo; null se il box non l'ha (nessun prezzo, nessuna posizione...). */
export const valoreIntervallo = (voce: Box, id: IdIntervallo): number | null => {
  switch (id) {
    case "prezzo":
      return numero(voce.prezzo);
    case "sconto":
      return numero(voce.sconto);
    case "spazio":
      return voce.geometria ? numero(voce.spazio) : null;
    case "pagine":
      return numero(voce.pagina);
    case "prodotti":
      return numero(voce.prodotti);
  }
};

const intervalloAttivo = (intervallo: Intervallo | undefined): intervallo is Intervallo =>
  intervallo !== undefined && (intervallo.da !== null || intervallo.a !== null);

const dentro = (valore: number | null, { da, a }: Intervallo): boolean => valore !== null && (da === null || valore >= da) && (a === null || valore <= a);

/* ---------- Interrogazione ---------- */

/** Quante condizioni sono attive: ogni condizione con almeno un valore scelto, ogni intervallo con un limite. */
export const condizioniAttive = (interrogazione: Interrogazione): number =>
  Object.values(interrogazione.scelte).filter(scelte => (scelte?.length ?? 0) > 0).length +
  Object.values(interrogazione.intervalli).filter(intervalloAttivo).length;

export const interrogazioneVuota = (interrogazione: Interrogazione): boolean => condizioniAttive(interrogazione) === 0;

/** Il box rispetta tutte le condizioni (tranne `escludi`, per i conteggi di quella condizione). */
export const rispetta = (voce: Box, interrogazione: Interrogazione, escludi?: IdScelta): boolean => {
  for (const [id, scelte] of Object.entries(interrogazione.scelte) as Array<[IdScelta, readonly string[] | undefined]>) {
    if (id === escludi || !scelte || scelte.length === 0) continue;
    const suoi = chiaviDi(voce, id);
    if (!suoi.some(chiave => scelte.includes(chiave))) return false;
  }
  for (const [id, intervallo] of Object.entries(interrogazione.intervalli) as Array<[IdIntervallo, Intervallo | undefined]>) {
    if (intervalloAttivo(intervallo) && !dentro(valoreIntervallo(voce, id), intervallo)) return false;
  }
  return true;
};

/**
 * I box che rispondono, in ordine di lettura: solo quelli con una pagina, perché si possano
 * mostrare. Null senza condizioni: nessuna interrogazione in corso.
 */
export const interroga = <T extends Box>(box: readonly T[], interrogazione: Interrogazione): T[] | null => {
  if (interrogazioneVuota(interrogazione)) return null;
  return box.filter(voce => voce.pagina !== null && rispetta(voce, interrogazione)).sort(ordineLettura);
};

/* ---------- Condizioni da proporre, con i conteggi ---------- */

export interface ValoreConConteggio extends ValoreCondizione {
  /** Box che hanno il valore e rispettano le altre condizioni scelte. */
  box: number;
  scelto: boolean;
}

export interface Condizione {
  id: IdScelta;
  etichetta: string;
  valori: ValoreConConteggio[];
}

/**
 * Le condizioni da proporre: solo quelle con un dato nel volantino (un valore diverso fra i box, o
 * un valore che non tutti i box hanno; per sì/no almeno un sì), con i soli valori presenti. Accanto
 * a ogni valore quanti box di `base` (i box già ristretti dalla ricerca) lo hanno rispettando le
 * altre condizioni. Un valore scelto resta anche quando ne ha zero, per poterlo togliere.
 */
export function condizioniDisponibili(tutti: readonly Box[], base: readonly Box[], interrogazione: Interrogazione): Condizione[] {
  const condizioni: Condizione[] = [];
  for (const definizione of DEFINIZIONI) {
    const presenti = new Map<string, string>();
    let senzaDato = 0;
    /** L'etichetta del valore "senza" (reparto non noto...), se qualche box l'ha. */
    let senza: string | null = null;
    for (const voce of tutti) {
      const valori = definizione.valori(voce);
      if (valori.every(valore => valore.chiave === SENZA)) senzaDato += 1;
      for (const valore of valori) {
        if (valore.chiave === SENZA) senza = valore.etichetta;
        else if (!presenti.has(valore.chiave)) presenti.set(valore.chiave, valore.etichetta);
      }
    }
    const utile = definizione.serve ? [...presenti.keys()].some(definizione.serve) : presenti.size > 1 || (presenti.size === 1 && senzaDato > 0);
    if (!utile) continue;
    // Il valore "senza" si propone solo accanto ad altri valori: da solo non distingue nulla
    if (senza !== null) presenti.set(SENZA, senza);

    const scelte = interrogazione.scelte[definizione.id] ?? [];
    const conti = new Map<string, number>();
    for (const voce of base) {
      if (!rispetta(voce, interrogazione, definizione.id)) continue;
      for (const chiave of new Set(chiaviDi(voce, definizione.id))) conti.set(chiave, (conti.get(chiave) ?? 0) + 1);
    }
    const posto = (chiave: string): number => {
      const indice = definizione.ordine?.indexOf(chiave) ?? -1;
      return indice < 0 ? Number.MAX_SAFE_INTEGER : indice;
    };
    const valori = [...presenti]
      .map(([chiave, etichetta]) => ({ chiave, etichetta, box: conti.get(chiave) ?? 0, scelto: scelte.includes(chiave) }))
      .sort(
        (a, b) =>
          Number(a.chiave === SENZA) - Number(b.chiave === SENZA) ||
          posto(a.chiave) - posto(b.chiave) ||
          b.box - a.box ||
          a.etichetta.localeCompare(b.etichetta, "it")
      );
    condizioni.push({ id: definizione.id, etichetta: definizione.etichetta, valori });
  }
  return condizioni;
}

export interface IntervalloDisponibile extends DefinizioneIntervallo {
  /** Il valore più basso e il più alto fra i box del volantino. */
  minimo: number;
  massimo: number;
}

/** Gli intervalli da proporre: solo quelli con valori diversi fra i box del volantino. */
export function intervalliDisponibili(tutti: readonly Box[]): IntervalloDisponibile[] {
  return INTERVALLI.flatMap(definizione => {
    const valori = tutti.map(voce => valoreIntervallo(voce, definizione.id)).filter((valore): valore is number => valore !== null);
    if (valori.length === 0) return [];
    const minimo = Math.min(...valori);
    const massimo = Math.max(...valori);
    return minimo === massimo ? [] : [{ ...definizione, minimo, massimo }];
  });
}

/* ---------- Modifiche ---------- */

/** Sceglie o toglie un valore di una condizione. */
export const alternaValore = (interrogazione: Interrogazione, id: IdScelta, chiave: string): Interrogazione => {
  const attuali = interrogazione.scelte[id] ?? [];
  const scelte = attuali.includes(chiave) ? attuali.filter(voce => voce !== chiave) : [...attuali, chiave];
  return { ...interrogazione, scelte: { ...interrogazione.scelte, [id]: scelte } };
};

/** Cambia un intervallo; senza limiti l'intervallo non vale più. Un "da" oltre l'"a" si scambia. */
export const conIntervallo = (interrogazione: Interrogazione, id: IdIntervallo, intervallo: Intervallo): Interrogazione => {
  const { da, a } = intervallo;
  const ordinato = da !== null && a !== null && da > a ? { da: a, a: da } : { da, a };
  return { ...interrogazione, intervalli: { ...interrogazione.intervalli, [id]: ordinato } };
};

export const togliScelta = (interrogazione: Interrogazione, id: IdScelta): Interrogazione => ({
  ...interrogazione,
  scelte: { ...interrogazione.scelte, [id]: [] },
});

export const togliIntervallo = (interrogazione: Interrogazione, id: IdIntervallo): Interrogazione => ({
  ...interrogazione,
  intervalli: { ...interrogazione.intervalli, [id]: { da: null, a: null } },
});

/** Le condizioni attive in ordine, per i segni da togliere uno per uno. */
export type CondizioneAttiva =
  | { tipo: "scelta"; id: IdScelta; etichetta: string; valori: string[] }
  | { tipo: "intervallo"; id: IdIntervallo; etichetta: string; unita: string; intervallo: Intervallo };

export function elencoCondizioniAttive(interrogazione: Interrogazione, condizioni: readonly Condizione[]): CondizioneAttiva[] {
  const attive: CondizioneAttiva[] = [];
  for (const definizione of DEFINIZIONI) {
    const scelte = interrogazione.scelte[definizione.id] ?? [];
    if (scelte.length === 0) continue;
    const valori = condizioni.find(condizione => condizione.id === definizione.id)?.valori ?? [];
    attive.push({
      tipo: "scelta",
      id: definizione.id,
      etichetta: definizione.etichetta,
      valori: scelte.map(chiave => valori.find(valore => valore.chiave === chiave)?.etichetta ?? chiave),
    });
  }
  for (const definizione of INTERVALLI) {
    const intervallo = interrogazione.intervalli[definizione.id];
    if (intervalloAttivo(intervallo)) attive.push({ tipo: "intervallo", id: definizione.id, etichetta: definizione.etichetta, unita: definizione.unita, intervallo });
  }
  return attive;
}

/* ---------- Sintesi e ordine dei risultati ---------- */

export interface SintesiRisultati {
  box: number;
  /** Referenze dei box trovati (una per riga del box). */
  referenze: number;
  pagine: number;
  /** Spazio dei box trovati sullo spazio di tutti i box del volantino, in %; null senza spazio. */
  quotaSpazio: number | null;
  scontoMedio: number | null;
  prezzoMinimo: number | null;
  prezzoMedio: number | null;
  prezzoMassimo: number | null;
}

const somma = (valori: readonly number[]): number => valori.reduce((totale, valore) => totale + valore, 0);
const media = (valori: readonly number[]): number | null => (valori.length > 0 ? somma(valori) / valori.length : null);
const spazioDi = (voce: Box): number => (voce.geometria && numero(voce.spazio) !== null && voce.spazio > 0 ? voce.spazio : 0);

/** I numeri dei box trovati, rispetto a tutti i box del volantino. */
export function sintesiRisultati(trovati: readonly Box[], tutti: readonly Box[]): SintesiRisultati {
  const prezzi = trovati.map(voce => numero(voce.prezzo)).filter((valore): valore is number => valore !== null);
  const sconti = trovati.map(voce => numero(voce.sconto)).filter((valore): valore is number => valore !== null);
  const spazioTotale = somma(tutti.map(spazioDi));
  return {
    box: trovati.length,
    referenze: somma(trovati.map(voce => voce.idReferenze.length)),
    pagine: new Set(trovati.map(voce => voce.pagina).filter(pagina => pagina !== null)).size,
    quotaSpazio: spazioTotale > 0 ? (somma(trovati.map(spazioDi)) / spazioTotale) * 100 : null,
    scontoMedio: media(sconti),
    prezzoMinimo: prezzi.length > 0 ? Math.min(...prezzi) : null,
    prezzoMedio: media(prezzi),
    prezzoMassimo: prezzi.length > 0 ? Math.max(...prezzi) : null,
  };
}

export type OrdineRisultati = "pagina" | "prezzo" | "sconto" | "spazio";

export const OPZIONI_ORDINE: Array<{ valore: OrdineRisultati; etichetta: string }> = [
  { valore: "pagina", etichetta: "Pagina" },
  { valore: "prezzo", etichetta: "Prezzo" },
  { valore: "sconto", etichetta: "Sconto" },
  { valore: "spazio", etichetta: "Spazio" },
];

/** Dal valore più utile in cima, i box senza il dato in fondo; a parità, in ordine di lettura. */
const perValore =
  (valore: (voce: Box) => number | null, crescente: boolean) =>
  (a: Box, b: Box): number => {
    const va = valore(a);
    const vb = valore(b);
    if (va === null || vb === null) return Number(va === null) - Number(vb === null) || ordineLettura(a, b);
    return (crescente ? va - vb : vb - va) || ordineLettura(a, b);
  };

/** Pagina in ordine di lettura, prezzo dal più basso, sconto e spazio dal più alto. */
export const ordinaRisultati = <T extends Box>(box: readonly T[], ordine: OrdineRisultati): T[] => {
  const confronto: (a: Box, b: Box) => number =
    ordine === "pagina"
      ? ordineLettura
      : ordine === "prezzo"
        ? perValore(voce => numero(voce.prezzo), true)
        : ordine === "sconto"
          ? perValore(voce => numero(voce.sconto), false)
          : perValore(voce => (voce.geometria ? numero(voce.spazio) : null), false);
  return [...box].sort(confronto);
};
