// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { opzioniLitepicker } from "./litepicker";

describe("opzioniLitepicker", () => {
  it("senza lang usa l'italiano, con pulsanti e tooltip tradotti", () => {
    const opzioni = opzioniLitepicker({ singleMode: false });

    expect(opzioni.lang).toBe("it-IT");
    expect(opzioni.buttonText).toMatchObject({ apply: "Applica", cancel: "Annulla" });
    expect(opzioni.tooltipText).toEqual({ one: "giorno", other: "giorni" });
    expect(opzioni.singleMode).toBe(false);
  });

  it("rispetta lang e testi passati dal chiamante", () => {
    const opzioni = opzioniLitepicker({ lang: "en-GB", tooltipText: { one: "night", other: "nights" } });

    expect(opzioni.lang).toBe("en-GB");
    expect(opzioni.tooltipText).toEqual({ one: "night", other: "nights" });
  });
});
