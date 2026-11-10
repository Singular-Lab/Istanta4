import Badge from "@/components/Base/Badge";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { SERIE_PRINCIPALE } from "@/components/Grafici";
import IntestazioneOrdinabile, { ARIA_SORT, type DirezioneOrdinamento } from "@/pages/shared/IntestazioneOrdinabile";
import { coperturaParziale, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useId, useMemo, useState, type ReactNode } from "react";
import type { CoperturaDati, MarcaInsight, MarcheVolantino as DatiMarche } from "../../../../lib/insightVolantino/tipi";
import { BarraQuota, Blocco, MostraTutte, Nota } from "./comuni";

/**
 * Sezione "Marche": le marche con piu' spazio e piu' box, con lo sconto medio di ciascuna. Il peso
 * delle marche del distributore compare solo se la config dell'installazione le indica
 * (marche.distributore): senza, il server manda quotaDistributore null e la scheda non le distingue.
 */

export interface MarcheVolantinoProps {
  marche: DatiMarche;
  /**
   * Il volantino ha le linee del distributore (lineeDistributore): la loro quota sta nella sezione
   * "Marchi del distributore", e qui non si ripete con il conto per nome di marca, che darebbe una
   * percentuale diversa.
   */
  conLineeDistributore?: boolean;
  /** Copertura dei dati (sintesi.copertura): sotto la soglia la scheda dice che il dato e' parziale. */
  copertura?: CoperturaDati;
}

/** Marche mostrate prima di "Mostra tutte". */
export const MARCHE_INIZIALI = 15;

export type ColonnaMarche = "nome" | "box" | "referenze" | "quotaSpazio" | "scontoMedio";

/**
 * Le marche ordinate per colonna. I valori mancanti (sconto) vanno sempre in fondo, in tutte e due
 * le direzioni; a parita' decide lo spazio e poi il nome, cosi' l'ordine e' stabile.
 */
export const ordinaMarche = (elenco: readonly MarcaInsight[], colonna: ColonnaMarche, direzione: DirezioneOrdinamento): MarcaInsight[] => {
  const segno = direzione === "asc" ? 1 : -1;
  const confronta = (a: MarcaInsight, b: MarcaInsight): number => {
    if (colonna === "nome") return segno * a.nome.localeCompare(b.nome, "it");
    const va = a[colonna];
    const vb = b[colonna];
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return segno * (va - vb);
  };
  return [...elenco].sort((a, b) => confronta(a, b) || b.quotaSpazio - a.quotaSpazio || a.nome.localeCompare(b.nome, "it"));
};

const COLONNE: ReadonlyArray<{ id: ColonnaMarche; etichetta: string; destra?: boolean }> = [
  { id: "nome", etichetta: "Marca" },
  { id: "box", etichetta: "Box", destra: true },
  { id: "referenze", etichetta: "Referenze", destra: true },
  { id: "quotaSpazio", etichetta: "Quota di spazio" },
  { id: "scontoMedio", etichetta: "Sconto medio", destra: true },
];

function Intestazione({
  colonna,
  ordinamento,
  onOrdina,
  children,
  className,
}: {
  colonna: ColonnaMarche;
  ordinamento: { colonna: ColonnaMarche; direzione: DirezioneOrdinamento };
  onOrdina: (colonna: ColonnaMarche) => void;
  children: ReactNode;
  className?: string;
}) {
  const direzione = ordinamento.colonna === colonna ? ordinamento.direzione : undefined;
  return (
    <Table.Th aria-sort={direzione ? ARIA_SORT[direzione] : undefined} className={className}>
      <IntestazioneOrdinabile direzione={direzione} onClick={() => onOrdina(colonna)}>
        {children}
      </IntestazioneOrdinabile>
    </Table.Th>
  );
}

export function MarcheVolantino({ marche, conLineeDistributore = false, copertura }: MarcheVolantinoProps) {
  const [ordinamento, setOrdinamento] = useState<{ colonna: ColonnaMarche; direzione: DirezioneOrdinamento }>({
    colonna: "quotaSpazio",
    direzione: "desc",
  });
  const [tutte, setTutte] = useState(false);
  const idTabella = useId();
  const ordinate = useMemo(() => ordinaMarche(marche.elenco, ordinamento.colonna, ordinamento.direzione), [marche.elenco, ordinamento]);
  const massimoSpazio = Math.max(0, ...marche.elenco.map(marca => marca.quotaSpazio));
  const conDistributore = marche.quotaDistributore !== null;

  // Il nome si legge dalla A; i numeri dal piu' alto, la prima volta che si sceglie la colonna
  const ordina = (colonna: ColonnaMarche) =>
    setOrdinamento(attuale =>
      attuale.colonna === colonna
        ? { colonna, direzione: attuale.direzione === "asc" ? "desc" : "asc" }
        : { colonna, direzione: colonna === "nome" ? "asc" : "desc" }
    );

  if (marche.elenco.length === 0) {
    return (
      <EmptyState compatta icon="Award" title="Nessuna marca riconosciuta" description="Le referenze di questo volantino non hanno la marca." />
    );
  }

  const visibili = tutte ? ordinate : ordinate.slice(0, MARCHE_INIZIALI);

  return (
    <div className="space-y-6">
      {marche.quotaDistributore && !conLineeDistributore && (
        <Blocco titolo="Marche del distributore" descrizione="Il peso delle marche del distributore indicate nella configurazione.">
          <StatCardGrid className="lg:grid-cols-2">
            <StatCard
              densita="compatta"
              tono="neutral"
              icona="LayoutTemplate"
              etichetta="Quota di spazio"
              valore={formatPercentuale(marche.quotaDistributore.quotaSpazio)}
              sottotitolo="dello spazio dei box"
            />
            <StatCard
              densita="compatta"
              tono="neutral"
              icona="Boxes"
              etichetta="Quota di box"
              valore={formatPercentuale(marche.quotaDistributore.quotaBox)}
              sottotitolo="dei box del volantino"
            />
          </StatCardGrid>
        </Blocco>
      )}

      <Blocco
        titolo="Marche nel volantino"
        descrizione={`${formatNumero(marche.elenco.length)} ${marche.elenco.length === 1 ? "marca" : "marche"}, ordinate per ${COLONNE.find(c => c.id === ordinamento.colonna)?.etichetta.toLowerCase() ?? "spazio"}.`}
      >
        {/* La tabella arriva ai bordi della sezione */}
        <div className="-mx-5 overflow-x-auto">
          <Table sm id={idTabella}>
            <caption className="sr-only">Marche nel volantino</caption>
            <Table.Thead>
              <Table.Tr>
                {COLONNE.map((colonna, i) => (
                  <Intestazione
                    key={colonna.id}
                    colonna={colonna.id}
                    ordinamento={ordinamento}
                    onOrdina={ordina}
                    className={twMerge(i === 0 && "pl-5", i === COLONNE.length - 1 && "pr-5", colonna.destra && "text-right")}
                  >
                    {colonna.etichetta}
                  </Intestazione>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visibili.map(marca => (
                <Table.Tr key={marca.chiave}>
                  <Table.Td className="min-w-40 pl-5">
                    <span className="font-medium text-slate-800 [overflow-wrap:anywhere] dark:text-slate-200">{marca.nome}</span>
                    {conDistributore && marca.distributore && (
                      <Badge variant="primary" size="sm" className="ml-2 align-middle">
                        Marca del distributore
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td className="text-right tabular-nums dark:text-slate-200">{formatNumero(marca.box)}</Table.Td>
                  <Table.Td className="text-right tabular-nums dark:text-slate-200">{formatNumero(marca.referenze)}</Table.Td>
                  <Table.Td className="min-w-36">
                    <div className="flex items-center gap-2">
                      <BarraQuota valore={marca.quotaSpazio} massimo={massimoSpazio} classe={SERIE_PRINCIPALE.sfondo} />
                      <span className="w-12 flex-none text-right text-xs tabular-nums text-slate-700 dark:text-slate-200">
                        {formatPercentuale(marca.quotaSpazio)}
                      </span>
                    </div>
                  </Table.Td>
                  <Table.Td className="pr-5 text-right tabular-nums dark:text-slate-200">
                    {marca.scontoMedio === null ? "—" : formatPercentuale(marca.scontoMedio)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
        <MostraTutte totale={ordinate.length} aperto={tutte} onCambia={setTutte} iniziali={MARCHE_INIZIALI} controlla={idTabella} />
      </Blocco>

      {copertura && coperturaParziale(copertura.marca) && (
        <Nota>Dato parziale: la marca è nota per il {formatPercentuale(copertura.marca, 0)} dei box, quindi le quote valgono su quelli.</Nota>
      )}
    </div>
  );
}

export default MarcheVolantino;
