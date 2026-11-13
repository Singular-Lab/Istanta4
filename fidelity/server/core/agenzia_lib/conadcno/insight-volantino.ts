import { descrizioneStandard } from "../../../../lib/insightVolantino/descrizione.js";
import { ORDINE_SEZIONI_STANDARD, riordinaSezioni, type ChiaveSezioneReport } from "../../utils/reportVolantino.js";
import type { InsightVolantinoAgenzia } from "../types.js";
import { lineeDistributoreConadCno } from "./linee-distributore.js";
import { menaboConadCno, RUOLI_CONAD_CNO, TEMI_CONAD_CNO } from "./ruoli-menabo.js";

/*
 * Report PDF del volantino per CONAD CNO (spec insight-volantino).
 *
 * - Palette: un rosso scuro come primario e un giallo ambra come accento, ispirati ai colori
 *   dell'insegna ma piu' sobri, adatti alla stampa. Nessun logo ne' marchio: il cliente non ce li
 *   ha forniti, in testata va il solo nome. Il resto (testi, fondi, positivo/negativo e categorie)
 *   resta lo standard, scelto per essere leggibile anche da chi non vede i colori.
 * - Sezioni: CONAD CNO fa un volantino per insegna e area, e la prima domanda dei category e' cosa
 *   e' cambiato rispetto all'edizione precedente della stessa insegna. Subito dopo la sintesi
 *   vengono quindi il confronto e i prodotti entrati e usciti; poi grafici e metodo come nello standard.
 * - Linee del distributore: le linee di marca CONAD e i bolli da contare negli insight, con la
 *   regola di Istanta per ricavare la linea dai testi stampati (linee-distributore.ts).
 * - Descrizione del box nella scheda: come si legge sul volantino CONAD, nome, marca in evidenza,
 *   formato e varianti ("Gelato Nutella 230 g"). E' la composizione standard, dichiarata qui perche'
 *   e' una scelta per CONAD: un altro cliente puo' comporla diversamente nella sua libreria.
 * - Ruoli, temi e menabò: le etichette dei ruoli e dei temi delle referenze e la mastro come
 *   sezione delle pagine del menabò del volantino (ruoli-menabo.ts).
 */

const ORDINE_CONAD_CNO: readonly ChiaveSezioneReport[] = [
  "sintesi",
  "confronto",
  "entratiUsciti",
  ...ORDINE_SEZIONI_STANDARD.filter(chiave => !["sintesi", "confronto", "entratiUsciti"].includes(chiave)),
];

export const insightVolantinoConadCno: InsightVolantinoAgenzia = {
  palette: {
    primario: "#9e1b22",
    accento: "#c98a00",
  },
  intestazione: {
    cliente: "Conad Centro Nord",
    riservatezza: "Riservato - uso interno",
  },
  sezioniReport: (_dati, standard) => riordinaSezioni(standard, ORDINE_CONAD_CNO),
  lineeDistributore: lineeDistributoreConadCno,
  descrizioneBox: descrizioneStandard,
  ruoli: RUOLI_CONAD_CNO,
  temi: TEMI_CONAD_CNO,
  menabo: menaboConadCno,
};
