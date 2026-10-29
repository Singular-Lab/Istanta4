import {
  GDOWhatsappQueueJobStatus,
  STATO_GDO_WHATSAPP_NUMBER,
  STATO_GDO_WHATSAPP_TEMPLATE,
  STATO_LAVORAZIONE_KIT_RUNTIME,
  STATO_LOG_FILE,
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

export type DominioStato =
  | "promo"
  | "kitRuntime"
  | "fileKit"
  | "ordineStampa"
  | "utente"
  | "webhook"
  | "waCampagna"
  | "waMessaggio"
  | "waTemplate"
  | "waNumero";

/** Stato di una campagna WhatsApp, calcolato dal server sui suoi messaggi in coda. */
export const STATI_CAMPAGNA_WHATSAPP = ["PENDING", "RUNNING", "COMPLETED", "FAILED"] as const;
export type StatoCampagnaWhatsapp = (typeof STATI_CAMPAGNA_WHATSAPP)[number];

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

/** Kit previsto dalla promo ma senza runtime: le viste Volantini e POP lo mostrano come non avviato. */
export const STATO_KIT_NON_AVVIATO = "NON_AVVIATO";

const STATI_KIT_RUNTIME: Record<STATO_LAVORAZIONE_KIT_RUNTIME | typeof STATO_KIT_NON_AVVIATO, DescrizioneStato> = {
  [STATO_KIT_NON_AVVIATO]: { etichetta: "Non avviato", tono: "neutral" },
  [STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE]: { etichetta: "In lavorazione", tono: "info" },
  [STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI]: { etichetta: "In lavorazione con errori", tono: "warning" },
  [STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE]: { etichetta: "In revisione", tono: "brand" },
  [STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO]: { etichetta: "Pubblicato", tono: "success" },
  [STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO]: { etichetta: "Eliminato", tono: "danger" },
};

/** Stato dell'ultimo log di un file del kit. */
const STATI_FILE_KIT: Record<STATO_LOG_FILE, DescrizioneStato> = {
  [STATO_LOG_FILE.IN_ATTESA]: { etichetta: "In attesa", tono: "neutral" },
  [STATO_LOG_FILE.IN_REVISIONE]: { etichetta: "In revisione", tono: "brand" },
  [STATO_LOG_FILE.ACCETTATO]: { etichetta: "Accettato", tono: "success" },
  [STATO_LOG_FILE.ERRORE]: { etichetta: "Errore", tono: "danger" },
  [STATO_LOG_FILE.PUBBLICATO]: { etichetta: "Pubblicato", tono: "success" },
  [STATO_LOG_FILE.IN_ATTESA_DI_CORREGGO]: { etichetta: "In attesa di Correggo", tono: "info" },
  [STATO_LOG_FILE.CORREGGO_PUBBLICATO]: { etichetta: "Correggo pubblicato", tono: "success" },
  [STATO_LOG_FILE.CORREGGO_ERRORE]: { etichetta: "Errore Correggo", tono: "danger" },
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

const STATI_WA_CAMPAGNA: Record<StatoCampagnaWhatsapp, DescrizioneStato> = {
  COMPLETED: { etichetta: "Completata", tono: "success" },
  RUNNING: { etichetta: "In corso", tono: "info" },
  PENDING: { etichetta: "In attesa", tono: "neutral" },
  FAILED: { etichetta: "Fallita", tono: "danger" },
};

const STATI_WA_MESSAGGIO: Record<GDOWhatsappQueueJobStatus, DescrizioneStato> = {
  [GDOWhatsappQueueJobStatus.SUCCESS]: { etichetta: "Inviato", tono: "success" },
  [GDOWhatsappQueueJobStatus.PROCESSING]: { etichetta: "In invio", tono: "info" },
  [GDOWhatsappQueueJobStatus.PENDING]: { etichetta: "In coda", tono: "neutral" },
  [GDOWhatsappQueueJobStatus.FAILED]: { etichetta: "Fallito", tono: "danger" },
  [GDOWhatsappQueueJobStatus.CANCELLED]: { etichetta: "Annullato", tono: "neutral" },
};

const STATI_WA_TEMPLATE: Record<STATO_GDO_WHATSAPP_TEMPLATE, DescrizioneStato> = {
  [STATO_GDO_WHATSAPP_TEMPLATE.APPROVED]: { etichetta: "Approvato", tono: "success" },
  [STATO_GDO_WHATSAPP_TEMPLATE.PENDING]: { etichetta: "In revisione Meta", tono: "brand" },
  [STATO_GDO_WHATSAPP_TEMPLATE.REJECTED]: { etichetta: "Rifiutato", tono: "danger" },
  [STATO_GDO_WHATSAPP_TEMPLATE.PAUSED]: { etichetta: "In pausa", tono: "warning" },
  [STATO_GDO_WHATSAPP_TEMPLATE.DISABLED]: { etichetta: "Disabilitato", tono: "neutral" },
  [STATO_GDO_WHATSAPP_TEMPLATE.DELETED]: { etichetta: "Eliminato", tono: "danger" },
  [STATO_GDO_WHATSAPP_TEMPLATE.ARCHIVED]: { etichetta: "Archiviato", tono: "neutral" },
  [STATO_GDO_WHATSAPP_TEMPLATE.PENDING_DELETION]: { etichetta: "In eliminazione", tono: "warning" },
  [STATO_GDO_WHATSAPP_TEMPLATE.IN_APPEAL]: { etichetta: "In ricorso", tono: "info" },
  [STATO_GDO_WHATSAPP_TEMPLATE.LIMIT_EXCEEDED]: { etichetta: "Limite superato", tono: "danger" },
  [STATO_GDO_WHATSAPP_TEMPLATE.CREATED_BUT_NOT_SYNCED]: { etichetta: "Bozza locale", tono: "warning" },
};

const STATI_WA_NUMERO: Record<STATO_GDO_WHATSAPP_NUMBER, DescrizioneStato> = {
  [STATO_GDO_WHATSAPP_NUMBER.PENDING]: { etichetta: "In attesa di verifica", tono: "warning" },
  [STATO_GDO_WHATSAPP_NUMBER.VERIFIED]: { etichetta: "Verificato", tono: "success" },
  [STATO_GDO_WHATSAPP_NUMBER.PAUSED]: { etichetta: "In pausa", tono: "warning" },
};

/** Unica fonte di etichetta e tono degli stati: ogni pagina mostra lo stesso stato allo stesso modo. */
export const CATALOGO_STATI: Record<DominioStato, Record<string, DescrizioneStato>> = {
  promo: STATI_PROMO,
  kitRuntime: STATI_KIT_RUNTIME,
  fileKit: STATI_FILE_KIT,
  ordineStampa: STATI_ORDINE_STAMPA,
  utente: STATI_UTENTE,
  webhook: STATI_WEBHOOK,
  waCampagna: STATI_WA_CAMPAGNA,
  waMessaggio: STATI_WA_MESSAGGIO,
  waTemplate: STATI_WA_TEMPLATE,
  waNumero: STATI_WA_NUMERO,
};

export const descriviStato = (dominio: DominioStato, stato: string | null | undefined): DescrizioneStato =>
  stato && Object.prototype.hasOwnProperty.call(CATALOGO_STATI[dominio], stato)
    ? CATALOGO_STATI[dominio][stato]
    : STATO_SCONOSCIUTO;
