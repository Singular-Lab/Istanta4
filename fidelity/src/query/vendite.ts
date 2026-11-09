import { useMutation, useQuery, useQueryClient, type Query, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { HttpStatusCode } from "../../lib/enums";
import { ServerCall, type CustomError } from "../../lib/server_call";
import {
  PERCORSI_VENDITE,
  type AnteprimaImportVendite,
  type ImportVendite,
  type RiepilogoVendite,
  type StatoImportVendite,
} from "../../lib/vendite/tipi";

/*
 * Query della pagina Vendite sulle API dell'import delle vendite (lib/vendite/tipi.ts), tutte con il
 * permesso "analisi.importa_vendite", sempre sulla GDO operativa della sessione (anche per
 * Superadmin e Agenzia): nessun parametro di GDO.
 */

export const CHIAVE_VENDITE = "vendite";

/** Ogni quanto si rilegge lo stato di un import in corso. */
export const INTERVALLO_STATO_IMPORT_MS = 2000;

export const chiaviVendite = {
  tutte: [CHIAVE_VENDITE] as const,
  riepilogo: [CHIAVE_VENDITE, "riepilogo"] as const,
  stato: [CHIAVE_VENDITE, "stato"] as const,
};

/** L'import sta ancora lavorando: lo stato va riletto. */
export const importInCorso = (stato: Pick<ImportVendite, "stato"> | null | undefined): boolean =>
  stato?.stato === "in_corso";

/** Intervallo del polling dello stato: ogni 2 s finche' l'import e' in corso, poi fermo. */
export const intervalloStatoImport = (stato: ImportVendite | null | undefined): number | false =>
  importInCorso(stato) ? INTERVALLO_STATO_IMPORT_MS : false;

/** Il server rifiuta un secondo import mentre il primo della stessa GDO e' in corso. */
export const eImportGiaInCorso = (errore: unknown): boolean =>
  (errore as CustomError | null)?.httpStatus === HttpStatusCode.CONFLICT;

const conFile = (file: File): FormData => {
  const dati = new FormData();
  dati.append("file", file);
  return dati;
};

/** Le analisi del volantino che leggono le vendite: rendimento dei box, previsione e simulazione. */
const ANALISI_DALLE_VENDITE = new Set(["vendite", "previsione", "simulazione"]);
const leggeLeVendite = (query: Query): boolean =>
  query.queryKey[0] === "flyerInsights" && ANALISI_DALLE_VENDITE.has(String(query.queryKey[2]));

/** Dopo righe scritte (import finito o annullato): riepilogo e analisi del volantino si rileggono. */
const dopoScrittura = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: chiaviVendite.riepilogo });
  queryClient.invalidateQueries({ predicate: leggeLeVendite });
};

/** Righe, prodotti, punti vendita, periodo coperto e ultimo import della GDO. */
export const useRiepilogoVendite = (attiva = true) =>
  useQuery({
    queryKey: chiaviVendite.riepilogo,
    queryFn: () => ServerCall.get<RiepilogoVendite>(PERCORSI_VENDITE.riepilogo),
    enabled: attiva,
  });

/**
 * L'ultimo import della GDO (null se non ce ne sono): finche' e' in corso si rilegge ogni 2 s, poi
 * il polling si ferma. Quando l'import finisce, riepilogo e analisi del volantino si rileggono.
 */
export const useStatoImportVendite = (attiva = true) => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: chiaviVendite.stato,
    queryFn: () => ServerCall.get<ImportVendite | null>(PERCORSI_VENDITE.stato),
    enabled: attiva,
    // Sempre fresco: riaprendo la pagina si vuole sapere se l'import gira ancora
    staleTime: 0,
    refetchInterval: (q) => intervalloStatoImport(q.state.data),
  });

  const stato: StatoImportVendite | undefined = query.data?.stato;
  const precedente = useRef<StatoImportVendite | undefined>(stato);
  useEffect(() => {
    const prima = precedente.current;
    precedente.current = stato;
    if (prima === "in_corso" && stato && stato !== "in_corso") dopoScrittura(queryClient);
  }, [stato, queryClient]);

  return query;
};

/** Legge il file con il tracciato del cliente e dice cosa importerebbe: non scrive nulla. */
export const useAnteprimaImportVendite = () =>
  useMutation({
    mutationFn: (file: File) => ServerCall.post<AnteprimaImportVendite>(PERCORSI_VENDITE.anteprima, conFile(file), true),
  });

/**
 * Avvia l'import in background: lo stato restituito (in corso) avvia il polling. Con un import gia'
 * in corso (409) si rilegge lo stato, cosi' la pagina segue quello.
 */
export const useAvviaImportVendite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => ServerCall.post<ImportVendite>(PERCORSI_VENDITE.importa, conFile(file), true),
    onSuccess: (avviato) => {
      queryClient.setQueryData(chiaviVendite.stato, avviato);
    },
    onError: (errore) => {
      if (eImportGiaInCorso(errore)) queryClient.invalidateQueries({ queryKey: chiaviVendite.stato });
    },
  });
};

/** Ferma l'import in corso: le righe gia' scritte restano, quindi il riepilogo si rilegge. */
export const useAnnullaImportVendite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => ServerCall.post<ImportVendite>(PERCORSI_VENDITE.annulla, {}),
    onSuccess: (annullato) => {
      queryClient.setQueryData(chiaviVendite.stato, annullato);
      dopoScrittura(queryClient);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: chiaviVendite.stato }),
  });
};
