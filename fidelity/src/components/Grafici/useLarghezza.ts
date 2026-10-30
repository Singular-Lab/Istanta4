import { useLayoutEffect, useRef, useState } from "react";

/**
 * Larghezza del contenitore in pixel, aggiornata quando cambia: i grafici disegnano in scala 1:1,
 * così i testi restano della loro misura a ogni larghezza. Senza ResizeObserver (test) resta
 * quella predefinita.
 */
export function useLarghezza<T extends HTMLElement = HTMLDivElement>(predefinita: number) {
  const riferimento = useRef<T>(null);
  const [larghezza, setLarghezza] = useState(predefinita);

  useLayoutEffect(() => {
    const elemento = riferimento.current;
    if (!elemento || typeof ResizeObserver === "undefined") return;
    const misura = () => {
      const attuale = Math.round(elemento.clientWidth);
      if (attuale > 0) setLarghezza(attuale);
    };
    misura();
    const osservatore = new ResizeObserver(misura);
    osservatore.observe(elemento);
    return () => osservatore.disconnect();
  }, []);

  return [riferimento, larghezza] as const;
}

export default useLarghezza;
