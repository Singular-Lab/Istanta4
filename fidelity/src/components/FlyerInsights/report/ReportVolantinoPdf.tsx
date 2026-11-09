import { Document } from "@react-pdf/renderer";
import { PALETTE_REPORT_STANDARD, type PaletteReport, type ReportVolantino, type SezioneReport } from "../../../../lib/insightVolantino/report";
import { Copertina } from "./Copertina";
import { FAMIGLIA_REPORT } from "./misure";
import { SezioneGrafici } from "./SezioneGrafici";
import { SezioneMetodo } from "./SezioneMetodo";
import { SezioneSintesi } from "./SezioneSintesi";
import { SezioneTabella } from "./SezioneTabella";
import { creaTema, type TemaReport } from "./stili";
import type { ImmaginiReport } from "./tipiReport";

/**
 * Il documento del report PDF di un volantino: copertina (con la miniatura della prima pagina), poi
 * le sezioni nell'ordine in cui le manda il server (le decide la libreria agenzia del cliente), ognuna
 * dalla sua pagina. Testata e piè di pagina sono su tutte le pagine tranne la copertina. Le pagine
 * del volantino non entrano nel report.
 */

type ColoreSingolo = Exclude<keyof PaletteReport, "categorie">;

/** La palette ricevuta, con quella standard per i colori che mancassero (vuoti o null). */
export function paletteCompleta(palette: Partial<PaletteReport> | null | undefined): PaletteReport {
  const colore = (chiave: ColoreSingolo): string => {
    const valore: unknown = palette?.[chiave];
    return typeof valore === "string" && valore.trim() ? valore : PALETTE_REPORT_STANDARD[chiave];
  };
  const elenco = (valore: unknown, minimo: number, standard: string[]): string[] =>
    Array.isArray(valore) && valore.length >= minimo && valore.every((voce) => typeof voce === "string" && voce.trim()) ? valore : standard;
  return {
    inchiostro: colore("inchiostro"),
    inchiostroTenue: colore("inchiostroTenue"),
    carta: colore("carta"),
    superficie: colore("superficie"),
    linee: colore("linee"),
    primario: colore("primario"),
    accento: colore("accento"),
    positivo: colore("positivo"),
    negativo: colore("negativo"),
    categorie: elenco(palette?.categorie, 1, PALETTE_REPORT_STANDARD.categorie),
  };
}

interface ProprietaSezione {
  tema: TemaReport;
  report: ReportVolantino;
  sezione: SezioneReport;
  indice: number;
}

function Sezione({ tema, report, sezione, indice }: ProprietaSezione) {
  switch (sezione.tipo) {
    case "sintesi":
      return <SezioneSintesi tema={tema} report={report} sezione={sezione} indice={indice} />;
    case "grafici":
      return <SezioneGrafici tema={tema} report={report} sezione={sezione} indice={indice} />;
    case "tabella":
      return <SezioneTabella tema={tema} report={report} sezione={sezione} indice={indice} />;
    case "metodo":
      return <SezioneMetodo tema={tema} report={report} sezione={sezione} indice={indice} />;
    default:
      // Un tipo di sezione che questo client non conosce (o non mostra piu', come le vecchie 'pagine'): si salta
      return null;
  }
}

export interface ReportVolantinoPdfProps {
  report: ReportVolantino;
  immagini: ImmaginiReport;
  /** Famiglia dei caratteri: Noto Sans registrata da fontReport.ts, o Helvetica di riserva. */
  famiglia?: string;
}

export function ReportVolantinoPdf({ report, immagini, famiglia = FAMIGLIA_REPORT }: ReportVolantinoPdfProps) {
  const palette = paletteCompleta(report.palette);
  const completo: ReportVolantino = { ...report, palette };
  const tema = creaTema(palette, famiglia);
  return (
    <Document
      title={`Report volantino - ${report.titolo}`}
      author={report.intestazione.cliente}
      subject={report.sottotitolo}
      creator="Fidelity"
      producer="Fidelity"
      language="it-IT"
    >
      <Copertina tema={tema} report={completo} immagine={immagini.copertina} />
      {report.sezioni.map((sezione, indice) => (
        <Sezione key={`${indice}-${sezione.tipo}`} tema={tema} report={completo} sezione={sezione} indice={indice} />
      ))}
    </Document>
  );
}

export default ReportVolantinoPdf;
