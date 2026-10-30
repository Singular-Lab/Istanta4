import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState, type DragEvent } from "react";
import type { EsitoFileExport, EsitoImportExport } from "../../../lib/puntiVendita/storia";
import { ServerCall } from "../../../lib/server_call";

interface ImportStoricoVolantiniProps {
  open: boolean;
  onClose: () => void;
}

// Gli stessi limiti del server (StoriaPuntoVenditaController): oltre, la richiesta viene rifiutata intera
export const MASSIMO_FILE_EXPORT = 300;
const MEGABYTE = 1024 * 1024;
export const DIMENSIONE_MASSIMA_EXPORT = 10 * MEGABYTE;

const eJson = (f: File) => f.name.toLowerCase().endsWith(".json") || f.type === "application/json";

/** Prima gli scartati, che sono quelli su cui intervenire; poi i registrati, nell'ordine del server. */
export const fileInOrdine = (file: EsitoFileExport[]) => [
  ...file.filter(f => f.esito === "scartato"),
  ...file.filter(f => f.esito !== "scartato"),
];

const quota = (parte: number, totale: number) => (totale > 0 ? Math.round((parte / totale) * 100) : null);

/**
 * Importa la storia dei punti vendita dagli export JSON del Plugin InDesign (contratto in
 * lib/puntiVendita/storia.ts): per ogni file il server dice se l'ha registrato o scartato, e
 * quante righe della lista dei punti vendita ha abbinato all'anagrafica. I file si trascinano
 * nell'area o si scelgono; il resoconto mette in cima gli scartati, con il motivo.
 */
export function ImportStoricoVolantini({ open, onClose }: ImportStoricoVolantiniProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File[]>([]);
  // File trascinati che non sono .json: non partono, ma si dice quanti sono
  const [ignorati, setIgnorati] = useState(0);
  const [trascinamento, setTrascinamento] = useState(false);
  const queryClient = useQueryClient();

  const importa = useMutation({
    mutationFn: (scelti: File[]) => {
      const formData = new FormData();
      for (const f of scelti) formData.append("file", f);
      return ServerCall.post<EsitoImportExport>("/punti-vendita/storia/import-export", formData, true);
    },
    onSuccess: () => {
      // La storia delle schede già aperte va riletta, con l'elenco, la rete per insegna e la gestione
      queryClient.invalidateQueries({ queryKey: ["puntiVendita", "storia"] });
      queryClient.invalidateQueries({ queryKey: ["puntiVendita", "consultazione"] });
      queryClient.invalidateQueries({ queryKey: ["puntiVendita", "rete"] });
      queryClient.invalidateQueries({ queryKey: ["puntiVendita", "gestione"] });
    },
  });
  const esito = importa.data;
  const righeEsito = useMemo(() => fileInOrdine(esito?.file ?? []), [esito]);
  const quotaAbbinate = esito ? quota(esito.abbinate, esito.righe) : null;

  const troppi = file.length > MASSIMO_FILE_EXPORT;
  const pesanti = file.filter(f => f.size > DIMENSIONE_MASSIMA_EXPORT);
  const importabile = file.length > 0 && !troppi && pesanti.length === 0;

  const prendi = (scelti: File[]) => {
    const json = scelti.filter(eJson);
    setIgnorati(scelti.length - json.length);
    if (json.length === 0) return;
    setFile(json);
    importa.reset();
  };

  const scegli = (e: React.ChangeEvent<HTMLInputElement>) => {
    const scelti = Array.from(e.target.files ?? []);
    e.target.value = ""; // per poter riscegliere gli stessi file
    if (scelti.length === 0) return;
    prendi(scelti);
  };

  const lascia = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setTrascinamento(false);
    if (importa.isPending) return;
    prendi(Array.from(e.dataTransfer.files ?? []));
  };

  const ricomincia = () => {
    setFile([]);
    setIgnorati(0);
    importa.reset();
    inputRef.current?.click();
  };

  const chiudi = () => {
    if (importa.isPending) return;
    setFile([]);
    setIgnorati(0);
    importa.reset();
    onClose();
  };

  return (
    <Dialog size="xl" open={open} onClose={chiudi}>
      <Dialog.Panel>
        <Dialog.Title>Importa la storia dai volantini</Dialog.Title>
        <Dialog.Description>
          <div className="flex flex-col gap-4">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <p>
                Scegli gli export JSON del Plugin InDesign: sono i file nella cartella <strong>EXPORT</strong> di ogni
                promozione. Da ciascuno Fidelity legge la lista dei punti vendita stampata nel volantino e la abbina ai
                punti vendita dell&apos;anagrafica: la storia compare nella scheda di ogni punto vendita.
              </p>
              <p className="mt-2">L&apos;anagrafica dei punti vendita non viene modificata.</p>
            </div>

            {/* Area di rilascio: i file si trascinano qui o si scelgono dal pulsante */}
            <div
              onDragOver={e => {
                e.preventDefault();
                if (!importa.isPending) setTrascinamento(true);
              }}
              onDragLeave={() => setTrascinamento(false)}
              onDrop={lascia}
              className={twMerge(
                "flex flex-col items-center gap-2 rounded-card border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition-colors dark:border-darkmode-400 dark:bg-darkmode-800/50",
                trascinamento && "border-primary bg-primary/5 dark:border-primary"
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".json,application/json"
                multiple
                aria-label="File JSON degli export"
                className="hidden"
                onChange={scegli}
              />
              <Lucide icon="FileJson" aria-hidden="true" className="h-6 w-6 text-slate-400" />
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                <strong className="text-slate-700 dark:text-slate-200">Trascina qui i file .json</strong>
                <span className="text-slate-500">oppure</span>
                <Button size="sm" variant="outline-secondary" onClick={() => inputRef.current?.click()} disabled={importa.isPending}>
                  <Lucide icon="Upload" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  Scegli i file JSON
                </Button>
              </div>
              <div className="text-xs text-slate-500">
                Fino a {formatNumero(MASSIMO_FILE_EXPORT)} file, {DIMENSIONE_MASSIMA_EXPORT / MEGABYTE} MB ciascuno
              </div>
              {file.length > 0 && (
                <div className="mt-1 w-full max-w-md text-xs text-slate-600 dark:text-slate-300">
                  <div className="font-medium">
                    {file.length === 1 ? file[0].name : `${formatNumero(file.length)} file scelti`}
                  </div>
                  {file.length > 1 && (
                    <ul aria-label="File scelti" className="mt-1 max-h-24 overflow-y-auto text-left text-slate-500">
                      {file.map(f => (
                        <li key={`${f.name}-${f.size}`} className="truncate">{f.name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {ignorati > 0 && (
              <p className="text-xs text-slate-500">
                {ignorati === 1 ? "1 file ignorato: non è un .json." : `${formatNumero(ignorati)} file ignorati: non sono .json.`}
              </p>
            )}
            {troppi && (
              <Alert variant="soft-warning" icona="TriangleAlert" className="px-3 py-2 text-sm">
                Al massimo {formatNumero(MASSIMO_FILE_EXPORT)} file per volta: ne hai scelti {formatNumero(file.length)}.
              </Alert>
            )}
            {pesanti.length > 0 && (
              <Alert variant="soft-warning" icona="TriangleAlert" className="px-3 py-2 text-sm">
                Ogni export può pesare al massimo {DIMENSIONE_MASSIMA_EXPORT / MEGABYTE} MB: {pesanti.map(f => f.name).join(", ")}.
              </Alert>
            )}

            {importa.isError && (
              <Alert variant="soft-danger" icona="CircleAlert" className="px-3 py-2 text-sm" role="alert">
                Importazione non riuscita: {(importa.error as Error)?.message || "errore del server"}
              </Alert>
            )}

            {esito && (
              <div role="status" aria-label="Esito dell'importazione" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2 tabular-nums">
                  <StatusBadge
                    tono="success"
                    etichetta={esito.registrati === 1 ? "1 registrato" : `${formatNumero(esito.registrati)} registrati`}
                  />
                  <StatusBadge
                    tono={esito.scartati > 0 ? "danger" : "neutral"}
                    etichetta={esito.scartati === 1 ? "1 scartato" : `${formatNumero(esito.scartati)} scartati`}
                  />
                  <StatusBadge tono="neutral" etichetta={esito.righe === 1 ? "1 riga" : `${formatNumero(esito.righe)} righe`} />
                  <StatusBadge
                    tono="info"
                    etichetta={`${formatNumero(esito.abbinate)} abbinate${quotaAbbinate === null ? "" : ` (${quotaAbbinate}%)`}`}
                  />
                </div>
                <div className="max-h-72 overflow-auto rounded-card border border-slate-200 dark:border-darkmode-400">
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>File</Table.Th>
                        <Table.Th>Esito</Table.Th>
                        <Table.Th className="text-right">Righe</Table.Th>
                        <Table.Th className="text-right">Abbinate</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {righeEsito.map((f, i) => (
                        <Table.Tr key={`${f.nomeFile}-${i}`}>
                          <Table.Td className="max-w-64">
                            <div className="truncate font-medium" title={f.nomeFile}>{f.nomeFile}</div>
                            {/* Per gli scartati il motivo, per i registrati il volantino in cui è finito */}
                            <div
                              className={twMerge("truncate text-xs", f.esito === "scartato" ? "text-danger" : "text-slate-500")}
                              title={f.motivo}
                            >
                              {f.esito === "scartato"
                                ? f.motivo ?? "Scartato senza motivo"
                                : [f.kit?.nome, f.promo?.nome].filter(Boolean).join(" · ") || "-"}
                            </div>
                          </Table.Td>
                          <Table.Td>
                            {f.esito === "registrato" ? (
                              <StatusBadge tono="success" etichetta="Registrato" icon="CircleCheck" />
                            ) : (
                              <StatusBadge tono="danger" etichetta="Scartato" icon="CircleAlert" />
                            )}
                          </Table.Td>
                          <Table.Td className="text-right tabular-nums">{f.esito === "scartato" && f.righe === 0 ? "-" : formatNumero(f.righe)}</Table.Td>
                          <Table.Td className="text-right tabular-nums">{f.esito === "scartato" ? "-" : formatNumero(f.abbinate)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </Dialog.Description>
        <Dialog.Footer className="sm:items-center">
          <span className="text-xs text-slate-500 sm:mr-auto">
            Si può ripetere: un nuovo import dello stesso kit sostituisce le sue righe precedenti.
          </span>
          <Button variant="outline-secondary" onClick={chiudi} disabled={importa.isPending}>
            {esito ? "Chiudi" : "Annulla"}
          </Button>
          {esito ? (
            <Button variant="primary" onClick={ricomincia}>
              <Lucide icon="Upload" aria-hidden="true" className="mr-2 h-4 w-4" />
              Importa altri file
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => importa.mutate(file)}
              disabled={!importabile}
              loading={importa.isPending}
            >
              {file.length > 1 ? `Importa ${formatNumero(file.length)} file` : "Importa"}
            </Button>
          )}
        </Dialog.Footer>
      </Dialog.Panel>
    </Dialog>
  );
}

export default ImportStoricoVolantini;
