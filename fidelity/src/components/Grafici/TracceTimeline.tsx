import { twMerge } from "@/utils/twMerge";
import { CLASSI_ASSI, CLASSI_TESTO, SERIE_PRINCIPALE, type Tinta } from "./colori";
import { CLASSI_TONO, type FasciaTempo, type TonoFascia } from "./FasceNelTempo";
import type { VoceLegenda } from "./Legenda";
import { dataBreve, msData, MS_GIORNO, percorsoColonna, scalaLineare, taccheTonde, testoCheSta } from "./scale";
import type { RigaTooltip, useTooltip } from "./Tooltip";

/**
 * Tracce della timeline dei volantini: corsie di dati sotto le barre, sullo stesso asse del tempo,
 * con un segno per volantino largo quanto la sua barra. Qui tipi, misure, testi e segni; aree
 * attive, legenda e tabella dei dati le compone TimelineVolantini.
 */

/** Una corsia di dati sotto le barre, sullo stesso asse del tempo: un valore per barra (BarraTimeline.id). */
export type TracciaTimeline =
  | { tipo: "colonne"; id: string; etichetta: string; valori: Readonly<Record<string, number | null>>; formatta: (valore: number) => string }
  | { tipo: "linea"; id: string; etichetta: string; valori: Readonly<Record<string, number | null>>; formatta: (valore: number) => string }
  | {
      tipo: "impilate";
      id: string;
      etichetta: string;
      categorie: ReadonlyArray<{ id: string; etichetta: string; tinta: Tinta }>;
      /** Quote 0–100 per barra e per categoria. */
      valori: Readonly<Record<string, Readonly<Record<string, number>>>>;
      formatta: (valore: number) => string;
    }
  | { tipo: "fasce"; id: string; etichetta: string; fasce: ReadonlyArray<FasciaTempo>; nomiToni?: Partial<Record<TonoFascia, string>> };

type TracciaImpilate = Extract<TracciaTimeline, { tipo: "impilate" }>;
type TracciaFasce = Extract<TracciaTimeline, { tipo: "fasce" }>;

/** Una barra vista dalle tracce: la sua geometria nella timeline, il primo giorno e la corsia. */
export interface ColonnaTraccia {
  id: string;
  /** Primo giorno di validità, in millisecondi UTC. */
  inizio: number;
  x: number;
  w: number;
  /** 0 = la prima corsia; le altre sono i volantini sovrapposti a un altro. */
  corsia: number;
}

/** Dove sta una traccia: la riga dell'etichetta, poi i segni fra cima e fondo. */
export interface PosizioneTraccia {
  traccia: TracciaTimeline;
  /** Sopra la riga dell'etichetta. */
  inizio: number;
  /** Linea di base dell'etichetta. */
  yEtichetta: number;
  cima: number;
  fondo: number;
}

type ConTooltip = ReturnType<typeof useTooltip>["conTooltip"];

const SPAZIO_PRIMA = 12;
const RIGA_ETICHETTA = 16;
const ALTEZZA_COLONNE = 56;
const ALTEZZA_LINEA = 56;
/** Le impilate: una fascia per corsia delle barre, più alta se la corsia è una sola. */
const ALTEZZA_IMPILATE_CORSIA = 22;
const ALTEZZA_IMPILATE_SOLA = 36;
const ALTEZZA_FASCE = 18;
/** Oltre questi volantini la linea va senza punti: resta quello del volantino scelto. */
const PUNTI_MASSIMI = 40;
/** Spazio sopra e sotto la linea perché i punti non escano dalla traccia. */
const MARGINE_PUNTI = 6;
const RAGGIO_PUNTO = 3.5;
const RAGGIO_SCELTO = 4.5;
/** Superficie fra le fasce delle corsie nelle impilate. */
const STACCO_CORSIE = 2;
const NESSUN_DATO = "nessun dato";

const proprio = (oggetto: object, chiave: string) => Object.prototype.hasOwnProperty.call(oggetto, chiave);

/** Il valore di una barra in una traccia a colonne o a linea; null se manca. */
const valoreDi = (valori: Readonly<Record<string, number | null>>, id: string): number | null => {
  const valore = proprio(valori, id) ? valori[id] : null;
  return valore === null || valore === undefined || !Number.isFinite(valore) ? null : valore;
};

/** Le categorie di una barra dalla quota più grande, senza quelle a zero (a parità, nell'ordine dato). */
const quoteOrdinate = (traccia: TracciaImpilate, id: string) => {
  const quote = proprio(traccia.valori, id) ? traccia.valori[id] : {};
  return traccia.categorie
    .map((categoria, k) => ({ categoria, k, quota: proprio(quote, categoria.id) ? Number(quote[categoria.id]) : 0 }))
    .filter(q => Number.isFinite(q.quota) && q.quota > 0)
    .sort((a, b) => b.quota - a.quota || a.k - b.k);
};

const periodoFascia = (fascia: FasciaTempo) => `${dataBreve(msData(fascia.dal))} – ${dataBreve(msData(fascia.al))}`;

/** Il tratto di una traccia a fasce che comprende il giorno `ms`. */
const fasciaDel = (traccia: TracciaFasce, ms: number) => traccia.fasce.find(f => msData(f.dal) <= ms && ms < msData(f.al) + MS_GIORNO);

/** I tratti di una traccia a fasce che toccano il periodo [t0, t1). */
export const fasceVisibili = (traccia: TracciaFasce, t0: number, t1: number) => traccia.fasce.filter(f => msData(f.al) + MS_GIORNO > t0 && msData(f.dal) < t1);

const chiaveTinta = (tinta: Tinta): NonNullable<RigaTooltip["chiave"]> => (tinta.colore ? { colore: tinta.colore } : { classeFill: tinta.classe });

/** Altezza dei segni di una traccia, senza la riga dell'etichetta. */
export const altezzaTraccia = (traccia: TracciaTimeline, corsie: number): number => {
  switch (traccia.tipo) {
    case "colonne":
      return ALTEZZA_COLONNE;
    case "linea":
      return ALTEZZA_LINEA;
    case "impilate":
      return corsie > 1 ? ALTEZZA_IMPILATE_CORSIA * corsie : ALTEZZA_IMPILATE_SOLA;
    case "fasce":
      return ALTEZZA_FASCE;
  }
};

/** Le tracce una sotto l'altra da `da` in giù, ognuna con la sua etichetta sopra; `fondo` è sotto l'ultima. */
export const disponiTracce = (tracce: readonly TracciaTimeline[], da: number, corsie: number) => {
  let y = da;
  const posizioni: PosizioneTraccia[] = tracce.map(traccia => {
    const inizio = y + SPAZIO_PRIMA;
    const cima = inizio + RIGA_ETICHETTA;
    const fondo = cima + altezzaTraccia(traccia, corsie);
    y = fondo;
    return { traccia, inizio, yEtichetta: inizio + 10, cima, fondo };
  });
  return { posizioni, fondo: y };
};

/** Le righe del tooltip di una barra per una traccia: il valore; per le impilate le 3 categorie più grandi. */
export const righeTraccia = (traccia: TracciaTimeline, colonna: Pick<ColonnaTraccia, "id" | "inizio">): RigaTooltip[] => {
  switch (traccia.tipo) {
    case "colonne":
    case "linea": {
      const valore = valoreDi(traccia.valori, colonna.id);
      return [{ etichetta: traccia.etichetta, valore: valore === null ? NESSUN_DATO : traccia.formatta(valore) }];
    }
    case "impilate": {
      const quote = quoteOrdinate(traccia, colonna.id).slice(0, 3);
      if (quote.length === 0) return [{ etichetta: traccia.etichetta, valore: NESSUN_DATO }];
      return quote.map(({ categoria, quota }) => ({ etichetta: categoria.etichetta, valore: traccia.formatta(quota), chiave: chiaveTinta(categoria.tinta) }));
    }
    case "fasce": {
      const fascia = fasciaDel(traccia, colonna.inizio);
      return fascia ? [{ etichetta: traccia.etichetta, valore: fascia.etichetta }] : [];
    }
  }
};

/** La cella della tabella dei dati di una barra per una traccia: il valore; per le impilate la categoria più grande. */
export const cellaTraccia = (traccia: TracciaTimeline, colonna: Pick<ColonnaTraccia, "id" | "inizio">): string => {
  switch (traccia.tipo) {
    case "colonne":
    case "linea": {
      const valore = valoreDi(traccia.valori, colonna.id);
      return valore === null ? "—" : traccia.formatta(valore);
    }
    case "impilate": {
      const [prima] = quoteOrdinate(traccia, colonna.id);
      return prima ? `${prima.categoria.etichetta} ${traccia.formatta(prima.quota)}` : "—";
    }
    case "fasce":
      return fasciaDel(traccia, colonna.inizio)?.etichetta ?? "—";
  }
};

/** Le voci di legenda di una traccia: le categorie delle impilate e i toni delle fasce presenti nel periodo. */
export const vociLegendaTraccia = (traccia: TracciaTimeline, colonne: readonly ColonnaTraccia[], t0: number, t1: number): VoceLegenda[] => {
  if (traccia.tipo === "impilate") {
    const presenti = new Set(colonne.flatMap(c => quoteOrdinate(traccia, c.id).map(q => q.categoria.id)));
    return traccia.categorie
      .filter(c => presenti.has(c.id))
      .map(c => ({ id: `${traccia.id}-${c.id}`, etichetta: c.etichetta, forma: "quadrato" as const, tinta: c.tinta }));
  }
  if (traccia.tipo === "fasce") {
    const nomi = traccia.nomiToni ?? {};
    const toni = [...new Set(fasceVisibili(traccia, t0, t1).map(f => f.tono ?? "neutro"))];
    return toni
      .filter(tono => nomi[tono])
      .map(tono => ({ id: `${traccia.id}-${tono}`, etichetta: nomi[tono]!, forma: "quadrato" as const, tinta: { classe: CLASSI_TONO[tono], classeTesto: "" } }));
  }
  return [];
};

/** Il minimo e il massimo di una traccia a colonne o a linea fra le barre mostrate; null senza valori. */
const estremi = (valori: Readonly<Record<string, number | null>>, colonne: readonly ColonnaTraccia[]) => {
  const presenti = colonne.map(c => valoreDi(valori, c.id)).filter((v): v is number => v !== null);
  return presenti.length === 0 ? null : { minimo: Math.min(...presenti), massimo: Math.max(...presenti) };
};

/** Il nome della traccia e, per colonne e linea, fin dove arrivano i valori ("fino a 177", "da 18% a 31%"). */
const intervalloEtichetta = (traccia: TracciaTimeline, colonne: readonly ColonnaTraccia[]): string | null => {
  if (traccia.tipo !== "colonne" && traccia.tipo !== "linea") return null;
  const valori = estremi(traccia.valori, colonne);
  if (!valori) return null;
  if (traccia.tipo === "colonne") return `fino a ${traccia.formatta(valori.massimo)}`;
  return valori.minimo === valori.massimo ? traccia.formatta(valori.minimo) : `da ${traccia.formatta(valori.minimo)} a ${traccia.formatta(valori.massimo)}`;
};

interface PropsSegni {
  traccia: TracciaTimeline;
  colonne: readonly ColonnaTraccia[];
  cima: number;
  fondo: number;
}

/**
 * Colonne: una per volantino, larga quanto la sua barra, dalla linea di base. I volantini della
 * prima corsia sono pieni; quelli sovrapposti a un altro solo un contorno, per non coprirlo.
 */
function SegniColonne({ traccia, colonne, cima, fondo }: PropsSegni & { traccia: Extract<TracciaTimeline, { tipo: "colonne" }> }) {
  const valori = estremi(traccia.valori, colonne);
  if (!valori) return null;
  const tacche = taccheTonde(0, Math.max(0, valori.massimo));
  const h = scalaLineare([0, tacche[tacche.length - 1]], [0, fondo - cima]);
  return (
    <g className="pointer-events-none">
      {colonne.map(c => {
        const valore = valoreDi(traccia.valori, c.id);
        if (valore === null) return null;
        // Un valore piccolo ma non nullo resta visibile
        const altezza = valore > 0 ? Math.max(1, h(valore)) : 0;
        if (c.corsia === 0) {
          return <path key={c.id} data-segno={c.id} data-x={c.x} d={percorsoColonna(c.x, fondo, altezza, c.w, Math.min(2, c.w / 2))} className={SERIE_PRINCIPALE.fill} />;
        }
        return (
          <rect
            key={c.id}
            data-segno={c.id}
            data-x={c.x}
            data-contorno=""
            x={c.x + 0.75}
            y={fondo - altezza + 0.75}
            width={Math.max(0.5, c.w - 1.5)}
            height={Math.max(0, altezza - 0.75)}
            fill="none"
            strokeWidth={1.5}
            className={SERIE_PRINCIPALE.stroke}
          />
        );
      })}
    </g>
  );
}

/**
 * Linea: un punto per volantino al centro della sua barra. La linea unisce i volantini della prima
 * corsia in ordine di inizio e si interrompe dove manca il valore; quelli sovrapposti a un altro
 * sono un cerchio vuoto, fuori dalla linea. Con molti volantini restano la linea, i cerchi vuoti,
 * i punti isolati e quello del volantino scelto.
 */
function SegniLinea({ traccia, colonne, cima, fondo, selezionata }: PropsSegni & { traccia: Extract<TracciaTimeline, { tipo: "linea" }>; selezionata: string | null }) {
  const valori = estremi(traccia.valori, colonne);
  if (!valori) return null;
  const tacche = taccheTonde(valori.minimo, valori.massimo);
  const sy = scalaLineare([tacche[0], tacche[tacche.length - 1]], [fondo - MARGINE_PUNTI, cima + MARGINE_PUNTI]);
  const punti = colonne
    .map(c => ({ colonna: c, valore: valoreDi(traccia.valori, c.id) }))
    .filter((p): p is { colonna: ColonnaTraccia; valore: number } => p.valore !== null)
    .map(p => ({ ...p, x: p.colonna.x + p.colonna.w / 2, y: sy(p.valore) }));

  // Tratti della prima corsia (le colonne sono in ordine di inizio), interrotti dove manca il valore
  const tratti: Array<typeof punti> = [];
  let corrente: typeof punti | null = null;
  for (const c of colonne) {
    if (c.corsia !== 0) continue;
    const punto = punti.find(p => p.colonna === c);
    if (!punto) {
      corrente = null;
      continue;
    }
    if (!corrente) {
      corrente = [];
      tratti.push(corrente);
    }
    corrente.push(punto);
  }
  const isolati = new Set(tratti.filter(t => t.length === 1).map(t => t[0].colonna.id));
  const conPunti = punti.filter(p => p.colonna.corsia === 0).length <= PUNTI_MASSIMI;
  const percorso = tratti
    .filter(t => t.length > 1)
    .map(t => t.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" "))
    .join(" ");
  // Il punto del volantino scelto per ultimo, sopra gli altri
  const ordinati = [...punti].sort((a, b) => Number(a.colonna.id === selezionata) - Number(b.colonna.id === selezionata));

  return (
    <g className="pointer-events-none">
      {percorso && <path d={percorso} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className={SERIE_PRINCIPALE.stroke} />}
      {ordinati.map(({ colonna, x, y }) => {
        const scelto = colonna.id === selezionata;
        const raggio = scelto ? RAGGIO_SCELTO : RAGGIO_PUNTO;
        if (colonna.corsia > 0) {
          return (
            <circle
              key={colonna.id}
              data-segno={colonna.id}
              data-x={colonna.x}
              data-contorno=""
              cx={x}
              cy={y}
              r={raggio}
              strokeWidth={2}
              className={twMerge(CLASSI_ASSI.superficie, SERIE_PRINCIPALE.stroke)}
            />
          );
        }
        if (!conPunti && !scelto && !isolati.has(colonna.id)) return null;
        return <circle key={colonna.id} data-segno={colonna.id} data-x={colonna.x} cx={x} cy={y} r={raggio} strokeWidth={2} className={twMerge(SERIE_PRINCIPALE.fill, CLASSI_ASSI.anello)} />;
      })}
    </g>
  );
}

/**
 * Impilate: per ogni volantino una colonna al 100% con le quote delle categorie, dall'alto
 * nell'ordine delle categorie (il colore segue la categoria). Ogni corsia delle barre ha la sua
 * fascia, così i volantini sovrapposti non si coprono; 1 px di superficie fra le parti alte almeno 4 px.
 */
function SegniImpilate({ traccia, colonne, cima, fondo, corsie }: PropsSegni & { traccia: TracciaImpilate; corsie: number }) {
  const altezzaCorsia = (fondo - cima) / Math.max(1, corsie);
  const stacco = corsie > 1 ? STACCO_CORSIE : 0;
  return (
    <g className="pointer-events-none">
      {colonne.map(c => {
        const quote = proprio(traccia.valori, c.id) ? traccia.valori[c.id] : null;
        if (!quote) return null;
        const parti = traccia.categorie.map(categoria => ({ categoria, quota: Math.max(0, Number(quote[categoria.id]) || 0) }));
        const totale = parti.reduce((somma, p) => somma + p.quota, 0);
        if (!(totale > 0)) return null;
        // Le quote sono su 100: quel che manca resta vuoto; oltre 100 (gli arrotondamenti) si riporta a 100
        const scala = (altezzaCorsia - stacco) / Math.max(100, totale);
        let y = cima + c.corsia * altezzaCorsia;
        return (
          <g key={c.id} data-segno={c.id} data-x={c.x}>
            {parti.map(({ categoria, quota }) => {
              const altezza = quota * scala;
              const inizio = y;
              y += altezza;
              const visibile = altezza - (altezza > 4 ? 1 : 0);
              if (visibile < 0.3) return null;
              return <rect key={categoria.id} x={c.x} y={inizio} width={c.w} height={visibile} fill={categoria.tinta.colore} className={categoria.tinta.classe} />;
            })}
          </g>
        );
      })}
    </g>
  );
}

/** Fasce: i tratti nel tempo coi toni di FasceNelTempo, il testo dentro se ci sta e il tooltip con le date. */
function SegniFasce({ traccia, cima, fondo, sx, t0, t1, conTooltip }: Omit<PropsSegni, "colonne"> & { traccia: TracciaFasce; sx: (ms: number) => number; t0: number; t1: number; conTooltip: ConTooltip }) {
  return (
    <g>
      {fasceVisibili(traccia, t0, t1).map(fascia => {
        const inizio = sx(Math.max(t0, msData(fascia.dal)));
        const fine = sx(Math.min(t1, msData(fascia.al) + MS_GIORNO));
        const w = Math.max(2, fine - inizio - 2);
        const tono = fascia.tono ?? "neutro";
        const etichetta = testoCheSta(fascia.etichetta, w - 12);
        return (
          <g key={fascia.id} data-fascia={fascia.id} {...conTooltip({ titolo: fascia.etichetta, sottotitolo: periodoFascia(fascia), righe: fascia.dettagli })}>
            <rect x={inizio + 1} y={cima} width={w} height={fondo - cima} rx={3} strokeWidth={tono === "attenzione" ? 1.5 : 0} className={CLASSI_TONO[tono]} />
            {etichetta && (
              <text x={inizio + 7} y={(cima + fondo) / 2} dominantBaseline="central" className={twMerge("pointer-events-none text-2xs font-semibold", CLASSI_TESTO.primario)}>
                {etichetta}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

export interface SegniTracciaProps {
  posizione: PosizioneTraccia;
  /** Le barre mostrate, in ordine di inizio, con la loro geometria. */
  colonne: readonly ColonnaTraccia[];
  /** Corsie delle barre (le impilate ne fanno una fascia ciascuna). */
  corsie: number;
  selezionata: string | null;
  /** Scala e periodo dell'asse del tempo, per le fasce. */
  sx: (ms: number) => number;
  t0: number;
  t1: number;
  /** Dove sta l'etichetta a sinistra e fin dove arriva la linea di base. */
  xInizio: number;
  xFine: number;
  conTooltip: ConTooltip;
}

/** Una traccia: l'etichetta in alto a sinistra e i segni del suo tipo. */
export function SegniTraccia({ posizione, colonne, corsie, selezionata, sx, t0, t1, xInizio, xFine, conTooltip }: SegniTracciaProps) {
  const { traccia, yEtichetta, cima, fondo } = posizione;
  const intervallo = intervalloEtichetta(traccia, colonne);
  return (
    <g data-traccia={traccia.id}>
      <text x={xInizio} y={yEtichetta} className={twMerge("pointer-events-none text-2xs font-semibold", CLASSI_TESTO.secondario)}>
        {traccia.etichetta}
        {intervallo && <tspan className={twMerge("font-normal", CLASSI_TESTO.tenue)}>{` · ${intervallo}`}</tspan>}
      </text>
      {(traccia.tipo === "colonne" || traccia.tipo === "linea") && (
        <line
          x1={xInizio}
          x2={xFine}
          y1={fondo + 0.5}
          y2={fondo + 0.5}
          className={twMerge("pointer-events-none", traccia.tipo === "colonne" ? CLASSI_ASSI.base : CLASSI_ASSI.griglia)}
        />
      )}
      {traccia.tipo === "colonne" && <SegniColonne traccia={traccia} colonne={colonne} cima={cima} fondo={fondo} />}
      {traccia.tipo === "linea" && <SegniLinea traccia={traccia} colonne={colonne} cima={cima} fondo={fondo} selezionata={selezionata} />}
      {traccia.tipo === "impilate" && <SegniImpilate traccia={traccia} colonne={colonne} cima={cima} fondo={fondo} corsie={corsie} />}
      {traccia.tipo === "fasce" && <SegniFasce traccia={traccia} cima={cima} fondo={fondo} sx={sx} t0={t0} t1={t1} conTooltip={conTooltip} />}
    </g>
  );
}
