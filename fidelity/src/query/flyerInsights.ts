import { useQuery } from "@tanstack/react-query";
import {
  percorsoConfronti,
  percorsoVarianti,
  percorsoViaggio,
  type ConfrontiVolantino,
  type DifferenzeVarianti,
  type ViaggioProdotto,
} from "../../lib/insightVolantino/tipi";
import { percorsoReport, type ReportVolantino } from "../../lib/insightVolantino/report";
import { ServerCall } from "../../lib/server_call";

/*
 * Query degli insight del volantino oltre a quella principale (useFetchFlyerInsights in query.tsx):
 * confronti, differenze fra varianti e viaggio del prodotto. Si caricano solo quando servono.
 */

const CINQUE_MINUTI = 1000 * 60 * 5;

/** Edizione precedente della stessa area e canale e varianti della stessa promo. */
export const useConfrontiVolantino = (idKit: string | undefined, attiva = true) =>
  useQuery({
    queryKey: ["flyerInsights", idKit, "confronti"],
    queryFn: () => ServerCall.get<ConfrontiVolantino>(percorsoConfronti(idKit!)),
    enabled: !!idKit && attiva,
    staleTime: CINQUE_MINUTI,
  });

/** Differenze pagina per pagina con un'altra variante della stessa promo. */
export const useDifferenzeVarianti = (idKit: string | undefined, idAltra: string | null | undefined) =>
  useQuery({
    queryKey: ["flyerInsights", idKit, "varianti", idAltra],
    queryFn: () => ServerCall.get<DifferenzeVarianti>(percorsoVarianti(idKit!, idAltra!)),
    enabled: !!idKit && !!idAltra,
    staleTime: CINQUE_MINUTI,
  });

/** Dati e sezioni del report PDF: si chiedono al click, non al caricamento della pagina. */
export const caricaReportVolantino = (idKit: string): Promise<ReportVolantino> =>
  ServerCall.get<ReportVolantino>(percorsoReport(idKit));

/** I volantini della GDO in cui compare il prodotto, dal piu' recente. */
export const useViaggioProdotto = (idKit: string | undefined, chiave: string | null | undefined) =>
  useQuery({
    queryKey: ["flyerInsights", idKit, "prodotti", chiave],
    queryFn: () => ServerCall.get<ViaggioProdotto>(percorsoViaggio(idKit!, chiave!)),
    enabled: !!idKit && !!chiave,
    staleTime: CINQUE_MINUTI,
  });
