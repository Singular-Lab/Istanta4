import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import { useSchermoStretto } from "@/components/PuntiVendita/useSchermoStretto";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { STATO_LAVORAZIONE_KIT_RUNTIME } from "../../../lib/enums";
import { percorsoKit, soloKitPubblicati, type PeriodoMateriali } from "../../../lib/materiali/periodi";
import { STATI_KIT_MATERIALI, type FormatoPop, type PromoMateriali, type StatoKitMateriali } from "../../../lib/materiali/tipi";
import { MOTIVO_SENZA_DOWNLOAD, MOTIVO_SENZA_FILE, useScaricaZipPop } from "./scaricamenti";

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

function BarraAvanzamento({
  filePerStato,
  className,
}: {
  filePerStato: Partial<Record<StatoKitMateriali, number>>;
  className?: string;
}) {
  const totale = STATI_KIT_MATERIALI.reduce((somma, stato) => somma + (filePerStato[stato] ?? 0), 0);
  // Binario slate-200: resta visibile anche sul fondo della riga scelta
  return (
    <span
      role="img"
      aria-label={descriviAvanzamento(filePerStato)}
      className={twMerge("flex h-2 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-darkmode-400", className)}
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

/** Stati che un kit può avere nel periodo: in Attivi e Storico ci sono solo kit pubblicati. */
export const statiKitDelPeriodo = (periodo: PeriodoMateriali): readonly StatoKitMateriali[] =>
  soloKitPubblicati(periodo)
    ? STATI_KIT_MATERIALI.filter((stato) => stato === STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO)
    : STATI_KIT_MATERIALI;

function LegendaAvanzamento({ stati }: { stati: readonly StatoKitMateriali[] }) {
  return (
    <ul aria-label="Legenda dell'avanzamento" className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-3 text-xs text-slate-500">
      {stati.map((stato) => (
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
  /** Un formato è stato scelto: i suoi file vanno portati in vista. */
  onSceltaFormato: () => void;
  puoScaricare: boolean;
  puoAprireKit: boolean;
}

/**
 * Formati POP della promo: file, avanzamento per stato del kit, kit che li contengono (si aprono a
 * richiesta, così le righe restano basse) e ZIP del formato.
 */
function TabellaFormati({
  promo,
  periodo,
  formati,
  idFormatoSelezionato,
  percorsoFormato,
  onSceltaFormato,
  puoScaricare,
  puoAprireKit,
}: TabellaFormatiProps) {
  const idTabella = useId();
  const [kitAperti, setKitAperti] = useState<ReadonlySet<string>>(new Set());
  const { inPreparazione, scarica } = useScaricaZipPop(promo.id);
  // Sotto sm la tabella taglierebbe Kit e ZIP: ogni formato diventa una scheda
  const stretto = useSchermoStretto();

  const alternaKit = (idFormato: string) =>
    setKitAperti((attuali) => {
      const prossimi = new Set(attuali);
      if (prossimi.has(idFormato)) prossimi.delete(idFormato);
      else prossimi.add(idFormato);
      return prossimi;
    });

  // I pezzi di un formato, uguali nella riga della tabella e nella scheda
  const pezzi = (formato: FormatoPop, indice: number) => {
    const selezionato = formato.id === idFormatoSelezionato;
    const kitAperto = kitAperti.has(formato.id);
    const idKit = `${idTabella}-kit-${indice}`;
    const motivoSenzaZip = !puoScaricare
      ? MOTIVO_SENZA_DOWNLOAD
      : formato.numeroFile === 0
        ? MOTIVO_SENZA_FILE
        : undefined;
    const zipInPreparazione = inPreparazione === formato.id;
    return {
      selezionato,
      nome: (
        <Link
          to={percorsoFormato(formato.id)}
          onClick={onSceltaFormato}
          aria-current={selezionato ? "true" : undefined}
          className={twMerge(
            "inline-flex min-w-0 items-center gap-2 font-medium text-slate-700 [overflow-wrap:anywhere] hover:text-theme-1 dark:text-slate-200",
            selezionato && "text-theme-1 dark:text-indigo-200"
          )}
        >
          <Lucide icon="LayoutTemplate" aria-hidden="true" className="h-4 w-4 flex-none text-slate-400" />
          {formato.nome}
        </Link>
      ),
      pulsanteKit: (
        <button
          type="button"
          aria-expanded={kitAperto}
          aria-controls={idKit}
          aria-label={`${formatNumero(formato.kit.length)} kit di ${formato.nome}`}
          onClick={() => alternaKit(formato.id)}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-control text-sm text-slate-700 hover:text-theme-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:text-slate-200"
        >
          <Lucide icon={kitAperto ? "ChevronDown" : "ChevronRight"} aria-hidden="true" className="h-4 w-4 flex-none text-slate-400" />
          {formatNumero(formato.kit.length)} kit
        </button>
      ),
      elencoKit: (
        <ul id={idKit} hidden={!kitAperto} className="mt-2 space-y-1.5">
          {formato.kit.map((kit, indiceKit) => (
            <li key={kit.id ?? `${kit.idDesign ?? indiceKit}-${kit.area.id}-${kit.canale.id}`} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-700 dark:text-slate-200">
                {kit.area.nome} · {kit.canale.nome}
              </span>
              <StatusBadge dominio="kitRuntime" stato={kit.stato} />
              {puoAprireKit && (
                <Link
                  to={percorsoKit(promo.id, promo.stato, kit.id)}
                  aria-label={`Apri kit ${kit.titolo}`}
                  className="text-xs font-medium text-theme-1 hover:underline dark:text-indigo-200"
                >
                  Apri kit
                </Link>
              )}
            </li>
          ))}
        </ul>
      ),
      zip: (
        <Button
          type="button"
          size="sm"
          variant="outline-secondary"
          aria-label={`Scarica ZIP di ${formato.nome}`}
          title={motivoSenzaZip}
          disabled={motivoSenzaZip !== undefined}
          loading={zipInPreparazione}
          onClick={() => void scarica(formato.id, { periodo, idFormato: formato.id })}
          className="whitespace-nowrap"
        >
          {!zipInPreparazione && <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
          Scarica ZIP
        </Button>
      ),
    };
  };

  return (
    <Sezione
      senzaPadding
      titolo="File per formato"
      descrizione="Scegli un formato per vederne i file qui sotto; dai suoi kit si apre il dettaglio del kit."
    >
      {!puoScaricare && (
        <p className="flex items-center gap-1.5 px-5 pb-3 text-xs text-slate-500">
          <Lucide icon="Lock" aria-hidden="true" className="h-3.5 w-3.5" />
          {MOTIVO_SENZA_DOWNLOAD}
        </p>
      )}
      {stretto ? (
        <ul aria-label="Formati" className="divide-y divide-slate-100 border-t border-dashed border-slate-200 dark:divide-darkmode-400 dark:border-darkmode-400">
          {formati.map((formato, indice) => {
            const { selezionato, nome, pulsanteKit, elencoKit, zip } = pezzi(formato, indice);
            return (
              <li key={formato.id} className={twMerge("flex flex-col gap-2.5 px-5 py-4", selezionato && "bg-theme-1/5")}>
                <div className="flex items-start justify-between gap-3">
                  {nome}
                  <span className="flex-none whitespace-nowrap text-sm tabular-nums text-slate-600 dark:text-slate-300">
                    {formatNumero(formato.numeroFile)} file
                  </span>
                </div>
                <BarraAvanzamento filePerStato={formato.filePerStatoKit} className="w-full" />
                <div className="flex items-center justify-between gap-3">
                  {pulsanteKit}
                  {zip}
                </div>
                {elencoKit}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto border-t border-dashed border-slate-200 dark:border-darkmode-400">
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
              {formati.map((formato, indice) => {
                const { selezionato, nome, pulsanteKit, elencoKit, zip } = pezzi(formato, indice);
                return (
                  <Table.Tr key={formato.id} className={twMerge("align-top", selezionato && "bg-theme-1/5")}>
                    <Table.Td className="min-w-40">{nome}</Table.Td>
                    <Table.Td className="text-right tabular-nums dark:text-slate-200">{formatNumero(formato.numeroFile)}</Table.Td>
                    <Table.Td>
                      <BarraAvanzamento filePerStato={formato.filePerStatoKit} className="mt-1.5" />
                    </Table.Td>
                    <Table.Td>
                      {pulsanteKit}
                      {elencoKit}
                    </Table.Td>
                    <Table.Td className="text-right">{zip}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </div>
      )}
      <LegendaAvanzamento stati={statiKitDelPeriodo(periodo)} />
    </Sezione>
  );
}

export default TabellaFormati;
