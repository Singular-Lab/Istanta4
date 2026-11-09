import { StrisciaNumeri, type NumeroStriscia } from "@/components/Grafici";
import { formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import type { NumeriPromozioneConsultazione } from "../../../lib/consultazione/tipi";
import { plurale } from "./analisi";

export const TITOLO_NUMERI = "La promozione in numeri";

/**
 * La striscia dei numeri sotto la banda: volantini e pagine, punti vendita con località e regioni,
 * prodotti diversi e referenze stampate, sconto medio, box in sottocosto.
 */
export function NumeriPromozione({ numeri }: { numeri: NumeriPromozioneConsultazione }) {
  const voci: NumeroStriscia[] = [
    {
      id: "volantini",
      valore: formatNumero(numeri.kit),
      etichetta: numeri.kit === 1 ? "volantino" : "volantini",
      dettaglio: `${plurale(numeri.pagine, "pagina", "pagine")} in tutto`,
    },
    {
      id: "puntiVendita",
      valore: formatNumero(numeri.puntiVendita),
      etichetta: numeri.puntiVendita === 1 ? "punto vendita" : "punti vendita",
      dettaglio: `in ${formatNumero(numeri.localita)} località, ${plurale(numeri.regioni, "regione", "regioni")}`,
    },
    {
      id: "prodotti",
      valore: formatNumero(numeri.prodotti),
      etichetta: numeri.prodotti === 1 ? "prodotto diverso" : "prodotti diversi",
      dettaglio: `${plurale(numeri.referenze, "referenza stampata", "referenze stampate")}`,
    },
    {
      id: "sconto",
      // Senza box scontati la cella resta con "N/D", invece di uno 0% che direbbe il falso
      valore: numeri.scontoMedio === null ? null : formatPercentuale(numeri.scontoMedio, 0),
      etichetta: "sconto medio",
      dettaglio: "sui box con uno sconto",
    },
    {
      id: "sottocosto",
      valore: formatNumero(numeri.sottocosto),
      etichetta: "box in sottocosto",
      dettaglio: "in tutti i volantini",
    },
  ];
  return <StrisciaNumeri titolo={TITOLO_NUMERI} voci={voci} />;
}

export default NumeriPromozione;
