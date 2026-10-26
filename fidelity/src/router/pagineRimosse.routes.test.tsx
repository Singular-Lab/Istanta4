// @vitest-environment jsdom
import { matchRoutes, type RouteObject } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/AppErrorFallback", () => ({ RouteErrorFallback: () => null }));
vi.mock("@/components/ErrorPage", () => ({ default: () => null }));
vi.mock("@/components/NotFoundPage", () => ({ default: () => null }));

import routes from ".";

const rotta = (percorso: string) => matchRoutes(routes, percorso)!.at(-1)!.route as RouteObject;

describe("pagine rimosse", () => {
  it("/promozioni porta alle promozioni in corso", async () => {
    const risposta = (await (rotta("/promozioni").loader as any)({})) as Response;

    expect(risposta.status).toBe(302);
    expect(risposta.headers.get("Location")).toBe("/promozioni/in-corso");
  });

  it("la conferma dell'opt-in WhatsApp non esiste più", () => {
    expect(rotta("/whatsapp/confirm-opt-in/gdo-1").path).toBe("*");
  });
});
