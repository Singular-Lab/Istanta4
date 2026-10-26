import crypto from "crypto";
import { describe, expect, it } from "vitest";
import catalog from "../utility/data/coopfi-organigramma.json";

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

describe("coopfi policy catalog integrity", () => {
  it("keeps legacy counts and mandatory sections", () => {
    expect(catalog.ruoli.length).toBe(57);
    expect(catalog.aree.length).toBe(37);
    expect(catalog.settori.length).toBe(337);
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

    expect(roleDigest).toBe("64bc1ed3f1f38f77faf1b49507db6b4fdf6bb77d99f69bf95b169886792cd318");
    expect(areaDigest).toBe("78c38b6bdc0f62e8b339ca4e0ad2a8c8e73ffc0c8f82d47b2f475a2452064b22");
    expect(settoreDigest).toBe("2bd7c17c0f8d9a3d9df490024d2792e2df5fb41427dcfdde99849f7d56a69655");
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

