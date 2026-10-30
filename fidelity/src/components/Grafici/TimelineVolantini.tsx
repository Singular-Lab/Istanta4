import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { CLASSI_ASSI, CLASSI_TESTO, TINTA_NEUTRA, type Tinta } from "./colori";
import { Legenda, type VoceLegenda } from "./Legenda";
import {
  dataBreve,
  inizioAnno,
  annoDi,
  larghezzaTesto,
  msData,
  percorsoColonna,
  percorsoCroce,
  percorsoRombo,
  percorsoTriangolo,
  scalaLineare,
  taccheTempo,
  taccheTonde,
} from "./scale";
import { TabellaDati } from "./TabellaDati";
import { useTooltip, type RigaTooltip } from "./Tooltip";
import { useLarghezza } from "./useLarghezza";

/** Una colonna della timeline: un volantino, alto quanto il suo valore (per esempio le referenze). */
export interface ColonnaTimeline {
  id: string;
  /** Inizio validità (ISO YYYY-MM-DD): la posizione sull'asse del tempo. */
  data: string;
  valore: number;
  /** Gruppo della colonna (per esempio l'id del canale): ne decide il colore. */
  gruppo: string;
  /** Nome del volantino, nel tooltip e nel nome accessibile. */
  titolo: string;
  sottotitolo?: string;
  dettagli?: RigaTooltip[];
}

/** Un tratto della fascia sotto le colonne (per esempio l'insegna con cui compare), con l'etichetta dentro. */
export interface FasciaTimeline {
  id: string;
  dal: string;
  al: string;
  gruppo: string;
  etichetta: string;
  dettagli?: RigaTooltip[];
}

export type FormaEvento = "cerchio" | "rombo" | "quadrato" | "triangolo" | "croce";

/** Un evento sulla riga sotto la fascia: la forma dice il tipo, l'etichetta breve sta accanto se c'è spazio. */
export interface EventoTimeline {
  id: string;
  data: string;
  forma: FormaEvento;
  etichetta: string;
  dettaglio?: string;
}

export interface GruppoTimeline {
  id: string;
  etichetta: string;
  tinta: Tinta;
}

export interface TimelineVolantiniProps {
  colonne: ColonnaTimeline[];
  /** I gruppi con il loro colore (in ordine fisso, vedi indiciPerNome e tintaCategoria). */
  gruppi: GruppoTimeline[];
  fasce?: FasciaTimeline[];
  eventi?: EventoTimeline[];
  /** Nome di ogni forma di evento, per la legenda: compaiono solo le forme presenti. */
  nomiEventi?: Partial<Record<FormaEvento, string>>;
  /** Periodo mostrato (zoom su un anno); predefinito dagli anni dei dati. */
  intervallo?: { dal: string; al: string };
  selezionata?: string | null;
  /** Clic su una colonna, frecce, Home e Fine. */
  onSeleziona?: (id: string) => void;
  /** Nome del grafico e della lista delle colonne per le tecnologie assistive. */
  titolo: string;
  /** Che cosa misura l'altezza delle colonne, sopra il grafico e nel tooltip ("Referenze"). */
  descrizioneValore: string;
  /** Nome del gruppo nella tabella dei dati ("Insegna"). */
  descrizioneGruppo?: string;
  className?: string;
}

const LARGHEZZA_MINIMA = 720;
const MARGINE_SINISTRO = 44;
const MARGINE_DESTRO = 16;
const CIMA = 26;
const BASE = 150;
const ALTEZZA_MASSIMA = BASE - CIMA - 20;
const Y_FASCIA = BASE + 14;
const ALTEZZA_FASCIA = 18;
const Y_EVENTI = Y_FASCIA + ALTEZZA_FASCIA + 22;
const GIORNO = 86_400_000;
/** Ordine delle forme degli eventi in legenda, fisso. */
const ORDINE_FORME: readonly FormaEvento[] = ["cerchio", "rombo", "quadrato", "triangolo", "croce"];

const mediana = (numeri: number[]): number => {
  if (numeri.length === 0) return 0;
  const ordinati = [...numeri].sort((a, b) => a - b);
  return ordinati[Math.floor(ordinati.length / 2)];
};

/**
 * Posizioni delle colonne (in ordine) distanziate di almeno `distanza`: i volantini con la stessa
 * data, come le varianti per area della stessa promo, si affiancano attorno alla loro data invece
 * di disegnarsi uno sull'altro. Restano fra `minimo` e `massimo` quando c'è spazio.
 */
export const distanziaColonne = (xs: readonly number[], distanza: number, minimo = -Infinity, massimo = Infinity): number[] => {
  const posizioni: number[] = [];
  let inizioGruppo = 0;
  for (let i = 0; i <= xs.length; i++) {
    // Un gruppo finisce dove la colonna successiva è abbastanza lontana dall'ultima del gruppo
    if (i < xs.length && i > inizioGruppo && xs[i] - xs[i - 1] < distanza) continue;
    const gruppo = xs.slice(inizioGruppo, i);
    if (gruppo.length > 0) {
      const centro = (gruppo[0] + gruppo[gruppo.length - 1]) / 2;
      gruppo.forEach((_, k) => posizioni.push(centro + (k - (gruppo.length - 1) / 2) * distanza));
    }
    inizioGruppo = i;
  }
  // Allargando un gruppo può toccare il vicino: si spinge avanti, poi si rientra nei margini
  for (let i = 1; i < posizioni.length; i++) posizioni[i] = Math.max(posizioni[i], posizioni[i - 1] + distanza);
  const sporge = posizioni.length > 0 ? posizioni[posizioni.length - 1] - massimo : 0;
  if (sporge > 0) {
    for (let i = posizioni.length - 1; i >= 0; i--) {
      const limite = i === posizioni.length - 1 ? massimo : posizioni[i + 1] - distanza;
      posizioni[i] = Math.min(posizioni[i], limite);
    }
  }
  return posizioni.map(x => Math.max(minimo, x));
};

function MarcatoreEvento({ forma, x, y }: { forma: FormaEvento; x: number; y: number }) {
  const classi = twMerge(CLASSI_ASSI.superficie, "stroke-slate-700 dark:stroke-slate-200");
  switch (forma) {
    case "cerchio":
      return <circle cx={x} cy={y} r={5.5} strokeWidth={2} className={classi} />;
    case "rombo":
      return <path d={percorsoRombo(x, y, 6.5)} strokeWidth={2} className={classi} />;
    case "quadrato":
      return <rect x={x - 5} y={y - 5} width={10} height={10} rx={1.5} strokeWidth={2} className={classi} />;
    case "triangolo":
      return <path d={percorsoTriangolo(x, y, 6)} strokeWidth={2} className={classi} />;
    case "croce":
      return <path d={percorsoCroce(x, y, 4.5)} strokeWidth={2} strokeLinecap="round" className="stroke-slate-700 dark:stroke-slate-200" />;
  }
}

/**
 * Timeline dei volantini: una colonna sottile per volantino, alta quanto il suo valore e colorata
 * per gruppo (l'insegna); sotto la fascia dei gruppi con le etichette, poi gli eventi e gli anni.
 * Le colonne sono una lista di opzioni: clic, frecce, Home e Fine scelgono il volantino.
 */
export function TimelineVolantini({
  colonne,
  gruppi,
  fasce = [],
  eventi = [],
  nomiEventi = {},
  intervallo,
  selezionata = null,
  onSeleziona,
  titolo,
  descrizioneValore,
  descrizioneGruppo = "Gruppo",
  className,
}: TimelineVolantiniProps) {
  const [contenitore, misurata] = useLarghezza(LARGHEZZA_MINIMA);
  const { conTooltip, tooltip } = useTooltip();
  const opzioni = useRef(new Map<string, SVGRectElement>());
  const daFocalizzare = useRef<string | null>(null);

  // Scegliendo con la tastiera il fuoco segue la colonna scelta
  useEffect(() => {
    if (selezionata && daFocalizzare.current === selezionata) {
      opzioni.current.get(selezionata)?.focus();
      daFocalizzare.current = null;
    }
  }, [selezionata]);

  const larghezza = Math.max(LARGHEZZA_MINIMA, misurata);
  const tintaDi = new Map(gruppi.map(g => [g.id, g.tinta]));
  const nomeGruppo = new Map(gruppi.map(g => [g.id, g.etichetta]));

  // Dominio del tempo: il periodo scelto, oppure dal primo all'ultimo anno dei dati, interi
  const date = [...colonne.map(c => msData(c.data)), ...fasce.flatMap(f => [msData(f.dal), msData(f.al)]), ...eventi.map(e => msData(e.data))];
  const [t0, t1] = intervallo
    ? [msData(intervallo.dal), msData(intervallo.al) + GIORNO]
    : date.length > 0
      ? [inizioAnno(annoDi(Math.min(...date))), inizioAnno(annoDi(Math.max(...date)) + 1)]
      : [inizioAnno(new Date().getUTCFullYear()), inizioAnno(new Date().getUTCFullYear() + 1)];
  const dentro = (ms: number) => ms >= t0 && ms < t1;
  const sx = scalaLineare([t0, t1], [MARGINE_SINISTRO, larghezza - MARGINE_DESTRO]);

  const visibili = colonne.filter(c => dentro(msData(c.data))).sort((a, b) => msData(a.data) - msData(b.data));
  const fasceVisibili = fasce.filter(f => msData(f.al) + GIORNO > t0 && msData(f.dal) < t1);
  const eventiVisibili = eventi.filter(e => dentro(msData(e.data))).sort((a, b) => msData(a.data) - msData(b.data));

  const conEventi = eventiVisibili.length > 0;
  const yAsse = (conEventi ? Y_EVENTI : Y_FASCIA + ALTEZZA_FASCIA) + 26;
  const altezza = yAsse + 6;

  const massimo = Math.max(0, ...visibili.map(c => c.valore));
  const tacchY = taccheTonde(0, massimo || 1, 3);
  const h = scalaLineare([0, tacchY[tacchY.length - 1]], [0, ALTEZZA_MASSIMA]);
  const posizioniData = visibili.map(c => sx(msData(c.data)));
  const passo = mediana(posizioniData.slice(1).map((x, i) => x - posizioniData[i]).filter(d => d > 0.5)) || 12;
  const larghezzaColonna = Math.max(2, Math.min(24, passo * 0.6));
  const xs = distanziaColonne(posizioniData, larghezzaColonna + 2, MARGINE_SINISTRO + larghezzaColonna / 2, larghezza - MARGINE_DESTRO - larghezzaColonna / 2);
  // Area attiva di ogni colonna: larga un passo, ma fino a metà strada dalle vicine, così non si coprono
  const areeAttive = xs.map((x, i) => {
    const sinistra = Math.max(x - passo / 2, i > 0 ? (xs[i - 1] + x) / 2 : -Infinity);
    const destra = Math.min(x + passo / 2, i < xs.length - 1 ? (x + xs[i + 1]) / 2 : Infinity);
    return destra - sinistra >= 4 ? { x: sinistra, w: destra - sinistra } : { x: x - 2, w: 4 };
  });
  const indiceSelezionata = visibili.findIndex(c => c.id === selezionata);
  const indiceFocus = indiceSelezionata >= 0 ? indiceSelezionata : visibili.length - 1;

  // Sugli schermi stretti la timeline scorre: il volantino scelto (di solito il più recente, in
  // fondo a destra) deve restare in vista, all'apertura e quando se ne sceglie un altro
  // (solo quando la timeline è più larga del contenitore per la sua larghezza minima, non per un
  // ridimensionamento in corso)
  const xSelezionata = indiceSelezionata >= 0 ? xs[indiceSelezionata] : null;
  const scorre = larghezza > misurata + 1;
  useEffect(() => {
    const elemento = contenitore.current;
    if (!scorre || !elemento || xSelezionata === null) return;
    const margine = 32;
    if (xSelezionata < elemento.scrollLeft + margine || xSelezionata > elemento.scrollLeft + elemento.clientWidth - margine) {
      elemento.scrollLeft = Math.max(0, xSelezionata - elemento.clientWidth / 2);
    }
  }, [xSelezionata, scorre, contenitore]);

  const scegli = (indice: number) => {
    const colonna = visibili[Math.max(0, Math.min(visibili.length - 1, indice))];
    if (!colonna || !onSeleziona) return;
    daFocalizzare.current = colonna.id;
    onSeleziona(colonna.id);
  };

  const tasto = (evento: KeyboardEvent) => {
    const mosse: Record<string, number> = {
      ArrowRight: indiceFocus + 1,
      ArrowDown: indiceFocus + 1,
      ArrowLeft: indiceFocus - 1,
      ArrowUp: indiceFocus - 1,
      Home: 0,
      End: visibili.length - 1,
    };
    if (!(evento.key in mosse)) return;
    evento.preventDefault();
    scegli(mosse[evento.key]);
  };

  // Etichette degli eventi accanto al marcatore, solo se non arrivano al successivo
  const etichetteEventi = eventiVisibili.map((evento, i) => {
    const x = sx(msData(evento.data));
    const prossimo = eventiVisibili[i + 1];
    const limite = prossimo ? sx(msData(prossimo.data)) - 14 : larghezza - MARGINE_DESTRO;
    return x + 12 + larghezzaTesto(evento.etichetta, 11) <= limite;
  });

  const gruppiPresenti = new Set([...visibili.map(c => c.gruppo), ...fasceVisibili.map(f => f.gruppo)]);
  const formePresenti = ORDINE_FORME.filter(forma => eventiVisibili.some(e => e.forma === forma));
  const vociLegenda: VoceLegenda[] = [
    ...gruppi.filter(g => gruppiPresenti.has(g.id)).map(g => ({ id: `g-${g.id}`, etichetta: g.etichetta, forma: "quadrato" as const, tinta: g.tinta })),
    ...formePresenti.map(forma => ({
      id: `e-${forma}`,
      etichetta: nomiEventi[forma] ?? forma,
      forma: forma === "cerchio" ? ("anello" as const) : forma,
    })),
  ];

  const selezionataVisibile = indiceSelezionata >= 0 ? visibili[indiceSelezionata] : null;

  return (
    <figure className={twMerge("m-0 min-w-0", className)}>
      <div ref={contenitore} className="overflow-x-auto">
        <svg role="group" aria-label={titolo} width={larghezza} height={altezza} viewBox={`0 0 ${larghezza} ${altezza}`} className="block">
          <text x={MARGINE_SINISTRO} y={12} className={twMerge("text-2xs font-semibold uppercase tracking-wide", CLASSI_TESTO.tenue)}>
            {descrizioneValore}
          </text>
          {/* Griglia del tempo: anni, o mesi nello zoom su un anno */}
          {taccheTempo(t0, t1).map(tacca => (
            <g key={tacca.ms}>
              <line x1={sx(tacca.ms)} x2={sx(tacca.ms)} y1={CIMA} y2={yAsse - 14} className={CLASSI_ASSI.griglia} />
              <text x={sx(tacca.centro)} y={yAsse} textAnchor="middle" className={twMerge("text-xs font-semibold tabular-nums", CLASSI_TESTO.secondario)}>
                {tacca.etichetta}
              </text>
            </g>
          ))}
          {tacchY.slice(1).map(t => (
            <g key={t}>
              <line x1={MARGINE_SINISTRO} x2={larghezza - MARGINE_DESTRO} y1={BASE - h(t)} y2={BASE - h(t)} className={CLASSI_ASSI.griglia} />
              <text x={MARGINE_SINISTRO - 8} y={BASE - h(t)} dominantBaseline="central" textAnchor="end" className={twMerge("text-3xs tabular-nums", CLASSI_TESTO.tenue)}>
                {formatNumero(t)}
              </text>
            </g>
          ))}
          <text x={MARGINE_SINISTRO - 8} y={BASE} dominantBaseline="central" textAnchor="end" className={twMerge("text-3xs tabular-nums", CLASSI_TESTO.tenue)}>
            0
          </text>

          {/* Colonne */}
          {visibili.map((colonna, i) => {
            const tinta = tintaDi.get(colonna.gruppo) ?? TINTA_NEUTRA;
            const scelta = colonna.id === selezionata;
            return (
              <path
                key={colonna.id}
                d={percorsoColonna(xs[i] - larghezzaColonna / 2, BASE, h(colonna.valore), larghezzaColonna, Math.min(4, larghezzaColonna / 2))}
                fill={tinta.colore}
                className={twMerge(tinta.classe, !scelta && selezionata !== null && "opacity-75")}
              />
            );
          })}
          <line x1={MARGINE_SINISTRO} x2={larghezza - MARGINE_DESTRO} y1={BASE + 0.5} y2={BASE + 0.5} className={CLASSI_ASSI.base} />

          {/* Volantino scelto: marcatore sopra la colonna ed etichetta col valore */}
          {selezionataVisibile && (() => {
            const x = xs[indiceSelezionata];
            const y = BASE - h(selezionataVisibile.valore) - 9;
            const aSinistra = x > larghezza / 2;
            return (
              <g className="pointer-events-none">
                <circle cx={x} cy={y} r={5} strokeWidth={2} className={twMerge("fill-slate-800 dark:fill-slate-100", CLASSI_ASSI.anello)} />
                <text
                  x={aSinistra ? x - 9 : x + 9}
                  y={Math.max(CIMA - 4, y - 7)}
                  textAnchor={aSinistra ? "end" : "start"}
                  className={twMerge("text-2xs font-bold tabular-nums", CLASSI_TESTO.primario)}
                >
                  Selezionato · {formatNumero(selezionataVisibile.valore)}
                </text>
              </g>
            );
          })()}

          {/* Fascia dei gruppi, con 2 px di superficie fra un tratto e l'altro */}
          {fasceVisibili.map(fascia => {
            const inizio = sx(Math.max(t0, msData(fascia.dal)));
            const fine = sx(Math.min(t1, msData(fascia.al) + GIORNO));
            const w = Math.max(2, fine - inizio - 2);
            const tinta = tintaDi.get(fascia.gruppo) ?? TINTA_NEUTRA;
            const periodo = `${dataBreve(msData(fascia.dal))} – ${dataBreve(msData(fascia.al))}`;
            return (
              <g key={fascia.id} {...conTooltip({ titolo: fascia.etichetta, sottotitolo: periodo, righe: fascia.dettagli })}>
                <rect x={inizio + 1} y={Y_FASCIA} width={w} height={ALTEZZA_FASCIA} rx={4} fill={tinta.colore} className={tinta.classe} />
                {w >= larghezzaTesto(fascia.etichetta, 11) + 16 && (
                  <text x={inizio + 9} y={Y_FASCIA + ALTEZZA_FASCIA / 2} dominantBaseline="central" className={twMerge("pointer-events-none text-2xs font-bold", tinta.classeTesto)}>
                    {fascia.etichetta}
                  </text>
                )}
              </g>
            );
          })}

          {/* Eventi */}
          {conEventi && <line x1={MARGINE_SINISTRO} x2={larghezza - MARGINE_DESTRO} y1={Y_EVENTI} y2={Y_EVENTI} className={CLASSI_ASSI.griglia} />}
          {eventiVisibili.map((evento, i) => {
            const x = sx(msData(evento.data));
            return (
              <g key={evento.id} {...conTooltip({ titolo: evento.etichetta, sottotitolo: dataBreve(msData(evento.data)), testo: evento.dettaglio })}>
                <rect x={x - 12} y={Y_EVENTI - 12} width={24} height={24} fill="transparent" />
                <MarcatoreEvento forma={evento.forma} x={x} y={Y_EVENTI} />
                {etichetteEventi[i] && (
                  <text x={x + 12} y={Y_EVENTI} dominantBaseline="central" className={twMerge("text-2xs font-semibold", CLASSI_TESTO.primario)}>
                    {evento.etichetta}
                  </text>
                )}
              </g>
            );
          })}

          {/* Aree attive delle colonne: opzioni della lista, più larghe della colonna */}
          <g role="listbox" aria-label={titolo} aria-orientation="horizontal" onKeyDown={tasto}>
            {visibili.map((colonna, i) => {
              const nome = [colonna.titolo, colonna.sottotitolo, `${formatNumero(colonna.valore)} ${descrizioneValore.toLowerCase()}`].filter(Boolean).join(", ");
              return (
                <rect
                  key={colonna.id}
                  ref={elemento => {
                    if (elemento) opzioni.current.set(colonna.id, elemento);
                    else opzioni.current.delete(colonna.id);
                  }}
                  role="option"
                  aria-selected={colonna.id === selezionata}
                  aria-label={nome}
                  tabIndex={i === indiceFocus ? 0 : -1}
                  x={areeAttive[i].x}
                  y={CIMA}
                  width={areeAttive[i].w}
                  height={BASE - CIMA}
                  fill="transparent"
                  className={twMerge("outline-none", onSeleziona && "cursor-pointer")}
                  onClick={() => onSeleziona?.(colonna.id)}
                  {...conTooltip({
                    titolo: colonna.titolo,
                    sottotitolo: colonna.sottotitolo,
                    righe: [
                      { etichetta: descrizioneValore, valore: formatNumero(colonna.valore) },
                      ...(nomeGruppo.has(colonna.gruppo) ? [{ etichetta: descrizioneGruppo, valore: nomeGruppo.get(colonna.gruppo)! }] : []),
                      ...(colonna.dettagli ?? []),
                    ],
                  })}
                />
              );
            })}
          </g>
        </svg>
      </div>
      <Legenda voci={vociLegenda} className="mt-3" />
      <TabellaDati
        titolo={titolo}
        colonne={["Volantino", "Dal", descrizioneGruppo, descrizioneValore]}
        righe={visibili.map(c => [c.titolo, dataBreve(msData(c.data)), nomeGruppo.get(c.gruppo) ?? "", formatNumero(c.valore)])}
      />
      {tooltip}
    </figure>
  );
}

export default TimelineVolantini;
