/**
 * Geometria del collage delle copertine (schede e vetrina dei Volantini): le copertine si
 * sovrappongono come fogli stampati posati su una scrivania, a ventaglio intorno al centro.
 * Funzioni pure: il componente è CollageCopertine.tsx.
 */

/** Posto di un foglio: centro orizzontale in %, scostamento verticale in % dell'altezza del foglio, rotazione in gradi. */
export type PostoCollage = readonly [x: number, y: number, rotazione: number];

/**
 * Posti per numero di fogli, simmetrici: i fogli ai lati scendono e ruotano di più, quello
 * centrale sta dritto. 5 è il massimo delle schede, 7 della vetrina.
 */
export const POSTI_COLLAGE: Readonly<Record<number, readonly PostoCollage[]>> = {
  1: [[50, 0, -2]],
  2: [[37, 3, -7], [63, 0, 6]],
  3: [[29, 5, -10], [50, 0, 0], [71, 5, 9]],
  4: [[23, 7, -12], [41, 1, -4], [59, 1, 4], [77, 7, 12]],
  5: [[18, 9, -14], [34, 3, -7], [50, 0, 0], [66, 3, 7], [82, 9, 14]],
  6: [[20, 10, -14], [32, 4, -8], [44, 1, -3], [56, 1, 3], [68, 4, 8], [80, 10, 14]],
  7: [[20, 11, -14], [30, 5, -9], [40, 2, -4], [50, 0, 0], [60, 2, 4], [70, 5, 9], [80, 11, 14]],
};

/** Fogli al massimo in un collage: oltre, i posti non stanno nella scrivania. */
export const MASSIMO_FOGLI_COLLAGE = 7;

/**
 * Kit in ordine di collage: un kit per insegna (canale) a turno, nell'ordine in cui le insegne
 * compaiono, così i primi fogli mostrano insegne diverse invece di cinque copertine dello stesso
 * canale. Dentro un'insegna resta l'ordine ricevuto.
 */
export const ordinaPerCollage = <T extends { canale: { id: string } }>(kit: readonly T[]): T[] => {
  const perInsegna = new Map<string, T[]>();
  for (const voce of kit) {
    const gruppo = perInsegna.get(voce.canale.id);
    if (gruppo) gruppo.push(voce);
    else perInsegna.set(voce.canale.id, [voce]);
  }
  const gruppi = [...perInsegna.values()];
  const ordinati: T[] = [];
  for (let turno = 0; ordinati.length < kit.length; turno++) {
    for (const gruppo of gruppi) {
      if (turno < gruppo.length) ordinati.push(gruppo[turno]);
    }
  }
  return ordinati;
};

export interface FoglioCollage<T> {
  kit: T;
  /** Centro orizzontale, in % della scrivania. */
  x: number;
  /** Scostamento verticale, in % dell'altezza del foglio. */
  y: number;
  rotazione: number;
  /** I fogli al centro stanno sopra quelli ai lati. */
  livello: number;
  /** Di quanti px il foglio si allarga verso il suo lato quando il ventaglio si apre (hover). */
  apertura: number;
}

/**
 * I fogli da disegnare, al massimo `massimo` (1–7), nell'ordine di ordinaPerCollage, e quanti
 * kit restano fuori ("+N").
 */
export const fogliDelCollage = <T extends { canale: { id: string } }>(
  kit: readonly T[],
  massimo: number
): { fogli: FoglioCollage<T>[]; altri: number } => {
  const ordinati = ordinaPerCollage(kit);
  const limite = Math.max(1, Math.min(MASSIMO_FOGLI_COLLAGE, Math.trunc(massimo) || 1));
  const quanti = Math.min(limite, ordinati.length);
  const posti = POSTI_COLLAGE[quanti] ?? [];
  const centro = (quanti - 1) / 2;
  const fogli = ordinati.slice(0, quanti).map((voce, indice) => {
    const [x, y, rotazione] = posti[indice];
    return {
      kit: voce,
      x,
      y,
      rotazione,
      livello: 10 - Math.round(Math.abs(indice - centro) * 2),
      apertura: Math.round((indice - centro) * 9),
    };
  });
  return { fogli, altri: ordinati.length - quanti };
};
