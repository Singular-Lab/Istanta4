import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** La chiave della posizione salvata: una per voce della cronologia. */
export const chiaveScorrimento = (chiaveVoce: string): string => `scorrimento:${chiaveVoce}`;

const leggi = (chiave: string): number | null => {
  try {
    const valore = Number(window.sessionStorage.getItem(chiave));
    return Number.isFinite(valore) && valore > 0 ? valore : null;
  } catch {
    // sessionStorage può mancare o rifiutare (navigazione privata, dati del sito bloccati)
    return null;
  }
};

const scrivi = (chiave: string, valore: number) => {
  try {
    window.sessionStorage.setItem(chiave, String(Math.round(valore)));
  } catch {
    // Senza sessionStorage il ritorno riparte dall'alto, come prima
  }
};

/**
 * Tornando a una pagina con Indietro la ritrova dove l'utente l'aveva lasciata (spec volantini-pop,
 * "Dettaglio di consultazione della promozione"): mentre si scorre la posizione si salva in
 * sessionStorage per la voce della cronologia (location.key, che cambia anche quando l'indirizzo
 * cambia i filtri), al più una volta per fotogramma; al ritorno (navigazione POP) si ripristina una
 * volta sola, appena `pronto` dice che il contenuto c'è e la pagina è alta come allora.
 * Non si salva allo smontaggio: con StrictMode il finto smontaggio scriverebbe 0 sopra la posizione.
 */
export function useRipristinoScorrimento(pronto: boolean): void {
  const { key } = useLocation();
  const tipo = useNavigationType();
  const ripristinato = useRef(false);

  useEffect(() => {
    let richiesta: number | null = null;
    const salva = () => {
      if (richiesta !== null) return;
      richiesta = window.requestAnimationFrame(() => {
        richiesta = null;
        scrivi(chiaveScorrimento(key), window.scrollY);
      });
    };
    window.addEventListener("scroll", salva, { passive: true });
    return () => {
      window.removeEventListener("scroll", salva);
      if (richiesta !== null) window.cancelAnimationFrame(richiesta);
    };
  }, [key]);

  useEffect(() => {
    if (ripristinato.current || !pronto) return;
    ripristinato.current = true;
    if (tipo !== "POP") return;
    const posizione = leggi(chiaveScorrimento(key));
    // Dopo il disegno: la pagina deve essere già alta abbastanza
    if (posizione !== null) window.requestAnimationFrame(() => window.scrollTo(0, posizione));
  }, [pronto, tipo, key]);
}

export default useRipristinoScorrimento;
