import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * Passaggio del puntatore sul menu laterale.
 *
 * Il menu compresso si riapre finché il puntatore ci resta sopra. A menu espanso il
 * passaggio non cambia niente: entrare e uscire aggiornano solo un ref, senza stato,
 * così il layout non si ridisegna a ogni passaggio.
 *
 * Se il menu viene compresso con il puntatore sopra (il pulsante "Comprimi" sta nel
 * menu), resta aperto finché il puntatore non esce.
 */
export function useSorvoloMenu(compresso: boolean) {
  // Dove sta davvero il puntatore, anche a menu espanso
  const dentro = useRef(false);
  const [sorvolato, setSorvolato] = useState(false);

  // Prima del disegno, così comprimendo col puntatore sopra il menu non si chiude per un frame
  useLayoutEffect(() => {
    setSorvolato(compresso && dentro.current);
  }, [compresso]);

  const onMouseEnter = useCallback(() => {
    dentro.current = true;
    if (compresso) {
      setSorvolato(true);
    }
  }, [compresso]);

  const onMouseLeave = useCallback(() => {
    dentro.current = false;
    if (compresso) {
      setSorvolato(false);
    }
  }, [compresso]);

  return { sorvolato: compresso && sorvolato, onMouseEnter, onMouseLeave };
}
