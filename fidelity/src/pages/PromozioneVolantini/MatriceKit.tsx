import Sezione from "@/components/Base/Sezione";
import type { Tinta } from "@/components/Grafici";
import { PuntoInsegna } from "@/pages/PuntiVenditaConsultazione/componenti";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { KitPromozioneConsultazione } from "../../../lib/consultazione/tipi";
import { percorsoDettaglioVolantino } from "../../../lib/materiali/periodi";
import { chiaveCella, grigliaKit, nomeKit, plurale } from "./analisi";
import { Copertina } from "./Copertina";

const INTESTAZIONE = "pb-0.5 text-left align-bottom text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

/** Punti vendita stampati di un kit: 0 vuol dire che la lista non è arrivata, non che non ne ha. */
const testoPuntiVendita = (numero: number) => (numero > 0 ? `${formatNumero(numero)} PV` : "Lista PV assente");

function CellaKit({ kit, conTitolo }: { kit: KitPromozioneConsultazione; conTitolo: boolean }) {
  // Il nome del link per intero: i pezzi della cella, letti uno dopo l'altro, non si separerebbero
  const puntiVendita =
    kit.numeroPuntiVendita > 0 ? plurale(kit.numeroPuntiVendita, "punto vendita", "punti vendita") : "lista dei punti vendita assente";
  const etichetta = `Insight del volantino ${nomeKit(kit)}${conTitolo ? ` – ${kit.titolo}` : ""}: ${puntiVendita}, ${plurale(kit.referenze, "referenza", "referenze")}`;
  return (
    <Link
      to={percorsoDettaglioVolantino(kit.id)}
      aria-label={etichetta}
      title={kit.titolo}
      className={twMerge(
        "flex min-w-[8.5rem] items-center gap-2.5 rounded-control border border-slate-200 bg-slate-50 p-2 hover:border-theme-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40",
        "dark:border-darkmode-400 dark:bg-darkmode-700 dark:hover:border-indigo-300",
        "motion-safe:transition motion-safe:hover:-translate-y-px"
      )}
    >
      <Copertina kit={kit} conNome={false} className="aspect-[5/7] w-10 flex-none rounded-sm shadow-sm ring-1 ring-black/5" />
      <span className="flex min-w-0 flex-col text-xs text-slate-500 dark:text-slate-400">
        <strong className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">{testoPuntiVendita(kit.numeroPuntiVendita)}</strong>
        <span className="tabular-nums">{plurale(kit.referenze, "referenza", "referenze")}</span>
        {conTitolo && <span className="truncate text-3xs">{kit.titolo}</span>}
      </span>
    </Link>
  );
}

function Totale({ valore, allineamento = "destra" }: { valore: number; allineamento?: "destra" | "sinistra" }) {
  return (
    <span className={twMerge("flex flex-col text-xs text-slate-500 dark:text-slate-400", allineamento === "destra" ? "items-end" : "items-start")}>
      <strong className="text-base font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatNumero(valore)}</strong>
      PV
    </span>
  );
}

/**
 * "I volantini della promozione": una riga per canale e una colonna per area, in ogni cella il
 * kit con la copertina, i punti vendita stampati e le referenze; le combinazioni senza kit restano
 * vuote. In fondo a righe e colonne i punti vendita sommati. Ogni kit apre i suoi insight. Su
 * schermi stretti la griglia scorre nel suo riquadro.
 */
export function MatriceKit({ kit, tinta }: { kit: readonly KitPromozioneConsultazione[]; tinta: (idCanale: string) => Tinta }) {
  const griglia = useMemo(() => grigliaKit(kit), [kit]);

  return (
    <Sezione
      titolo="I volantini della promozione"
      descrizione="Un volantino per insegna e area: per ciascuno i punti vendita stampati nella sua lista e le referenze promosse. Un clic apre i suoi insight."
    >
      <div className="-mx-5 overflow-x-auto px-3">
        <table className="w-full min-w-max border-separate border-spacing-2">
          <caption className="sr-only">Volantini per insegna e area, con i punti vendita stampati</caption>
          <thead>
            <tr>
              <th scope="col" className={twMerge(INTESTAZIONE, "w-32")}>
                Insegna
              </th>
              {griglia.aree.map(area => (
                <th key={area.id} scope="col" className={twMerge(INTESTAZIONE, "min-w-[8.5rem]")}>
                  {area.nome}
                </th>
              ))}
              <th scope="col" className={twMerge(INTESTAZIONE, "w-20 text-right")}>
                Totale
              </th>
            </tr>
          </thead>
          <tbody>
            {griglia.canali.map(canale => (
              <tr key={canale.id}>
                <th scope="row" className="pr-2 text-left align-middle">
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                    <PuntoInsegna tinta={tinta(canale.id)} />
                    {canale.nome}
                  </span>
                </th>
                {griglia.aree.map(area => {
                  const kitCella = griglia.celle.get(chiaveCella(canale.id, area.id)) ?? [];
                  return (
                    <td key={area.id} className="h-px align-top">
                      {kitCella.length === 0 ? (
                        <div className="flex h-full min-h-[4.25rem] items-center justify-center rounded-control border border-dashed border-slate-200 px-3 text-xs text-slate-400 dark:border-darkmode-400 dark:text-slate-500">
                          Nessun volantino
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {kitCella.map(k => (
                            <CellaKit key={k.id} kit={k} conTitolo={kitCella.length > 1} />
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="align-middle">
                  <Totale valore={griglia.totaleCanale.get(canale.id) ?? 0} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="pt-1 text-left align-top text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Totale
              </th>
              {griglia.aree.map(area => (
                <td key={area.id} className="pl-1 pt-1">
                  <Totale valore={griglia.totaleArea.get(area.id) ?? 0} allineamento="sinistra" />
                </td>
              ))}
              <td className="pt-1">
                <Totale valore={griglia.totale} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Sezione>
  );
}

export default MatriceKit;
