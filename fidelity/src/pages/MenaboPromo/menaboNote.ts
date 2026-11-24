/**
 * Task 769e2865: il suggerimento della linguetta delle note di una pagina del menabò: quante sono e la prima
 * riga della prima nota con testo, così si sa di cosa parla senza aprire il pannello.
 */
const LUNGHEZZA_MASSIMA = 60;

export function anteprimaNote(note: ReadonlyArray<{ text: string }>): string {
    const quante = `${note.length} ${note.length === 1 ? "nota" : "note"}`;
    const primaRiga = note
        .map(n => n.text.split(/\r?\n/).map(r => r.trim()).find(r => r.length > 0))
        .find((r): r is string => !!r);
    if (!primaRiga) return `${quante} — clicca per aprire`;
    const breve = primaRiga.length > LUNGHEZZA_MASSIMA ? `${primaRiga.slice(0, LUNGHEZZA_MASSIMA - 1).trimEnd()}…` : primaRiga;
    return `${quante} — «${breve}» · clicca per aprire`;
}
