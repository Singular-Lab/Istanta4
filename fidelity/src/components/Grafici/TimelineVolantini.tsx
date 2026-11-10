import { twMerge } from "@/utils/twMerge";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { CLASSI_ASSI, CLASSI_TESTO, TINTA_NEUTRA, type Tinta } from "./colori";
import { Legenda, type VoceLegenda } from "./Legenda";
import {
  assegnaCorsie,
  dataBreve,
  inizioMese,
  intervalloGiorni,
  isoData,
  larghezzaTesto,
  lunediTra,
  mesiCalendario,
  msData,
  msOggi,
  MS_GIORNO,
  percorsoCroce,
  percorsoRombo,
  percorsoTriangolo,
  scalaLineare,
  testoCheSta,
} from "./scale";
import { TabellaDati } from "./TabellaDati";
import { useTooltip, type RigaTooltip } from "./Tooltip";
import { useLarghezza } from "./useLarghezza";

/** Una barra della timeline: un volantino, dal primo all'ultimo giorno di validità. */
export interface BarraTimeline {
  id: string;
  /** Primo giorno di validità (ISO YYYY-MM-DD). */
  dal: string;
  /** Ultimo giorno di validità, compreso (ISO); senza, la barra è il solo primo giorno. */
  al: string | null;
  /** Gruppo della barra (per esempio l'id del canale): ne decide il colore. */
  gruppo: string;
  /** Nome del volantino: dentro la barra se ci sta, nel tooltip e nel nome accessibile. */
  titolo: string;
  sottotitolo?: string;
  dettagli?: RigaTooltip[];
}

/** Un tratto della fascia sotto le barre (per esempio l'insegna con cui compare), con l'etichetta dentro. */
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
  barre: BarraTimeline[];
  /** I gruppi con il loro colore (in ordine fisso, vedi indiciPerNome e tintaCategoria). */
  gruppi: GruppoTimeline[];
  fasce?: FasciaTimeline[];
  eventi?: EventoTimeline[];
  /** Nome di ogni forma di evento, per la legenda: compaiono solo le forme presenti. */
  nomiEventi?: Partial<Record<FormaEvento, string>>;
  /**
   * Periodo mostrato, primo e ultimo giorno compresi (un anno, gli ultimi 3 mesi); predefinito a
   * mesi interi dal primo all'ultimo giorno dei dati, oggi compreso.
   */
  intervallo?: { dal: string; al: string };
  /** Il giorno della linea "oggi" (ISO); predefinito la data di oggi. */
  oggi?: string;
  selezionata?: string | null;
  /** Clic su una barra, Invio, frecce, Home e Fine. */
  onSeleziona?: (id: string) => void;
  /** Nome del grafico e della lista delle barre per le tecnologie assistive. */
  titolo: string;
  /** Nome del gruppo nel tooltip e nella tabella dei dati ("Insegna"). */
  descrizioneGruppo?: string;
  className?: string;
}

const LARGHEZZA_MINIMA = 720;
const MARGINE = 12;
/** Sotto questa scala la timeline si allarga e scorre: una promo di due settimane resta larga 35 px. */
const PIXEL_GIORNO_MINIMI = 2.5;
/** Da questa scala in su le settimane hanno spazio per il numero del lunedì. */
const PIXEL_GIORNO_SETTIMANE = 3.5;
const Y_MESI = 13;
const Y_GIORNI = 29;
const ALTEZZA_BARRA = 22;
const PASSO_CORSIA = ALTEZZA_BARRA + 4;
const ALTEZZA_FASCIA = 18;
/** Area attiva minima di una barra corta (un giorno solo), per il clic. */
const AREA_ATTIVA_MINIMA = 12;
/** Ordine delle forme degli eventi in legenda, fisso. */
const ORDINE_FORME: readonly FormaEvento[] = ["cerchio", "rombo", "quadrato", "triangolo", "croce"];

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
 * Timeline dei volantini su un asse a calendario: i mesi a fasce alterne con il nome ("ott 2026"),
 * i lunedì col numero del giorno quando c'è spazio e la linea di oggi. Ogni volantino è una barra
 * dal primo all'ultimo giorno di validità, del colore del suo gruppo (l'insegna), col nome dentro
 * se ci sta; quelli che si sovrappongono (le varianti per area della stessa promo) vanno su corsie
 * diverse. Sotto, la fascia dei gruppi e gli eventi. Le barre sono una lista di opzioni: clic,
 * Invio, frecce, Home e Fine scelgono il volantino.
 */
export function TimelineVolantini({
  barre,
  gruppi,
  fasce = [],
  eventi = [],
  nomiEventi = {},
  intervallo,
  oggi,
  selezionata = null,
  onSeleziona,
  titolo,
  descrizioneGruppo = "Gruppo",
  className,
}: TimelineVolantiniProps) {
  const [contenitore, misurata] = useLarghezza(LARGHEZZA_MINIMA);
  const { conTooltip, tooltip } = useTooltip();
  const opzioni = useRef(new Map<string, SVGRectElement>());
  const daFocalizzare = useRef<string | null>(null);

  // Scegliendo con la tastiera il fuoco segue la barra scelta
  useEffect(() => {
    if (selezionata && daFocalizzare.current === selezionata) {
      opzioni.current.get(selezionata)?.focus();
      daFocalizzare.current = null;
    }
  }, [selezionata]);

  const tintaDi = new Map(gruppi.map(g => [g.id, g.tinta]));
  const nomeGruppo = new Map(gruppi.map(g => [g.id, g.etichetta]));
  const msDiOggi = oggi ? msData(oggi) : msOggi();
  const giorni = barre.map(barra => intervalloGiorni(barra.dal, barra.al));

  // Dominio del tempo: il periodo scelto, oppure dal primo all'ultimo mese dei dati, oggi compreso
  const [t0, t1] = (() => {
    if (intervallo) return [msData(intervallo.dal), msData(intervallo.al) + MS_GIORNO];
    const date = [
      msDiOggi,
      ...giorni.flatMap(g => [g.inizio, g.fine - MS_GIORNO]),
      ...fasce.flatMap(f => [msData(f.dal), msData(f.al)]),
      ...eventi.map(e => msData(e.data)),
    ];
    return [inizioMese(Math.min(...date)), inizioMese(Math.max(...date), 1)];
  })();
  const giorniDominio = Math.max(1, (t1 - t0) / MS_GIORNO);
  // Larga quanto il contenitore, o di più (e scorre) perché ogni giorno abbia almeno PIXEL_GIORNO_MINIMI
  const larghezza = Math.max(misurata, Math.ceil(giorniDominio * PIXEL_GIORNO_MINIMI) + 2 * MARGINE);
  const sx = scalaLineare([t0, t1], [MARGINE, larghezza - MARGINE]);
  const pixelGiorno = (larghezza - 2 * MARGINE) / giorniDominio;
  const conSettimane = pixelGiorno >= PIXEL_GIORNO_SETTIMANE;
  const dentro = (ms: number) => ms >= t0 && ms < t1;

  // Le barre che toccano il periodo, in ordine di inizio (a parità, nell'ordine dato)
  const visibili = barre
    .map((barra, i) => ({ barra, ...giorni[i], i }))
    .filter(b => b.inizio < t1 && b.fine > t0)
    .sort((a, b) => a.inizio - b.inizio || a.i - b.i);
  const corsie = assegnaCorsie(visibili);
  const numeroCorsie = Math.max(1, ...corsie.map(c => c + 1));
  const geometrie = visibili.map((b, k) => {
    const x = sx(Math.max(t0, b.inizio));
    const fine = sx(Math.min(t1, b.fine));
    // Un pixel di superficie fra una barra e la successiva sulla stessa corsia
    return { x, w: Math.max(2, fine - x - 1), corsia: corsie[k] };
  });
  // Area attiva: la barra, allargata se è più stretta del minimo ma non oltre metà strada dalle vicine di corsia
  // (le barre sono in ordine di inizio, quindi anche in ordine di x dentro ogni corsia)
  const vicine = geometrie.map(() => ({ prima: -1, dopo: -1 }));
  const ultimaInCorsia = new Map<number, number>();
  geometrie.forEach((g, k) => {
    const prima = ultimaInCorsia.get(g.corsia);
    if (prima !== undefined) {
      vicine[k].prima = prima;
      vicine[prima].dopo = k;
    }
    ultimaInCorsia.set(g.corsia, k);
  });
  const areeAttive = geometrie.map((g, k) => {
    const { prima, dopo } = vicine[k];
    const precedente = prima >= 0 ? geometrie[prima].x + geometrie[prima].w : -Infinity;
    const successiva = dopo >= 0 ? geometrie[dopo].x : Infinity;
    const extra = Math.max(0, (AREA_ATTIVA_MINIMA - g.w) / 2);
    const sinistra = Math.max(g.x - extra, (precedente + g.x) / 2);
    const destra = Math.min(g.x + g.w + extra, (g.x + g.w + successiva) / 2);
    return { x: sinistra, w: Math.max(g.w, destra - sinistra) };
  });

  const fasceVisibili = fasce.filter(f => msData(f.al) + MS_GIORNO > t0 && msData(f.dal) < t1);
  const eventiVisibili = eventi.filter(e => dentro(msData(e.data))).sort((a, b) => msData(a.data) - msData(b.data));
  const settimane = conSettimane ? lunediTra(t0, t1) : [];
  const conOggi = dentro(msDiOggi);

  // Altezze: mesi, poi giorni e oggi (se ci sono), corsie, fascia dei gruppi ed eventi
  const cimaCorsie = conSettimane || conOggi ? 40 : 24;
  const fondoCorsie = cimaCorsie + numeroCorsie * PASSO_CORSIA - (PASSO_CORSIA - ALTEZZA_BARRA);
  const yFascia = fondoCorsie + 10;
  const fondoFascia = fasceVisibili.length > 0 ? yFascia + ALTEZZA_FASCIA : fondoCorsie;
  const conEventi = eventiVisibili.length > 0;
  const yEventi = fondoFascia + 20;
  const altezza = (conEventi ? yEventi + 12 : fondoFascia) + 8;

  const indiceSelezionata = visibili.findIndex(b => b.barra.id === selezionata);
  const indiceFocus = indiceSelezionata >= 0 ? indiceSelezionata : visibili.length - 1;

  // La timeline più larga del contenitore scorre: il volantino scelto (o, senza, oggi) deve restare
  // in vista, all'apertura, cambiando periodo e scegliendone un altro (solo quando scorre per la
  // sua larghezza minima, non per un ridimensionamento in corso)
  const xBersaglio =
    indiceSelezionata >= 0 ? geometrie[indiceSelezionata].x + geometrie[indiceSelezionata].w / 2 : conOggi ? sx(msDiOggi) : null;
  const scorre = larghezza > misurata + 1;
  useEffect(() => {
    const elemento = contenitore.current;
    if (!scorre || !elemento || xBersaglio === null) return;
    const margine = 32;
    if (xBersaglio < elemento.scrollLeft + margine || xBersaglio > elemento.scrollLeft + elemento.clientWidth - margine) {
      elemento.scrollLeft = Math.max(0, xBersaglio - elemento.clientWidth / 2);
    }
  }, [xBersaglio, scorre, contenitore]);

  const scegli = (indice: number) => {
    const scelta = visibili[Math.max(0, Math.min(visibili.length - 1, indice))];
    if (!scelta || !onSeleziona) return;
    daFocalizzare.current = scelta.barra.id;
    onSeleziona(scelta.barra.id);
  };

  const tasto = (evento: KeyboardEvent) => {
    const idCorrente = (evento.target as Element).getAttribute?.("data-id");
    const corrente = visibili.findIndex(b => b.barra.id === idCorrente);
    const da = corrente >= 0 ? corrente : indiceFocus;
    const mosse: Record<string, number> = {
      ArrowRight: da + 1,
      ArrowDown: da + 1,
      ArrowLeft: da - 1,
      ArrowUp: da - 1,
      Home: 0,
      End: visibili.length - 1,
      Enter: da,
      " ": da,
    };
    if (!(evento.key in mosse)) return;
    evento.preventDefault();
    scegli(mosse[evento.key]);
  };

  // Etichette degli eventi accanto al marcatore, solo se non arrivano al successivo
  const etichetteEventi = eventiVisibili.map((evento, i) => {
    const x = sx(msData(evento.data));
    const prossimo = eventiVisibili[i + 1];
    const limite = prossimo ? sx(msData(prossimo.data)) - 14 : larghezza - MARGINE;
    return x + 12 + larghezzaTesto(evento.etichetta, 11) <= limite;
  });

  const gruppiPresenti = new Set([...visibili.map(b => b.barra.gruppo), ...fasceVisibili.map(f => f.gruppo)]);
  const formePresenti = ORDINE_FORME.filter(forma => eventiVisibili.some(e => e.forma === forma));
  const vociLegenda: VoceLegenda[] = [
    ...gruppi.filter(g => gruppiPresenti.has(g.id)).map(g => ({ id: `g-${g.id}`, etichetta: g.etichetta, forma: "quadrato" as const, tinta: g.tinta })),
    ...formePresenti.map(forma => ({
      id: `e-${forma}`,
      etichetta: nomiEventi[forma] ?? forma,
      forma: forma === "cerchio" ? ("anello" as const) : forma,
    })),
  ];

  const periodoBarra = (barra: BarraTimeline) =>
    barra.al && barra.al !== barra.dal ? `${dataBreve(msData(barra.dal))} – ${dataBreve(msData(barra.al))}` : dataBreve(msData(barra.dal));
  const righeTooltip = (barra: BarraTimeline): RigaTooltip[] => [
    ...(nomeGruppo.has(barra.gruppo) ? [{ etichetta: descrizioneGruppo, valore: nomeGruppo.get(barra.gruppo)! }] : []),
    ...(barra.dettagli ?? []),
  ];

  return (
    <figure className={twMerge("m-0 min-w-0", className)}>
      <div ref={contenitore} className="overflow-x-auto">
        <svg role="group" aria-label={titolo} width={larghezza} height={altezza} viewBox={`0 0 ${larghezza} ${altezza}`} className="block">
          {/* Mesi: fasce alterne, la riga all'inizio (più marcata a gennaio) e il nome se ci sta */}
          {mesiCalendario(t0, t1).map(mese => {
            const inizio = sx(Math.max(t0, mese.ms));
            const fine = sx(Math.min(t1, mese.fine));
            const etichetta = [mese.etichetta, mese.breve].find(testo => larghezzaTesto(testo, 11) + 10 <= fine - inizio);
            return (
              <g key={mese.ms} data-mese={mese.etichetta}>
                {(mese.anno * 12 + mese.mese) % 2 === 1 && (
                  <rect x={inizio} y={0} width={Math.max(0, fine - inizio)} height={altezza} className="fill-slate-100/70 dark:fill-darkmode-400/30" />
                )}
                {mese.ms >= t0 && (
                  <line x1={inizio} x2={inizio} y1={0} y2={altezza} className={mese.mese === 0 ? CLASSI_ASSI.base : CLASSI_ASSI.griglia} />
                )}
                {etichetta && (
                  <text x={inizio + 5} y={Y_MESI} className={twMerge("text-2xs font-semibold tabular-nums", CLASSI_TESTO.secondario)}>
                    {etichetta}
                  </text>
                )}
              </g>
            );
          })}

          {/* Settimane: una tacca e il giorno di ogni lunedì, con una riga tenue fra le corsie */}
          {settimane.map(ms => {
            const x = sx(ms);
            return (
              <g key={ms}>
                <line x1={x} x2={x} y1={Y_GIORNI - 9} y2={fondoCorsie} strokeDasharray="2 3" className="stroke-slate-200 dark:stroke-darkmode-400" />
                <text x={x + 3} y={Y_GIORNI} className={twMerge("text-3xs tabular-nums", CLASSI_TESTO.tenue)}>
                  {new Date(ms).getUTCDate()}
                </text>
              </g>
            );
          })}

          {/* Barre dei volantini, una corsia per quelli che si sovrappongono */}
          {visibili.map(({ barra }, k) => {
            const { x, w, corsia } = geometrie[k];
            const y = cimaCorsie + corsia * PASSO_CORSIA;
            const tinta = tintaDi.get(barra.gruppo) ?? TINTA_NEUTRA;
            const etichetta = testoCheSta(barra.titolo, w - 10);
            return (
              <g key={barra.id} className="pointer-events-none">
                <rect data-barra={barra.id} x={x} y={y} width={w} height={ALTEZZA_BARRA} rx={Math.min(4, w / 2)} fill={tinta.colore} className={tinta.classe} />
                {etichetta && (
                  <text x={x + 5} y={y + ALTEZZA_BARRA / 2} dominantBaseline="central" className={twMerge("text-2xs font-semibold", tinta.classeTesto)}>
                    {etichetta}
                  </text>
                )}
              </g>
            );
          })}

          {/* Volantino scelto: un contorno attorno alla barra */}
          {indiceSelezionata >= 0 && (() => {
            const { x, w, corsia } = geometrie[indiceSelezionata];
            const y = cimaCorsie + corsia * PASSO_CORSIA;
            return (
              <rect
                data-selezionata=""
                x={x - 2}
                y={y - 2}
                width={w + 4}
                height={ALTEZZA_BARRA + 4}
                rx={Math.min(6, (w + 4) / 2)}
                fill="none"
                strokeWidth={2}
                className="pointer-events-none stroke-slate-800 dark:stroke-slate-100"
              />
            );
          })()}

          {/* Fascia dei gruppi, con 2 px di superficie fra un tratto e l'altro */}
          {fasceVisibili.map(fascia => {
            const inizio = sx(Math.max(t0, msData(fascia.dal)));
            const fine = sx(Math.min(t1, msData(fascia.al) + MS_GIORNO));
            const w = Math.max(2, fine - inizio - 2);
            const tinta = tintaDi.get(fascia.gruppo) ?? TINTA_NEUTRA;
            const periodo = `${dataBreve(msData(fascia.dal))} – ${dataBreve(msData(fascia.al))}`;
            const etichetta = testoCheSta(fascia.etichetta, w - 16);
            return (
              <g key={fascia.id} {...conTooltip({ titolo: fascia.etichetta, sottotitolo: periodo, righe: fascia.dettagli })}>
                <rect x={inizio + 1} y={yFascia} width={w} height={ALTEZZA_FASCIA} rx={4} fill={tinta.colore} className={tinta.classe} />
                {etichetta && (
                  <text x={inizio + 9} y={yFascia + ALTEZZA_FASCIA / 2} dominantBaseline="central" className={twMerge("pointer-events-none text-2xs font-bold", tinta.classeTesto)}>
                    {etichetta}
                  </text>
                )}
              </g>
            );
          })}

          {/* Eventi */}
          {conEventi && <line x1={MARGINE} x2={larghezza - MARGINE} y1={yEventi} y2={yEventi} className={CLASSI_ASSI.griglia} />}
          {eventiVisibili.map((evento, i) => {
            const x = sx(msData(evento.data));
            return (
              <g key={evento.id} {...conTooltip({ titolo: evento.etichetta, sottotitolo: dataBreve(msData(evento.data)), testo: evento.dettaglio })}>
                <rect x={x - 12} y={yEventi - 12} width={24} height={24} fill="transparent" />
                <MarcatoreEvento forma={evento.forma} x={x} y={yEventi} />
                {etichetteEventi[i] && (
                  <text x={x + 12} y={yEventi} dominantBaseline="central" className={twMerge("text-2xs font-semibold", CLASSI_TESTO.primario)}>
                    {evento.etichetta}
                  </text>
                )}
              </g>
            );
          })}

          {/* Oggi: una linea su tutto il calendario, col nome nella riga dei giorni */}
          {conOggi && (() => {
            const x = sx(msDiOggi + MS_GIORNO / 2);
            return (
              <g data-oggi={isoData(msDiOggi)} className="pointer-events-none">
                <line x1={x} x2={x} y1={Y_GIORNI + 6} y2={altezza} strokeWidth={1.5} className="stroke-danger" />
                <rect x={x - 15} y={Y_GIORNI - 9} width={30} height={15} rx={7.5} className="fill-danger" />
                <text x={x} y={Y_GIORNI - 1.5} textAnchor="middle" dominantBaseline="central" className="fill-white text-3xs font-bold">
                  oggi
                </text>
              </g>
            );
          })()}

          {/* Aree attive delle barre: opzioni della lista */}
          <g role="listbox" aria-label={titolo} aria-orientation="horizontal" onKeyDown={tasto}>
            {visibili.map(({ barra }, k) => {
              const nome = [
                barra.titolo,
                barra.sottotitolo ?? periodoBarra(barra),
                nomeGruppo.get(barra.gruppo),
                ...(barra.dettagli ?? []).map(d => `${d.etichetta} ${d.valore}`),
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <rect
                  key={barra.id}
                  ref={elemento => {
                    if (elemento) opzioni.current.set(barra.id, elemento);
                    else opzioni.current.delete(barra.id);
                  }}
                  data-id={barra.id}
                  role="option"
                  aria-selected={barra.id === selezionata}
                  aria-label={nome}
                  tabIndex={k === indiceFocus ? 0 : -1}
                  x={areeAttive[k].x}
                  y={cimaCorsie + geometrie[k].corsia * PASSO_CORSIA}
                  width={areeAttive[k].w}
                  height={ALTEZZA_BARRA}
                  fill="transparent"
                  className={twMerge("outline-none", onSeleziona && "cursor-pointer")}
                  onClick={() => onSeleziona?.(barra.id)}
                  {...conTooltip({ titolo: barra.titolo, sottotitolo: barra.sottotitolo ?? periodoBarra(barra), righe: righeTooltip(barra) })}
                />
              );
            })}
          </g>
        </svg>
      </div>
      <Legenda voci={vociLegenda} className="mt-3" />
      <TabellaDati
        titolo={titolo}
        colonne={["Volantino", "Dal", "Al", descrizioneGruppo]}
        righe={visibili.map(({ barra }) => [barra.titolo, dataBreve(msData(barra.dal)), dataBreve(msData(barra.al ?? barra.dal)), nomeGruppo.get(barra.gruppo) ?? ""])}
      />
      {tooltip}
    </figure>
  );
}

export default TimelineVolantini;
