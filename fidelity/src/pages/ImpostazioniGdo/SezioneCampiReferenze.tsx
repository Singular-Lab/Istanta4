import Alert from "@/components/Base/Alert";
import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormField, FormInput } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import StatusBadge from "@/components/Base/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { useNotification } from "@/context/NotificationContext";
import { useCampiNonTradotti, useSalvaCampiReferenze, useSyncCampoNonTradotto } from "@/query/impostazioniGdo";
import { useState } from "react";
import type { ConfigWebpliant } from "../../../lib/types";
import { useBozza } from "./useBozza";

type CampoReferenza = ConfigWebpliant["data_fields_refs"][number];

/**
 * Mapping dei campi delle referenze: il nome con cui un campo arriva (input) e quello che usa
 * Fidelity (output). I campi base non si toccano. Il Sync porta il nome nuovo nelle referenze già
 * arrivate con quello vecchio, solo per i mapping salvati.
 */
function SezioneCampiReferenze({ campi }: { campi: CampoReferenza[] }) {
  const { showNotification } = useNotification();
  const salva = useSalvaCampiReferenze();
  const { bozza, setBozza, modificata } = useBozza(campi);
  const [nuovoInput, setNuovoInput] = useState("");
  const [nuovoOutput, setNuovoOutput] = useState("");
  const [ricerca, setRicerca] = useState("");
  const [inModifica, setInModifica] = useState<number | null>(null);
  const [modificaInput, setModificaInput] = useState("");
  const [modificaOutput, setModificaOutput] = useState("");
  /** Nome originale del mapping di cui si sta confermando il Sync. */
  const [syncDaConfermare, setSyncDaConfermare] = useState<string | null>(null);

  const { data: campiNonTradotti = [] } = useCampiNonTradotti();
  const sync = useSyncCampoNonTradotto();

  /** Il Sync vale per il mapping salvato: se la riga è stata cambiata e non salvata, niente pulsante. */
  const daSincronizzare = (campo: CampoReferenza) =>
    campiNonTradotti.find((c) => c.campo === campo.expected_input && c.tradotto === campo.expected_output && c.referenze > 0);

  const esisteGia = (input: string, output: string, escluso: number | null) =>
    bozza.some((campo, i) => i !== escluso && (campo.expected_input === input || campo.expected_output === output));

  const aggiungi = () => {
    const input = nuovoInput.trim();
    const output = nuovoOutput.trim();
    if (!input || !output) return;
    if (esisteGia(input, output, null)) {
      showNotification("Campo già esistente: un mapping con questo input o output è già nell'elenco.", { variant: "warning" });
      return;
    }
    setBozza([...bozza, { expected_input: input, expected_output: output, core: false }]);
    setNuovoInput("");
    setNuovoOutput("");
  };

  const iniziaModifica = (indice: number) => {
    setInModifica(indice);
    setModificaInput(bozza[indice].expected_input);
    setModificaOutput(bozza[indice].expected_output);
  };

  const annullaModifica = () => {
    setInModifica(null);
    setModificaInput("");
    setModificaOutput("");
  };

  const confermaModifica = () => {
    const input = modificaInput.trim();
    const output = modificaOutput.trim();
    if (inModifica === null || !input || !output) return;
    if (esisteGia(input, output, inModifica)) {
      showNotification("Campo già esistente: un mapping con questo input o output è già nell'elenco.", { variant: "warning" });
      return;
    }
    setBozza(bozza.map((campo, i) => (i === inModifica ? { ...campo, expected_input: input, expected_output: output } : campo)));
    annullaModifica();
  };

  const sposta = (indice: number, verso: -1 | 1) => {
    const destinazione = indice + verso;
    if (destinazione < 0 || destinazione >= bozza.length) return;
    const nuovi = [...bozza];
    [nuovi[indice], nuovi[destinazione]] = [nuovi[destinazione], nuovi[indice]];
    setBozza(nuovi);
  };

  const sincronizza = (campo: string) =>
    sync.mutate(campo, {
      onSuccess: (esito) => {
        setSyncDaConfermare(null);
        showNotification(`Sync di «${esito.campo}» completato: ${esito.referenze} referenze ora hanno «${esito.tradotto}».`, {
          variant: "success",
        });
      },
      onError: () =>
        showNotification("Sync non riuscito: nessuna referenza è stata modificata. Riprova più tardi.", { variant: "error" }),
    });

  const salvaCampi = () =>
    salva.mutate(
      { campiReferenze: bozza },
      {
        onSuccess: () => showNotification("Campi delle referenze salvati", { variant: "success" }),
        onError: (errore) => showNotification(`Campi non salvati: ${errore.message}`, { variant: "error" }),
      }
    );

  const cercato = ricerca.trim().toLowerCase();
  const visibili = bozza
    .map((campo, indice) => ({ campo, indice }))
    .filter(
      ({ campo }) =>
        !cercato ||
        campo.expected_input?.toLowerCase().includes(cercato) ||
        campo.expected_output?.toLowerCase().includes(cercato)
    );
  const inCorso = inModifica !== null;

  return (
    <Sezione
      id="campi-referenze"
      className="scroll-mt-24"
      icona="ArrowLeftRight"
      titolo="Campi delle referenze"
      descrizione={
        <>
          Come si traduce un campo delle referenze dal nome con cui arriva (input) a quello che usa Fidelity (output).
          <span className="font-medium text-primary"> I campi base sono essenziali e non si possono modificare.</span>
        </>
      }
      azioni={
        <Button
          variant="primary"
          size="sm"
          onClick={salvaCampi}
          loading={salva.isPending}
          disabled={!modificata || inCorso || salva.isPending}
        >
          Salva campi
        </Button>
      }
    >
      <div className="mb-5 flex flex-col gap-4 rounded-card border border-slate-200 bg-slate-50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField etichetta="Campo originale (input)">
            <FormInput
              type="text"
              placeholder="es. titolo, prezzo, descrizione…"
              value={nuovoInput}
              onChange={(e) => setNuovoInput(e.target.value)}
            />
          </FormField>
          <FormField etichetta="Campo tradotto (output)">
            <FormInput
              type="text"
              placeholder="es. title, price, description…"
              value={nuovoOutput}
              onChange={(e) => setNuovoOutput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  aggiungi();
                }
              }}
            />
          </FormField>
        </div>
        <div className="flex justify-end">
          <Button variant="outline-secondary" onClick={aggiungi} disabled={!nuovoInput.trim() || !nuovoOutput.trim() || inCorso}>
            <Lucide icon="Plus" aria-hidden="true" className="mr-2 h-4 w-4" />
            Aggiungi mapping di traduzione
          </Button>
        </div>
        {inCorso && (
          <Alert variant="soft-warning" icona="TriangleAlert">
            Completa la modifica del mapping in corso prima di aggiungerne uno nuovo.
          </Alert>
        )}
      </div>

      <div className="rounded-card border border-slate-200 bg-white">
        <BarraFiltri
          className="p-4"
          destra={
            <span className="text-sm text-slate-500">
              Totale: <span className="tabular-nums">{bozza.length}</span> mapping, di cui base:{" "}
              <span className="tabular-nums">{bozza.filter((c) => c.core).length}</span>
            </span>
          }
        >
          <CampoRicerca
            etichetta="Cerca campi"
            placeholder="Cerca campi…"
            value={ricerca}
            onChange={setRicerca}
            disabled={inCorso}
            title={inCorso ? "La ricerca è disabilitata durante la modifica" : undefined}
          />
        </BarraFiltri>
        <div className="max-h-[32rem] overflow-y-auto">
          {visibili.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {visibili.map(({ campo, indice }) => {
                const modifica = inModifica === indice;
                const base = campo.core === true;
                const daSync = !modifica ? daSincronizzare(campo) : undefined;
                return (
                  <li
                    key={`${indice}-${campo.expected_input}`}
                    className={`p-4 transition-colors ${modifica ? "border-l-4 border-primary bg-primary/5" : base ? "border-l-4 border-info bg-info/5" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-grow space-y-2">
                        {base && <StatusBadge tono="info" etichetta="Campo base" icon="Shield" />}
                        {modifica ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <FormField etichetta="Campo originale">
                                <FormInput type="text" value={modificaInput} onChange={(e) => setModificaInput(e.target.value)} />
                              </FormField>
                              <FormField etichetta="Campo tradotto" aiuto="Premi Invio per confermare, Esc per annullare.">
                                <FormInput
                                  type="text"
                                  value={modificaOutput}
                                  onChange={(e) => setModificaOutput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      confermaModifica();
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      annullaModifica();
                                    }
                                  }}
                                />
                              </FormField>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline-secondary" size="sm" onClick={annullaModifica}>
                                <Lucide icon="X" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                Annulla
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={confermaModifica}
                                disabled={!modificaInput.trim() || !modificaOutput.trim()}
                              >
                                <Lucide icon="Check" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                Conferma
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <dt className="title-eyebrow mb-1">Campo originale</dt>
                              <dd className={`rounded-control px-3 py-2 font-mono text-sm ${base ? "border border-info/20 bg-info/10 text-info" : "bg-slate-100 text-slate-700"}`}>
                                {campo.expected_input}
                              </dd>
                            </div>
                            <div>
                              <dt className="title-eyebrow mb-1">Campo tradotto</dt>
                              <dd className={`rounded-control px-3 py-2 font-mono text-sm ${base ? "border border-info/20 bg-info/10 text-info" : "bg-slate-100 text-slate-700"}`}>
                                {campo.expected_output}
                              </dd>
                            </div>
                          </dl>
                        )}

                        {daSync &&
                          (syncDaConfermare === daSync.campo ? (
                            <div
                              className="rounded-control border border-warning/30 bg-warning/10 p-3"
                              role="alertdialog"
                              aria-label={`Conferma il Sync di ${daSync.campo}`}
                            >
                              <p className="text-sm text-slate-700">
                                In <strong className="tabular-nums">{daSync.referenze}</strong> referenze il campo <code>{daSync.campo}</code>{" "}
                                diventa <code>{daSync.tradotto}</code>. Dove <code>{daSync.tradotto}</code> c'è già, resta il suo valore.
                                Da qui non si annulla.
                              </p>
                              <div className="mt-2 flex gap-2">
                                <Button variant="outline-secondary" size="sm" onClick={() => setSyncDaConfermare(null)} disabled={sync.isPending}>
                                  Annulla
                                </Button>
                                <Button variant="primary" size="sm" onClick={() => sincronizza(daSync.campo)} disabled={sync.isPending}>
                                  <Lucide
                                    icon="RefreshCw"
                                    aria-hidden="true"
                                    className={`mr-1.5 h-3.5 w-3.5 ${sync.isPending ? "animate-spin" : ""}`}
                                  />
                                  Conferma Sync
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge tono="warning" etichetta={`${daSync.referenze} referenze da sincronizzare`} />
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => setSyncDaConfermare(daSync.campo)}
                                disabled={inCorso || sync.isPending}
                                aria-label={`Sincronizza il mapping ${daSync.campo}`}
                              >
                                <Lucide icon="RefreshCw" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                Sync
                              </Button>
                            </div>
                          ))}
                      </div>

                      {!modifica && (
                        <div className="flex flex-none items-center gap-1">
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => iniziaModifica(indice)}
                            title={base ? "Campo base non modificabile" : "Modifica"}
                            aria-label={`Modifica il mapping ${campo.expected_input}`}
                            disabled={base || inCorso}
                          >
                            <Lucide icon="Pencil" aria-hidden="true" className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => sposta(indice, -1)}
                            disabled={indice === 0 || inCorso}
                            title="Sposta su"
                            aria-label={`Sposta su ${campo.expected_input}`}
                          >
                            <Lucide icon="ChevronUp" aria-hidden="true" className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => sposta(indice, 1)}
                            disabled={indice === bozza.length - 1 || inCorso}
                            title="Sposta giù"
                            aria-label={`Sposta giù ${campo.expected_input}`}
                          >
                            <Lucide icon="ChevronDown" aria-hidden="true" className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => setBozza(bozza.filter((_, i) => i !== indice))}
                            disabled={base || inCorso}
                            title={base ? "Campo base non eliminabile" : "Elimina"}
                            aria-label={`Elimina il mapping ${campo.expected_input}`}
                          >
                            <Lucide icon="Trash2" aria-hidden="true" className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              compatta
              icon="SearchX"
              title={bozza.length === 0 ? "Nessun mapping" : "Nessun campo trovato"}
              description={bozza.length === 0 ? "Aggiungi un mapping di traduzione per i campi delle referenze." : "Nessun mapping corrisponde alla ricerca."}
            />
          )}
        </div>
      </div>
    </Sezione>
  );
}

export default SezioneCampiReferenze;
