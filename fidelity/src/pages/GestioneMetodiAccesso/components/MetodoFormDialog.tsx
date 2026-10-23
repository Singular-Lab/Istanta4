import Button from "@/components/Base/Button";
import { FormCheck, FormInput, FormLabel, FormSelect, FormSwitch, FormTextarea } from "@/components/Base/Form";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Tippy from "@/components/Base/Tippy";
import { useEffect, useState, type ReactNode } from "react";
import { ServerCall } from "../../../../lib/server_call";
import type { AuthProviderAdminDTO, AuthProviderInput, StatoSegretoProvider } from "../../../../lib/types";
import IconInput from "../../GestioneHub/components/IconInput";
import ProviderCard from "../../HubLogin/components/ProviderCard";
import {
  CAMPI_SERVER_BOOLEANI,
  costruisciPayload,
  ETICHETTE_SEGRETI,
  indirizziSuggeriti,
  ruoliNonRiconosciuti,
  TIPI_METODO,
  TIPI_UTENTE,
  valoriIniziali,
  type TipoMetodo,
  type ValoriMetodo,
} from "../utils";

interface MetodoFormDialogProps {
  open: boolean;
  provider?: AuthProviderAdminDTO;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: AuthProviderInput) => Promise<void> | void;
}

const ETICHETTE: Record<string, { label: string; aiuto?: string; placeholder?: string }> = {
  discovery_url: { label: "Indirizzo di discovery", aiuto: "Issuer o .well-known/openid-configuration: compila gli indirizzi qui sotto.", placeholder: "https://login.microsoftonline.com/<tenant>/v2.0" },
  authorize_url: { label: "Authorization endpoint", placeholder: "https://.../authorize" },
  client_id: { label: "Client ID" },
  redirect_uri: { label: "Redirect URI", aiuto: "Va registrato identico presso il fornitore." },
  scope: { label: "Scope", placeholder: "openid profile email" },
  password_reset_url: { label: "Indirizzo per il recupero password" },
  token_url: { label: "Token endpoint", placeholder: "https://.../token" },
  jwks_uri: { label: "JWKS URI", placeholder: "https://.../keys" },
  expected_issuer: { label: "Issuer atteso", aiuto: "Se indicato, un token con issuer diverso viene rifiutato." },
  metadata_url: { label: "Indirizzo dei metadati IdP" },
  entry_point: { label: "Indirizzo di accesso dell'IdP (SSO)", placeholder: "https://idp.../saml2" },
  sp_entity_id: { label: "Entity ID del service provider (Fidelity)" },
  callback_url: { label: "Indirizzo di ritorno (ACS)", aiuto: "Assertion Consumer Service da registrare presso l'IdP." },
  idp_issuer: { label: "Entity ID dell'IdP", aiuto: "Se indicato, una risposta con issuer diverso viene rifiutata." },
  signature_algorithm: { label: "Algoritmo di firma" },
  identifier_format: { label: "Formato NameID", placeholder: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" },
  attributo_email: { label: "Attributo email", aiuto: "Vuoto: email, mail o claim emailaddress, poi il NameID." },
  attributo_nome: { label: "Attributo nome" },
  attributo_cognome: { label: "Attributo cognome" },
  clock_skew_ms: { label: "Tolleranza orologio (ms)", placeholder: "60000" },
  want_assertions_signed: { label: "Asserzioni firmate obbligatorie" },
  want_response_signed: { label: "Risposta firmata obbligatoria" },
  disable_requested_authn_context: { label: "Non richiedere un contesto di autenticazione", aiuto: "Consigliato con Entra ID e ADFS." },
  force_authn: { label: "Richiedi sempre le credenziali (ForceAuthn)" },
};

const STATO_SEGRETO: Record<StatoSegretoProvider, { testo: string; classe: string }> = {
  cifrato: { testo: "Impostato, cifrato", classe: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  in_chiaro: { testo: "Impostato, in chiaro", classe: "bg-amber-50 border-amber-200 text-amber-700" },
  assente: { testo: "Non impostato", classe: "bg-slate-100 border-slate-200 text-slate-500" },
};

const NOTA_SEGRETI = "I valori salvati non vengono mai mostrati: lascia il campo vuoto per mantenerli. Un nuovo valore viene cifrato.";

const Sezione = ({ titolo, descrizione, children }: { titolo: string; descrizione?: ReactNode; children: ReactNode }) => (
  <section className="rounded-md border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
    <div className="mb-5">
      <div className="text-sm font-semibold text-slate-800">{titolo}</div>
      {descrizione && <div className="mt-1 text-xs text-slate-500">{descrizione}</div>}
    </div>
    <div className="space-y-4">{children}</div>
  </section>
);

const Avviso = ({ tono, icona, children }: { tono: "ambra" | "azzurro"; icona: string; children: ReactNode }) => (
  <div
    className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${tono === "ambra"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-sky-200 bg-sky-50 text-sky-700"}`}
  >
    <Lucide icon={icona} className="w-4 h-4 shrink-0" />
    <span>{children}</span>
  </div>
);

const MetodoFormDialog = ({ open, provider, submitting = false, onClose, onSubmit }: MetodoFormDialogProps) => {
  const modifica = !!provider;
  const [valori, setValori] = useState<ValoriMetodo>(valoriIniziali(provider));
  const [errore, setErrore] = useState<string | null>(null);
  const [importazione, setImportazione] = useState<string | null>(null);
  const [xmlMetadati, setXmlMetadati] = useState("");

  useEffect(() => {
    if (!open) return;
    setValori(valoriIniziali(provider));
    setErrore(null);
    setXmlMetadati("");
  }, [open, provider]);

  const tipo = valori.tipo;
  const suggeriti = indirizziSuggeriti(valori.codice);
  const ruoliScartati = ruoliNonRiconosciuti(provider);
  const tuttiIRuoli = valori.ruoli_ammessi.length === TIPI_UTENTE.length;

  const aggiorna = <K extends keyof ValoriMetodo>(campo: K, valore: ValoriMetodo[K]) =>
    setValori((attuali) => ({ ...attuali, [campo]: valore }));
  const aggiornaMappa = (mappa: "client" | "server" | "segreti", campo: string, valore: string) =>
    setValori((attuali) => ({ ...attuali, [mappa]: { ...attuali[mappa], [campo]: valore } }));

  const cambiaTipo = (nuovo: TipoMetodo) => {
    const base = valoriIniziali(undefined, nuovo);
    setValori((attuali) => ({ ...base, codice: attuali.codice, nome: attuali.nome, descrizione: attuali.descrizione }));
  };

  const importa = async (chi: "discovery" | "metadata-url" | "metadata-xml") => {
    setImportazione(chi);
    setErrore(null);
    try {
      if (chi === "discovery") {
        const esito = await ServerCall.post<Record<string, string>>("/auth-providers/importa/oidc-discovery", {
          url: valori.client.discovery_url,
        });
        setValori((attuali) => ({
          ...attuali,
          client: { ...attuali.client, discovery_url: esito.discovery_url, authorize_url: esito.authorize_url },
          server: { ...attuali.server, token_url: esito.token_url, jwks_uri: esito.jwks_uri, expected_issuer: esito.expected_issuer ?? attuali.server.expected_issuer },
        }));
      } else {
        const esito = await ServerCall.post<{ entry_point: string; idp_issuer?: string; idp_certs: string[]; metadata_url?: string }>(
          "/auth-providers/importa/saml-metadata",
          chi === "metadata-url" ? { url: valori.server.metadata_url } : { xml: xmlMetadati },
        );
        setValori((attuali) => ({
          ...attuali,
          server: {
            ...attuali.server,
            entry_point: esito.entry_point,
            idp_issuer: esito.idp_issuer ?? attuali.server.idp_issuer,
            metadata_url: esito.metadata_url ?? attuali.server.metadata_url,
          },
          idp_certs: esito.idp_certs.length > 0 ? esito.idp_certs.join("\n\n") : attuali.idp_certs,
        }));
      }
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Importazione non riuscita");
    } finally {
      setImportazione(null);
    }
  };

  const valida = (): string | null => {
    if (!modifica && !/^[a-z0-9_-]{2,50}$/.test(valori.codice.trim().toLowerCase())) {
      return "Il codice deve avere da 2 a 50 caratteri fra minuscole, cifre, \"_\" e \"-\".";
    }
    if (!valori.nome.trim()) return "Il nome è obbligatorio.";
    if (tipo === "oidc" && provider?.segreti.client_secret !== "cifrato" && provider?.segreti.client_secret !== "in_chiaro" && !valori.segreti.client_secret?.trim()) {
      return "Il client secret è obbligatorio.";
    }
    return null;
  };

  const invia = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problema = valida();
    if (problema) {
      setErrore(problema);
      return;
    }
    setErrore(null);
    await onSubmit(costruisciPayload(valori, modifica));
  };

  const campoTesto = (mappa: "client" | "server", nome: string, extra?: ReactNode) => {
    const info = ETICHETTE[nome] ?? { label: nome };
    const id = `metodo-${mappa}-${nome}`;
    return (
      <div key={nome}>
        <FormLabel htmlFor={id}>{info.label}</FormLabel>
        <div className="mt-2 flex gap-2">
          <FormInput
            id={id}
            value={valori[mappa][nome] ?? ""}
            placeholder={info.placeholder}
            onChange={(e) => aggiornaMappa(mappa, nome, e.target.value)}
          />
          {extra}
        </div>
        {info.aiuto && <div className="mt-1 text-xs text-slate-500">{info.aiuto}</div>}
      </div>
    );
  };

  const suggerisci = (mappa: "client" | "server", nome: string, valore: string) => (
    <Tippy content={valore}>
      <Button
        type="button"
        variant="outline-secondary"
        className="shrink-0 whitespace-nowrap"
        onClick={() => aggiornaMappa(mappa, nome, valore)}
      >
        <Lucide icon="Wand2" className="w-4 h-4 mr-1.5" />
        Suggerito
      </Button>
    </Tippy>
  );

  const pulsanteImporta = (chi: "discovery" | "metadata-url", abilitato: boolean) => (
    <Button
      type="button"
      variant="outline-primary"
      className="shrink-0 whitespace-nowrap"
      loading={importazione === chi}
      disabled={!abilitato || importazione !== null}
      onClick={() => importa(chi)}
    >
      <Lucide icon="Download" className="w-4 h-4 mr-1.5" />
      Importa
    </Button>
  );

  const campoSegreto = (nome: string, facoltativo: boolean) => {
    const stato = provider?.segreti[nome] ?? "assente";
    const daRimuovere = valori.segreti_da_rimuovere.includes(nome);
    const id = `metodo-segreto-${nome}`;
    return (
      <div key={nome}>
        <div className="flex items-center justify-between gap-2">
          <FormLabel htmlFor={id} className="mb-0">{ETICHETTE_SEGRETI[nome] ?? nome}</FormLabel>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATO_SEGRETO[daRimuovere ? "assente" : stato].classe}`}>
            {daRimuovere ? "Verrà rimosso" : STATO_SEGRETO[stato].testo}
          </span>
        </div>
        {nome === "sp_private_key" ? (
          <FormTextarea
            id={id}
            rows={4}
            className="mt-2 font-mono text-xs"
            autoComplete="off"
            value={valori.segreti[nome] ?? ""}
            placeholder={stato === "assente" ? "-----BEGIN PRIVATE KEY-----" : "Lascia vuoto per mantenere la chiave salvata"}
            onChange={(e) => aggiornaMappa("segreti", nome, e.target.value)}
          />
        ) : (
          <FormInput
            className="mt-2"
            id={id}
            type="password"
            autoComplete="new-password"
            value={valori.segreti[nome] ?? ""}
            placeholder={stato === "assente" ? "" : "Lascia vuoto per mantenere il valore salvato"}
            onChange={(e) => aggiornaMappa("segreti", nome, e.target.value)}
          />
        )}
        {facoltativo && stato !== "assente" && (
          <div className="mt-1 flex justify-end text-xs">
            <button
              type="button"
              className="font-medium text-danger hover:underline"
              onClick={() => aggiorna(
                "segreti_da_rimuovere",
                daRimuovere ? valori.segreti_da_rimuovere.filter((s) => s !== nome) : [...valori.segreti_da_rimuovere, nome],
              )}
            >
              {daRimuovere ? "Annulla rimozione" : "Rimuovi"}
            </button>
          </div>
        )}
      </div>
    );
  };

  const flag = (nome: string) => {
    const info = ETICHETTE[nome] ?? { label: nome };
    const id = `metodo-flag-${nome}`;
    return (
      <div key={nome}>
        <FormSwitch>
          <FormSwitch.Input
            id={id}
            type="checkbox"
            checked={valori.flag[nome] ?? false}
            onChange={(e) => setValori((a) => ({ ...a, flag: { ...a.flag, [nome]: e.target.checked } }))}
          />
          <FormSwitch.Label htmlFor={id}>{info.label}</FormSwitch.Label>
        </FormSwitch>
        {info.aiuto && <div className="mt-1 text-xs text-slate-500">{info.aiuto}</div>}
      </div>
    );
  };

  const anteprima = {
    id: provider?.id ?? "anteprima",
    codice: valori.codice || "anteprima",
    nome: valori.nome || "Nome del metodo",
    descrizione: valori.descrizione || undefined,
    icona: valori.icona || "Key",
    tipo,
    ordine: 0,
    attivo: valori.attivo,
  };

  return (
    <Dialog open={open} onClose={onClose} size="2xl">
      <Dialog.Panel className="overflow-hidden lg:w-[980px] xl:w-[1080px]">
        <form onSubmit={invia} className="flex max-h-[calc(100vh-8rem)] flex-col">
          <Dialog.Title className="gap-3 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                <Lucide icon={modifica ? "PencilLine" : "KeyRound"} className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-semibold text-slate-800">
                  {modifica ? `Modifica ${provider?.nome}` : "Nuovo metodo di accesso"}
                </div>
                <div className="text-sm font-normal text-slate-500">
                  {modifica ? `Codice ${provider?.codice}` : "Configurazione del metodo e del pulsante nella pagina di login"}
                </div>
              </div>
            </div>
          </Dialog.Title>

          <Dialog.Description className="min-h-0 flex-1 overflow-y-auto p-0">
            <div className="space-y-5 bg-slate-50/50 px-5 py-5">
              {errore && (
                <div role="alert" className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger flex items-start gap-2">
                  <Lucide icon="AlertTriangle" className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errore}</span>
                </div>
              )}

              <div className="grid gap-5 xl:grid-cols-2">
                <div className="space-y-5">
                  {!modifica && (
                    <Sezione titolo="Tipo di metodo" descrizione="Non si cambia dopo la creazione.">
                      <div role="radiogroup" aria-label="Tipo di metodo" className="grid gap-3">
                        {TIPI_METODO.filter((t) => t.value !== "internal").map((t) => {
                          const scelto = tipo === t.value;
                          return (
                            <button
                              key={t.value}
                              type="button"
                              role="radio"
                              aria-checked={scelto}
                              onClick={() => cambiaTipo(t.value)}
                              className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${scelto ? "border-primary/40 bg-primary/5" : "border-slate-200 bg-white hover:border-primary/30"}`}
                            >
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${scelto ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}>
                                <Lucide icon={t.icona} className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-slate-800">{t.label}</div>
                                <div className="mt-0.5 text-xs text-slate-500">{t.descrizione}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </Sezione>
                  )}

                  <Sezione titolo="Dati del metodo" descrizione="Come il metodo compare nella pagina di login.">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <FormLabel htmlFor="metodo-codice">Codice</FormLabel>
                        <FormInput
                          className="mt-2"
                          id="metodo-codice"
                          value={valori.codice}
                          readOnly={modifica}
                          placeholder="entra_id"
                          onChange={(e) => aggiorna("codice", e.target.value.toLowerCase())}
                        />
                        <div className="mt-1 text-xs text-slate-500">Fa parte degli indirizzi di ritorno: non si cambia dopo la creazione.</div>
                      </div>
                      <div>
                        <FormLabel htmlFor="metodo-nome">Nome</FormLabel>
                        <FormInput className="mt-2" id="metodo-nome" value={valori.nome} maxLength={100} onChange={(e) => aggiorna("nome", e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <FormLabel htmlFor="metodo-descrizione">Descrizione</FormLabel>
                      <FormInput className="mt-2" id="metodo-descrizione" value={valori.descrizione} onChange={(e) => aggiorna("descrizione", e.target.value)} />
                    </div>
                    <IconInput
                      label="Icona"
                      name="metodo-icona"
                      value={valori.icona}
                      mostraAnteprima={false}
                      helperText="Nome di un'icona Lucide oppure un'immagine."
                      onChange={(v) => aggiorna("icona", v)}
                    />
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Anteprima nella pagina di login</div>
                      <div className="mt-3 max-w-sm">
                        <ProviderCard provider={anteprima} isExpanded={false} onClick={() => undefined} index={0} />
                      </div>
                    </div>
                    <div className="grid gap-3 rounded-md border border-slate-200/80 bg-slate-50/80 p-4">
                      <FormSwitch>
                        <FormSwitch.Input id="metodo-attivo" type="checkbox" checked={valori.attivo} onChange={(e) => aggiorna("attivo", e.target.checked)} />
                        <FormSwitch.Label htmlFor="metodo-attivo">Attivo nella pagina di login</FormSwitch.Label>
                      </FormSwitch>
                      {!modifica && (
                        <div className="text-xs text-slate-500">Consigliato: crealo disattivato, usa "Prova" e poi attivalo.</div>
                      )}
                    </div>
                    {tipo === "internal" && !valori.attivo && (
                      <Avviso tono="ambra" icona="AlertTriangle">
                        Disattivato, nessuno potrà entrare con email e password. Verifica prima che un altro metodo funzioni:
                        in caso di blocco si riattiva con <code className="font-mono">yarn auth:segreti --riattiva-email-password</code>.
                      </Avviso>
                    )}
                  </Sezione>

                  {(tipo === "oidc" || tipo === "saml") && (
                    <Sezione
                      titolo="Restrizioni"
                      descrizione="Applicate dopo che il fornitore ha riconosciuto l'utente. Senza restrizioni entra chiunque sia registrato in Fidelity."
                    >
                      <div>
                        <FormLabel htmlFor="metodo-domini">Domini email ammessi</FormLabel>
                        <FormInput
                          className="mt-2"
                          id="metodo-domini"
                          value={valori.domini_ammessi}
                          placeholder="esempio.it, gruppo.esempio.it"
                          onChange={(e) => aggiorna("domini_ammessi", e.target.value)}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white px-4 py-3">
                          <div className="text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">Tipi utente ammessi</span>
                            {" · "}
                            {valori.ruoli_ammessi.length === 0 ? "tutti" : `${valori.ruoli_ammessi.length} su ${TIPI_UTENTE.length}`}
                          </div>
                          <button
                            type="button"
                            className="text-xs font-medium text-primary hover:underline"
                            onClick={() => aggiorna("ruoli_ammessi", tuttiIRuoli ? [] : [...TIPI_UTENTE])}
                          >
                            {tuttiIRuoli ? "Deseleziona tutti" : "Seleziona tutti"}
                          </button>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {TIPI_UTENTE.map((ruolo) => {
                            const scelto = valori.ruoli_ammessi.includes(ruolo);
                            return (
                              <FormCheck
                                key={ruolo}
                                className={`items-start gap-3 rounded-xl border px-3 py-3 transition ${scelto ? "border-primary/40 bg-primary/5" : "border-slate-200 bg-white"}`}
                              >
                                <FormCheck.Input
                                  id={`metodo-ruolo-${ruolo}`}
                                  type="checkbox"
                                  className="mt-0.5 shrink-0"
                                  checked={scelto}
                                  onChange={(e) => aggiorna(
                                    "ruoli_ammessi",
                                    e.target.checked ? [...valori.ruoli_ammessi, ruolo] : valori.ruoli_ammessi.filter((r) => r !== ruolo),
                                  )}
                                />
                                <FormCheck.Label htmlFor={`metodo-ruolo-${ruolo}`} className="ml-0 flex-1 text-sm font-medium text-slate-700">
                                  {ruolo}
                                </FormCheck.Label>
                              </FormCheck>
                            );
                          })}
                        </div>
                        {ruoliScartati.length > 0 && (
                          <div className="mt-3">
                            <Avviso tono="ambra" icona="AlertTriangle">
                              Valori non riconosciuti, tolti al salvataggio: {ruoliScartati.join(", ")}
                            </Avviso>
                          </div>
                        )}
                      </div>
                    </Sezione>
                  )}
                </div>

                <div className="space-y-5">
                  {tipo === "oidc" && (
                    <Sezione titolo="OpenID Connect" descrizione={`Authorization Code con PKCE. ${NOTA_SEGRETI}`}>
                      {campoTesto("client", "discovery_url", pulsanteImporta("discovery", !!valori.client.discovery_url))}
                      {campoTesto("client", "authorize_url")}
                      {campoTesto("server", "token_url")}
                      {campoTesto("server", "jwks_uri")}
                      {campoTesto("server", "expected_issuer")}
                      {campoTesto("client", "client_id")}
                      {campoSegreto("client_secret", false)}
                      {campoTesto("client", "redirect_uri", suggerisci("client", "redirect_uri", suggeriti.oidcRedirect))}
                      {campoTesto("client", "scope")}
                    </Sezione>
                  )}

                  {tipo === "saml" && (
                    <>
                      <Sezione titolo="Identity provider" descrizione="Importa i metadati dell'IdP oppure compila i campi a mano.">
                        {campoTesto("server", "metadata_url", pulsanteImporta("metadata-url", !!valori.server.metadata_url))}
                        <div>
                          <FormLabel htmlFor="metodo-xml">Oppure incolla i metadati XML</FormLabel>
                          <FormTextarea id="metodo-xml" rows={3} className="mt-2 font-mono text-xs" value={xmlMetadati} onChange={(e) => setXmlMetadati(e.target.value)} />
                          <div className="mt-2 flex justify-end">
                            <Button
                              type="button"
                              variant="outline-primary"
                              size="sm"
                              loading={importazione === "metadata-xml"}
                              disabled={!xmlMetadati.trim() || importazione !== null}
                              onClick={() => importa("metadata-xml")}
                            >
                              <Lucide icon="FileCode2" className="w-4 h-4 mr-1.5" />
                              Importa dall'XML
                            </Button>
                          </div>
                        </div>
                        {campoTesto("server", "entry_point")}
                        {campoTesto("server", "idp_issuer")}
                        <div>
                          <FormLabel htmlFor="metodo-idp-certs">Certificati di firma dell'IdP</FormLabel>
                          <FormTextarea
                            id="metodo-idp-certs"
                            rows={5}
                            className="mt-2 font-mono text-xs"
                            value={valori.idp_certs}
                            placeholder="-----BEGIN CERTIFICATE-----"
                            onChange={(e) => aggiorna("idp_certs", e.target.value)}
                          />
                          <div className="mt-1 text-xs text-slate-500">Più certificati, uno dopo l'altro, durante il rinnovo del certificato dell'IdP.</div>
                        </div>
                      </Sezione>

                      <Sezione titolo="Service provider (Fidelity)" descrizione={`Come Fidelity si presenta all'IdP e come legge la risposta. ${NOTA_SEGRETI}`}>
                        {campoTesto("server", "sp_entity_id", suggerisci("server", "sp_entity_id", suggeriti.samlEntityId))}
                        {campoTesto("server", "callback_url", suggerisci("server", "callback_url", suggeriti.samlAcs))}
                        {modifica && (
                          <Avviso tono="azzurro" icona="Info">
                            Registra Fidelity presso l'IdP con i{" "}
                            <a href={suggeriti.samlMetadata} target="_blank" rel="noreferrer" className="font-medium underline">
                              metadati del service provider
                            </a>.
                          </Avviso>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <FormLabel htmlFor="metodo-server-signature_algorithm">{ETICHETTE.signature_algorithm.label}</FormLabel>
                            <FormSelect
                              className="mt-2"
                              id="metodo-server-signature_algorithm"
                              value={valori.server.signature_algorithm || "sha256"}
                              onChange={(e) => aggiornaMappa("server", "signature_algorithm", e.target.value)}
                            >
                              <option value="sha256">SHA-256</option>
                              <option value="sha512">SHA-512</option>
                              <option value="sha1">SHA-1 (sconsigliato)</option>
                            </FormSelect>
                          </div>
                          {campoTesto("server", "clock_skew_ms")}
                        </div>
                        {campoTesto("server", "identifier_format")}
                        <div className="grid gap-4 sm:grid-cols-3">
                          {campoTesto("server", "attributo_email")}
                          {campoTesto("server", "attributo_nome")}
                          {campoTesto("server", "attributo_cognome")}
                        </div>
                        <div className="grid gap-3 rounded-md border border-slate-200/80 bg-slate-50/80 p-4 md:grid-cols-2">
                          {CAMPI_SERVER_BOOLEANI.saml.map(({ nome }) => flag(nome))}
                        </div>
                        {campoSegreto("sp_private_key", true)}
                        <div>
                          <FormLabel htmlFor="metodo-sp-cert">Certificato del service provider</FormLabel>
                          <FormTextarea
                            id="metodo-sp-cert"
                            rows={3}
                            className="mt-2 font-mono text-xs"
                            value={valori.sp_certificate}
                            onChange={(e) => aggiorna("sp_certificate", e.target.value)}
                          />
                          <div className="mt-1 text-xs text-slate-500">Facoltativi, insieme alla chiave: firmano le richieste e compaiono nei metadati.</div>
                        </div>
                      </Sezione>
                    </>
                  )}

                  {tipo === "custom" && (
                    <Sezione titolo="Collegamento esterno" descrizione="Il pulsante apre questo indirizzo. Fidelity non verifica l'utente.">
                      {campoTesto("client", "redirect_uri")}
                    </Sezione>
                  )}

                  <Sezione titolo="Recupero password" descrizione="Facoltativo: indirizzo esterno proposto nella pagina di recupero password.">
                    {campoTesto("client", "password_reset_url")}
                  </Sezione>
                </div>
              </div>
            </div>
          </Dialog.Description>

          <Dialog.Footer className="flex flex-col-reverse gap-3 bg-white sm:flex-row sm:justify-end">
            <Button variant="outline-secondary" type="button" onClick={onClose} disabled={submitting} className="w-full sm:w-auto">
              Annulla
            </Button>
            <Button variant="primary" type="submit" loading={submitting} className="w-full sm:w-auto">
              {modifica ? "Salva modifiche" : "Crea metodo"}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
};

export default MetodoFormDialog;
