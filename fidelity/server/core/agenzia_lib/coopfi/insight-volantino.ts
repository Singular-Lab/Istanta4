import { REGOLE_PREVISIONE_STANDARD } from "../../../../lib/insightVolantino/rendimento.js";
import { PESI_VISIBILITA } from "../../../../lib/insightVolantino/tipi.js";
import { ORDINE_SEZIONI_STANDARD, riordinaSezioni, type ChiaveSezioneReport } from "../../utils/reportVolantino.js";
import type { InsightVolantinoAgenzia } from "../types.js";

/*
 * Report e insight del volantino per Coop Firenze (spec insight-volantino).
 *
 * - Palette: il rosso dell'insegna, appena scurito per la stampa, come primario e un blu profondo
 *   come accento, per staccare il dato chiave dal rosso della testata. Nessun logo ne' marchio: il
 *   cliente non ce li ha forniti, in testata va il solo nome. Il resto (testi, fondi,
 *   positivo/negativo, categorie e scala di calore) resta lo standard, leggibile anche da chi non
 *   vede i colori.
 * - Pesi della visibilita' e regole della previsione: gli standard, dichiarati qui per poterli
 *   cambiare quando il cliente ne indichera' di propri.
 * - Sezioni: per Coop Firenze il volantino si valuta prima di tutto su quanto rende lo spazio
 *   dato a ogni prodotto, quindi il rendimento dalle vendite viene subito dopo sintesi e mappa,
 *   prima dei grafici; il resto segue l'ordine standard. Senza vendite importate la sezione non
 *   c'e' e l'ordine coincide con lo standard.
 */

const ORDINE_COOP_FIRENZE: readonly ChiaveSezioneReport[] = [
  "sintesi",
  "mappa",
  "rendimento",
  ...ORDINE_SEZIONI_STANDARD.filter(chiave => !["sintesi", "mappa", "rendimento"].includes(chiave)),
];

export const insightVolantinoCoopFirenze: InsightVolantinoAgenzia = {
  palette: {
    primario: "#b0141d",
    accento: "#1f5f8b",
  },
  intestazione: {
    cliente: "Coop Firenze",
    riservatezza: "Riservato - uso interno",
  },
  pesiVisibilita: { ...PESI_VISIBILITA },
  previsione: { ...REGOLE_PREVISIONE_STANDARD },
  sezioniReport: (_dati, standard) => riordinaSezioni(standard, ORDINE_COOP_FIRENZE),
};
