import type { InsightVolantinoAgenzia } from "../types.js";

/*
 * Report PDF del volantino per Coop Firenze (spec insight-volantino).
 *
 * - Palette: il rosso dell'insegna, appena scurito per la stampa, come primario e un blu profondo
 *   come accento, per staccare il dato chiave dal rosso della testata. Nessun logo ne' marchio: il
 *   cliente non ce li ha forniti, in testata va il solo nome. Il resto (testi, fondi,
 *   positivo/negativo e categorie) resta lo standard, leggibile anche da chi non vede i colori.
 * - Sezioni: quelle standard, nell'ordine standard (sezioniReport non dichiarato).
 */

export const insightVolantinoCoopFirenze: InsightVolantinoAgenzia = {
  palette: {
    primario: "#b0141d",
    accento: "#1f5f8b",
  },
  intestazione: {
    cliente: "Coop Firenze",
    riservatezza: "Riservato - uso interno",
  },
};
