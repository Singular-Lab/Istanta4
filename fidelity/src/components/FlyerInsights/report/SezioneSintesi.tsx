import { View } from "@react-pdf/renderer";
import type { IndicatoreReport, ReportVolantino, SezioneReport } from "../../../../lib/insightVolantino/report";
import { Freccia, IntestazioneSezione, PaginaReport, Testo } from "./componenti";
import { indicatoriPerRiga } from "./impaginazione";
import type { TemaReport } from "./stili";
import { segmentiFrase } from "./testi";

type Sintesi = Extract<SezioneReport, { tipo: "sintesi" }>;

interface ProprietaSezione {
  tema: TemaReport;
  report: ReportVolantino;
  sezione: Sintesi;
  indice: number;
}

/** Colore della variazione: verde se positiva, rosso se negativa, tenue se neutra. */
function coloreVariazione(tema: TemaReport, positiva: boolean | null): string {
  if (positiva === true) return tema.palette.positivo;
  if (positiva === false) return tema.palette.negativo;
  return tema.palette.inchiostroTenue;
}

function Indicatore({ tema, indicatore, chiave, larghezza }: { tema: TemaReport; indicatore: IndicatoreReport; chiave: boolean; larghezza: string }) {
  const { s } = tema;
  const variazione = indicatore.variazione;
  const colore = variazione ? coloreVariazione(tema, variazione.positiva) : tema.palette.inchiostroTenue;
  return (
    <View style={[s.indicatore, { width: larghezza }]} wrap={false}>
      <View style={chiave ? s.indicatoreCorpoChiave : s.indicatoreCorpo}>
        <Testo style={s.etichetta}>{indicatore.etichetta}</Testo>
        <Testo style={chiave ? s.indicatoreValoreChiave : s.indicatoreValore}>{indicatore.valore}</Testo>
        {indicatore.dettaglio ? <Testo style={s.indicatoreDettaglio}>{indicatore.dettaglio}</Testo> : null}
        {variazione ? (
          <View style={s.variazione}>
            <Freccia verso={variazione.verso} colore={colore} />
            <Testo style={[s.variazioneTesto, { color: colore }]}>{variazione.testo}</Testo>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Frase chiave: i numeri (o le parti tra **) in grassetto. */
function Frase({ tema, frase }: { tema: TemaReport; frase: string }) {
  const { s } = tema;
  return (
    <View style={s.frase} wrap={false}>
      <View style={s.fraseSegno} />
      <Testo style={s.fraseTesto}>
        {segmentiFrase(frase).map((segmento, indice) =>
          segmento.grassetto ? (
            <Testo key={indice} style={s.grassetto}>
              {segmento.testo}
            </Testo>
          ) : (
            segmento.testo
          )
        )}
      </Testo>
    </View>
  );
}

/**
 * Sintesi: riquadri degli indicatori (il primo e' il dato chiave, nel colore d'accento) con la
 * variazione sull'edizione precedente, poi le frasi chiave.
 */
export function SezioneSintesi({ tema, report, sezione, indice }: ProprietaSezione) {
  const { s } = tema;
  const perRiga = indicatoriPerRiga(sezione.indicatori.length);
  const larghezza = `${(100 / perRiga).toFixed(4)}%`;
  return (
    <PaginaReport tema={tema} report={report} sezione={sezione.titolo}>
      <IntestazioneSezione tema={tema} indice={indice} titolo={sezione.titolo} />
      {sezione.indicatori.length > 0 ? (
        <View style={s.indicatori}>
          {sezione.indicatori.map((indicatore, posizione) => (
            <Indicatore
              key={`${posizione}-${indicatore.etichetta}`}
              tema={tema}
              indicatore={indicatore}
              chiave={posizione === 0}
              larghezza={larghezza}
            />
          ))}
        </View>
      ) : null}
      {sezione.frasi.length > 0 ? (
        <View style={s.frasi}>
          <Testo style={[s.etichetta, { marginBottom: 10 }]}>Punti chiave</Testo>
          {sezione.frasi.map((frase, posizione) => (
            <Frase key={posizione} tema={tema} frase={frase} />
          ))}
        </View>
      ) : null}
    </PaginaReport>
  );
}
