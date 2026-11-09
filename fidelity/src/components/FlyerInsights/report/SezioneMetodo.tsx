import { View } from "@react-pdf/renderer";
import type { ReportVolantino, SezioneReport } from "../../../../lib/insightVolantino/report";
import { IntestazioneSezione, PaginaReport, Testo } from "./componenti";
import type { TemaReport } from "./stili";

type Metodo = Extract<SezioneReport, { tipo: "metodo" }>;

interface ProprietaSezione {
  tema: TemaReport;
  report: ReportVolantino;
  sezione: Metodo;
  indice: number;
}

/** Nota di metodo: paragrafi in una colonna stretta, che va a capo sulle pagine seguenti. */
export function SezioneMetodo({ tema, report, sezione, indice }: ProprietaSezione) {
  const { s } = tema;
  return (
    <PaginaReport tema={tema} report={report} sezione={sezione.titolo}>
      <IntestazioneSezione tema={tema} indice={indice} titolo={sezione.titolo} />
      <View style={s.metodo}>
        {sezione.paragrafi.map((paragrafo, posizione) => (
          <Testo key={posizione} style={s.metodoParagrafo} orphans={2} widows={2}>
            {paragrafo}
          </Testo>
        ))}
      </View>
    </PaginaReport>
  );
}
