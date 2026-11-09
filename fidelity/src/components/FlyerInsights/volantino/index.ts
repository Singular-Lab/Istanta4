/**
 * Il volantino sfogliabile degli insight: pagine vere del PDF con i riquadri dei box, colori o
 * mappa di calore continua, ingrandimento, scheda del box e viaggio del prodotto.
 */
export { default, VolantinoSfogliabile, LIVELLI_ZOOM, spiegazionePesi, type VolantinoSfogliabileProps } from "./VolantinoSfogliabile";
export { PaginaConImmagine, type PaginaConImmagineProps } from "./PaginaConImmagine";
export { LegendaCalore, type LegendaCaloreProps } from "./LegendaCalore";
export { disegnaDensita, LivelloCalore, type LivelloCaloreProps } from "./LivelloCalore";
export {
  calcolaMappaCalore,
  COLONNE_CALORE,
  creaCalcolatoreMappe,
  gradienteScala,
  misuraEffettiva,
  misuraPredefinita,
  OPZIONI_VISTA,
  testoValoreMisura,
  type MappaCalore,
  type VistaVolantino,
} from "./mappaCalore";
export { SchedaBox, type PrevisioneScheda, type SchedaBoxProps, type VenditeScheda } from "./SchedaBox";
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
  proporzioneDelVolantino,
  proporzioneDellaPagina,
  PROPORZIONE_PREDEFINITA,
  riquadroBox,
  stileImmagine,
  totaleDoppie,
  type DoppiaPagina,
  type PaginaNellImmagine,
} from "./geometria";
