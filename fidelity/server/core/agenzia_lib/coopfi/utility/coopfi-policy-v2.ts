import type { OlympusUserPolicyRuolo } from "../../../../../lib/types.js";
import type { PolicyBuildResultV2 } from "../../policy-v2/types.js";
import { log } from "../../../logger/index.js";
import { AuditLogService } from "../../../services/AuditLogService.js";
import { coopfiOrganigrammaCatalog } from "./coopfi-json-catalog.js";

const { aree, ruoli, settori } = coopfiOrganigrammaCatalog;
const settoriSorted = [...settori].sort((a, b) => b.code.length - a.code.length);
const areeSorted = [...aree].sort((a, b) => b.code.length - a.code.length);

const FAILURE_BASE = {
  ok: false as const,
  tree: [] as OlympusUserPolicyRuolo[],
  roleCode: null,
  areaCode: null,
  repartoCodes: [] as string[],
  finalSettori: [] as string[],
};

export function buildCoopfiPolicyFromCodeV2(
  codicePosizione: string | null | undefined,
): PolicyBuildResultV2 {
  if (!codicePosizione) {
    return {
      ...FAILURE_BASE,
      error: {
        code: "INVALID_INPUT",
        step: "normalize",
        message: "Codice posizione mancante",
        input: "",
      },
    };
  }

  const ruoloPart = codicePosizione.split("_")[0].toUpperCase();
  let remainingCode = (codicePosizione.split("_")[1] ?? "").toUpperCase();

  const foundRuolo = ruoli.find(r => r.code === ruoloPart);
  if (!foundRuolo) {
    return {
      ...FAILURE_BASE,
      error: {
        code: "ROLE_NOT_FOUND",
        step: "role",
        message: `Ruolo non trovato: ${ruoloPart}`,
        input: codicePosizione,
      },
    };
  }

  // Build tree with recursive backtracking (longest match first, area attached under its preceding reparto)
  const root: OlympusUserPolicyRuolo = {
    nodeType: "Settore",
    nodeValue: ruoloPart,
    codificaFICO: foundRuolo.codificaFico,
    children: [],
  };

  let repartoCorrente: OlympusUserPolicyRuolo | null = null;

  const costruisciAlberoRecursivo = (tree: OlympusUserPolicyRuolo): boolean => {
    if (remainingCode.length === 0) return true;

    for (const settore of settoriSorted) {
      if (!remainingCode.startsWith(settore.code)) continue;
      const savedCodice = remainingCode;
      const savedReparto = repartoCorrente;
      remainingCode = remainingCode.slice(settore.code.length);
      const nodo: OlympusUserPolicyRuolo = {
        nodeType: "Reparto",
        nodeValue: settore.code,
        codificaFICO: settore.codificaFico,
        children: [],
      };
      tree.children.push(nodo);
      repartoCorrente = nodo;
      if (costruisciAlberoRecursivo(tree)) return true;
      // backtrack
      tree.children.pop();
      remainingCode = savedCodice;
      repartoCorrente = savedReparto;
    }

    for (const area of areeSorted) {
      if (!remainingCode.startsWith(area.code)) continue;
      const savedCodice = remainingCode;
      const savedReparto = repartoCorrente;
      remainingCode = remainingCode.slice(area.code.length);
      (repartoCorrente ?? tree).children.push({
        nodeType: "Area",
        nodeValue: area.code,
        codificaFICO: area.codificaFico,
        children: [],
      });
      if (costruisciAlberoRecursivo(tree)) return true;
      // backtrack
      (repartoCorrente ?? tree).children.pop();
      remainingCode = savedCodice;
      repartoCorrente = savedReparto;
    }

    return false;
  };

  costruisciAlberoRecursivo(root);

  // Extract metadata by traversing the built tree
  const repartoCodes: string[] = [];
  const finalSettori: string[] = [];
  let areaCode: string | null = null;

  for (const child of root.children) {
    if (child.nodeType === "Reparto") {
      repartoCodes.push(child.nodeValue);
      const settore = settori.find(s => s.code === child.nodeValue);
      finalSettori.push(...(settore?.settoriFinali ?? []));
      const areaChild = child.children.find(c => c.nodeType === "Area");
      if (areaChild && !areaCode) areaCode = areaChild.nodeValue;
    } else if (child.nodeType === "Area" && !areaCode) {
      areaCode = child.nodeValue;
    }
  }

  if (root.children.length === 0) {
    log.warn(
      "[buildCoopfiPolicyFromCodeV2] Nessun nodo derivato dal codice posizione: il codice contiene token non riconosciuti nell'organigramma Coopfi",
      {
        codicePosizione,
        ruoloPart,
        codiceSenzaRuolo: codicePosizione.split("_")[1]?.toUpperCase(),
      }
    );
    AuditLogService.getInstance().systemError(undefined, "COOPFI_POLICY_BUILD_FAILED", {
      codicePosizione,
      ruoloPart,
      codiceSenzaRuolo: codicePosizione.split("_")[1]?.toUpperCase(),
      motivo: "Nessun nodo settore/reparto/area riconosciuto nell'organigramma Coopfi",
    });
  }

  return {
    ok: true,
    tree: [root],
    roleCode: ruoloPart,
    areaCode,
    repartoCodes,
    finalSettori,
    error: null,
  };
}
