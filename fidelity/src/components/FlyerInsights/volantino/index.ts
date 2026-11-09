/**
 * Il volantino degli insight come lettore di PDF: tutte le pagine dal PDF con i riquadri dei box,
 * indice delle pagine, zoom, colori, scheda del box e viaggio del prodotto.
 */
export { default, VolantinoSfogliabile, LIVELLI_ZOOM, type VolantinoSfogliabileProps } from "./VolantinoSfogliabile";
export { PaginaConImmagine, type PaginaConImmagineProps } from "./PaginaConImmagine";
export { SchedaBox, type SchedaBoxProps } from "./SchedaBox";
export { ViaggioProdotto, type ViaggioProdottoProps } from "./ViaggioProdotto";
export { descrizioneBox, marcaFormato, testoReparto, tooltipBox, trovaBoxIniziale } from "./box";
export {
  coloriReparti,
  fasciaSconto,
  legendaDifferenze,
  legendaModo,
  OPZIONI_COLORE,
  stileBox,
  stileDifferenza,
  tintaMeccanica,
  tintaSconto,
  type ColoriReparti,
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
export { IndicePagine, type IndicePagineProps, type VoceIndice } from "./IndicePagine";
