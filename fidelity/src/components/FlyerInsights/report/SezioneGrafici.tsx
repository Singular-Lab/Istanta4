import type { ReportVolantino, SezioneReport } from "../../../../lib/insightVolantino/report";
import { IntestazioneSegue, IntestazioneSezione, PaginaReport } from "./componenti";
import { CORNICE_GRAFICO, GraficoPdf } from "./GraficiPdf";
import { altezzaTesto, gruppiGrafici } from "./impaginazione";
import { ALTEZZA_INTESTAZIONE_SEGUE, ALTEZZA_INTESTAZIONE_SEZIONE, ALTEZZA_UTILE, CORPO } from "./misure";
import type { TemaReport } from "./stili";

type Grafici = Extract<SezioneReport, { tipo: "grafici" }>;

interface ProprietaSezione {
  tema: TemaReport;
  report: ReportVolantino;
  sezione: Grafici;
  indice: number;
}

/**
 * Grafici di una sezione: al massimo due per pagina (un grafico con molte voci sta da solo), nello
 * stesso ordine. La prima pagina apre la sezione, le altre la continuano.
 */
export function SezioneGrafici({ tema, report, sezione, indice }: ProprietaSezione) {
  const gruppi = gruppiGrafici(sezione.grafici);
  const introduzione = sezione.introduzione ? altezzaTesto(sezione.introduzione, 400, CORPO.corpo) + 10 : 0;
  return (
    <>
      {gruppi.map((gruppo, posizione) => {
        const intestazione = posizione === 0 ? ALTEZZA_INTESTAZIONE_SEZIONE + introduzione : ALTEZZA_INTESTAZIONE_SEGUE;
        const altezzaDati = Math.max(60, (ALTEZZA_UTILE - intestazione) / gruppo.length - CORNICE_GRAFICO);
        return (
          <PaginaReport key={posizione} tema={tema} report={report} sezione={sezione.titolo}>
            {posizione === 0 ? (
              <IntestazioneSezione tema={tema} indice={indice} titolo={sezione.titolo} introduzione={sezione.introduzione} />
            ) : (
              <IntestazioneSegue tema={tema} indice={indice} titolo={sezione.titolo} />
            )}
            {gruppo.map((grafico, numero) => (
              <GraficoPdf key={`${numero}-${grafico.titolo}`} tema={tema} voce={grafico} altezza={altezzaDati} />
            ))}
          </PaginaReport>
        );
      })}
    </>
  );
}
