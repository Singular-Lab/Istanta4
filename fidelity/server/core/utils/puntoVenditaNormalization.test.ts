import { describe, expect, it } from "vitest";
import {
    buildPuntoVenditaKey,
    isLikelySamePuntoVendita,
    normalizePuntoVenditaPhone,
    normalizePuntoVenditaText,
    stessaPosizione,
} from "./puntoVenditaNormalization";

describe("punto vendita normalization", () => {
    it("ignores accents, apostrophes, punctuation and repeated spaces", () => {
        expect(normalizePuntoVenditaText("Loc. Madonna dell’Acqua")).toBe("LOC MADONNA DELLACQUA");
        expect(normalizePuntoVenditaText("  Via   Roma, 10  ")).toBe("VIA ROMA 10");
    });

    it("compares telephone numbers by digits", () => {
        expect(normalizePuntoVenditaPhone("+39 050 890-842")).toBe("050890842");
        expect(normalizePuntoVenditaPhone("050/890842")).toBe("050890842");
    });

    it("does not use the optional display name as identity", () => {
        const first = buildPuntoVenditaKey({
            nome: "Punto vendita storico",
            citta: "PISA",
            indirizzo: "Via Roma 10",
            telefono: "050 123456",
        });
        const second = buildPuntoVenditaKey({
            nome: "Nome diverso",
            citta: "Pisa",
            indirizzo: "Via Roma, 10",
            telefono: "050-123456",
        });
        expect(first.value).toBe(second.value);
    });

    it("flags one-character address typos as possible duplicates", () => {
        expect(isLikelySamePuntoVendita(
            { citta: "Pisa", indirizzo: "Via Roma 10", telefono: "050123456" },
            { citta: "PISA", indirizzo: "Via Roma 11", telefono: "" },
        )).toBe(true);
    });

    it("tells whether the plugin data moves the store, so its coordinates must be recomputed", () => {
        const attuale = { citta: "PISA", indirizzo: "Via Roma, 10" };
        expect(stessaPosizione({ citta: "Pisa", indirizzo: "Via Roma 10", telefono: "050123456" }, attuale)).toBe(true);
        // i campi vuoti non sovrascrivono l'anagrafica, quindi non spostano il PV
        expect(stessaPosizione({ citta: "", indirizzo: "" }, attuale)).toBe(true);
        expect(stessaPosizione({ citta: "Pisa", indirizzo: "Via Roma 11" }, attuale)).toBe(false);
        expect(stessaPosizione({ citta: "Lucca", indirizzo: "Via Roma 10" }, attuale)).toBe(false);
    });
});
