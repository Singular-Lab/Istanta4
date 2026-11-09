import { useStatoQuery } from "@/components/PuntiVendita/breadcrumb";
import { CHIAVE_CONSULTAZIONE } from "@/query/consultazione";
import {
  ETICHETTA_PERIODO_CONSULTAZIONE,
  percorsoPromozioneVolantini,
  percorsoVolantini,
} from "../../../lib/consultazione/periodi";
import type { DettaglioPromozioneVolantiniConsultazione } from "../../../lib/consultazione/tipi";

/**
 * Breadcrumb del dettaglio di consultazione di una promozione (/volantini/promozioni/:idPromo).
 * Il percorso, letto segmento per segmento, darebbe "Volantini › Promozioni › 1a2b…": la vecchia
 * pagina Volantini e un indirizzo senza pagina. Al loro posto la vista Volantini del periodo della
 * promo e il suo nome, dai dati che la pagina ha già chiesto: il breadcrumb non fa richieste sue.
 */

export interface VoceBreadcrumbPromozione {
  path: string;
  label: string;
}

const decodifica = (segmento: string) => {
  try {
    return decodeURIComponent(segmento);
  } catch {
    return segmento;
  }
};

/** Le due voci del breadcrumb, o null fuori dalla pagina del dettaglio della promozione. */
export function useBreadcrumbPromozioneVolantini(segmenti: string[]): VoceBreadcrumbPromozione[] | null {
  const [radice, sezione, id] = segmenti;
  const idPromo = radice === "volantini" && sezione === "promozioni" && id && segmenti.length === 3 ? decodifica(id) : null;
  // Stessa chiave di useDettaglioPromozioneVolantini
  const stato = useStatoQuery(idPromo ? [CHIAVE_CONSULTAZIONE, "volantini", "promozione", idPromo] : null);
  if (!idPromo) return null;

  const dettaglio = stato?.data as DettaglioPromozioneVolantiniConsultazione | undefined;
  const inCaricamento = stato?.status === "pending" && stato.fetchStatus === "fetching";
  const periodo = dettaglio?.periodo;
  return [
    periodo
      ? { path: percorsoVolantini(periodo), label: `Volantini ${ETICHETTA_PERIODO_CONSULTAZIONE[periodo]}` }
      : { path: percorsoVolantini("attivi"), label: "Volantini" },
    {
      path: percorsoPromozioneVolantini(idPromo),
      label: dettaglio?.promo.nome || (inCaricamento ? "Caricamento..." : "Promozione"),
    },
  ];
}
