// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { matchRoutes, type RouteObject } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/AppErrorFallback", () => ({ RouteErrorFallback: () => null }));
vi.mock("@/components/ErrorPage", () => ({ default: () => null }));
vi.mock("@/components/NotFoundPage", () => ({ default: () => null }));
// Al posto della pagina vera, un componente che usa il contesto come fa BoxRef dopo la scansione
vi.mock("@/pages/BarCodeReader", async () => {
  const { useGestioneReferenze } = await import("@/context/GestioneReferenzeContext");
  return {
    default: function LettoreFinto() {
      useGestioneReferenze();
      return <div>lettore pronto</div>;
    },
  };
});

import routes from ".";

describe("rotta /barcode-reader del layout principale", () => {
  it("fornisce il contesto delle referenze usato da BoxRef", async () => {
    const route = matchRoutes(routes, "/barcode-reader")!.at(-1)!.route as RouteObject;
    const { Component } = await (route.lazy as () => Promise<Partial<RouteObject>>)();

    render(<>{Component && <Component />}</>);

    expect(screen.getByText("lettore pronto")).toBeInTheDocument();
  });
});
