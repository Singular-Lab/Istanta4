import { formatEuro, marcaFormato } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import { useId, useMemo, useState } from "react";
import type { BoxInsight, PrezziSconti as DatiPrezziSconti } from "../../../../lib/insightVolantino/tipi";
import { NOTA_PREZZO_CALCOLATO } from "../volantino/box";
import { Blocco, MostraTutte, RIGHE_INIZIALI } from "./comuni";

/**
 * Sezione "Meccaniche": i box in sottocosto. Niente fasce di sconto né sconto medio per meccanica (spec
 * insight-volantino, "Prezzi, sconti, spazio e marche del volantino"). Sta in mezza pagina accanto ai
 * reparti. Per ogni GDO e per i kit di Istanta e dello storico: i dati arrivano dalla lettura generica
 * delle referenze (EstensioneInsight.prezziSconti).
 */

export interface PrezziScontiProps {
  prezziSconti: DatiPrezziSconti;
  /** I box del volantino, per i nomi dei box in sottocosto. */
  box: readonly BoxInsight[];
}

function Sottocosto({ idBox, box }: { idBox: readonly string[]; box: readonly BoxInsight[] }) {
  const [tutti, setTutti] = useState(false);
  const idElenco = useId();
  const perId = useMemo(() => new Map(box.map(voce => [voce.id, voce])), [box]);
  const elenco = idBox.map(id => perId.get(id)).filter((voce): voce is BoxInsight => voce !== undefined);

  if (elenco.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Nessun box in sottocosto.</p>;
  }
  const visibili = tutti ? elenco : elenco.slice(0, RIGHE_INIZIALI);
  return (
    <div className="space-y-2">
      <ul id={idElenco} className="divide-y divide-slate-100 dark:divide-darkmode-400">
        {visibili.map(voce => (
          <li key={voce.id} className="flex items-baseline justify-between gap-3 py-1.5 text-xs">
            <span className="min-w-0">
              <span className="block font-medium text-slate-800 [overflow-wrap:anywhere] dark:text-slate-200">{voce.nome}</span>
              {marcaFormato(voce) && <span className="block text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">{marcaFormato(voce)}</span>}
            </span>
            <span className="flex-none text-right tabular-nums text-slate-600 dark:text-slate-300">
              <span className="block font-semibold text-slate-800 dark:text-slate-100" title={voce.prezzoCalcolato ? NOTA_PREZZO_CALCOLATO : undefined}>
                {formatEuro(voce.prezzo)}
              </span>
              {voce.pagina !== null && <span className="block text-slate-500 dark:text-slate-400">pagina {formatNumero(voce.pagina)}</span>}
            </span>
          </li>
        ))}
      </ul>
      <MostraTutte totale={elenco.length} aperto={tutti} onCambia={setTutti} controlla={idElenco} />
    </div>
  );
}

export function PrezziSconti({ prezziSconti, box }: PrezziScontiProps) {
  return (
    <Blocco
      titolo="Sottocosto"
      descrizione={`${formatNumero(prezziSconti.sottocosto.length)} ${prezziSconti.sottocosto.length === 1 ? "box venduto" : "box venduti"} sotto il costo.`}
    >
      <Sottocosto idBox={prezziSconti.sottocosto} box={box} />
    </Blocco>
  );
}

export default PrezziSconti;
