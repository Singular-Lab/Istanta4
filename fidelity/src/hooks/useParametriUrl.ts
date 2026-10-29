import { useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";

export type ModificheParametri = Readonly<Record<string, string | number | null | undefined>>;

/**
 * Parametri della query string usati come stato della pagina (filtri, selezione, pagina).
 * `aggiorna` cambia solo le chiavi indicate (vuoto o null le toglie) e sostituisce la voce della
 * cronologia. Due aggiornamenti nello stesso evento si sommano: il secondo parte dal primo, non
 * dai parametri di prima dell'evento.
 */
export function useParametriUrl() {
  const [parametri, setParametri] = useSearchParams();
  const ultimi = useRef(parametri);
  ultimi.current = parametri;

  const aggiorna = useCallback(
    (modifiche: ModificheParametri) => {
      const prossimi = new URLSearchParams(ultimi.current);
      for (const [chiave, valore] of Object.entries(modifiche)) {
        if (valore === undefined || valore === null || valore === "") prossimi.delete(chiave);
        else prossimi.set(chiave, String(valore));
      }
      ultimi.current = prossimi;
      setParametri(prossimi, { replace: true });
    },
    [setParametri]
  );

  return [parametri, aggiorna] as const;
}

export default useParametriUrl;
