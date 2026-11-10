import { useQuery } from "@tanstack/react-query";
import { percorsoViaggio, type ViaggioProdotto } from "../../lib/insightVolantino/tipi";
import { percorsoReport, type ReportVolantino } from "../../lib/insightVolantino/report";
import { ServerCall } from "../../lib/server_call";

/*
 * Query degli insight del volantino oltre a quella principale (useFetchFlyerInsights in query.tsx):
 * report PDF e viaggio del prodotto. Si caricano solo quando servono.
 */

const CINQUE_MINUTI = 1000 * 60 * 5;

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
