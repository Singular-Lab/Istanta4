/**
 * Stati del bottone del report PDF e testi per l'utente. Funzioni pure.
 */

/**
 * Passo in corso: i dati dal server, il generatore del PDF, la miniatura della prima pagina da Olimpo
 * per la copertina, l'impaginazione.
 */
export type FaseReport = "dati" | "generatore" | "copertina" | "impaginazione";

export type StatoReport =
  | { fase: "inattivo" }
  | { fase: "dati" }
  | { fase: "generatore" }
  | { fase: "copertina" }
  | { fase: "impaginazione" }
  | { fase: "errore"; messaggio: string };

export const ETICHETTA_IN_CORSO = "Preparazione del report…";

export const inCorso = (stato: StatoReport): boolean => stato.fase !== "inattivo" && stato.fase !== "errore";

/** Riga dell'avanzamento sotto il bottone; null quando non c'e' niente in corso. */
export function testoAvanzamento(stato: StatoReport): string | null {
  switch (stato.fase) {
    case "dati":
      return "Dati del volantino";
    case "generatore":
      return "Avvio del generatore PDF";
    case "copertina":
      return "Copertina";
    case "impaginazione":
      return "Impaginazione del PDF";
    default:
      return null;
  }
}

/** Il motivo scritto dal server (CustomError di ServerCall) o dall'errore; null se non c'e'. */
export function motivoErrore(errore: unknown): string | null {
  if (errore && typeof errore === "object") {
    const conMessaggioUtente = errore as { getUserMessage?: unknown; message?: unknown };
    if (typeof conMessaggioUtente.getUserMessage === "function") {
      const messaggio: unknown = (conMessaggioUtente.getUserMessage as () => unknown).call(errore);
      if (typeof messaggio === "string" && messaggio.trim()) return messaggio.trim();
    }
    if (typeof conMessaggioUtente.message === "string" && conMessaggioUtente.message.trim()) return conMessaggioUtente.message.trim();
  }
  if (typeof errore === "string" && errore.trim()) return errore.trim();
  return null;
}

const PREFISSI: Record<FaseReport, string> = {
  dati: "Dati del report non disponibili",
  generatore: "Generatore del PDF non caricato: controlla la connessione",
  copertina: "Copertina del report non preparata",
  impaginazione: "Impaginazione del PDF non riuscita",
};

/** Messaggio per l'utente: cosa non e' riuscito e, se si sa, perche'. */
export function messaggioErrore(fase: FaseReport, errore: unknown): string {
  // Il caricamento del modulo fallisce con messaggi tecnici del browser: basta dire cosa fare
  const motivo = fase === "generatore" ? null : motivoErrore(errore);
  return motivo ? `${PREFISSI[fase]}: ${motivo}` : `${PREFISSI[fase]}.`;
}
