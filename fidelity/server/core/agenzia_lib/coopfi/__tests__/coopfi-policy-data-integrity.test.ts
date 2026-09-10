import crypto from "crypto";
import { describe, expect, it } from "vitest";
import catalog from "../utility/data/coopfi-organigramma.json";

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

describe("coopfi policy catalog integrity", () => {
  it("keeps legacy counts and mandatory sections", () => {
    expect(catalog.ruoli.length).toBe(52);
    expect(catalog.aree.length).toBe(37);
    expect(catalog.settori.length).toBe(335);
    expect(catalog.settoriFinali.length).toBe(14);
  });

  it("preserves legacy code sets and mappings hash", () => {
    const roleDigest = sha256(catalog.ruoli.map((item) => `${item.code}:${item.codificaFico}`).join("|"));
    const areaDigest = sha256(catalog.aree.map((item) => `${item.code}:${item.codificaFico}`).join("|"));
    const settoreDigest = sha256(
      catalog.settori
        .map((item) => `${item.code}:${item.codificaFico}:${(item.settoriFinali ?? []).join(",")}`)
        .join("|")
    );

    expect(roleDigest).toBe("920dc743d809ef18155f5c45ef6c679976789d43974cc45f229be96bb50cca9f");
    expect(areaDigest).toBe("78c38b6bdc0f62e8b339ca4e0ad2a8c8e73ffc0c8f82d47b2f475a2452064b22");
    expect(settoreDigest).toBe("0ffbd33e9a0414e0ef660b97696dd7e46ec7aa6042cba820869e92bd4675fb34");
  });

  it("keeps known duplicates and critical reparto mappings", () => {
    const duplicateCounter = new Map<string, number>();
    for (const settore of catalog.settori) {
      duplicateCounter.set(settore.code, (duplicateCounter.get(settore.code) ?? 0) + 1);
    }

    expect(duplicateCounter.get("SWSC")).toBe(3);
    expect(duplicateCounter.get("POS")).toBe(2);
    expect(duplicateCounter.get("SWA")).toBe(2);

    const of = catalog.settori.find((settore) => settore.code === "OF");
    const cape = catalog.settori.find((settore) => settore.code === "CAPE");
    const tdm = catalog.aree.find((area) => area.code === "TDM");

    expect(of?.settoriFinali).toEqual(["ortofrutta"]);
    expect(cape?.settoriFinali).toEqual(["macelleria", "pescheria"]);
    expect(tdm?.codificaFico).toBe("TDM");
  });

  it("ensures every record has codificaFico valorizzata", () => {
    const allCatalogSections = [
      ...catalog.ruoli,
      ...catalog.aree,
      ...catalog.settori,
      ...catalog.settoriFinali,
    ];

    for (const item of allCatalogSections) {
      expect(typeof item.codificaFico).toBe("string");
      expect(item.codificaFico.length).toBeGreaterThan(0);
    }
  });
});

