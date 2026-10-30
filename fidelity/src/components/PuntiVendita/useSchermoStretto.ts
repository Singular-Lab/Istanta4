import { useSyncExternalStore } from "react";

/** Sotto il breakpoint sm di Tailwind (640px) gli elenchi dei punti vendita diventano schede. */
export const MEDIA_SCHERMO_STRETTO = "(max-width: 639.98px)";

const media = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(MEDIA_SCHERMO_STRETTO) : null;

const iscrivi = (avvisa: () => void) => {
  const query = media();
  if (!query) return () => {};
  query.addEventListener("change", avvisa);
  return () => query.removeEventListener("change", avvisa);
};

/**
 * Vero sotto sm: le tabelle larghe si mostrano come schede, una per punto vendita, invece di
 * colonne tagliate. Senza matchMedia (test, rendering lato server) resta la vista larga.
 */
export const useSchermoStretto = () => useSyncExternalStore(iscrivi, () => media()?.matches ?? false, () => false);

export default useSchermoStretto;
