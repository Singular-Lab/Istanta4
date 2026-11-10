import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  percorsiImpostazioniGdo as percorsi,
  type CampiReferenzeDaSalvare,
  type ErroreConfigurazione,
  type EsitoVerificaConfigurazione,
  type IdentitaGdoDaSalvare,
  type ImpostazioniGdo,
  type RepartiDaSalvare,
  type SitoWebDaSalvare,
} from "../../lib/impostazioniGdo/tipi";
import { ServerCall } from "../../lib/server_call";
import type { PuntoVenditaResponseDTO } from "../../server/core/dto";

/*
 * Impostazioni GDO (contratto in lib/impostazioniGdo/tipi.ts). Ogni sezione si salva con la sua
 * PUT, che risponde con le impostazioni aggiornate: la cache si aggiorna con quella risposta.
 * I messaggi all'utente li mostra la pagina.
 */

export const CHIAVE_IMPOSTAZIONI_GDO = ["impostazioniGdo"] as const;
/** Stessa chiave che usava la vecchia configurazione WebPliant: una cache sola. */
export const CHIAVE_CAMPI_NON_TRADOTTI = ["campiNonTradotti"] as const;
/** Configurazione degli insight letta dal dettaglio volantino (useFetchFlyerInsightsConfig). */
const CHIAVE_CONFIG_INSIGHT = ["flyerInsightsConfig"] as const;
/** Insight dei volantini: dipendono dai nomi dei reparti e dalla configurazione. */
const CHIAVE_INSIGHT = ["flyerInsights"] as const;
/** Configurazione generale letta dal sito web e da altre pagine (useFetchConfig). */
const CHIAVE_CONFIG = ["config"] as const;
/** Stessa chiave di useFetchPuntiVenditaFromIdGDO. */
const CHIAVE_PUNTI_VENDITA = ["dataPuntiVendita"] as const;

/** Mapping salvato e quante referenze hanno ancora il nome originale (GET /referenze/campi-non-tradotti). */
export interface CampoNonTradotto {
  campo: string;
  tradotto: string;
  referenze: number;
}

export interface EsitoSyncCampo extends CampoNonTradotto {
  kit: number;
}

export const useImpostazioniGdo = () =>
  useQuery({
    queryKey: CHIAVE_IMPOSTAZIONI_GDO,
    queryFn: () => ServerCall.get<ImpostazioniGdo>(percorsi.impostazioni),
    // Le sezioni hanno bozze locali: un nuovo caricamento al ritorno sulla scheda non serve
    refetchOnWindowFocus: false,
  });

const useSalvaSezione = <T extends object>(percorso: string, dopo?: (queryClient: QueryClient) => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dati: T) => ServerCall.put<ImpostazioniGdo>(percorso, dati),
    onSuccess: (impostazioni) => {
      queryClient.setQueryData(CHIAVE_IMPOSTAZIONI_GDO, impostazioni);
      dopo?.(queryClient);
    },
  });
};

export const useSalvaIdentitaGdo = () => useSalvaSezione<IdentitaGdoDaSalvare>(percorsi.identita);

export const useSalvaRepartiGdo = () =>
  useSalvaSezione<RepartiDaSalvare>(percorsi.reparti, (queryClient) => {
    queryClient.invalidateQueries({ queryKey: CHIAVE_INSIGHT });
  });

export const useSalvaCampiReferenze = () =>
  useSalvaSezione<CampiReferenzeDaSalvare>(percorsi.campiReferenze, (queryClient) => {
    // Un mapping appena salvato può avere referenze da sincronizzare
    queryClient.invalidateQueries({ queryKey: CHIAVE_CAMPI_NON_TRADOTTI });
    queryClient.invalidateQueries({ queryKey: CHIAVE_CONFIG });
  });

export const useSalvaSitoWeb = () =>
  useSalvaSezione<SitoWebDaSalvare>(percorsi.sitoWeb, (queryClient) => {
    queryClient.invalidateQueries({ queryKey: CHIAVE_CONFIG });
  });

/* ---------- Insight del volantino ---------- */

export const useVerificaConfigurazioneInsight = () =>
  useMutation({
    mutationFn: (configurazione: unknown) =>
      ServerCall.post<EsitoVerificaConfigurazione>(percorsi.verificaInsightVolantino, { configurazione }),
  });

const dopoConfigurazioneInsight = (queryClient: QueryClient, impostazioni: ImpostazioniGdo) => {
  queryClient.setQueryData(CHIAVE_IMPOSTAZIONI_GDO, impostazioni);
  queryClient.invalidateQueries({ queryKey: CHIAVE_IMPOSTAZIONI_GDO });
  queryClient.invalidateQueries({ queryKey: CHIAVE_CONFIG_INSIGHT });
  queryClient.invalidateQueries({ queryKey: CHIAVE_INSIGHT });
};

export const useSalvaConfigurazioneInsight = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (configurazione: unknown) =>
      ServerCall.put<ImpostazioniGdo>(percorsi.insightVolantino, { configurazione }),
    onSuccess: (impostazioni) => dopoConfigurazioneInsight(queryClient, impostazioni),
  });
};

/** Toglie la configurazione salvata per la GDO: torna quella del file dell'installazione. */
export const useRipristinaConfigurazioneInsight = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => ServerCall.delete<ImpostazioniGdo>(percorsi.insightVolantino),
    onSuccess: (impostazioni) => dopoConfigurazioneInsight(queryClient, impostazioni),
  });
};

const eErroreConfigurazione = (valore: unknown): valore is ErroreConfigurazione =>
  typeof valore === "object" && valore !== null && typeof (valore as ErroreConfigurazione).messaggio === "string";

const erroriIn = (contenitore: unknown): ErroreConfigurazione[] | null => {
  if (typeof contenitore !== "object" || contenitore === null) return null;
  const { errori, esito } = contenitore as { errori?: unknown; esito?: unknown };
  if (Array.isArray(errori)) {
    return errori.filter(eErroreConfigurazione).map((e) => ({ percorso: String(e.percorso ?? ""), messaggio: e.messaggio }));
  }
  return esito ? erroriIn(esito) : null;
};

/**
 * Errori della configurazione dentro la risposta 400 del salvataggio (EsitoVerificaConfigurazione
 * nei dettagli dell'errore), o null se l'errore è d'altro tipo.
 */
export const erroriConfigurazioneDa = (errore: unknown): ErroreConfigurazione[] | null => {
  if (typeof errore !== "object" || errore === null) return null;
  const { details, additionalData } = errore as { details?: unknown; additionalData?: unknown };
  return erroriIn(details) ?? erroriIn(additionalData);
};

/* ---------- Campi delle referenze: mapping da sincronizzare ---------- */

export const useCampiNonTradotti = () =>
  useQuery({
    queryKey: CHIAVE_CAMPI_NON_TRADOTTI,
    queryFn: () => ServerCall.get<CampoNonTradotto[]>("/referenze/campi-non-tradotti"),
  });

export const useSyncCampoNonTradotto = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campo: string) => ServerCall.post<EsitoSyncCampo>("/referenze/campi-non-tradotti/sync", { campo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHIAVE_CAMPI_NON_TRADOTTI }),
  });
};

/* ---------- Icona della GDO e punti vendita per i loghi ---------- */

/** Indirizzo dell'icona della GDO, come la legge la barra in alto. */
export const indirizzoIconaGdo = () => `${ServerCall.getUrl()}/gdo/icona`;

/** Carica l'icona SVG della GDO della sessione (POST /gdo/icona, campo "icona"). */
export const useCaricaIconaGdo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const dati = new FormData();
      dati.append("icona", file);
      return ServerCall.post<{ message: string }>("/gdo/icona", dati, true);
    },
    onSuccess: async () => {
      queryClient.setQueryData<ImpostazioniGdo>(CHIAVE_IMPOSTAZIONI_GDO, (attuali) =>
        attuali ? { ...attuali, gdo: { ...attuali.gdo, haIcona: true } } : attuali
      );
      // La barra in alto legge la stessa immagine, che il browser tiene in cache per un'ora:
      // la si richiede di nuovo, così al prossimo caricamento compare quella nuova
      try {
        await fetch(indirizzoIconaGdo(), { cache: "reload", credentials: "include" });
      } catch {
        // Solo la cache del browser: l'icona è comunque salvata
      }
    },
  });
};

/** Punti vendita della GDO per i loghi delle insegne: servono i permessi della gestione punti vendita. */
export const usePuntiVenditaPerLoghi = (abilitata: boolean) =>
  useQuery({
    queryKey: CHIAVE_PUNTI_VENDITA,
    queryFn: () => ServerCall.get<PuntoVenditaResponseDTO[]>("/getAllPVFromIdGDO"),
    enabled: abilitata,
  });
