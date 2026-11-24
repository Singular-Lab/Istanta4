/**
 * Unione di gruppi del menabò (spec fidelity/menabo-promo, "Unione di gruppi in un solo ordine
 * merceologico"). Un'unione è l'insieme dei gruppi che hanno lo stesso `unioneId`: per il Plugin le loro
 * referenze seguono un solo ordine merceologico. L'unione sta sul gruppo intero, quindi vale su tutte le
 * pagine in cui il gruppo è collocato. Un'unione ha sempre almeno due gruppi: quando ne resta uno solo si
 * scioglie da sola.
 */

interface ElementoUnibile {
    groupId: string;
    unioneId?: string;
}

/** I gruppi (non le porzioni per pagina) dell'unione, nell'ordine in cui compaiono. */
export function gruppiDellUnione<T extends ElementoUnibile>(elementi: readonly T[], unioneId: string | undefined): string[] {
    if (!unioneId) return [];
    return Array.from(new Set(elementi.filter(e => e.unioneId === unioneId).map(e => e.groupId)));
}

/** Toglie le unioni rimaste con un solo gruppo. */
function sciogliUnioniIncomplete<T extends ElementoUnibile>(elementi: readonly T[]): T[] {
    const gruppiPerUnione = new Map<string, Set<string>>();
    for (const e of elementi) {
        if (!e.unioneId) continue;
        const gruppi = gruppiPerUnione.get(e.unioneId) ?? new Set<string>();
        gruppi.add(e.groupId);
        gruppiPerUnione.set(e.unioneId, gruppi);
    }
    return elementi.map(e => {
        if (!e.unioneId || (gruppiPerUnione.get(e.unioneId)?.size ?? 0) >= 2) return e;
        const { unioneId: _tolto, ...senzaUnione } = e;
        return senzaUnione as T;
    });
}

/**
 * Unisce i gruppi indicati: se uno di loro è già in un'unione, anche tutti i gruppi di quell'unione
 * entrano in quella nuova. Con meno di due gruppi non cambia niente.
 */
export function unisciGruppi<T extends ElementoUnibile>(
    elementi: readonly T[],
    groupIds: readonly string[],
    nuovoUnioneId: string,
): T[] {
    const scelti = new Set(groupIds);
    if (scelti.size < 2) return [...elementi];
    const unioniCoinvolte = new Set(
        elementi.filter(e => scelti.has(e.groupId) && e.unioneId).map(e => e.unioneId as string),
    );
    return elementi.map(e =>
        scelti.has(e.groupId) || (e.unioneId && unioniCoinvolte.has(e.unioneId))
            ? { ...e, unioneId: nuovoUnioneId }
            : e,
    );
}

/** Scioglie l'unione: i suoi gruppi tornano ognuno con il proprio ordine. */
export function sciogliUnione<T extends ElementoUnibile>(elementi: readonly T[], unioneId: string): T[] {
    return elementi.map(e => {
        if (e.unioneId !== unioneId) return e;
        const { unioneId: _tolto, ...senzaUnione } = e;
        return senzaUnione as T;
    });
}

/** Toglie un gruppo dalla sua unione (per esempio perché viene tolto dal menabò). */
export function togliGruppoDallUnione<T extends ElementoUnibile>(elementi: readonly T[], groupId: string): T[] {
    return sciogliUnioniIncomplete(
        elementi.map(e => {
            if (e.groupId !== groupId || !e.unioneId) return e;
            const { unioneId: _tolto, ...senzaUnione } = e;
            return senzaUnione as T;
        }),
    );
}

/** Dopo che alcuni gruppi sono stati tolti dal menabò: le unioni rimaste con un solo gruppo si sciolgono. */
export function normalizzaUnioni<T extends ElementoUnibile>(elementi: readonly T[]): T[] {
    return sciogliUnioniIncomplete(elementi);
}

export function nuovoUnioneId(): string {
    return `unione-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Numero progressivo di ogni unione, nell'ordine in cui compare per prima: l'operatore legge «Unione 1»,
 * «Unione 2» invece di un identificativo, e lo stesso numero vale su tutte le pagine del gruppo.
 */
export function numeroDelleUnioni<T extends ElementoUnibile>(elementi: readonly T[]): Map<string, number> {
    const numeri = new Map<string, number>();
    for (const e of elementi) {
        if (e.unioneId && !numeri.has(e.unioneId)) numeri.set(e.unioneId, numeri.size + 1);
    }
    return numeri;
}

/** Una serie di schede consecutive della pagina: della stessa unione, oppure una scheda sola non unita. */
export interface BloccoDiSchede {
    unioneId?: string;
    /** Gli indici delle schede, nell'ordine in cui compaiono nella pagina. */
    indici: number[];
}

/**
 * Raggruppa le schede della pagina in blocchi: le schede unite consecutive della stessa unione stanno in un
 * blocco solo (il menabò le disegna in un unico riquadro), ogni scheda non unita è un blocco a sé.
 */
export function raggruppaPerUnione(schede: ReadonlyArray<{ unioneId?: string }>): BloccoDiSchede[] {
    const blocchi: BloccoDiSchede[] = [];
    schede.forEach((scheda, i) => {
        const ultimo = blocchi[blocchi.length - 1];
        if (scheda.unioneId && ultimo && ultimo.unioneId === scheda.unioneId) {
            ultimo.indici.push(i);
            return;
        }
        blocchi.push(scheda.unioneId ? { unioneId: scheda.unioneId, indici: [i] } : { indici: [i] });
    });
    return blocchi;
}

/** Gli indici delle altre pagine in cui compare l'unione, in ordine crescente. */
export function altrePagineDellUnione(
    elementi: ReadonlyArray<{ unioneId?: string; pageIndex: number }>,
    unioneId: string | undefined,
    pagina: number,
): number[] {
    if (!unioneId) return [];
    return Array.from(new Set(
        elementi.filter(e => e.unioneId === unioneId && e.pageIndex !== pagina).map(e => e.pageIndex),
    )).sort((a, b) => a - b);
}

/** «→ pag. 6», «← pag. 4», «← pag. 4 · → pag. 6»: dove prosegue l'unione (numeri di pagina da 1). */
export function rimandoAltrePagine(altre: readonly number[], pagina: number): string {
    const prima = altre.filter(p => p < pagina).map(p => p + 1);
    const dopo = altre.filter(p => p > pagina).map(p => p + 1);
    const parti: string[] = [];
    if (prima.length > 0) parti.push(`← pag. ${prima.join(", ")}`);
    if (dopo.length > 0) parti.push(`→ pag. ${dopo.join(", ")}`);
    return parti.join(" · ");
}
