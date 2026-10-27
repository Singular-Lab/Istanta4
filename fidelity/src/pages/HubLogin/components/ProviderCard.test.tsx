// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuthProviderDTO } from "../../../../lib/types";
import ProviderCard from "./ProviderCard";

const provider: AuthProviderDTO = {
  id: "1",
  codice: "azure",
  nome: "Microsoft",
  descrizione: "Accesso aziendale",
  icona: "Building",
  tipo: "oidc",
  ordine: 1,
  attivo: true,
};

describe("ProviderCard", () => {
  it("mostra nome e descrizione del provider e al clic avvisa chi la usa", () => {
    const onClick = vi.fn();
    render(<ProviderCard provider={provider} index={0} onClick={onClick} />);

    const tessera = screen.getByRole("button", { name: /Microsoft/ });
    expect(tessera).toHaveTextContent("Accesso aziendale");
    expect(tessera).toHaveClass("rounded-card");
    fireEvent.click(tessera);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("durante la connessione è disattivata e usa lo spinner comune", () => {
    const { container } = render(<ProviderCard provider={provider} index={0} onClick={vi.fn()} isLoading />);

    const tessera = screen.getByRole("button", { name: /Microsoft/ });
    expect(tessera).toBeDisabled();
    expect(tessera).toHaveAttribute("aria-busy", "true");
    expect(tessera).toHaveTextContent("Connessione in corso...");
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("nel recupero password usa testo e descrizione propri e senza indirizzo non si può scegliere", () => {
    const onClick = vi.fn();
    render(
      <ProviderCard
        provider={provider}
        index={0}
        onClick={onClick}
        titolo="Recupera tramite Microsoft"
        descrizione="Contatta il tuo amministratore per il recupero password"
        disabled
        indicatore="nessuno"
      />
    );

    const tessera = screen.getByRole("button", { name: /Recupera tramite Microsoft/ });
    expect(tessera).toBeDisabled();
    expect(tessera).toHaveTextContent("Contatta il tuo amministratore per il recupero password");
    expect(tessera).not.toHaveTextContent("Accesso aziendale");
  });
});
