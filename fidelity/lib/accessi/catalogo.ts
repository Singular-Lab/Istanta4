/**
 * Catalogo unico dei permessi di Fidelity, condiviso da server e client.
 *
 * Ogni area ha (di norma) un permesso di accesso `<area>.visualizza` che governa le
 * sue pagine, e un elenco di azioni. Un'azione vale solo se il ruolo ha anche
 * l'accesso alla sua area. I permessi dell'area "sistema" appartengono solo al
 * Superadmin e non sono assegnabili ad altri ruoli.
 *
 * Questo file sostituisce il vecchio seed dei permessi e le costanti del client:
 * aggiungere qui un permesso lo rende disponibile ai guard, alla gestione accessi
 * e al catalogo nel database (sincronizzato all'avvio).
 *
 * Nota: il client compila con lib ES6, quindi qui niente Object.values/includes.
 */

export const PERMESSI = {
  PROMO: {
    VISUALIZZA: 'promo.visualizza',
    CREA: 'promo.crea',
    MODIFICA: 'promo.modifica',
    ELIMINA: 'promo.elimina',
  },
  KIT_RUNTIME: {
    VISUALIZZA: 'kit_runtime.visualizza',
    CREA: 'kit_runtime.crea',
    ELIMINA: 'kit_runtime.elimina',
    ELIMINA_FILE: 'kit_runtime.elimina_file',
    REVISIONE: 'kit_runtime.revisione',
    RIPORTA_IN_LAVORAZIONE: 'kit_runtime.riporta_in_lavorazione',
    PUBBLICA: 'kit_runtime.pubblica',
    CAMBIA_STATO: 'kit_runtime.cambia_stato',
  },
  DESIGN_KIT: {
    VISUALIZZA: 'design_kit.visualizza',
    CREA: 'design_kit.crea',
    MODIFICA: 'design_kit.modifica',
  },
  RACCOGLITORE_KIT: {
    VISUALIZZA: 'raccoglitore_kit.visualizza',
    CREA: 'raccoglitore_kit.crea',
    MODIFICA: 'raccoglitore_kit.modifica',
    ELIMINA: 'raccoglitore_kit.elimina',
    GESTISCI_FILTRI: 'raccoglitore_kit.gestisci_filtri',
    GESTISCI_DECLINAZIONI: 'raccoglitore_kit.gestisci_declinazioni',
  },
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
  MATERIALI: {
    VISUALIZZA: 'materiali.visualizza',
  },
  VOLANTINI: {
    VISUALIZZA: 'volantini.visualizza',
  },
  ORDINI_STAMPA: {
    VISUALIZZA: 'ordini_stampa.visualizza',
    CREA: 'ordini_stampa.crea',
    AVVIA_FTP: 'ordini_stampa.avvia_ftp',
    RAGGRUPPA_FILE: 'ordini_stampa.raggruppa_file',
    DOWNLOAD_REPORT: 'ordini_stampa.download_report',
  },
  WEBPLIANT: {
    VISUALIZZA: 'webpliant.visualizza',
    CREA_WORKSPACE: 'webpliant.crea_workspace',
    ELIMINA_WORKSPACE: 'webpliant.elimina_workspace',
    CONFIGURA: 'webpliant.configura',
  },
  REFERENZE: {
    VISUALIZZA: 'referenze.visualizza',
    IMPORTA: 'referenze.importa',
    MODIFICA: 'referenze.modifica',
    CREA_CONTENUTI_AGGIUNTIVI: 'referenze.crea_contenuti_aggiuntivi',
  },
  GDO: {
    VISUALIZZA: 'gdo.visualizza',
    UPLOAD_ICONA: 'gdo.upload_icona',
    GESTISCI_PUNTI_VENDITA: 'gdo.gestisci_punti_vendita',
    GESTISCI_AREE_CANALI: 'gdo.gestisci_aree_canali',
  },
  UTENTI: {
    VISUALIZZA: 'utenti.visualizza',
    CREA: 'utenti.crea',
    MODIFICA: 'utenti.modifica',
    ELIMINA: 'utenti.elimina',
    ESPORTA: 'utenti.esporta',
  },
  IMPOSTAZIONI: {
    VISUALIZZA: 'impostazioni.visualizza',
    MODIFICA_GENERALI: 'impostazioni.modifica_generali',
    GESTISCI_FORMATI: 'impostazioni.gestisci_formati',
    GESTISCI_TIPO_EXPORT: 'impostazioni.gestisci_tipo_export',
    GESTISCI_NAMING_CONVENTION: 'impostazioni.gestisci_naming_convention',
    GESTISCI_CONTRATTI_TIPOGRAFIA: 'impostazioni.gestisci_contratti_tipografia',
    GESTISCI_PAGINE_SINGULAR: 'impostazioni.gestisci_pagine_singular',
  },
  WHATSAPP: {
    VISUALIZZA_CAMPAGNE: 'whatsapp.visualizza_campagne',
    INVIA_CAMPAGNA: 'whatsapp.invia_campagna',
    ANNULLA_CAMPAGNA: 'whatsapp.annulla_campagna',
    GESTISCI_TEMPLATES: 'whatsapp.gestisci_templates',
    GESTISCI_PRESETS: 'whatsapp.gestisci_presets',
  },
  API: {
    VISUALIZZA_STATISTICHE: 'api.visualizza_statistiche',
    TEST: 'api.test',
    GESTISCI_CHIAVI: 'api.gestisci_chiavi',
    GESTISCI_PLUGIN: 'api.gestisci_plugin',
  },
  WEBHOOK: {
    VISUALIZZA: 'webhook.visualizza',
    GESTISCI: 'webhook.gestisci',
  },
  AI: {
    GESTISCI_RICETTE: 'ai.gestisci_ricette',
    GESTISCI_VINI: 'ai.gestisci_vini',
  },
  STRUMENTI: {
    VISUALIZZA: 'strumenti.visualizza',
  },
  SISTEMA: {
    GESTISCI_ACCESSI: 'sistema.gestisci_accessi',
    GESTISCI_HUB: 'sistema.gestisci_hub',
    GESTISCI_METODI_ACCESSO: 'sistema.gestisci_metodi_accesso',
    GESTISCI_WHATSAPP: 'sistema.gestisci_whatsapp',
    DASHBOARD: 'sistema.dashboard',
    LOG: 'sistema.log',
    AUDIT: 'sistema.audit',
    MANUTENZIONE: 'sistema.manutenzione',
    CONFIGURAZIONE: 'sistema.configurazione',
  },
} as const;

type ValoriDi<T> = T[keyof T];
type GruppiPermessi = typeof PERMESSI;

/** Qualunque codice del catalogo: un refuso in un guard diventa un errore di compilazione. */
export type CodicePermesso = ValoriDi<{ [K in keyof GruppiPermessi]: ValoriDi<GruppiPermessi[K]> }>;

export type DefinizioneAzione = {
  codice: CodicePermesso;
  nome: string;
  descrizione: string;
  /** Azioni distruttive o difficili da annullare: evidenziate nella gestione accessi. */
  pericolosa?: boolean;
};

export type DefinizioneArea = {
  id: string;
  nome: string;
  descrizione: string;
  /** Nome di un'icona Lucide. */
  icona: string;
  /** Permesso che dà accesso alle pagine dell'area; le azioni lo richiedono. Assente per aree di sole azioni. */
  accesso?: DefinizioneAzione;
  azioni: DefinizioneAzione[];
  /** Area riservata al Superadmin: i suoi permessi non sono assegnabili. */
  sistema?: boolean;
};

const P = PERMESSI;

export const AREE: DefinizioneArea[] = [
  {
    id: 'promo',
    nome: 'Promozioni',
    descrizione: 'Lavorazioni in corso e storico, menabò, tracciati e report di confronto.',
    icona: 'Megaphone',
    accesso: { codice: P.PROMO.VISUALIZZA, nome: 'Consultare le promozioni', descrizione: 'Aprire le promozioni in corso e lo storico con i loro dettagli.' },
    azioni: [
      { codice: P.PROMO.CREA, nome: 'Creare promozioni', descrizione: 'Avviare una nuova lavorazione.' },
      { codice: P.PROMO.MODIFICA, nome: 'Modificare promozioni', descrizione: 'Cambiare dati, contesto e menabò di una promozione.' },
      { codice: P.PROMO.ELIMINA, nome: 'Eliminare promozioni', descrizione: 'Cancellare una promozione con i suoi dati.', pericolosa: true },
    ],
  },
  {
    id: 'kit_runtime',
    nome: 'Kit e pubblicazione',
    descrizione: 'Kit generati da Istanta: revisione, stati e pubblicazione.',
    icona: 'Boxes',
    accesso: { codice: P.KIT_RUNTIME.VISUALIZZA, nome: 'Consultare i kit', descrizione: 'Vedere i kit di una promozione e i loro file.' },
    azioni: [
      { codice: P.KIT_RUNTIME.CREA, nome: 'Creare kit', descrizione: 'Generare nuovi kit per una promozione.' },
      { codice: P.KIT_RUNTIME.REVISIONE, nome: 'Mandare in revisione', descrizione: 'Portare un kit in revisione.' },
      { codice: P.KIT_RUNTIME.RIPORTA_IN_LAVORAZIONE, nome: 'Riportare in lavorazione', descrizione: 'Rimandare un kit in lavorazione dalla revisione.' },
      { codice: P.KIT_RUNTIME.CAMBIA_STATO, nome: 'Cambiare stato', descrizione: 'Forzare lo stato di un kit.' },
      { codice: P.KIT_RUNTIME.PUBBLICA, nome: 'Pubblicare kit', descrizione: 'Rendere un kit visibile sui canali di pubblicazione.' },
      { codice: P.KIT_RUNTIME.ELIMINA_FILE, nome: 'Eliminare file di un kit', descrizione: 'Togliere singoli file da un kit.', pericolosa: true },
      { codice: P.KIT_RUNTIME.ELIMINA, nome: 'Eliminare kit', descrizione: 'Cancellare un kit con i suoi file.', pericolosa: true },
    ],
  },
  {
    id: 'design_kit',
    nome: 'Design dei kit',
    descrizione: 'Modelli grafici usati per comporre i kit.',
    icona: 'PenTool',
    accesso: { codice: P.DESIGN_KIT.VISUALIZZA, nome: 'Consultare i design', descrizione: 'Vedere i design dei kit.' },
    azioni: [
      { codice: P.DESIGN_KIT.CREA, nome: 'Creare design', descrizione: 'Aggiungere un nuovo design di kit.' },
      { codice: P.DESIGN_KIT.MODIFICA, nome: 'Modificare design', descrizione: 'Cambiare un design esistente.' },
    ],
  },
  {
    id: 'raccoglitore_kit',
    nome: 'Raccoglitori di kit',
    descrizione: 'Raggruppamenti di kit con filtri e declinazioni.',
    icona: 'FolderKanban',
    accesso: { codice: P.RACCOGLITORE_KIT.VISUALIZZA, nome: 'Consultare i raccoglitori', descrizione: 'Vedere i raccoglitori di kit.' },
    azioni: [
      { codice: P.RACCOGLITORE_KIT.CREA, nome: 'Creare raccoglitori', descrizione: 'Aggiungere un raccoglitore.' },
      { codice: P.RACCOGLITORE_KIT.MODIFICA, nome: 'Modificare raccoglitori', descrizione: 'Cambiare un raccoglitore.' },
      { codice: P.RACCOGLITORE_KIT.GESTISCI_FILTRI, nome: 'Gestire i filtri', descrizione: 'Definire i filtri di un raccoglitore.' },
      { codice: P.RACCOGLITORE_KIT.GESTISCI_DECLINAZIONI, nome: 'Gestire le declinazioni', descrizione: 'Definire le declinazioni di un raccoglitore.' },
      { codice: P.RACCOGLITORE_KIT.ELIMINA, nome: 'Eliminare raccoglitori', descrizione: 'Cancellare un raccoglitore.', pericolosa: true },
    ],
  },
  {
    id: 'file',
    nome: 'File e caricamenti',
    descrizione: 'Caricamento, sostituzione e scaricamento dei file nelle diverse aree.',
    icona: 'FileUp',
    azioni: [
      { codice: P.FILE.DOWNLOAD, nome: 'Scaricare file', descrizione: 'Scaricare materiali, tracciati e file dei kit.' },
      { codice: P.FILE.UPLOAD_TRACCIATO, nome: 'Caricare tracciati', descrizione: 'Caricare e cancellare i tracciati di una promozione.' },
      { codice: P.FILE.UPLOAD_MATERIALE, nome: 'Caricare materiali', descrizione: 'Caricare materiali nei kit.' },
      { codice: P.FILE.UPLOAD_KIT_MANUALI, nome: 'Caricare kit manuali', descrizione: 'Caricare kit preparati a mano.' },
      { codice: P.FILE.UPLOAD_OLYMPUS, nome: 'Caricare su Olimpo', descrizione: 'Inviare file all\'archivio Olimpo.' },
      { codice: P.FILE.SOSTITUISCI, nome: 'Sostituire file', descrizione: 'Sostituire un file già caricato.' },
      { codice: P.FILE.MERGE, nome: 'Unire file', descrizione: 'Unire più file in uno.' },
      { codice: P.FILE.AGGIORNA_IMMAGINE_REFERENZA, nome: 'Aggiornare immagini delle referenze', descrizione: 'Cambiare l\'immagine di una referenza.' },
    ],
  },
  {
    id: 'materiali',
    nome: 'Materiali',
    descrizione: 'Materiali attivi, in corso, storico e contenuti digitali.',
    icona: 'Images',
    accesso: { codice: P.MATERIALI.VISUALIZZA, nome: 'Consultare i materiali', descrizione: 'Aprire le pagine dei materiali e dei contenuti digitali.' },
    azioni: [],
  },
  {
    id: 'volantini',
    nome: 'Volantini',
    descrizione: 'Volantini pubblicati.',
    icona: 'Newspaper',
    accesso: { codice: P.VOLANTINI.VISUALIZZA, nome: 'Consultare i volantini', descrizione: 'Aprire l\'elenco dei volantini.' },
    azioni: [],
  },
  {
    id: 'ordini_stampa',
    nome: 'Ordini di stampa',
    descrizione: 'Ordini verso le tipografie, revisione e invio.',
    icona: 'Printer',
    accesso: { codice: P.ORDINI_STAMPA.VISUALIZZA, nome: 'Consultare gli ordini', descrizione: 'Vedere gli ordini di stampa in corso e completati.' },
    azioni: [
      { codice: P.ORDINI_STAMPA.CREA, nome: 'Creare ordini', descrizione: 'Preparare un nuovo ordine di stampa.' },
      { codice: P.ORDINI_STAMPA.RAGGRUPPA_FILE, nome: 'Raggruppare i file', descrizione: 'Comporre i file da inviare alla tipografia.' },
      { codice: P.ORDINI_STAMPA.DOWNLOAD_REPORT, nome: 'Scaricare i report', descrizione: 'Scaricare il report di un ordine.' },
      { codice: P.ORDINI_STAMPA.AVVIA_FTP, nome: 'Inviare alla tipografia', descrizione: 'Avviare l\'invio FTP dell\'ordine.', pericolosa: true },
    ],
  },
  {
    id: 'webpliant',
    nome: 'WebPliant',
    descrizione: 'Workspace di consultazione dei volantini digitali.',
    icona: 'MonitorSmartphone',
    accesso: { codice: P.WEBPLIANT.VISUALIZZA, nome: 'Consultare i WebPliant', descrizione: 'Vedere i WebPliant disponibili.' },
    azioni: [
      { codice: P.WEBPLIANT.CONFIGURA, nome: 'Configurare WebPliant', descrizione: 'Aprire e cambiare le impostazioni dei workspace.' },
      { codice: P.WEBPLIANT.CREA_WORKSPACE, nome: 'Creare workspace', descrizione: 'Aggiungere un workspace.' },
      { codice: P.WEBPLIANT.ELIMINA_WORKSPACE, nome: 'Eliminare workspace', descrizione: 'Cancellare un workspace.', pericolosa: true },
    ],
  },
  {
    id: 'referenze',
    nome: 'Referenze',
    descrizione: 'Articoli importati e contenuti aggiuntivi.',
    icona: 'Tags',
    accesso: { codice: P.REFERENZE.VISUALIZZA, nome: 'Consultare le referenze', descrizione: 'Cercare e vedere le referenze.' },
    azioni: [
      { codice: P.REFERENZE.IMPORTA, nome: 'Importare referenze', descrizione: 'Importare referenze da file.' },
      { codice: P.REFERENZE.MODIFICA, nome: 'Modificare referenze', descrizione: 'Cambiare i dati di una referenza.' },
      { codice: P.REFERENZE.CREA_CONTENUTI_AGGIUNTIVI, nome: 'Creare contenuti aggiuntivi', descrizione: 'Aggiungere contenuti a una referenza.' },
    ],
  },
  {
    id: 'gdo',
    nome: 'GDO e punti vendita',
    descrizione: 'Punti vendita, aree, canali e identità della GDO.',
    icona: 'Store',
    accesso: { codice: P.GDO.VISUALIZZA, nome: 'Consultare punti vendita e aree', descrizione: 'Aprire le pagine dei punti vendita, delle aree e dei canali.' },
    azioni: [
      { codice: P.GDO.GESTISCI_PUNTI_VENDITA, nome: 'Gestire i punti vendita', descrizione: 'Creare, modificare e cancellare punti vendita.' },
      { codice: P.GDO.GESTISCI_AREE_CANALI, nome: 'Gestire aree e canali', descrizione: 'Creare, modificare e cancellare aree e canali.' },
      { codice: P.GDO.UPLOAD_ICONA, nome: 'Caricare l\'icona della GDO', descrizione: 'Cambiare il logo della GDO.' },
    ],
  },
  {
    id: 'utenti',
    nome: 'Utenti',
    descrizione: 'Anagrafica degli utenti della GDO.',
    icona: 'Users',
    accesso: { codice: P.UTENTI.VISUALIZZA, nome: 'Consultare gli utenti', descrizione: 'Aprire l\'elenco degli utenti.' },
    azioni: [
      { codice: P.UTENTI.CREA, nome: 'Creare utenti', descrizione: 'Aggiungere un utente.' },
      { codice: P.UTENTI.MODIFICA, nome: 'Modificare utenti', descrizione: 'Cambiare dati e ruolo di un utente.' },
      { codice: P.UTENTI.ESPORTA, nome: 'Esportare utenti', descrizione: 'Scaricare l\'elenco degli utenti.' },
      { codice: P.UTENTI.ELIMINA, nome: 'Eliminare utenti', descrizione: 'Cancellare un utente.', pericolosa: true },
    ],
  },
  {
    id: 'impostazioni',
    nome: 'Impostazioni di produzione',
    descrizione: 'Tipografia, formati, export, naming e pagine Singular.',
    icona: 'SlidersHorizontal',
    accesso: { codice: P.IMPOSTAZIONI.VISUALIZZA, nome: 'Consultare le impostazioni', descrizione: 'Aprire le impostazioni di produzione e di tipografia.' },
    azioni: [
      { codice: P.IMPOSTAZIONI.MODIFICA_GENERALI, nome: 'Modificare le impostazioni generali', descrizione: 'Cambiare le impostazioni generali di produzione.' },
      { codice: P.IMPOSTAZIONI.GESTISCI_FORMATI, nome: 'Gestire i formati', descrizione: 'Creare e modificare i formati.' },
      { codice: P.IMPOSTAZIONI.GESTISCI_TIPO_EXPORT, nome: 'Gestire i tipi di export', descrizione: 'Creare e modificare i tipi di export.' },
      { codice: P.IMPOSTAZIONI.GESTISCI_NAMING_CONVENTION, nome: 'Gestire la naming convention', descrizione: 'Definire i nomi dei file prodotti.' },
      { codice: P.IMPOSTAZIONI.GESTISCI_CONTRATTI_TIPOGRAFIA, nome: 'Gestire i contratti di tipografia', descrizione: 'Configurare le tipografie e i loro contratti.' },
      { codice: P.IMPOSTAZIONI.GESTISCI_PAGINE_SINGULAR, nome: 'Gestire le pagine Singular', descrizione: 'Configurare le pagine Singular.' },
    ],
  },
  {
    id: 'whatsapp',
    nome: 'WhatsApp',
    descrizione: 'Campagne WhatsApp della GDO.',
    icona: 'MessageCircle',
    accesso: { codice: P.WHATSAPP.VISUALIZZA_CAMPAGNE, nome: 'Consultare le campagne', descrizione: 'Vedere le campagne WhatsApp e il loro stato.' },
    azioni: [
      { codice: P.WHATSAPP.INVIA_CAMPAGNA, nome: 'Inviare campagne', descrizione: 'Preparare e avviare una campagna.' },
      { codice: P.WHATSAPP.GESTISCI_PRESETS, nome: 'Gestire i preset', descrizione: 'Creare, modificare ed eliminare i preset dei messaggi.' },
      { codice: P.WHATSAPP.GESTISCI_TEMPLATES, nome: 'Gestire i template', descrizione: 'Creare template, sincronizzarli con Meta ed eliminarli, anche su Meta.' },
      { codice: P.WHATSAPP.ANNULLA_CAMPAGNA, nome: 'Annullare campagne', descrizione: 'Fermare una campagna in corso.', pericolosa: true },
    ],
  },
  {
    id: 'api',
    nome: 'API e integrazioni',
    descrizione: 'Chiavi API, plugin e statistiche di utilizzo.',
    icona: 'Plug',
    accesso: { codice: P.API.VISUALIZZA_STATISTICHE, nome: 'Consultare le statistiche API', descrizione: 'Vedere l\'utilizzo delle API.' },
    azioni: [
      { codice: P.API.TEST, nome: 'Provare le API', descrizione: 'Usare la console di prova.' },
      { codice: P.API.GESTISCI_PLUGIN, nome: 'Gestire i plugin', descrizione: 'Configurare i plugin e i loro dati.' },
      { codice: P.API.GESTISCI_CHIAVI, nome: 'Gestire le chiavi API', descrizione: 'Creare e revocare chiavi API.', pericolosa: true },
    ],
  },
  {
    id: 'webhook',
    nome: 'Webhook',
    descrizione: 'Notifiche verso sistemi esterni.',
    icona: 'Webhook',
    accesso: { codice: P.WEBHOOK.VISUALIZZA, nome: 'Consultare i webhook', descrizione: 'Vedere i webhook configurati.' },
    azioni: [
      { codice: P.WEBHOOK.GESTISCI, nome: 'Gestire i webhook', descrizione: 'Creare, modificare e cancellare webhook.' },
    ],
  },
  {
    id: 'ai',
    nome: 'Contenuti AI',
    descrizione: 'Ricette e approfondimenti sui vini generati con l\'AI.',
    icona: 'Sparkles',
    azioni: [
      { codice: P.AI.GESTISCI_RICETTE, nome: 'Gestire le ricette', descrizione: 'Aprire, generare e modificare le ricette.' },
      { codice: P.AI.GESTISCI_VINI, nome: 'Gestire gli approfondimenti vini', descrizione: 'Aprire, generare e modificare gli approfondimenti sui vini.' },
    ],
  },
  {
    id: 'strumenti',
    nome: 'Strumenti',
    descrizione: 'Lettore di codici a barre e analisi della concorrenza.',
    icona: 'ScanBarcode',
    accesso: { codice: P.STRUMENTI.VISUALIZZA, nome: 'Usare gli strumenti', descrizione: 'Aprire il lettore barcode e l\'analisi della concorrenza.' },
    azioni: [],
  },
  {
    id: 'sistema',
    nome: 'Sistema',
    descrizione: 'Amministrazione della piattaforma, riservata al Superadmin.',
    icona: 'ShieldCheck',
    sistema: true,
    azioni: [
      { codice: P.SISTEMA.GESTISCI_ACCESSI, nome: 'Gestire gli accessi', descrizione: 'Permessi dei ruoli, override delle GDO e menu.' },
      { codice: P.SISTEMA.GESTISCI_HUB, nome: 'Gestire l\'hub', descrizione: 'Servizi e news dell\'hub.' },
      { codice: P.SISTEMA.GESTISCI_METODI_ACCESSO, nome: 'Gestire i metodi di accesso', descrizione: 'Metodi di login (email e password, OIDC, SAML) e i loro segreti.' },
      { codice: P.SISTEMA.GESTISCI_WHATSAPP, nome: 'Gestire la piattaforma WhatsApp', descrizione: 'Configurazione WhatsApp di tutte le GDO.' },
      { codice: P.SISTEMA.DASHBOARD, nome: 'Dashboard di piattaforma', descrizione: 'Dashboard del Superadmin.' },
      { codice: P.SISTEMA.LOG, nome: 'Log dell\'applicazione', descrizione: 'Consultare i log.' },
      { codice: P.SISTEMA.AUDIT, nome: 'Registro di audit', descrizione: 'Consultare il registro degli accessi e delle modifiche.' },
      { codice: P.SISTEMA.MANUTENZIONE, nome: 'Avvisi di manutenzione', descrizione: 'Pubblicare e togliere l\'avviso di manutenzione.' },
      { codice: P.SISTEMA.CONFIGURAZIONE, nome: 'Configurazione dell\'installazione', descrizione: 'Configurazione della dashboard e dell\'installazione.' },
    ],
  },
];

/* =======================
   INDICI
   ======================= */

export type VocePermesso = DefinizioneAzione & {
  area: DefinizioneArea;
  /** True se è il permesso di accesso dell'area. */
  accesso: boolean;
  sistema: boolean;
};

const indice: { [codice: string]: VocePermesso } = {};
for (const area of AREE) {
  if (area.accesso) {
    indice[area.accesso.codice] = { ...area.accesso, area, accesso: true, sistema: !!area.sistema };
  }
  for (const azione of area.azioni) {
    indice[azione.codice] = { ...azione, area, accesso: false, sistema: !!area.sistema };
  }
}

/** Tutti i permessi del catalogo, nell'ordine delle aree (accesso prima delle azioni). */
export const TUTTI_I_PERMESSI: VocePermesso[] = AREE.reduce<VocePermesso[]>((acc, area) => {
  if (area.accesso) acc.push(indice[area.accesso.codice]);
  for (const azione of area.azioni) acc.push(indice[azione.codice]);
  return acc;
}, []);

export const voceDi = (codice: string): VocePermesso | undefined => indice[codice];

export const esistePermesso = (codice: string): codice is CodicePermesso => !!indice[codice];

export const ePermessoDiSistema = (codice: string): boolean => !!indice[codice]?.sistema;

/** Permesso di accesso richiesto da un codice: quello della sua area, se l'area ne ha uno e il codice non è già l'accesso. */
export const accessoRichiestoDa = (codice: string): CodicePermesso | null => {
  const voce = indice[codice];
  if (!voce || voce.accesso || !voce.area.accesso) return null;
  return voce.area.accesso.codice;
};

/**
 * Applica la regola "un'azione vale solo con l'accesso alla sua area" e scarta i
 * codici sconosciuti. Non aggiunge mai permessi: restituisce un sottoinsieme.
 */
export const applicaRegoleArea = (codici: ReadonlyArray<string> | ReadonlySet<string>): CodicePermesso[] => {
  const insieme: { [codice: string]: true } = {};
  const elenco: string[] = [];
  codici.forEach((c: string) => {
    if (insieme[c]) return;
    insieme[c] = true;
    elenco.push(c);
  });
  const risultato: CodicePermesso[] = [];
  for (const codice of elenco) {
    if (!esistePermesso(codice)) continue;
    const accesso = accessoRichiestoDa(codice);
    if (accesso && !insieme[accesso]) continue;
    risultato.push(codice);
  }
  return risultato;
};
