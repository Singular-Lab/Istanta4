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
