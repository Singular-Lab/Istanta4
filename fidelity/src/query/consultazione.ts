import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { PERCORSO_CONSULTAZIONE, percorsoVolantinoConsultazione, type PeriodoConsultazione } from "../../lib/consultazione/periodi";
import type {
  DettaglioVolantinoConsultazione,
  FiltriContenutiDigitali,
  OpzioniContenutiDigitali,
  PaginaContenutiDigitali,
  PaginaVolantiniConsultazione,
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
