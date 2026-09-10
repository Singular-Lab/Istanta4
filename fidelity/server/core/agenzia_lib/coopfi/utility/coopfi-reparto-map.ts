/**
 * Mappa codice_settore-codice_reparto → nome reparto CoopFi.
 * La chiave è la concatenazione `${codice_settore}-${codice_reparto}`.
 * Fonte: tabella di codifica fornita dal cliente.
 */
export const COOPFI_REPARTO_MAP: Record<string, string> = {
  "58-01": "Ortofrutta",
  // MACELLERIA
  "58-02": "Macelleria",
  "58-03": "Macelleria",
  "58-08": "Macelleria",

  // GASTRONOMIA
  "56-03": "Gastronomia",
  "56-04": "Gastronomia",

  // PESCHERIA
  "58-04": "Pescheria",

  // FORNERIA
  "58-05": "Forneria",
  "58-06": "Forneria",

  // SURGELATI
  "56-01": "Surgelati",

  // FRESCHI PLS
  "56-02": "Freschi PLS",

  // DROGHERIA 1
  "52-01": "Drogheria 1",

  // DROGHERIA 2
  "52-02": "Drogheria 2",

  // LIQUIDI
  "52-03": "Liquidi",

  // CHIMICA IGIENE CASA E CURA PERSONA
  "54-01": "Chimica Igiene Casa e Cura Persona",
  "54-02": "Chimica Igiene Casa e Cura Persona",
  "54-03": "Chimica Igiene Casa e Cura Persona",

  // PET FOOD
  "52-04": "Pet Food",

  // NO FOOD
  "62-02": "No Food",
  "62-07": "No Food",
  "62-09": "No Food",
  "62-11": "No Food",
  "62-12": "No Food",
  "64-01": "No Food",
  "64-02": "No Food",
  "64-03": "No Food",
  "64-04": "No Food",
  "64-05": "No Food",
  "64-06": "No Food",
  "66-01": "No Food",
  "66-03": "No Food",
  "66-06": "No Food",
  "66-07": "No Food",
  "66-09": "No Food",
  "68-01": "No Food",
  "68-06": "No Food",
};

/**
 * Risolve il nome del reparto da un record di tracciato CoopFi.
 * Priorità: COOPFI_REPARTO_MAP via codice_settore-codice_reparto
 *           → codice_reparto grezzo → campo reparto grezzo → "—".
 */
export function resolveRepartoCoopfi(record: Record<string, unknown>): string {
  try {
    const codiceSettore = record["codice_settore"];
    const codiceReparto = record["codice_reparto"];
    const reparto = record["reparto"];

    const sStr = typeof codiceSettore === "string" ? codiceSettore.trim() : "";
    const rStr = typeof codiceReparto === "string" ? codiceReparto.trim() : "";
    if (sStr && rStr) {
      const key = `${sStr}-${rStr}`;
      if (COOPFI_REPARTO_MAP[key]) return COOPFI_REPARTO_MAP[key];
    }

    if (rStr) return rStr;

    // Fallback: usa il campo reparto grezzo del record (es. "Ortofrutta Freschissimi")
    const repartoStr = typeof reparto === "string" ? reparto.trim() : "";
    if (repartoStr) return repartoStr.toTitleCase();

    return "—";
  } catch {
    return "—";
  }
}

/**
 * Restituisce la chiave di raggruppamento per codice settore-reparto.
 * Se i codici non sono presenti nel record, usa il campo reparto grezzo come chiave.
 */
export function getCodiceKeyCoopfi(record: Record<string, unknown>): string {
  const sStr = typeof record["codice_settore"] === "string" ? record["codice_settore"].trim() : "";
  const rStr = typeof record["codice_reparto"] === "string" ? record["codice_reparto"].trim() : "";
  if (sStr && rStr) return `${sStr}-${rStr}`;
  const reparto = typeof record["reparto"] === "string" ? record["reparto"].trim() : "";
  return reparto || "—";
}
