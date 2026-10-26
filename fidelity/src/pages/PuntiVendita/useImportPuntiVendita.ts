import { useSocket } from "@/hooks/useSocket";
import { useCallback, useEffect, useState } from "react";
import { ServerCall } from "../../../lib/server_call";
import type { StatoImportPuntiVenditaDTO } from "../../../server/core/dto";
import { decodificaPayloadSocket, importAttivo, type DatiInserimentoManuale } from "../../utils/importPuntiVendita";

/**
 * Import dei punti vendita in background: lo avvia, ne segue l'avanzamento via socket
 * (importPV_<jobId>_progress/_complete), lo annulla e, riaprendo la pagina, ritrova quello in corso.
 * Quando l'import e fermo su una riga ambigua (stato in_attesa) invia la decisione dell'utente.
 */
export function useImportPuntiVendita(alTermine?: (stato: StatoImportPuntiVenditaDTO) => void) {
  const socket = useSocket();
  const [stato, setStato] = useState<StatoImportPuntiVenditaDTO | null>(null);
  const [avvioInCorso, setAvvioInCorso] = useState(false);
  const [annullamentoInCorso, setAnnullamentoInCorso] = useState(false);
  const jobId = stato?.jobId;
  const inCorso = importAttivo(stato);

  // Ricaricando la pagina si ritrova l'import ancora in corso (o l'ultimo appena finito)
  useEffect(() => {
    ServerCall.get<{ stato: StatoImportPuntiVenditaDTO | null }>("/ACPV/importaPV/stato")
      .then(risposta => {
        if (importAttivo(risposta?.stato)) setStato(risposta!.stato);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!socket || !jobId || !inCorso) return;
    const progress = `importPV_${jobId}_progress`;
    const complete = `importPV_${jobId}_complete`;
    const aggiorna = (dati: unknown) => setStato(decodificaPayloadSocket<StatoImportPuntiVenditaDTO>(dati));
    const termina = (dati: unknown) => {
      const finale = decodificaPayloadSocket<StatoImportPuntiVenditaDTO>(dati);
      setStato(finale);
      setAnnullamentoInCorso(false);
      alTermine?.(finale);
    };
    socket.on(progress, aggiorna);
    socket.on(complete, termina);
    // Un evento perso durante una riconnessione non lascia la barra ferma: si rilegge lo stato
    const rileggi = () =>
      ServerCall.get<{ stato: StatoImportPuntiVenditaDTO | null }>(`/ACPV/importaPV/stato?jobId=${jobId}`)
        .then(risposta => {
          if (!risposta?.stato) return;
          if (importAttivo(risposta.stato)) setStato(risposta.stato);
          else termina(risposta.stato);
        })
        .catch(() => undefined);
    socket.on("connect", rileggi);
    return () => {
      socket.off(progress, aggiorna);
      socket.off(complete, termina);
      socket.off("connect", rileggi);
    };
  }, [socket, jobId, inCorso, alTermine]);

  const avvia = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    setAvvioInCorso(true);
    try {
      const risposta = await ServerCall.post<{ jobId: string; stato: StatoImportPuntiVenditaDTO }>("/ACPV/importaPV", formData, true);
      setStato(risposta.stato);
      return risposta.stato;
    } finally {
      setAvvioInCorso(false);
    }
  }, []);

  const annulla = useCallback(async () => {
    if (!jobId) return;
    setAnnullamentoInCorso(true);
    try {
      await ServerCall.post(`/ACPV/importaPV/${jobId}/annulla`, {});
    } catch (e) {
      setAnnullamentoInCorso(false);
      throw e;
    }
  }, [jobId]);

  /** Inserisce la riga in attesa con i dati confermati, o la scarta; l'import poi riprende. */
  const decidi = useCallback(
    async (decisione: { azione: "inserisci"; dati: DatiInserimentoManuale } | { azione: "scarta" }) => {
      if (!jobId) return;
      const rigaDecisa = stato?.rigaInAttesa?.riga;
      const corpo = decisione.azione === "inserisci" ? { azione: "inserisci", ...decisione.dati } : { azione: "scarta" };
      const risposta = await ServerCall.post<{ stato: StatoImportPuntiVenditaDTO }>(`/ACPV/importaPV/${jobId}/decisione`, corpo);
      // L'evento socket arriva comunque: questo chiude subito il modale sulla riga decisa, senza
      // sovrascrivere uno stato piu recente arrivato via socket (per esempio la riga ambigua successiva)
      if (risposta?.stato) setStato(prima => (prima?.rigaInAttesa?.riga === rigaDecisa ? risposta.stato : prima));
    },
    [jobId, stato?.rigaInAttesa?.riga]
  );

  const azzera = useCallback(() => {
    setStato(null);
    setAnnullamentoInCorso(false);
  }, []);

  return { stato, inCorso, avvioInCorso, annullamentoInCorso, avvia, annulla, decidi, azzera };
}
