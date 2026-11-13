import Lucide from "@/components/Base/Lucide";
import type { Tinta } from "@/components/Grafici";
import { NOTA_PREZZO_CALCOLATO } from "@/components/FlyerInsights/volantino/box";
import { formatEuro, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { PresenzaReferenzaPromozione } from "../../../lib/consultazione/tipi";
import { percorsoDettaglioVolantino } from "../../../lib/materiali/periodi";
import type { GrigliaVolantini, ProdottoConfronto } from "./analisi";
import { LogoInsegna } from "./LogoInsegna";

export const VUOTO = "—";

/** La foto del prodotto in un riquadro bianco; se manca o non si carica, un'icona. La misura arriva da `className`. */
export function Foto({ url, className }: { url: string | null; className?: string }) {
  const [rotta, setRotta] = useState(false);
  return (
    <span
      className={twMerge(
        "flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-control border border-slate-200 bg-white dark:border-darkmode-400",
        className
      )}
    >
      {url && !rotta ? (
        <img src={url} alt="" loading="lazy" onError={() => setRotta(true)} className="h-full w-full object-contain" />
      ) : (
        <Lucide icon="Image" aria-hidden="true" className="h-5 w-5 text-slate-400" />
      )}
    </span>
  );
}

/** Le presenze del prodotto per casella insegna × area. */
export const presenzePerCasella = (prodotto: ProdottoConfronto, griglia: GrigliaVolantini): Map<number, PresenzaReferenzaPromozione[]> => {
  const perCasella = new Map<number, PresenzaReferenzaPromozione[]>();
  for (const presenza of prodotto.referenza.presenze) {
    const casella = griglia.casellaDelKit.get(presenza.idKit.toLowerCase());
    if (casella !== undefined) perCasella.set(casella, [...(perCasella.get(casella) ?? []), presenza]);
  }
  return perCasella;
};

/** Prezzo, sconto, barrato e pagina per insegna e area; la pagina apre gli insight del kit su quel prodotto. */
export function PrezziEPagine({ prodotto, griglia, tinta }: { prodotto: ProdottoConfronto; griglia: GrigliaVolantini; tinta: (idCanale: string) => Tinta }) {
  const r = prodotto.referenza;
  const n = griglia.aree.length;
  const perCasella = presenzePerCasella(prodotto, griglia);
  return (
    <div className="overflow-x-auto">
      <table aria-label={`${r.nome || "Prodotto"}: prezzi e pagine per insegna e area`} className="border-separate border-spacing-1 text-xs tabular-nums">
        <thead>
          <tr>
            <td />
            {griglia.aree.map(area => (
              <th key={area.id} scope="col" className="px-2 text-center font-medium text-slate-600 dark:text-slate-300">
                {area.nome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {griglia.insegne.map((insegna, a) => (
            <tr key={insegna.id}>
              <th scope="row" className="whitespace-nowrap pr-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                <span className="inline-flex items-center gap-1.5">
                  <LogoInsegna idCanale={insegna.id} nome={insegna.nome} tinta={tinta(insegna.id)} />
                  {insegna.nome}
                </span>
              </th>
              {griglia.aree.map((area, b) => {
                const presenze = perCasella.get(a * n + b) ?? [];
                if (presenze.length === 0) {
                  return (
                    <td key={area.id} className="min-w-[6.5rem] px-2 py-1.5 text-center text-slate-400 dark:text-slate-500">
                      {VUOTO}
                    </td>
                  );
                }
                return (
                  <td key={area.id} className="min-w-[6.5rem] rounded-control bg-white px-2 py-1.5 text-center dark:bg-darkmode-600">
                    {presenze.map(presenza => {
                      // Tutti i prezzi dello stesso colore: la differenza fra i prezzi la dicono i prezzi per luogo
                      return (
                        <div key={presenza.idKit} className="flex flex-col items-center gap-0.5">
                          <span className="font-bold text-slate-800 dark:text-slate-100" title={presenza.prezzoCalcolato ? NOTA_PREZZO_CALCOLATO : undefined}>
                            {presenza.prezzo !== null ? formatEuro(presenza.prezzo) : VUOTO}
                            {presenza.sconto !== null && <span className="ml-1 font-medium text-slate-600 dark:text-slate-300">−{formatPercentuale(Math.round(presenza.sconto))}</span>}
                          </span>
                          {presenza.barrato !== null && presenza.barrato !== undefined && (
                            <span className="text-slate-500 dark:text-slate-400">
                              <span className="sr-only">invece di </span>
                              <s>{formatEuro(presenza.barrato)}</s>
                            </span>
                          )}
                          <Link
                            to={percorsoDettaglioVolantino(presenza.idKit, presenza.pagina, presenza.idReferenza ?? r.nome)}
                            aria-label={`Apri ${r.nome || "il prodotto"} nel volantino ${insegna.nome} · ${area.nome}${presenza.pagina !== null ? `, pagina ${presenza.pagina}` : ""}`}
                            className="font-semibold text-theme-1 hover:underline dark:text-indigo-200"
                          >
                            {presenza.pagina !== null ? `pagina ${formatNumero(presenza.pagina)}` : "Apri"} →
                          </Link>
                        </div>
                      );
                    })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
