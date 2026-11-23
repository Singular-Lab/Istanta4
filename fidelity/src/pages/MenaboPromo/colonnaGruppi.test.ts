import { describe, expect, it, vi } from "vitest";

// La pagina si importa per i soli calcoli: il controllo della sessione non serve qui.
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));

import {
    COLONNA_GRUPPI_MINIMA,
    COLONNA_GRUPPI_STANDARD,
    larghezzaColonnaGruppi,
} from "./index";

// I20-1258: la colonna dei gruppi del menabò ridimensionabile (spec menabo-promo, solo per i clienti
// la cui libreria agenzia lo dichiara): fra 240 pixel e il 70% della finestra.
describe("menabò: larghezza della colonna dei gruppi", () => {
    it("parte dalla larghezza di sempre, 384 pixel, e non scende sotto i 240", () => {
        expect(COLONNA_GRUPPI_STANDARD).toBe(384);
        expect(COLONNA_GRUPPI_MINIMA).toBe(240);
        expect(larghezzaColonnaGruppi(100, 1920)).toBe(240);
    });

    it("si allarga fin dove serve, entro il 70% della finestra", () => {
        expect(larghezzaColonnaGruppi(620, 1920)).toBe(620);
        expect(larghezzaColonnaGruppi(1600, 1920)).toBe(1344);
    });

    it("in una finestra stretta il 70% non scende comunque sotto il minimo", () => {
        expect(larghezzaColonnaGruppi(500, 300)).toBe(240);
    });

    it("un valore salvato non valido torna alla larghezza standard", () => {
        expect(larghezzaColonnaGruppi(Number.NaN, 1920)).toBe(384);
        expect(larghezzaColonnaGruppi(Number("abc"), 1920)).toBe(384);
    });

    it("arrotonda ai pixel interi", () => {
        expect(larghezzaColonnaGruppi(450.6, 1920)).toBe(451);
    });
});
