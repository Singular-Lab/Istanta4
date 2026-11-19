// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGOLA_PASSWORD } from "../../../lib/accessi/tipiUtenteCreabili";
import { ServerCall } from "../../../lib/server_call";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura di Dialog e Menu
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({
  tipo: "Superadmin",
  gdo: [] as Array<{ id: string; nome: string }>,
  ruoli: [] as Array<{ id: string; ruolo: string }>,
  puntiVendita: {} as Record<string, Array<{ id: string; nome: string }>>,
  puntiVenditaChiesti: [] as Array<[string, boolean]>,
  notifica: vi.fn(),
}));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("../../context/NotificationContext", () => ({ useNotification: () => ({ showNotification: finti.notifica }) }));
vi.mock("../../context/UserContext", () => ({ useUser: () => ({ user: { id: "admin", tipo: finti.tipo } }) }));
vi.mock("@/query/query", () => ({
  useFetchAllGDO: () => ({ data: finti.gdo }),
  useFetchAllRuoliGDO: () => ({ data: finti.ruoli }),
  useFetchPuntiVenditaDellaGdo: (idGdo: string, enabled: boolean) => {
    finti.puntiVenditaChiesti.push([idGdo, enabled]);
    return { data: enabled ? finti.puntiVendita[idGdo] ?? [] : undefined, isLoading: false };
  },
}));

import NuovoUtenteDialog from "./NuovoUtenteDialog";

const callback = { onClose: vi.fn(), onCreato: vi.fn(), onLimiteSuperato: vi.fn() };

const apri = async () => {
  const utente = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NuovoUtenteDialog open {...callback} />
    </QueryClientProvider>
  );
  const modulo = await screen.findByRole("dialog", { name: "Crea nuovo utente" });
  return { utente, modulo };
};

type Utente = ReturnType<typeof userEvent.setup>;

/** I soli dati essenziali: nome, cognome, email e password. */
const compilaEssenziali = async (utente: Utente, modulo: HTMLElement, email = "anna.rossi@esempio.it") => {
  await utente.type(within(modulo).getByLabelText(/^Nome/), "Anna");
  await utente.type(within(modulo).getByLabelText(/^Cognome/), "Rossi");
  await utente.type(within(modulo).getByLabelText(/^Email/), email);
  await utente.type(within(modulo).getByLabelText(/^Password/), "Segreta1!");
};

const payloadInviato = () => vi.mocked(ServerCall.post).mock.calls[0][1] as Record<string, unknown>;

beforeEach(() => {
  finti.tipo = "Superadmin";
  finti.gdo = [{ id: "g1", nome: "Conad CNO" }, { id: "g2", nome: "Coop Firenze" }];
  finti.ruoli = [{ id: "r1", ruolo: "ADMIN" }];
  finti.puntiVendita = { g1: [{ id: "pv1", nome: "Firenze Novoli" }], g2: [{ id: "pv2", nome: "Prato Centro" }] };
  finti.puntiVenditaChiesti = [];
  finti.notifica.mockReset();
  for (const funzione of Object.values(callback)) funzione.mockReset();
  vi.mocked(ServerCall.get).mockReset().mockResolvedValue({ registrata: false });
  vi.mocked(ServerCall.post).mockReset().mockResolvedValue(undefined);
});

describe("Nuovo utente: dati essenziali", () => {
  it("crea un utente senza data di nascita, residenza e telefono", async () => {
    const { utente, modulo } = await apri();

    await compilaEssenziali(utente, modulo);
    await utente.selectOptions(within(modulo).getByLabelText(/^Tipo utente/), "Marketing");
    await utente.selectOptions(within(modulo).getByLabelText(/^GDO/), "g1");
    await utente.click(within(modulo).getByRole("button", { name: "Crea" }));

    await waitFor(() => expect(ServerCall.post).toHaveBeenCalledTimes(1));
    expect(vi.mocked(ServerCall.post).mock.calls[0][0]).toBe("/register-user");
    expect(payloadInviato()).toMatchObject({
      nome: "Anna", cognome: "Rossi", email: "anna.rossi@esempio.it", tipo: "Marketing", gdoScelta: "g1", stato: "ATTIVO",
      residenza: undefined, dataDiNascita: undefined, telefono: undefined,
    });
    await waitFor(() => expect(callback.onClose).toHaveBeenCalled());
    expect(callback.onCreato).toHaveBeenCalledTimes(1);
  });

  it("i tipi hanno il nome leggibile", async () => {
    const { modulo } = await apri();

    expect(within(modulo).getByRole("option", { name: "Punto Vendita" })).toHaveValue("PuntoVendita");
  });

  it("un telefono con prefisso e spazi è accettato", async () => {
    const { utente, modulo } = await apri();

    await compilaEssenziali(utente, modulo);
    await utente.selectOptions(within(modulo).getByLabelText(/^Tipo utente/), "Superadmin");
    await utente.type(within(modulo).getByLabelText(/^Telefono/), "+39 055 123 4567");
    await utente.click(within(modulo).getByRole("button", { name: "Crea" }));

    await waitFor(() => expect(ServerCall.post).toHaveBeenCalledTimes(1));
    expect(payloadInviato()).toMatchObject({ telefono: "+39 055 123 4567" });
  });

  it("un telefono non valido apre gli altri dati e mostra l'errore", async () => {
    const { utente, modulo } = await apri();

    await compilaEssenziali(utente, modulo);
    await utente.selectOptions(within(modulo).getByLabelText(/^Tipo utente/), "Superadmin");
    await utente.type(within(modulo).getByLabelText(/^Telefono/), "abc");
    await utente.click(within(modulo).getByRole("button", { name: "Crea" }));

    expect(await within(modulo).findByText(/Telefono non valido/)).toBeInTheDocument();
    expect(within(modulo).getByText("Altri dati (facoltativi)").closest("details")).toHaveAttribute("open");
    expect(ServerCall.post).not.toHaveBeenCalled();
  });

  it("il punto vendita è obbligatorio per un utente Punto Vendita", async () => {
    const { utente, modulo } = await apri();

    await compilaEssenziali(utente, modulo);
    await utente.selectOptions(within(modulo).getByLabelText(/^Tipo utente/), "PuntoVendita");
    await utente.selectOptions(within(modulo).getByLabelText(/^GDO/), "g1");
    await utente.click(within(modulo).getByRole("button", { name: "Crea" }));

    expect(await within(modulo).findByText("Il punto vendita è obbligatorio per gli utenti Punto Vendita")).toBeInTheDocument();
    expect(ServerCall.post).not.toHaveBeenCalled();
  });
});

describe("Nuovo utente: password", () => {
  it("Genera crea una password valida e visibile, Copia la mette negli appunti", async () => {
    const { utente, modulo } = await apri();

    await utente.click(within(modulo).getByRole("button", { name: "Genera" }));
    const campo = within(modulo).getByLabelText(/^Password/) as HTMLInputElement;

    expect(REGOLA_PASSWORD.test(campo.value)).toBe(true);
    expect(campo).toHaveAttribute("type", "text");
    await utente.click(within(modulo).getByRole("button", { name: "Copia" }));
    expect(await navigator.clipboard.readText()).toBe(campo.value);
    expect(await within(modulo).findByRole("button", { name: "Copiata" })).toBeInTheDocument();
  });

  it("una password scritta a mano non conforme ferma la creazione e dice cosa manca", async () => {
    const { utente, modulo } = await apri();

    await utente.type(within(modulo).getByLabelText(/^Nome/), "Anna");
    await utente.type(within(modulo).getByLabelText(/^Cognome/), "Rossi");
    await utente.type(within(modulo).getByLabelText(/^Email/), "anna.rossi@esempio.it");
    await utente.type(within(modulo).getByLabelText(/^Password/), "password");
    await utente.selectOptions(within(modulo).getByLabelText(/^Tipo utente/), "Superadmin");
    await utente.click(within(modulo).getByRole("button", { name: "Crea" }));

    const campo = within(modulo).getByLabelText(/^Password/);
    await waitFor(() => expect(campo).toHaveAttribute("aria-invalid", "true"));
    expect(within(modulo).getAllByText(/Almeno 8 caratteri, con una maiuscola/).length).toBe(2);
    expect(ServerCall.post).not.toHaveBeenCalled();
  });
});

describe("Nuovo utente: email già registrata", () => {
  it("lo segnala all'uscita dal campo, con l'email normalizzata, e non crea l'utente", async () => {
    vi.mocked(ServerCall.get).mockResolvedValue({ registrata: true });
    const { utente, modulo } = await apri();

    await compilaEssenziali(utente, modulo, " Anna.Rossi@Esempio.it");
    expect(ServerCall.get).toHaveBeenCalledWith("/utenti/email-registrata?email=anna.rossi%40esempio.it");
    expect(await within(modulo).findByText(/Email già registrata/)).toBeInTheDocument();

    await utente.selectOptions(within(modulo).getByLabelText(/^Tipo utente/), "Superadmin");
    await utente.click(within(modulo).getByRole("button", { name: "Crea" }));
    expect(ServerCall.post).not.toHaveBeenCalled();
  });

  it("un'email libera non mostra avvisi", async () => {
    const { utente, modulo } = await apri();

    await compilaEssenziali(utente, modulo);

    await waitFor(() => expect(ServerCall.get).toHaveBeenCalled());
    expect(within(modulo).queryByText(/Email già registrata/)).not.toBeInTheDocument();
  });

  it("se il server la rifiuta come già in uso, l'errore va sul campo email", async () => {
    vi.mocked(ServerCall.post).mockRejectedValue({ message: "L'email è già in uso" });
    const { utente, modulo } = await apri();

    await compilaEssenziali(utente, modulo);
    await utente.selectOptions(within(modulo).getByLabelText(/^Tipo utente/), "Superadmin");
    await utente.click(within(modulo).getByRole("button", { name: "Crea" }));

    expect(await within(modulo).findByText(/Email già registrata/)).toBeInTheDocument();
    expect(callback.onClose).not.toHaveBeenCalled();
  });
});

describe("Nuovo utente: più utenti di seguito", () => {
  it("Crea e aggiungi un altro svuota i dati personali e tiene tipo, GDO, ruolo e stato", async () => {
    const { utente, modulo } = await apri();

    await compilaEssenziali(utente, modulo);
    await utente.selectOptions(within(modulo).getByLabelText(/^Tipo utente/), "Category");
    await utente.selectOptions(within(modulo).getByLabelText(/^GDO/), "g1");
    await utente.selectOptions(within(modulo).getByLabelText(/^Ruolo/), "r1");
    await utente.click(within(modulo).getByRole("button", { name: "Crea e aggiungi un altro" }));

    await waitFor(() => expect(ServerCall.post).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(modulo).getByLabelText(/^Nome/)).toHaveValue(""));
    expect(within(modulo).getByLabelText(/^Cognome/)).toHaveValue("");
    expect(within(modulo).getByLabelText(/^Email/)).toHaveValue("");
    expect(within(modulo).getByLabelText(/^Password/)).toHaveValue("");
    expect(within(modulo).getByLabelText(/^Tipo utente/)).toHaveValue("Category");
    expect(within(modulo).getByLabelText(/^GDO/)).toHaveValue("g1");
    expect(within(modulo).getByLabelText(/^Ruolo/)).toHaveValue("r1");
    expect(within(modulo).getByLabelText(/^Stato/)).toHaveValue("ATTIVO");
    expect(callback.onClose).not.toHaveBeenCalled();
    expect(callback.onCreato).toHaveBeenCalledTimes(1);
  });

  it("al limite di utenti creati nell'ora avvisa la pagina", async () => {
    vi.mocked(ServerCall.post).mockRejectedValue({ httpStatus: 429, message: "Limite" });
    const { utente, modulo } = await apri();

    await compilaEssenziali(utente, modulo);
    await utente.selectOptions(within(modulo).getByLabelText(/^Tipo utente/), "Superadmin");
    await utente.click(within(modulo).getByRole("button", { name: "Crea" }));

    await waitFor(() => expect(callback.onLimiteSuperato).toHaveBeenCalledTimes(1));
    expect(callback.onClose).not.toHaveBeenCalled();
  });
});

describe("Nuovo utente: tipo, GDO e punto vendita", () => {
  it("l'Agenzia non vede il tipo Superadmin", async () => {
    finti.tipo = "Agenzia";
    const { modulo } = await apri();

    const tipi = within(within(modulo).getByLabelText(/^Tipo utente/)).getAllByRole("option").map((opzione) => opzione.textContent);
    expect(tipi).not.toContain("Superadmin");
    expect(tipi).toContain("Agenzia");
  });

  it("un utente GDO crea nella propria GDO: niente scelta della GDO né tipo GDO", async () => {
    finti.tipo = "GDO";
    const { utente, modulo } = await apri();

    const tipi = within(within(modulo).getByLabelText(/^Tipo utente/)).getAllByRole("option").map((opzione) => opzione.textContent);
    expect(tipi).not.toContain("GDO");
    expect(tipi).not.toContain("Superadmin");

    await compilaEssenziali(utente, modulo);
    await utente.selectOptions(within(modulo).getByLabelText(/^Tipo utente/), "Category");
    const gdo = within(modulo).getByLabelText(/^GDO/);
    expect(gdo).toHaveAttribute("readonly");
    expect(gdo).toHaveValue("La tua GDO");
    await utente.click(within(modulo).getByRole("button", { name: "Crea" }));

    await waitFor(() => expect(ServerCall.post).toHaveBeenCalledTimes(1));
    expect(payloadInviato()).not.toHaveProperty("gdoScelta");
  });

  it("il Superadmin vede i punti vendita della GDO scelta", async () => {
    const { utente, modulo } = await apri();

    await utente.selectOptions(within(modulo).getByLabelText(/^Tipo utente/), "PuntoVendita");
    expect(within(modulo).getByLabelText(/^Punto vendita/)).toBeDisabled();
    await utente.selectOptions(within(modulo).getByLabelText(/^GDO/), "g2");

    const puntoVendita = within(modulo).getByLabelText(/^Punto vendita/);
    expect(within(puntoVendita).getByRole("option", { name: "Prato Centro" })).toBeInTheDocument();
    expect(within(puntoVendita).queryByRole("option", { name: "Firenze Novoli" })).not.toBeInTheDocument();
    expect(finti.puntiVenditaChiesti).toContainEqual(["g2", true]);
  });

  it("con una sola GDO è già scelta", async () => {
    finti.gdo = [{ id: "g1", nome: "Conad CNO" }];
    const { utente, modulo } = await apri();

    await utente.selectOptions(within(modulo).getByLabelText(/^Tipo utente/), "Marketing");

    expect(within(modulo).getByLabelText(/^GDO/)).toHaveValue("g1");
  });
});
