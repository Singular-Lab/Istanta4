import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import Table from "@/components/Base/Table";
import type { Tinta } from "@/components/Grafici";
import { formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useMemo, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { KitPromozioneConsultazione } from "../../../lib/consultazione/tipi";
import { percorsoDettaglioVolantino } from "../../../lib/materiali/periodi";
import {
  ariaSort,
  nomeKit,
  ORDINAMENTO_INIZIALE,
  ordinaKit,
  prossimoOrdinamento,
  type ColonnaConfronto,
  type OrdinamentoConfronto,
} from "./analisi";
import { Copertina } from "./Copertina";
import { LogoInsegna } from "./LogoInsegna";

const COLONNE: ReadonlyArray<{ id: ColonnaConfronto; etichetta: string; numerica: boolean }> = [
  { id: "volantino", etichetta: "Volantino", numerica: false },
  { id: "puntiVendita", etichetta: "Punti vendita", numerica: true },
  { id: "referenze", etichetta: "Referenze", numerica: true },
  { id: "pagine", etichetta: "Pagine", numerica: true },
  { id: "scontoMedio", etichetta: "Sconto medio", numerica: true },
  { id: "quotaFidelity", etichetta: "Quota Fidelity", numerica: true },
  { id: "sottocosto", etichetta: "Sottocosto", numerica: true },
];

const ICONA_VERSO = { ascending: "ArrowUp", descending: "ArrowDown", none: "ChevronsUpDown" } as const;

/** Barretta accanto a un numero: la sua grandezza rispetto al kit più alto della colonna. */
function Barretta({ valore, massimo, colore, classe }: { valore: number; massimo: number; colore?: string; classe?: string }) {
  const larghezza = massimo > 0 ? Math.max(2, (valore / massimo) * 48) : 2;
  return (
    <span
      aria-hidden="true"
      style={{ width: `${larghezza}px`, backgroundColor: colore }}
      className={twMerge("ml-2 inline-block h-1.5 rounded-full align-middle", classe)}
    />
  );
}

/**
 * "I volantini a confronto": una riga per kit con punti vendita, referenze, pagine, sconto medio,
 * quota Fidelity e box in sottocosto; si ordina cliccando le intestazioni (aria-sort sulla colonna).
 * La riga apre gli insight del kit, col mouse o con Invio e Spazio quando ha il focus.
 */
export function ConfrontoKit({ kit, tinta }: { kit: readonly KitPromozioneConsultazione[]; tinta: (idCanale: string) => Tinta }) {
  const navigate = useNavigate();
  const [ordinamento, setOrdinamento] = useState<OrdinamentoConfronto>(ORDINAMENTO_INIZIALE);
  const ordinati = useMemo(() => ordinaKit(kit, ordinamento), [kit, ordinamento]);
  const massimoPv = Math.max(0, ...kit.map(k => k.numeroPuntiVendita));
  const massimoReferenze = Math.max(0, ...kit.map(k => k.referenze));

  const tasto = (evento: KeyboardEvent<HTMLTableRowElement>, percorso: string) => {
    if (evento.target !== evento.currentTarget) return;
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      navigate(percorso);
    }
  };

  return (
    <Sezione
      senzaPadding
      titolo="I volantini a confronto"
      descrizione="Ordina cliccando una colonna. Un clic su una riga apre gli insight di quel volantino."
    >
      <div className="overflow-x-auto">
        <Table sm>
          <caption className="sr-only">I volantini della promozione a confronto</caption>
          <Table.Thead>
            <Table.Tr>
              {COLONNE.map((colonna, indice) => {
                const verso = ariaSort(ordinamento, colonna.id);
                return (
                  <Table.Th
                    key={colonna.id}
                    scope="col"
                    aria-sort={verso}
                    className={twMerge(colonna.numerica ? "text-right" : "pl-5", indice === COLONNE.length - 1 && "pr-5")}
                  >
                    <button
                      type="button"
                      onClick={() => setOrdinamento(attuale => prossimoOrdinamento(attuale, colonna.id))}
                      className={twMerge(
                        "inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:hover:text-slate-200",
                        verso !== "none" && "font-semibold text-theme-1 dark:text-indigo-300"
                      )}
                    >
                      {colonna.etichetta}
                      <Lucide icon={ICONA_VERSO[verso]} aria-hidden="true" className={twMerge("h-3 w-3", verso === "none" && "opacity-40")} />
                    </button>
                  </Table.Th>
                );
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ordinati.map(k => {
              const percorso = percorsoDettaglioVolantino(k.id);
              const colore = tinta(k.canale.id);
              return (
                <Table.Tr
                  key={k.id}
                  tabIndex={0}
                  onClick={() => navigate(percorso)}
                  onKeyDown={evento => tasto(evento, percorso)}
                  className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-1/40"
                >
                  <Table.Td className="pl-5">
                    {/* Il collegamento resta per aprire in un'altra scheda; da tastiera basta la riga */}
                    <Link
                      to={percorso}
                      tabIndex={-1}
                      onClick={evento => evento.stopPropagation()}
                      title={k.titolo}
                      className="flex items-center gap-2.5 whitespace-nowrap font-semibold text-slate-800 hover:text-primary dark:text-slate-100 dark:hover:text-indigo-300"
                    >
                      <Copertina kit={k} conNome={false} className="aspect-[5/7] w-7 flex-none rounded-sm shadow-sm ring-1 ring-black/5" />
                      <LogoInsegna idCanale={k.canale.id} nome={k.canale.nome} tinta={colore} />
                      {nomeKit(k)}
                    </Link>
                  </Table.Td>
                  <Table.Td className="whitespace-nowrap text-right tabular-nums dark:text-slate-200">
                    {formatNumero(k.numeroPuntiVendita)}
                    <Barretta valore={k.numeroPuntiVendita} massimo={massimoPv} colore={colore.colore} classe={colore.colore ? undefined : "bg-slate-300 dark:bg-darkmode-300"} />
                  </Table.Td>
                  <Table.Td className="whitespace-nowrap text-right tabular-nums dark:text-slate-200">
                    {formatNumero(k.referenze)}
                    <Barretta valore={k.referenze} massimo={massimoReferenze} classe="bg-theme-1 dark:bg-indigo-300" />
                  </Table.Td>
                  <Table.Td className="text-right tabular-nums dark:text-slate-200">{formatNumero(k.pagine)}</Table.Td>
                  <Table.Td className="text-right tabular-nums dark:text-slate-200">{formatPercentuale(k.scontoMedio, 0)}</Table.Td>
                  <Table.Td className="text-right tabular-nums dark:text-slate-200">{formatPercentuale(k.quotaFidelity, 0)}</Table.Td>
                  <Table.Td className="pr-5 text-right tabular-nums dark:text-slate-200">{formatNumero(k.sottocosto)}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </div>
    </Sezione>
  );
}

export default ConfrontoKit;
