// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  post: vi.fn(async () => ({ success: true })),
  put: vi.fn(async () => ({ success: true })),
  delete: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../../../lib/server_call", () => ({
  ServerCall: { get: vi.fn(), post: finti.post, put: finti.put, delete: finti.delete },
}));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useRevalidator: () => ({ revalidate: vi.fn() }),
}));

import { useFilterTemplates } from "./useFilterTemplates";

const avvolgi = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe("useFilterTemplates", () => {
  beforeEach(() => {
    finti.post.mockClear();
    finti.put.mockClear();
    finti.delete.mockClear();
  });

  it("gestisce i template con la sessione, senza header x-api-key", async () => {
    const { result } = renderHook(() => useFilterTemplates(), { wrapper: avvolgi });
    const nuovo = { nome: "Vetrina", slug: "vetrina", mode: "refs" as const, filters: [] };

    await act(async () => {
      await result.current.create.mutateAsync(nuovo);
      await result.current.update.mutateAsync({ id: "t1", nome: "Vetrina 2" });
      await result.current.deleteTemplate.mutateAsync("t1");
      await result.current.restore.mutateAsync({ slug: "vetrina", version: 1 });
    });

    // Gli argomenti finiscono qui: nessun quarto parametro con header personalizzati
    expect(finti.post).toHaveBeenCalledWith("/external/filter-templates", nuovo, false);
    expect(finti.put).toHaveBeenCalledWith("/external/filter-templates/t1", { nome: "Vetrina 2" });
    expect(finti.delete).toHaveBeenCalledWith("/external/filter-templates/t1");
    expect(finti.post).toHaveBeenCalledWith("/external/filter-templates/slug/vetrina/restore", { target_version: 1 }, false);
  });
});
