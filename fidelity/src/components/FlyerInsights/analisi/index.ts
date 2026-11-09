/**
 * Analisi del volantino lato pagina (contratto in lib/insightVolantino/tipi.ts e rendimento.ts): la
 * sintesi per la Direzione, le schede Prezzi e sconti, Spazio, Marche e Zone calde, il rendimento
 * dalle vendite importate e la previsione. Valgono per ogni GDO e per i kit di Istanta e dello storico.
 */
export {
  ETICHETTE_AFFIDABILITA,
  ETICHETTE_TIPO_PREVISIONE,
  scartoPercentuale,
  testoCasi,
  testoIndicePosizione,
  testoPrevisto,
  testoScarto,
  VARIANTE_AFFIDABILITA,
} from "./affidabilita";
export { BarreAppaiate, type BarreAppaiateProps, type VoceAppaiata } from "./BarreAppaiate";
export { MarcheVolantino, type MarcheVolantinoProps } from "./MarcheVolantino";
export { boxPiuScostati, conteggioAffidabilita, Previsione, type PrevisioneProps } from "./Previsione";
export { PrezziSconti, type PrezziScontiProps } from "./PrezziSconti";
export { Rendimento, testoTotaleVendite, vociRendimentoReparto, type RendimentoProps } from "./Rendimento";
export { SintesiInsight, type SintesiInsightProps } from "./SintesiInsight";
export { UsoSpazio, type UsoSpazioProps } from "./UsoSpazio";
export { ZoneCalde, type ZoneCaldeProps } from "./ZoneCalde";
