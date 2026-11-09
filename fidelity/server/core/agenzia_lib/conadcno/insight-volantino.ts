import { REGOLE_PREVISIONE_STANDARD } from "../../../../lib/insightVolantino/rendimento.js";
import { PESI_VISIBILITA } from "../../../../lib/insightVolantino/tipi.js";
import { ORDINE_SEZIONI_STANDARD, riordinaSezioni, type ChiaveSezioneReport } from "../../utils/reportVolantino.js";
import type { InsightVolantinoAgenzia } from "../types.js";

/*
 * Report e insight del volantino per CONAD CNO (spec insight-volantino).
 *
 * - Palette: un rosso scuro come primario e un giallo ambra come accento, ispirati ai colori
 *   dell'insegna ma piu' sobri, adatti alla stampa. Nessun logo ne' marchio: il cliente non ce li
 *   ha forniti, in testata va il solo nome. Il resto (testi, fondi, positivo/negativo, categorie e
 *   scala di calore) resta lo standard, scelto per essere leggibile anche da chi non vede i colori.
 * - Pesi della visibilita' e regole della previsione: gli standard, dichiarati qui per poterli
 *   cambiare quando il cliente ne indichera' di propri.
 * - Sezioni: CONAD CNO fa un volantino per insegna e area, e la prima domanda dei category e' cosa
 *   e' cambiato rispetto all'edizione precedente della stessa insegna. Dopo la sintesi e la mappa
 *   (le zone calde restano subito dopo la sintesi, come nello standard) vengono quindi il confronto
 *   e i prodotti entrati e usciti; poi grafici, rendimento, previsione e metodo come nello standard.
 */

const ORDINE_CONAD_CNO: readonly ChiaveSezioneReport[] = [
  "sintesi",
  "mappa",
  "confronto",
  "entratiUsciti",
  ...ORDINE_SEZIONI_STANDARD.filter(chiave => !["sintesi", "mappa", "confronto", "entratiUsciti"].includes(chiave)),
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
  pesiVisibilita: { ...PESI_VISIBILITA },
  previsione: { ...REGOLE_PREVISIONE_STANDARD },
  sezioniReport: (_dati, standard) => riordinaSezioni(standard, ORDINE_CONAD_CNO),
};
