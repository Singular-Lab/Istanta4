import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import type { Tinta } from "@/components/Grafici";
import { twMerge } from "@/utils/twMerge";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { KitPromozioneConsultazione } from "../../../lib/consultazione/tipi";
import { percorsoDettaglioVolantino } from "../../../lib/materiali/periodi";
import { celleConPiuKit, chiaveCella, nomeKit } from "./analisi";
import { Copertina } from "./Copertina";
import { LogoInsegna } from "./LogoInsegna";

export const TITOLO_GRIGLIA = "I volantini";

/**
 * "I volantini": una scheda per kit mostrato, nell'ordine del dettaglio (insegna, area, titolo), in
 * colonne di almeno 12rem. In alto la miniatura della copertina, dritta e con aria intorno; sotto
 * il logo e il nome dell'insegna e l'area, e il titolo solo quando insegna e area hanno più di un
 * volantino. Tutta la scheda apre gli insight del suo volantino.
 */
export function GrigliaVolantini({
  kit,
  tinta,
}: {
  kit: readonly KitPromozioneConsultazione[];
  tinta: (idCanale: string) => Tinta;
}) {
  const conTitolo = useMemo(() => celleConPiuKit(kit), [kit]);

  return (
    <Sezione
      titolo={TITOLO_GRIGLIA}
      descrizione="Una scheda per volantino, con la sua insegna e la sua area. Un clic apre i suoi insight."
    >
      <ul
        aria-label="Copertine dei volantini"
        className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] gap-5"
      >
        {kit.map(k => {
          const titolo = conTitolo.has(chiaveCella(k.canale.id, k.area.id));
          return (
            <li key={k.id} className="h-full">
              <Link
                to={percorsoDettaglioVolantino(k.id)}
                aria-label={`Insight del volantino ${nomeKit(k)}${titolo ? ` – ${k.titolo}` : ""}`}
                title={`${nomeKit(k)} – ${k.titolo}`}
                className={twMerge(
                  "group/kit flex h-full flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-card outline-none",
                  "hover:border-theme-1/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-theme-1/40",
                  "dark:border-darkmode-400 dark:bg-darkmode-600 dark:hover:border-indigo-300/40 dark:focus-visible:ring-indigo-300/50",
                  "motion-safe:transition-[border-color,box-shadow] motion-safe:duration-200"
                )}
              >
                {/* La copertina su un piano neutro, con margini uguali: le schede restano allineate */}
                <span className="flex justify-center bg-slate-100 px-7 pb-5 pt-6 dark:bg-darkmode-700">
                  <Copertina
                    kit={k}
                    className={twMerge(
                      "aspect-[5/7] w-full max-w-[10rem] rounded-sm shadow-card ring-1 ring-black/5 dark:ring-white/10",
                      "motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover/kit:-translate-y-1"
                    )}
                  />
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-3 border-t border-slate-200 px-4 py-3.5 dark:border-darkmode-400">
                  <LogoInsegna idCanale={k.canale.id} nome={k.canale.nome} tinta={tinta(k.canale.id)} misura="medio" />
                  <span className="flex min-w-0 flex-col gap-1 leading-tight">
                    <span className="truncate text-sm font-bold text-slate-800 group-hover/kit:text-primary dark:text-slate-100 dark:group-hover/kit:text-indigo-300">
                      {k.canale.nome}
                    </span>
                    <span className="flex min-w-0 items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <Lucide icon="MapPin" aria-hidden="true" className="h-3 w-3 flex-none" />
                      <span className="truncate">{k.area.nome}</span>
                    </span>
                    {titolo && <span className="truncate text-2xs text-slate-400 dark:text-slate-500">{k.titolo}</span>}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Sezione>
  );
}

export default GrigliaVolantini;
