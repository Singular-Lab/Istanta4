// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { AuthProviderAdminDTO } from "../../../lib/types";
import {
  contaSegretiInChiaro,
  costruisciPayload,
  dividiCertificati,
  filtraMetodi,
  indirizziSuggeriti,
  riepilogoVerifica,
  ruoliNonRiconosciuti,
  spostaMetodo,
  valoriIniziali,
} from "./utils";

const ENTRA: AuthProviderAdminDTO = {
  id: "p2",
  codice: "entra_id",
  nome: "Entra ID",
  descrizione: null,
  icona: "ShieldCheck",
  tipo: "oidc",
  ordine: 1,
  attivo: true,
  config_client: { authorize_url: "https://idp.test/a", client_id: "c", redirect_uri: "https://f.test/cb" },
  config_server: { token_url: "https://idp.test/t", jwks_uri: "https://idp.test/k", domini_ammessi: ["esempio.it"] },
  ruoli_ammessi: ["GDO", "AdminGDO"],
  segreti: { client_secret: "in_chiaro" },
};

describe("form dei metodi di accesso", () => {
  it("in modifica non invia segreti, codice e tipo se non cambiati", () => {
    const payload = costruisciPayload(valoriIniziali(ENTRA), true);

    expect(payload).not.toHaveProperty("codice");
    expect(payload).not.toHaveProperty("tipo");
    expect(payload.config_server).not.toHaveProperty("client_secret");
    expect(payload.config_server).toMatchObject({ token_url: "https://idp.test/t", domini_ammessi: ["esempio.it"] });
  });

  it("invia un segreto solo quando viene reinserito", () => {
    const valori = valoriIniziali(ENTRA);
    valori.segreti.client_secret = "nuovo";

    expect(costruisciPayload(valori, true).config_server).toMatchObject({ client_secret: "nuovo" });
  });

  it("toglie dai tipi ammessi i valori non riconosciuti e li segnala", () => {
    expect(valoriIniziali(ENTRA).ruoli_ammessi).toEqual(["GDO"]);
    expect(ruoliNonRiconosciuti(ENTRA)).toEqual(["AdminGDO"]);
  });

  it("un nuovo metodo nasce disattivato e invia codice e tipo", () => {
    const valori = valoriIniziali(undefined, "saml");
    valori.codice = " ADFS ";
    valori.nome = "ADFS";

    const payload = costruisciPayload(valori, false);

    expect(valori.attivo).toBe(false);
    expect(payload).toMatchObject({ codice: "adfs", tipo: "saml", attivo: false });
    expect(payload.config_server).toMatchObject({
      want_assertions_signed: true,
      want_response_signed: true,
      disable_requested_authn_context: true,
      force_authn: false,
    });
  });

  it("divide i certificati incollati uno dopo l'altro", () => {
    const testo = "-----BEGIN CERTIFICATE-----\nAAA\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nBBB\n-----END CERTIFICATE-----";

    expect(dividiCertificati(testo)).toHaveLength(2);
    expect(dividiCertificati("AAA\n\nBBB")).toEqual(["AAA", "BBB"]);
  });

  it("propone gli indirizzi di ritorno sulle API di Fidelity", () => {
    const indirizzi = indirizziSuggeriti("adfs");

    // Indirizzi assoluti anche con VITE_API_URL relativo (/api), come nelle installazioni
    expect(indirizzi.samlAcs).toMatch(/^https?:\/\/[^/]+\/.*\/auth\/saml\/acs\/adfs$/);
    expect(indirizzi.oidcRedirect).toMatch(/^https?:\/\/[^/]+\/.*\/auth\/oidc\/callback$/);
  });
});

describe("elenco dei metodi di accesso", () => {
  it("conta i segreti ancora in chiaro", () => {
    expect(contaSegretiInChiaro([ENTRA, { ...ENTRA, id: "p3", segreti: { client_secret: "cifrato" } }])).toBe(1);
  });

  it("sposta un metodo di una posizione senza uscire dall'elenco", () => {
    expect(spostaMetodo(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(spostaMetodo(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });
});

describe("ricerca e filtri", () => {
  const INTERNO: AuthProviderAdminDTO = { ...ENTRA, id: "p1", codice: "email_password", nome: "Email e Password", tipo: "internal", attivo: true, segreti: {} };
  const SAML: AuthProviderAdminDTO = { ...ENTRA, id: "p3", codice: "adfs", nome: "ADFS aziendale", tipo: "saml", attivo: false, segreti: {} };
  const tutti = [INTERNO, ENTRA, SAML];
  const codici = (elenco: AuthProviderAdminDTO[]) => elenco.map((p) => p.codice);

  it("cerca per nome o codice senza distinguere maiuscole", () => {
    expect(codici(filtraMetodi(tutti, "adfs", "tutti"))).toEqual(["adfs"]);
    expect(codici(filtraMetodi(tutti, "ENTRA", "tutti"))).toEqual(["entra_id"]);
  });

  it("filtra per stato e per tipo", () => {
    expect(codici(filtraMetodi(tutti, "", "disattivi"))).toEqual(["adfs"]);
    expect(codici(filtraMetodi(tutti, "", "attivi"))).toEqual(["email_password", "entra_id"]);
    expect(codici(filtraMetodi(tutti, "", "oidc"))).toEqual(["entra_id"]);
    expect(codici(filtraMetodi(tutti, "", "altri"))).toEqual(["email_password"]);
  });

  it("restituisce un elenco vuoto quando nulla corrisponde", () => {
    expect(filtraMetodi(tutti, "google", "saml")).toEqual([]);
  });
});

describe("riepilogo della prova", () => {
  it("conta esiti ok, avvisi ed errori", () => {
    expect(riepilogoVerifica([{ esito: "ok" }, { esito: "ok" }, { esito: "avviso" }, { esito: "errore" }])).toEqual({ ok: 2, avviso: 1, errore: 1 });
  });
});
