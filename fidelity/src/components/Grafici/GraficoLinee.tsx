import { twMerge } from "@/utils/twMerge";
import { useState } from "react";
import { CLASSI_ASSI, CLASSI_TESTO, SERIE_PRINCIPALE, SERIE_SECONDARIA, type Tinta } from "./colori";
import { Legenda, type VoceLegenda } from "./Legenda";
import { larghezzaTesto, percorsoRombo, scalaLineare, taccheTonde } from "./scale";
import { TabellaDati } from "./TabellaDati";
import { useTooltip, type RigaTooltip } from "./Tooltip";
import { useLarghezza } from "./useLarghezza";

export interface PuntoLinea {
  x: number;
  /** Null lascia un vuoto nella linea. */
  y: number | null;
  /** Punto segnalato (per esempio un prezzo sottocosto): marcatore a rombo e voce in legenda. */
  segnalato?: boolean;
  /** Righe in più nel tooltip di questa x. */
  dettagli?: RigaTooltip[];
}

export interface SerieLinea {
  id: string;
  nome: string;
  /** "principale": il colore del tema; "secondaria": grigio di confronto; una Tinta categorica per più serie. */
  tono?: "principale" | "secondaria" | Tinta;
  punti: PuntoLinea[];
}

export interface GraficoLineeProps {
  serie: SerieLinea[];
  /** Nome del grafico per le tecnologie assistive e didascalia della tabella dei dati. */
  titolo: string;
  /** Testo di un valore y (asse, etichette, tooltip). */
  formattaY: (valore: number) => string;
  /** Testo di una x nel tooltip e nella tabella (un anno, una data). */
  formattaX: (x: number) => string;
  /** Intestazione della colonna delle x nella tabella dei dati ("Anno", "Volantino"). */
  descrizioneX?: string;
  /** Tacche dell'asse x; predefinite le x dei punti, diradate. */
  taccheX?: Array<{ x: number; etichetta: string }>;
  /** Dominio delle x; predefinito dalla prima all'ultima. */
  dominioX?: readonly [number, number];
  /** L'asse y parte da zero. */
  daZero?: boolean;
  /** Nome dei punti segnalati, in legenda e nel tooltip ("Sottocosto"). */
  etichettaSegnalati?: string;
  /** Velo sotto la linea; solo con una serie. */
  area?: boolean;
  /** Altezza dell'area del grafico, in pixel. */
  altezza?: number;
  vuoto?: string;
  className?: string;
}

const MARGINE_ALTO = 12;
const MARGINE_BASSO = 24;
const OLTRE_I_PUNTI = 40;

interface StileSerie {
  tratto?: string;
  classeTratto?: string;
  classeFill?: string;
  chiave: { colore?: string; classe?: string };
  tinta: Tinta;
}

const stileSerie = (tono: SerieLinea["tono"]): StileSerie => {
  if (tono === "secondaria") {
    return {
      classeTratto: SERIE_SECONDARIA.stroke,
      classeFill: SERIE_SECONDARIA.fill,
      chiave: { classe: SERIE_SECONDARIA.sfondo },
      tinta: { classe: SERIE_SECONDARIA.fill, classeTesto: "" },
    };
  }
  if (tono && typeof tono === "object") {
    return { tratto: tono.colore, classeFill: tono.classe, chiave: { colore: tono.colore }, tinta: tono };
  }
  return {
    classeTratto: SERIE_PRINCIPALE.stroke,
    classeFill: SERIE_PRINCIPALE.fill,
    chiave: { classe: SERIE_PRINCIPALE.sfondo },
    tinta: { classe: SERIE_PRINCIPALE.fill, classeTesto: "" },
  };
};

/** Percorso della linea, interrotto dove manca il valore. */
const percorsoLinea = (punti: PuntoLinea[], sx: (x: number) => number, sy: (y: number) => number): string => {
  let percorso = "";
  let aperta = false;
  for (const punto of punti) {
    if (punto.y === null || !Number.isFinite(punto.y)) {
      aperta = false;
      continue;
    }
    percorso += `${aperta ? "L" : "M"}${sx(punto.x)} ${sy(punto.y)} `;
    aperta = true;
  }
  return percorso.trim();
};

/**
 * Una o più linee su un asse y solo (mai due scale): linee di 2 px, marcatori con l'anello della
 * superficie, valore in fondo alla linea, legenda da due serie in su. Passando sopra il grafico
 * una linea verticale trova la x più vicina e il tooltip elenca tutte le serie in quel punto.
 */
export function GraficoLinee({
  serie,
  titolo,
  formattaY,
  formattaX,
  descrizioneX = "",
  taccheX,
  dominioX,
  daZero = false,
  etichettaSegnalati,
  area = false,
  altezza = 200,
  vuoto = "Nessun dato da mostrare.",
  className,
}: GraficoLineeProps) {
  const [contenitore, larghezza] = useLarghezza(520);
  const { conTooltip, tooltip } = useTooltip();
  const [attiva, setAttiva] = useState<number | null>(null);

  const valori = serie.flatMap(s => s.punti.map(p => p.y)).filter((y): y is number => y !== null && Number.isFinite(y));
  if (valori.length === 0) {
    return <p className={twMerge("text-sm text-slate-500", className)}>{vuoto}</p>;
  }

  const xs = [...new Set(serie.flatMap(s => s.punti.map(p => p.x)))].sort((a, b) => a - b);
  const tacchY = taccheTonde(daZero ? Math.min(0, ...valori) : Math.min(...valori), Math.max(...valori), 4);
  const stili = new Map(serie.map(s => [s.id, stileSerie(s.tono)]));
  const ultimoPunto = (s: SerieLinea) => [...s.punti].reverse().find(p => p.y !== null && Number.isFinite(p.y));

  const margineSinistro = Math.max(...tacchY.map(t => larghezzaTesto(formattaY(t), 10))) + 10;
  const margineDestro =
    Math.max(0, ...serie.map(s => {
      const ultimo = ultimoPunto(s);
      return ultimo?.y != null ? larghezzaTesto(formattaY(ultimo.y), 11) : 0;
    })) + 14;
  const [x0, x1] = dominioX ?? [xs[0], xs[xs.length - 1]];
  const sx = scalaLineare([x0, x1], [margineSinistro + 6, Math.max(margineSinistro + 40, larghezza - margineDestro)]);
  const base = MARGINE_ALTO + altezza;
  const sy = scalaLineare([tacchY[0], tacchY[tacchY.length - 1]], [base, MARGINE_ALTO]);

  // Tacche dell'asse x: quelle date, oppure le x dei punti diradate perché le etichette non si tocchino
  const tacche = taccheX ?? (() => {
    const tutte = xs.map(x => ({ x, etichetta: formattaX(x) }));
    const spazio = (sx(x1) - sx(x0)) / Math.max(1, tutte.length - 1);
    const ogni = Math.max(1, Math.ceil((Math.max(...tutte.map(t => larghezzaTesto(t.etichetta, 11))) + 8) / Math.max(1, spazio)));
    return tutte.filter((_, i) => i % ogni === 0);
  })();

  const conMarcatori = xs.length <= OLTRE_I_PUNTI;
  const conSegnalati = serie.some(s => s.punti.some(p => p.segnalato));

  // Etichette in fondo alle linee: se due si toccano resta solo la prima serie, il resto lo dicono legenda e tooltip
  const etichetteFinali: Array<{ id: string; x: number; y: number; testo: string }> = [];
  for (const s of serie) {
    const ultimo = ultimoPunto(s);
    if (!ultimo || ultimo.y === null) continue;
    const y = sy(ultimo.y);
    if (etichetteFinali.some(e => Math.abs(e.y - y) < 13)) continue;
    etichetteFinali.push({ id: s.id, x: sx(ultimo.x), y, testo: formattaY(ultimo.y) });
  }

  const contenutoX = (x: number) => {
    const righe: RigaTooltip[] = [];
    let segnalato = false;
    let dettagli: RigaTooltip[] = [];
    for (const s of serie) {
      const punto = s.punti.find(p => p.x === x);
      if (!punto || punto.y === null) continue;
      righe.push({ etichetta: s.nome, valore: formattaY(punto.y), chiave: stili.get(s.id)?.chiave });
      segnalato ||= Boolean(punto.segnalato);
      if (punto.dettagli) dettagli = dettagli.concat(punto.dettagli);
    }
    if (segnalato && etichettaSegnalati) righe.push({ etichetta: etichettaSegnalati, valore: "sì" });
    return { titolo: formattaX(x), righe: righe.concat(dettagli) };
  };

  const vociLegenda: VoceLegenda[] = [
    ...(serie.length > 1
      ? serie.map(s => {
        const stile = stili.get(s.id)!;
        return { id: s.id, etichetta: s.nome, forma: "linea" as const, tinta: stile.tinta, classeTratto: stile.classeTratto };
      })
      : []),
    ...(conSegnalati && etichettaSegnalati
      ? [{ id: "segnalati", etichetta: etichettaSegnalati, forma: "rombo" as const, tinta: { classe: "fill-amber-500", classeTesto: "" }, classeTratto: CLASSI_ASSI.anello }]
      : []),
  ];

  return (
    <figure ref={contenitore} className={twMerge("m-0 min-w-0", className)}>
      <svg
        role="img"
        aria-label={titolo}
        width={larghezza}
        height={base + MARGINE_BASSO}
        viewBox={`0 0 ${larghezza} ${base + MARGINE_BASSO}`}
        className="block h-auto max-w-full overflow-visible"
        onMouseLeave={() => setAttiva(null)}
      >
        {tacchY.map(t => (
          <g key={t}>
            <line x1={margineSinistro} x2={larghezza - margineDestro + 8} y1={sy(t)} y2={sy(t)} className={CLASSI_ASSI.griglia} />
            <text x={margineSinistro - 6} y={sy(t)} dominantBaseline="central" textAnchor="end" className={twMerge("text-3xs tabular-nums", CLASSI_TESTO.tenue)}>
              {formattaY(t)}
            </text>
          </g>
        ))}
        {tacche.map(t => (
          <text key={t.x} x={sx(t.x)} y={base + 17} textAnchor="middle" className={twMerge("text-2xs tabular-nums", CLASSI_TESTO.secondario)}>
            {t.etichetta}
          </text>
        ))}
        {attiva !== null && <line x1={sx(attiva)} x2={sx(attiva)} y1={MARGINE_ALTO} y2={base} className={CLASSI_ASSI.base} />}
        {area && serie.length === 1 && (() => {
          const punti = serie[0].punti.filter(p => p.y !== null);
          if (punti.length < 2) return null;
          const linea = percorsoLinea(punti, sx, sy);
          return <path d={`${linea} L${sx(punti[punti.length - 1].x)} ${base} L${sx(punti[0].x)} ${base} Z`} className={SERIE_PRINCIPALE.velo} />;
        })()}
        {serie.map(s => {
          const stile = stili.get(s.id)!;
          return (
            <path
              key={s.id}
              d={percorsoLinea(s.punti, sx, sy)}
              fill="none"
              stroke={stile.tratto}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className={stile.classeTratto}
            />
          );
        })}
        {serie.map(s => {
          const stile = stili.get(s.id)!;
          const ultimo = ultimoPunto(s);
          return s.punti.map(p => {
            if (p.y === null || !Number.isFinite(p.y)) return null;
            const cx = sx(p.x);
            const cy = sy(p.y);
            if (p.segnalato) {
              return <path key={`${s.id}-${p.x}`} d={percorsoRombo(cx, cy, 6)} strokeWidth={2} className={twMerge("fill-amber-500", CLASSI_ASSI.anello)} />;
            }
            if (!conMarcatori && p !== ultimo && attiva !== p.x) return null;
            return (
              <circle
                key={`${s.id}-${p.x}`}
                cx={cx}
                cy={cy}
                r={attiva === p.x || p === ultimo ? 5 : 4}
                fill={stile.tratto}
                strokeWidth={2}
                className={twMerge(stile.classeFill, CLASSI_ASSI.anello)}
              />
            );
          });
        })}
        {etichetteFinali.map(e => (
          <text key={e.id} x={e.x + 9} y={e.y} dominantBaseline="central" className={twMerge("text-2xs font-bold tabular-nums", CLASSI_TESTO.primario)}>
            {e.testo}
          </text>
        ))}
        {/* Aree attive: una per x, da metà strada alla x precedente a metà strada alla successiva */}
        {xs.map((x, i) => {
          const sinistra = i === 0 ? sx(x) - 12 : (sx(xs[i - 1]) + sx(x)) / 2;
          const destra = i === xs.length - 1 ? sx(x) + 12 : (sx(x) + sx(xs[i + 1])) / 2;
          const gestori = conTooltip(contenutoX(x));
          return (
            <rect
              key={x}
              data-x={x}
              x={sinistra}
              y={MARGINE_ALTO}
              width={Math.max(1, destra - sinistra)}
              height={altezza}
              fill="transparent"
              onMouseMove={evento => {
                gestori.onMouseMove(evento);
                setAttiva(x);
              }}
              onMouseLeave={gestori.onMouseLeave}
            />
          );
        })}
      </svg>
      <Legenda voci={vociLegenda} className="mt-2" />
      <TabellaDati
        titolo={titolo}
        colonne={[descrizioneX, ...serie.map(s => s.nome), ...(conSegnalati && etichettaSegnalati ? [etichettaSegnalati] : [])]}
        righe={xs.map(x => [
          formattaX(x),
          ...serie.map(s => {
            const y = s.punti.find(p => p.x === x)?.y;
            return y === null || y === undefined ? "—" : formattaY(y);
          }),
          ...(conSegnalati && etichettaSegnalati ? [serie.some(s => s.punti.some(p => p.x === x && p.segnalato)) ? "sì" : "no"] : []),
        ])}
      />
      {tooltip}
    </figure>
  );
}

export default GraficoLinee;
