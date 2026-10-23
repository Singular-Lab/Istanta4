import Button from "@/components/Base/Button";
import LoadingIcon from "@/components/Base/LoadingIcon";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { useNotification } from "@/context/NotificationContext";
import { usePermissionContext } from "@/context/PermissionContext";
import { METODI_ACCESSO_QUERY_KEY, useFetchAuthProvidersAdmin } from "@/query/query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { ServerCall } from "../../../lib/server_call";
import type {
  AuthProviderAdminDTO,
  AuthProviderInput,
  EsitoMigrazioneSegreti,
  EsitoVerificaProvider,
} from "../../../lib/types";
import UnauthorizedState from "../GestioneHub/components/UnauthorizedState";
import MetodoCard from "./components/MetodoCard";
import MetodoFormDialog from "./components/MetodoFormDialog";
import VerificaDialog from "./components/VerificaDialog";
import { contaSegretiInChiaro, filtraMetodi, FILTRI_METODI, spostaMetodo, type FiltroMetodi } from "./utils";

type Conferma =
  | { tipo: "elimina"; provider: AuthProviderAdminDTO }
  | { tipo: "stato"; provider: AuthProviderAdminDTO }
  | { tipo: "cifra"; anteprima: EsitoMigrazioneSegreti };

const notifica = (icona: string, titolo: string, messaggio: string, colore: string) => (
  <div className="flex items-center gap-3">
    <Lucide icon={icona} className={`w-6 h-6 ${colore}`} />
    <div>
      <div className="font-semibold text-slate-800">{titolo}</div>
      <div className="text-sm text-slate-500">{messaggio}</div>
    </div>
  </div>
);

const messaggioErrore = (e: unknown, predefinito: string) => (e instanceof Error && e.message ? e.message : predefinito);

function GestioneMetodiAccesso() {
  const { hasPermission, loading } = usePermissionContext();
  const canAccess = hasPermission(PERMISSIONS.SISTEMA.GESTISCI_METODI_ACCESSO);
  const { data: providers = [], isLoading, isError, error, refetch } = useFetchAuthProvidersAdmin(canAccess);
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  const [dialogo, setDialogo] = useState<{ provider?: AuthProviderAdminDTO } | null>(null);
  const [conferma, setConferma] = useState<Conferma | null>(null);
  const [verifica, setVerifica] = useState<{ provider: AuthProviderAdminDTO; esiti: EsitoVerificaProvider[] | null } | null>(null);
  const [ricerca, setRicerca] = useState("");
  const [filtro, setFiltro] = useState<FiltroMetodi>("tutti");

  const filtrati = useMemo(() => filtraMetodi(providers, ricerca, filtro), [providers, ricerca, filtro]);
  // L'ordine e' quello della pagina di login: si cambia solo sull'elenco completo
  const riordinabile = filtro === "tutti" && !ricerca.trim();

  const ricarica = async () => {
    await queryClient.invalidateQueries({ queryKey: METODI_ACCESSO_QUERY_KEY });
    // La pagina di login legge l'elenco pubblico con questa chiave
    await queryClient.invalidateQueries({ queryKey: ["authProviders"] });
  };
  const successo = (titolo: string, messaggio: string) =>
    showNotification(notifica("CircleCheck", titolo, messaggio, "text-success"), { variant: "success" });
  const fallimento = (titolo: string, e: unknown) =>
    showNotification(notifica("CircleX", titolo, messaggioErrore(e, "Operazione non riuscita"), "text-danger"), { variant: "error" });

  const salva = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: AuthProviderInput }) =>
      id
        ? ServerCall.put<AuthProviderAdminDTO>(`/auth-providers/${id}`, payload)
        : ServerCall.post<AuthProviderAdminDTO>("/auth-providers", payload),
    onSuccess: async (provider) => {
      await ricarica();
      setDialogo(null);
      successo("Metodo di accesso salvato", `${provider.nome} è stato salvato.`);
    },
    onError: (e) => fallimento("Errore nel salvataggio", e),
  });

  const cambiaStato = useMutation({
    mutationFn: (provider: AuthProviderAdminDTO) =>
      ServerCall.put<AuthProviderAdminDTO>(`/auth-providers/${provider.id}`, { attivo: !provider.attivo }),
    onSuccess: async (provider) => {
      await ricarica();
      setConferma(null);
      successo(provider.attivo ? "Metodo attivato" : "Metodo disattivato", provider.nome);
    },
    onError: (e) => {
      setConferma(null);
      fallimento("Modifica non riuscita", e);
    },
  });

  const elimina = useMutation({
    mutationFn: (provider: AuthProviderAdminDTO) => ServerCall.delete(`/auth-providers/${provider.id}`),
    onSuccess: async (_, provider) => {
      await ricarica();
      setConferma(null);
      successo("Metodo eliminato", provider.nome);
    },
    onError: (e) => {
      setConferma(null);
      fallimento("Eliminazione non riuscita", e);
    },
  });

  const riordina = useMutation({
    mutationFn: (ids: string[]) => ServerCall.post<AuthProviderAdminDTO[]>("/auth-providers/riordina", { ids }),
    onSuccess: ricarica,
    onError: (e) => fallimento("Riordino non riuscito", e),
  });

  const migra = useMutation({
    mutationFn: (simulazione: boolean) =>
      ServerCall.post<EsitoMigrazioneSegreti>("/auth-providers/segreti/migra", { simulazione }),
    onSuccess: async (esito) => {
      if (esito.simulazione) {
        setConferma({ tipo: "cifra", anteprima: esito });
        return;
      }
      await ricarica();
      setConferma(null);
      successo("Segreti cifrati", `${esito.totaleCampi} segreti cifrati in ${esito.provider.length} metodi di accesso.`);
    },
    onError: (e) => {
      setConferma(null);
      fallimento("Cifratura non riuscita", e);
    },
  });

  const avviaVerifica = async (provider: AuthProviderAdminDTO) => {
    setVerifica({ provider, esiti: null });
    try {
      const esiti = await ServerCall.post<EsitoVerificaProvider[]>(`/auth-providers/${provider.id}/verifica`, {});
      setVerifica({ provider, esiti });
    } catch (e) {
      setVerifica({ provider, esiti: [{ controllo: "Verifica", esito: "errore", dettaglio: messaggioErrore(e, "Verifica non riuscita") }] });
    }
  };

  const ids = providers.map((p) => p.id);
  const attivi = providers.filter((p) => p.attivo).length;
  const inChiaro = contaSegretiInChiaro(providers);
  const occupato = cambiaStato.isPending || elimina.isPending || riordina.isPending || migra.isPending;
  const azzeraFiltri = () => {
    setRicerca("");
    setFiltro("tutti");
  };

  return (
    <>
      <PageHeader
        title="Metodi di accesso"
        description="I metodi con cui gli utenti entrano in Fidelity: email e password, OpenID Connect, SAML 2.0 e collegamenti esterni."
      />

      {loading ? (
        <div className="box box--stacked mt-6 p-8 flex items-center gap-3 text-slate-500">
          <Lucide icon="Loader2" className="w-5 h-5 animate-spin" />
          Verifica permessi in corso...
        </div>
      ) : !canAccess ? (
        <UnauthorizedState />
      ) : (
        <div className="mt-3.5 flex flex-col gap-4">
          {/* Header */}
          <div className="box box--stacked p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-800">Metodi di accesso</div>
                <div className="text-sm text-slate-500 mt-0.5">
                  L'ordine è quello della pagina di login. I segreti restano sul server, cifrati, e non vengono mai mostrati.
                </div>
              </div>
              <div className="flex flex-col gap-3 lg:items-end">
                <div className="flex items-center gap-3">
                  {providers.length > 0 && (
                    <div className="hidden lg:flex items-center gap-4 mr-2 text-sm">
                      <div className="text-center">
                        <div className="text-xl font-bold text-slate-800 leading-none">{providers.length}</div>
                        <div className="text-xs text-slate-500 mt-0.5">metodi</div>
                      </div>
                      <div className="w-px h-8 bg-slate-200" />
                      <div className="text-center">
                        <div className="text-xl font-bold text-emerald-600 leading-none">{attivi}</div>
                        <div className="text-xs text-slate-500 mt-0.5">attivi</div>
                      </div>
                      <div className="w-px h-8 bg-slate-200" />
                      <div className="text-center">
                        <div className={clsx("text-xl font-bold leading-none", inChiaro > 0 ? "text-amber-600" : "text-slate-800")}>{inChiaro}</div>
                        <div className="text-xs text-slate-500 mt-0.5">segreti in chiaro</div>
                      </div>
                    </div>
                  )}
                  <Button variant="primary" onClick={() => setDialogo({})} className="w-full sm:w-auto">
                    <Lucide icon="Plus" className="w-4 h-4 mr-2" />
                    Nuovo metodo
                  </Button>
                </div>
                {providers.length > 0 && (
                  <div className="relative">
                    <Lucide icon="Search" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={ricerca}
                      onChange={(e) => setRicerca(e.target.value)}
                      placeholder="Cerca per nome o codice..."
                      aria-label="Cerca metodi di accesso"
                      className="h-8 pl-8 pr-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary w-full sm:w-52"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Segreti in chiaro */}
          {inChiaro > 0 && (
            <div className="box box--stacked flex flex-col gap-3 border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3 flex-1">
                <Lucide icon="ShieldAlert" className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                <div className="text-sm">
                  <div className="font-medium text-amber-700">
                    {inChiaro === 1 ? "1 segreto è salvato in chiaro" : `${inChiaro} segreti sono salvati in chiaro`}
                  </div>
                  <div className="mt-0.5 text-amber-700/80">
                    Funzionano già, ma vanno cifrati con la chiave dell'installazione (FICO_SECRET). Se FICO_SECRET cambia, i segreti cifrati andranno reinseriti.
                  </div>
                </div>
              </div>
              <Button variant="primary" loading={migra.isPending} disabled={occupato} onClick={() => migra.mutate(true)} className="w-full sm:w-auto">
                <Lucide icon="Lock" className="w-4 h-4 mr-2" />
                Cifra segreti in chiaro
              </Button>
            </div>
          )}

          {/* Filtri */}
          {providers.length > 0 && (
            <div className="box box--stacked px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide mr-1">Mostra:</span>
                {FILTRI_METODI.map((pillola) => (
                  <button
                    key={pillola.value}
                    type="button"
                    onClick={() => setFiltro(pillola.value)}
                    className={clsx(
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition",
                      filtro === pillola.value
                        ? "bg-primary border-primary text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary"
                    )}
                  >
                    {pillola.label}
                  </button>
                ))}
                {!riordinabile && (
                  <span className="ml-auto text-xs text-slate-400">Per riordinare, mostra tutti i metodi senza ricerca.</span>
                )}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="box box--stacked p-10 flex items-center justify-center gap-3 text-slate-500">
              <LoadingIcon icon="oval" className="w-5 h-5" />
              Caricamento metodi di accesso...
            </div>
          ) : isError ? (
            <div className="box box--stacked flex flex-col items-center gap-3 p-10 text-center">
              <Lucide icon="TriangleAlert" className="h-8 w-8 text-danger" />
              <div className="text-sm text-slate-600">{messaggioErrore(error, "Impossibile caricare i metodi di accesso")}</div>
              <Button variant="outline-secondary" size="sm" onClick={() => refetch()}>Riprova</Button>
            </div>
          ) : providers.length === 0 ? (
            <div className="box box--stacked p-6">
              <EmptyState
                icon="KeyRound"
                title="Nessun metodo di accesso"
                description="Crea il primo metodo con cui gli utenti entreranno in Fidelity."
                buttonText="Nuovo metodo"
                buttonIcon="Plus"
                onButtonClick={() => setDialogo({})}
              />
            </div>
          ) : filtrati.length === 0 ? (
            <div className="box box--stacked p-6">
              <EmptyState
                icon="SearchX"
                title="Nessun risultato"
                description="Nessun metodo corrisponde alla ricerca o al filtro selezionato."
                buttonText="Azzera filtri"
                onButtonClick={azzeraFiltri}
              />
            </div>
          ) : (
            filtrati.map((provider) => (
              <MetodoCard
                key={provider.id}
                provider={provider}
                primo={ids[0] === provider.id}
                ultimo={ids[ids.length - 1] === provider.id}
                occupato={occupato}
                riordinabile={riordinabile}
                onSposta={(direzione) => riordina.mutate(spostaMetodo(ids, provider.id, direzione))}
                onCambiaStato={() => setConferma({ tipo: "stato", provider })}
                onProva={() => avviaVerifica(provider)}
                onModifica={() => setDialogo({ provider })}
                onElimina={() => setConferma({ tipo: "elimina", provider })}
              />
            ))
          )}
        </div>
      )}

      <MetodoFormDialog
        open={dialogo !== null}
        provider={dialogo?.provider}
        submitting={salva.isPending}
        onClose={() => setDialogo(null)}
        onSubmit={(payload) => salva.mutate({ id: dialogo?.provider?.id, payload })}
      />

      <VerificaDialog
        provider={verifica?.provider ?? null}
        esiti={verifica?.esiti ?? null}
        onRipeti={() => verifica && avviaVerifica(verifica.provider)}
        onClose={() => setVerifica(null)}
      />

      <ConfirmDialog
        open={conferma?.tipo === "elimina"}
        title="Eliminare il metodo di accesso?"
        description={conferma?.tipo === "elimina" && (
          <>
            Il metodo <strong>{conferma.provider.nome}</strong> ({conferma.provider.codice}) e i suoi segreti verranno eliminati.
            Gli utenti non potranno più entrare con questo metodo.
          </>
        )}
        confirmLabel="Elimina"
        loading={elimina.isPending}
        onClose={() => setConferma(null)}
        onConfirm={() => conferma?.tipo === "elimina" && elimina.mutate(conferma.provider)}
      />

      <ConfirmDialog
        open={conferma?.tipo === "stato"}
        title={conferma?.tipo === "stato" && conferma.provider.attivo ? "Disattivare il metodo?" : "Attivare il metodo?"}
        subtitle="Cambia la pagina di login per tutti"
        confirmVariant={conferma?.tipo === "stato" && conferma.provider.attivo ? "danger" : "primary"}
        description={conferma?.tipo === "stato" && (
          conferma.provider.attivo ? (
            <>
              <strong>{conferma.provider.nome}</strong> sparirà dalla pagina di login e nessuno potrà più entrare con questo metodo.
              {conferma.provider.tipo === "internal" && (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Verifica prima che un altro metodo funzioni. In caso di blocco si riattiva con
                  <code className="font-mono"> yarn auth:segreti --riattiva-email-password</code>.
                </div>
              )}
            </>
          ) : (
            <><strong>{conferma.provider.nome}</strong> comparirà nella pagina di login. Usa "Prova" per verificarne prima la configurazione.</>
          )
        )}
        confirmLabel={conferma?.tipo === "stato" && conferma.provider.attivo ? "Disattiva" : "Attiva"}
        loading={cambiaStato.isPending}
        onClose={() => setConferma(null)}
        onConfirm={() => conferma?.tipo === "stato" && cambiaStato.mutate(conferma.provider)}
      />

      <ConfirmDialog
        open={conferma?.tipo === "cifra"}
        title="Cifrare i segreti in chiaro?"
        subtitle="Con la chiave dell'installazione"
        confirmVariant="primary"
        description={conferma?.tipo === "cifra" && (
          conferma.anteprima.totaleCampi === 0 ? "Nessun segreto in chiaro da cifrare." : (
            <>
              Verranno cifrati:
              <ul className="mt-2 list-disc pl-5">
                {conferma.anteprima.provider.map((p) => (
                  <li key={p.codice}><span className="font-mono">{p.codice}</span>: {p.campi.join(", ")}</li>
                ))}
              </ul>
              <div className="mt-2">L'accesso continua a funzionare. Se FICO_SECRET cambia, i segreti cifrati andranno reinseriti.</div>
            </>
          )
        )}
        confirmLabel="Cifra"
        loading={migra.isPending}
        onClose={() => setConferma(null)}
        onConfirm={() => (conferma?.tipo === "cifra" && conferma.anteprima.totaleCampi > 0 ? migra.mutate(false) : setConferma(null))}
      />
    </>
  );
}

export default withSessionCheck(GestioneMetodiAccesso);
