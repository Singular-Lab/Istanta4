// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { STATO_LAVORAZIONE_KIT_RUNTIME } from "../../../../lib/enums";
import type { FileItemKit } from "../../../../lib/types";

vi.mock("@/components/PermissionGate", () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }));
// Dropzone vera non gira in jsdom: un input file che, come lei, si inizializza una volta sola con le prime opzioni
vi.mock("@/components/Base/Dropzone", async () => {
  const { useEffect, useRef } = await import("react");
  type Opzioni = {
    acceptedFiles?: string;
    init?: (this: { on: (evento: string, gestore: (file: File) => void) => void; removeAllFiles: () => void }) => void;
  };
  const DropzoneFinta = ({ options }: { options: Opzioni }) => {
    const gestori = useRef<Record<string, (file: File) => void>>({});
    const prime = useRef(options);
    useEffect(() => {
      prime.current.init?.call({
        on: (evento, gestore) => {
          gestori.current[evento] = gestore;
        },
        removeAllFiles: () => {},
      });
    }, []);
    return (
      <input
        type="file"
        aria-label="Scegli il file"
        accept={prime.current.acceptedFiles}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) gestori.current.addedfile?.(file);
        }}
      />
    );
  };
  return { default: DropzoneFinta };
});

import FileUploader from "./FileUploader";

const atteso = { id: "f1", nome: "pagina-1", direttive: "", isOptional: false } as FileItemKit;
const STAMPA = { id_tipiexport: "tipo-stampa", codice_tipiexport: "STAMPA" };
const WEB = { id_tipiexport: "tipo-web", codice_tipiexport: "WEB" };

const apri = ({ tipiExport = [STAMPA], stato = STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE } = {}) => {
  const onFileUpload = vi.fn();
  render(
    <FileUploader filesData={[atteso]} stato={stato} tipiDiExportInKit={[]} tipiExport={tipiExport} onFileUpload={onFileUpload} />
  );
  return onFileUpload;
};

// Come un trascinamento: l'attributo accept non filtra il file, ci pensa la validazione
const utente = () => userEvent.setup({ applyAccept: false });
const file = (nome: string) => new File(["contenuto"], nome);

describe("FileUploader: formati e stato del kit", () => {
  it("un file non ammesso per il tipo di export si ferma prima dell'invio, con il motivo", async () => {
    const onFileUpload = apri();

    await utente().upload(screen.getByLabelText("Scegli il file"), file("foto.jpg"));

    expect(screen.getByText("Formato non ammesso per il tipo di export STAMPA: servono file .pdf.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Carica tutti/ })).not.toBeInTheDocument();
    expect(onFileUpload).not.toHaveBeenCalled();
  });

  it("un PDF per un tipo di stampa viene preparato e inviato", async () => {
    const onFileUpload = apri();
    const pdf = file("volantino.pdf");

    expect(screen.getByLabelText("Scegli il file")).toHaveAttribute("accept", ".pdf");
    await utente().upload(screen.getByLabelText("Scegli il file"), pdf);
    await userEvent.click(screen.getByRole("button", { name: "Carica tutti (1)" }));

    expect(onFileUpload).toHaveBeenCalledWith([
      { file: pdf, nome: "pagina-1", direttive: "", isOptional: false, tipo_export: "tipo-stampa" },
    ]);
  });

  it("l'estensione in maiuscolo viene segnalata: il server la rifiuterebbe", async () => {
    const onFileUpload = apri();

    await utente().upload(screen.getByLabelText("Scegli il file"), file("VOLANTINO.PDF"));

    expect(screen.getByText(/serve \.pdf in minuscolo/)).toBeInTheDocument();
    expect(onFileUpload).not.toHaveBeenCalled();
  });

  it("con piu' tipi di export si sceglie prima il tipo e il formato segue il tipo scelto", async () => {
    const onFileUpload = apri({ tipiExport: [STAMPA, WEB] });
    const scheda = screen.getByRole("heading", { name: "pagina-1" }).closest("div.rounded-card") as HTMLElement;
    const input = within(scheda).getByLabelText("Scegli il file");
    expect(input).toHaveAttribute("accept", ".pdf,.json,.webpliant");

    await utente().upload(input, file("referenze.json"));
    expect(within(scheda).getByText("Seleziona prima il tipo di export.")).toBeInTheDocument();

    await userEvent.selectOptions(within(scheda).getByRole("combobox"), "tipo-web");
    expect(within(scheda).queryByText("Seleziona prima il tipo di export.")).not.toBeInTheDocument();

    await utente().upload(input, file("volantino.pdf"));
    expect(within(scheda).getByText("Formato non ammesso per il tipo di export WEB: servono file .json o .webpliant.")).toBeInTheDocument();

    const json = file("referenze.json");
    await utente().upload(input, json);
    await userEvent.click(screen.getByRole("button", { name: "Carica tutti (1)" }));

    expect(onFileUpload).toHaveBeenCalledWith([expect.objectContaining({ file: json, tipo_export: "tipo-web" })]);
  });

  it("con il kit non in lavorazione avvisa e non invia nulla", async () => {
    const onFileUpload = apri({ stato: STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE });

    expect(screen.getByText(/I file si possono caricare solo con il kit in lavorazione/)).toBeInTheDocument();
    await utente().upload(screen.getByLabelText("Scegli il file"), file("volantino.pdf"));
    const carica = screen.getByRole("button", { name: "Carica tutti (1)" });
    expect(carica).toBeDisabled();

    await userEvent.click(carica);
    expect(onFileUpload).not.toHaveBeenCalled();
  });
});
