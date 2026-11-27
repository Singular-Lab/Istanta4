import { useInfiniteQuery, useQuery, keepPreviousData, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import {
  PERCORSO_CONSULTAZIONE,
  percorsoPromozioneVolantiniConsultazione,
  percorsoVolantiniPromozioneConsultazione,
  percorsoVolantinoConsultazione,
  type PeriodoConsultazione,
} from "../../lib/consultazione/periodi";
import type {
  DettaglioPromozioneVolantiniConsultazione,
  FiltriDettaglioPromozioneVolantini,
  DettaglioVolantinoConsultazione,
  ElencoPromozioniPopConsultazione,
  FiltriContenutiDigitali,
  FiltriFilePopConsultazione,
  FiltriPromozioniVolantiniConsultazione,
  OpzioniContenutiDigitali,
  OpzioniFilePopConsultazione,
  PaginaContenutiDigitali,
  PaginaFilePopConsultazione,
  PaginaPromozioniVolantiniConsultazione,
  PaginaVolantiniConsultazione,
  RiepilogoPopConsultazione,
  VolantiniPromozioneConsultazione,
} from "../../lib/consultazione/tipi";
import { ServerCall } from "../../lib/server_call";
import { parametriMateriali } from "../utils/materiali";

/*
 * Query delle pagine di Visualizzazione sulle API di consultazione (lib/consultazione/tipi.ts):
 * solo materiali pubblicati della GDO dell'utente, senza dati di lavorazione.
 */

export const CHIAVE_CONSULTAZIONE = "consultazione";

/** Filtri di area e canale dei volantini; vuoti = tutti. */
export interface FiltroAreaCanale {
  idArea?: string;
  idCanale?: string;
}

/**
 * Indirizzo dei volantini pubblicati di un periodo, relativo all'indirizzo delle API: lo stesso
 * nel loader della rotta e nella pagina, così la pagina riconosce la richiesta già avviata.
 */
export const urlVolantiniConsultazione = (
  periodo: PeriodoConsultazione,
  filtro: FiltroAreaCanale = {},
  pagina?: { pagina?: number; dimensione?: number }
): string =>
  `${PERCORSO_CONSULTAZIONE}/volantini?${parametriMateriali({
    periodo,
    idArea: filtro.idArea,
    idCanale: filtro.idCanale,
    pagina: pagina?.pagina,
    dimensione: pagina?.dimensione,
  })}`;

export const leggiVolantiniConsultazione = (
  periodo: PeriodoConsultazione,
  filtro?: FiltroAreaCanale,
  pagina?: { pagina?: number; dimensione?: number }
) => ServerCall.get<PaginaVolantiniConsultazione>(urlVolantiniConsultazione(periodo, filtro, pagina));

/** Dettaglio di un kit volantino pubblicato con i suoi file. */
export const useVolantinoConsultazione = (idKit: string, abilitata = true) =>
  useQuery({
    queryKey: [CHIAVE_CONSULTAZIONE, "volantino", idKit],
    queryFn: () => ServerCall.get<DettaglioVolantinoConsultazione>(percorsoVolantinoConsultazione(idKit)),
    enabled: Boolean(idKit) && abilitata,
    retry: false,
  });

/** Una pagina dei contenuti digitali pubblicati; cambiando pagina o filtri restano i dati precedenti. */
export const useContenutiDigitali = (filtri: FiltriContenutiDigitali) =>
  useQuery({
    queryKey: [CHIAVE_CONSULTAZIONE, "contenutiDigitali", filtri],
    queryFn: () => ServerCall.get<PaginaContenutiDigitali>(
      `${PERCORSO_CONSULTAZIONE}/contenuti-digitali?${parametriMateriali({ ...filtri })}`
    ),
    placeholderData: keepPreviousData,
  });

/** Valori dei filtri dei contenuti digitali: solo quelli presenti nei contenuti consultabili. */
export const useOpzioniContenutiDigitali = () =>
  useQuery({
    queryKey: [CHIAVE_CONSULTAZIONE, "contenutiDigitali", "opzioni"],
    queryFn: () => ServerCall.get<OpzioniContenutiDigitali>(`${PERCORSO_CONSULTAZIONE}/contenuti-digitali/opzioni`),
    staleTime: 5 * 60 * 1000,
  });

/** Kit per sezione della panoramica: tutti i volantini in validità e prossimi, gli ultimi 10 dello storico. */
export const DIMENSIONE_SEZIONE_PANORAMICA = 200;
export const DIMENSIONE_STORICO_PANORAMICA = 10;

/** Dimensione della pagina di ogni sezione della panoramica. */
export const dimensioneSezionePanoramica = (periodo: PeriodoConsultazione): number =>
  periodo === "storico" ? DIMENSIONE_STORICO_PANORAMICA : DIMENSIONE_SEZIONE_PANORAMICA;

/**
 * Le tre sezioni della panoramica senza filtri: le avviano il loader della rotta e la dashboard
 * Superadmin, e la pagina le riconosce dall'indirizzo.
 */
export const richiesteVolantiniPanoramica = () => ({
  volantiniAttiviPromise: leggiVolantiniConsultazione("attivi", {}, { dimensione: dimensioneSezionePanoramica("attivi") }),
  volantiniProssimiPromise: leggiVolantiniConsultazione("prossimi", {}, { dimensione: dimensioneSezionePanoramica("prossimi") }),
  storicoPromise: leggiVolantiniConsultazione("storico", {}, { dimensione: dimensioneSezionePanoramica("storico") }),
});

/* ---------- Viste Volantini e POP ---------- */

// Le pubblicazioni arrivano durante il giorno: più fresche del predefinito di 5 minuti
const STALE_VISTE = 60 * 1000;

/** Promozione di un materiale pubblicato nei percorsi: l'id codificato. */
const percorsoPromoPop = (idPromo: string | undefined) =>
  `${PERCORSO_CONSULTAZIONE}/pop/promozioni/${encodeURIComponent(idPromo ?? "")}`;

/** Promozioni chieste al server a ogni gruppo dello scorrimento continuo delle viste Volantini. */
export const DIMENSIONE_GRUPPO_PROMOZIONI_VOLANTINI = 12;

type FiltriGruppoPromozioniVolantini = Omit<FiltriPromozioniVolantiniConsultazione, "pagina" | "dimensione">;

/**
 * I gruppi arrivati in un'unica pagina: vetrina, opzioni dei filtri e riepilogo sono del primo
 * gruppo, le promozioni sono tutte quelle caricate, una volta sola anche se fra un gruppo e l'altro
 * l'elenco si e' spostato (una promo archiviata nel frattempo).
 */
export const unisciGruppiPromozioniVolantini = (gruppi: InfiniteData<PaginaPromozioniVolantiniConsultazione, number>): PaginaPromozioniVolantiniConsultazione => {
  const viste = new Set<string>();
  const promozioni = gruppi.pages
    .flatMap((gruppo) => gruppo.promozioni)
    .filter((promozione) => !viste.has(promozione.promo.id) && viste.add(promozione.promo.id));
  const ultimo = gruppi.pages[gruppi.pages.length - 1];
  return { ...gruppi.pages[0], pagina: ultimo.pagina, totale: ultimo.totale, promozioni };
};

/**
 * Volantini pubblicati del periodo per promozione, filtrati dal server e caricati a gruppi: ogni
 * gruppo nuovo si accoda ai precedenti (`data.promozioni` e' l'elenco caricato finora) e la vista
 * lo chiede con `fetchNextPage` quando serve; cambiando filtro si riparte dal primo gruppo.
 */
export const usePromozioniVolantiniConsultazione = (filtri: FiltriGruppoPromozioniVolantini) =>
  useInfiniteQuery({
    queryKey: [CHIAVE_CONSULTAZIONE, "volantini", "promozioni", filtri],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      ServerCall.get<PaginaPromozioniVolantiniConsultazione>(
        `${PERCORSO_CONSULTAZIONE}/volantini/promozioni?${parametriMateriali({
          ...filtri,
          pagina: pageParam,
          dimensione: DIMENSIONE_GRUPPO_PROMOZIONI_VOLANTINI,
        })}`
      ),
    getNextPageParam: (ultimo, tutti) =>
      ultimo.promozioni.length > 0 && tutti.reduce((somma, gruppo) => somma + gruppo.promozioni.length, 0) < ultimo.totale
        ? tutti.length + 1
        : undefined,
    select: unisciGruppiPromozioniVolantini,
    // Cambiando filtro restano le promo precedenti finché arrivano le nuove; mai quelle di un altro periodo
    placeholderData: (precedenti, queryPrecedente) =>
      (queryPrecedente?.queryKey[3] as FiltriGruppoPromozioniVolantini | undefined)?.periodo === filtri.periodo
        ? precedenti
        : undefined,
    staleTime: STALE_VISTE,
  });

/**
 * Dettaglio di consultazione di una promozione: i suoi kit volantino pubblicati con i numeri degli
 * insight, le righe dei punti vendita stampate e l'assortimento. Una promo di un'altra GDO,
 * eliminata o senza volantini pubblicati risponde 404, che non si ritenta (predefinito per i 4xx).
 */
/**
 * Il dettaglio di consultazione di una promozione, sui soli kit dell'insegna e dell'area scelte:
 * cambiando filtro resta il dettaglio di prima finche' non arriva il nuovo, della stessa promo.
 */
/**
 * Inizio della chiave del dettaglio di una promozione: dopo vengono insegna e area filtrate. Nome
 * e periodo della promo sono gli stessi con qualunque filtro (il breadcrumb li legge da qui).
 */
export const chiaveDettaglioPromozioneVolantini = (idPromo: string | undefined) =>
  [CHIAVE_CONSULTAZIONE, "volantini", "promozione", idPromo] as const;

const chiaveDettaglioFiltrato = (idPromo: string | undefined, filtri: FiltriDettaglioPromozioneVolantini) =>
  [...chiaveDettaglioPromozioneVolantini(idPromo), filtri.idCanale ?? "", filtri.idArea ?? ""] as const;

const leggiDettaglioPromozioneVolantini = (idPromo: string | undefined, filtri: FiltriDettaglioPromozioneVolantini) => {
  const parametri = parametriMateriali({ idCanale: filtri.idCanale, idArea: filtri.idArea });
  const percorso = percorsoPromozioneVolantiniConsultazione(idPromo ?? "");
  return ServerCall.get<DettaglioPromozioneVolantiniConsultazione>(parametri ? `${percorso}?${parametri}` : percorso);
};

export const useDettaglioPromozioneVolantini = (
  idPromo: string | undefined,
  filtri: FiltriDettaglioPromozioneVolantini = {}
) =>
  useQuery({
    queryKey: chiaveDettaglioFiltrato(idPromo, filtri),
    queryFn: () => leggiDettaglioPromozioneVolantini(idPromo, filtri),
    enabled: Boolean(idPromo),
    staleTime: STALE_VISTE,
    // Solo il dettaglio della stessa promo: un'altra promo riparte dal caricamento
    placeholderData: (precedente, query) => (query?.queryKey[3] === idPromo ? precedente : undefined),
  });

/**
 * Avvia in anticipo la lettura del dettaglio di una promozione (e dei suoi volantini, che bastano a
 * mostrare la pagina): lo si chiama quando l'utente si ferma sulla scheda, cosi' il clic trova i dati
 * gia' arrivati o in arrivo. Non rilegge quello che e' ancora fresco.
 */
export const anticipaPromozioneVolantini = (
  client: QueryClient,
  idPromo: string | undefined,
  filtri: FiltriDettaglioPromozioneVolantini = {}
): void => {
  if (!idPromo) return;
  void client.prefetchQuery({
    queryKey: chiaveDettaglioFiltrato(idPromo, filtri),
    queryFn: () => leggiDettaglioPromozioneVolantini(idPromo, filtri),
    staleTime: STALE_VISTE,
  });
  void client.prefetchQuery({
    queryKey: [CHIAVE_CONSULTAZIONE, "volantini", "promozione-volantini", idPromo],
    queryFn: () => ServerCall.get<VolantiniPromozioneConsultazione>(percorsoVolantiniPromozioneConsultazione(idPromo)),
    staleTime: STALE_VISTE,
  });
};

/**
 * I volantini pubblicati di una promozione, senza i loro insight, per la tendina degli insight del
 * volantino (spec insight-volantino). Una chiave sua: non e' il dettaglio della promozione. Una promo
 * non consultabile risponde 404, che non si ritenta (predefinito per i 4xx).
 */
export const useVolantiniPromozione = (idPromo: string | undefined) =>
  useQuery({
    queryKey: [CHIAVE_CONSULTAZIONE, "volantini", "promozione-volantini", idPromo],
    queryFn: () => ServerCall.get<VolantiniPromozioneConsultazione>(percorsoVolantiniPromozioneConsultazione(idPromo ?? "")),
    enabled: Boolean(idPromo),
    staleTime: STALE_VISTE,
  });

/** Promozioni del periodo con file POP pubblicati, con il loro conteggio. */
export const usePromozioniPopConsultazione = (periodo: PeriodoConsultazione) =>
  useQuery({
    queryKey: [CHIAVE_CONSULTAZIONE, "pop", "promozioni", periodo],
    queryFn: () => ServerCall.get<ElencoPromozioniPopConsultazione>(
      `${PERCORSO_CONSULTAZIONE}/pop/promozioni?${parametriMateriali({ periodo })}`
    ),
    staleTime: STALE_VISTE,
  });

/** Totali e formati POP pubblicati di una promozione. */
export const useRiepilogoPopConsultazione = (idPromo: string | undefined, periodo: PeriodoConsultazione) =>
  useQuery({
    queryKey: [CHIAVE_CONSULTAZIONE, "pop", "riepilogo", idPromo, periodo],
    queryFn: () => ServerCall.get<RiepilogoPopConsultazione>(`${percorsoPromoPop(idPromo)}?${parametriMateriali({ periodo })}`),
    enabled: Boolean(idPromo),
    staleTime: STALE_VISTE,
  });

/** File POP pubblicati di un formato della promozione, filtrati e paginati dal server. */
export const useFilePopConsultazione = (idPromo: string | undefined, filtri: FiltriFilePopConsultazione) =>
  useQuery({
    queryKey: [CHIAVE_CONSULTAZIONE, "pop", "file", idPromo, filtri],
    queryFn: () => ServerCall.get<PaginaFilePopConsultazione>(
      `${percorsoPromoPop(idPromo)}/file?${parametriMateriali({ ...filtri })}`
    ),
    enabled: Boolean(idPromo) && Boolean(filtri.idFormato),
    // Restano i file precedenti solo cambiando pagina o filtri dello stesso formato, mai di un altro
    placeholderData: (precedenti, queryPrecedente) => {
      const [, , , promoPrecedente, filtriPrecedenti] = (queryPrecedente?.queryKey ?? []) as [
        unknown, unknown, unknown, string | undefined, FiltriFilePopConsultazione | undefined
      ];
      return promoPrecedente === idPromo &&
        filtriPrecedenti?.periodo === filtri.periodo &&
        filtriPrecedenti?.idFormato === filtri.idFormato
        ? precedenti
        : undefined;
    },
    staleTime: STALE_VISTE,
  });

// Aree, canali e reparti di un formato cambiano solo quando si pubblicano file nuovi
const STALE_OPZIONI_POP = 5 * 60 * 1000;

/** Valori delle tendine dei file di un formato: una richiesta per formato, non a ogni pagina o filtro. */
export const useOpzioniFilePopConsultazione = (
  idPromo: string | undefined,
  periodo: PeriodoConsultazione,
  idFormato: string | undefined
) =>
  useQuery({
    queryKey: [CHIAVE_CONSULTAZIONE, "pop", "opzioni-file", idPromo, periodo, idFormato],
    queryFn: () => ServerCall.get<OpzioniFilePopConsultazione>(
      `${percorsoPromoPop(idPromo)}/file/opzioni?${parametriMateriali({ periodo, idFormato })}`
    ),
    enabled: Boolean(idPromo) && Boolean(idFormato),
    staleTime: STALE_OPZIONI_POP,
  });
