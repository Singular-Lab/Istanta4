import Alert from "@/components/Base/Alert";
import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Segmenti, { type OpzioneSegmento } from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { useNotification } from "@/context/NotificationContext";
import { usePermissionContext } from "@/context/PermissionContext";
import { METODI_ACCESSO_QUERY_KEY, useFetchAuthProvidersAdmin } from "@/query/query";
import { formatNumero } from "@/utils/format";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
    <Lucide icon={icona} aria-hidden="true" className={`h-6 w-6 ${colore}`} />
    <div>
      <div className="font-semibold text-slate-800">{titolo}</div>
      <div className="text-sm text-slate-500">{messaggio}</div>
    </div>
  </div>
);

const OPZIONI_FILTRO: OpzioneSegmento<FiltroMetodi>[] = FILTRI_METODI.map((f) => ({ valore: f.value, etichetta: f.label }));

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
      <Pagina
        titolo="Metodi di accesso"
        descrizione="I metodi con cui gli utenti entrano in Fidelity: email e password, OpenID Connect, SAML 2.0 e collegamenti esterni."
        azioni={
          !loading && canAccess ? (
            <Button variant="primary" onClick={() => setDialogo({})}>
              <Lucide icon="Plus" aria-hidden="true" className="mr-2 h-4 w-4" />
              Nuovo metodo
            </Button>
          ) : undefined
        }
      >
        {loading ? (
          <Sezione>
            <div role="status" className="flex items-center gap-3 text-slate-500">
              <Spinner decorativo />
              Verifica permessi in corso...
            </div>
          </Sezione>
        ) : !canAccess ? (
          <UnauthorizedState />
        ) : (
          <>
            {providers.length > 0 && (
              <StatCardGrid className="lg:grid-cols-3">
                <StatCard densita="compatta" etichetta="Metodi" valore={formatNumero(providers.length)} icona="KeyRound" tono="brand" />
                <StatCard densita="compatta" etichetta="Attivi" valore={formatNumero(attivi)} icona="CircleCheck" tono="success" />
                <StatCard
                  densita="compatta"
                  etichetta="Segreti in chiaro"
                  valore={formatNumero(inChiaro)}
                  icona="LockOpen"
                  tono={inChiaro > 0 ? "warning" : "neutral"}
                  evidenzia={inChiaro > 0}
                />
              </StatCardGrid>
            )}

            {/* Segreti in chiaro */}
            {inChiaro > 0 && (
              <Alert
                variant="soft-warning"
                icona="ShieldAlert"
                titolo={inChiaro === 1 ? "1 segreto è salvato in chiaro" : `${inChiaro} segreti sono salvati in chiaro`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Funzionano già, ma vanno cifrati con la chiave dell'installazione (FICO_SECRET). Se FICO_SECRET cambia, i segreti cifrati andranno reinseriti.
                  </span>
                  <Button variant="primary" size="sm" loading={migra.isPending} disabled={occupato} onClick={() => migra.mutate(true)} className="flex-none">
                    {!migra.isPending && <Lucide icon="Lock" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
                    Cifra segreti in chiaro
                  </Button>
                </div>
              </Alert>
            )}

            <Sezione
              titolo="Metodi configurati"
              descrizione="L'ordine è quello della pagina di login. I segreti restano sul server, cifrati, e non vengono mai mostrati."
            >
              {providers.length > 0 && (
                <BarraFiltri
                  variante="interna"
                  destra={
                    !riordinabile ? (
                      <span className="text-xs text-slate-400">Per riordinare, mostra tutti i metodi senza ricerca.</span>
                    ) : undefined
                  }
                >
                  <CampoRicerca
                    etichetta="Cerca metodi di accesso"
                    placeholder="Cerca per nome o codice..."
                    value={ricerca}
                    onChange={setRicerca}
                  />
                  <Segmenti
                    etichetta="Mostra"
                    opzioni={OPZIONI_FILTRO}
                    valore={filtro}
                    onChange={setFiltro}
                  />
                </BarraFiltri>
              )}

              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Spinner etichetta="Caricamento metodi di accesso..." />
                </div>
              ) : isError ? (
                <PageError
                  compatta
                  titolo="Metodi di accesso non caricati"
                  motivo={messaggioErrore(error, "Impossibile caricare i metodi di accesso")}
                  onRiprova={() => refetch()}
                />
              ) : providers.length === 0 ? (
                <EmptyState
                  compatta
                  icon="KeyRound"
                  title="Nessun metodo di accesso"
                  description="Crea il primo metodo con cui gli utenti entreranno in Fidelity."
                  buttonText="Nuovo metodo"
                  buttonIcon="Plus"
                  onButtonClick={() => setDialogo({})}
                />
              ) : filtrati.length === 0 ? (
                <EmptyState
                  compatta
                  icon="SearchX"
                  title="Nessun risultato"
                  description="Nessun metodo corrisponde alla ricerca o al filtro selezionato."
                  buttonText="Azzera filtri"
                  buttonIcon="X"
                  onButtonClick={azzeraFiltri}
                />
              ) : (
                <div className="flex flex-col gap-4">
                  {filtrati.map((provider) => (
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
                  ))}
                </div>
              )}
            </Sezione>
          </>
        )}
      </Pagina>

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
                <Alert variant="soft-warning" icona="TriangleAlert" className="mt-3 text-xs">
                  Verifica prima che un altro metodo funzioni. In caso di blocco si riattiva con
                  <code className="font-mono"> yarn auth:segreti --riattiva-email-password</code>.
                </Alert>
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
