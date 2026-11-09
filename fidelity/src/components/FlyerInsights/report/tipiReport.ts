/**
 * Tipi condivisi fra il bottone (caricato con la pagina) e il modulo pesante del report PDF
 * (caricato al click): solo tipi, nessun codice.
 */

/** Immagini gia' pronte per @react-pdf, che non legge il WebP di Olimpo. */
export interface ImmaginiReport {
  /** JPEG (data URI) della pagina rifilata, per numero di pagina; null o assente: pagina bianca con i soli riquadri. */
  pagine: ReadonlyMap<number, string | null>;
  /**
   * Mappa di calore (PNG trasparente, data URI) da sovrapporre alla pagina: per indice della sezione
   * 'pagine' in report.sezioni, poi per numero di pagina. Una pagina senza valori non ce l'ha.
   */
  calore: ReadonlyMap<number, ReadonlyMap<number, string>>;
}

/** Avanzamento del caricamento delle immagini delle pagine. */
export interface AvanzamentoImmagini {
  fatte: number;
  totale: number;
}

export type AlAvanzamento = (avanzamento: AvanzamentoImmagini) => void;
