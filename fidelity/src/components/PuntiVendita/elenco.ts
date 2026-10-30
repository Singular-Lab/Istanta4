import type { Tinta } from "@/components/Grafici/colori";
import { useTinteCanali } from "@/pages/PuntiVenditaConsultazione/analisi";
import { coloreSemantico } from "@/utils/chartTheme";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { StoriaInElenco } from "../../../lib/puntiVendita/analisi";
import type { PuntoVenditaConsultazione } from "../../../lib/puntiVendita/consultazione";
import type { PuntoVenditaResponseDTO } from "../../../server/core/dto";
import { codiciGdo, contaPer, filtraPuntiVendita } from "../../utils/puntoVendita";

/**
 * Elenco dei punti vendita in sola lettura, comune alla consultazione (/punti-vendita) e alla
 * gestione interna: ricerca, filtri per canale e area con i conteggi, colori per canale e pagine.
 * Spec anagrafica-punti-vendita: "Vista dei punti vendita per canale e area", "Elenco e ricerca".
 */

/** I campi dell'anagrafica che servono all'elenco e alla mappa. */
export type PuntoVenditaInElenco = Pick<
  PuntoVenditaResponseDTO,
  | "id"
  | "nome"
  | "ragionesociale"
  | "indirizzo"
  | "cap"
  | "citta"
  | "provincia"
  | "meta"
  | "id_canale"
  | "nome_canale"
  | "id_area"
  | "nome_area"
  | "sigla_combinazione"
  | "has_coordinate"
  | "coordinate"
>;

/** La sintesi della storia nei volantini, se il server la manda con l'elenco. */
export type ConStoria = { storia?: StoriaInElenco };

/** Il punto vendita della consultazione con i nomi dei campi dell'elenco, e la sua storia. */
export const daConsultazione = (pv: PuntoVenditaConsultazione): PuntoVenditaInElenco & ConStoria => ({
  id: pv.id,
  nome: pv.nome,
  ragionesociale: pv.ragioneSociale ?? undefined,
  indirizzo: pv.indirizzo ?? "",
  cap: pv.cap ?? "",
  citta: pv.citta ?? "",
  provincia: pv.provincia ?? undefined,
  meta: pv.meta,
  id_canale: pv.canale?.id,
  nome_canale: pv.canale?.nome,
  id_area: pv.area?.id,
  nome_area: pv.area?.nome,
  sigla_combinazione: [pv.canale?.codice, pv.area?.codice].filter(Boolean).join("") || undefined,
  has_coordinate: pv.coordinate !== null,
  // Senza coordinate l'elenco non mostra il punto sulla mappa: has_coordinate decide
  coordinate: pv.coordinate ?? { lat: 0, lon: 0 },
  storia: storiaDi(pv),
});

/** Campi dei meta che descrivono il punto vendita ma non lo identificano: l'insegna è già nella sua colonna. */
const CAMPI_DESCRITTIVI = new Set(["insegna"]);

/**
 * Solo i codici che identificano il punto vendita nel sistema della GDO (es. ID ANACAN, ID MURO),
 * per l'elenco e lo stato dei dati. I dati di sistema del dettaglio mostrano tutti i meta.
 */
export const codiciIdentificativi = (meta?: Record<string, unknown>) =>
  Object.entries(meta ?? {})
    .filter(([campo]) => !CAMPI_DESCRITTIVI.has(campo.toLowerCase()))
    .flatMap(([campo, valore]) => codiciGdo({ [campo]: valore }));

export const haCoordinate = (pv: Pick<PuntoVenditaInElenco, "has_coordinate" | "coordinate">) =>
  Boolean(pv.has_coordinate && pv.coordinate && Number.isFinite(pv.coordinate.lat) && Number.isFinite(pv.coordinate.lon));

/**
 * Vero se il server manda la storia con l'elenco (almeno un punto vendita la porta). Solo allora
 * un punto vendita senza storia vuol dire "mai nei volantini" e non "dato che non arriva".
 */
export const storiaNellElenco = (puntiVendita: ReadonlyArray<object>) => puntiVendita.some(pv => storiaDi(pv) !== undefined);

/** La storia nell'elenco di un punto vendita, se il server la manda. */
export const storiaDi = (pv: object): StoriaInElenco | undefined => (pv as ConStoria).storia;

/** Volantini del punto vendita secondo la storia nell'elenco; 0 se non ne ha. */
export const volantiniDi = (pv: object) => storiaDi(pv)?.volantini ?? 0;

// Il colore di un canale (insegna) è quello di tutte le pagine dei punti vendita: tinteCanali di
// PuntiVenditaConsultazione/analisi, per nome sulle insegne della rete. Stabile anche filtrando,
// lo stesso nella mappa (Leaflet lo riceve come opzione di disegno), nei filtri, nelle infografiche
// e nelle righe. Il grigio neutro è per i punti vendita senza canale, per gli anni senza volantini
// e per i canali oltre il numero di colori distinguibili.
export const coloreSenzaCanale = () => coloreSemantico("neutro");

/** Il colore CSS di una tinta dei grafici, per pallini e celle HTML; grigio neutro se non ne ha uno. */
export const coloreDaTinta = (tinta: Tinta) => tinta.colore ?? coloreSenzaCanale();

export const DIMENSIONI_PAGINA_PUNTI_VENDITA = [10, 25, 50];

export interface VoceConteggio {
  id: string;
  nome: string;
  totale: number;
}

/** Un filtro in più deciso dalla pagina (per esempio "senza coordinate" nella gestione). */
export interface FiltroAggiuntivo<T> {
  /** Cambia quando cambia il filtro: riporta alla prima pagina. */
  chiave: string;
  test: (pv: T) => boolean;
  /** Toglie il filtro, con "Azzera filtri". */
  azzera: () => void;
}

export interface OpzioniElenco<T> {
  filtro?: FiltroAggiuntivo<T> | null;
}

export interface ElencoPuntiVendita<T extends PuntoVenditaInElenco> {
  ricerca: string;
  setRicerca: (testo: string) => void;
  /** Il testo cercato, applicato dopo una pausa nella digitazione. */
  ricercaApplicata: string;
  filtroCanale: string;
  setFiltroCanale: (id: string) => void;
  filtroArea: string;
  setFiltroArea: (id: string) => void;
  /** Vero con ricerca o filtri attivi. */
  conFiltri: boolean;
  azzeraFiltri: () => void;
  /** Tutti i punti vendita che passano ricerca e filtri, per la mappa. */
  filtrati: T[];
  perCanale: VoceConteggio[];
  perArea: VoceConteggio[];
  /** Colore CSS del canale (pallini, mappa, strisce); grigio neutro se non ha un colore suo. */
  coloreCanale: (pv: T) => string;
  coloreDelCanale: (idCanale: string) => string;
  /** La stessa scelta come Tinta dei grafici (components/Grafici). */
  tintaDelCanale: (idCanale: string) => Tinta;
  senzaCoordinate: number;
  pagina: number;
  setPagina: (pagina: number) => void;
  dimensionePagina: number;
  setDimensionePagina: (dimensione: number) => void;
  /** I punti vendita della pagina mostrata. */
  righe: T[];
  /** Posizione (da 0) della prima riga della pagina nell'elenco filtrato. */
  primaRiga: number;
  /** La colonna dei codici GDO serve solo alle GDO che li hanno (es. id ANACAN di CONAD CNO). */
  mostraCodiciGdo: boolean;
}

export function useElencoPuntiVendita<T extends PuntoVenditaInElenco>(
  tutti: T[],
  { filtro = null }: OpzioniElenco<T> = {}
): ElencoPuntiVendita<T> {
  const [pagina, setPagina] = useState(1);
  const [dimensionePagina, setDimensionePagina] = useState(DIMENSIONI_PAGINA_PUNTI_VENDITA[0]);
  const [ricerca, setRicerca] = useState("");
  const [ricercaApplicata, setRicercaApplicata] = useState("");
  const [filtroCanale, setFiltroCanale] = useState("");
  const [filtroArea, setFiltroArea] = useState("");
  const chiaveFiltro = filtro?.chiave ?? "";

  useEffect(() => {
    const attesa = setTimeout(() => setRicercaApplicata(ricerca), 400);
    return () => clearTimeout(attesa);
  }, [ricerca]);

  useEffect(() => {
    setPagina(1);
  }, [ricercaApplicata, dimensionePagina, filtroCanale, filtroArea, chiaveFiltro]);

  // Il filtro della pagina vale prima degli altri: anche i conteggi per canale e area lo rispettano
  const testFiltro = filtro?.test;
  const base = useMemo(() => (testFiltro ? tutti.filter(testFiltro) : tutti), [tutti, testFiltro]);

  // ponytail: ricerca, filtri e pagine nel browser sull'elenco completo, già scaricato per la mappa;
  // regge qualche migliaio di PV, oltre si passa ai filtri lato server
  const filtrati = useMemo(
    () => filtraPuntiVendita(base, { testo: ricercaApplicata, idCanale: filtroCanale, idArea: filtroArea }),
    [base, ricercaApplicata, filtroCanale, filtroArea]
  );
  // Ogni dimensione conta i PV rispettando gli altri filtri, non il proprio
  const perCanale = useMemo(
    () => contaPer(filtraPuntiVendita(base, { testo: ricercaApplicata, idArea: filtroArea }), "canale"),
    [base, ricercaApplicata, filtroArea]
  );
  const perArea = useMemo(
    () => contaPer(filtraPuntiVendita(base, { testo: ricercaApplicata, idCanale: filtroCanale }), "area"),
    [base, ricercaApplicata, filtroCanale]
  );
  // I colori di tutte le pagine dei punti vendita: per nome sulle insegne della rete, più quelle
  // dell'anagrafica che mancassero. Calcolati al render: i colori del tema cambiano con lo schema scelto
  const canaliLocali = useMemo(() => contaPer(tutti, "canale").map(({ id, nome }) => ({ id, nome })), [tutti]);
  const tintaDelCanale = useTinteCanali(canaliLocali);
  const coloreDelCanale = useCallback((idCanale: string) => coloreDaTinta(tintaDelCanale(idCanale)), [tintaDelCanale]);
  const coloreCanale = useCallback((pv: T) => coloreDelCanale(pv.id_canale ?? ""), [coloreDelCanale]);

  const totalePagine = Math.ceil(filtrati.length / dimensionePagina);
  // Dopo un'eliminazione l'ultima pagina può sparire
  useEffect(() => {
    if (totalePagine > 0 && pagina > totalePagine) setPagina(totalePagine);
  }, [pagina, totalePagine]);

  const righe = filtrati.slice((pagina - 1) * dimensionePagina, pagina * dimensionePagina);

  const azzeraFiltroAggiuntivo = filtro?.azzera;
  const azzeraFiltri = useCallback(() => {
    setRicerca("");
    setFiltroCanale("");
    setFiltroArea("");
    azzeraFiltroAggiuntivo?.();
  }, [azzeraFiltroAggiuntivo]);

  return {
    ricerca,
    setRicerca,
    ricercaApplicata,
    filtroCanale,
    setFiltroCanale,
    filtroArea,
    setFiltroArea,
    conFiltri: Boolean(ricercaApplicata.trim() || filtroCanale || filtroArea || filtro),
    azzeraFiltri,
    filtrati,
    perCanale,
    perArea,
    coloreCanale,
    coloreDelCanale,
    tintaDelCanale,
    senzaCoordinate: filtrati.filter(pv => !haCoordinate(pv)).length,
    pagina,
    setPagina,
    dimensionePagina,
    setDimensionePagina,
    righe,
    primaRiga: filtrati.length === 0 ? 0 : (pagina - 1) * dimensionePagina,
    mostraCodiciGdo: righe.some(pv => codiciIdentificativi(pv.meta).length > 0),
  };
}
