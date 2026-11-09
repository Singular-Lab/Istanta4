import { Page, Path, Rect, Svg, Text, View } from "@react-pdf/renderer";
import type { ComponentProps, ReactNode } from "react";
import type { ReportVolantino } from "../../../../lib/insightVolantino/report";
import type { TemaReport } from "./stili";
import { dataEstesa, numeroSezione } from "./testi";

/**
 * Pezzi comuni del documento: il testo senza sillabazione, la pagina con testata e piè di pagina,
 * le intestazioni delle sezioni, la freccia della variazione e il numero dei box.
 */

/** Le parole non si spezzano: la sillabazione di @react-pdf e' inglese e sull'italiano sbaglia. */
const parolaIntera = (parola: string): string[] => [parola];

type ProprietaTesto = Exclude<ComponentProps<typeof Text>, { x: string | number }>;

/** Text di @react-pdf senza sillabazione automatica, solo per questo documento. */
export function Testo(proprieta: ProprietaTesto) {
  return <Text hyphenationCallback={parolaIntera} {...proprieta} />;
}

interface ProprietaPagina {
  tema: TemaReport;
  report: ReportVolantino;
  /** Titolo della sezione, a destra nella testata. */
  sezione: string;
  children: ReactNode;
}

/** Pagina A4 del report: testata (cliente · titolo del volantino) e piè di pagina su ogni foglio. */
export function PaginaReport({ tema, report, sezione, children }: ProprietaPagina) {
  const { s } = tema;
  return (
    <Page size="A4" style={s.pagina} wrap>
      <View style={s.testata} fixed>
        <View style={s.testataSinistra}>
          <Testo style={s.testataCliente}>{report.intestazione.cliente}</Testo>
          <Testo style={s.testataTitolo}>{`  ·  ${report.titolo}`}</Testo>
        </View>
        <Testo style={s.testataSezione}>{sezione}</Testo>
      </View>
      {children}
      <View style={s.piede} fixed>
        <Testo style={s.piedeTesto}>{report.intestazione.riservatezza}</Testo>
        <Testo style={s.piedeTesto}>{`Generato il ${dataEstesa(report.generatoIl)}`}</Testo>
        <Testo style={s.piedeNumero} render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`} />
      </View>
    </Page>
  );
}

interface ProprietaIntestazione {
  tema: TemaReport;
  /** Posizione della sezione nel report, da 0. */
  indice: number;
  titolo: string;
  introduzione?: string | null;
  /** Testo sotto il titolo, piu' piccolo (es. la misura della mappa). */
  dettaglio?: string | null;
}

/** Apertura di una sezione: numero, titolo, filetto e introduzione. */
export function IntestazioneSezione({ tema, indice, titolo, introduzione, dettaglio }: ProprietaIntestazione) {
  const { s } = tema;
  return (
    <View style={s.sezione} wrap={false}>
      <Testo style={s.sezioneNumero}>{numeroSezione(indice)}</Testo>
      <Testo style={s.sezioneTitolo}>{titolo}</Testo>
      <View style={s.sezioneFiletto} />
      {introduzione ? <Testo style={s.sezioneIntroduzione}>{introduzione}</Testo> : null}
      {dettaglio ? <Testo style={s.nota}>{dettaglio}</Testo> : null}
    </View>
  );
}

/** Intestazione ridotta delle pagine che continuano una sezione. */
export function IntestazioneSegue({ tema, indice, titolo }: Pick<ProprietaIntestazione, "tema" | "indice" | "titolo">) {
  const { s } = tema;
  return (
    <View style={s.segue} wrap={false}>
      <Testo style={s.segueNumero}>{numeroSezione(indice)}</Testo>
      <Testo style={s.segueTitolo}>{titolo}</Testo>
      <Testo style={s.segueNota}>(segue)</Testo>
    </View>
  );
}

/** Freccia della variazione: triangolo in su o in giu', trattino se pari. */
export function Freccia({ verso, colore }: { verso: "su" | "giu" | "pari"; colore: string }) {
  return (
    <Svg width={7} height={6} viewBox="0 0 7 6">
      {verso === "pari" ? (
        <Rect x={0.5} y={2.4} width={6} height={1.2} fill={colore} />
      ) : (
        <Path d={verso === "su" ? "M3.5 0 L7 6 L0 6 Z" : "M0 0 L7 0 L3.5 6 Z"} fill={colore} />
      )}
    </Svg>
  );
}

/** Numero di un box in evidenza: cerchio pieno con la cifra in bianco. */
export function NumeroBox({ tema, numero, colore }: { tema: TemaReport; numero: number; colore: string }) {
  const { s } = tema;
  return (
    <View style={[s.numeroBox, { backgroundColor: colore }]}>
      <Testo style={s.numeroBoxTesto}>{String(numero)}</Testo>
    </View>
  );
}

/** Colore del box in evidenza: l'accento solo per il valore piu' alto del volantino. */
export const coloreEvidenza = (tema: TemaReport, migliore: boolean): string =>
  migliore ? tema.palette.accento : tema.palette.primario;
