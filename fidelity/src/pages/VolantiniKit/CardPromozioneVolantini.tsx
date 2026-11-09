import Lucide from "@/components/Base/Lucide";
import StatusBadge from "@/components/Base/StatusBadge";
import type { TonoStato } from "@/constants/stati";
import { twMerge } from "@/utils/twMerge";
import { Link } from "react-router-dom";
import { percorsoPromozioneVolantini, type PeriodoConsultazione } from "../../../lib/consultazione/periodi";
import type { PromozioneVolantiniConsultazione } from "../../../lib/consultazione/tipi";
import CollageCopertine from "./CollageCopertine";
import { numeriDeiKit, periodoPromo, plurale, tempoDellaPromo, testoVolantini } from "./testi";

export interface CardPromozioneVolantiniProps {
  promozione: PromozioneVolantiniConsultazione;
  /** Decide cosa dice il badge: giorni alla scadenza, giorni all'inizio o la fine. */
  periodo: PeriodoConsultazione;
  /** 4 sotto le intestazioni dei mesi dello Storico, altrimenti 3. */
  livelloTitolo?: 3 | 4;
  className?: string;
}

/** Copertine nel collage della scheda: i kit oltre diventano "+N". */
export const COPERTINE_SCHEDA = 5;

// I colori di StatusBadge sono pensati per il fondo chiaro: sulla scheda scura si abbassano
const BADGE_SCURO: Partial<Record<TonoStato, string>> = {
  neutral: "dark:bg-darkmode-400 dark:text-slate-200",
  info: "dark:bg-sky-400/15 dark:text-sky-200",
  warning: "dark:bg-amber-400/15 dark:text-amber-200",
};

const minuscola = (testo: string) => testo.charAt(0).toLowerCase() + testo.slice(1);

/**
 * Una promozione con volantini pubblicati: il collage delle copertine dei primi kit, il nome
 * piccolo sopra il periodo di validità in grande, quanto manca e i numeri (volantini, punti vendita
 * stampati, insegne). Le varianti non si elencano: tutta la scheda apre il dettaglio di
 * consultazione della promozione, che non è quello della produzione.
 */
function CardPromozioneVolantini({ promozione, periodo, livelloTitolo = 3, className }: CardPromozioneVolantiniProps) {
  const { promo, kit, numeroKit } = promozione;
  const adesso = new Date();
  const numeri = numeriDeiKit(promozione);
  const tempo = tempoDellaPromo(periodo, promo, adesso);
  // Con i filtri arrivano solo i kit che corrispondono: la scheda dice quanti sono sul totale
  const volantini = testoVolantini(kit.length, numeroKit);
  // 0 vuol dire che le liste dei punti vendita non sono arrivate, non che il volantino non ne ha
  const puntiVendita =
    numeri.puntiVendita > 0 ? plurale(numeri.puntiVendita, "punto vendita", "punti vendita") : null;
  const insegne = plurale(numeri.insegne, "insegna", "insegne");
  const Titolo = livelloTitolo === 4 ? "h4" : "h3";

  // Il nome del collegamento per intero, con l'anno: i pezzi della scheda letti in fila non si separerebbero
  const etichetta = [
    promo.nome,
    periodoPromo(promo.validitaDal, promo.validitaAl, { adesso, conAnno: true }),
    tempo ? minuscola(tempo.testo) : null,
    volantini,
    puntiVendita,
    insegne,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      to={percorsoPromozioneVolantini(promo.id)}
      aria-label={etichetta}
      className={twMerge(
        "group/promo flex h-full flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-card transition-[border-color,box-shadow,transform] duration-200 hover:border-theme-1/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 motion-safe:hover:-translate-y-0.5 dark:border-darkmode-400 dark:bg-darkmode-600 dark:hover:border-indigo-300/40 dark:focus-visible:ring-indigo-300/50",
        className
      )}
    >
      <CollageCopertine kit={kit} massimo={COPERTINE_SCHEDA} />

      <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-3.5">
        {/* I nomi delle promo sono spesso codici senza spazi (P2622_VOL_05-11-26): vanno a capo */}
        <span className="title-eyebrow [overflow-wrap:anywhere] dark:text-slate-400">{promo.nome}</span>
        <div className="flex flex-wrap items-start justify-between gap-x-2.5 gap-y-1.5">
          <Titolo className="min-w-0 text-xl font-bold leading-tight text-slate-800 dark:text-slate-100">
            {periodoPromo(promo.validitaDal, promo.validitaAl, { adesso })}
          </Titolo>
          {tempo && (
            <StatusBadge
              tono={tempo.tono}
              etichetta={tempo.testo}
              icon={tempo.icona}
              className={twMerge("mt-1", BADGE_SCURO[tempo.tono])}
            />
          )}
        </div>
        <div className="mt-auto flex flex-wrap gap-x-3.5 gap-y-1 pt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Lucide icon="Layers" aria-hidden="true" className="h-3.5 w-3.5" />
            {volantini}
          </span>
          {puntiVendita && (
            <span className="inline-flex items-center gap-1.5">
              <Lucide icon="Store" aria-hidden="true" className="h-3.5 w-3.5" />
              {puntiVendita}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Lucide icon="Tags" aria-hidden="true" className="h-3.5 w-3.5" />
            {insegne}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default CardPromozioneVolantini;
