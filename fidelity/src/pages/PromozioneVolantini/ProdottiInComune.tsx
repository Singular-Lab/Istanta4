import { Slideover } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import type { Tinta } from "@/components/Grafici";
import { formatEuro, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useId, useMemo, useState } from "react";
import { descriviPresenze, type GrigliaVolantini, LIMITE_IN_COMUNE, plurale, prezziPerLuogo, prodottiInComune, type ProdottoConfronto } from "./analisi";
import { Foto, PrezziEPagine } from "./PrezziEPagine";

export interface ProdottiInComuneProps {
  /** Tutti i prodotti del confronto: qui si mostrano quelli in tutti i volantini. */
  prodotti: readonly ProdottoConfronto[];
  griglia: GrigliaVolantini;
  tinta: (idCanale: string) => Tinta;
}

const CLASSI_CHIP = "inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium whitespace-nowrap";

/** La differenza fra il prezzo più alto e il più basso, in euro e in %. */
function Differenza({ prodotto }: { prodotto: ProdottoConfronto }) {
  if (prodotto.differenza <= 0) return null;
  return (
    <span className="inline-flex self-start whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
      +{formatEuro(prodotto.differenza)} · +{formatPercentuale(prodotto.percentuale)}
    </span>
  );
}

/** Il prezzo, uguale ovunque, oppure i prezzi raggruppati per luogo dal più basso. */
function Prezzi({ prodotto, griglia, numeroKit }: { prodotto: ProdottoConfronto; griglia: GrigliaVolantini; numeroKit: number }) {
  const prezzi = prezziPerLuogo(prodotto, griglia);
  if (prezzi.length === 0) return <span className="block text-xs text-slate-400 dark:text-slate-500">Prezzo non indicato</span>;
  if (prezzi.length === 1) {
    return (
      <span className="block tabular-nums">
        <span className="block text-base font-bold text-slate-800 dark:text-slate-100">{formatEuro(prezzi[0]?.prezzo)}</span>
        <span className="block text-2xs text-slate-500 dark:text-slate-400">uguale in tutti i {formatNumero(numeroKit)} volantini</span>
      </span>
    );
  }
  return (
    <span className="flex flex-col gap-0.5 text-xs tabular-nums">
      {prezzi.map(voce => (
        <span key={voce.prezzo} className={twMerge("block truncate", voce.piuAlto ? "font-semibold text-amber-700 dark:text-amber-300" : "font-semibold text-slate-800 dark:text-slate-100")} title={`${formatEuro(voce.prezzo)} ${voce.luogo}`}>
          {formatEuro(voce.prezzo)} <span className="font-normal text-slate-500 dark:text-slate-400">{voce.luogo}</span>
        </span>
      ))}
    </span>
  );
}

/** Una scheda: foto, nome con la marca in evidenza, formato, reparto, prezzi e differenza; apre prezzi e pagine. */
function Scheda({ prodotto, griglia, onApri }: { prodotto: ProdottoConfronto; griglia: GrigliaVolantini; onApri: () => void }) {
  const r = prodotto.referenza;
  const reparto = r.reparto ? r.reparto.descrizione || r.reparto.codice : "Senza reparto";
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onApri}
      className="flex h-full w-full flex-col gap-2 rounded-card border border-slate-200 bg-white p-3 text-left transition-colors hover:border-theme-1/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:border-darkmode-400 dark:bg-darkmode-600 dark:hover:border-indigo-300/60"
    >
      <Foto key={r.foto ?? ""} url={r.foto} className="aspect-[4/3] h-auto w-full" />
      <span className="block text-sm font-medium leading-snug text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">
        {r.nome || "Prodotto senza nome"}
        {r.marca && (
          <>
            {" "}
            <strong className="font-extrabold">{r.marca}</strong>
          </>
        )}
      </span>
      {r.formato && <span className="block text-xs text-slate-500 dark:text-slate-400">{r.formato}</span>}
      <span className="flex flex-wrap gap-1">
        {/* Un reparto dal nome lungo non esce dalla scheda: si accorcia, il nome intero resta nel suggerimento */}
        <span title={reparto} className={twMerge(CLASSI_CHIP, "block max-w-full truncate bg-slate-100 text-slate-700 dark:bg-darkmode-400 dark:text-slate-200")}>
          {reparto}
        </span>
        {r.sottocosto && <span className={twMerge(CLASSI_CHIP, "bg-amber-100 font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300")}>Sottocosto</span>}
      </span>
      <span className="mt-auto flex flex-col gap-1.5 pt-1">
        <Prezzi prodotto={prodotto} griglia={griglia} numeroKit={griglia.numeroKit} />
        <Differenza prodotto={prodotto} />
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-theme-1 dark:text-indigo-200">
          Prezzi e pagine
          <Lucide icon="ArrowRight" aria-hidden="true" className="h-3.5 w-3.5" />
        </span>
      </span>
    </button>
  );
}

/**
 * I prodotti in comune (spec volantini-pop), in primo piano subito dopo i numeri del confronto: una
 * scheda per ogni prodotto stampato in tutti i volantini mostrati, prima quelli con prezzi diversi.
 * Oltre LIMITE_IN_COMUNE schede le altre si aprono a richiesta; una scheda apre in un pannello prezzo,
 * sconto, barrato e pagina per insegna e area, con gli insight del kit su quel prodotto.
 */
export function ProdottiInComune({ prodotti, griglia, tinta }: ProdottiInComuneProps) {
  const comuni = useMemo(() => prodottiInComune(prodotti, griglia), [prodotti, griglia]);
  const [tutti, setTutti] = useState(false);
  const [chiaveAperta, setChiaveAperta] = useState<string | null>(null);
  const idTitolo = useId();

  const diversi = comuni.filter(p => p.differenza > 0).length;
  const mostrati = tutti ? comuni : comuni.slice(0, LIMITE_IN_COMUNE);
  // Cambiando i volantini mostrati il prodotto aperto può non essere più in comune: il pannello si chiude
  const aperto = comuni.find(p => p.referenza.chiave === chiaveAperta) ?? null;
  const numeroKit = formatNumero(griglia.numeroKit);

  return (
    <section aria-labelledby={idTitolo} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 id={idTitolo} className="title-card dark:text-slate-200">
          Prodotti in comune
        </h3>
        {comuni.length > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {plurale(comuni.length, "prodotto", "prodotti")} in tutti i {numeroKit} volantini
            {diversi > 0 ? ` · ${formatNumero(diversi)} con prezzo diverso, qui per primi` : " · stesso prezzo ovunque"}. Apri una scheda per prezzi, sconti e pagine.
          </p>
        )}
      </div>

      {comuni.length === 0 ? (
        <p className="rounded-card border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-darkmode-300 dark:text-slate-300">
          Nessun prodotto è in tutti i {numeroKit} volantini mostrati. Per vedere quelli in comune a un gruppo di volantini filtra la pagina per insegna o per area.
        </p>
      ) : (
        <ul aria-label="Prodotti in comune" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {mostrati.map(prodotto => (
            <li key={prodotto.referenza.chiave}>
              <Scheda prodotto={prodotto} griglia={griglia} onApri={() => setChiaveAperta(prodotto.referenza.chiave)} />
            </li>
          ))}
        </ul>
      )}

      {comuni.length > LIMITE_IN_COMUNE && (
        <button
          type="button"
          aria-expanded={tutti}
          onClick={() => setTutti(attuale => !attuale)}
          className="inline-flex items-center gap-1 self-center rounded-control px-3 py-1.5 text-sm font-semibold text-theme-1 hover:bg-theme-1/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:text-indigo-200 dark:hover:bg-indigo-300/15"
        >
          {tutti ? "Mostra meno" : `Mostra tutti i ${formatNumero(comuni.length)} prodotti in comune`}
          <Lucide icon={tutti ? "ChevronUp" : "ChevronDown"} aria-hidden="true" className="h-4 w-4" />
        </button>
      )}

      <Slideover open={aperto !== null} onClose={() => setChiaveAperta(null)} size="xl">
        <Slideover.Panel>
          {aperto && (
            <>
              {/* Il titolo dà il nome al pannello; Chiudi gli sta accanto, fuori dal nome */}
              <div className="flex items-center gap-2 border-b border-slate-200/60 pr-4 dark:border-darkmode-400">
                <Slideover.Title className="min-w-0 flex-1 gap-3 border-b-0 py-4">
                  <Foto key={aperto.referenza.foto ?? ""} url={aperto.referenza.foto} className="h-12 w-12" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">
                      {aperto.referenza.nome || "Prodotto senza nome"}
                      {aperto.referenza.marca && (
                        <>
                          {" "}
                          <strong className="font-extrabold">{aperto.referenza.marca}</strong>
                        </>
                      )}
                    </span>
                    <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                      {[aperto.referenza.formato, aperto.referenza.codice ? `cod. ${aperto.referenza.codice}` : null].filter(Boolean).join(" · ") || descriviPresenze(aperto, griglia).testo}
                    </span>
                  </span>
                </Slideover.Title>
                <button
                  type="button"
                  aria-label="Chiudi"
                  onClick={() => setChiaveAperta(null)}
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:hover:bg-darkmode-400"
                >
                  <Lucide icon="X" aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{descriviPresenze(aperto, griglia).testo}</p>
                  <Prezzi prodotto={aperto} griglia={griglia} numeroKit={griglia.numeroKit} />
                  <Differenza prodotto={aperto} />
                </div>
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Prezzi e pagine per insegna e area</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Scegli una pagina per aprire gli insight di quel volantino su questo prodotto.</p>
                  <PrezziEPagine prodotto={aperto} griglia={griglia} tinta={tinta} />
                </div>
              </div>
            </>
          )}
        </Slideover.Panel>
      </Slideover>
    </section>
  );
}
