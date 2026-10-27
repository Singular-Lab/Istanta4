import {
  STATO_LAVORAZIONE_KIT_RUNTIME,
  STATO_ORDINI_STAMPA,
  STATO_PROMO,
  STATO_UTENTI,
  STATO_WEBHOOK,
} from "../../lib/enums";

/** Tono visivo di uno stato: decide i colori del badge, non il testo. */
export type TonoStato = "neutral" | "info" | "brand" | "success" | "warning" | "danger";

export interface DescrizioneStato {
  etichetta: string;
  tono: TonoStato;
}

export type DominioStato = "promo" | "kitRuntime" | "ordineStampa" | "utente" | "webhook";

/** Stato che il catalogo non conosce: non va mai mascherato da uno stato valido. */
export const STATO_SCONOSCIUTO: DescrizioneStato = { etichetta: "Stato sconosciuto", tono: "neutral" };

const STATI_PROMO: Record<STATO_PROMO, DescrizioneStato> = {
  [STATO_PROMO.PIANIFICATA]: { etichetta: "Pianificata", tono: "neutral" },
  [STATO_PROMO.IN_LAVORAZIONE]: { etichetta: "In lavorazione", tono: "info" },
  [STATO_PROMO.IN_ATTESA_DI_VALIDITA]: { etichetta: "In attesa di validità", tono: "brand" },
  [STATO_PROMO.IN_SCADENZA]: { etichetta: "In scadenza", tono: "warning" },
  [STATO_PROMO.IN_RITARDO]: { etichetta: "In ritardo", tono: "danger" },
  [STATO_PROMO.VALIDA]: { etichetta: "Valida", tono: "success" },
  [STATO_PROMO.VALIDA_CON_ERRORI]: { etichetta: "Valida con errori", tono: "warning" },
  [STATO_PROMO.ARCHIVIATA]: { etichetta: "Archiviata", tono: "neutral" },
  [STATO_PROMO.ELIMINATA]: { etichetta: "Eliminata", tono: "danger" },
};

const STATI_KIT_RUNTIME: Record<STATO_LAVORAZIONE_KIT_RUNTIME, DescrizioneStato> = {
  [STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE]: { etichetta: "In lavorazione", tono: "info" },
  [STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI]: { etichetta: "In lavorazione con errori", tono: "warning" },
  [STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE]: { etichetta: "In revisione", tono: "brand" },
  [STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO]: { etichetta: "Pubblicato", tono: "success" },
  [STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO]: { etichetta: "Eliminato", tono: "danger" },
};

const STATI_ORDINE_STAMPA: Record<STATO_ORDINI_STAMPA, DescrizioneStato> = {
  [STATO_ORDINI_STAMPA.IN_REVISIONE]: { etichetta: "In revisione", tono: "brand" },
  [STATO_ORDINI_STAMPA.REVISIONATO]: { etichetta: "Revisionato", tono: "info" },
  [STATO_ORDINI_STAMPA.IN_INVIO]: { etichetta: "Invio in corso", tono: "info" },
  [STATO_ORDINI_STAMPA.FINITO]: { etichetta: "Completato", tono: "success" },
  [STATO_ORDINI_STAMPA.ERRORE]: { etichetta: "Errore", tono: "danger" },
};

const STATI_UTENTE: Record<STATO_UTENTI, DescrizioneStato> = {
  [STATO_UTENTI.ATTIVO]: { etichetta: "Attivo", tono: "success" },
  [STATO_UTENTI.DISATTIVO]: { etichetta: "Disattivo", tono: "neutral" },
  [STATO_UTENTI.SOSPESO]: { etichetta: "Sospeso", tono: "warning" },
  [STATO_UTENTI.BLOCCATO]: { etichetta: "Bloccato", tono: "danger" },
  [STATO_UTENTI.ELIMINATO]: { etichetta: "Eliminato", tono: "danger" },
};

const STATI_WEBHOOK: Record<STATO_WEBHOOK, DescrizioneStato> = {
  [STATO_WEBHOOK.ATTIVO]: { etichetta: "Attivo", tono: "success" },
  [STATO_WEBHOOK.DISATTIVO]: { etichetta: "Disattivo", tono: "neutral" },
  [STATO_WEBHOOK.SOSPESO]: { etichetta: "Sospeso", tono: "warning" },
  [STATO_WEBHOOK.ERRORE]: { etichetta: "Errore", tono: "danger" },
  [STATO_WEBHOOK.ELIMINATO]: { etichetta: "Eliminato", tono: "danger" },
};

/** Unica fonte di etichetta e tono degli stati: ogni pagina mostra lo stesso stato allo stesso modo. */
export const CATALOGO_STATI: Record<DominioStato, Record<string, DescrizioneStato>> = {
  promo: STATI_PROMO,
  kitRuntime: STATI_KIT_RUNTIME,
  ordineStampa: STATI_ORDINE_STAMPA,
  utente: STATI_UTENTE,
  webhook: STATI_WEBHOOK,
};

export const descriviStato = (dominio: DominioStato, stato: string | null | undefined): DescrizioneStato =>
  stato && Object.prototype.hasOwnProperty.call(CATALOGO_STATI[dominio], stato)
    ? CATALOGO_STATI[dominio][stato]
    : STATO_SCONOSCIUTO;
