import styleWp from "@/assets/css/webpliant/stylewp.module.scss";
import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "../WebpliantLayout.module.css";

/**
 * Stati condivisi delle pagine pubbliche Webpliant (vetrina del GDO): restano nel tema `wp`,
 * distinto da quello operatore. Un solo caricamento, un solo vuoto, un solo errore.
 */

/** Titolo di pagina della vetrina (h1). */
export const CLASSE_TITOLO_PUBBLICO = clsx(styleWp["wp-h3"], styleWp["wp-text-uppercase"], styleWp["wp-text-center"]);

/** Titolo di un pannello o di un riquadro della vetrina (drawer, overlay). */
export const CLASSE_TITOLO_PANNELLO_PUBBLICO = clsx(styleWp["wp-text-uppercase"], styleWp["wp-fs-6"]);

/** Campo di testo della vetrina (ricerca, CAP), squadrato come nel tema. */
export const CLASSE_CAMPO_PUBBLICO = clsx(styleWp["wp-form-control"], "w-full");

/** Spinner del tema pubblico, lo stesso del caricamento a tutta pagina. */
export function SpinnerPubblico({ className }: { className?: string }) {
  return <span aria-hidden="true" className={clsx(styles.spinnerWebpliant, className)} />;
}

export function CaricamentoPubblico({ testo = "Caricamento in corso..." }: { testo?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16">
      <SpinnerPubblico />
      <span className={styles.loadingTextWebpliant}>{testo}</span>
    </div>
  );
}

export function VuotoPubblico({ titolo, descrizione, children }: { titolo: string; descrizione?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <p className={clsx(styleWp["wp-fs-5"], styleWp["wp-fw-medium"], styleWp["wp-mb-0"])}>{titolo}</p>
      {descrizione && <p className={clsx(styleWp["wp-text-muted"], styleWp["wp-mb-0"])}>{descrizione}</p>}
      {children}
    </div>
  );
}

/** Catch-all di /webpliant: la vetrina resta nel suo tema invece di mostrare la 404 operatore. */
export function PaginaNonTrovataPubblica() {
  return (
    <VuotoPubblico titolo="Pagina non trovata" descrizione="La pagina che cerchi non esiste o non è più disponibile.">
      <a href="/webpliant" className={clsx(styleWp["wp-btn"], styleWp["wp-btn-primary"], "mt-3")}>
        Torna alla vetrina
      </a>
    </VuotoPubblico>
  );
}

/** Errore di caricamento di una pagina della vetrina. */
export function ErroreRottaPubblica() {
  return (
    <ErrorePubblico
      messaggio="Non è stato possibile caricare la pagina. Riprova tra qualche istante."
      onRiprova={() => window.location.reload()}
    />
  );
}

export function ErrorePubblico({
  titolo = "Si è verificato un errore",
  messaggio,
  onRiprova,
  etichettaRiprova = "Ricarica la pagina",
}: {
  titolo?: string;
  messaggio: ReactNode;
  onRiprova?: () => void;
  etichettaRiprova?: string;
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <p className={clsx(styleWp["wp-fs-5"], styleWp["wp-fw-medium"], styleWp["wp-text-danger"], styleWp["wp-mb-0"])}>{titolo}</p>
      <p className={clsx(styleWp["wp-text-muted"], styleWp["wp-mb-0"])}>{messaggio}</p>
      {onRiprova && (
        <button type="button" onClick={onRiprova} className={clsx(styleWp["wp-btn"], styleWp["wp-btn-primary"], "mt-3")}>
          {etichettaRiprova}
        </button>
      )}
    </div>
  );
}
