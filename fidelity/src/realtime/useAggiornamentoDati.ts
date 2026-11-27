import { QueryClientContext } from '@tanstack/react-query';
import { useContext, useEffect, useRef } from 'react';
import { useMatches, useNavigation, useRevalidator } from 'react-router-dom';
import { aggiornatoreDi, leggiAvviso, TUTTE_LE_RISORSE } from './aggiornamentoDati';

/** Il nome dell'evento con cui il server avvisa che dei dati sono cambiati. */
export const EVENTO_DATI_CAMBIATI = 'dati:cambiato';

interface CanaleAvvisi {
  on(evento: string, ascoltatore: (...argomenti: unknown[]) => void): unknown;
  off(evento: string, ascoltatore?: (...argomenti: unknown[]) => void): unknown;
  recovered?: boolean;
}

/**
 * Collega il canale delle notifiche alla rilettura dei dati: ogni avviso di cambio dati fa rileggere
 * le query attive e le pagine con un loader, e dopo una riconnessione si rilegge tutto (gli avvisi
 * persi non si recuperano).
 */
export function useAggiornamentoDati(canale: CanaleAvvisi | null): void {
  const queryClient = useContext(QueryClientContext);
  const revalidator = useRevalidator();
  const navigazione = useNavigation();
  const corrispondenze = useMatches();

  // Le pagine con un loader che da' dati: si rileggono col loader; le altre non hanno niente da rieseguire
  const conDatiDalLoader = corrispondenze.some(voce => voce.data !== undefined && voce.data !== null);
  const stato = useRef({ conDatiDalLoader, revalidator, inNavigazione: navigazione.state !== 'idle' });
  stato.current = { conDatiDalLoader, revalidator, inNavigazione: navigazione.state !== 'idle' };

  useEffect(() => {
    if (!queryClient) return;
    const aggiornatore = aggiornatoreDi(queryClient);
    const smetti = aggiornatore.iscrivi(() => {
      const { conDatiDalLoader: dalLoader, revalidator: rilettore, inNavigazione } = stato.current;
      if (dalLoader && !inNavigazione && rilettore.state === 'idle') void rilettore.revalidate();
    });
    return smetti;
  }, [queryClient]);

  useEffect(() => {
    if (!canale || !queryClient) return;
    const aggiornatore = aggiornatoreDi(queryClient);
    const alAvviso = (dato: unknown) => aggiornatore.onAvviso(leggiAvviso(dato));
    // Al primo collegamento non c'e' niente da recuperare; a ogni successivo, se gli avvisi persi
    // non sono stati recuperati dal canale, si rilegge tutto
    let primoCollegamento = true;
    const allaConnessione = () => {
      if (primoCollegamento) {
        primoCollegamento = false;
        return;
      }
      if (!canale.recovered) aggiornatore.onRiconnessione();
    };
    canale.on(EVENTO_DATI_CAMBIATI, alAvviso);
    canale.on('connect', allaConnessione);
    return () => {
      canale.off(EVENTO_DATI_CAMBIATI, alAvviso);
      canale.off('connect', allaConnessione);
    };
  }, [canale, queryClient]);
}

/**
 * Per le pagine che non leggono i dati con React Query ne' con un loader (una richiesta nella pagina):
 * `ricarica` si chiama quando cambiano dati che la pagina puo' mostrare. Con `risorse` solo per quelli
 * indicati (tipi di dato, in minuscolo: "promo", "acpv", ...); senza, a ogni cambio.
 */
export function useCambioDati(ricarica: () => void, risorse?: readonly string[]): void {
  // Senza QueryClient (una pagina provata da sola) non c'e' nessun avviso da ascoltare
  const queryClient = useContext(QueryClientContext);
  const ultima = useRef(ricarica);
  ultima.current = ricarica;
  const chiave = risorse ? risorse.map(voce => voce.toLowerCase()).join('|') : null;

  useEffect(() => {
    if (!queryClient) return;
    const elenco = chiave === null ? null : chiave.split('|').filter(Boolean);
    return aggiornatoreDi(queryClient).iscrivi((cambiati) => {
      if (elenco === null || cambiati.has(TUTTE_LE_RISORSE) || elenco.some(voce => cambiati.has(voce))) ultima.current();
    });
  }, [queryClient, chiave]);
}
