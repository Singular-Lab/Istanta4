import { useEffect, useRef, useState } from "react";

/**
 * Testo di un campo di ricerca che si applica dopo una pausa nella digitazione, così il server
 * non riceve una richiesta a ogni tasto. Se il valore applicato cambia da fuori (Azzera filtri,
 * cronologia del browser) il campo lo segue.
 */
export function useRicercaDifferita(applicato: string, applica: (testo: string) => void, ritardo = 300) {
  const [testo, setTesto] = useState(applicato);
  const applicaCorrente = useRef(applica);

  useEffect(() => {
    applicaCorrente.current = applica;
  }, [applica]);

  useEffect(() => {
    setTesto(applicato);
  }, [applicato]);

  useEffect(() => {
    if (testo === applicato) return undefined;
    const attesa = setTimeout(() => applicaCorrente.current(testo), ritardo);
    return () => clearTimeout(attesa);
  }, [testo, applicato, ritardo]);

  return [testo, setTesto] as const;
}

export default useRicercaDifferita;
