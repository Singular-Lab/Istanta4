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

export function editDistance(left: string, right: string): number {
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

/*
 * Chiavi con cui un punto vendita stampato nella lista di un volantino si ritrova in anagrafica.
 * Servono solo a confrontare: due scritture dello stesso indirizzo devono dare la stessa chiave,
 * anche quando l'espansione non e' quella "giusta" (S.S. e SS diventano sempre STRADA STATALE).
 */

/** Abbreviazioni sul testo gia' maiuscolo e senza accenti: col punto o attaccate (VLE, CSO). L'ordine conta. */
const ABBREVIAZIONI_INDIRIZZO: Array<[RegExp, string]> = [
    [/\bV(?:\.\s?|)LE\b\.?/g, " VIALE "],
    [/\bC(?:\.\s?|)SO\b\.?/g, " CORSO "],
    [/\bP(?:\.\s?|)ZZETTA\b\.?/g, " PIAZZETTA "],
    [/\bP(?:\.\s?|)Z?ZA\b\.?/g, " PIAZZA "],
    [/\bP(?:\.\s?|)LE\b\.?/g, " PIAZZALE "],
    [/\bL(?:\.\s?|)GO\b\.?/g, " LARGO "],
    [/\bB(?:\.\s?|)GO\b\.?/g, " BORGO "],
    [/\bC(?:\.\s?|)DA\b\.?/g, " CONTRADA "],
    [/\bV(?:\.\s?|)LO\b\.?/g, " VICOLO "],
    [/\bS\.\s?S\.?(?=\s|\d|$)|\bSS\b\.?/g, " STRADA STATALE "],
    [/\bS\.\s?P\.?(?=\s|\d|$)|\bSP\b\.?/g, " STRADA PROVINCIALE "],
    [/\bS\.\s?R\.?(?=\s|\d|$)|\bSR\b\.?/g, " STRADA REGIONALE "],
    [/\bC\.\s?C\.?(?=\s|$)|\bC(?:\.\s?|)COMM(?:LE)?\b\.?/g, " CENTRO COMMERCIALE "],
    [/\bSTR\b\.?/g, " STRADA "],
    [/\bLOC\b\.?/g, " LOCALITA "],
    [/\bFRAZ\b\.?/g, " FRAZIONE "],
    [/\bS\.?\s?N\.?\s?C\b\.?/g, " SNC "],
    // Il numero civico: "n. 12", "nr 12", "n°12"
    [/\bNR?\b\.?\s*°?\s*(?=\d)/g, " "],
    // "V. Roma": la via col punto, dopo V.LE e V.LO
    [/\bV\.\s?(?=[A-Z])/g, " VIA "],
];

/**
 * Chiave dell'indirizzo: maiuscolo, senza accenti ne' punteggiatura, abbreviazioni estese e civico
 * a parole separate ("12/14" come "12 14", "70/e" e "70E" come "70 E"). Null se resta vuota.
 */
export function chiaveIndirizzo(indirizzo: unknown): string | null {
    let testo = String(indirizzo ?? "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleUpperCase("it-IT")
        .replace(/[’'`]/g, "")
        .replace(/(\d)([A-Z])/g, "$1 $2")
        .replace(/([A-Z])(\d)/g, "$1 $2");
    for (const [abbreviazione, estesa] of ABBREVIAZIONI_INDIRIZZO) testo = testo.replace(abbreviazione, estesa);
    const chiave = testo.replace(/&/g, " E ").replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
    return chiave || null;
}

/** Le cifre dei civici di una chiave d'indirizzo ("VIA MURTOLA 12 14" -> "12 14"). */
export function civiciIndirizzo(chiave: string | null): string {
    return (chiave?.match(/\d+/g) ?? []).join(" ");
}

/** Chiave del telefono: solo cifre, senza +39 o 0039. Null sotto le 6 cifre: troppo corta per riconoscere un PV. */
export function chiaveTelefono(telefono: unknown): string | null {
    let cifre = String(telefono ?? "").replace(/\D/g, "");
    if (cifre.startsWith("0039")) cifre = cifre.slice(4);
    else if (cifre.startsWith("39") && cifre.length >= 11) cifre = cifre.slice(2);
    return cifre.length >= 6 ? cifre : null;
}

/** Chiave della localita' o della citta': il testo normalizzato, null se vuoto. */
export function chiaveLocalita(localita: unknown): string | null {
    return normalizePuntoVenditaText(localita) || null;
}
