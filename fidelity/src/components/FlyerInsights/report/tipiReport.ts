/**
 * Tipi condivisi fra il bottone (caricato con la pagina) e il modulo pesante del report PDF
 * (caricato al click): solo tipi, nessun codice.
 */

/** Immagini gia' pronte per @react-pdf, che non legge il WebP di Olimpo. */
export interface ImmaginiReport {
  /**
   * JPEG (data URI) della prima pagina rifilata, per la miniatura della copertina; null: pagina
   * bianca con i soli riquadri dei box.
   */
  copertina: string | null;
}
