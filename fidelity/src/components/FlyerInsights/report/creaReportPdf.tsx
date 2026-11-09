import { pdf } from "@react-pdf/renderer";
import type { ReportVolantino } from "../../../../lib/insightVolantino/report";
import { registraFontReport } from "./fontReport";
import { FAMIGLIA_REPORT, FAMIGLIA_RISERVA } from "./misure";
import { ReportVolantinoPdf } from "./ReportVolantinoPdf";
import type { ImmaginiReport } from "./tipiReport";

/**
 * Il modulo pesante del report PDF del volantino: @react-pdf, il documento, i font e le immagini.
 * Lo carica ScaricaReportPdf con import() al click, cosi' resta fuori dal codice della pagina.
 */

export { preparaImmagini } from "./immagini";

/**
 * Il PDF del report. Se i file di Noto Sans non si caricano (rete, proxy), il report si fa lo stesso
 * con Helvetica, il font standard del PDF.
 */
export async function creaBlobReport(report: ReportVolantino, immagini: ImmaginiReport): Promise<Blob> {
  registraFontReport();
  try {
    return await pdf(<ReportVolantinoPdf report={report} immagini={immagini} famiglia={FAMIGLIA_REPORT} />).toBlob();
  } catch {
    return pdf(<ReportVolantinoPdf report={report} immagini={immagini} famiglia={FAMIGLIA_RISERVA} />).toBlob();
  }
}
