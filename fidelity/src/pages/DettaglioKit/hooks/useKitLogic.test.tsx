// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen } from "@testing-library/react";
import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  post: vi.fn(),
  showNotification: vi.fn(),
  revalidate: vi.fn(),
  axiosPost: vi.fn(),
}));

vi.mock("../../../../lib/server_call", () => ({
  ServerCall: {
    post: finti.post,
    getUrl: () => "/api",
    ensureCSRFToken: vi.fn(async () => "token-csrf"),
  },
}));
vi.mock("axios", () => ({ default: { post: finti.axiosPost } }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: finti.showNotification }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn(), useRevalidator: () => ({ revalidate: finti.revalidate }) }));
vi.mock("../context/KitContext", () => ({ useKit: () => ({ state: { accepted: [], rejected: [], rejectionReasons: {}, files: [] }, dispatch: vi.fn() }) }));

import useKitLogic from "./useKitLogic";

const kit = { guidId: "kit-1", titolo: "Volantino" } as Parameters<typeof useKitLogic>[0]["kit"];

const avvolgi = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

const fileDaCaricare = (nome: string, tipo_export: string) => ({
  id: `temp_${nome}`,
  nome,
  direttive: "",
  isOptional: false,
  tipo_export,
  file: new File(["%PDF-1.4"], `${nome}-locale.pdf`, { type: "application/pdf" }),
});

/** Rende il contenuto dell'ultima notifica per leggerne il testo. */
const ultimaNotifica = () => {
  const [contenuto, opzioni] = finti.showNotification.mock.calls.at(-1) ?? [];
  if (isValidElement(contenuto)) {
    render(contenuto);
  }
  return opzioni as { variant: string };
};

describe("useKitLogic: caricamento dei materiali", () => {
  beforeEach(() => {
    finti.post.mockReset();
    finti.showNotification.mockReset();
    finti.revalidate.mockReset();
    finti.axiosPost.mockReset();
  });

  it("invia una POST /uploadMateriale per ogni file con i campi letti dal server", async () => {
    finti.post.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useKitLogic({ kit }), { wrapper: avvolgi });
    const pagina1 = fileDaCaricare("pagina-1.pdf", "tipo-stampa");
    const pagina2 = fileDaCaricare("pagina-2.pdf", "tipo-web");

    await act(async () => {
      await result.current.mutationUploadMateriale.mutateAsync({ files: [pagina1, pagina2] });
    });

    expect(finti.post).toHaveBeenCalledTimes(2);
    // Nessuna chiamata alla vecchia rotta inesistente
    expect(finti.axiosPost).not.toHaveBeenCalled();
    const inviati = finti.post.mock.calls.map(([url, corpo]) => {
      const formData = corpo as FormData;
      return {
        url,
        guidKitRuntime: formData.get("guidKitRuntime"),
        tipoExport: formData.get("tipoExport"),
        nomeFile: formData.get("nomeFile"),
        meta: formData.get("meta"),
        file: formData.get("file"),
      };
    });
    expect(inviati).toEqual([
      { url: "/uploadMateriale", guidKitRuntime: "kit-1", tipoExport: "tipo-stampa", nomeFile: "pagina-1.pdf", meta: "{}", file: expect.any(File) },
      { url: "/uploadMateriale", guidKitRuntime: "kit-1", tipoExport: "tipo-web", nomeFile: "pagina-2.pdf", meta: "{}", file: expect.any(File) },
    ]);
    expect((inviati[0].file as File).name).toBe("pagina-1.pdf-locale.pdf");
    expect((inviati[1].file as File).name).toBe("pagina-2.pdf-locale.pdf");

    expect(ultimaNotifica().variant).toBe("success");
    expect(screen.getByText("File caricati con successo")).toBeInTheDocument();
    expect(finti.revalidate).toHaveBeenCalledOnce();
  });

  it("un file rifiutato non ferma gli altri e l'errore indica quale file non e' stato caricato", async () => {
    finti.post
      .mockRejectedValueOnce(new Error("Tipo di file non supportato o tipo di export errato per il tipo di file"))
      .mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useKitLogic({ kit }), { wrapper: avvolgi });

    await act(async () => {
      await result.current.mutationUploadMateriale.mutateAsync({
        files: [fileDaCaricare("pagina-1.pdf", "tipo-stampa"), fileDaCaricare("pagina-2.pdf", "tipo-stampa")],
      });
    });

    expect(finti.post).toHaveBeenCalledTimes(2);
    expect(ultimaNotifica().variant).toBe("error");
    expect(screen.getByText("Errore durante il caricamento dei file")).toBeInTheDocument();
    expect(screen.getByText("Caricati 1 di 2 file. Non caricati:")).toBeInTheDocument();
    expect(screen.getByText("pagina-1.pdf: Tipo di file non supportato o tipo di export errato per il tipo di file")).toBeInTheDocument();
    // Il file caricato va comunque mostrato
    expect(finti.revalidate).toHaveBeenCalledOnce();
  });

  it("se nessun file viene caricato mostra l'errore e non ricarica la pagina", async () => {
    finti.post.mockRejectedValue(new Error("Kit runtime non in lavorazione"));
    const { result } = renderHook(() => useKitLogic({ kit }), { wrapper: avvolgi });

    await act(async () => {
      await result.current.mutationUploadMateriale.mutateAsync({
        files: [fileDaCaricare("pagina-1.pdf", "tipo-stampa"), fileDaCaricare("pagina-2.pdf", "tipo-stampa")],
      });
    });

    expect(ultimaNotifica().variant).toBe("error");
    expect(screen.getByText("Errore durante il caricamento dei file")).toBeInTheDocument();
    expect(screen.getByText("Non caricati:")).toBeInTheDocument();
    expect(screen.getByText("pagina-1.pdf: Kit runtime non in lavorazione")).toBeInTheDocument();
    expect(screen.getByText("pagina-2.pdf: Kit runtime non in lavorazione")).toBeInTheDocument();
    expect(finti.revalidate).not.toHaveBeenCalled();
  });

  it("un file in un formato che il server rifiuterebbe non viene inviato, gli altri si'", async () => {
    finti.post.mockResolvedValue({ success: true });
    const kitConTipi = {
      ...kit,
      stato_lavorazione: "IN_LAVORAZIONE",
      tipiExport: [{ id_tipiexport: "tipo-stampa", codice_tipiexport: "STAMPA", nome_tipiexport: "Stampa" }],
    };
    const { result } = renderHook(() => useKitLogic({ kit: kitConTipi }), { wrapper: avvolgi });
    const foto = { ...fileDaCaricare("pagina-1", "tipo-stampa"), file: new File(["x"], "foto.jpg") };
    const pdf = { ...fileDaCaricare("pagina-2", "tipo-stampa"), file: new File(["x"], "pagina-2.pdf") };

    await act(async () => {
      await result.current.mutationUploadMateriale.mutateAsync({ files: [foto, pdf] });
    });

    expect(finti.post).toHaveBeenCalledOnce();
    expect((finti.post.mock.calls[0][1] as FormData).get("nomeFile")).toBe("pagina-2");
    expect(ultimaNotifica().variant).toBe("error");
    expect(screen.getByText("pagina-1: Formato non ammesso per il tipo di export STAMPA: servono file .pdf.")).toBeInTheDocument();
  });

  it("con il kit non in lavorazione non invia nulla", async () => {
    const { result } = renderHook(() => useKitLogic({ kit: { ...kit, stato_lavorazione: "IN_REVISIONE" } }), { wrapper: avvolgi });

    await act(async () => {
      await result.current.mutationUploadMateriale.mutateAsync({ files: [fileDaCaricare("pagina-1.pdf", "tipo-stampa")] });
    });

    expect(finti.post).not.toHaveBeenCalled();
    expect(ultimaNotifica().variant).toBe("error");
    expect(screen.getByText("pagina-1.pdf: il kit non è in lavorazione")).toBeInTheDocument();
  });
});
