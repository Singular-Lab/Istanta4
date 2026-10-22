/**
 * Selezione di un gruppo nel menabò (spec fidelity/menabo-promo). Un gruppo collocato su più
 * pagine compare come una porzione per pagina, tutte con lo stesso id: la selezione ricorda
 * anche la pagina cliccata, e l'anteprima mostra solo le referenze di quella porzione.
 */

interface PorzioneDiGruppo<R> {
    groupId: string;
    pageIndex: number;
    records: R[];
}

/**
 * Le referenze del gruppo collocate sulla pagina selezionata. Se la pagina non è nota, o il
 * gruppo non vi compare più (per esempio dopo che le pagine si sono riassestate), restituisce
 * tutte le referenze del gruppo in ordine di pagina.
 */
export function referenzeDellaPagina<R>(
    pagine: ReadonlyArray<ReadonlyArray<PorzioneDiGruppo<R>>>,
    groupId: string,
    pageIndex: number | null,
): R[] {
    const porzioni = pagine.flatMap(porzioniPagina => porzioniPagina.filter(porzione => porzione.groupId === groupId));
    const dellaPagina = pageIndex === null ? [] : porzioni.filter(porzione => porzione.pageIndex === pageIndex);
    return (dellaPagina.length > 0 ? dellaPagina : porzioni).flatMap(porzione => porzione.records);
}

/** Le pagine (numerate da 1) su cui il gruppo è collocato, in ordine. */
export function pagineDelGruppo(
    pagine: ReadonlyArray<ReadonlyArray<{ groupId: string; pageIndex: number }>>,
    groupId: string,
): number[] {
    return Array.from(
        new Set(pagine.flatMap(porzioni => porzioni.filter(p => p.groupId === groupId).map(p => p.pageIndex + 1))),
    ).sort((a, b) => a - b);
}
