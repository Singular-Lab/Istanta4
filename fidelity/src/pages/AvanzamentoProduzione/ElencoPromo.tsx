import Alert from "@/components/Base/Alert";
import Lucide from "@/components/Base/Lucide";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import { useSchermoStretto } from "@/components/PuntiVendita/useSchermoStretto";
import { descriviStato } from "@/constants/stati";
import { formatData, formatNumero } from "@/utils/format";
import { testoValidita } from "@/utils/materiali";
import { twMerge } from "@/utils/twMerge";
import dayjs from "dayjs";
import { useId } from "react";
import { Link } from "react-router-dom";
import { percorsoKit } from "../../../lib/materiali/periodi";
import { STATI_KIT_MATERIALI, type StatoKitMateriali } from "../../../lib/materiali/tipi";
import type { KitAvanzamento, PromoAvanzamento } from "../../../lib/produzione/avanzamento";
import { contaPerStato, descriviScadenza, ordinaKit } from "./modello";

/** Colori della barra e della legenda: gli stessi dei pallini di StatusBadge e della barra dei POP. */
const COLORE_STATO: Readonly<Record<StatoKitMateriali, string>> = {
  NON_AVVIATO: "bg-slate-400",
  IN_LAVORAZIONE: "bg-sky-500",
  IN_LAVORAZIONE_CON_ERRORI: "bg-amber-500",
  IN_REVISIONE: "bg-theme-1",
  PUBBLICATO: "bg-teal-500",
};

/** Legenda breve: "In lavorazione con errori" non entra accanto alla barra. */
const LEGENDA: Readonly<Record<StatoKitMateriali, string>> = {
  NON_AVVIATO: "Non avviati",
  IN_LAVORAZIONE: "In lavorazione",
  IN_LAVORAZIONE_CON_ERRORI: "Con errori",
  IN_REVISIONE: "In revisione",
  PUBBLICATO: "Pubblicati",
};

export const MOTIVO_NON_AVVIATI = "I kit non ancora avviati non sono disponibili: Istanta non ha risposto. Riprova tra poco.";

/** Colonne della riga della promo, uguali nell'intestazione dell'elenco. */
export const COLONNE_PROMO = "md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_10rem_1.25rem] md:items-center md:gap-5";

const giornoMese = (data: string | null) => (data ? dayjs(data).format("DD/MM") : null);

function KitPerStato({ kit, nonAvviatiDisponibili }: { kit: KitAvanzamento[]; nonAvviatiDisponibili: boolean }) {
  if (kit.length === 0) {
    return (
      <span className="text-xs text-slate-500">
        {nonAvviatiDisponibili ? "Nessun kit previsto" : "Kit non disponibili"}
      </span>
    );
  }
  const conteggi = contaPerStato(kit);
  const presenti = STATI_KIT_MATERIALI.filter((stato) => conteggi[stato] > 0);
  const descrizione = presenti.map((stato) => `${conteggi[stato]} ${LEGENDA[stato].toLowerCase()}`).join(", ");
  return (
    <span className="flex min-w-0 flex-col gap-1.5">
      <span
        role="img"
        aria-label={`Kit per stato: ${descrizione}`}
        className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-slate-200 dark:bg-darkmode-400"
      >
        {presenti.map((stato) => (
          <span key={stato} className={twMerge("h-full", COLORE_STATO[stato])} style={{ flexGrow: conteggi[stato] }} />
        ))}
      </span>
      <span aria-hidden="true" className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
        {presenti.map((stato) => (
          <span key={stato} className="inline-flex items-center gap-1.5">
            <span className={twMerge("h-1.5 w-1.5 rounded-full", COLORE_STATO[stato])} />
            {LEGENDA[stato]} <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{conteggi[stato]}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

/** File del kit: per i POP anche quanti sono accettati e quanti in errore. */
function FileDelKit({ kit }: { kit: KitAvanzamento }) {
  if (kit.id === null) return <span className="text-slate-400">—</span>;
  if (kit.tipo === "VOL") return <span className="tabular-nums">{formatNumero(kit.numeroFile)}</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 tabular-nums">
      <span>{formatNumero(kit.numeroFile)}</span>
      <span className="text-xs text-slate-500">{formatNumero(kit.fileAccettati)} accettati</span>
      {kit.fileInErrore > 0 && (
        <span className="text-xs font-medium text-danger">{formatNumero(kit.fileInErrore)} in errore</span>
      )}
    </span>
  );
}

function TipoKit({ kit }: { kit: KitAvanzamento }) {
  return (
    <span
      title={kit.tipo === "VOL" ? "Volantino" : "POP"}
      className="rounded bg-theme-1/10 px-1.5 py-0.5 text-2xs font-semibold tracking-wide text-theme-1 dark:bg-darkmode-400 dark:text-indigo-200"
    >
      {kit.tipo}
    </span>
  );
}

function AzioneKit({ promo, kit, puoAprire }: { promo: PromoAvanzamento; kit: KitAvanzamento; puoAprire: boolean }) {
  if (kit.id === null) return <span className="text-xs text-slate-500">Da avviare</span>;
  if (!puoAprire) return null;
  return (
    <Link
      to={percorsoKit(promo.id, promo.stato, kit.id)}
      aria-label={`Apri il kit ${kit.titolo}`}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-control text-sm font-medium text-theme-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:text-indigo-200"
    >
      Apri
      <Lucide icon="ArrowRight" aria-hidden="true" className="h-3.5 w-3.5" />
    </Link>
  );
}

const chiaveKit = (kit: KitAvanzamento, indice: number) => kit.id ?? `${kit.idDesign ?? indice}-${kit.area.id}-${kit.canale.id}`;

function KitDellaPromo({ promo, kit, puoAprire }: { promo: PromoAvanzamento; kit: KitAvanzamento[]; puoAprire: boolean }) {
  // Sotto sm la tabella taglierebbe stato e azione: ogni kit diventa una scheda
  const stretto = useSchermoStretto();
  const ordinati = ordinaKit(kit);

  if (stretto) {
    return (
      <ul aria-label={`Kit di ${promo.nome}`} className="divide-y divide-slate-100 rounded-control border border-slate-200 dark:divide-darkmode-400 dark:border-darkmode-400">
        {ordinati.map((voce, indice) => (
          <li key={chiaveKit(voce, indice)} className="flex flex-col gap-2 px-4 py-3 text-sm">
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0 font-medium text-slate-700 [overflow-wrap:anywhere] dark:text-slate-200">{voce.titolo}</span>
              <TipoKit kit={voce} />
            </span>
            <span className="text-xs text-slate-500">
              {voce.area.nome} · {voce.canale.nome}
              {voce.avviatoIl && ` · avviato il ${formatData(voce.avviatoIl)}`}
            </span>
            <span className="flex items-center justify-between gap-3">
              <StatusBadge dominio="kitRuntime" stato={voce.stato} />
              <AzioneKit promo={promo} kit={voce} puoAprire={puoAprire} />
            </span>
            {voce.id !== null && (
              <span className="text-xs text-slate-600 dark:text-slate-300">
                File: <FileDelKit kit={voce} />
              </span>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto rounded-control border border-slate-200 dark:border-darkmode-400">
      <Table sm aria-label={`Kit di ${promo.nome}`}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Kit</Table.Th>
            <Table.Th>Tipo</Table.Th>
            <Table.Th>Area · canale</Table.Th>
            <Table.Th>Stato</Table.Th>
            <Table.Th>File</Table.Th>
            <Table.Th>Avviato</Table.Th>
            <Table.Th className="text-right">
              <span className="sr-only">Azioni</span>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {ordinati.map((voce, indice) => (
            <Table.Tr key={chiaveKit(voce, indice)}>
              <Table.Td className="max-w-72 truncate font-medium text-slate-700 dark:text-slate-200" title={voce.titolo}>
                {voce.titolo}
              </Table.Td>
              <Table.Td>
                <TipoKit kit={voce} />
              </Table.Td>
              <Table.Td className="whitespace-nowrap">
                {voce.area.nome} · {voce.canale.nome}
              </Table.Td>
              <Table.Td>
                <StatusBadge dominio="kitRuntime" stato={voce.stato} />
              </Table.Td>
              <Table.Td>
                <FileDelKit kit={voce} />
              </Table.Td>
              <Table.Td className="whitespace-nowrap tabular-nums">{voce.avviatoIl ? formatData(voce.avviatoIl) : "—"}</Table.Td>
              <Table.Td className="text-right">
                <AzioneKit promo={promo} kit={voce} puoAprire={puoAprire} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}

interface RigaPromoProps {
  promo: PromoAvanzamento;
  /** I kit della promo che corrispondono ai filtri. */
  kit: KitAvanzamento[];
  aperta: boolean;
  onAlterna: () => void;
  puoAprireKit: boolean;
}

/** Una promo dell'elenco: stato, scadenza e kit per stato; aperta, l'elenco dei suoi kit. */
export function RigaPromo({ promo, kit, aperta, onAlterna, puoAprireKit }: RigaPromoProps) {
  const idKit = useId();
  const scadenza = descriviScadenza(promo.giorniAllaScadenza);
  const validita = testoValidita(promo.validitaDal, promo.validitaAl);
  const statoPromo = descriviStato("promo", promo.stato);

  return (
    <li className="border-t border-slate-100 first:border-t-0 dark:border-darkmode-400">
      <button
        type="button"
        aria-expanded={aperta}
        aria-controls={idKit}
        onClick={onAlterna}
        className={twMerge(
          "flex w-full flex-col gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-1/40 dark:hover:bg-darkmode-400/40",
          COLONNE_PROMO
        )}
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100" title={promo.nome}>
            {promo.nome}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <StatusBadge tono={statoPromo.tono} etichetta={statoPromo.etichetta} />
            {validita && <span className="tabular-nums">Validità {validita}</span>}
          </span>
        </span>
        <KitPerStato kit={kit} nonAvviatiDisponibili={promo.nonAvviatiDisponibili} />
        <span className="flex flex-row items-center gap-2 md:flex-col md:items-start md:gap-1">
          <StatusBadge tono={scadenza.tono} etichetta={scadenza.testo} />
          {promo.scadenzaLavorazione && (
            <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
              Lavorazione entro il {giornoMese(promo.scadenzaLavorazione)}
            </span>
          )}
        </span>
        <Lucide
          icon="ChevronDown"
          aria-hidden="true"
          className={twMerge(
            "hidden h-5 w-5 text-slate-400 transition-transform motion-reduce:transition-none md:block",
            aperta && "rotate-180"
          )}
        />
      </button>
      {!promo.nonAvviatiDisponibili && (
        <p className="mx-5 mb-3 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
          <Lucide icon="TriangleAlert" aria-hidden="true" className="h-3.5 w-3.5 flex-none" />
          {MOTIVO_NON_AVVIATI}
        </p>
      )}
      <div id={idKit} hidden={!aperta} className="px-5 pb-5">
        {kit.length > 0 ? (
          <KitDellaPromo promo={promo} kit={kit} puoAprire={puoAprireKit} />
        ) : (
          <Alert variant="soft-secondary" icona="Info">
            {promo.nonAvviatiDisponibili
              ? "La promozione non ha ancora kit previsti per questi filtri."
              : "Nessun kit avviato per questi filtri. I kit non avviati compariranno quando Istanta risponde."}
          </Alert>
        )}
      </div>
    </li>
  );
}
