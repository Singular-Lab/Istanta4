// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import dayjs from "dayjs";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { NotificationProvider, useNotification } from "./NotificationContext";
import { TimelineProvider, useTimeline } from "./TimeLinePromoContext";
import { UserProvider, useUser } from "./UserContext";

describe("NotificationProvider", () => {
  it("mostrare un toast non ridisegna chi usa useNotification: il valore del contesto resta lo stesso", async () => {
    let disegni = 0;
    const valori = new Set<unknown>();
    const Consumatore = () => {
      const contesto = useNotification();
      disegni++;
      valori.add(contesto);
      return <button onClick={() => contesto.showNotification("Salvato", { variant: "success" })}>Mostra</button>;
    };

    render(
      <NotificationProvider>
        <Consumatore />
      </NotificationProvider>
    );
    const disegniIniziali = disegni;

    fireEvent.click(screen.getByRole("button", { name: "Mostra" }));
    fireEvent.click(screen.getByRole("button", { name: "Mostra" }));

    expect(await screen.findAllByText("Salvato")).toHaveLength(2);
    expect(disegni).toBe(disegniIniziali);
    expect(valori.size).toBe(1);
  });
});

describe("TimelineProvider", () => {
  it("le date restano le stesse fra un render e l'altro e partono da oggi", () => {
    const elenchi = new Set<unknown>();
    let aggiornaRef: ((v: Array<{ idPromo: string; numeroRefPromo: number }>) => void) | null = null;
    const Consumatore = () => {
      const { dates, today, setNumeroRefPromo, numeroRefPromo } = useTimeline();
      elenchi.add(dates);
      useEffect(() => {
        aggiornaRef = setNumeroRefPromo;
      }, [setNumeroRefPromo]);
      return (
        <p>
          {today.format("YYYY-MM-DD")} {dates.length} {numeroRefPromo.length}
        </p>
      );
    };

    render(
      <TimelineProvider range={90}>
        <Consumatore />
      </TimelineProvider>
    );
    const oggi = dayjs().startOf("day").format("YYYY-MM-DD");
    expect(screen.getByText(`${oggi} 90 0`)).toBeInTheDocument();

    // Un cambio di stato del provider ridisegna il consumatore, ma le 90 date non si ricalcolano
    act(() => {
      aggiornaRef?.([{ idPromo: "p1", numeroRefPromo: 3 }]);
    });

    expect(screen.getByText(`${oggi} 90 1`)).toBeInTheDocument();
    expect(elenchi.size).toBe(1);
  });
});

describe("UserProvider", () => {
  it("il valore cambia solo quando cambia l'utente", () => {
    const valori = new Set<unknown>();
    const Consumatore = () => {
      const contesto = useUser();
      valori.add(contesto);
      return <p>{contesto.user?.nome ?? "nessuno"}</p>;
    };
    const { rerender } = render(
      <UserProvider>
        <Consumatore />
      </UserProvider>
    );

    rerender(
      <UserProvider>
        <Consumatore />
      </UserProvider>
    );

    expect(screen.getByText("nessuno")).toBeInTheDocument();
    expect(valori.size).toBe(1);
  });
});
