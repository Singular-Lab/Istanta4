import { describe, expect, it } from "vitest";
import { buildPolicyFromCodeV2 } from "../policy-v2/engine";
import type {
  AgenziaPolicyCatalog,
  AgenziaPolicyRules,
} from "../policy-v2/types";

const baseRules: AgenziaPolicyRules = {
  version: 1,
  errorPolicy: "strict_fail",
  expressions: {
    inputRegex: "^(?<role>[^_]+)_(?<body>[^_]+)$",
    groups: {
      role: "role",
      body: "body",
    },
  },
  parsing: {
    normalize: {
      trim: true,
      toUpper: true,
    },
    areaExtraction: {
      mode: "suffix_longest_match",
      required: false,
    },
    settoreTokenization: {
      mode: "deterministic_longest_match",
      allowEmpty: false,
    },
  },
  tree: {
    strategy: "role_area_reparti_siblings",
    nodeTypes: {
      role: "Settore",
      area: "Area",
      reparto: "Reparto",
    },
  },
};

describe("policy-v2 engine", () => {
  it("parses multi-settore under same area and builds siblings tree", () => {
    const catalog: AgenziaPolicyCatalog = {
      version: 1,
      source: "test",
      ruoli: [{ code: "ALD", description: "role", codificaFico: "ALD" }],
      aree: [
        { code: "DM", description: "Area short", codificaFico: "DM" },
        { code: "TDM", description: "Area long", codificaFico: "TDM" },
      ],
      settoriFinali: [
        { code: "ortofrutta", description: "Ortofrutta", codificaFico: "ortofrutta" },
        { code: "macelleria", description: "Macelleria", codificaFico: "macelleria" },
        { code: "pescheria", description: "Pescheria", codificaFico: "pescheria" },
      ],
      settori: [
        { code: "OF", description: "Ortofrutta", codificaFico: "OF", settoriFinali: ["ortofrutta"] },
        { code: "CAPE", description: "Carni e Pescheria", codificaFico: "CAPE", settoriFinali: ["macelleria", "pescheria"] },
      ],
    };

    const result = buildPolicyFromCodeV2("ALD_OFCAPETDM", { catalog, rules: baseRules });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.roleCode).toBe("ALD");
    expect(result.areaCode).toBe("TDM");
    expect(result.repartoCodes).toEqual(["OF", "CAPE"]);
    expect(result.finalSettori).toEqual(["ortofrutta", "macelleria", "pescheria"]);

    expect(result.tree).toEqual([
      {
        nodeType: "Settore",
        nodeValue: "ALD",
        codificaFICO: "ALD",
        children: [
          {
            nodeType: "Area",
            nodeValue: "TDM",
            codificaFICO: "TDM",
            children: [
              {
                nodeType: "Reparto",
                nodeValue: "OF",
                codificaFICO: "OF",
                children: [],
              },
              {
                nodeType: "Reparto",
                nodeValue: "CAPE",
                codificaFICO: "CAPE",
                children: [],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("picks longest area suffix match", () => {
    const catalog: AgenziaPolicyCatalog = {
      version: 1,
      source: "test",
      ruoli: [{ code: "ALD", description: "role", codificaFico: "ALD" }],
      aree: [
        { code: "DM", description: "Area short", codificaFico: "DM" },
        { code: "TDM", description: "Area long", codificaFico: "TDM" },
      ],
      settoriFinali: [{ code: "ortofrutta", description: "Ortofrutta", codificaFico: "ortofrutta" }],
      settori: [{ code: "OF", description: "Ortofrutta", codificaFico: "OF", settoriFinali: ["ortofrutta"] }],
    };

    const result = buildPolicyFromCodeV2("ALD_OFTDM", { catalog, rules: baseRules });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.areaCode).toBe("TDM");
    expect(result.repartoCodes).toEqual(["OF"]);
  });

  it("uses deterministic longest tokenization", () => {
    const catalog: AgenziaPolicyCatalog = {
      version: 1,
      source: "test",
      ruoli: [{ code: "ALD", description: "role", codificaFico: "ALD" }],
      aree: [{ code: "TDM", description: "Area", codificaFico: "TDM" }],
      settoriFinali: [{ code: "x", description: "X", codificaFico: "x" }],
      settori: [
        { code: "AB", description: "AB", codificaFico: "AB", settoriFinali: ["x"] },
        { code: "A", description: "A", codificaFico: "A", settoriFinali: ["x"] },
        { code: "BC", description: "BC", codificaFico: "BC", settoriFinali: ["x"] },
      ],
    };

    const result = buildPolicyFromCodeV2("ALD_ABBCTDM", { catalog, rules: baseRules });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.repartoCodes).toEqual(["AB", "BC"]);
  });

  it("fails in strict mode when segmentation is ambiguous", () => {
    const catalog: AgenziaPolicyCatalog = {
      version: 1,
      source: "test",
      ruoli: [{ code: "ALD", description: "role", codificaFico: "ALD" }],
      aree: [{ code: "TDM", description: "Area", codificaFico: "TDM" }],
      settoriFinali: [{ code: "x", description: "X", codificaFico: "x" }],
      settori: [
        { code: "AB", description: "AB", codificaFico: "AB", settoriFinali: ["x"] },
        { code: "CD", description: "CD", codificaFico: "CD", settoriFinali: ["x"] },
        { code: "AC", description: "AC", codificaFico: "AC", settoriFinali: ["x"] },
        { code: "BD", description: "BD", codificaFico: "BD", settoriFinali: ["x"] },
      ],
    };

    const result = buildPolicyFromCodeV2("ALD_ABCDTDM", { catalog, rules: baseRules });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("AMBIGUOUS_SEGMENTATION");
    expect(result.error.step).toBe("reparto");
  });
});

