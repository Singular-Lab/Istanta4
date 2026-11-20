import { twMerge } from "@/utils/twMerge";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { CLASSI_ASSI, CLASSI_TESTO, TINTA_NEUTRA, type Tinta } from "./colori";
import { Legenda, type VoceLegenda } from "./Legenda";
import {
  assegnaCorsie,
  dataBreve,
  inizioAnno,
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
  type MeseCalendario,
} from "./scale";
import { TabellaDati } from "./TabellaDati";
import { useTooltip, type ContenutoTooltip, type RigaTooltip } from "./Tooltip";
import {
  cellaTraccia,
  disponiTracce,
  righeTraccia,
  SegniTraccia,
  vociLegendaTraccia,
  type ColonnaTraccia,
  type TracciaTimeline,
} from "./TracceTimeline";
import { useLarghezza } from "./useLarghezza";

export type { TracciaTimeline } from "./TracceTimeline";

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

/** Un volantino in cui il soggetto della timeline manca: un contorno nelle corsie delle barre, non selezionabile. */
export interface AssenzaTimeline {
  id: string;
  dal: string;
  al: string | null;
  titolo: string;
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
  /**
   * Corsie di dati sotto le barre e sotto la fascia dei gruppi, nell'ordine dato, sullo stesso asse
   * del tempo: un segno per volantino, largo quanto la sua barra.
   */
  tracce?: TracciaTimeline[];
  /** Volantini in cui il soggetto manca: un contorno sulle corsie delle barre, fuori dalla lista delle opzioni. */
  assenze?: AssenzaTimeline[];
  /** Che cosa vuol dire un'assenza, in legenda, nel tooltip e nella tabella dei dati. */
  nomeAssenze?: string;
  /**
   * Pixel per giorno sotto cui la timeline si allarga e scorre (predefiniti 2,5: una promo di due
   * settimane resta larga 35 px). Un valore piccolo (0,5) fa stare anni nella larghezza.
   */
  pixelGiornoMinimi?: number;
  className?: string;
}

const LARGHEZZA_MINIMA = 720;
const MARGINE = 12;
/** Sotto questa scala (predefinita) la timeline si allarga e scorre: una promo di due settimane resta larga 35 px. */
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
/** Il contorno di un volantino senza il soggetto: il tono "da guardare" delle fasce. */
/** Il volantino senza il soggetto: rosso, tratteggiato e velato, ben distinto dalle barre piene. */
const CLASSE_ASSENZA = "stroke-rose-600 dark:stroke-rose-400";
const CLASSE_ASSENZA_RIEMPIMENTO = "fill-rose-500/15 dark:fill-rose-400/20";
/** Il volantino scelto nelle tracce: una colonna appena velata, col bordo sottile. */
const CLASSE_COLONNA_SCELTA = "fill-slate-800/5 stroke-slate-800/40 dark:fill-slate-100/10 dark:stroke-slate-100/40";

const maiuscola = (testo: string) => testo.charAt(0).toUpperCase() + testo.slice(1);
const sovrapposti = (a: { inizio: number; fine: number }, b: { inizio: number; fine: number }) => a.inizio < b.fine && b.inizio < a.fine;

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
 * diverse. Sotto, la fascia dei gruppi, le tracce dei dati (un segno per volantino, sotto la sua
 * barra) e gli eventi. Le barre sono una lista di opzioni: clic, Invio, frecce, Home e Fine scelgono
 * il volantino; nelle tracce lo sceglie anche il clic sulla sua colonna. I volantini senza il
 * soggetto (assenze) sono un contorno sulle corsie, fuori dalla lista. Sui periodi lunghi, senza
 * spazio per i nomi dei mesi, l'asse dice gli anni.
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
  tracce = [],
  assenze = [],
  nomeAssenze = "senza il punto vendita",
  pixelGiornoMinimi = PIXEL_GIORNO_MINIMI,
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
  const giorniAssenze = assenze.map(assenza => intervalloGiorni(assenza.dal, assenza.al));

  // Dominio del tempo: il periodo scelto, oppure dal primo all'ultimo mese dei dati, oggi compreso
  const [t0, t1] = (() => {
    if (intervallo) return [msData(intervallo.dal), msData(intervallo.al) + MS_GIORNO];
    const date = [
      msDiOggi,
      ...giorni.flatMap(g => [g.inizio, g.fine - MS_GIORNO]),
      ...fasce.flatMap(f => [msData(f.dal), msData(f.al)]),
      ...eventi.map(e => msData(e.data)),
      ...giorniAssenze.flatMap(g => [g.inizio, g.fine - MS_GIORNO]),
      ...tracce.flatMap(t => (t.tipo === "fasce" ? t.fasce.flatMap(f => [msData(f.dal), msData(f.al)]) : [])),
    ];
    return [inizioMese(Math.min(...date)), inizioMese(Math.max(...date), 1)];
  })();
  const giorniDominio = Math.max(1, (t1 - t0) / MS_GIORNO);
  // Larga quanto il contenitore, o di più (e scorre) perché ogni giorno abbia almeno pixelGiornoMinimi
  const larghezza = Math.max(misurata, Math.ceil(giorniDominio * Math.max(0, pixelGiornoMinimi)) + 2 * MARGINE);
  const sx = scalaLineare([t0, t1], [MARGINE, larghezza - MARGINE]);
  const pixelGiorno = (larghezza - 2 * MARGINE) / giorniDominio;
  const conSettimane = pixelGiorno >= PIXEL_GIORNO_SETTIMANE;
  // Nemmeno un mese di 31 giorni ha spazio per il suo nome: l'asse va per anni
  const conAnni = 31 * pixelGiorno < larghezzaTesto("gen", 11) + 10;
  const dentro = (ms: number) => ms >= t0 && ms < t1;

  // Le barre che toccano il periodo, in ordine di inizio (a parità, nell'ordine dato)
  const visibili = barre
    .map((barra, i) => ({ barra, ...giorni[i], i }))
    .filter(b => b.inizio < t1 && b.fine > t0)
    .sort((a, b) => a.inizio - b.inizio || a.i - b.i);
  const corsie = assegnaCorsie(visibili);
  const corsieBarre = Math.max(1, ...corsie.map(c => c + 1));
  // Un pixel di superficie fra una barra e la successiva sulla stessa corsia
  const geometria = (inizio: number, fine: number) => {
    const x = sx(Math.max(t0, inizio));
    return { x, w: Math.max(2, sx(Math.min(t1, fine)) - x - 1) };
  };
  const geometrie = visibili.map((b, k) => ({ ...geometria(b.inizio, b.fine), corsia: corsie[k] }));

  // Le assenze nella prima corsia dove non toccano né una barra né un'altra assenza: le barre restano
  // nelle loro corsie (e i loro segni pieni nelle tracce)
  const occupate: Array<Array<{ inizio: number; fine: number }>> = [];
  const occupa = (corsia: number, giorni: { inizio: number; fine: number }) => {
    if (!occupate[corsia]) occupate[corsia] = [];
    occupate[corsia].push(giorni);
  };
  visibili.forEach((b, k) => occupa(corsie[k], b));
  const assenzeVisibili = assenze
    .map((assenza, i) => ({ assenza, ...giorniAssenze[i], i }))
    .filter(a => a.inizio < t1 && a.fine > t0)
    .sort((a, b) => a.inizio - b.inizio || a.i - b.i)
    .map(a => {
      let corsia = 0;
      while ((occupate[corsia] ?? []).some(o => sovrapposti(o, a))) corsia++;
      occupa(corsia, a);
      return { ...a, ...geometria(a.inizio, a.fine), corsia };
    });
  const numeroCorsie = Math.max(corsieBarre, ...assenzeVisibili.map(a => a.corsia + 1));
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

  // Altezze: mesi, poi giorni e oggi (se ci sono), corsie, fascia dei gruppi, tracce ed eventi
  const cimaCorsie = conSettimane || conOggi ? 40 : 24;
  const fondoCorsie = cimaCorsie + numeroCorsie * PASSO_CORSIA - (PASSO_CORSIA - ALTEZZA_BARRA);
  const yFascia = fondoCorsie + 10;
  const fondoFascia = fasceVisibili.length > 0 ? yFascia + ALTEZZA_FASCIA : fondoCorsie;
  const { posizioni: posizioniTracce, fondo: fondoTracce } = disponiTracce(tracce, fondoFascia, corsieBarre);
  const cimaTracce = posizioniTracce[0]?.inizio ?? fondoTracce;
  const conEventi = eventiVisibili.length > 0;
  const yEventi = fondoTracce + 20;
  const altezza = (conEventi ? yEventi + 12 : fondoTracce) + 8;
  // Le barre viste dalle tracce, in ordine di inizio
  const colonneTracce: ColonnaTraccia[] = visibili.map((b, k) => ({ id: b.barra.id, inizio: b.inizio, ...geometrie[k] }));

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
    ...(assenzeVisibili.length > 0 ? [{ id: "assenze", etichetta: nomeAssenze, forma: "quadrato" as const, classeTratto: CLASSE_ASSENZA }] : []),
    ...formePresenti.map(forma => ({
      id: `e-${forma}`,
      etichetta: nomiEventi[forma] ?? forma,
      forma: forma === "cerchio" ? ("anello" as const) : forma,
    })),
  ];
  // Le categorie e i toni delle tracce, ognuna con la sua legenda col nome della traccia
  const legendeTracce = tracce
    .map(traccia => ({ id: traccia.id, titolo: traccia.etichetta, voci: vociLegendaTraccia(traccia, colonneTracce, t0, t1) }))
    .filter(legenda => legenda.voci.length > 0);

  const periodoBarra = (barra: BarraTimeline) =>
    barra.al && barra.al !== barra.dal ? `${dataBreve(msData(barra.dal))} – ${dataBreve(msData(barra.al))}` : dataBreve(msData(barra.dal));
  const righeTracce = (k: number): RigaTooltip[] => tracce.flatMap(traccia => righeTraccia(traccia, colonneTracce[k]));
  const righeTooltip = (barra: BarraTimeline, k: number): RigaTooltip[] => [
    ...(nomeGruppo.has(barra.gruppo) ? [{ etichetta: descrizioneGruppo, valore: nomeGruppo.get(barra.gruppo)! }] : []),
    ...(barra.dettagli ?? []),
    ...righeTracce(k),
  ];
  const contenutoBarra = (barra: BarraTimeline, k: number): ContenutoTooltip => ({
    titolo: barra.titolo,
    sottotitolo: barra.sottotitolo ?? periodoBarra(barra),
    righe: righeTooltip(barra, k),
  });
  const periodoAssenza = (assenza: AssenzaTimeline) =>
    assenza.al && assenza.al !== assenza.dal ? `${dataBreve(msData(assenza.dal))} – ${dataBreve(msData(assenza.al))}` : dataBreve(msData(assenza.dal));
  // L'etichetta di un mese dell'asse: il nome lungo o breve, se ci sta (a gennaio, senza spazio per
  // "gen 2025", l'anno); sui periodi lunghi l'anno, a gennaio e all'inizio del periodo, se ci sta
  // fino al gennaio dopo
  const etichettaMese = (mese: MeseCalendario, inizio: number, fine: number): string | undefined => {
    if (!conAnni) {
      const candidate = mese.mese === 0 ? [mese.etichetta, String(mese.anno), mese.breve] : [mese.etichetta, mese.breve];
      return candidate.find(testo => larghezzaTesto(testo, 11) + 10 <= fine - inizio);
    }
    const spazioAnno = sx(Math.min(t1, inizioAnno(mese.anno + 1))) - inizio;
    const conAnno = (mese.mese === 0 || mese.ms <= t0) && larghezzaTesto(String(mese.anno), 11) + 10 <= spazioAnno;
    return conAnno ? String(mese.anno) : undefined;
  };
  // Le aree attive delle tracce dalla più larga: le più strette (un volantino breve sopra uno lungo) restano sopra
  const ordineAreeTracce = visibili.map((_, k) => k).sort((a, b) => areeAttive[b].w - areeAttive[a].w || a - b);

  return (
    <figure className={twMerge("m-0 min-w-0", className)}>
      <div ref={contenitore} className="overflow-x-auto">
        <svg role="group" aria-label={titolo} width={larghezza} height={altezza} viewBox={`0 0 ${larghezza} ${altezza}`} className="block">
          {/* Anni a fasce alterne quando l'asse va per anni: le fasce dei mesi sarebbero righe sottili */}
          {conAnni &&
            mesiCalendario(t0, t1)
              .filter(mese => (mese.mese === 0 || mese.ms <= t0) && mese.anno % 2 === 1)
              .map(mese => {
                const inizio = sx(Math.max(t0, mese.ms));
                const fine = sx(Math.min(t1, inizioAnno(mese.anno + 1)));
                return <rect key={mese.anno} data-anno={mese.anno} x={inizio} y={0} width={Math.max(0, fine - inizio)} height={altezza} className="fill-slate-100/70 dark:fill-darkmode-400/30" />;
              })}

          {/* Mesi: fasce alterne, la riga all'inizio (più marcata a gennaio) e il nome se ci sta; sui periodi
              lunghi solo la riga di gennaio, con l'anno (anche all'inizio del periodo) se ci sta fino al gennaio dopo */}
          {mesiCalendario(t0, t1).map(mese => {
            const inizio = sx(Math.max(t0, mese.ms));
            const fine = sx(Math.min(t1, mese.fine));
            const etichetta = etichettaMese(mese, inizio, fine);
            return (
              <g key={mese.ms} data-mese={mese.etichetta}>
                {!conAnni && (mese.anno * 12 + mese.mese) % 2 === 1 && (
                  <rect x={inizio} y={0} width={Math.max(0, fine - inizio)} height={altezza} className="fill-slate-100/70 dark:fill-darkmode-400/30" />
                )}
                {mese.ms >= t0 && (!conAnni || mese.mese === 0) && (
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

          {/* Volantini senza il soggetto: rossi, tratteggiati e velati, fuori dalla lista delle opzioni */}
          {assenzeVisibili.map(({ assenza, x, w, corsia }) => {
            const y = cimaCorsie + corsia * PASSO_CORSIA;
            return (
              <g key={assenza.id} data-assenza={assenza.id} {...conTooltip({ titolo: assenza.titolo, sottotitolo: periodoAssenza(assenza), testo: maiuscola(nomeAssenze) })}>
                <rect x={x} y={y} width={w} height={ALTEZZA_BARRA} fill="transparent" />
                <rect
                  x={x + 0.75}
                  y={y + 0.75}
                  width={Math.max(0.5, w - 1.5)}
                  height={ALTEZZA_BARRA - 1.5}
                  rx={Math.min(4, w / 2)}
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                  className={twMerge("pointer-events-none", CLASSE_ASSENZA, CLASSE_ASSENZA_RIEMPIMENTO)}
                />
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

          {/* Tracce dei dati: il volantino scelto velato in tutte, poi le aree attive (una colonna per
              volantino, sotto i segni) e i segni; i tratti delle fasce hanno il loro tooltip */}
          {tracce.length > 0 && (
            <g data-tracce="">
              {indiceSelezionata >= 0 && (
                <rect
                  data-colonna-selezionata=""
                  x={geometrie[indiceSelezionata].x - 2}
                  y={posizioniTracce[0].cima - 3}
                  width={geometrie[indiceSelezionata].w + 4}
                  height={fondoTracce - posizioniTracce[0].cima + 6}
                  rx={3}
                  strokeWidth={1}
                  className={twMerge("pointer-events-none", CLASSE_COLONNA_SCELTA)}
                />
              )}
              <g aria-hidden="true">
                {ordineAreeTracce.map(k => {
                  const { barra } = visibili[k];
                  return (
                    <rect
                      key={barra.id}
                      data-area-traccia={barra.id}
                      x={areeAttive[k].x}
                      y={cimaTracce}
                      width={areeAttive[k].w}
                      height={fondoTracce - cimaTracce}
                      fill="transparent"
                      className={twMerge(onSeleziona && "cursor-pointer")}
                      onClick={() => onSeleziona?.(barra.id)}
                      {...conTooltip(contenutoBarra(barra, k))}
                    />
                  );
                })}
              </g>
              {posizioniTracce.map(posizione => (
                <SegniTraccia
                  key={posizione.traccia.id}
                  posizione={posizione}
                  colonne={colonneTracce}
                  corsie={corsieBarre}
                  selezionata={selezionata}
                  sx={sx}
                  t0={t0}
                  t1={t1}
                  xInizio={MARGINE}
                  xFine={larghezza - MARGINE}
                  conTooltip={conTooltip}
                />
              ))}
            </g>
          )}

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
                ...righeTracce(k).map(d => `${d.etichetta} ${d.valore}`),
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
                  {...conTooltip(contenutoBarra(barra, k))}
                />
              );
            })}
          </g>
        </svg>
      </div>
      {legendeTracce.length === 0 ? (
        <Legenda voci={vociLegenda} className="mt-3" />
      ) : (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <Legenda voci={vociLegenda} />
          {legendeTracce.map(legenda => (
            <Legenda key={legenda.id} titolo={legenda.titolo} voci={legenda.voci} />
          ))}
        </div>
      )}
      <TabellaDati
        titolo={titolo}
        colonne={[
          "Volantino",
          "Dal",
          "Al",
          descrizioneGruppo,
          ...tracce.map(traccia => traccia.etichetta),
          ...(assenzeVisibili.length > 0 ? ["Nota"] : []),
        ]}
        righe={[
          ...visibili.map(({ barra, inizio }, k) => ({
            inizio,
            celle: [
              barra.titolo,
              dataBreve(msData(barra.dal)),
              dataBreve(msData(barra.al ?? barra.dal)),
              nomeGruppo.get(barra.gruppo) ?? "",
              ...tracce.map(traccia => cellaTraccia(traccia, colonneTracce[k])),
              ...(assenzeVisibili.length > 0 ? [""] : []),
            ],
          })),
          ...assenzeVisibili.map(({ assenza, inizio }) => ({
            inizio,
            celle: [assenza.titolo, dataBreve(msData(assenza.dal)), dataBreve(msData(assenza.al ?? assenza.dal)), "", ...tracce.map(() => ""), nomeAssenze],
          })),
        ]
          .sort((a, b) => a.inizio - b.inizio)
          .map(riga => riga.celle)}
      />
      {tooltip}
    </figure>
  );
}

export default TimelineVolantini;
