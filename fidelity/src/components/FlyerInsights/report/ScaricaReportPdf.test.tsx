// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nomeFileReport } from "../../../../lib/insightVolantino/report";
import { reportDiProva } from "./datiDiProva";
import type { ImmaginiReport } from "./tipiReport";

const finti = vi.hoisted(() => ({
  caricaReportVolantino: vi.fn(),
  preparaImmagini: vi.fn(),
  creaBlobReport: vi.fn(),
}));

vi.mock("@/query/flyerInsights", () => ({ caricaReportVolantino: finti.caricaReportVolantino }));
// Il modulo pesante (@react-pdf, canvas): qui conta solo che il bottone lo usi nell'ordine giusto
vi.mock("./creaReportPdf", () => ({ preparaImmagini: finti.preparaImmagini, creaBlobReport: finti.creaBlobReport }));

import { caricaModuloReport, ScaricaReportPdf } from "./ScaricaReportPdf";

const IMMAGINI: ImmaginiReport = { copertina: "data:image/jpeg;base64,copertina" };
const PDF = new Blob(["%PDF-1.7"], { type: "application/pdf" });

function rinviato<T>() {
  let risolvi!: (valore: T) => void;
  const promessa = new Promise<T>((r) => {
    risolvi = r;
  });
  return { promessa, risolvi };
}

let scaricati: string[] = [];
const creaUrl = vi.fn((_oggetto: Blob | MediaSource) => "blob:report");
const liberaUrl = vi.fn();
const originali = { createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };

beforeEach(() => {
  scaricati = [];
  finti.caricaReportVolantino.mockReset();
  finti.preparaImmagini.mockReset();
  finti.creaBlobReport.mockReset();
  creaUrl.mockClear();
  liberaUrl.mockClear();
  URL.createObjectURL = creaUrl;
  URL.revokeObjectURL = liberaUrl;
  // jsdom non scarica: si annota il nome del file del link cliccato
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    scaricati.push(this.download);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  URL.createObjectURL = originali.createObjectURL;
  URL.revokeObjectURL = originali.revokeObjectURL;
});

describe("ScaricaReportPdf", () => {
  it("chiede il report, prepara la copertina, impagina e scarica il file con il nome del report", async () => {
    const report = reportDiProva({ titolo: "Volantino 3/16 novembre" });
    finti.caricaReportVolantino.mockResolvedValue(report);
    finti.preparaImmagini.mockResolvedValue(IMMAGINI);
    finti.creaBlobReport.mockResolvedValue(PDF);

    render(<ScaricaReportPdf idKit="k1" titolo="Volantino" />);
    fireEvent.click(screen.getByRole("button", { name: "Report PDF" }));

    await waitFor(() => expect(scaricati).toEqual([nomeFileReport(report.titolo, report.generatoIl)]));
    expect(scaricati[0]).toBe("Report volantino - Volantino 3 16 novembre - 2026-11-09.pdf");
    expect(finti.caricaReportVolantino).toHaveBeenCalledWith("k1");
    expect(finti.preparaImmagini).toHaveBeenCalledWith(report);
    expect(finti.creaBlobReport).toHaveBeenCalledWith(report, IMMAGINI);
    expect(creaUrl).toHaveBeenCalledWith(PDF);
    expect(liberaUrl).toHaveBeenCalledWith("blob:report");
    await waitFor(() => expect(screen.getByRole("button", { name: "Report PDF" })).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("durante la preparazione e' occupato e dice a che punto e'", async () => {
    const immagini = rinviato<ImmaginiReport>();
    const impaginazione = rinviato<Blob>();
    finti.caricaReportVolantino.mockResolvedValue(reportDiProva());
    finti.preparaImmagini.mockReturnValue(immagini.promessa);
    finti.creaBlobReport.mockReturnValue(impaginazione.promessa);

    render(<ScaricaReportPdf idKit="k1" titolo="Volantino" />);
    fireEvent.click(screen.getByRole("button", { name: "Report PDF" }));

    // Del volantino si prepara solo la miniatura della prima pagina: niente conteggio delle pagine
    expect(await screen.findByText("Copertina")).toBeInTheDocument();
    expect(screen.queryByText(/Pagine del volantino/)).not.toBeInTheDocument();
    const bottone = screen.getByRole("button", { name: "Preparazione del report…" });
    expect(bottone).toBeDisabled();
    expect(bottone).toHaveAttribute("aria-busy", "true");

    immagini.risolvi(IMMAGINI);
    expect(await screen.findByText("Impaginazione del PDF")).toBeInTheDocument();
    expect(scaricati).toEqual([]);

    impaginazione.risolvi(PDF);
    await waitFor(() => expect(scaricati).toHaveLength(1));
    expect(screen.queryByText("Impaginazione del PDF")).not.toBeInTheDocument();
  });

  it("se i dati non arrivano mostra il motivo, e Riprova rifa' tutto", async () => {
    finti.caricaReportVolantino.mockRejectedValueOnce(new Error("Volantino non trovato")).mockResolvedValueOnce(reportDiProva());
    finti.preparaImmagini.mockResolvedValue(IMMAGINI);
    finti.creaBlobReport.mockResolvedValue(PDF);

    render(<ScaricaReportPdf idKit="k1" titolo="Volantino" />);
    fireEvent.click(screen.getByRole("button", { name: "Report PDF" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Dati del report non disponibili: Volantino non trovato");
    expect(finti.preparaImmagini).not.toHaveBeenCalled();
    expect(scaricati).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));

    await waitFor(() => expect(scaricati).toHaveLength(1));
    expect(finti.caricaReportVolantino).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("se l'impaginazione fallisce lo dice, senza scaricare niente", async () => {
    finti.caricaReportVolantino.mockResolvedValue(reportDiProva());
    finti.preparaImmagini.mockResolvedValue(IMMAGINI);
    finti.creaBlobReport.mockRejectedValue(new Error("Immagine non valida"));

    render(<ScaricaReportPdf idKit="k1" titolo="Volantino" />);
    fireEvent.click(screen.getByRole("button", { name: "Report PDF" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Impaginazione del PDF non riuscita: Immagine non valida");
    expect(screen.getByRole("button", { name: "Riprova" })).toBeEnabled();
    expect(creaUrl).not.toHaveBeenCalled();
  });

  it("disattivato non parte", () => {
    render(<ScaricaReportPdf idKit="k1" titolo="Volantino" disabled />);
    const bottone = screen.getByRole("button", { name: "Report PDF" });
    expect(bottone).toBeDisabled();
    fireEvent.click(bottone);
    expect(finti.caricaReportVolantino).not.toHaveBeenCalled();
  });

  it("il modulo pesante si carica con una sola promessa, condivisa da tutti i click", async () => {
    const primo = caricaModuloReport();
    expect(caricaModuloReport()).toBe(primo);
    const modulo = await primo;
    expect(modulo.creaBlobReport).toBe(finti.creaBlobReport);
  });
});
