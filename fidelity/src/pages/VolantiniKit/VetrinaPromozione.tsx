import Lucide from "@/components/Base/Lucide";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { Link } from "react-router-dom";
import { percorsoPromozioneVolantini, type PeriodoConsultazione } from "../../../lib/consultazione/periodi";
import type { VetrinaVolantiniConsultazione } from "../../../lib/consultazione/tipi";
import CollageCopertine from "./CollageCopertine";
import { MOTIVO_IN_VETRINA, numeriDeiKit, periodoPromo, tempoDellaPromo } from "./testi";

export interface VetrinaPromozioneProps {
  vetrina: VetrinaVolantiniConsultazione;
  periodo: PeriodoConsultazione;
  className?: string;
}

/** Copertine nel ventaglio della vetrina. */
export const COPERTINE_VETRINA = 7;

function Numero({ valore, singolare, plurale }: { valore: number; singolare: string; plurale: string }) {
  // Il numero in grande sopra l'etichetta, ma letto dopo: "volantini 12" in un elenco di definizioni
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs text-indigo-200">{valore === 1 ? singolare : plurale}</dt>
      <dd className="text-3xl font-bold leading-tight tabular-nums text-white">{formatNumero(valore)}</dd>
    </div>
  );
}

/**
 * La promozione in vetrina del periodo, in testa alla pagina e solo senza filtri: banda navy con il
 * nome piccolo sopra il periodo in grande, il cartellino di quanto manca, i numeri e il ventaglio
 * delle copertine; la didascalia dice perché c'è lei. Un solo collegamento, "Apri la promozione",
 * che si allarga a tutta la banda: si clicca ovunque, ma da tastiera è una tappa sola.
 */
function VetrinaPromozione({ vetrina, periodo, className }: VetrinaPromozioneProps) {
  const { promo, kit } = vetrina.promozione;
  const adesso = new Date();
  const numeri = numeriDeiKit(kit);
  const tempo = tempoDellaPromo(periodo, promo, adesso);

  return (
    <section
      aria-label="Promozione in vetrina"
      className={twMerge(
        // Il navy del tema con una trama di puntini e una luce in basso a destra; in tema scuro un filo chiaro la stacca dal fondo
        "group/promo relative isolate grid gap-6 overflow-hidden rounded-card bg-theme-1 p-5 text-white shadow-card [background-image:radial-gradient(rgb(255_255_255/0.08)_1px,transparent_1px),linear-gradient(135deg,transparent_30%,rgb(255_255_255/0.09))] [background-size:18px_18px,100%_100%] sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] dark:ring-1 dark:ring-white/10",
        className
      )}
    >
      <div className="flex min-w-0 flex-col justify-center gap-3.5">
        <p className="text-2xs font-bold uppercase tracking-wider text-indigo-200 [overflow-wrap:anywhere]">
          In vetrina · {promo.nome}
        </p>
        <h2 className="text-4xl font-bold leading-none tracking-tight text-white sm:text-5xl 2xl:text-6xl">
          {periodoPromo(promo.validitaDal, promo.validitaAl, { adesso })}
        </h2>
        {tempo && (
          // Cartellino del prezzo, col buco: giallo come i cartellini dei volantini, leggibile su ogni tema
          <span className="relative inline-flex -rotate-2 items-center self-start bg-amber-300 py-1.5 pl-7 pr-4 text-sm font-extrabold text-amber-950 [clip-path:polygon(14px_0,100%_0,100%_100%,14px_100%,0_50%)] before:absolute before:left-2.5 before:top-1/2 before:h-1.5 before:w-1.5 before:-translate-y-1/2 before:rounded-full before:bg-theme-1 before:content-['']">
            {tempo.testo}
          </span>
        )}
        <dl className="flex flex-wrap gap-x-7 gap-y-2.5">
          <Numero valore={numeri.volantini} singolare="volantino" plurale="volantini" />
          <Numero valore={numeri.insegne} singolare="insegna" plurale="insegne" />
          <Numero valore={numeri.aree} singolare="area" plurale="aree" />
          {/* 0: le liste dei punti vendita non sono arrivate, il numero non si mostra */}
          {numeri.puntiVendita > 0 && (
            <Numero valore={numeri.puntiVendita} singolare="punto vendita" plurale="punti vendita" />
          )}
        </dl>
        <Link
          to={percorsoPromozioneVolantini(promo.id)}
          aria-label={`Apri la promozione ${promo.nome}`}
          className="inline-flex items-center gap-2 self-start rounded-full bg-white px-4 py-2.5 font-bold text-theme-1 shadow-sm after:absolute after:inset-0 after:z-20 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-theme-1 motion-safe:transition-[gap] motion-safe:duration-200 motion-safe:group-hover/promo:gap-3"
        >
          Apri la promozione
          <Lucide icon="ArrowRight" aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex min-w-0 flex-col justify-center gap-2">
        <CollageCopertine kit={kit} massimo={COPERTINE_VETRINA} variante="vetrina" />
        <p className="text-right text-2xs text-indigo-200">{MOTIVO_IN_VETRINA[vetrina.motivo]}</p>
      </div>
    </section>
  );
}

export default VetrinaPromozione;
