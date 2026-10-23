import { TIPO_UTENTI } from "../../../lib/enums";
import type { AuthProviderAdminDTO, AuthProviderInput } from "../../../lib/types";

export type TipoMetodo = AuthProviderAdminDTO["tipo"];

export const TIPI_METODO: Array<{ value: TipoMetodo; label: string; descrizione: string; icona: string }> = [
  { value: "oidc", label: "OpenID Connect", descrizione: "Microsoft Entra ID, Google, Okta, Keycloak e altri fornitori OIDC", icona: "ShieldCheck" },
  { value: "saml", label: "SAML 2.0", descrizione: "ADFS, Entra ID, Shibboleth e altri identity provider SAML", icona: "Fingerprint" },
  { value: "custom", label: "Collegamento esterno", descrizione: "Pulsante che porta a un indirizzo di accesso esterno", icona: "ExternalLink" },
  { value: "internal", label: "Email e password", descrizione: "Credenziali gestite da Fidelity", icona: "Mail" },
];

export const TIPI_UTENTE = Object.values(TIPO_UTENTI) as string[];

export const ETICHETTE_SEGRETI: Record<string, string> = {
  client_secret: "Client secret",
  sp_private_key: "Chiave privata del service provider",
};

/** Campi testuali e booleani modificabili, per tipo. I segreti sono gestiti a parte. */
export const CAMPI_CLIENT: Record<TipoMetodo, string[]> = {
  internal: ["password_reset_url"],
  oidc: ["discovery_url", "authorize_url", "client_id", "redirect_uri", "scope", "password_reset_url"],
  saml: ["password_reset_url"],
  custom: ["redirect_uri", "password_reset_url"],
};

export const CAMPI_SERVER_TESTO: Record<TipoMetodo, string[]> = {
  internal: [],
  oidc: ["token_url", "jwks_uri", "expected_issuer"],
  saml: [
    "metadata_url", "entry_point", "sp_entity_id", "callback_url", "idp_issuer", "signature_algorithm",
    "identifier_format", "attributo_email", "attributo_nome", "attributo_cognome", "clock_skew_ms",
  ],
  custom: [],
};

export const CAMPI_SERVER_BOOLEANI: Record<TipoMetodo, Array<{ nome: string; predefinito: boolean }>> = {
  internal: [],
  oidc: [],
  saml: [
    { nome: "want_assertions_signed", predefinito: true },
    { nome: "want_response_signed", predefinito: true },
    { nome: "disable_requested_authn_context", predefinito: true },
    { nome: "force_authn", predefinito: false },
  ],
  custom: [],
};

export const SEGRETI_PER_TIPO: Record<TipoMetodo, string[]> = {
  internal: [],
  oidc: ["client_secret"],
  saml: ["sp_private_key"],
  custom: [],
};

export interface ValoriMetodo {
  codice: string;
  nome: string;
  descrizione: string;
  icona: string;
  tipo: TipoMetodo;
  attivo: boolean;
  ruoli_ammessi: string[];
  domini_ammessi: string;
  client: Record<string, string>;
  server: Record<string, string>;
  flag: Record<string, boolean>;
  idp_certs: string;
  sp_certificate: string;
  /** Nuovi valori dei segreti: vuoto = lascia quello salvato. */
  segreti: Record<string, string>;
  segreti_da_rimuovere: string[];
}

const testo = (valore: unknown): string =>
  valore === undefined || valore === null ? "" : String(valore);

const certificatiInTesto = (valore: unknown): string =>
  Array.isArray(valore) ? valore.join("\n\n") : testo(valore);

/** Divide il testo in certificati: separati da END CERTIFICATE oppure da una riga vuota. */
export function dividiCertificati(valore: string): string[] {
  const pem = valore.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (pem && pem.length > 0) return pem.map((c) => c.trim());
  return valore.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean);
}

/** Indirizzo pubblico delle API di Fidelity, per proporre gli indirizzi di ritorno. */
export function baseApi(): string {
  const configurato = (import.meta.env?.VITE_API_URL as string | undefined) || "/api";
  return new URL(configurato, window.location.origin).toString().replace(/\/+$/, "");
}

export function indirizziSuggeriti(codice: string) {
  const base = baseApi();
  const codiceUrl = encodeURIComponent(codice || "<codice>");
  return {
    oidcRedirect: `${base}/auth/oidc/callback`,
    samlAcs: `${base}/auth/saml/acs/${codiceUrl}`,
    samlEntityId: `${base}/auth/saml/metadata/${codiceUrl}`,
    samlMetadata: `${base}/auth/saml/metadata/${codiceUrl}`,
  };
}

export function valoriIniziali(provider?: AuthProviderAdminDTO, tipo: TipoMetodo = "oidc"): ValoriMetodo {
  const t = provider?.tipo ?? tipo;
  const client = provider?.config_client ?? {};
  const server = provider?.config_server ?? {};
  return {
    codice: provider?.codice ?? "",
    nome: provider?.nome ?? "",
    descrizione: provider?.descrizione ?? "",
    icona: provider?.icona ?? (TIPI_METODO.find((m) => m.value === t)?.icona ?? "Key"),
    tipo: t,
    attivo: provider?.attivo ?? false,
    // Solo i tipi conosciuti: un valore non valido salvato in passato non si puo' riselezionare
    ruoli_ammessi: (provider?.ruoli_ammessi ?? []).filter((r) => TIPI_UTENTE.includes(r)),
    domini_ammessi: Array.isArray(server.domini_ammessi) ? (server.domini_ammessi as string[]).join(", ") : "",
    client: Object.fromEntries(CAMPI_CLIENT[t].map((c) => [c, testo(client[c])])),
    server: Object.fromEntries(CAMPI_SERVER_TESTO[t].map((c) => [c, testo(server[c])])),
    flag: Object.fromEntries(CAMPI_SERVER_BOOLEANI[t].map(({ nome, predefinito }) =>
      [nome, typeof server[nome] === "boolean" ? (server[nome] as boolean) : predefinito])),
    idp_certs: certificatiInTesto(server.idp_certs),
    sp_certificate: certificatiInTesto(server.sp_certificate),
    segreti: Object.fromEntries(SEGRETI_PER_TIPO[t].map((s) => [s, ""])),
    segreti_da_rimuovere: [],
  };
}

/** Ruoli salvati che la gestione non riconosce: vengono tolti al salvataggio. */
export function ruoliNonRiconosciuti(provider?: AuthProviderAdminDTO): string[] {
  return (provider?.ruoli_ammessi ?? []).filter((r) => !TIPI_UTENTE.includes(r));
}

const soloValorizzati = (valori: Record<string, string>) =>
  Object.fromEntries(Object.entries(valori).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v !== ""));

export function costruisciPayload(valori: ValoriMetodo, modifica: boolean): AuthProviderInput {
  const server: Record<string, unknown> = { ...soloValorizzati(valori.server), ...valori.flag };
  if (server.clock_skew_ms !== undefined) server.clock_skew_ms = Number(server.clock_skew_ms);

  if (valori.tipo === "saml") {
    const idp = dividiCertificati(valori.idp_certs);
    if (idp.length > 0) server.idp_certs = idp;
    const sp = dividiCertificati(valori.sp_certificate);
    if (sp.length > 0) server.sp_certificate = sp;
  }
  if (valori.tipo === "oidc" || valori.tipo === "saml") {
    const domini = valori.domini_ammessi.split(/[\s,;]+/).map((d) => d.trim()).filter(Boolean);
    if (domini.length > 0) server.domini_ammessi = domini;
  }
  for (const [nome, valore] of Object.entries(valori.segreti)) {
    if (valore.trim()) server[nome] = valore;
  }

  const payload: AuthProviderInput = {
    nome: valori.nome.trim(),
    descrizione: valori.descrizione.trim() || null,
    icona: valori.icona,
    attivo: valori.attivo,
    config_client: soloValorizzati(valori.client),
    config_server: server,
    ruoli_ammessi: valori.ruoli_ammessi.length > 0 ? valori.ruoli_ammessi : null,
    segreti_da_rimuovere: valori.segreti_da_rimuovere,
  };
  if (!modifica) {
    payload.codice = valori.codice.trim().toLowerCase();
    payload.tipo = valori.tipo;
  }
  return payload;
}

export function contaSegretiInChiaro(providers: AuthProviderAdminDTO[]): number {
  return providers.reduce(
    (totale, p) => totale + Object.values(p.segreti ?? {}).filter((stato) => stato === "in_chiaro").length,
    0,
  );
}

/** Nuovo ordine dopo lo spostamento di un metodo di una posizione. */
export function spostaMetodo(ids: string[], id: string, direzione: -1 | 1): string[] {
  const indice = ids.indexOf(id);
  const destinazione = indice + direzione;
  if (indice < 0 || destinazione < 0 || destinazione >= ids.length) return ids;
  const risultato = [...ids];
  [risultato[indice], risultato[destinazione]] = [risultato[destinazione], risultato[indice]];
  return risultato;
}

export function etichettaTipo(tipo: TipoMetodo): string {
  return TIPI_METODO.find((m) => m.value === tipo)?.label ?? tipo;
}

export type FiltroMetodi = "tutti" | "attivi" | "disattivi" | "oidc" | "saml" | "altri";

export const FILTRI_METODI: Array<{ value: FiltroMetodi; label: string }> = [
  { value: "tutti", label: "Tutti" },
  { value: "attivi", label: "Attivi" },
  { value: "disattivi", label: "Disattivi" },
  { value: "oidc", label: "OIDC" },
  { value: "saml", label: "SAML" },
  { value: "altri", label: "Altri" },
];

/** Ricerca per nome, codice o descrizione e filtro per stato o tipo. */
export function filtraMetodi(providers: AuthProviderAdminDTO[], ricerca: string, filtro: FiltroMetodi): AuthProviderAdminDTO[] {
  const testoRicerca = ricerca.trim().toLowerCase();
  return providers.filter((p) => {
    if (testoRicerca && ![p.nome, p.codice, p.descrizione ?? ""].some((v) => v.toLowerCase().includes(testoRicerca))) return false;
    switch (filtro) {
      case "attivi": return p.attivo;
      case "disattivi": return !p.attivo;
      case "oidc": return p.tipo === "oidc";
      case "saml": return p.tipo === "saml";
      case "altri": return p.tipo === "internal" || p.tipo === "custom";
      default: return true;
    }
  });
}

export function riepilogoVerifica(esiti: Array<{ esito: "ok" | "avviso" | "errore" }>) {
  return {
    ok: esiti.filter((e) => e.esito === "ok").length,
    avviso: esiti.filter((e) => e.esito === "avviso").length,
    errore: esiti.filter((e) => e.esito === "errore").length,
  };
}
