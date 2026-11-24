/**
 * Le pagine dell'anteprima PDF: quelle che si vedono (la copertina da sola, poi a due a due) e quelle da
 * scaricare prima che servano, cioè le aperture subito prima e subito dopo.
 */

/** Le pagine mostrate: la copertina sola, altrimenti la pagina corrente e la successiva se c'è. */
export function pagineVisibili(paginaCorrente: number, copertina: boolean, totale: number): number[] {
    if (copertina) return [1];
    const destra = paginaCorrente + 1 <= totale ? paginaCorrente + 1 : null;
    return destra ? [paginaCorrente, destra] : [paginaCorrente];
}

/** Le pagine visibili più quelle delle due aperture vicine, senza uscire da 1..totale e senza doppioni. */
export function pagineDaPrecaricare(paginaCorrente: number, copertina: boolean, totale: number): number[] {
    const visibili = pagineVisibili(paginaCorrente, copertina, totale);
    const successiva = copertina ? 2 : paginaCorrente + 2;
    const precedente = copertina ? null : paginaCorrente === 2 ? 1 : paginaCorrente - 2;
    const vicine = [
        ...(precedente !== null ? [precedente, precedente + 1] : []),
        successiva,
        successiva + 1,
    ];
    const tutte = [...visibili, ...vicine].filter(pagina => Number.isInteger(pagina) && pagina >= 1 && pagina <= totale);
    return Array.from(new Set(tutte));
}
