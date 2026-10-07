export interface PuntoVenditaTextInput {
    nome?: string;
    citta?: string;
    cap?: string;
    provincia?: string;
    regione?: string;
    indirizzo?: string;
    telefono?: string;
    lat?: number;
    lon?: number;
}

export interface PuntoVenditaNormalizedKey {
    nome: string;
    citta: string;
    indirizzo: string;
    telefono: string;
    value: string;
}

/** Normalizza testo umano senza perdere la separazione tra parole. */
export function normalizePuntoVenditaText(value: unknown): string {
    return String(value ?? "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleUpperCase("it-IT")
        .replace(/[’'`]/g, "")
        .replace(/&/g, " E ")
        .replace(/[^A-Z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

/** I telefoni si confrontano sulle sole cifre: prefissi e separatori non contano. */
export function normalizePuntoVenditaPhone(value: unknown): string {
    const digits = String(value ?? "").replace(/\D/g, "");
    return digits.startsWith("39") && digits.length === 11 ? digits.slice(2) : digits;
}

export function buildPuntoVenditaKey(input: PuntoVenditaTextInput): PuntoVenditaNormalizedKey {
    const key = {
        nome: normalizePuntoVenditaText(input.nome),
        citta: normalizePuntoVenditaText(input.citta),
        indirizzo: normalizePuntoVenditaText(input.indirizzo),
        telefono: normalizePuntoVenditaPhone(input.telefono),
    };
    return { ...key, value: [key.citta, key.indirizzo, key.telefono].join("|") };
}

function editDistance(left: string, right: string): number {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let row = 1; row <= left.length; row++) {
        const current = [row];
        for (let column = 1; column <= right.length; column++) {
            current[column] = left[row - 1] === right[column - 1]
                ? previous[column - 1]
                : Math.min(previous[column - 1], previous[column], current[column - 1]) + 1;
        }
        for (let column = 0; column <= right.length; column++) previous[column] = current[column];
    }
    return previous[right.length];
}

/** Segnala un possibile doppione senza fondere automaticamente due anagrafiche. */
export function isLikelySamePuntoVendita(
    left: PuntoVenditaTextInput,
    right: PuntoVenditaTextInput,
): boolean {
    const first = buildPuntoVenditaKey(left);
    const second = buildPuntoVenditaKey(right);
    if (first.citta !== second.citta) return false;
    if (first.telefono && first.telefono === second.telefono) return true;
    if (!first.indirizzo || !second.indirizzo) return false;
    return editDistance(first.indirizzo, second.indirizzo) <= 1;
}

/** Il dato nuovo non sposta il PV: citta e indirizzo uguali, o vuoti perche non vanno a sovrascrivere niente. */
export function stessaPosizione(nuovo: PuntoVenditaTextInput, attuale: PuntoVenditaTextInput): boolean {
    const first = buildPuntoVenditaKey(nuovo);
    const second = buildPuntoVenditaKey(attuale);
    return (!first.citta || first.citta === second.citta)
        && (!first.indirizzo || first.indirizzo === second.indirizzo);
}
