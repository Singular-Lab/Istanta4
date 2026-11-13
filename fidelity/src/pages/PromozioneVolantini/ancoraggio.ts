import { useLayoutEffect, useRef } from "react";

interface Ancora {
  elemento: Element;
  top: number;
  riserva: Element | null;
  topRiserva: number;
}

/**
 * Tiene fermo sullo schermo l'elemento scelto mentre la pagina cambia intorno a lui (un elenco che si
 * allunga o si accorcia sopra di lui, un comando che sparisce): prima del cambio si chiama
 * `ancora(elemento, riserva)`, dopo il disegno la pagina scorre di quanto l'elemento si è spostato.
 * Se l'elemento non c'è più vale la riserva; senza nessuno dei due la pagina resta com'è.
 */
export function useAncoraggio(): (elemento: Element | null, riserva?: Element | null) => void {
  const ancora = useRef<Ancora | null>(null);

  useLayoutEffect(() => {
    const voce = ancora.current;
    if (!voce) return;
    ancora.current = null;
    const [elemento, prima] = voce.elemento.isConnected ? [voce.elemento, voce.top] : [voce.riserva, voce.topRiserva];
    if (!elemento?.isConnected) return;
    const spostamento = elemento.getBoundingClientRect().top - prima;
    if (Math.abs(spostamento) > 1) window.scrollBy(0, spostamento);
  });

  return (elemento, riserva = null) => {
    if (!elemento) return;
    ancora.current = {
      elemento,
      top: elemento.getBoundingClientRect().top,
      riserva,
      topRiserva: riserva?.getBoundingClientRect().top ?? 0,
    };
  };
}
