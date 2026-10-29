/**
 * Codice di una referenza pronto per il confronto. Un codice arrivato come numero
 * (es. 12345 da Excel) vale la sua forma testuale, senza perdere cifre: altrimenti
 * uscirebbe in silenzio dal confronto. null, undefined e gli altri tipi valgono "".
 */
export const normalizeCode = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const isGroupByScattoCodice = (record: { scatto_codice?: unknown; codice_referenza?: unknown }): boolean => {
  const scattoCodice = normalizeCode(record.scatto_codice);
  const codiceReferenza = normalizeCode(record.codice_referenza);
  return scattoCodice.length > 0 && scattoCodice !== codiceReferenza;
};

export function resolveGroupMembersFromScattoCodice(scattoCodice: unknown, codiceReferenza: unknown): string[] {
  const scatto = normalizeCode(scattoCodice);
  const codice = normalizeCode(codiceReferenza);
  if (!scatto || scatto === codice) return [];
  const membriUnici = new Set(scatto.split(",").map(item => item.trim()).filter(Boolean));
  return [...membriUnici];
}

export function removeSinglesIncludedInGroups(
  primMap: Map<string, { codice_referenza?: unknown; scatto_codice?: unknown; tipo?: unknown }>,
  secMap: Map<string, { codice_referenza?: unknown; scatto_codice?: unknown; tipo?: unknown }>,
  externalGroupedCodes?: Set<string>,
): void {
  let groupedCodes: Set<string>;
  if (externalGroupedCodes) {
    groupedCodes = externalGroupedCodes;
  } else {
    groupedCodes = new Set<string>();
    for (const rec of [...primMap.values(), ...secMap.values()]) {
      for (const codice of resolveGroupMembersFromScattoCodice(rec.scatto_codice, rec.codice_referenza)) {
        groupedCodes.add(codice);
      }
    }
  }
  if (groupedCodes.size === 0) return;
  const prune = (map: Map<string, { codice_referenza?: unknown; scatto_codice?: unknown; tipo?: unknown }>) => {
    for (const [codiceRef, rec] of map.entries()) {
      if (!isGroupByScattoCodice(rec) && groupedCodes.has(codiceRef)) map.delete(codiceRef);
    }
  };
  prune(primMap);
  prune(secMap);
}
