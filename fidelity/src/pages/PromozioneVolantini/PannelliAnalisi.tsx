import Lucide from "@/components/Base/Lucide";
import { useParametriUrl } from "@/hooks/useParametriUrl";
import { twMerge } from "@/utils/twMerge";
import { useEffect, useId, useRef, type ReactNode } from "react";

/** Un pannello delle analisi sotto l'elenco dei prodotti: la chiave va nell'indirizzo quando è aperto. */
export interface PannelloAnalisi {
  chiave: string;
  titolo: string;
  /** Una riga che dice cosa contiene, visibile anche a pannello chiuso. */
  descrizione: string;
  icona: string;
  /** Il contenuto, disegnato solo a pannello aperto: i grafici non si calcolano finché non servono. */
  contenuto: () => ReactNode;
}

/** I pannelli aperti, nell'indirizzo come ?analisi=assortimento,volantini. */
export const PARAMETRO_ANALISI = "analisi";

/** L'id del pannello nella pagina, per i collegamenti dell'indice. */
export const idPannello = (chiave: string): string => `pannello-${chiave}`;

/**
 * Sotto la barra dei filtri, che resta in alto: una parte portata in vista si ferma più in basso, così
 * la barra non ne copre l'inizio. La stessa misura dell'elenco dei prodotti.
 */
export const SOTTO_LA_BARRA = "scroll-mt-[9.5rem]";

export const apertiDa = (valore: string | null): Set<string> => new Set((valore ?? "").split(",").map(voce => voce.trim()).filter(Boolean));

/** Porta in vista un elemento della pagina; jsdom e i browser vecchi non hanno scrollIntoView con le opzioni. */
export const portaInVista = (id: string) => {
  const elemento = document.getElementById(id);
  if (elemento && typeof elemento.scrollIntoView === "function") elemento.scrollIntoView({ behavior: "smooth", block: "start" });
};

/**
 * Un pannello: la barra con titolo e descrizione apre e chiude il contenuto, che compare subito sotto
 * con le sue sezioni. La barra non le racchiude: dentro una Sezione non va un'altra Sezione.
 */
function Pannello({ pannello, aperto, onApriChiudi }: { pannello: PannelloAnalisi; aperto: boolean; onApriChiudi: () => void }) {
  const idContenuto = useId();
  return (
    <section id={idPannello(pannello.chiave)} aria-label={pannello.titolo} className={twMerge("flex flex-col gap-4", SOTTO_LA_BARRA)}>
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={aperto}
          aria-controls={aperto ? idContenuto : undefined}
          onClick={onApriChiudi}
          className={twMerge(
            "flex w-full items-center gap-3 rounded-card border bg-white px-5 py-4 text-left transition-colors hover:border-theme-1/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:bg-darkmode-600 dark:hover:border-indigo-300/60",
            aperto ? "border-theme-1/40 dark:border-indigo-300/40" : "border-slate-200 dark:border-darkmode-400"
          )}
        >
          <span aria-hidden="true" className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-theme-1/10 text-theme-1 dark:bg-indigo-300/15 dark:text-indigo-200">
            <Lucide icon={pannello.icona} className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-slate-800 dark:text-slate-100">{pannello.titolo}</span>
            <span className="block text-sm font-normal text-slate-500 dark:text-slate-400">{pannello.descrizione}</span>
          </span>
          <span aria-hidden="true" className="hidden whitespace-nowrap text-sm font-semibold text-theme-1 sm:inline dark:text-indigo-200">
            {aperto ? "Chiudi" : "Apri"}
          </span>
          <Lucide icon="ChevronDown" aria-hidden="true" className={twMerge("h-5 w-5 flex-none text-slate-500 transition-transform motion-reduce:transition-none", aperto && "rotate-180")} />
        </button>
      </h2>
      {aperto && (
        <div id={idContenuto} className="flex flex-col gap-6">
          {pannello.contenuto()}
        </div>
      )}
    </section>
  );
}

export interface PannelliAnalisiProps {
  pannelli: readonly PannelloAnalisi[];
  /**
   * Il pannello da aprire e portare in vista (dall'indice della pagina o dalla sua barra): appena è
   * aperto la pagina lo porta in vista e lo dice con `onMostra(null)`.
   */
  daMostrare: string | null;
  onMostra: (chiave: string | null) => void;
}

/**
 * Le analisi della promozione che seguono l'elenco dei prodotti, in pannelli a scomparsa (spec
 * volantini-pop, "Dettaglio di consultazione della promozione"): chiusi all'apertura della pagina,
 * ciascuno si apre e si chiude da sé, e quelli aperti restano nell'indirizzo, così tornando dagli
 * insight di un kit si ritrovano aperti. Aprendo un pannello, dalla sua barra o dall'indice della
 * pagina, la pagina lo porta in vista, sotto la barra dei filtri.
 */
export function PannelliAnalisi({ pannelli, daMostrare, onMostra }: PannelliAnalisiProps) {
  const [parametri, aggiorna] = useParametriUrl();
  const aperti = apertiDa(parametri.get(PARAMETRO_ANALISI));
  const scrivi = (prossimi: ReadonlySet<string>) =>
    // Nell'ordine dei pannelli, così lo stesso stato ha sempre lo stesso indirizzo
    aggiorna({ [PARAMETRO_ANALISI]: pannelli.filter(p => prossimi.has(p.chiave)).map(p => p.chiave).join(",") || null });
  const apriChiudi = (chiave: string) => {
    const prossimi = new Set(aperti);
    if (prossimi.has(chiave)) {
      prossimi.delete(chiave);
      if (daMostrare === chiave) onMostra(null);
    } else {
      prossimi.add(chiave);
      onMostra(chiave);
    }
    scrivi(prossimi);
  };

  // Il pannello chiesto dall'indice si apre; aperto, si porta in vista una volta sola. L'effetto segue
  // solo la richiesta e l'apertura: il resto, che cambia a ogni disegno, si legge dall'ultimo disegno
  const daMostrareAperto = daMostrare !== null && aperti.has(daMostrare);
  const ultimo = useRef({ pannelli, aperti, scrivi, onMostra });
  ultimo.current = { pannelli, aperti, scrivi, onMostra };
  useEffect(() => {
    const { pannelli: tutti, aperti: apertiOra, scrivi: scriviOra, onMostra: mostra } = ultimo.current;
    if (daMostrare === null || !tutti.some(p => p.chiave === daMostrare)) return;
    if (!daMostrareAperto) {
      scriviOra(new Set([...apertiOra, daMostrare]));
      return;
    }
    portaInVista(idPannello(daMostrare));
    mostra(null);
  }, [daMostrare, daMostrareAperto]);

  return (
    <div className="flex flex-col gap-3">
      {pannelli.map(pannello => (
        <Pannello key={pannello.chiave} pannello={pannello} aperto={aperti.has(pannello.chiave)} onApriChiudi={() => apriChiudi(pannello.chiave)} />
      ))}
    </div>
  );
}

export default PannelliAnalisi;
