/**
 * Il volantino degli insight da sfogliare come quello stampato: le pagine aperte con le immagini di
 * Olimpo e i riquadri dei box (sempre nascosti), indice delle pagine, zoom fino alla risoluzione
 * reale, lettura a schermo pieno, colori, ricerca e interrogazione dei box, analisi delle pagine
 * aperte, scheda del box e viaggio del prodotto.
 */
export { ATTRIBUTO_LETTORE, default, VolantinoSfogliabile, type VolantinoSfogliabileProps } from "./VolantinoSfogliabile";
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
  altezzaAdattata,
  aperturaDi,
  aperture,
  aperturaVicina,
  LIVELLI_ZOOM,
  paginaNellImmagine,
  paginaRichiesta,
  pagineDaPreparare,
  PROPORZIONE_PREDEFINITA,
  proporzioneRitaglio,
  puntoNelLibro,
  riquadroBox,
  scorrimentoPerPunto,
  stileImmagine,
  stileRitaglio,
  testoApertura,
  ZOOM_MASSIMO_MINIMO,
  zoomDallaRotella,
  zoomMassimo,
  zoomVicino,
  type Apertura,
  type PaginaNellImmagine,
} from "./geometria";
export { IndicePagine, misuraMiniatura, type IndicePagineProps, type VoceIndice } from "./IndicePagine";
