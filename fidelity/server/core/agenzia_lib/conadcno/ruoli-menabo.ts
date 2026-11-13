import type { MenaboAgenzia } from "../types.js";

/*
 * Ruoli, temi e menabò dei volantini CONAD CNO negli insight (spec insight-volantino, "Ruolo della
 * referenza leggibile", "Tema della referenza leggibile" e "Menabò del volantino").
 *
 * - Ruoli: Istanta e lo storico scrivono lo stesso ruolo in modi diversi ("base" e "BASE",
 *   "richiamo b&f" e "RICHIAMO B&F"). Qui l'etichetta di ognuno, per chiave in minuscolo, con le
 *   sigle in maiuscolo. Un ruolo nuovo, finche' non lo si aggiunge, esce con l'iniziale maiuscola.
 * - Temi: il campo tema arriva come codice dell'impaginazione ("tantealtreoff", "MNUMERI1"). Qui
 *   l'etichetta dei temi piu' usati, lette con l'utente il 2026-11-13; gli altri escono con
 *   l'iniziale maiuscola finche' non li si aggiunge.
 * - Menabò: la sezione di una pagina e' la mastro della pagina di InDesign su cui sono impaginate le
 *   referenze (campo mastro). La mastro arriva con una sigla davanti e con le indicazioni di
 *   impaginazione ("GAdx-GASTRONOMIA dx", "DIS-DISPENSA_doppia", "X-2025_SUPERMARCHE_FINO50_doppia"):
 *   il nome leggibile le toglie (nomeMastro). La mastro della pagina bianca non e' una sezione.
 */

export const RUOLI_CONAD_CNO: Readonly<Record<string, string>> = {
  base: "Base",
  star: "Star",
  vedette: "Vedette",
  "prima pagina": "Prima pagina",
  "co-marketing/artwork": "Co-marketing / artwork",
  "richiamo b&f": "Richiamo B&F",
  "richiamo cvs": "Richiamo CVS",
};

/** Le etichette dei temi CONAD CNO, per chiave in minuscolo con gli spazi singoli (chiaveRuolo). */
export const TEMI_CONAD_CNO: Readonly<Record<string, string>> = {
  tantealtreoff: "Tante altre offerte",
  frescaconv: "Freschi di convenienza",
  "fpulizia casa": "Focus pulizia casa",
  fpulicasasupe: "Focus pulizia casa Superstore",
  mnumeri1: "I numeri 1",
  rilancio: "Rilancio",
  ttminicoll: "Minicollection",
  mtaglioprezzo: "Taglio prezzo",
  fgrigliate: "Focus grigliate",
  fopetfood: "Focus pet food",
  richiamobf: "Richiamo B&F",
  ffestabirra: "Festa della birra",
  ffestamamma: "Festa della mamma",
  fscuola1: "Focus scuola",
  "mdd s&d": "MDD Sapori & Dintorni",
  convwow: "Convenienza wow",
};

/** Le parole tutte maiuscole fino a questa lunghezza sono sigle ("B&F", "CVS", "EX") e restano come sono. */
const LUNGHEZZA_SIGLA = 3;

/** Sigle piu' lunghe che restano in maiuscolo. */
const SIGLE = new Set(["SCSS"]);

/** Le indicazioni di impaginazione nel nome: lato della pagina, pagina doppia o singola, anno. */
const IMPAGINAZIONE = /^(dx|sx|doppia|singola|(19|20)\d\d)$/i;

/** La mastro che non e' una sezione: la pagina lasciata bianca per l'impaginazione. */
const NON_SEZIONE = /^pagina bianca$/i;

/** Una parola tutta maiuscola diventa minuscola, tranne le sigle. */
const parolaLeggibile = (parola: string): string =>
  /\p{Lu}/u.test(parola) && !/\p{Ll}/u.test(parola) && parola.replace(/[^\p{L}]/gu, "").length > LUNGHEZZA_SIGLA && !SIGLE.has(parola)
    ? parola.toLocaleLowerCase("it-IT")
    : parola;

/**
 * Il nome leggibile di una mastro: senza la sigla prima del primo trattino, con spazi al posto dei
 * trattini bassi e fra lettere e cifre ("NUMERI1" -> "Numeri 1"), con la "e" staccata fra due parole
 * maiuscole ("BELLEZZAeIGIENE" -> "Bellezza e igiene"), senza le indicazioni di impaginazione (dx,
 * sx, doppia, singola, l'anno), le parole tutte maiuscole in minuscolo e l'iniziale maiuscola.
 * "Og-OFFERTE generiche" diventa "Offerte generiche", "GAdx-GASTRONOMIA dx" "Gastronomia". Null per
 * la mastro della pagina bianca, che non e' una sezione; un nome che resterebbe vuoto resta com'e'.
 */
export function nomeMastro(valore: string): string | null {
  const pulito = valore.trim();
  const trattino = pulito.indexOf("-");
  const senzaSigla = trattino > 0 ? pulito.slice(trattino + 1) : pulito;
  const parole = senzaSigla
    .replace(/_+/g, " ")
    .replace(/(\p{Lu}{2,})e(\p{Lu}{2,})/gu, "$1 e $2")
    .replace(/(\p{L})(\d)/gu, "$1 $2")
    .trim()
    .split(/\s+/)
    .filter(parola => parola !== "" && !IMPAGINAZIONE.test(parola))
    .map(parolaLeggibile);
  if (parole.length === 0) return pulito;
  const nome = parole.join(" ");
  if (NON_SEZIONE.test(nome)) return null;
  return nome.charAt(0).toLocaleUpperCase("it-IT") + nome.slice(1);
}

export const menaboConadCno: MenaboAgenzia = {
  campo: "mastro",
  nome: nomeMastro,
};
