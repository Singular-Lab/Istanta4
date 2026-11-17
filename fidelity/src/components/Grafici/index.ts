/**
 * Grafici SVG delle pagine dei punti vendita (scheda, volantino, referenza, elenco e gestione):
 * disegnati in linea, con i colori di chartTheme e dei token di Tailwind (tema scuro compreso),
 * tooltip su ogni segno e i dati anche in tabella per le tecnologie assistive.
 */
export { BarreImpilate100, type BarreImpilate100Props, type CategoriaImpilata } from "./BarreImpilate100";
export { BarreOrizzontali, type BarreOrizzontaliProps, type VoceBarra } from "./BarreOrizzontali";
export { Colonne, type ColonneProps, type VoceColonna } from "./Colonne";
export * from "./colori";
export { FasceNelTempo, type FasceNelTempoProps, type FasciaTempo, type RigaFasce, type TonoFascia } from "./FasceNelTempo";
export { ForbicePrezzo, type ForbicePrezzoProps } from "./ForbicePrezzo";
export { GraficoLinee, type GraficoLineeProps, type PuntoLinea, type SerieLinea } from "./GraficoLinee";
export { Heatmap, type AsseHeatmap, type HeatmapProps } from "./Heatmap";
export { Legenda, SegnoLegenda, type FormaSegno, type VoceLegenda } from "./Legenda";
export { MiniBarre, type MiniBarreProps } from "./MiniBarre";
export { altezzaFoglio, MiniaturaPagina, PaginaVolantino, type BoxPagina, type MiniaturaPaginaProps, type PaginaVolantinoProps } from "./PaginaVolantino";
export { StrisciaNumeri, type NumeroStriscia, type StrisciaNumeriProps } from "./StrisciaNumeri";
export { StrisciaPresenze, type StrisciaPresenzeProps } from "./StrisciaPresenze";
export { TabellaDati } from "./TabellaDati";
export {
  TimelineVolantini,
  type AssenzaTimeline,
  type BarraTimeline,
  type EventoTimeline,
  type FasciaTimeline,
  type FormaEvento,
  type GruppoTimeline,
  type TimelineVolantiniProps,
  type TracciaTimeline,
} from "./TimelineVolantini";
export { useTooltip, type ContenutoTooltip, type RigaTooltip } from "./Tooltip";
export { useLarghezza } from "./useLarghezza";
export * from "./scale";
