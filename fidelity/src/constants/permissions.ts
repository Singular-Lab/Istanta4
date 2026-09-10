/**
 * Costanti permessi frontend — sincronizzate con server/core/scripts/seedPermessi.ts
 *
 * Usare queste costanti al posto di stringhe letterali per evitare errori di battitura
 * e abilitare l'autocomplete IDE.
 */
export const PERMISSIONS = {

  // ── PAGINA ────────────────────────────────────────────────────────
  PAGINA: {
    DASHBOARD: 'pagina.dashboard',
    DASHBOARD_GDO: 'pagina.dashboard_gdo',
    DASHBOARD_MARKETING: 'pagina.dashboard_marketing',
    DASHBOARD_IT: 'pagina.dashboard_it',
    PROFILO_UTENTE: 'pagina.profilo_utente',
    BARCODE_READER: 'pagina.barcode_reader',
    COMPETITOR_ANALYZER: 'pagina.competitor_analyzer',
    PROMOZIONI_NUOVA: 'pagina.promozioni.nuova',
    PROMOZIONI_IN_CORSO: 'pagina.promozioni.incorso',
    PROMOZIONI_STORICO: 'pagina.promozioni.storico',
    // NUOVA_LAVORAZIONE: 'pagina.nuova_lavorazione',
    // LAVORAZIONI_IN_CORSO: 'pagina.lavorazioni_in_corso',
    // STORICO_LAVORAZIONI: 'pagina.storico_lavorazioni',
    // VOLANTINI: 'pagina.volantini',
    STORICO_VOLANTINI: 'pagina.storico_volantini',
    MATERIALI_ATTIVI: 'pagina.materiali_attivi',
    MATERIALI_IN_CORSO: 'pagina.materiali_in_corso',
    STORICO_MATERIALI: 'pagina.storico_materiali',
    NUOVO_ODS: 'pagina.nuovo_ods',
    ODS_IN_CORSO: 'pagina.ods_in_corso',
    ODS_COMPLETATI: 'pagina.ods_completati',
    IMPOSTAZIONI_WEBPLIANT: 'pagina.impostazioni_webpliant',
    WEBPLIANT_DISPONIBILI: 'pagina.webpliant_disponibili',
    AREE_E_CANALI: 'pagina.aree_e_canali',
    PUNTI_VENDITA: 'pagina.punti_vendita',
    GESTIONE_RICETTE: 'pagina.gestione_ricette',
    GESTIONE_VINI: 'pagina.gestione_vini',
    IMPOSTAZIONI_TIPOGRAFIA: 'pagina.impostazioni_tipografia',
    IMPOSTAZIONI_PRODUZIONE: 'pagina.impostazioni_produzione',
    GESTIONE_PAGINE_SINGULAR: 'pagina.gestione_pagine_singular',
    GESTIONE_PERMESSI: 'pagina.gestione_permessi',
    GESTIONE_HUB: 'pagina.gestione_hub',
    GESTIONE_UTENTI: 'pagina.gestione_utenti',
    INVIO_CAMPAGNA_WHATSAPP: 'pagina.invio_campagna_whatsapp',
    CAMPAGNE_WHATSAPP: 'pagina.campagne_whatsapp',
    BUSINESS_CHAT: 'pagina.business_chat',
    GESTIONE_WHATSAPP_ADMIN: 'pagina.gestione_whatsapp_admin',
    GESTIONE_WHATSAPP_SUPERADMIN: 'pagina.gestione_whatsapp_superadmin',
    GESTIONE_API: 'pagina.gestione_api',
    GESTIONE_WEBHOOK: 'pagina.gestione_webhook',
    DOCUMENTAZIONE: 'pagina.documentazione',
  },

  // ── AZIONI — PROMOZIONI ───────────────────────────────────────────
  PROMO: {
    CREA: "promo.crea",
    MODIFICA: 'promo.modifica',
    ELIMINA: 'promo.elimina',
    VISUALIZZA: 'promo.visualizza',
  },

  // ── AZIONI — KIT RUNTIME ─────────────────────────────────────────
  KIT_RUNTIME: {
    CREA: 'kit_runtime.crea',
    ELIMINA: 'kit_runtime.elimina',
    ELIMINA_FILE: 'kit_runtime.elimina_file',
    REVISIONE: 'kit_runtime.revisione',
    RIPORTA_IN_LAVORAZIONE: 'kit_runtime.riporta_in_lavorazione',
    PUBBLICA: 'kit_runtime.pubblica',
    CAMBIA_STATO: 'kit_runtime.cambia_stato',
    VISUALIZZA: 'kit_runtime.visualizza',
  },

  // ── AZIONI — DESIGN KIT ──────────────────────────────────────────
  DESIGN_KIT: {
    CREA: 'design_kit.crea',
    MODIFICA: 'design_kit.modifica',
    VISUALIZZA: 'design_kit.visualizza',
  },

  // ── AZIONI — RACCOGLITORE KIT ────────────────────────────────────
  RACCOGLITORE_KIT: {
    CREA: 'raccoglitore_kit.crea',
    MODIFICA: 'raccoglitore_kit.modifica',
    ELIMINA: 'raccoglitore_kit.elimina',
    GESTISCI_FILTRI: 'raccoglitore_kit.gestisci_filtri',
    GESTISCI_DECLINAZIONI: 'raccoglitore_kit.gestisci_declinazioni',
    VISUALIZZA: 'raccoglitore_kit.visualizza',
  },

  // ── AZIONI — FILE ────────────────────────────────────────────────
  FILE: {
    UPLOAD_MATERIALE: 'file.upload_materiale',
    UPLOAD_TRACCIATO: 'file.upload_tracciato',
    UPLOAD_KIT_MANUALI: 'file.upload_kit_manuali',
    SOSTITUISCI: 'file.sostituisci',
    UPLOAD_OLYMPUS: 'file.upload_olympus',
    DOWNLOAD: 'file.download',
    MERGE: 'file.merge',
    AGGIORNA_IMMAGINE_REFERENZA: 'file.aggiorna_immagine_referenza',
  },

  // ── AZIONI — ORDINI DI STAMPA ────────────────────────────────────
  ORDINI_STAMPA: {
    CREA: 'ordini_stampa.crea',
    AVVIA_FTP: 'ordini_stampa.avvia_ftp',
    VISUALIZZA: 'ordini_stampa.visualizza',
    RAGGRUPPA_FILE: 'ordini_stampa.raggruppa_file',
    DOWNLOAD_REPORT: 'ordini_stampa.download_report',
  },

  // ── AZIONI — WEBPLIANT ───────────────────────────────────────────
  WEBPLIANT: {
    CREA_WORKSPACE: 'webpliant.crea_workspace',
    ELIMINA_WORKSPACE: 'webpliant.elimina_workspace',
    CONFIGURA: 'webpliant.configura',
    VISUALIZZA: 'webpliant.visualizza',
  },

  // ── AZIONI — REFERENZE ───────────────────────────────────────────
  REFERENZE: {
    IMPORTA: 'referenze.importa',
    MODIFICA: 'referenze.modifica',
    CREA_CONTENUTI_AGGIUNTIVI: 'referenze.crea_contenuti_aggiuntivi',
    VISUALIZZA: 'referenze.visualizza',
  },

  // ── AZIONI — UTENTI ──────────────────────────────────────────────
  UTENTI: {
    CREA: 'utenti.crea',
    MODIFICA: 'utenti.modifica',
    ELIMINA: 'utenti.elimina',
    VISUALIZZA: 'utenti.visualizza',
    ESPORTA: 'utenti.esporta',
  },

  // ── AZIONI — IMPOSTAZIONI ────────────────────────────────────────
  IMPOSTAZIONI: {
    MODIFICA_GENERALI: 'impostazioni.modifica_generali',
    GESTISCI_FORMATI: 'impostazioni.gestisci_formati',
    GESTISCI_TIPO_EXPORT: 'impostazioni.gestisci_tipo_export',
    GESTISCI_NAMING_CONVENTION: 'impostazioni.gestisci_naming_convention',
    GESTISCI_CONTRATTI_TIPOGRAFIA: 'impostazioni.gestisci_contratti_tipografia',
    GESTISCI_PAGINE_SINGULAR: 'impostazioni.gestisci_pagine_singular',
  },

  // ── AZIONI — WHATSAPP ────────────────────────────────────────────
  WHATSAPP: {
    INVIA_CAMPAGNA: 'whatsapp.invia_campagna',
    ANNULLA_CAMPAGNA: 'whatsapp.annulla_campagna',
    VISUALIZZA_CAMPAGNE: 'whatsapp.visualizza_campagne',
    GESTISCI_TEMPLATES: 'whatsapp.gestisci_templates',
    GESTISCI_PRESETS: 'whatsapp.gestisci_presets',
    REGISTRA_UTENTE: 'whatsapp.registra_utente',
    BUSINESS_CHAT: 'whatsapp.business_chat',
  },

  // ── AZIONI — API & WEBHOOK ───────────────────────────────────────
  API: {
    VISUALIZZA_STATISTICHE: 'api.visualizza_statistiche',
    TEST: 'api.test',
    GESTISCI_CHIAVI: 'api.gestisci_chiavi',
    GESTISCI_PLUGIN: 'api.gestisci_plugin',
  },

  WEBHOOK: {
    GESTISCI: 'webhook.gestisci',
    VISUALIZZA: 'webhook.visualizza',
  },

  // ── AZIONI — GDO ─────────────────────────────────────────────────
  GDO: {
    UPLOAD_ICONA: 'gdo.upload_icona',
    GESTISCI_PUNTI_VENDITA: 'gdo.gestisci_punti_vendita',
    GESTISCI_AREE_CANALI: 'gdo.gestisci_aree_canali',
  },

  // ── AZIONI — PERMESSI ────────────────────────────────────────────
  PERMESSI: {
    GESTISCI: 'permessi.gestisci',
  },

  // ── AZIONI — AI ──────────────────────────────────────────────────
  AI: {
    GESTISCI_RICETTE: 'ai.gestisci_ricette',
    GESTISCI_VINI: 'ai.gestisci_vini',
  },
} as const;

/** Tipo utility per estrarre tutti i codici permesso come union type */
type NestedValues<T> = T extends object ? { [K in keyof T]: NestedValues<T[K]> }[keyof T] : T;
export type PermissionCode = NestedValues<typeof PERMISSIONS>;
