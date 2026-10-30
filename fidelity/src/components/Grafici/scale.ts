/**
 * Calcoli comuni ai grafici SVG di src/components/Grafici: scale, tacche degli assi, date e
 * forme dei segni. Funzioni pure, senza React, provate in scale.test.ts.
 */

/** Scala lineare: dal dominio [d0, d1] all'intervallo di coordinate [r0, r1]. Un dominio vuoto va al centro. */
export const scalaLineare = ([d0, d1]: readonly [number, number], [r0, r1]: readonly [number, number]) => {
  const ampiezza = d1 - d0;
  return (valore: number): number => (ampiezza === 0 ? (r0 + r1) / 2 : r0 + ((valore - d0) / ampiezza) * (r1 - r0));
};

const MOLTIPLICATORI_TONDI = [1, 2, 2.5, 5, 10];

/**
 * Tacche "tonde" (1, 2, 2,5 e 5 per una potenza di 10) che coprono [min, max] in circa `quante`
 * parti: la prima è <= min, l'ultima >= max. Servono anche da dominio dell'asse.
 */
export const taccheTonde = (min: number, max: number, quante = 4): number[] => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  let basso = Math.min(min, max);
  let alto = Math.max(min, max);
  if (alto === basso) {
    // Un valore solo: l'asse parte da zero (o arriva a zero, se negativo)
    if (alto > 0) basso = 0;
    else if (alto < 0) alto = 0;
    else alto = 1;
  }
  const grezzo = (alto - basso) / Math.max(1, quante);
  const potenza = 10 ** Math.floor(Math.log10(grezzo));
  const passo = (MOLTIPLICATORI_TONDI.find(m => m * potenza >= grezzo) ?? 10) * potenza;
  const inizio = Math.floor(basso / passo) * passo;
  const fine = Math.ceil(alto / passo) * passo;
  const tacche: number[] = [];
  // toFixed toglie gli errori di arrotondamento (0,30000000000000004)
  for (let valore = inizio; valore <= fine + passo / 2; valore += passo) tacche.push(Number(valore.toFixed(10)));
  return tacche;
};

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

/** Millisecondi UTC di una data ISO (YYYY-MM-DD): i giorni restano quelli scritti, qualunque sia il fuso. */
export const msData = (dataIso: string): number => {
  const parti = DATA_ISO.exec(dataIso);
  if (parti) return Date.UTC(Number(parti[1]), Number(parti[2]) - 1, Number(parti[3]));
  const ms = Date.parse(dataIso);
  return Number.isFinite(ms) ? ms : 0;
};

/** Inizio dell'anno, in millisecondi UTC. */
export const inizioAnno = (anno: number): number => Date.UTC(anno, 0, 1);

/** Anno di una data in millisecondi UTC. */
export const annoDi = (ms: number): number => new Date(ms).getUTCFullYear();

const MESI_BREVI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/** "8 apr 2024". */
export const dataBreve = (ms: number): string => {
  const data = new Date(ms);
  return `${data.getUTCDate()} ${MESI_BREVI[data.getUTCMonth()]} ${data.getUTCFullYear()}`;
};

export interface TaccaTempo {
  /** Inizio del periodo (riga della griglia). */
  ms: number;
  /** Centro del periodo, dove va l'etichetta. */
  centro: number;
  etichetta: string;
}

/**
 * Tacche di un asse del tempo fra t0 e t1: gli anni, oppure i mesi se il periodo sta in un anno
 * (lo zoom su un anno solo).
 */
export const taccheTempo = (t0: number, t1: number): TaccaTempo[] => {
  if (!(t1 > t0)) return [];
  const primoAnno = annoDi(t0);
  const ultimoAnno = annoDi(t1 - 1);
  if (primoAnno === ultimoAnno) {
    const tacche: TaccaTempo[] = [];
    for (let mese = new Date(t0).getUTCMonth(); mese <= new Date(t1 - 1).getUTCMonth(); mese++) {
      const ms = Date.UTC(primoAnno, mese, 1);
      tacche.push({ ms, centro: (ms + Date.UTC(primoAnno, mese + 1, 1)) / 2, etichetta: MESI_BREVI[mese] });
    }
    return tacche;
  }
  const tacche: TaccaTempo[] = [];
  for (let anno = primoAnno; anno <= ultimoAnno; anno++) {
    const ms = inizioAnno(anno);
    tacche.push({ ms, centro: (ms + inizioAnno(anno + 1)) / 2, etichetta: String(anno) });
  }
  return tacche;
};

/** Larghezza stimata di un testo in pixel (Urbanist, cifre e lettere medie). */
export const larghezzaTesto = (testo: string, dimensione = 11): number => testo.length * dimensione * 0.58;

/**
 * Barra orizzontale che parte dalla linea di base (x0) e finisce arrotondata: base squadrata,
 * estremità del dato con raggio 4. Stringa vuota se la lunghezza è zero.
 */
export const percorsoBarraOrizzontale = (x0: number, y: number, lunghezza: number, spessore: number, raggio = 4): string => {
  if (!(lunghezza > 0) || !(spessore > 0)) return "";
  const r = Math.min(raggio, lunghezza, spessore / 2);
  return [
    `M${x0} ${y}`,
    `h${lunghezza - r}`,
    `a${r} ${r} 0 0 1 ${r} ${r}`,
    `v${spessore - 2 * r}`,
    `a${r} ${r} 0 0 1 ${-r} ${r}`,
    `h${-(lunghezza - r)}`,
    "Z",
  ].join(" ");
};

/**
 * Colonna che sale dalla linea di base (yBase) con la cima arrotondata e la base squadrata.
 * Stringa vuota se l'altezza è zero.
 */
export const percorsoColonna = (x: number, yBase: number, altezza: number, larghezza: number, raggio = 4): string => {
  if (!(altezza > 0) || !(larghezza > 0)) return "";
  const r = Math.min(raggio, altezza, larghezza / 2);
  return [
    `M${x} ${yBase}`,
    `v${-(altezza - r)}`,
    `a${r} ${r} 0 0 1 ${r} ${-r}`,
    `h${larghezza - 2 * r}`,
    `a${r} ${r} 0 0 1 ${r} ${r}`,
    `v${altezza - r}`,
    "Z",
  ].join(" ");
};

/** Rombo centrato in (cx, cy) con semidiagonale r. */
export const percorsoRombo = (cx: number, cy: number, r: number): string =>
  `M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy} Z`;

/** Triangolo con la punta in alto, centrato in (cx, cy). */
export const percorsoTriangolo = (cx: number, cy: number, r: number): string =>
  `M${cx} ${cy - r} L${cx + r} ${cy + r * 0.8} L${cx - r} ${cy + r * 0.8} Z`;

/** Croce (due diagonali) centrata in (cx, cy). */
export const percorsoCroce = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy - r} L${cx + r} ${cy + r} M${cx + r} ${cy - r} L${cx - r} ${cy + r}`;
