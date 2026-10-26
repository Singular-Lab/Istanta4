import { pdf } from "@react-pdf/renderer";
import type { TracciatoReport } from "../../../lib/types";
import { TracciatoReportPdfDocument } from "./TracciatoReportPdfDocument";

export async function createTracciatoReportPdfBlob(report: TracciatoReport, promoName?: string): Promise<Blob> {
  return pdf(<TracciatoReportPdfDocument report={report} promoName={promoName} />).toBlob();
}
