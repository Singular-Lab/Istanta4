import { useSocket } from "@/hooks/useSocket";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type { RichiestaRicercaPosizioni, StatoRicercaPosizioni } from "../../../lib/puntiVendita/analisi";
import { ServerCall } from "../../../lib/server_call";
import { decodificaPayloadSocket } from "../../utils/importPuntiVendita";

const URL_RICERCA = "/punti-vendita/gestione/posizioni-righe";
/** Rilettura dello stato mentre la ricerca è in corso, oltre agli eventi del socket. */
const INTERVALLO_RILETTURA_MS = 5000;

const attiva = (stato: StatoRicercaPosizioni | null | undefined): boolean => stato?.stato === "in_corso";

/** La percentuale della ricerca, intera. */
export const percentualeRicerca = (stato: StatoRicercaPosizioni): number =>
  stato.totale === 0 ? 100 : Math.min(100, Math.round((stato.esaminate / stato.totale) * 100));

/**
 * La ricerca in background della posizione delle righe dei volantini: la avvia, ne segue
 * l'avanzamento via socket (posizioniRighe_<jobId>_progress/_complete), la annulla e, riaprendo la
 * pagina, ritrova quella in corso o l'ultima appena finita. A ogni posizione trovata e alla fine
 * rilegge la verifica e le righe non abbinate.
 */
export function usePosizioniRighe() {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [stato, setStato] = useState<StatoRicercaPosizioni | null>(null);
  const [avvioInCorso, setAvvioInCorso] = useState(false);
  const [annullamentoInCorso, setAnnullamentoInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const jobId = stato?.jobId;
  const inCorso = attiva(stato);

  const rileggiDati = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["puntiVendita", "gestione", "verifica-collegamenti"] });
    void queryClient.invalidateQueries({ queryKey: ["puntiVendita", "gestione", "righe-non-abbinate"] });
  }, [queryClient]);

  useEffect(() => {
    ServerCall.get<{ stato: StatoRicercaPosizioni | null }>(`${URL_RICERCA}/stato`)
      .then(risposta => setStato(risposta?.stato ?? null))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!socket || !jobId || !inCorso) return;
    const progress = `posizioniRighe_${jobId}_progress`;
    const complete = `posizioniRighe_${jobId}_complete`;
    const aggiorna = (dati: unknown) => setStato(decodificaPayloadSocket<StatoRicercaPosizioni>(dati));
    const termina = (dati: unknown) => {
      setStato(decodificaPayloadSocket<StatoRicercaPosizioni>(dati));
      setAnnullamentoInCorso(false);
      rileggiDati();
    };
    socket.on(progress, aggiorna);
    socket.on(complete, termina);
    // Un evento perso durante una riconnessione non lascia la barra ferma: si rilegge lo stato
    const rileggi = () =>
      ServerCall.get<{ stato: StatoRicercaPosizioni | null }>(`${URL_RICERCA}/stato?jobId=${encodeURIComponent(jobId)}`)
        .then(risposta => {
          if (!risposta?.stato) return;
          if (attiva(risposta.stato)) setStato(risposta.stato);
          else termina(risposta.stato);
        })
        .catch(() => undefined);
    socket.on("connect", rileggi);
    return () => {
      socket.off(progress, aggiorna);
      socket.off(complete, termina);
      socket.off("connect", rileggi);
    };
  }, [socket, jobId, inCorso, rileggiDati]);

  // Gli eventi arrivano solo a chi ha avviato la ricerca: gli altri (e chi perde il socket) rileggono lo stato ogni tanto
  useEffect(() => {
    if (!jobId || !inCorso) return;
    const timer = setInterval(() => {
      ServerCall.get<{ stato: StatoRicercaPosizioni | null }>(`${URL_RICERCA}/stato?jobId=${encodeURIComponent(jobId)}`)
        .then(risposta => {
          if (!risposta?.stato) return;
          setStato(risposta.stato);
          if (!attiva(risposta.stato)) {
            setAnnullamentoInCorso(false);
            rileggiDati();
          }
        })
        .catch(() => undefined);
    }, INTERVALLO_RILETTURA_MS);
    return () => clearInterval(timer);
  }, [jobId, inCorso, rileggiDati]);

  // Le posizioni trovate compaiono nella verifica mentre la ricerca va avanti, non solo alla fine
  const trovate = stato?.trovate ?? 0;
  useEffect(() => {
    if (inCorso && trovate > 0 && trovate % 10 === 0) rileggiDati();
  }, [inCorso, trovate, rileggiDati]);

  const avvia = useCallback(async (richiesta: RichiestaRicercaPosizioni = {}) => {
    setAvvioInCorso(true);
    setErrore(null);
    try {
      const risposta = await ServerCall.post<StatoRicercaPosizioni>(URL_RICERCA, richiesta);
      setStato(risposta);
      if (!attiva(risposta)) rileggiDati();
    } catch (e) {
      // 409: una ricerca della GDO è già in corso, avviata da qualcun altro: la si segue
      if ((e as { httpStatus?: number })?.httpStatus === 409) {
        const risposta = await ServerCall.get<{ stato: StatoRicercaPosizioni | null }>(`${URL_RICERCA}/stato`).catch(() => null);
        if (risposta?.stato) {
          setStato(risposta.stato);
          return;
        }
      }
      setErrore((e as Error)?.message || "Ricerca delle posizioni non avviata");
    } finally {
      setAvvioInCorso(false);
    }
  }, [rileggiDati]);

  const annulla = useCallback(async () => {
    if (!jobId) return;
    setAnnullamentoInCorso(true);
    try {
      const risposta = await ServerCall.post<{ stato: StatoRicercaPosizioni }>(`${URL_RICERCA}/${encodeURIComponent(jobId)}/annulla`, {});
      if (risposta?.stato && !attiva(risposta.stato)) {
        setStato(risposta.stato);
        setAnnullamentoInCorso(false);
      }
    } catch (e) {
      setAnnullamentoInCorso(false);
      setErrore((e as Error)?.message || "Annullamento non riuscito");
    }
  }, [jobId]);

  return { stato, inCorso, avvia, annulla, avvioInCorso, annullamentoInCorso, errore };
}
