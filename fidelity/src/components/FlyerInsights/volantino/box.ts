import type { ContenutoTooltip, RigaTooltip } from "@/components/Grafici";
import { formatEuro, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import type { BoxInsight, RepartoInsight } from "../../../../lib/insightVolantino/tipi";
import { ETICHETTA_MECCANICA } from "../../../../lib/puntiVendita/analisi";

/**
 * Testi dei box del volantino sfogliabile (nome per le tecnologie assistive, tooltip) e scelta del
 * box da aprire all'avvio. Funzioni pure.
 */

/**
 * Il box indicato all'avvio (per esempio da ?referenza= nell'indirizzo): per id del box, per id di
 * una sua referenza, per chiave del prodotto, infine per nome del prodotto (come lo passano i
 * collegamenti delle pagine dei punti vendita). Null se nessun box corrisponde.
 */
export const trovaBoxIniziale = <T extends Pick<BoxInsight, "id" | "idReferenze" | "chiave" | "nome">>(
  box: readonly T[],
  valore: string | null | undefined
): T | null => {
  const cercato = valore?.trim();
  if (!cercato) return null;
  const nome = cercato.toLocaleLowerCase("it");
  return (
    box.find(voce => voce.id === cercato) ??
    box.find(voce => voce.idReferenze.includes(cercato)) ??
    box.find(voce => voce.chiave === cercato) ??
    box.find(voce => voce.nome.trim().toLocaleLowerCase("it") === nome) ??
    null
  );
};

/** "Granarolo · 125 g": marca e formato, quelli che ci sono. */
export const marcaFormato = (box: Pick<BoxInsight, "marca" | "formato">): string => [box.marca, box.formato].filter(Boolean).join(" · ");

/** "Latticini (24)": descrizione e codice del reparto, se diversi. */
export const testoReparto = (reparto: RepartoInsight | null): string | null => {
  if (!reparto) return null;
  if (reparto.descrizione && reparto.codice && reparto.descrizione !== reparto.codice) return `${reparto.descrizione} (${reparto.codice})`;
  return reparto.descrizione || reparto.codice || null;
};

/**
 * Perche' un prezzo e' segnato come calcolato (spec insight-volantino, "Prezzi, sconti, spazio e
 * marche"): la nota della scheda e il titolo del prezzo nelle liste. Il prezzo si scrive come quello stampato.
 */
export const NOTA_PREZZO_CALCOLATO = "Calcolato dal prezzo barrato e dallo sconto: il prezzo non è stampato nel box.";

/** Nome del riquadro per le tecnologie assistive: "Mozzarella, Granarolo, € 1,69, sconto 30%". */
export const descrizioneBox = (box: Pick<BoxInsight, "nome" | "marca" | "prezzo" | "prezzoCalcolato" | "sconto">): string =>
  [
    box.nome || "Box senza nome",
    box.marca,
    box.prezzo !== null ? (box.prezzoCalcolato ? `${formatEuro(box.prezzo)} calcolato` : formatEuro(box.prezzo)) : null,
    box.sconto !== null ? `sconto ${formatPercentuale(Math.round(box.sconto))}` : null,
  ]
    .filter(Boolean)
    .join(", ");

/** Il tooltip del riquadro: prezzo, sconto, meccanica e reparto, quelli che ci sono. */
export const tooltipBox = (box: BoxInsight): ContenutoTooltip => {
  const righe: RigaTooltip[] = [];
  if (box.prezzo !== null) {
    const prezzo = formatEuro(box.prezzo);
    righe.push({ etichetta: box.prezzoCalcolato ? "Prezzo calcolato" : "Prezzo", valore: box.barrato !== null ? `${prezzo} invece di ${formatEuro(box.barrato)}` : prezzo });
  }
  if (box.sconto !== null) righe.push({ etichetta: "Sconto", valore: formatPercentuale(Math.round(box.sconto)) });
  if (box.meccanica) righe.push({ etichetta: "Meccanica", valore: ETICHETTA_MECCANICA[box.meccanica] });
  const reparto = testoReparto(box.reparto);
  if (reparto) righe.push({ etichetta: "Reparto", valore: reparto });
  if (box.prodotti > 1) righe.push({ etichetta: "Prodotti nel box", valore: formatNumero(box.prodotti) });
  return { titolo: box.nome || "Box senza nome", sottotitolo: marcaFormato(box) || undefined, righe };
};
