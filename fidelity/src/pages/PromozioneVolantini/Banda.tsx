import { BadgeIniziativa } from "@/components/BadgeIniziativa";
import type { Tinta } from "@/components/Grafici";
import { twMerge } from "@/utils/twMerge";
import { ETICHETTA_PERIODO_CONSULTAZIONE } from "../../../lib/consultazione/periodi";
import type { DettaglioPromozioneVolantiniConsultazione, Riferimento, VarianteConsultazione } from "../../../lib/consultazione/tipi";
import { fraseKit, testoValidita } from "./analisi";
import { LogoInsegna } from "./LogoInsegna";

export interface BandaProps {
  /** Basta la promo, il periodo e i volantini mostrati: la banda esce anche prima del calcolo degli insight. */
  dettaglio: Pick<DettaglioPromozioneVolantiniConsultazione, "promo" | "periodo"> & {
    kit: readonly Pick<VarianteConsultazione, "canale" | "area">[];
  };
  /** Le insegne fra cui scegliere, come la tendina Insegna. */
  insegne: readonly Riferimento[];
  tinta: (idCanale: string) => Tinta;
  /** L'insegna filtrata, se c'è. */
  idCanale: string | undefined;
  /** Sceglie un'insegna come filtro; di nuovo sulla stessa, il filtro si toglie. */
  onScegliInsegna: (idCanale: string) => void;
}

/**
 * La banda in testa alla pagina: periodo e promozione, validità in grande, quanti volantini per
 * quante insegne e aree (quelli dei filtri). Niente cartellino di quanto manca o di quando è finita
 * (spec volantini-pop). A destra le insegne con il loro logo: ognuna filtra la pagina su di sé, come
 * la tendina Insegna. Le copertine sono nella griglia dei volantini, sotto i filtri.
 */
export function Banda({ dettaglio, insegne, tinta, idCanale, onScegliInsegna }: BandaProps) {
  const { promo, periodo, kit } = dettaglio;

  return (
    <section
      aria-label="La promozione"
      className={twMerge(
        "relative grid grid-cols-1 gap-6 overflow-hidden rounded-2xl bg-theme-1 px-5 py-6 text-white shadow-card sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center lg:py-8",
        // Il codice dell'iniziativa sta in alto a sinistra: il contenuto scende per lasciargli posto
        promo.codiceIniziativa?.trim() && "pt-16 lg:pt-16"
      )}
    >
      {/* Il codice dell'iniziativa in alto a sinistra della banda */}
      <BadgeIniziativa codice={promo.codiceIniziativa} suScuro className="absolute left-5 top-5 z-10 sm:left-8" />
      {/* Luce in diagonale e trama a puntini sopra la tinta del tema */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent to-white/10" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.14)_1px,transparent_1px)] bg-[length:18px_18px] opacity-50"
      />

      <div className="relative flex min-w-0 flex-col justify-center gap-3.5">
        <p className="title-eyebrow font-bold text-indigo-200 [overflow-wrap:anywhere]">
          Volantini {ETICHETTA_PERIODO_CONSULTAZIONE[periodo]} · {promo.nome}
        </p>
        <p className="text-4xl font-extrabold leading-[0.98] tracking-tight [text-wrap:balance] sm:text-5xl xl:text-6xl">{testoValidita(promo)}</p>
        {kit.length > 0 && <p className="max-w-[44ch] text-base text-indigo-200">{fraseKit(kit)}.</p>}
      </div>

      {insegne.length > 0 && (
        <div className="relative flex min-w-0 flex-col gap-2.5">
          <p className="title-eyebrow font-bold text-indigo-200">Le insegne</p>
          <ul aria-label="Insegne della promozione" className="flex flex-wrap gap-2.5">
            {insegne.map(insegna => {
              const scelta = idCanale?.toLowerCase() === insegna.id.toLowerCase();
              return (
                <li key={insegna.id}>
                  <button
                    type="button"
                    aria-pressed={scelta}
                    aria-label={scelta ? `Togli il filtro sull'insegna ${insegna.nome}` : `Solo i volantini dell'insegna ${insegna.nome}`}
                    onClick={() => onScegliInsegna(insegna.id)}
                    className={twMerge(
                      "flex items-center gap-2.5 rounded-control bg-white py-2 pl-2 pr-3.5 text-sm font-bold text-slate-800 shadow-sm",
                      "outline-none ring-offset-2 ring-offset-theme-1 focus-visible:ring-2 focus-visible:ring-amber-300",
                      "motion-safe:transition-transform motion-safe:hover:-translate-y-0.5",
                      scelta ? "ring-2 ring-amber-300" : idCanale && "opacity-70 hover:opacity-100"
                    )}
                  >
                    <LogoInsegna idCanale={insegna.id} nome={insegna.nome} tinta={tinta(insegna.id)} misura="medio" />
                    {insegna.nome}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

export default Banda;
