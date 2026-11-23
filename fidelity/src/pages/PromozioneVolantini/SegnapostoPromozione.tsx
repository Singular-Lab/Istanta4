import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import { twMerge } from "@/utils/twMerge";

const SCURO = "dark:bg-darkmode-400 dark:from-darkmode-400 dark:via-darkmode-300 dark:to-darkmode-400";

/** Un blocco grigio: le classi scure tengono il segnaposto leggibile anche nel tema scuro. */
const Blocco = ({ className }: { className: string }) => <Skeleton className={twMerge(SCURO, className)} />;

/**
 * Segnaposto della banda e dei filtri, con l'altezza e la forma delle parti vere: la pagina non
 * salta quando arrivano i dati. Si usa solo prima che la promozione sia stata letta, perche' dopo
 * la banda e i filtri si costruiscono dai volantini (query leggera).
 */
export function SegnapostoBandaEFiltri() {
  return (
    <>
      <Blocco className="h-40 rounded-2xl lg:h-44" />
      <Blocco className="h-14 rounded-card" />
    </>
  );
}

/** Schede segnaposto della griglia dei volantini: copertina 5:7 e riga con insegna e area, come GrigliaVolantini. */
export function SegnapostoGriglia({ schede = 6 }: { schede?: number }) {
  return (
    <Sezione titolo="Volantini della promozione" descrizione="Una scheda per volantino, con la sua insegna e la sua area.">
      <ul
        aria-busy="true"
        aria-label="Caricamento dei volantini"
        className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] gap-5"
      >
        {Array.from({ length: schede }, (_, indice) => (
          <li
            key={indice}
            className="overflow-hidden rounded-card border border-slate-200 bg-white dark:border-darkmode-400 dark:bg-darkmode-600"
          >
            <span className="flex justify-center bg-slate-100 px-7 pb-5 pt-6 dark:bg-darkmode-700">
              <Blocco className="aspect-[5/7] h-auto w-full max-w-[10rem] rounded-sm" />
            </span>
            <span className="flex items-center gap-3 border-t border-slate-200 px-4 py-3.5 dark:border-darkmode-400">
              <Blocco className="h-9 w-9 flex-none rounded-full" />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Blocco className="h-3.5 w-2/3" />
                <Blocco className="h-3 w-1/2" />
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Sezione>
  );
}

/**
 * Segnaposto di quello che si calcola sui kit: l'assortimento a confronto (prodotti in comune e
 * elenco) e i pannelli di analisi. Arrivano dopo, dal calcolo degli insight: intanto la pagina e'
 * gia' usabile.
 */
export function SegnapostoAnalisi() {
  return (
    <div role="status" aria-label="Caricamento dell'assortimento e delle analisi" className="flex flex-col gap-6">
      <Sezione titolo="Assortimento a confronto" descrizione="Prodotti in comune e tutti i prodotti, per insegna e area.">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, indice) => (
              <Blocco key={indice} className="h-40 rounded-card" />
            ))}
          </div>
          <Blocco className="h-72 rounded-card" />
        </div>
      </Sezione>
      <Blocco className="h-14 rounded-card" />
      <Blocco className="h-14 rounded-card" />
    </div>
  );
}
