import { formatNumero, VALORE_ASSENTE } from "@/utils/format";
import { formattaValore } from "../../../../lib/insightVolantino/calore";
import type { Affidabilita, TipoPrevisione } from "../../../../lib/insightVolantino/rendimento";

/**
 * Testi comuni a previsione e simulazione (scheda del box, riquadro della previsione, simulatore):
 * affidabilità, tipo di stima, valori previsti e scarto dal reale. Funzioni pure.
 */

export const ETICHETTE_AFFIDABILITA: Readonly<Record<Affidabilita, string>> = {
  alta: "Alta",
  media: "Media",
  bassa: "Bassa",
};

/** Variante del Badge: alta in verde, media in ambra, bassa in rosso. */
export const VARIANTE_AFFIDABILITA: Readonly<Record<Affidabilita, "success" | "warning" | "error">> = {
  alta: "success",
  media: "warning",
  bassa: "error",
};

export const ETICHETTE_TIPO_PREVISIONE: Readonly<Record<TipoPrevisione, string>> = {
  vendite: "Dallo storico delle vendite",
  teorica: "Stima teorica",
};

/** "12 casi storici", "1 caso storico". */
export const testoCasi = (casi: number): string => (casi === 1 ? "1 caso storico" : `${formatNumero(casi)} casi storici`);

/** "1.234 pezzi" o "indice 64 su 100": il valore previsto nella sua unità. */
export const testoPrevisto = (valore: number | null, unita: "pezzi" | "indice"): string => {
  if (valore === null || !Number.isFinite(valore)) return VALORE_ASSENTE;
  if (unita === "indice") return `indice ${formattaValore(valore, "indice")} su 100`;
  const pezzi = Math.round(valore);
  return pezzi === 1 ? "1 pezzo" : `${formatNumero(pezzi)} pezzi`;
};

/** Scarto del reale dal previsto in %: positivo se si è venduto più del previsto; null senza un previsto. */
export const scartoPercentuale = (previsto: number, reale: number | null): number | null =>
  reale === null || !Number.isFinite(reale) || !(previsto > 0) ? null : ((reale - previsto) / previsto) * 100;

/** "+12%", "−8%", "in linea" sotto il punto percentuale. */
export const testoScarto = (scarto: number | null): string => {
  if (scarto === null) return VALORE_ASSENTE;
  const arrotondato = Math.round(scarto);
  if (arrotondato === 0) return "in linea";
  return `${arrotondato > 0 ? "+" : "−"}${formatNumero(Math.abs(arrotondato))}%`;
};

/** Indice della posizione: 1 = media delle posizioni del volantino. */
export const testoIndicePosizione = (indice: number): string => {
  if (!Number.isFinite(indice)) return VALORE_ASSENTE;
  if (indice >= 1.05) return "meglio della media delle posizioni del volantino";
  if (indice <= 0.95) return "peggio della media delle posizioni del volantino";
  return "nella media delle posizioni del volantino";
};
