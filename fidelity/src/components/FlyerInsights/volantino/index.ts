/**
 * Il volantino degli insight come lettore: tutte le pagine con le immagini di Olimpo e i riquadri dei
 * box, indice delle pagine, zoom, colori, ricerca dei box, analisi della pagina guardata, scheda del
 * box e viaggio del prodotto.
 */
export { default, VolantinoSfogliabile, LIVELLI_ZOOM, type VolantinoSfogliabileProps } from "./VolantinoSfogliabile";
export { PaginaConImmagine, type PaginaConImmagineProps } from "./PaginaConImmagine";
export { AnalisiPagina, type AnalisiPaginaProps } from "./AnalisiPagina";
export {
  cercaBox,
  LUNGHEZZA_MINIMA_RICERCA,
  normalizzaRicerca,
  ordineLettura,
  perSpazio,
  ripartizionePagina,
  risultatoVicino,
  sintesiPagina,
  type GruppoPagina,
  type SintesiPagina,
} from "./analisiPagina";
export { SchedaBox, type SchedaBoxProps } from "./SchedaBox";
export { ViaggioProdotto, type ViaggioProdottoProps } from "./ViaggioProdotto";
export { descrizioneBox, marcaFormato, testoReparto, tooltipBox, trovaBoxIniziale } from "./box";
export {
  coloreMarketing,
  coloriReparti,
  fasciaSconto,
  gruppoBox,
  legendaModo,
  OPZIONI_COLORE,
  stileBox,
  tintaMeccanica,
  tintaSconto,
  type ColoriReparti,
  type GruppoBox,
  type ModoColore,
  type StileRiquadro,
} from "./colori";
export {
  paginaNellImmagine,
  paginaRichiesta,
  pagineInVista,
  PROPORZIONE_PREDEFINITA,
  riquadroBox,
  stileImmagine,
  type PaginaNellImmagine,
  type PosizionePagina,
} from "./geometria";
export { IndicePagine, misuraMiniatura, type IndicePagineProps, type VoceIndice } from "./IndicePagine";
