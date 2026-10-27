// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { matchRoutes, type RouteObject } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/AppErrorFallback", () => ({ RouteErrorFallback: () => <div>errore operatore</div> }));
vi.mock("@/components/ErrorPage", () => ({ default: () => null }));
vi.mock("@/components/NotFoundPage", () => ({ default: () => <div>404 operatore</div> }));

import routes from ".";

describe("stati della vetrina /webpliant", () => {
  it("una pagina inesistente della vetrina mostra la 404 nel tema pubblico, non quella operatore", async () => {
    const route = matchRoutes(routes, "/webpliant/pagina-che-non-esiste")!.at(-1)!.route as RouteObject;

    render(<>{route.errorElement}</>);

    expect(await screen.findByText("Pagina non trovata")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Torna alla vetrina" })).toHaveAttribute("href", "/webpliant");
    expect(screen.queryByText("404 operatore")).not.toBeInTheDocument();
  });

  it("un errore di caricamento della vetrina resta nel tema pubblico e permette di riprovare", async () => {
    const route = routes.find((r) => r.path === "/webpliant")!;

    render(<>{route.errorElement}</>);

    expect(await screen.findByRole("alert")).toHaveTextContent("Non è stato possibile caricare la pagina");
    expect(screen.getByRole("button", { name: "Ricarica la pagina" })).toBeInTheDocument();
    expect(screen.queryByText("errore operatore")).not.toBeInTheDocument();
  });
});
