// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { post, showNotification } = vi.hoisted(() => ({ post: vi.fn(), showNotification: vi.fn() }));
vi.mock("../../../../lib/server_call", () => ({ ServerCall: { post } }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification }) }));
vi.mock("react-router-dom", () => ({ useRevalidator: () => ({ revalidate: vi.fn() }) }));

import UploadErroriDialog from "./UploadErroriDialog";

const fileRifiutato = { id: "f1", nome: "pagina-1.pdf" } as any;

const apri = (stagedFiles: any[]) => {
  const avvioRevisione = { mutateAsync: vi.fn().mockResolvedValue({}) };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <UploadErroriDialog
        dialogOpen
        setDialogOpen={vi.fn()}
        lavorazione={{ guidId: "kit-1" } as any}
        filesRejected={[fileRifiutato]}
        mutationAvvioRevisione={avvioRevisione as any}
        stagedFiles={stagedFiles}
      />
    </QueryClientProvider>
  );
  return avvioRevisione;
};

describe("UploadErroriDialog", () => {
  beforeEach(() => {
    post.mockReset().mockResolvedValue({});
    showNotification.mockReset();
  });

  it("sostituisce i file rifiutati e poi manda il kit in revisione", async () => {
    const nuovo = new File(["%PDF"], "pagina-1-corretta.pdf", { type: "application/pdf" });
    const avvioRevisione = apri([{ id: "s1", originalFile: fileRifiutato, newFile: nuovo }]);

    await userEvent.click(await screen.findByRole("button", { name: /Carica e manda in revisione/ }));

    await waitFor(() => expect(avvioRevisione.mutateAsync).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith("/replaceFileKitRuntime/f1", expect.any(FormData));
    expect(post.mock.invocationCallOrder[0]).toBeLessThan(avvioRevisione.mutateAsync.mock.invocationCallOrder[0]);
  });

  it("senza file in staging non si può confermare", async () => {
    apri([]);

    expect(await screen.findByRole("button", { name: /Manda in revisione/ })).toBeDisabled();
  });
});
