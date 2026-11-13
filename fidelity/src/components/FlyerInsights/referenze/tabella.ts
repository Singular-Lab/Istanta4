import type { ReferenzaPosizione } from "@/types/flyerInsights";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import { chiaveRuolo } from "../../../../lib/insightVolantino/ruolo";
import type { MeccanicaReferenza } from "../../../../lib/puntiVendita/analisi";
import { normalizzaRicerca, ordineLettura } from "../volantino/analisiPagina";

/**
 * Le righe della tabella "Referenze in volantino": una per box, con i prodotti del box letti dalle
 * referenze di sempre (campi della config, quindi senza tipi certi), la ricerca, i filtri e
 * l'ordinamento. Funzioni pure.
 */

/** Un prodotto del box come lo dicono le referenze: per l'elenco dei box con più prodotti. */
export interface ProdottoDelBox {
  id: string;
  nome: string;
  codice: string | null;
  prezzo: number | null;
}

export interface RigaReferenza {
  box: BoxInsight;
  /** Tutti i prodotti del box, pilota compreso, nell'ordine di idReferenze; solo quelli trovati. */
  prodotti: ProdottoDelBox[];
  /** Nome, marca, formato e codici, normalizzati per la ricerca. */
  testo: string;
}

/** Tutte, solo le linee del distributore, solo il Prezzo Fidelity, solo il sottocosto. */
export type FiltroRapido = "tutte" | "distributore" | "fidelity" | "sottocosto";

/** Il valore dei filtri a tendina che vuol dire "tutti". */
export const TUTTI = "";
/** Il valore dei filtri per i box senza reparto o senza meccanica riconosciuta. */
export const SENZA = "senza";

export interface FiltriReferenze {
  testo: string;
  rapido: FiltroRapido;
  /** Codice del reparto, SENZA o TUTTI. */
  reparto: string;
  /** Meccanica, SENZA o TUTTI. */
  meccanica: MeccanicaReferenza | typeof SENZA | typeof TUTTI;
  /** Numero di pagina come testo, o TUTTI. */
  pagina: string;
  /**
   * I ruoli scelti, come li scrive il server, o SENZA per i box senza ruolo: un box risponde con almeno
   * uno dei ruoli scelti. Nessuno vuol dire tutti.
   */
  ruoli: readonly string[];
}

export const FILTRI_VUOTI: FiltriReferenze = { testo: "", rapido: "tutte", reparto: TUTTI, meccanica: TUTTI, pagina: TUTTI, ruoli: [] };

/**
 * I ruoli dei prodotti del box, senza ripetizioni e nell'ordine dei prodotti: lo stesso ruolo scritto
 * in modi diversi (server non aggiornati) vale una volta, con la prima scrittura.
 */
export const ruoliDelBox = (box: Pick<BoxInsight, "dettaglioProdotti">): string[] => {
  const ruoli = new Map<string, string>();
  for (const prodotto of box.dettaglioProdotti ?? []) {
    const ruolo = prodotto.ruolo?.trim();
    if (ruolo && !ruoli.has(chiaveRuolo(ruolo))) ruoli.set(chiaveRuolo(ruolo), ruolo);
  }
  return [...ruoli.values()];
};

/**
 * I ruoli del box per le righe dell'analisi della pagina e dell'interrogazione: "Ruolo Star", "Ruolo
 * Star, Base", con la parola davanti perché non si confondano con la marca; null senza ruolo.
 */
export const testoRuoli = (box: Pick<BoxInsight, "dettaglioProdotti">): string | null => {
  const ruoli = ruoliDelBox(box);
  return ruoli.length > 0 ? `Ruolo ${ruoli.join(", ")}` : null;
};

/** I ruoli dei box del volantino, per nome, e se qualche box non ne ha. */
export const ruoliDeiBox = (box: readonly BoxInsight[]): { ruoli: string[]; senzaRuolo: boolean } => {
  const ruoli = new Map<string, string>();
  let senzaRuolo = false;
  for (const voce of box) {
    const suoi = ruoliDelBox(voce);
    if (suoi.length === 0) senzaRuolo = true;
    for (const ruolo of suoi) if (!ruoli.has(chiaveRuolo(ruolo))) ruoli.set(chiaveRuolo(ruolo), ruolo);
  }
  return { ruoli: [...ruoli.values()].sort((a, b) => a.localeCompare(b, "it")), senzaRuolo };
};

/**
 * Il box risponde quando almeno un suo prodotto ha uno dei ruoli scelti (SENZA: nessun prodotto ne ha
 * uno); senza ruoli scelti risponde sempre.
 */
const passaRuoli = (box: BoxInsight, scelti: readonly string[]): boolean => {
  if (scelti.length === 0) return true;
  const suoi = ruoliDelBox(box).map(chiaveRuolo);
  return scelti.some(ruolo => (ruolo === SENZA ? suoi.length === 0 : suoi.includes(chiaveRuolo(ruolo))));
};

export type ColonnaOrdinabile = "pagina" | "prezzo" | "sconto" | "spazio";
export type Direzione = "asc" | "desc";

export interface Ordinamento {
  colonna: ColonnaOrdinabile;
  direzione: Direzione;
}

export const ORDINAMENTO_PREDEFINITO: Ordinamento = { colonna: "pagina", direzione: "asc" };

/** La prima volta che si sceglie una colonna: pagina e prezzo dal più basso, sconto e spazio dal più alto. */
export const DIREZIONE_INIZIALE: Readonly<Record<ColonnaOrdinabile, Direzione>> = {
  pagina: "asc",
  prezzo: "asc",
  sconto: "desc",
  spazio: "desc",
};

const testoCampo = (valore: unknown): string => (typeof valore === "string" || typeof valore === "number" ? String(valore).trim() : "");

/** "Mozzarella di bufala 125 g": le righe di descrizione della referenza, senza gli a capo "$br". */
export const nomeReferenza = (referenza: ReferenzaPosizione): string =>
  [referenza.descrizione, referenza.descrizioneDue, referenza.descrizioneTre, referenza.descrizioneQuattro]
    .map(testoCampo)
    .filter(Boolean)
    .join(" ")
    .replace(/\$br/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Il prezzo delle referenze arriva come numero o come testo ("1,69"): null se non si legge. */
const prezzoReferenza = (valore: unknown): number | null => {
  if (typeof valore === "number") return Number.isFinite(valore) ? valore : null;
  if (typeof valore !== "string" || !valore.trim()) return null;
  const numero = Number(valore.replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
};

export const prodottoDaReferenza = (referenza: ReferenzaPosizione): ProdottoDelBox => ({
  id: String(referenza.id),
  nome: nomeReferenza(referenza),
  codice: testoCampo(referenza.codiceReferenza) || null,
  prezzo: prezzoReferenza(referenza.prezzo),
});

/** Le righe della tabella: i box con i loro prodotti, presi dalle referenze per id. */
export const righeReferenze = (box: readonly BoxInsight[], referenze: readonly ReferenzaPosizione[] = []): RigaReferenza[] => {
  const perId = new Map(referenze.map(referenza => [String(referenza.id), referenza]));
  return box.map(voce => {
    const prodotti = voce.idReferenze.flatMap(id => {
      const referenza = perId.get(id);
      return referenza ? [prodottoDaReferenza(referenza)] : [];
    });
    const testo = normalizzaRicerca(
      [voce.nome, voce.marca, voce.formato, voce.codiceBox, ...prodotti.flatMap(prodotto => [prodotto.nome, prodotto.codice])].filter(Boolean).join(" ")
    );
    return { box: voce, prodotti, testo };
  });
};

const passaRapido = (box: BoxInsight, rapido: FiltroRapido): boolean => {
  switch (rapido) {
    case "tutte":
      return true;
    case "distributore":
      return Boolean(box.linea);
    case "fidelity":
      return box.meccanica === "fidelity";
    case "sottocosto":
      return box.sottocosto;
  }
};

/** Le righe che passano tutti i filtri: il testo deve contenere tutte le parole cercate. */
export const filtraRighe = (righe: readonly RigaReferenza[], filtri: FiltriReferenze): RigaReferenza[] => {
  const parole = normalizzaRicerca(filtri.testo).split(" ").filter(Boolean);
  return righe.filter(({ box, testo }) => {
    if (parole.length > 0 && !parole.every(parola => testo.includes(parola))) return false;
    if (!passaRapido(box, filtri.rapido)) return false;
    if (filtri.reparto !== TUTTI && (box.reparto?.codice ?? SENZA) !== filtri.reparto) return false;
    if (filtri.meccanica !== TUTTI && (box.meccanica ?? SENZA) !== filtri.meccanica) return false;
    if (filtri.pagina !== TUTTI && String(box.pagina ?? "") !== filtri.pagina) return false;
    if (!passaRuoli(box, filtri.ruoli)) return false;
    return true;
  });
};

/**
 * Quanti box ha ogni ruolo con gli altri filtri, per chiave del ruolo (chiaveRuolo), e quanti non ne
 * hanno, sotto SENZA: i numeri accanto alle pillole del filtro.
 */
export const contaRuoli = (righe: readonly RigaReferenza[], filtri: FiltriReferenze): Map<string, number> => {
  const conti = new Map<string, number>();
  for (const { box } of filtraRighe(righe, { ...filtri, ruoli: [] })) {
    const suoi = ruoliDelBox(box);
    if (suoi.length === 0) conti.set(SENZA, (conti.get(SENZA) ?? 0) + 1);
    for (const ruolo of suoi) conti.set(chiaveRuolo(ruolo), (conti.get(chiaveRuolo(ruolo)) ?? 0) + 1);
  }
  return conti;
};

/** I filtri sono quelli di partenza: niente testo, nessun filtro rapido, a tendina o ruolo scelto. */
export const senzaFiltri = (filtri: FiltriReferenze): boolean =>
  filtri.testo.trim() === "" &&
  filtri.rapido === "tutte" &&
  filtri.reparto === TUTTI &&
  filtri.meccanica === TUTTI &&
  filtri.pagina === TUTTI &&
  filtri.ruoli.length === 0;

/** Quante righe ha ogni filtro rapido, sul resto dei filtri. */
export const contaRapidi = (righe: readonly RigaReferenza[], filtri: FiltriReferenze): Record<FiltroRapido, number> => {
  const conti: Record<FiltroRapido, number> = { tutte: 0, distributore: 0, fidelity: 0, sottocosto: 0 };
  for (const rapido of Object.keys(conti) as FiltroRapido[]) conti[rapido] = filtraRighe(righe, { ...filtri, rapido }).length;
  return conti;
};

const valoreColonna = (box: BoxInsight, colonna: ColonnaOrdinabile): number | null => {
  switch (colonna) {
    case "pagina":
      return box.pagina;
    case "prezzo":
      return box.prezzo;
    case "sconto":
      return box.sconto;
    case "spazio":
      return box.geometria ? box.spazio : null;
  }
};

/**
 * Le righe ordinate per colonna. I valori mancanti vanno sempre in fondo, in tutte e due le direzioni;
 * a parità decide l'ordine di lettura del volantino, poi il nome, così l'ordine è stabile.
 */
export const ordinaRighe = (righe: readonly RigaReferenza[], { colonna, direzione }: Ordinamento): RigaReferenza[] => {
  const segno = direzione === "asc" ? 1 : -1;
  return [...righe].sort((a, b) => {
    const va = valoreColonna(a.box, colonna);
    const vb = valoreColonna(b.box, colonna);
    if (va !== vb) {
      if (va === null) return 1;
      if (vb === null) return -1;
      return segno * (va - vb);
    }
    return ordineLettura(a.box, b.box) || a.box.nome.localeCompare(b.box.nome, "it");
  });
};

/**
 * La ricerca dall'indirizzo (?referenza=) vale solo se trova qualcosa: un id di referenza non è
 * nel testo cercabile, e la tabella partirebbe vuota.
 */
export const ricercaUtile = (righe: readonly RigaReferenza[], ricerca: string): string =>
  ricerca.trim() && filtraRighe(righe, { ...FILTRI_VUOTI, testo: ricerca }).length > 0 ? ricerca.trim() : "";
