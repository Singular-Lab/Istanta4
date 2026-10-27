import { describe, expect, it } from "vitest";
import { twMerge } from "./twMerge";

describe("twMerge con i token del tema", () => {
  it("un raggio passato dopo sostituisce il token rounded-control", () => {
    expect(twMerge("rounded-control px-3", "rounded-full")).toBe("px-3 rounded-full");
  });

  it("un token del tema passato dopo sostituisce un raggio di Tailwind", () => {
    expect(twMerge("rounded-md", "rounded-card")).toBe("rounded-card");
  });

  it("le ombre del tema si sostituiscono a vicenda", () => {
    expect(twMerge("shadow-card", "shadow-overlay")).toBe("shadow-overlay");
  });

  it("le dimensioni di testo del tema non cancellano il colore del testo", () => {
    expect(twMerge("text-2xs text-slate-500")).toBe("text-2xs text-slate-500");
  });
});
