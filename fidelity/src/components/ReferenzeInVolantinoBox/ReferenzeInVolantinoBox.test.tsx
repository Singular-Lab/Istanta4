// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EXPORT_DI_SISTEMA } from "../../../lib/enums";

import ReferenzeInVolantinoBox from ".";

const gruppi = [
  { sigla: "FR", descrizione: "Freschi", referenze: [{ id: "r1", descrizione: "Mozzarella", codiceReferenza: "100", prezzo: 1.5 }] },
  { sigla: "DR", descrizione: "Drogheria", referenze: [{ id: "r2", descrizione: "Pasta di semola", origine: "fuori_listino" as const }] },
];

const apri = (ricercaIniziale?: string) =>
  render(
    <ReferenzeInVolantinoBox
      exportTypes={[EXPORT_DI_SISTEMA.VOL]}
      referenzePerReparto={gruppi}
      flyerInsights={{ totaleReferenze: 2 }}
      resolveColor={() => ({ tw: "bg-slate-100 text-slate-700" })}
      ricercaIniziale={ricercaIniziale}
    />
  );

describe("ReferenzeInVolantinoBox", () => {
  it("raggruppa le referenze per reparto e segnala quelle fuori listino", () => {
    apri();

    expect(screen.getByRole("heading", { name: "Referenze in volantino" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Freschi/ })).toBeInTheDocument();
    expect(screen.getByText("Fuori listino")).toBeInTheDocument();
    expect(screen.getByText("€ 1,50")).toBeInTheDocument();
  });

  it("la ricerca filtra le referenze e senza risultati si può azzerare", () => {
    apri();

    fireEvent.change(screen.getByRole("searchbox", { name: "Cerca referenza" }), { target: { value: "inesistente" } });
    expect(screen.getByText("Nessun risultato")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Azzera filtri" }));
    expect(screen.getByText("Mozzarella")).toBeInTheDocument();
  });

  it("la ricerca iniziale filtra subito le referenze che la contengono", () => {
    apri("mozzarella");

    expect(screen.getByRole("searchbox", { name: "Cerca referenza" })).toHaveValue("mozzarella");
    expect(screen.getByText("Mozzarella")).toBeInTheDocument();
    expect(screen.queryByText("Pasta di semola")).not.toBeInTheDocument();
  });

  it("una ricerca iniziale che non trova niente viene ignorata: l'elenco parte completo", () => {
    apri("Mozzarella Alta Qualità");

    expect(screen.getByRole("searchbox", { name: "Cerca referenza" })).toHaveValue("");
    expect(screen.getByText("Mozzarella")).toBeInTheDocument();
    expect(screen.getByText("Pasta di semola")).toBeInTheDocument();
  });

  it("non espone chiavi di servizi esterni nei collegamenti", () => {
    const { container } = apri();

    expect(container.innerHTML).not.toMatch(/apikey|sk_demo/);
  });
});
