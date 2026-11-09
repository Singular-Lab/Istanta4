import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Skeleton from "@/components/Base/Skeleton";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { Legenda, SERIE_PRINCIPALE, SERIE_SECONDARIA, type VoceLegenda } from "@/components/Grafici";
import { formatDifferenzaPunti, formatEuro, formatPercentuale, periodoValidita } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useId, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type {
  ConfrontoEdizione as DatiConfrontoEdizione,
  ProdottoConfronto,
  Variazione,
} from "../../../../lib/insightVolantino/tipi";
import { percorsoDettaglioVolantino } from "../../../../lib/materiali/periodi";
import { MostraTutti } from "./MostraTutti";
import { etichettaVariante, formatDifferenzaNumero } from "./supporto";

export interface ConfrontoEdizioneProps {
  /** null per la prima edizione di un'area e di un canale. */
  confronto: DatiConfrontoEdizione | null;
  caricamento?: boolean;
  /** Motivo per cui i confronti non sono arrivati. */
  errore?: string | null;
  onRiprova?: () => void;
}

/** Reparti mostrati prima di "Mostra tutti": oltre, il confronto diventa una lista da scorrere. */
const PRIMI_REPARTI = 8;
/** Prodotti entrati o usciti mostrati prima di "Mostra tutti". */
const PRIMI_PRODOTTI = 8;

type Misura = "numero" | "percentuale";

/** Gli indicatori della sintesi, nell'ordine in cui li legge la Direzione. */
const INDICATORI: ReadonlyArray<{ chiave: keyof DatiConfrontoEdizione["sintesi"]; etichetta: string; misura: Misura }> = [
  { chiave: "referenze", etichetta: "Referenze", misura: "numero" },
  { chiave: "box", etichetta: "Box", misura: "numero" },
  { chiave: "pagine", etichetta: "Pagine", misura: "numero" },
  { chiave: "scontoMedio", etichetta: "Sconto medio", misura: "percentuale" },
  { chiave: "quotaFidelity", etichetta: "Quota fidelity", misura: "percentuale" },
  { chiave: "sottocosto", etichetta: "Sottocosto", misura: "numero" },
  { chiave: "marche", etichetta: "Marche", misura: "numero" },
];

const formatValore = (valore: number | null, misura: Misura): string =>
  misura === "percentuale" ? formatPercentuale(valore) : formatNumero(valore);

// Le percentuali cambiano in punti, non in percentuale di percentuale
const formatDifferenza = ({ differenza }: Variazione, misura: Misura): string => {
  if (differenza === null || !Number.isFinite(differenza)) return "—";
  return misura === "percentuale" ? formatDifferenzaPunti(differenza) : formatDifferenzaNumero(differenza);
};

const LEGENDA_EDIZIONI: VoceLegenda[] = [
  { id: "attuale", etichetta: "Questa edizione", forma: "quadrato", tinta: { classe: SERIE_PRINCIPALE.fill, classeTesto: "" } },
  { id: "precedente", etichetta: "Edizione precedente", forma: "quadrato", tinta: { classe: SERIE_SECONDARIA.fill, classeTesto: "" } },
];

/** Una barra orizzontale lunga in proporzione al fondo scala, con il valore accanto. */
function Barra({ valore, massimo, classe, descrizione }: { valore: number; massimo: number; classe: string; descrizione: string }) {
  const larghezza = massimo > 0 ? Math.min(100, (Math.max(0, valore) / massimo) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div aria-hidden="true" className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-darkmode-400">
        <div className={twMerge("h-full rounded-full", classe)} style={{ width: `${larghezza}%` }} />
      </div>
      <span className="w-14 flex-none text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">
        <span className="sr-only">{descrizione}: </span>
        {formatPercentuale(valore)}
      </span>
    </div>
  );
}

/** Quota di spazio di ogni reparto nelle due edizioni, con le barre affiancate. */
function SpazioPerReparto({ voci }: { voci: DatiConfrontoEdizione["spazioPerReparto"] }) {
  const [aperto, setAperto] = useState(false);
  const idElenco = useId();
  const ordinate = useMemo(
    () => [...voci].sort((a, b) => Math.max(b.attuale, b.precedente) - Math.max(a.attuale, a.precedente) || a.etichetta.localeCompare(b.etichetta, "it")),
    [voci]
  );
  if (ordinate.length === 0) {
    return <p className="text-sm text-slate-500">Nessun reparto riconosciuto nelle due edizioni.</p>;
  }
  // Fondo scala comune alle due serie: le barre si confrontano anche fra reparti diversi
  const massimo = Math.max(...ordinate.map(voce => Math.max(voce.attuale, voce.precedente)), 0);
  const visibili = aperto ? ordinate : ordinate.slice(0, PRIMI_REPARTI);
  return (
    <div>
      <Legenda voci={LEGENDA_EDIZIONI} className="mb-3" />
      <ul id={idElenco} aria-label="Spazio per reparto nelle due edizioni" className="space-y-3">
        {visibili.map(voce => (
          <li key={voce.chiave} className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:items-center sm:gap-3">
            <span className="truncate text-slate-700 dark:text-slate-200" title={voce.etichetta}>
              {voce.etichetta}
            </span>
            <div className="space-y-1">
              <Barra valore={voce.attuale} massimo={massimo} classe={SERIE_PRINCIPALE.sfondo} descrizione="Questa edizione" />
              <Barra valore={voce.precedente} massimo={massimo} classe={SERIE_SECONDARIA.sfondo} descrizione="Edizione precedente" />
            </div>
          </li>
        ))}
      </ul>
      {ordinate.length > PRIMI_REPARTI && <MostraTutti aperto={aperto} totale={ordinate.length} onCambia={setAperto} controlla={idElenco} />}
    </div>
  );
}

/** Prodotti entrati o usciti: i primi, poi tutti a richiesta. */
function ElencoProdotti({ titolo, icona, prodotti, vuoto }: { titolo: string; icona: string; prodotti: ProdottoConfronto[]; vuoto: string }) {
  const [aperto, setAperto] = useState(false);
  const idElenco = useId();
  const visibili = aperto ? prodotti : prodotti.slice(0, PRIMI_PRODOTTI);
  return (
    <div className="rounded-control border border-slate-200 p-4 dark:border-darkmode-400">
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <Lucide icon={icona} aria-hidden="true" className="h-4 w-4 text-slate-500" />
        {titolo}
        <span className="font-normal tabular-nums text-slate-500">{formatNumero(prodotti.length)}</span>
      </h4>
      {prodotti.length === 0 ? (
        <p className="text-sm text-slate-500">{vuoto}</p>
      ) : (
        <ul id={idElenco} aria-label={titolo} className="divide-y divide-slate-100 dark:divide-darkmode-400">
          {visibili.map(prodotto => (
            <li key={prodotto.chiave} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800 dark:text-slate-100" title={prodotto.nome}>
                  {prodotto.nome}
                </p>
                {prodotto.marca && <p className="truncate text-xs text-slate-500">{prodotto.marca}</p>}
              </div>
              <div className="flex-none text-right tabular-nums">
                <span className="text-slate-700 dark:text-slate-200">{formatEuro(prodotto.prezzo)}</span>
                {prodotto.sconto !== null && <span className="block text-xs text-slate-500">−{formatPercentuale(prodotto.sconto)}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {prodotti.length > PRIMI_PRODOTTI && <MostraTutti aperto={aperto} totale={prodotti.length} onCambia={setAperto} controlla={idElenco} />}
    </div>
  );
}

/**
 * Il volantino rispetto all'edizione precedente della stessa area e dello stesso canale: quale
 * edizione, come cambiano i numeri chiave, lo spazio per reparto e i prodotti entrati e usciti.
 */
export function ConfrontoEdizione({ confronto, caricamento = false, errore = null, onRiprova }: ConfrontoEdizioneProps) {
  const idTitolo = useId();

  let contenuto: ReactNode;
  if (caricamento) {
    contenuto = (
      <div aria-busy="true" className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-48" />
      </div>
    );
  } else if (errore) {
    contenuto = <PageError compatta titolo="Confronto non caricato" motivo={errore} onRiprova={onRiprova} />;
  } else if (!confronto) {
    contenuto = (
      <EmptyState
        compatta
        icon="RotateCcwClock"
        title="Nessuna edizione precedente per questa area e canale"
        description="È la prima edizione di questa area e di questo canale, o le precedenti non sono fra i volantini disponibili."
      />
    );
  } else {
    const { edizione, sintesi } = confronto;
    contenuto = (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-control border border-slate-200 p-4 sm:flex-row sm:items-start sm:justify-between dark:border-darkmode-400">
          <div className="min-w-0">
            <p className="title-eyebrow">Edizione precedente</p>
            <p className="title-card [overflow-wrap:anywhere]">{edizione.titolo || edizione.nomePromo || "Volantino senza titolo"}</p>
            <p className="text-sm text-slate-500">
              {etichettaVariante(edizione)} · <span className="tabular-nums">{periodoValidita(edizione.validitaDal, edizione.validitaAl)}</span>
            </p>
            {edizione.storico && (
              <Badge variant="secondary" size="sm" className="mt-1.5">
                Dallo storico
              </Badge>
            )}
          </div>
          <Button as={Link} to={percorsoDettaglioVolantino(edizione.idKit)} size="sm" variant="outline-secondary" className="self-start">
            Apri i suoi insight
            <Lucide icon="ArrowRight" aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table sm hover={false}>
            <caption className="sr-only">Numeri chiave rispetto all&apos;edizione precedente</caption>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Indicatore</Table.Th>
                <Table.Th className="text-right">Questa edizione</Table.Th>
                <Table.Th className="text-right">Precedente</Table.Th>
                <Table.Th className="text-right">Differenza</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {INDICATORI.map(({ chiave, etichetta, misura }) => {
                const variazione = sintesi[chiave];
                return (
                  <Table.Tr key={chiave}>
                    <Table.Td>{etichetta}</Table.Td>
                    <Table.Td className="text-right font-medium tabular-nums">{formatValore(variazione.attuale, misura)}</Table.Td>
                    <Table.Td className="text-right tabular-nums text-slate-500">{formatValore(variazione.precedente, misura)}</Table.Td>
                    <Table.Td className="whitespace-nowrap text-right tabular-nums">{formatDifferenza(variazione, misura)}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </div>

        <div>
          <h4 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Spazio per reparto</h4>
          <p className="mb-3 text-xs text-slate-500">Quota dello spazio stampato occupata da ogni reparto, in percentuale sul volantino.</p>
          <SpazioPerReparto voci={confronto.spazioPerReparto} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ElencoProdotti
            titolo="Prodotti entrati"
            icona="LogIn"
            prodotti={confronto.prodottiEntrati}
            vuoto="Nessun prodotto nuovo rispetto all'edizione precedente."
          />
          <ElencoProdotti
            titolo="Prodotti usciti"
            icona="LogOut"
            prodotti={confronto.prodottiUsciti}
            vuoto="Tutti i prodotti dell'edizione precedente sono anche in questa."
          />
        </div>
      </div>
    );
  }

  return (
    <div role="group" aria-labelledby={idTitolo}>
      <h3 id={idTitolo} className="title-card mb-1">
        Rispetto all&apos;edizione precedente
      </h3>
      <p className="mb-4 text-sm text-slate-500">Lo stesso volantino nell&apos;edizione precedente della stessa area e dello stesso canale.</p>
      {contenuto}
    </div>
  );
}

export default ConfrontoEdizione;
