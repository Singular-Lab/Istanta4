/**
 * Mappa da codice settorioFinale (organigramma CoopFi) → nomi reparto usati in
 * TracciatoWidgetScoreboardRow.reparto (valori di COOPFI_REPARTO_MAP).
 *
 * I codici settoriFinali arrivano da GlobalUserFilter.settoriFinali (es. "pescheria",
 * "drogheria_1") mentre row.reparto usa i valori del COOPFI_REPARTO_MAP (es. "Pescheria",
 * "Drogheria 1"). Le descrizioni del catalog non coincidono sempre con i valori del map
 * (es. catalog "Chimica" vs map "Chimica Igiene Casa e Cura Persona"), quindi questa mappa
 * è statica ed esplicita.
 */
export const SETTORE_FINALE_TO_REPARTO_NAMES: Record<string, string[]> = {
    ortofrutta:  ["Ortofrutta"],
    macelleria:  ["Macelleria"],
    gastronomia: ["Gastronomia"],
    pescheria:   ["Pescheria"],
    forneria:    ["Forneria"],
    surgelati:   ["Surgelati"],
    freschi_pls: ["Freschi PLS"],
    drogheria_1: ["Drogheria 1"],
    drogheria_2: ["Drogheria 2"],
    liquidi:     ["Liquidi"],
    chimica:     ["Chimica Igiene Casa e Cura Persona"],
    pet_food:    ["Pet Food"],
    no_food:     ["No Food"],
    marketing:   [],
};

/**
 * Dato un array di codici settoriFinali, restituisce l'insieme deduplicato
 * di nomi reparto da usare per filtrare row.reparto negli scoreboard.
 */
export function resolveRepartoNamesForSettoriFinali(codes: string[]): string[] {
    return [...new Set(codes.flatMap(c => SETTORE_FINALE_TO_REPARTO_NAMES[c] ?? []))];
}
