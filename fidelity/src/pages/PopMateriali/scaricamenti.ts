import { useNotification } from "@/context/NotificationContext";
import { formatNumero } from "@/utils/format";
import { parametriMateriali } from "@/utils/materiali";
import { useState } from "react";
import type { PeriodoMateriali } from "../../../lib/materiali/periodi";
import type { FiltriFilePop, RichiestaZipPop, VerificaZipPop } from "../../../lib/materiali/tipi";
import { ServerCall } from "../../../lib/server_call";

/** Motivo per cui i comandi di download sono disattivati. */
export const MOTIVO_SENZA_DOWNLOAD = "Manca il permesso di scaricare file";
/** Motivo per cui lo ZIP di un formato senza file è disattivato. */
export const MOTIVO_SENZA_FILE = "Il formato non ha file da scaricare";

export type FiltriZipPop = NonNullable<RichiestaZipPop["filtri"]>;

const percorsoZip = (idPromo: string): string => `/materiali/pop/promozioni/${encodeURIComponent(idPromo)}/zip`;

/** ZIP dei file di un formato che corrispondono ai filtri (nessun filtro = tutto il formato). */
export const urlZipFormato = (
  idPromo: string,
  periodo: PeriodoMateriali,
  idFormato: string,
  filtri: FiltriZipPop = {}
): string =>
  `${ServerCall.getUrl()}${percorsoZip(idPromo)}?${parametriMateriali({
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

// Niente iframe nascosti: la CSP del sito (frame-src 'none') li blocca. Lo ZIP arriva come allegato
// (Content-Disposition: attachment), quindi il browser lo scarica e la pagina resta dov'è

/** GET dello ZIP come da un link con download: il nome del file lo dà il server. */
function scaricaDaIndirizzo(indirizzo: string) {
  const link = document.createElement("a");
  link.href = indirizzo;
  link.download = "";
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Form nascosto: il corpo arriva come form (urlencoded), con i campi indicati. */
function inviaModulo(azione: string, campi: Readonly<Record<string, string>>) {
  const modulo = document.createElement("form");
  modulo.method = "POST";
  modulo.action = azione;
  modulo.hidden = true;
  for (const [nome, valore] of Object.entries(campi)) {
    const campo = document.createElement("input");
    campo.type = "hidden";
    campo.name = nome;
    campo.value = valore;
    modulo.appendChild(campo);
  }
  document.body.appendChild(modulo);
  modulo.submit();
  modulo.remove();
}

/**
 * ZIP dei file POP in due passi. Prima la verifica, una POST JSON con il token CSRF (ritentata se il
 * token è scaduto): se non c'è niente da scaricare, la sessione è scaduta o la promo non è più nel
 * periodo lancia l'errore con il motivo del server, da mostrare nella pagina, e il download non parte.
 * Poi il download vero, che il browser riceve in streaming senza tenerlo in memoria: i file
 * selezionati con un form POST (la lista degli id nel corpo, il token CSRF in `_csrf`), tutti i file
 * del formato o dei filtri in GET.
 */
export async function scaricaZipPop(idPromo: string, richiesta: RichiestaZipPop): Promise<VerificaZipPop> {
  const verifica = await ServerCall.post<VerificaZipPop>(`${percorsoZip(idPromo)}/verifica`, richiesta);
  if (richiesta.idFile && richiesta.idFile.length > 0) {
    // Il token si legge dopo la verifica, che lo ha rinnovato se era scaduto
    inviaModulo(`${ServerCall.getUrl()}${percorsoZip(idPromo)}`, {
      _csrf: ServerCall.getCSRFToken() ?? "",
      richiesta: JSON.stringify(richiesta),
    });
  } else {
    scaricaDaIndirizzo(urlZipFormato(idPromo, richiesta.periodo, richiesta.idFormato, richiesta.filtri));
  }
  return verifica;
}

/**
 * Download ZIP di una promo con il suo stato: `inPreparazione` è la chiave del comando che sta
 * verificando (un download alla volta); l'esito arriva come notifica nella pagina.
 */
export function useScaricaZipPop(idPromo: string) {
  const { showNotification } = useNotification();
  const [inPreparazione, setInPreparazione] = useState<string | null>(null);

  const scarica = async (chiave: string, richiesta: RichiestaZipPop) => {
    if (inPreparazione) return;
    setInPreparazione(chiave);
    try {
      const { file } = await scaricaZipPop(idPromo, richiesta);
      showNotification(`Download avviato: ${formatNumero(file)} file nello ZIP`, { variant: "info" });
    } catch (errore) {
      showNotification((errore as Error)?.message || "Download dei file non riuscito", { variant: "error" });
    } finally {
      setInPreparazione(null);
    }
  };

  return { inPreparazione, scarica };
}
