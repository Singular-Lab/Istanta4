import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { Link } from "react-router-dom";
import { percorsoKit, type PeriodoMateriali } from "../../../lib/materiali/periodi";
import { STATI_KIT_MATERIALI, type FormatoPop, type PromoMateriali, type StatoKitMateriali } from "../../../lib/materiali/tipi";
import { MOTIVO_SENZA_DOWNLOAD, urlZipFormato } from "./scaricamenti";

/** Segmenti della barra e legenda, nell'ordine della lavorazione; stessi colori dei pallini di StatusBadge. */
const SEGMENTI: Readonly<Record<StatoKitMateriali, { legenda: string; colore: string }>> = {
  NON_AVVIATO: { legenda: "Non avviati", colore: "bg-slate-400" },
  IN_LAVORAZIONE: { legenda: "In lavorazione", colore: "bg-sky-500" },
  IN_LAVORAZIONE_CON_ERRORI: { legenda: "Con errori", colore: "bg-amber-500" },
  IN_REVISIONE: { legenda: "In revisione", colore: "bg-theme-1" },
  PUBBLICATO: { legenda: "Pubblicati", colore: "bg-teal-500" },
};

/** Testo equivalente della barra, per le tecnologie assistive. */
export const descriviAvanzamento = (filePerStato: Partial<Record<StatoKitMateriali, number>>): string => {
  const parti = STATI_KIT_MATERIALI.filter((stato) => (filePerStato[stato] ?? 0) > 0).map(
    (stato) => `${formatNumero(filePerStato[stato])} ${SEGMENTI[stato].legenda.toLowerCase()}`
  );
  return parti.length > 0 ? `File per stato del kit: ${parti.join(", ")}` : "Nessun file";
};

function BarraAvanzamento({ filePerStato }: { filePerStato: Partial<Record<StatoKitMateriali, number>> }) {
  const totale = STATI_KIT_MATERIALI.reduce((somma, stato) => somma + (filePerStato[stato] ?? 0), 0);
  return (
    <span
      role="img"
      aria-label={descriviAvanzamento(filePerStato)}
      className="flex h-2 w-32 overflow-hidden rounded-full bg-slate-100"
    >
      {totale > 0 &&
        STATI_KIT_MATERIALI.filter((stato) => (filePerStato[stato] ?? 0) > 0).map((stato) => (
          <span
            key={stato}
            className={twMerge("h-full", SEGMENTI[stato].colore)}
            style={{ width: `${((filePerStato[stato] ?? 0) / totale) * 100}%` }}
          />
        ))}
    </span>
  );
}

function LegendaAvanzamento() {
  return (
    <ul aria-label="Legenda dell'avanzamento" className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-3 text-xs text-slate-500">
      {STATI_KIT_MATERIALI.map((stato) => (
        <li key={stato} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={twMerge("h-2 w-2 rounded-full", SEGMENTI[stato].colore)} />
          {SEGMENTI[stato].legenda}
        </li>
      ))}
    </ul>
  );
}

interface TabellaFormatiProps {
  promo: PromoMateriali;
  periodo: PeriodoMateriali;
  formati: FormatoPop[];
  idFormatoSelezionato: string;
  /** Indirizzo che seleziona un formato (resta sulla stessa promo). */
  percorsoFormato: (idFormato: string) => string;
  puoScaricare: boolean;
  puoAprireKit: boolean;
}

/** Formati POP della promo: file, avanzamento per stato del kit, kit che li contengono e ZIP del formato. */
function TabellaFormati({
  promo,
  periodo,
  formati,
  idFormatoSelezionato,
  percorsoFormato,
  puoScaricare,
  puoAprireKit,
}: TabellaFormatiProps) {
  return (
    <Sezione
      senzaPadding
      titolo="File per formato"
      descrizione="Scegli un formato per vederne i file qui sotto; Apri kit porta al dettaglio del kit che li contiene."
    >
      {!puoScaricare && (
        <p className="flex items-center gap-1.5 px-5 pb-3 text-xs text-slate-500">
          <Lucide icon="Lock" aria-hidden="true" className="h-3.5 w-3.5" />
          {MOTIVO_SENZA_DOWNLOAD}
        </p>
      )}
      <div className="overflow-x-auto border-t border-dashed border-slate-200">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Formato</Table.Th>
              <Table.Th className="text-right">File</Table.Th>
              <Table.Th>Avanzamento</Table.Th>
              <Table.Th>Kit</Table.Th>
              <Table.Th className="text-right">
                <span className="sr-only">Azioni</span>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {formati.map((formato) => {
              const selezionato = formato.id === idFormatoSelezionato;
              return (
                <Table.Tr key={formato.id} className={twMerge(selezionato && "bg-theme-1/5")}>
                  <Table.Td>
                    <Link
                      to={percorsoFormato(formato.id)}
                      aria-current={selezionato ? "true" : undefined}
                      className={twMerge(
                        "inline-flex items-center gap-2 font-medium text-slate-700 hover:text-theme-1",
                        selezionato && "text-theme-1"
                      )}
                    >
                      <Lucide icon="LayoutTemplate" aria-hidden="true" className="h-4 w-4 flex-none text-slate-400" />
                      {formato.nome}
                    </Link>
                  </Table.Td>
                  <Table.Td className="text-right tabular-nums">{formatNumero(formato.numeroFile)}</Table.Td>
                  <Table.Td>
                    <BarraAvanzamento filePerStato={formato.filePerStatoKit} />
                  </Table.Td>
                  <Table.Td>
                    <ul className="space-y-1.5">
                      {formato.kit.map((kit, indice) => (
                        <li key={kit.id ?? `${kit.idDesign ?? indice}-${kit.area.id}-${kit.canale.id}`} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-slate-700">
                            {kit.area.nome} · {kit.canale.nome}
                          </span>
                          <StatusBadge dominio="kitRuntime" stato={kit.stato} />
                          {puoAprireKit && (
                            <Link
                              to={percorsoKit(promo.id, promo.stato, kit.id)}
                              aria-label={`Apri kit ${kit.titolo}`}
                              className="text-xs font-medium text-theme-1 hover:underline"
                            >
                              Apri kit
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Table.Td>
                  <Table.Td className="text-right">
                    {puoScaricare ? (
                      <Button
                        as="a"
                        href={urlZipFormato(promo.id, periodo, formato.id)}
                        download
                        aria-label={`Scarica ZIP di ${formato.nome}`}
                        size="sm"
                        variant="outline-secondary"
                        className="whitespace-nowrap"
                      >
                        <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                        Scarica ZIP
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline-secondary"
                        disabled
                        aria-label={`Scarica ZIP di ${formato.nome}`}
                        title={MOTIVO_SENZA_DOWNLOAD}
                        className="whitespace-nowrap"
                      >
                        <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                        Scarica ZIP
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </div>
      <LegendaAvanzamento />
    </Sezione>
  );
}

export default TabellaFormati;
