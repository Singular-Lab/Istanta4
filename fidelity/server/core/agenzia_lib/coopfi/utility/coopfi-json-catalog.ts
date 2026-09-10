import type { AgenziaPolicyCatalog } from "../../policy-v2/types.js";
import rawCoopfiOrganigramma from "./data/coopfi-organigramma.json";

function assertCatalogShape(value: unknown): asserts value is AgenziaPolicyCatalog {
  if (!value || typeof value !== "object") {
    throw new Error("Catalogo Coopfi non valido: payload assente o non oggetto");
  }

  const typed = value as Partial<AgenziaPolicyCatalog>;

  if (!Array.isArray(typed.ruoli) || !Array.isArray(typed.aree) || !Array.isArray(typed.settori)) {
    throw new Error("Catalogo Coopfi non valido: sezioni ruoli/aree/settori mancanti");
  }
}

assertCatalogShape(rawCoopfiOrganigramma);

export const coopfiOrganigrammaCatalog: AgenziaPolicyCatalog = rawCoopfiOrganigramma;
