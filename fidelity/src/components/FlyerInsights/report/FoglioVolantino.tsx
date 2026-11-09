import { Image, View } from "@react-pdf/renderer";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import { riquadroBox } from "../volantino/geometria";
import { coloreEvidenza, NumeroBox } from "./componenti";
import type { BoxEvidenziato } from "./pagineVolantino";
import type { TemaReport } from "./stili";

/** Diametro del numero dei box (vedi stili.numeroBox). */
const NUMERO = 13;

interface ProprietaFoglio {
  tema: TemaReport;
  larghezza: number;
  altezza: number;
  /** JPEG della pagina rifilata; null: pagina bianca con i riquadri di tutti i box. */
  immagine: string | null;
  /** PNG trasparente della mappa di calore, sopra l'immagine. */
  calore?: string | null;
  /** Tutti i box disegnabili della pagina: si vedono solo sulla pagina bianca. */
  box: readonly BoxInsight[];
  evidenza?: readonly BoxEvidenziato[];
}

/**
 * Una pagina del volantino nel PDF: l'immagine (o la pagina bianca con i riquadri), la mappa di
 * calore e i box in evidenza con il loro numero, nell'ordine dal basso verso l'alto.
 */
export function FoglioVolantino({ tema, larghezza, altezza, immagine, calore, box, evidenza = [] }: ProprietaFoglio) {
  const { s, palette } = tema;
  const riempi = [s.paginaRiempi, { width: larghezza, height: altezza }];
  const evidenziati = new Set(evidenza.map((voce) => voce.box.id));

  return (
    <View style={[s.paginaFoglio, { width: larghezza, height: altezza }]}>
      {immagine ? <Image src={immagine} style={riempi} /> : null}
      {!immagine &&
        box.map((voce) => {
          const riquadro = riquadroBox(voce.geometria);
          if (!riquadro || evidenziati.has(voce.id)) return null;
          return (
            <View
              key={voce.id}
              style={{
                position: "absolute",
                left: riquadro.x * larghezza,
                top: riquadro.y * altezza,
                width: riquadro.w * larghezza,
                height: riquadro.h * altezza,
                backgroundColor: palette.superficie,
                borderWidth: 0.5,
                borderColor: palette.linee,
              }}
            />
          );
        })}
      {calore ? <Image src={calore} style={riempi} /> : null}
      {evidenza.map((voce) => {
        const riquadro = riquadroBox(voce.box.geometria);
        if (!riquadro) return null;
        const colore = coloreEvidenza(tema, voce.migliore);
        const x = riquadro.x * larghezza;
        const y = riquadro.y * altezza;
        const w = riquadro.w * larghezza;
        const h = riquadro.h * altezza;
        // Il numero sta nell'angolo in alto a sinistra del box, sempre dentro la pagina
        const sinistra = Math.min(Math.max(0, x + 2.5), larghezza - NUMERO);
        const sopra = Math.min(Math.max(0, y + 2.5), altezza - NUMERO);
        return (
          <View key={voce.box.id} style={{ position: "absolute", left: 0, top: 0, width: larghezza, height: altezza }}>
            {/* Alone bianco sotto il contorno: si legge anche sulle foto scure */}
            <View
              style={{
                position: "absolute",
                left: x - 0.8,
                top: y - 0.8,
                width: w + 1.6,
                height: h + 1.6,
                borderWidth: 2.6,
                borderColor: palette.carta,
                opacity: 0.85,
              }}
            />
            <View style={{ position: "absolute", left: x, top: y, width: w, height: h, borderWidth: 1.2, borderColor: colore }} />
            <View style={{ position: "absolute", left: sinistra, top: sopra }}>
              <NumeroBox tema={tema} numero={voce.numero} colore={colore} />
            </View>
          </View>
        );
      })}
      {/* Bordo sopra a tutto: la pagina bianca resta riconoscibile sul foglio bianco */}
      <View style={[s.paginaRiempi, { width: larghezza, height: altezza, borderWidth: 0.5, borderColor: palette.linee }]} />
    </View>
  );
}
