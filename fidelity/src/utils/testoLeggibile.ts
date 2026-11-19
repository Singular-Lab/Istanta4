/**
 * Testi dell'anagrafica scritti tutti in maiuscolo resi leggibili, solo a video (spec
 * anagrafica-punti-vendita, "Testi dell'anagrafica leggibili nella scheda di consultazione"):
 * "BARGA VIA CANIPAIA SNC" -> "Barga Via Canipaia snc". Il dato salvato non cambia.
 *
 * - Ogni parola con l'iniziale maiuscola; preposizioni e articoli in minuscolo, tranne in testa.
 * - In minuscolo le forme societarie e "snc" (senza numero civico).
 * - Restano come sono: sigle con il punto (S.P.), numeri romani (XX), lettere attaccate a un civico
 *   (12/A, 70E) e sigle di due lettere fra parentesi, come la provincia (LU).
 * - Un testo che ha gia' lettere minuscole e' scritto da qualcuno: resta com'e'.
 */

const MINUSCOLE_DOPO_LA_PRIMA = new Set([
  "di", "del", "dello", "della", "dei", "degli", "delle", "dell",
  "da", "dal", "dallo", "dalla", "dai", "dagli", "dalle", "dall",
  "a", "al", "allo", "alla", "ai", "agli", "alle", "all",
  "in", "nel", "nello", "nella", "nei", "negli", "nelle", "nell",
  "su", "sul", "sullo", "sulla", "sui", "sugli", "sulle", "sull",
  "con", "per", "tra", "fra", "e", "ed", "il", "lo", "la", "i", "gli", "le", "l", "d",
]);

const SEMPRE_MINUSCOLE = new Set(["snc", "srl", "srls", "spa", "sas"]);

const NUMERO_ROMANO = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

const minuscolo = (parola: string) => parola.toLocaleLowerCase("it-IT");
const conIniziale = (parola: string) => {
  const testo = minuscolo(parola);
  return testo.charAt(0).toLocaleUpperCase("it-IT") + testo.slice(1);
};

/** Una parte di parola (fra apostrofi), sapendo se apre il testo. */
function parte(pezzo: string, inTesta: boolean): string {
  const chiave = minuscolo(pezzo);
  if (SEMPRE_MINUSCOLE.has(chiave)) return chiave;
  // "DI" e "DAI" sarebbero anche numeri romani: le preposizioni hanno la precedenza
  if (MINUSCOLE_DOPO_LA_PRIMA.has(chiave)) return inTesta ? conIniziale(pezzo) : chiave;
  if (pezzo.length >= 2 && NUMERO_ROMANO.test(pezzo)) return pezzo;
  return conIniziale(pezzo);
}

export function testoLeggibile(testo: string): string;
export function testoLeggibile(testo: string | null | undefined): string | null | undefined;
export function testoLeggibile(testo: string | null | undefined): string | null | undefined {
  if (!testo || /\p{Ll}/u.test(testo) || !/\p{Lu}/u.test(testo)) return testo;
  let parole = 0;
  return testo.replace(/[\p{L}.'’]+/gu, (parola, posizione: number, tutto: string) => {
    if (!/\p{L}/u.test(parola)) return parola;
    const prima = tutto.charAt(posizione - 1);
    const dopo = tutto.charAt(posizione + parola.length);
    const inTesta = parole === 0;
    parole++;
    // Sigle col punto (S.P., C.SO) e lettere di un civico (12/A, 70E) restano come sono
    if (parola.includes(".") && /\p{L}\.\p{L}|^\p{L}{1,2}\.$/u.test(parola)) return parola;
    if (/[\d/]/.test(prima) && parola.length <= 2) return parola;
    // Due lettere fra parentesi: la provincia, "(LU)"
    if (prima === "(" && dopo === ")" && parola.length === 2) return parola;
    const pezzi = parola.split(/(['’])/);
    return pezzi
      .map((pezzo, i) => {
        if (pezzo === "'" || pezzo === "’" || pezzo === "") return pezzo;
        // Dopo l'apostrofo la parola riparte maiuscola: "dell'Arte", "Sant'Anna"
        return i === 0 ? parte(pezzo, inTesta) : conIniziale(pezzo);
      })
      .join("");
  });
}
