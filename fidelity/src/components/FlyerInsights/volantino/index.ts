/**
 * Il volantino sfogliabile degli insight: pagine vere del PDF con i riquadri dei box, colori,
 * ingrandimento, scheda del box e viaggio del prodotto.
 */
export { default, VolantinoSfogliabile, LIVELLI_ZOOM, type VolantinoSfogliabileProps } from "./VolantinoSfogliabile";
export { PaginaConImmagine, type PaginaConImmagineProps } from "./PaginaConImmagine";
export { SchedaBox, type SchedaBoxProps } from "./SchedaBox";
export { ViaggioProdotto, type ViaggioProdottoProps } from "./ViaggioProdotto";
export { descrizioneBox, marcaFormato, testoReparto, testoVisibilita, tooltipBox, trovaBoxIniziale } from "./box";
export {
  coloriReparti,
  fasciaSconto,
  fasciaVisibilita,
  legendaDifferenze,
  legendaModo,
  OPZIONI_COLORE,
  stileBox,
  stileDifferenza,
  tintaMeccanica,
  tintaSconto,
  tintaVisibilita,
  type ColoriReparti,
  type ModoColore,
  type StileRiquadro,
} from "./colori";
export {
  doppiaDellaPagina,
  etichettaDoppia,
  pagineDellaDoppia,
  paginaNellImmagine,
  PROPORZIONE_PREDEFINITA,
  riquadroBox,
  stileImmagine,
  totaleDoppie,
  type DoppiaPagina,
  type PaginaNellImmagine,
} from "./geometria";
