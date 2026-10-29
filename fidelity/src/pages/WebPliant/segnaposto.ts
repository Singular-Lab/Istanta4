/**
 * Segnaposto locale per le immagini mancanti del volantino, al posto di https://placehold.co:
 * niente richiesta a un dominio esterno per ogni card o banner senza immagine.
 * Stesso grigio di placehold.co, senza scritte.
 */
export function segnapostoImmagine(larghezza: number, altezza: number = larghezza): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${larghezza}' height='${altezza}' ` +
    `viewBox='0 0 ${larghezza} ${altezza}'><rect width='100%' height='100%' fill='#dddddd'/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Il segnaposto come valore CSS (background, background-image). */
export function segnapostoCss(larghezza: number, altezza: number = larghezza): string {
  return `url("${segnapostoImmagine(larghezza, altezza)}")`;
}
