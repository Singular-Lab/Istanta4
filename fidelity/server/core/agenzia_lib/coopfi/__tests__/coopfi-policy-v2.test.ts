import { describe, expect, it } from "vitest";
import { coopfiOrganigrammaCatalog } from "../utility/coopfi-json-catalog";
import { buildCoopfiPolicyFromCodeV2 } from "../utility/coopfi-policy-v2";

function buildCodificaIndex() {
  const index = new Map<string, string>();

  for (const ruolo of coopfiOrganigrammaCatalog.ruoli) {
    index.set(ruolo.code, ruolo.codificaFico);
  }

  for (const area of coopfiOrganigrammaCatalog.aree) {
    index.set(area.code, area.codificaFico);
  }

  for (const settore of coopfiOrganigrammaCatalog.settori) {
    index.set(settore.code, settore.codificaFico);
  }

  return index;
}

describe("coopfi policy v2 fixture", () => {
  it("builds expected tree for multi-settore + area", () => {
    const result = buildCoopfiPolicyFromCodeV2("ALD_OFCAPETDM");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.roleCode).toBe("ALD");
    expect(result.areaCode).toBe("TDM");
    expect(result.repartoCodes).toEqual(["OF", "CAPE"]);
    expect(result.finalSettori).toEqual(["ortofrutta", "macelleria", "pescheria"]);

    //I reparti sono fratelli sotto il settore; l'area si attacca all'ultimo reparto
    //incontrato, come descritto dal commento in coopfi-policy-v2.ts.
    expect(result.tree[0].nodeType).toBe("Settore");
    expect(result.tree[0].children[0].nodeType).toBe("Reparto");
    expect(result.tree[0].children[0].nodeValue).toBe("OF");
    expect(result.tree[0].children[1].nodeType).toBe("Reparto");
    expect(result.tree[0].children[1].nodeValue).toBe("CAPE");
    expect(result.tree[0].children[1].children[0].nodeType).toBe("Area");
    expect(result.tree[0].children[1].children[0].nodeValue).toBe("TDM");
  });

  it("uses codificaFICO from catalog for all tree nodes", () => {
    const result = buildCoopfiPolicyFromCodeV2("ALD_OFCAPETDM");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const codificaIndex = buildCodificaIndex();
    const stack = [...result.tree];

    while (stack.length > 0) {
      const node = stack.pop()!;
      const expectedCodifica = codificaIndex.get(node.nodeValue) ?? "";
      expect(node.codificaFICO).toBe(expectedCodifica);
      stack.push(...node.children);
    }
  });

  it("returns strict failure for unknown role", () => {
    const result = buildCoopfiPolicyFromCodeV2("ZZZ_OF");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("ROLE_NOT_FOUND");
  });
});
