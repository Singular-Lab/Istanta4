import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import StatCard from "@/components/Base/StatCard";
import Table from "@/components/Base/Table";
import { formatNumero } from "@/utils/format";
import { MAX_SCARTATE_ANTEPRIMA, type AnteprimaImportVendite } from "../../../lib/vendite/tipi";
import { conteggio, formatPeriodo } from "./formato";

interface AnteprimaImportProps {
  anteprima: AnteprimaImportVendite;
  nomeFile: string;
  onConferma: () => void;
  /** Scarta l'anteprima per scegliere un altro file. */
  onAltroFile: () => void;
  /** L'avvio dell'import e' partito e aspetta la risposta. */
  avvioInCorso?: boolean;
  /** Un import della GDO e' in corso: si conferma quando finisce. */
  importInCorso?: boolean;
}

/**
 * Cosa importerebbe il file, letto con il tracciato del cliente senza scrivere nulla: righe,
 * importabili, scartate con il motivo, periodo, prodotti e punti vendita. L'import parte solo con
 * "Conferma import", e solo se c'e' almeno una riga importabile.
 */
export function AnteprimaImport({
  anteprima,
  nomeFile,
  onConferma,
  onAltroFile,
  avvioInCorso = false,
  importInCorso = false,
}: AnteprimaImportProps) {
  const elencate = anteprima.dettaglioScartate.length;
  const troncate = anteprima.scartate > elencate;
  const nienteDaImportare = anteprima.importabili <= 0;
  const confermabile = !nienteDaImportare && !importInCorso && !avvioInCorso;

  return (
    <section aria-label="Anteprima dell'import" className="flex flex-col gap-4 border-t border-dashed border-slate-200 pt-4 dark:border-darkmode-400">
      <div className="flex flex-col gap-1">
        <h3 className="title-card">Anteprima di {nomeFile}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Tracciato: <strong className="font-medium text-slate-700 dark:text-slate-200">{anteprima.tracciato.nome}</strong>
          {anteprima.tracciato.colonne.length > 0 && (
            <>
              {" · colonne: "}
              {anteprima.tracciato.colonne.map((colonna, i) => (
                <span key={`${colonna}-${i}`}>
                  {i > 0 && ", "}
                  <code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-700 dark:bg-darkmode-400 dark:text-slate-200">
                    {colonna}
                  </code>
                </span>
              ))}
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard densita="compatta" tono="neutral" etichetta="Righe nel file" valore={formatNumero(anteprima.righe)} />
        <StatCard densita="compatta" tono="success" evidenzia etichetta="Importabili" valore={formatNumero(anteprima.importabili)} />
        <StatCard
          densita="compatta"
          tono={anteprima.scartate > 0 ? "danger" : "neutral"}
          evidenzia={anteprima.scartate > 0}
          etichetta="Scartate"
          valore={formatNumero(anteprima.scartate)}
        />
        <StatCard
          densita="compatta"
          tono="neutral"
          etichetta="Periodo"
          valore={formatPeriodo(anteprima.periodo?.dal, anteprima.periodo?.al)}
        />
        <StatCard densita="compatta" tono="neutral" etichetta="Prodotti" valore={formatNumero(anteprima.prodotti)} />
        <StatCard densita="compatta" tono="neutral" etichetta="Punti vendita" valore={formatNumero(anteprima.puntiVendita)} />
      </div>

      {anteprima.scartate > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Righe scartate: non vengono importate
          </h4>
          {elencate > 0 && (
            <div className="max-h-72 overflow-auto rounded-card border border-slate-200 dark:border-darkmode-400">
              <Table sm aria-label="Righe scartate">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th className="w-24 text-right">Riga</Table.Th>
                    <Table.Th>Motivo</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {anteprima.dettaglioScartate.map((scartata, i) => (
                    <Table.Tr key={`${scartata.riga}-${i}`}>
                      <Table.Td className="text-right tabular-nums">{formatNumero(scartata.riga)}</Table.Td>
                      <Table.Td className="text-danger">{scartata.motivo}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          )}
          {troncate && (
            <p className="text-xs text-slate-500">
              L&apos;anteprima elenca al massimo {formatNumero(MAX_SCARTATE_ANTEPRIMA)} righe scartate: qui ne vedi{" "}
              {formatNumero(elencate)} su {conteggio(anteprima.scartate, "scartata", "scartate")}.
            </p>
          )}
        </div>
      )}

      {nienteDaImportare && (
        <Alert variant="soft-warning" icona="TriangleAlert" titolo="Nessuna riga importabile" className="px-3 py-2 text-sm">
          {anteprima.tracciato.colonne.length > 0
            ? `Controlla che il file abbia le colonne del tracciato ${anteprima.tracciato.nome} (${anteprima.tracciato.colonne.join(", ")}), correggilo e caricalo di nuovo.`
            : "Correggi il file e caricalo di nuovo: il motivo di ogni riga è nell'elenco delle scartate."}
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="text-xs text-slate-500 sm:mr-auto">
          {importInCorso
            ? "Un import delle vendite è in corso: potrai confermare questo file quando sarà terminato."
            : "Le righe dello stesso prodotto, punto vendita e periodo già presenti vengono sostituite."}
        </span>
        <Button variant="outline-secondary" onClick={onAltroFile} disabled={avvioInCorso}>
          Scegli un altro file
        </Button>
        <Button variant="primary" onClick={onConferma} disabled={!confermabile} loading={avvioInCorso}>
          <Lucide icon="Upload" aria-hidden="true" className="mr-1.5 h-4 w-4" />
          Conferma import
        </Button>
      </div>
    </section>
  );
}

export default AnteprimaImport;
