// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CodeBlock, DocsBreadcrumb, DocsCapitolo, DocsGuida } from "./DocsCondivisi";

describe("Componenti condivisi della Documentazione", () => {
  it("il percorso porta all'indice e segna la guida corrente", () => {
    render(
      <MemoryRouter>
        <DocsBreadcrumb corrente="Statistiche" />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Documentazione" })).toHaveAttribute("href", "/documentazione");
    expect(screen.getByText("Statistiche")).toHaveAttribute("aria-current", "page");
  });

  it("il blocco di codice copia il testo negli appunti e lo conferma", async () => {
    const utente = userEvent.setup();
    const scrivi = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    render(<CodeBlock language="cURL" code="curl -X GET /external/promo" />);

    await utente.click(screen.getByRole("button", { name: "Copia" }));

    expect(scrivi).toHaveBeenCalledWith("curl -X GET /external/promo");
    expect(await screen.findByRole("button", { name: "Copiato!" })).toBeInTheDocument();
  });

  it("una guida ha il titolo di pagina, il ritorno all'indice e i capitoli come titoli di sezione", () => {
    render(
      <MemoryRouter>
        <DocsGuida titolo="Guida Rapida" descrizione="Primi passi" corrente="Guida Rapida">
          <DocsCapitolo icona="Info" titolo="Introduzione">
            <p>Testo</p>
          </DocsCapitolo>
        </DocsGuida>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Guida Rapida" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Torna alla documentazione" })).toHaveAttribute("href", "/documentazione");
    expect(screen.getByRole("heading", { level: 2, name: "Introduzione" })).toHaveClass("title-section");
  });
});
