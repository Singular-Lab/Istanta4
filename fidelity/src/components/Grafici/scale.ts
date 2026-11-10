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

/** Un giorno in millisecondi: le date di msData sono mezzanotti UTC, senza ora legale. */
export const MS_GIORNO = 86_400_000;

/** Data ISO (YYYY-MM-DD) di millisecondi UTC: l'inverso di msData. */
export const isoData = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Oggi, il giorno del calendario locale, in millisecondi UTC come le date di msData. */
export const msOggi = (adesso: Date = new Date()): number => Date.UTC(adesso.getFullYear(), adesso.getMonth(), adesso.getDate());

/** Inizio dell'anno, in millisecondi UTC. */
export const inizioAnno = (anno: number): number => Date.UTC(anno, 0, 1);

/** Anno di una data in millisecondi UTC. */
export const annoDi = (ms: number): number => new Date(ms).getUTCFullYear();

/** Inizio del mese di una data in millisecondi UTC, oppure di `spostamento` mesi dopo (o prima, se negativo). */
export const inizioMese = (ms: number, spostamento = 0): number => {
  const data = new Date(ms);
  return Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + spostamento, 1);
};

export const MESI_BREVI: readonly string[] = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

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

export interface MeseCalendario {
  /** Primo giorno del mese, in millisecondi UTC. */
  ms: number;
  /** Primo giorno del mese dopo. */
  fine: number;
  anno: number;
  /** 0 = gennaio. */
  mese: number;
  /** "ott 2026". */
  etichetta: string;
  /** "ott". */
  breve: string;
}

/** I mesi del calendario che toccano [t0, t1), anche solo in parte, con le etichette lunga e breve. */
export const mesiCalendario = (t0: number, t1: number): MeseCalendario[] => {
  const mesi: MeseCalendario[] = [];
  for (let ms = inizioMese(t0); ms < t1; ms = inizioMese(ms, 1)) {
    const data = new Date(ms);
    const anno = data.getUTCFullYear();
    const mese = data.getUTCMonth();
    mesi.push({ ms, fine: inizioMese(ms, 1), anno, mese, etichetta: `${MESI_BREVI[mese]} ${anno}`, breve: MESI_BREVI[mese] });
  }
  return mesi;
};

/** I lunedì in [t0, t1), in millisecondi UTC: l'inizio delle settimane del calendario. */
export const lunediTra = (t0: number, t1: number): number[] => {
  const giorno = Math.ceil(t0 / MS_GIORNO) * MS_GIORNO;
  // getUTCDay: 0 è domenica, 1 lunedì
  const primo = giorno + ((8 - new Date(giorno).getUTCDay()) % 7) * MS_GIORNO;
  const risultato: number[] = [];
  for (let ms = primo; ms < t1; ms += 7 * MS_GIORNO) risultato.push(ms);
  return risultato;
};

/**
 * I giorni di un periodo di validità come intervallo semiaperto in millisecondi UTC: dal primo
 * giorno all'inizio del giorno dopo l'ultimo, che è compreso. Senza fine, o con la fine prima
 * dell'inizio, è un giorno solo.
 */
export const intervalloGiorni = (dal: string, al: string | null | undefined): { inizio: number; fine: number } => {
  const inizio = msData(dal);
  const ultimo = al ? msData(al) : inizio;
  return { inizio, fine: Math.max(inizio, ultimo) + MS_GIORNO };
};

/**
 * Corsie delle barre nel tempo, perché quelle che si sovrappongono non si coprano: dalla barra che
 * inizia prima, ognuna va nella prima corsia libera, quella la cui ultima barra finisce entro il
 * suo inizio (gli intervalli sono semiaperti: chi finisce il 16 e chi inizia il 17 stanno sulla
 * stessa corsia). Restituisce la corsia (0 = la prima) di ogni barra, nell'ordine dato.
 */
export const assegnaCorsie = (intervalli: ReadonlyArray<{ inizio: number; fine: number }>): number[] => {
  const ordine = intervalli.map((_, i) => i).sort((a, b) => intervalli[a].inizio - intervalli[b].inizio || a - b);
  const fineCorsie: number[] = [];
  const corsie = new Array<number>(intervalli.length).fill(0);
  for (const i of ordine) {
    const { inizio, fine } = intervalli[i];
    const libera = fineCorsie.findIndex(f => f <= inizio);
    const corsia = libera === -1 ? fineCorsie.length : libera;
    fineCorsie[corsia] = Math.max(inizio, fine);
    corsie[i] = corsia;
  }
  return corsie;
};

/** Larghezza stimata di un testo in pixel (Urbanist, cifre e lettere medie). */
export const larghezzaTesto = (testo: string, dimensione = 11): number => testo.length * dimensione * 0.58;

/**
 * Il testo che sta in `spazio` pixel: intero se ci sta, altrimenti tagliato con "…"; null se non
 * ne restano almeno `minimo` caratteri (meglio niente che due lettere).
 */
export const testoCheSta = (testo: string, spazio: number, dimensione = 11, minimo = 4): string | null => {
  if (larghezzaTesto(testo, dimensione) <= spazio) return testo;
  const caratteri = Math.floor(spazio / (dimensione * 0.58)) - 1;
  return caratteri >= minimo ? `${testo.slice(0, caratteri).trimEnd()}…` : null;
};

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
