// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FileTreeNode, RootFileTree } from "../../../../lib/types";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura di Dialog e Popover
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// TomSelect usa una libreria che manipola il DOM: qui serve solo la struttura dei nodi
vi.mock("@/components/Base/TomSelect", () => ({ default: () => null }));

import FileTree from ".";

const nodo = (priority: number, figli: FileTreeNode[] = []): FileTreeNode => ({
  priority,
  conditions: [],
  on_respect_condition: { commands: [] },
  on_error: { commands: [] },
  fallback: { action: "" },
  filetree: figli,
});

const contratto: RootFileTree = { root: "root", root_file_tree: [nodo(1, [nodo(1)]), nodo(2)] };

const apri = () => {
  const onChange = vi.fn();
  render(<FileTree contratto={contratto} canali={[]} aree={[]} onChange={onChange} onCreateNew={vi.fn()} />);
  return onChange;
};

describe("Struttura delle cartelle del contratto tipografia", () => {
  it("eliminare un nodo chiede conferma e, con Annulla, non lo rimuove", async () => {
    const onChange = apri();

    await userEvent.click(screen.getAllByRole("button", { name: "Elimina nodo 2" })[0]);

    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Eliminare il nodo 2?")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Annulla" }));

    expect(onChange).not.toHaveBeenCalled();
    // Chiusa la conferma, il nodo è ancora nella struttura
    expect(await screen.findByRole("heading", { name: "Nodo 2" })).toBeInTheDocument();
  });

  it("confermando, il nodo viene rimosso dalla struttura", async () => {
    const onChange = apri();

    await userEvent.click(screen.getAllByRole("button", { name: "Elimina nodo 2" })[0]);
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Elimina" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const struttura = onChange.mock.calls[0][0] as RootFileTree;
    expect(struttura.root_file_tree.map((n) => n.priority)).toEqual([1]);
  });

  it("la conferma di un nodo con figli avvisa che verranno rimossi anche loro", async () => {
    apri();

    await userEvent.click(screen.getAllByRole("button", { name: "Elimina nodo 1" })[0]);

    expect(within(await screen.findByRole("dialog")).getByText(/insieme al suo nodo figlio/)).toBeInTheDocument();
  });
});
