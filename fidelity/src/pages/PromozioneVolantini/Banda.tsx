import { twMerge } from "@/utils/twMerge";
import { Link } from "react-router-dom";
import { ETICHETTA_PERIODO_CONSULTAZIONE } from "../../../lib/consultazione/periodi";
import type { DettaglioPromozioneVolantiniConsultazione } from "../../../lib/consultazione/tipi";
import { percorsoDettaglioVolantino } from "../../../lib/materiali/periodi";
import { colonneMuro, fraseKit, kitPerMuro, nomeKit, testoQuantoManca, testoValidita } from "./analisi";
import { conMiniatura, Copertina } from "./Copertina";

// Ombra della carta stampata sotto le copertine, uguale nei due temi: la banda è sempre scura
const OMBRA_FOGLIO = "shadow-[0_1px_2px_rgba(10,14,40,0.22),0_14px_26px_-12px_rgba(10,14,40,0.45)]";

/** Il cartellino giallo del prezzo, con il foro: dice quanto manca alla fine o all'inizio. */
function Cartellino({ testo }: { testo: string }) {
  return (
    <span className="relative inline-flex -rotate-[2.5deg] items-center self-start bg-amber-300 py-1.5 pl-[1.625rem] pr-4 text-sm font-extrabold text-amber-950 [clip-path:polygon(14px_0,100%_0,100%_100%,14px_100%,0_50%)]">
      <span aria-hidden="true" className="absolute left-2.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-theme-1" />
      {testo}
    </span>
  );
}

/**
 * La banda in testa alla pagina: periodo e promozione, validità in grande, quanto manca, quanti
 * volantini per quante insegne e aree; a destra il muro inclinato con le copertine di tutti i kit,
 * ognuna apre gli insight del suo volantino. Il movimento al passaggio del mouse solo con
 * prefers-reduced-motion non attivo.
 */
export function Banda({ dettaglio }: { dettaglio: DettaglioPromozioneVolantiniConsultazione }) {
  const { promo, periodo, kit } = dettaglio;
  const quantoManca = testoQuantoManca(periodo, promo);
  const muro = kitPerMuro(kit);

  return (
    <section
      aria-label="La promozione"
      className="relative grid grid-cols-1 overflow-hidden rounded-2xl bg-theme-1 text-white shadow-card lg:min-h-[340px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
    >
      {/* Luce in diagonale e trama a puntini sopra la tinta del tema */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent to-white/10" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.14)_1px,transparent_1px)] bg-[length:18px_18px] opacity-50"
      />

      <div className="relative flex min-w-0 flex-col justify-center gap-3.5 px-5 pb-3 pt-6 sm:px-8 lg:py-8 lg:pr-0">
        <p className="title-eyebrow font-bold text-indigo-200 [overflow-wrap:anywhere]">
          Volantini {ETICHETTA_PERIODO_CONSULTAZIONE[periodo]} · {promo.nome}
        </p>
        <p className="text-4xl font-extrabold leading-[0.98] tracking-tight [text-wrap:balance] sm:text-5xl xl:text-6xl">{testoValidita(promo)}</p>
        {quantoManca && <Cartellino testo={quantoManca} />}
        <p className="max-w-[44ch] text-base text-indigo-200">
          {fraseKit(kit)}. Ogni copertina apre gli insight del suo volantino.
        </p>
      </div>

      <div className="relative min-h-[260px] overflow-hidden lg:min-h-[320px]">
        <ul
          aria-label="Copertine dei volantini"
          className="absolute grid -rotate-[8deg] content-center gap-3.5 [inset:-30%_-12%_-30%_2%]"
          style={{ gridTemplateColumns: `repeat(${colonneMuro(kit.length)}, minmax(0, 1fr))` }}
        >
          {muro.map(k => (
            // I fogli pari scendono un poco: il muro sembra appoggiato a mano
            <li key={k.id} className="relative even:translate-y-[18px] hover:z-10 focus-within:z-10">
              <Link
                to={percorsoDettaglioVolantino(k.id)}
                aria-label={`Insight del volantino ${nomeKit(k)}`}
                title={`${nomeKit(k)} – ${k.titolo}`}
                className={twMerge(
                  "relative block aspect-[5/7] overflow-hidden rounded-sm bg-white outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-theme-1",
                  OMBRA_FOGLIO,
                  "motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-1.5 motion-safe:hover:scale-[1.04]"
                )}
              >
                <Copertina kit={k} carta className="h-full w-full" />
                {/* Sul segnaposto canale e area ci sono già */}
                {conMiniatura(k) && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-3.5 text-3xs font-bold leading-tight text-white [overflow-wrap:anywhere]"
                  >
                    {nomeKit(k)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default Banda;
