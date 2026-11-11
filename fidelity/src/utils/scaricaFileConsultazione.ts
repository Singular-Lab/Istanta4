import { useNotification } from "@/context/NotificationContext";
import axios from "axios";
import { useState } from "react";
import { percorsoFileConsultazione } from "../../lib/consultazione/periodi";
import { ServerCall } from "../../lib/server_call";

/**
 * Download dei file pubblicati dalle pagine di Visualizzazione: GET /api/consultazione/file/:id,
 * che chiede solo "materiali.scarica" e risponde solo per i file pubblicati della GDO dell'utente.
 */

/** Motivo per cui i comandi di download sono disattivati: lo stesso delle viste Volantini e POP. */
export const MOTIVO_SENZA_PERMESSO_SCARICA = "Manca il permesso di scaricare volantini e POP";

const MOTIVO_GENERICO = "Download del file non riuscito";

/** Nome dal Content-Disposition (filename* in UTF-8, poi filename), se c'è. */
export function nomeDaIntestazione(intestazione: string | undefined | null): string | null {
  if (!intestazione) return null;
  const esteso = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(intestazione);
  if (esteso) {
    try {
      return decodeURIComponent(esteso[1].trim());
    } catch {
      // filename* malformato: si prova il nome semplice
    }
  }
  const semplice = /filename\s*=\s*"?([^";]+)"?/i.exec(intestazione);
  return semplice ? semplice[1].trim() : null;
}

/** Testo di un Blob, anche dove Blob.text() manca (browser vecchi, jsdom). */
const testoDelBlob = (blob: Blob): Promise<string> =>
  typeof blob.text === "function"
    ? blob.text()
    : new Promise((risolvi, rifiuta) => {
      const lettore = new FileReader();
      lettore.onload = () => risolvi(String(lettore.result ?? ""));
      lettore.onerror = () => rifiuta(lettore.error);
      lettore.readAsText(blob);
    });

/** Motivo dell'errore scritto dal server (JSON con `message`), anche quando la risposta è un Blob. */
async function motivoErrore(errore: unknown): Promise<string> {
  if (!axios.isAxiosError(errore)) return MOTIVO_GENERICO;
  const dati: unknown = errore.response?.data;
  let corpo: unknown = dati;
  if (typeof Blob !== "undefined" && dati instanceof Blob) {
    try {
      corpo = JSON.parse(await testoDelBlob(dati));
    } catch {
      corpo = null;
    }
  }
  const messaggio = corpo && typeof corpo === "object" ? (corpo as { message?: unknown }).message : undefined;
  if (typeof messaggio === "string" && messaggio.trim()) return messaggio;
  if (errore.response?.status === 401) return "Sessione scaduta: accedi di nuovo per scaricare il file";
  if (errore.response?.status === 403) return MOTIVO_SENZA_PERMESSO_SCARICA;
  return MOTIVO_GENERICO;
}

/**
 * Scarica il file e lo salva con il nome dato dal server (o `nome`). Se il server rifiuta o Olimpo
 * non risponde lancia un errore con il motivo, e nessun file viene salvato.
 */
export async function scaricaFileConsultazione(idFile: string, nome?: string): Promise<void> {
  let risposta;
  try {
    // Con il cookie di sessione anche quando l'API sta su un'altra origine (sviluppo: pagina e API su
    // porte diverse), come ServerCall con credentials: "include": senza, il server risponde 401
    risposta = await axios.get<Blob>(`${ServerCall.getUrl()}${percorsoFileConsultazione(idFile)}`, { responseType: "blob", withCredentials: true });
  } catch (errore) {
    throw new Error(await motivoErrore(errore));
  }
  const nomeFile = nomeDaIntestazione(risposta.headers?.["content-disposition"]) ?? nome ?? "file.pdf";
  const indirizzo = window.URL.createObjectURL(risposta.data);
  const link = document.createElement("a");
  link.href = indirizzo;
  link.download = nomeFile;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(indirizzo);
}

/**
 * Download con il suo stato: `inCorso` è l'id del file che si sta scaricando (uno alla volta);
 * se il download non riesce, il motivo arriva come notifica nella pagina.
 */
export function useScaricaFileConsultazione() {
  const { showNotification } = useNotification();
  const [inCorso, setInCorso] = useState<string | null>(null);

  const scarica = async (idFile: string, nome?: string) => {
    if (inCorso) return;
    setInCorso(idFile);
    try {
      await scaricaFileConsultazione(idFile, nome);
    } catch (errore) {
      showNotification((errore as Error)?.message || MOTIVO_GENERICO, { variant: "error" });
    } finally {
      setInCorso(null);
    }
  };

  return { inCorso, scarica };
}
