import { Path, Svg, View } from "@react-pdf/renderer";
import { formattaValore, type UnitaMisura } from "../../../../lib/insightVolantino/formato";
import type { GraficoReport, GraficoSezione } from "../../../../lib/insightVolantino/report";
import { Testo } from "./componenti";
import { coloriConfronto, fetteCiambella, lunghezzaBarra, righeNelloSpazio, scalaAsse, settoreAnulare, type ScalaAsse } from "./grafici";
import { LARGHEZZA_UTILE } from "./misure";
import type { TemaReport } from "./stili";
import { testoQuota } from "./testi";

/**
 * Grafici del report, disegnati con View (barre) e Svg (ciambella): testo vero con il font del
 * documento, griglia leggera, valori scritti in fondo alle barre. La legenda solo dove serve (la
 * ciambella e il confronto fra due serie).
 */

/** Colonna delle etichette delle barre e spazio per il valore in fondo alla barra. */
const ETICHETTE = 150;
const VALORE = 58;
const TRACCIA = LARGHEZZA_UTILE - ETICHETTE - VALORE;

type Barre = Extract<GraficoReport, { forma: "barre" }>;
type Ciambella = Extract<GraficoReport, { forma: "ciambella" }>;
type Confronto = Extract<GraficoReport, { forma: "confronto" }>;

/** Linee verticali della griglia alle tacche, dietro le barre (lo 0 piu' marcato). */
function Griglia({ tema, scala }: { tema: TemaReport; scala: ScalaAsse }) {
  return (
    <>
      {scala.tacche.map((tacca) => (
        <View
          key={tacca}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: ETICHETTE + lunghezzaBarra(tacca, scala.massimo, TRACCIA) - (tacca === 0 ? 0.375 : 0.25),
            width: tacca === 0 ? 0.75 : 0.5,
            backgroundColor: tacca === 0 ? tema.palette.inchiostroTenue : tema.palette.linee,
          }}
        />
      ))}
    </>
  );
}

/** Valori delle tacche sotto l'asse, centrati sulla linea. */
function Tacche({ tema, scala, unita }: { tema: TemaReport; scala: ScalaAsse; unita: UnitaMisura }) {
  const { s } = tema;
  return (
    <View style={{ position: "relative", height: 12, marginTop: 4 }}>
      {scala.tacche.map((tacca) => (
        <Testo
          key={tacca}
          style={[s.taccaTesto, { position: "absolute", top: 0, width: 50, left: ETICHETTE + lunghezzaBarra(tacca, scala.massimo, TRACCIA) - 25 }]}
        >
          {formattaValore(tacca, unita)}
        </Testo>
      ))}
    </View>
  );
}

function NotaNascoste({ tema, nascoste }: { tema: TemaReport; nascoste: number }) {
  if (nascoste <= 0) return null;
  return <Testo style={tema.s.graficoNota}>{`Altre ${nascoste} ${nascoste === 1 ? "voce" : "voci"} non mostrate.`}</Testo>;
}

function GraficoBarre({ tema, grafico, altezza }: { tema: TemaReport; grafico: Barre; altezza: number }) {
  const { s, palette } = tema;
  const righe = righeNelloSpazio(grafico.voci, altezza, 12, 20);
  const scala = scalaAsse(Math.max(0, ...righe.visibili.map((voce) => voce.valore)));
  const spessore = Math.max(5, Math.round(righe.altezzaRiga * 0.58 * 10) / 10);
  return (
    <View>
      <View style={{ position: "relative" }}>
        <Griglia tema={tema} scala={scala} />
        {righe.visibili.map((voce, indice) => (
          <View key={`${indice}-${voce.etichetta}`} style={[s.rigaBarra, { height: righe.altezzaRiga }]}>
            <Testo style={[s.etichettaBarra, { width: ETICHETTE }]}>{voce.etichetta}</Testo>
            <View
              style={{
                width: lunghezzaBarra(voce.valore, scala.massimo, TRACCIA),
                height: spessore,
                backgroundColor: voce.colore ?? palette.primario,
              }}
            />
            <Testo style={s.valoreBarra}>{voce.testo}</Testo>
          </View>
        ))}
      </View>
      <Tacche tema={tema} scala={scala} unita={grafico.unita} />
      <NotaNascoste tema={tema} nascoste={righe.nascoste} />
    </View>
  );
}

/** Diametro della ciambella e raggi della corona. */
const CIAMBELLA = { lato: 150, esterno: 70, interno: 45 };

function GraficoCiambella({ tema, grafico }: { tema: TemaReport; grafico: Ciambella }) {
  const { s, palette } = tema;
  const fette = fetteCiambella(grafico.voci, palette);
  const totale = fette.reduce((somma, fetta) => somma + fetta.valore, 0);
  const centro = CIAMBELLA.lato / 2;
  if (fette.length === 0) return <Testo style={s.notaCorsivo}>Nessun valore da rappresentare.</Testo>;
  return (
    <View style={s.ciambella} wrap={false}>
      <View style={{ width: CIAMBELLA.lato, height: CIAMBELLA.lato, position: "relative" }}>
        <Svg width={CIAMBELLA.lato} height={CIAMBELLA.lato} viewBox={`0 0 ${CIAMBELLA.lato} ${CIAMBELLA.lato}`}>
          {fette.map((fetta, indice) => (
            <Path
              key={`${indice}-${fetta.etichetta}`}
              d={settoreAnulare(centro, centro, CIAMBELLA.esterno, CIAMBELLA.interno, fetta.inizio, fetta.fine)}
              fill={fetta.colore}
              stroke={palette.carta}
              strokeWidth={fette.length > 1 ? 1 : 0}
            />
          ))}
        </Svg>
        {grafico.centro ? (
          <View style={[s.ciambellaCentro, { width: CIAMBELLA.lato, height: CIAMBELLA.lato, paddingHorizontal: centro - CIAMBELLA.interno + 6 }]}>
            <Testo style={s.ciambellaValore}>{grafico.centro.valore}</Testo>
            <Testo style={s.ciambellaEtichetta}>{grafico.centro.etichetta}</Testo>
          </View>
        ) : null}
      </View>
      <View style={s.ciambellaLegenda}>
        {fette.map((fetta, indice) => (
          <View key={`${indice}-${fetta.etichetta}`} style={s.ciambellaVoce}>
            <View style={[s.legendaSegno, { backgroundColor: fetta.colore }]} />
            <Testo style={s.ciambellaVoceEtichetta}>{fetta.etichetta}</Testo>
            <Testo style={s.ciambellaVoceValore}>{fetta.testo}</Testo>
            <Testo style={s.ciambellaVoceQuota}>{testoQuota(fetta.valore, totale)}</Testo>
          </View>
        ))}
      </View>
    </View>
  );
}

function Legenda({ tema, voci }: { tema: TemaReport; voci: Array<{ etichetta: string; colore: string }> }) {
  const { s } = tema;
  return (
    <View style={[s.legenda, { marginLeft: ETICHETTE }]}>
      {voci.map((voce) => (
        <View key={voce.etichetta} style={s.legendaVoce}>
          <View style={[s.legendaSegno, { backgroundColor: voce.colore }]} />
          <Testo style={s.legendaTesto}>{voce.etichetta}</Testo>
        </View>
      ))}
    </View>
  );
}

function GraficoConfronto({ tema, grafico, altezza }: { tema: TemaReport; grafico: Confronto; altezza: number }) {
  const { s } = tema;
  const colori = coloriConfronto(tema.palette);
  const righe = righeNelloSpazio(grafico.voci, Math.max(0, altezza - 20), 22, 30);
  const scala = scalaAsse(Math.max(0, ...righe.visibili.flatMap((voce) => voce.valori)));
  return (
    <View>
      <Legenda tema={tema} voci={grafico.serie.map((etichetta, indice) => ({ etichetta, colore: colori[indice] }))} />
      <View style={{ position: "relative" }}>
        <Griglia tema={tema} scala={scala} />
        {righe.visibili.map((voce, indice) => (
          <View key={`${indice}-${voce.etichetta}`} style={[s.rigaBarra, { height: righe.altezzaRiga }]}>
            <Testo style={[s.etichettaBarra, { width: ETICHETTE }]}>{voce.etichetta}</Testo>
            <View>
              {voce.valori.map((valore, serie) => (
                <View key={serie} style={{ flexDirection: "row", alignItems: "center", marginTop: serie === 0 ? 0 : 2 }}>
                  <View style={{ width: lunghezzaBarra(valore, scala.massimo, TRACCIA), height: 6.5, backgroundColor: colori[serie] }} />
                  <Testo style={[s.valoreBarra, { fontSize: 7.5 }]}>{voce.testi[serie]}</Testo>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
      <Tacche tema={tema} scala={scala} unita={grafico.unita} />
      <NotaNascoste tema={tema} nascoste={righe.nascoste} />
    </View>
  );
}

/** Spazio di titolo, tacche e note intorno ai dati di un grafico. */
export const CORNICE_GRAFICO = 84;

/** Un grafico con il suo titolo e la nota; `altezza` e' lo spazio per le righe dei dati. */
export function GraficoPdf({ tema, voce, altezza }: { tema: TemaReport; voce: GraficoSezione; altezza: number }) {
  const { s } = tema;
  const { grafico } = voce;
  return (
    <View style={s.grafico}>
      <Testo style={s.graficoTitolo} minPresenceAhead={60}>
        {voce.titolo}
      </Testo>
      {grafico.forma === "barre" ? <GraficoBarre tema={tema} grafico={grafico} altezza={altezza} /> : null}
      {grafico.forma === "ciambella" ? <GraficoCiambella tema={tema} grafico={grafico} /> : null}
      {grafico.forma === "confronto" ? <GraficoConfronto tema={tema} grafico={grafico} altezza={altezza} /> : null}
      {voce.nota ? <Testo style={s.graficoNota}>{voce.nota}</Testo> : null}
    </View>
  );
}
