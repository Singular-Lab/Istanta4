import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  PERCORSO_CONSULTAZIONE,
  percorsoPromozioneVolantiniConsultazione,
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

/** Volantini pubblicati del periodo per promozione, filtrati e paginati dal server. */
export const usePromozioniVolantiniConsultazione = (filtri: FiltriPromozioniVolantiniConsultazione) =>
  useQuery({
    queryKey: [CHIAVE_CONSULTAZIONE, "volantini", "promozioni", filtri],
    queryFn: () => ServerCall.get<PaginaPromozioniVolantiniConsultazione>(
      `${PERCORSO_CONSULTAZIONE}/volantini/promozioni?${parametriMateriali({ ...filtri })}`
    ),
    // Cambiando pagina o filtro restano le promo precedenti finché arrivano le nuove; mai quelle di un altro periodo
    placeholderData: (precedenti, queryPrecedente) =>
      (queryPrecedente?.queryKey[3] as FiltriPromozioniVolantiniConsultazione | undefined)?.periodo === filtri.periodo
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

export const useDettaglioPromozioneVolantini = (
  idPromo: string | undefined,
  filtri: FiltriDettaglioPromozioneVolantini = {}
) =>
  useQuery({
    queryKey: [...chiaveDettaglioPromozioneVolantini(idPromo), filtri.idCanale ?? "", filtri.idArea ?? ""],
    queryFn: () => {
      const parametri = parametriMateriali({ idCanale: filtri.idCanale, idArea: filtri.idArea });
      const percorso = percorsoPromozioneVolantiniConsultazione(idPromo ?? "");
      return ServerCall.get<DettaglioPromozioneVolantiniConsultazione>(parametri ? `${percorso}?${parametri}` : percorso);
    },
    enabled: Boolean(idPromo),
    staleTime: STALE_VISTE,
    // Solo il dettaglio della stessa promo: un'altra promo riparte dal caricamento
    placeholderData: (precedente, query) => (query?.queryKey[3] === idPromo ? precedente : undefined),
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
