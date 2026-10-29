// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReferenzeIstanta } from "../../../../lib/types";

const finti = vi.hoisted(() => ({ gestoriMontati: 0, dispatch: vi.fn() }));

vi.mock("../../../../lib/server_call", () => ({ ServerCall: { put: vi.fn() } }));
vi.mock("@/stores/hooks", () => ({ useAppDispatch: () => finti.dispatch }));
vi.mock("@/context/GestioneReferenzeContext", () => ({ useGestioneReferenze: () => ({ setReferenza: vi.fn() }) }));
vi.mock("@/stores/webpliantParamsStore", () => ({ useSessionWishlistIdWebpliant: () => "wl-1" }));
vi.mock("@/hooks/useWebpliantParamsManager", () => ({
  useWebpliantParamsManager: () => {
    useEffect(() => {
      finti.gestoriMontati++;
    }, []);
    return {};
  },
}));

import { ConGestoreParametriWebpliant, GestoreParametriPresente } from "../gestoreParametri";
import BoxRef from ".";

const referenza = (codice: string) =>
  ({ foto: ["f"], fotoExtra: [], groupElements: [], dataFields: { codice_referenza: codice } }) as unknown as ReferenzeIstanta;

const card = (codice: string) => <BoxRef key={codice} referenza={referenza(codice)} config={undefined} />;

afterEach(() => {
  finti.gestoriMontati = 0;
  finti.dispatch.mockReset();
});

// Ogni card montava un proprio useWebpliantParamsManager (7 effetti, un timer, useLocation): con N
// card N gestori che inizializzavano gli stessi parametri e chiedevano ognuno la sessione
describe("BoxRef e il gestore dei parametri", () => {
  it("sotto il layout del volantino le card non creano gestori", () => {
    render(<GestoreParametriPresente>{["r1", "r2", "r3"].map(card)}</GestoreParametriPresente>);

    expect(finti.gestoriMontati).toBe(0);
  });

  it("in un contenitore fuori dal layout (anteprima dell'editor) c'e un solo gestore per tutte le card", () => {
    render(<ConGestoreParametriWebpliant>{["r1", "r2", "r3"].map(card)}</ConGestoreParametriWebpliant>);

    expect(finti.gestoriMontati).toBe(1);
  });

  it("una card da sola fuori dal volantino (lettore di codici a barre) ha ancora il suo gestore", () => {
    render(card("r1"));

    expect(finti.gestoriMontati).toBe(1);
  });
});
