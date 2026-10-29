// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: finti.get } }));

import { SessionWarningModal } from ".";

const DIECI_SECONDI = 10 * 1000;
const UN_MINUTO = 60 * 1000;
const CINQUE_MINUTI = 5 * UN_MINUTO;

let visibilita: DocumentVisibilityState = "visible";

const cambiaVisibilita = (stato: DocumentVisibilityState) => {
  visibilita = stato;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
};

const controlliSessione = () => finti.get.mock.calls.filter(([url]) => url === "/session/info").length;

describe("SessionWarningModal: controllo della sessione", () => {
  beforeEach(() => {
    visibilita = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibilita });
    // Solo gli intervalli sono finti: il dialog usa i timer reali
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    finti.get.mockReset();
    // Sessione lontana dalla scadenza
    finti.get.mockResolvedValue({ success: true, timeRemaining: 60 * UN_MINUTO });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("a scheda visibile controlla subito e poi ogni 10 secondi", () => {
    render(<SessionWarningModal isAuthenticated />);
    expect(controlliSessione()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(2 * DIECI_SECONDI);
    });

    expect(controlliSessione()).toBe(3);
  });

  it("a scheda nascosta dirada i controlli a uno ogni 5 minuti, senza fermarli, e al ritorno controlla subito e riprende ogni 10 secondi", () => {
    render(<SessionWarningModal isAuthenticated />);
    expect(controlliSessione()).toBe(1);

    cambiaVisibilita("hidden");
    act(() => {
      vi.advanceTimersByTime(CINQUE_MINUTI - DIECI_SECONDI);
    });
    // Niente controllo ogni 10 secondi a scheda nascosta
    expect(controlliSessione()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(DIECI_SECONDI);
    });
    // Ma uno ogni 5 minuti: la sessione resta viva come prima
    expect(controlliSessione()).toBe(2);
    act(() => {
      vi.advanceTimersByTime(CINQUE_MINUTI);
    });
    expect(controlliSessione()).toBe(3);

    cambiaVisibilita("visible");
    expect(controlliSessione()).toBe(4);
    act(() => {
      vi.advanceTimersByTime(DIECI_SECONDI);
    });
    expect(controlliSessione()).toBe(5);
  });

  it("aperta in una scheda nascosta controlla all'apertura, come prima, poi ogni 5 minuti finché la scheda resta nascosta", () => {
    visibilita = "hidden";
    render(<SessionWarningModal isAuthenticated />);
    expect(controlliSessione()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(UN_MINUTO);
    });
    expect(controlliSessione()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(CINQUE_MINUTI - UN_MINUTO);
    });
    expect(controlliSessione()).toBe(2);

    cambiaVisibilita("visible");

    expect(controlliSessione()).toBe(3);
  });

  it("senza utente autenticato non controlla", () => {
    render(<SessionWarningModal isAuthenticated={false} />);
    act(() => {
      vi.advanceTimersByTime(UN_MINUTO);
    });

    expect(finti.get).not.toHaveBeenCalled();
  });

  it("a meno di 5 minuti dalla scadenza mostra l'avviso con il tempo rimanente, come prima", async () => {
    finti.get.mockResolvedValue({ success: true, timeRemaining: 4 * UN_MINUTO });

    render(<SessionWarningModal isAuthenticated />);

    expect(await screen.findByText("La tua sessione sta per scadere")).toBeInTheDocument();
    expect(screen.getByText("4:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continua sessione" })).toBeInTheDocument();
  });

  it("con l'avviso aperto, tornando sulla scheda controlla subito: se la sessione è stata estesa altrove l'avviso si chiude", async () => {
    finti.get.mockResolvedValue({ success: true, timeRemaining: 4 * UN_MINUTO });
    render(<SessionWarningModal isAuthenticated />);
    await screen.findByText("La tua sessione sta per scadere");

    cambiaVisibilita("hidden");
    finti.get.mockResolvedValue({ success: true, timeRemaining: 60 * UN_MINUTO });
    cambiaVisibilita("visible");

    await vi.waitFor(() => expect(screen.queryByText("La tua sessione sta per scadere")).not.toBeInTheDocument());
  });
});
