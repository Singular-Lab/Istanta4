import { describe, expect, it } from "vitest";
import config from "../../tailwind.config.js";

const tema = (config as { theme: { extend: Record<string, Record<string, unknown>> } }).theme.extend;

describe("token del design system", () => {
  it("definisce la scala tipografica piccola al posto di xxs", () => {
    expect(tema.fontSize).toHaveProperty("3xs");
    expect(tema.fontSize).toHaveProperty("2xs");
    expect(tema.fontSize).not.toHaveProperty("xxs");
  });

  it("definisce raggi e ombre con nomi propri, senza alterare quelli di Tailwind", () => {
    expect(Object.keys(tema.borderRadius).sort()).toEqual(["card", "control"]);
    expect(Object.keys(tema.boxShadow).sort()).toEqual(["card", "overlay"]);
  });

  it("usa slate come neutro", () => {
    expect((tema.colors.neutral as Record<string, string>)[500]).toBe("#64748b");
  });
});
