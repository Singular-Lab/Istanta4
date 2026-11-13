/**
 * Analisi del volantino lato pagina (contratto in lib/insightVolantino/tipi.ts): la sintesi per la
 * Direzione, il menabò, la distribuzione nelle pagine, i marchi del distributore e le sezioni Reparti
 * e Meccaniche e sconti. Valgono per ogni GDO e per i kit di Istanta e dello storico.
 */
export { BarreAppaiate, type BarreAppaiateProps, type VoceAppaiata } from "./BarreAppaiate";
export { DistribuzionePagine, distribuzionePagine, type ColonnaPagina, type DistribuzionePagineProps, type ParteColonna } from "./DistribuzionePagine";
export { coloreSezione, intervalliPagine, MenaboVolantino, pagineDelMenabo, sezioniDelMenabo, testoSuColore, type MenaboVolantinoProps, type PaginaDelMenabo, type SezioneDelMenabo } from "./MenaboVolantino";
export { MarchiDistributore, type MarchiDistributoreProps } from "./MarchiDistributore";
export { PrezziSconti, type PrezziScontiProps } from "./PrezziSconti";
export { RepartiVolantino, type RepartiVolantinoProps } from "./RepartiVolantino";
export { SintesiInsight, type SintesiInsightProps } from "./SintesiInsight";
