import type { TonoStato } from "@/constants/stati";
import type { Chart, ChartOptions, ChartType } from "chart.js";
import { getColor } from "./colors";
import { toRGB } from "./helper";

// I colori del tema cambiano con lo schema scelto: tutto ciò che li legge va chiamato
// al render (o dentro useMemo), mai al caricamento del modulo.

/**
 * Colori fra il primo e il secondo del tema. Le prime serie hanno tinte lontane fra loro e dal
 * navy del tema; niente rosso puro, che nei grafici vuol dire "negativo" (coloreSemantico).
 */
const SERIE_FISSA = [
  "#0891b2", "#d97706", "#059669", "#7c3aed", "#be123c", "#2563eb",
  "#65a30d", "#ea580c", "#0f766e", "#9333ea", "#4f46e5",
] as const;

/** Numero di colori distinti prima che la palette ricominci. */
export const LUNGHEZZA_PALETTE = SERIE_FISSA.length + 2;

const conAlpha = (hex: string, alpha: number) => `rgb(${toRGB(hex)} / ${alpha})`;

/** Colore della serie o categoria `indice`; dopo l'ultimo colore la palette ricomincia. */
export const paletteColore = (indice: number, alpha: number = 1): string => {
  const posizione = ((Math.trunc(indice) % LUNGHEZZA_PALETTE) + LUNGHEZZA_PALETTE) % LUNGHEZZA_PALETTE;
  if (posizione === 0) return getColor("theme.1", alpha);
  // Il secondo colore del tema, vicino al primo, viene per ultimo
  if (posizione === LUNGHEZZA_PALETTE - 1) return getColor("theme.2", alpha);
  return conAlpha(SERIE_FISSA[posizione - 1], alpha);
};

/** Palette categorica completa: il primo colore del tema, la serie fissa, poi il secondo del tema. */
export const paletteCategorica = (alpha: number = 1): string[] =>
  Array.from({ length: LUNGHEZZA_PALETTE }, (_, indice) => paletteColore(indice, alpha));

const CHIAVI_SEMANTICHE = {
  positivo: "success",
  negativo: "danger",
  attenzione: "warning",
  info: "info",
  neutro: "slate.400",
} as const;

export type ColoreSemantico = keyof typeof CHIAVI_SEMANTICHE;

/** Colore con un significato (esito positivo o negativo, attenzione, informazione, dato neutro), con trasparenza. */
export const coloreSemantico = (chiave: ColoreSemantico, alpha: number = 1): string =>
  getColor(CHIAVI_SEMANTICHE[chiave], alpha);

/** Colori semantici pieni. */
export const COLORI_SEMANTICI = {
  get positivo() { return coloreSemantico("positivo"); },
  get negativo() { return coloreSemantico("negativo"); },
  get attenzione() { return coloreSemantico("attenzione"); },
  get info() { return coloreSemantico("info"); },
  get neutro() { return coloreSemantico("neutro"); },
};

/** Tono di uno score 0-100: positivo da 70, attenzione da 40, negativo sotto. */
export const tonoScore = (score: number): Extract<TonoStato, "success" | "warning" | "danger"> =>
  score >= 70 ? "success" : score >= 40 ? "warning" : "danger";

/** Colore di uno score 0-100, con le soglie di tonoScore. */
export const coloreScore = (score: number, alpha: number = 1): string => getColor(tonoScore(score), alpha);

export const FONT_GRAFICO = { family: "Urbanist, system-ui, sans-serif", size: 11 } as const;

export const COLORI_ASSI = {
  get tick() { return getColor("slate.400"); },
  get tickForte() { return getColor("slate.600"); },
  get griglia() { return getColor("slate.400", 0.12); },
  get legenda() { return getColor("slate.500"); },
};

export const TOOLTIP = {
  get backgroundColor() { return getColor("slate.900"); },
  get titleColor() { return getColor("slate.50"); },
  get bodyColor() { return getColor("slate.200"); },
  padding: 10,
  cornerRadius: 8,
};

type Oggetto = Record<string, unknown>;

const eOggettoSemplice = (valore: unknown): valore is Oggetto =>
  typeof valore === "object" &&
  valore !== null &&
  !Array.isArray(valore) &&
  Object.getPrototypeOf(valore) === Object.prototype;

// Le chiavi indefinite non cancellano la base; array e funzioni sostituiscono il valore.
const unisci = (base: Oggetto, aggiunta: Oggetto): Oggetto => {
  const risultato: Oggetto = { ...base };
  for (const [chiave, valore] of Object.entries(aggiunta)) {
    if (valore === undefined) continue;
    const attuale = risultato[chiave];
    risultato[chiave] = eOggettoSemplice(attuale) && eOggettoSemplice(valore) ? unisci(attuale, valore) : valore;
  }
  return risultato;
};

const TIPI_CARTESIANI: ReadonlySet<ChartType> = new Set<ChartType>(["bar", "line", "scatter", "bubble"]);

const scalaBase = (): Oggetto => ({
  grid: { color: COLORI_ASSI.griglia },
  ticks: { color: COLORI_ASSI.tick, font: { ...FONT_GRAFICO } },
});

/**
 * Opzioni comuni a tutti i grafici (dimensioni, font, colori di assi, legenda e tooltip)
 * unite in profondità con quelle specifiche del grafico, che prevalgono.
 */
export const opzioniBase = <TType extends ChartType>(tipo: TType, override?: ChartOptions<TType>): ChartOptions<TType> => {
  const aggiunta = (override ?? {}) as unknown as Oggetto;
  const base: Oggetto = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: COLORI_ASSI.legenda, font: { ...FONT_GRAFICO } } },
      tooltip: { ...TOOLTIP },
    },
  };

  if (TIPI_CARTESIANI.has(tipo)) {
    // Lo stile va anche agli assi aggiuntivi dichiarati dal grafico (per esempio y1)
    const assiDichiarati = eOggettoSemplice(aggiunta.scales) ? Object.keys(aggiunta.scales) : [];
    const assi = new Set(["x", "y", ...assiDichiarati]);
    base.scales = Object.fromEntries([...assi].map((asse) => [asse, scalaBase()]));
  }

  return unisci(base, aggiunta) as unknown as ChartOptions<TType>;
};

type ScaleCartesiane = NonNullable<ChartOptions<"line">["scales"]>;

interface OpzioniAssi {
  /** Griglia verticale; predefinita visibile. */
  xGriglia?: boolean;
  yMin?: number;
  yMax?: number;
  stepSize?: number;
}

/** Assi x/y dei grafici a barre e a linee, da passare come `scales` a opzioniBase. */
export const opzioniAssi = ({ xGriglia = true, yMin, yMax, stepSize }: OpzioniAssi = {}): ScaleCartesiane => {
  const y: Oggetto = {};
  if (yMin !== undefined) y.min = yMin;
  if (yMax !== undefined) y.max = yMax;
  if (stepSize !== undefined) y.ticks = { stepSize };
  return { x: { grid: { display: xGriglia } }, y } as unknown as ScaleCartesiane;
};

/** Font e colore predefiniti di Chart.js; si può richiamare a ogni grafico creato. */
export const applicaDefaultChart = (Grafico: Pick<typeof Chart, "defaults">) => {
  const { defaults } = Grafico;
  if (defaults.font.family !== FONT_GRAFICO.family) {
    defaults.font.family = FONT_GRAFICO.family;
  }
  const colore = COLORI_ASSI.legenda;
  if (defaults.color !== colore) {
    defaults.color = colore;
  }
};
