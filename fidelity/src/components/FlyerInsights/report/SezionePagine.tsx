import { Rect, Svg, View } from "@react-pdf/renderer";
import { coloreInScala, esadecimaleDaRgb, formattaValore, legendaCalore, type VoceLegenda } from "../../../../lib/insightVolantino/calore";
import type { ReportVolantino, SezioneReport } from "../../../../lib/insightVolantino/report";
import { coloreEvidenza, IntestazioneSegue, IntestazioneSezione, NumeroBox, PaginaReport, Testo } from "./componenti";
import { FoglioVolantino } from "./FoglioVolantino";
import { altezzaTesto, capienzaEvidenza, riquadroPaginaVolantino } from "./impaginazione";
import { ALTEZZA_INTESTAZIONE_SEGUE, ALTEZZA_INTESTAZIONE_SEZIONE, COLONNA_LEGENDA, CORPO, LARGHEZZA_UTILE, MEZZA_COLONNA } from "./misure";
import { datiSezionePagine, dettaglioBox, pagineDelReport, proporzioniPagine, type BoxEvidenziato, type DatiSezionePagine } from "./pagineVolantino";
import type { TemaReport } from "./stili";
import { conteggio, TESTO_UNITA } from "./testi";
import type { ImmaginiReport } from "./tipiReport";

type Pagine = Extract<SezioneReport, { tipo: "pagine" }>;

/** Tasselli della scala dei colori: abbastanza da sembrare continua. */
const TASSELLI_SCALA = 48;

interface ProprietaSezione {
  tema: TemaReport;
  report: ReportVolantino;
  sezione: Pagine;
  /** Posizione della sezione nel report: la chiave delle sue mappe di calore. */
  indice: number;
  immagini: ImmaginiReport;
}

/** Scala dei colori della mappa con i valori nell'unita' della misura, da 0 al massimo del volantino. */
function ScalaCalore({ tema, legenda, unita, larghezza }: { tema: TemaReport; legenda: VoceLegenda[]; unita: string; larghezza: number }) {
  const { s, palette } = tema;
  const passo = larghezza / TASSELLI_SCALA;
  return (
    <View style={{ width: larghezza, marginTop: 14 }} wrap={false}>
      <Testo style={[s.etichetta, { marginBottom: 5 }]}>Scala</Testo>
      <Svg width={larghezza} height={8} viewBox={`0 0 ${larghezza} 8`}>
        {Array.from({ length: TASSELLI_SCALA }, (_, indice) => (
          <Rect
            key={indice}
            x={indice * passo}
            y={0}
            width={passo + 0.3}
            height={8}
            fill={esadecimaleDaRgb(coloreInScala((indice + 0.5) / TASSELLI_SCALA, palette.calore))}
          />
        ))}
      </Svg>
      <View style={s.scalaTacche}>
        {legenda.map((voce) => (
          <Testo key={voce.t} style={s.taccaTesto}>
            {voce.testo}
          </Testo>
        ))}
      </View>
      <Testo style={[s.nota, { marginTop: 4 }]}>{`${unita[0].toUpperCase()}${unita.slice(1)}; scala comune a tutte le pagine.`}</Testo>
    </View>
  );
}

function RigaEvidenza({ tema, voce, dati }: { tema: TemaReport; voce: BoxEvidenziato; dati: DatiSezionePagine }) {
  const { s, palette } = tema;
  const colore = coloreEvidenza(tema, voce.migliore);
  return (
    <View style={s.evidenzaVoce} wrap={false}>
      <NumeroBox tema={tema} numero={voce.numero} colore={colore} />
      <View style={s.evidenzaTesti}>
        <Testo style={s.evidenzaNome}>{voce.box.nome || `Box ${voce.box.codiceBox}`}</Testo>
        <Testo style={s.evidenzaDettaglio}>{dettaglioBox(voce.box)}</Testo>
      </View>
      <Testo style={[s.evidenzaValore, voce.migliore ? { color: palette.accento } : undefined]}>{formattaValore(voce.valore, dati.unita)}</Testo>
    </View>
  );
}

/** I box in evidenza della pagina, numerati come sul foglio. */
function ElencoEvidenza({ tema, dati, evidenza }: { tema: TemaReport; dati: DatiSezionePagine; evidenza: BoxEvidenziato[] }) {
  const { s, palette } = tema;
  const conMigliore = evidenza.some((voce) => voce.migliore);
  return (
    <View>
      <Testo style={[s.etichetta, { marginBottom: 2 }]}>Box in evidenza</Testo>
      {evidenza.length > 0 ? (
        evidenza.map((voce) => <RigaEvidenza key={voce.box.id} tema={tema} voce={voce} dati={dati} />)
      ) : (
        <Testo style={[s.notaCorsivo, { marginTop: 4 }]}>Nessun box con un valore in questa pagina.</Testo>
      )}
      {conMigliore ? (
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: palette.accento, marginRight: 5 }} />
          <Testo style={s.nota}>Il valore più alto del volantino</Testo>
        </View>
      ) : null}
    </View>
  );
}

/** Misura e scala dei colori della mappa. */
function Misura({ tema, dati, larghezza }: { tema: TemaReport; dati: DatiSezionePagine; larghezza: number }) {
  const { s, palette } = tema;
  const legenda = legendaCalore(dati.massimo, dati.unita, palette.calore);
  return (
    <View style={{ width: larghezza }}>
      <Testo style={s.etichetta}>Misura</Testo>
      <Testo style={s.misuraTitolo}>{dati.etichetta}</Testo>
      <Testo style={s.misuraDescrizione}>{dati.descrizione}</Testo>
      {legenda.length > 0 ? (
        <ScalaCalore tema={tema} legenda={legenda} unita={TESTO_UNITA[dati.unita]} larghezza={larghezza} />
      ) : (
        <Testo style={[s.notaCorsivo, { marginTop: 10 }]}>Nessun valore per questa misura nel volantino.</Testo>
      )}
    </View>
  );
}

function didascalia(report: ReportVolantino, immagine: string | null): string | null {
  if (immagine) return null;
  if (!report.pdf) return "Volantino senza PDF in Olimpo: riquadri dei box su pagina bianca.";
  return "Immagine della pagina non disponibile: riquadri dei box su pagina bianca.";
}

/**
 * Le pagine del volantino con la mappa di calore di una misura: una pagina del report per ogni
 * pagina, con l'immagine, il calore, i box in evidenza numerati e, a lato, la scala e l'elenco.
 */
export function SezionePagine({ tema, report, sezione, indice, immagini }: ProprietaSezione) {
  const { s } = tema;
  const dati = datiSezionePagine(report, sezione.misura, sezione.boxInEvidenza);
  const pagine = pagineDelReport(report);
  const proporzione = proporzioniPagine(report.box);
  const calore = immagini.calore.get(indice);
  const introduzione = sezione.introduzione ? altezzaTesto(sezione.introduzione, 400, CORPO.corpo) + 10 : 0;

  return (
    <>
      {pagine.map((pagina, posizione) => {
        const intestazione = posizione === 0 ? ALTEZZA_INTESTAZIONE_SEZIONE + introduzione : ALTEZZA_INTESTAZIONE_SEGUE;
        const riquadro = riquadroPaginaVolantino(proporzione(pagina), intestazione);
        const evidenza = (dati.evidenza.get(pagina) ?? []).slice(0, capienzaEvidenza(riquadro));
        const box = dati.boxPerPagina.get(pagina) ?? [];
        const conValore = box.filter((voce) => (dati.valori.get(voce.id) ?? 0) > 0).length;
        const immagine = immagini.pagine.get(pagina) ?? null;
        const testoDidascalia = didascalia(report, immagine);
        const laterale = Math.min(COLONNA_LEGENDA, LARGHEZZA_UTILE - riquadro.larghezza - 12);

        return (
          <PaginaReport key={pagina} tema={tema} report={report} sezione={sezione.titolo}>
            {posizione === 0 ? (
              <IntestazioneSezione tema={tema} indice={indice} titolo={sezione.titolo} introduzione={sezione.introduzione} />
            ) : (
              <IntestazioneSegue tema={tema} indice={indice} titolo={sezione.titolo} />
            )}
            <View wrap={false}>
              <View style={s.paginaTitolo}>
                <Testo>
                  <Testo style={s.paginaNumero}>{`Pagina ${pagina}`}</Testo>
                  <Testo style={s.paginaDi}>{` di ${pagine.length}`}</Testo>
                </Testo>
                <Testo style={s.nota}>
                  {box.length > 0 ? `${conteggio(box.length, "box", "box")}, ${conValore} con un valore` : "Nessun box in questa pagina"}
                </Testo>
              </View>
              <View style={riquadro.orizzontale ? s.paginaCorpoOrizzontale : s.paginaCorpo}>
                <View>
                  <FoglioVolantino
                    tema={tema}
                    larghezza={riquadro.larghezza}
                    altezza={riquadro.altezza}
                    immagine={immagine}
                    calore={calore?.get(pagina) ?? null}
                    box={box}
                    evidenza={evidenza}
                  />
                  {testoDidascalia ? <Testo style={s.paginaDidascalia}>{testoDidascalia}</Testo> : null}
                </View>
                {riquadro.orizzontale ? (
                  <View style={s.paginaLateraleOrizzontale}>
                    <Misura tema={tema} dati={dati} larghezza={MEZZA_COLONNA} />
                    <View style={{ width: MEZZA_COLONNA }}>
                      <ElencoEvidenza tema={tema} dati={dati} evidenza={evidenza} />
                    </View>
                  </View>
                ) : (
                  <View style={{ width: laterale }}>
                    <Misura tema={tema} dati={dati} larghezza={laterale} />
                    <View style={{ marginTop: 18 }}>
                      <ElencoEvidenza tema={tema} dati={dati} evidenza={evidenza} />
                    </View>
                  </View>
                )}
              </View>
            </View>
          </PaginaReport>
        );
      })}
    </>
  );
}
