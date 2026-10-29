import { parametriMateriali } from "@/utils/materiali";
import type { PeriodoMateriali } from "../../../lib/materiali/periodi";
import type { FiltriFilePop, RichiestaZipPop } from "../../../lib/materiali/tipi";
import { ServerCall } from "../../../lib/server_call";

/** Motivo per cui i comandi di download sono disattivati. */
export const MOTIVO_SENZA_DOWNLOAD = "Manca il permesso di scaricare file";

export type FiltriZipPop = NonNullable<RichiestaZipPop["filtri"]>;

/**
 * ZIP dei file di un formato che corrispondono ai filtri (nessun filtro = tutto il formato).
 * Va aperto come link: il browser scarica lo ZIP in streaming senza tenerlo in memoria.
 */
export const urlZipFormato = (
  idPromo: string,
  periodo: PeriodoMateriali,
  idFormato: string,
  filtri: FiltriZipPop = {}
): string =>
  `${ServerCall.getUrl()}/materiali/pop/promozioni/${encodeURIComponent(idPromo)}/zip?${parametriMateriali({
    periodo,
    idFormato,
    ...filtri,
  })}`;

/** Filtri dei file da passare allo ZIP: solo quelli impostati. */
export const filtriPerZip = (filtri: Omit<FiltriFilePop, "periodo" | "idFormato" | "pagina" | "dimensione">): FiltriZipPop => {
  const usati: FiltriZipPop = {};
  if (filtri.cerca) usati.cerca = filtri.cerca;
  if (filtri.stato) usati.stato = filtri.stato;
  if (filtri.idArea) usati.idArea = filtri.idArea;
  if (filtri.idCanale) usati.idCanale = filtri.idCanale;
  if (filtri.reparto) usati.reparto = filtri.reparto;
  return usati;
};

/** Singolo file, con il nome originale (stesso endpoint delle altre pagine dei materiali). */
export const urlFileSingolo = (idOlimpoCloud: string, nome: string): string =>
  `${ServerCall.getUrl()}/downloadPDFVolantino/${encodeURIComponent(idOlimpoCloud)}?fileName=${encodeURIComponent(nome)}`;

/** Nome di file sicuro per lo ZIP: niente separatori di percorso né caratteri riservati. */
export const nomeZip = (...parti: string[]): string =>
  `${parti
    .map((parte) => parte.replace(/[\\/:*?"<>|]+/g, " ").trim())
    .filter(Boolean)
    .join(" - ") || "file"}.zip`;

/**
 * ZIP dei file selezionati: la lista degli id va nel corpo, quindi POST con i cookie di sessione
 * e il token CSRF, come le altre richieste che modificano. Il file arriva come blob e si salva
 * con un link temporaneo. Lancia un errore con il motivo del server se la richiesta fallisce.
 */
export const scaricaZipSelezionati = async (idPromo: string, richiesta: RichiestaZipPop, nomeFile: string) => {
  const headers = new Headers();
  headers.append("Content-Type", "application/json");
  headers.append("X-Requested-With", "XMLHttpRequest");
  headers.append("x-csrf-token", (await ServerCall.ensureCSRFToken()) ?? "");

  const risposta = await fetch(`${ServerCall.getUrl()}/materiali/pop/promozioni/${encodeURIComponent(idPromo)}/zip`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(richiesta),
  });

  if (!risposta.ok) {
    const corpo = (await risposta.json().catch(() => null)) as { message?: string } | null;
    throw new Error(corpo?.message || `Download non riuscito (errore ${risposta.status})`);
  }

  const blob = await risposta.blob();
  const indirizzo = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = indirizzo;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  // Il link si toglie dopo il click, quando il browser ha già preso il file
  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(indirizzo);
  }, 100);
};
