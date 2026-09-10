import { CATEGORIA_PERMESSO, TIPO_UTENTI } from '../../../lib/enums';
import type { PermessoAttributes } from '../../../lib/types';

const P = CATEGORIA_PERMESSO.PAGINA;
const A = CATEGORIA_PERMESSO.AZIONE;

/**
 * Catalogo completo dei permessi.
 *
 * Convenzione codice:
 *   - Pagine:  pagina.<nome_pagina>        (categoria PAGINA)
 *   - Azioni:  <risorsa>.<verbo>           (categoria AZIONE)
 *
 * La `risorsa` raggruppa i permessi nell'admin UI.
 * Le pagine sono raggruppate per macro-sezione (pagine_promozioni, pagine_materiali, …)
 * Le azioni sono raggruppate per entita (promozioni, kit_runtime, design_kit, …)
 */
export const PERMESSI_SEED: Omit<PermessoAttributes, 'id_permesso'>[] = [

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  PAGINE — GENERALI                                             ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'pagina.dashboard',           nome: 'Dashboard',              descrizione: 'Accesso alla dashboard principale',            categoria: P, risorsa: 'pagine_generali' },
  { codice: 'pagina.profilo_utente',      nome: 'Profilo Utente',        descrizione: 'Accesso alla pagina profilo personale',        categoria: P, risorsa: 'pagine_generali' },
  { codice: 'pagina.barcode_reader',      nome: 'Lettore Barcode',       descrizione: 'Accesso al lettore barcode',                   categoria: P, risorsa: 'pagine_generali' },
  { codice: 'pagina.competitor_analyzer', nome: 'Analisi Competitor',    descrizione: 'Accesso all\'analisi competitor',               categoria: P, risorsa: 'pagine_generali' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  PAGINE — PROMOZIONI                                           ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'pagina.promozioni',           nome: 'Hub Promozioni',       descrizione: 'Accesso alla sezione promozioni',                             categoria: P, risorsa: 'pagine_promozioni' },
  { codice: 'pagina.nuova_lavorazione',    nome: 'Nuova Lavorazione',    descrizione: 'Accesso alla creazione di nuove lavorazioni',                 categoria: P, risorsa: 'pagine_promozioni' },
  { codice: 'pagina.lavorazioni_in_corso', nome: 'Lavorazioni in Corso', descrizione: 'Accesso alle lavorazioni in corso, dettagli, kit e materiali', categoria: P, risorsa: 'pagine_promozioni' },
  { codice: 'pagina.storico_lavorazioni',  nome: 'Storico Lavorazioni',  descrizione: 'Accesso allo storico delle lavorazioni completate',           categoria: P, risorsa: 'pagine_promozioni' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  PAGINE — VOLANTINI                                            ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'pagina.volantini',           nome: 'Volantini PDF',        descrizione: 'Accesso ai volantini PDF e a tutti i file',     categoria: P, risorsa: 'pagine_volantini' },
  { codice: 'pagina.storico_volantini',   nome: 'Storico Volantini',    descrizione: 'Accesso allo storico dei volantini',            categoria: P, risorsa: 'pagine_volantini' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  PAGINE — MATERIALI                                            ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'pagina.materiali_attivi',    nome: 'Materiali Attivi',     descrizione: 'Accesso ai materiali documentali attivi',       categoria: P, risorsa: 'pagine_materiali' },
  { codice: 'pagina.materiali_in_corso',  nome: 'Materiali in Corso',   descrizione: 'Accesso ai materiali documentali in corso',    categoria: P, risorsa: 'pagine_materiali' },
  { codice: 'pagina.storico_materiali',   nome: 'Storico Materiali',    descrizione: 'Accesso allo storico dei materiali',           categoria: P, risorsa: 'pagine_materiali' },
  { codice: 'pagina.contenuti_digitali',  nome: 'Contenuti Digitali',   descrizione: 'Accesso alla sezione contenuti digitali',     categoria: P, risorsa: 'pagine_materiali' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  PAGINE — ORDINI DI STAMPA                                     ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'pagina.nuovo_ods',           nome: 'Nuovo Ordine Stampa',  descrizione: 'Accesso alla creazione ordini di stampa',      categoria: P, risorsa: 'pagine_ordini_stampa' },
  { codice: 'pagina.ods_in_corso',        nome: 'Ordini in Corso',      descrizione: 'Accesso agli ordini di stampa in corso e revisione', categoria: P, risorsa: 'pagine_ordini_stampa' },
  { codice: 'pagina.ods_completati',      nome: 'Ordini Completati',    descrizione: 'Accesso agli ordini di stampa completati',    categoria: P, risorsa: 'pagine_ordini_stampa' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  PAGINE — WEBPLIANT                                            ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'pagina.impostazioni_webpliant', nome: 'Impostazioni WebPliant', descrizione: 'Accesso a impostazioni, configurazione e workspace WebPliant', categoria: P, risorsa: 'pagine_webpliant' },
  { codice: 'pagina.webpliant_disponibili',  nome: 'WebPliant Disponibili',  descrizione: 'Accesso ai WebPliant pubblicati e disponibili',              categoria: P, risorsa: 'pagine_webpliant' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  PAGINE — SERVIZI                                              ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'pagina.aree_e_canali',       nome: 'Aree e Canali',        descrizione: 'Accesso alla gestione aree e canali',         categoria: P, risorsa: 'pagine_servizi' },
  { codice: 'pagina.punti_vendita',       nome: 'Punti Vendita',        descrizione: 'Accesso alla gestione punti vendita',         categoria: P, risorsa: 'pagine_servizi' },
  { codice: 'pagina.gestione_ricette',    nome: 'Gestione Ricette',     descrizione: 'Accesso alla gestione ricette AI',            categoria: P, risorsa: 'pagine_servizi' },
  { codice: 'pagina.gestione_vini',       nome: 'Approfondimento Vini', descrizione: 'Accesso all\'approfondimento vini AI',        categoria: P, risorsa: 'pagine_servizi' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  PAGINE — IMPOSTAZIONI                                         ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'pagina.impostazioni_tipografia',  nome: 'Impostazioni Tipografia',  descrizione: 'Accesso alle impostazioni della tipografia',                 categoria: P, risorsa: 'pagine_impostazioni' },
  { codice: 'pagina.impostazioni_produzione',  nome: 'Impostazioni Produzione',  descrizione: 'Accesso alle impostazioni di produzione (design kit, template)', categoria: P, risorsa: 'pagine_impostazioni' },
  { codice: 'pagina.gestione_pagine_singular', nome: 'Gestione Pagine Singular', descrizione: 'Accesso alla gestione pagine Singular',                     categoria: P, risorsa: 'pagine_impostazioni' },
  { codice: 'pagina.gestione_permessi',        nome: 'Gestione Permessi',        descrizione: 'Accesso alla gestione permessi per ruoli e GDO',            categoria: P, risorsa: 'pagine_impostazioni' },
  { codice: 'pagina.gestione_hub',             nome: 'Gestione Hub',             descrizione: 'Accesso alla gestione dei servizi e delle news dell’hub', categoria: P, risorsa: 'pagine_impostazioni' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  PAGINE — UTENTI                                               ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'pagina.gestione_utenti',     nome: 'Gestione Utenti',      descrizione: 'Accesso alla gestione utenti',                categoria: P, risorsa: 'pagine_utenti' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  PAGINE — WHATSAPP                                             ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'pagina.invio_campagna_whatsapp',       nome: 'Invio Campagna WhatsApp',       descrizione: 'Accesso alla creazione e invio campagne WhatsApp',      categoria: P, risorsa: 'pagine_whatsapp' },
  { codice: 'pagina.campagne_whatsapp',             nome: 'Campagne WhatsApp',             descrizione: 'Accesso alla lista e dettagli campagne WhatsApp',       categoria: P, risorsa: 'pagine_whatsapp' },
  { codice: 'pagina.business_chat',                 nome: 'Business Chat',                 descrizione: 'Accesso alla business chat WhatsApp',                   categoria: P, risorsa: 'pagine_whatsapp' },
  { codice: 'pagina.gestione_whatsapp_admin',       nome: 'Gestione WhatsApp Admin',       descrizione: 'Accesso alla gestione WhatsApp per admin GDO',          categoria: P, risorsa: 'pagine_whatsapp' },
  { codice: 'pagina.gestione_whatsapp_superadmin',  nome: 'Gestione WhatsApp Superadmin',  descrizione: 'Accesso alla gestione WhatsApp completa (setup, template, preset)', categoria: P, risorsa: 'pagine_whatsapp' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  PAGINE — API & DOCUMENTAZIONE                                 ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'pagina.gestione_api',        nome: 'Gestione API',         descrizione: 'Accesso a statistiche, test, chiavi e plugin API', categoria: P, risorsa: 'pagine_api' },
  { codice: 'pagina.gestione_webhook',    nome: 'Gestione Webhook',     descrizione: 'Accesso alla gestione webhook',                    categoria: P, risorsa: 'pagine_api' },
  { codice: 'pagina.documentazione',      nome: 'Documentazione',       descrizione: 'Accesso all\'hub documentazione e sotto-pagine',   categoria: P, risorsa: 'pagine_api' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  AZIONI — PROMOZIONI                                           ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'promo.crea',                nome: 'Crea Promozione',       descrizione: 'Creare nuove promozioni/lavorazioni',          categoria: A, risorsa: 'promozioni' },
  { codice: 'promo.modifica',            nome: 'Modifica Promozione',   descrizione: 'Modificare promozioni esistenti',              categoria: A, risorsa: 'promozioni' },
  { codice: 'promo.elimina',             nome: 'Elimina Promozione',    descrizione: 'Eliminare o ripristinare promozioni',          categoria: A, risorsa: 'promozioni' },
  { codice: 'promo.visualizza',          nome: 'Visualizza Promozione', descrizione: 'Visualizzare i dettagli delle promozioni',     categoria: A, risorsa: 'promozioni' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  AZIONI — KIT RUNTIME                                          ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'kit_runtime.crea',                  nome: 'Crea Kit Runtime',                descrizione: 'Creare nuovi kit runtime (automatici o manuali)',              categoria: A, risorsa: 'kit_runtime' },
  { codice: 'kit_runtime.elimina',               nome: 'Elimina Kit Runtime',             descrizione: 'Eliminare kit runtime o metterli in stato di eliminazione',   categoria: A, risorsa: 'kit_runtime' },
  { codice: 'kit_runtime.elimina_file',          nome: 'Elimina File Kit Runtime',        descrizione: 'Eliminare singoli file o svuotare tutti i file di un kit',    categoria: A, risorsa: 'kit_runtime' },
  { codice: 'kit_runtime.revisione',             nome: 'Avvia Revisione Kit',             descrizione: 'Avviare la revisione manuale o automatica di un kit runtime', categoria: A, risorsa: 'kit_runtime' },
  { codice: 'kit_runtime.riporta_in_lavorazione', nome: 'Riporta in Lavorazione',         descrizione: 'Riportare un kit dalla revisione alla lavorazione',           categoria: A, risorsa: 'kit_runtime' },
  { codice: 'kit_runtime.pubblica',              nome: 'Pubblica Kit Runtime',            descrizione: 'Pubblicare un kit runtime verso Olympus',                     categoria: A, risorsa: 'kit_runtime' },
  { codice: 'kit_runtime.cambia_stato',          nome: 'Cambia Stato Combinazione',       descrizione: 'Cambiare lo stato di una combinazione nel kit runtime',       categoria: A, risorsa: 'kit_runtime' },
  { codice: 'kit_runtime.visualizza',            nome: 'Visualizza Kit Runtime',          descrizione: 'Visualizzare la lista e i dettagli dei kit runtime',          categoria: A, risorsa: 'kit_runtime' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  AZIONI — DESIGN KIT                                           ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'design_kit.crea',           nome: 'Crea Combinazioni Design',   descrizione: 'Creare nuove combinazioni design (automatiche o manuali)', categoria: A, risorsa: 'design_kit' },
  { codice: 'design_kit.modifica',       nome: 'Modifica Combinazione',      descrizione: 'Modificare combinazioni design esistenti',                 categoria: A, risorsa: 'design_kit' },
  { codice: 'design_kit.visualizza',     nome: 'Visualizza Design Kit',      descrizione: 'Visualizzare la lista e i dettagli dei design kit',        categoria: A, risorsa: 'design_kit' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  AZIONI — RACCOGLITORE KIT                                     ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'raccoglitore_kit.crea',                nome: 'Crea Raccoglitore Kit',       descrizione: 'Creare nuovi template di combinazione (raccoglitori)',         categoria: A, risorsa: 'raccoglitore_kit' },
  { codice: 'raccoglitore_kit.modifica',            nome: 'Modifica Raccoglitore Kit',   descrizione: 'Modificare raccoglitori kit esistenti',                        categoria: A, risorsa: 'raccoglitore_kit' },
  { codice: 'raccoglitore_kit.elimina',             nome: 'Elimina Raccoglitore Kit',    descrizione: 'Eliminare raccoglitori kit',                                   categoria: A, risorsa: 'raccoglitore_kit' },
  { codice: 'raccoglitore_kit.gestisci_filtri',     nome: 'Gestisci Filtri',             descrizione: 'Creare e modificare filtri e filtri contesto per un raccoglitore', categoria: A, risorsa: 'raccoglitore_kit' },
  { codice: 'raccoglitore_kit.gestisci_declinazioni', nome: 'Gestisci Declinazioni',    descrizione: 'Creare e modificare declinazioni per un raccoglitore',         categoria: A, risorsa: 'raccoglitore_kit' },
  { codice: 'raccoglitore_kit.visualizza',          nome: 'Visualizza Raccoglitore',     descrizione: 'Visualizzare i dettagli di un raccoglitore kit',               categoria: A, risorsa: 'raccoglitore_kit' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  AZIONI — FILE                                                 ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'file.upload_materiale',             nome: 'Upload Materiale',           descrizione: 'Caricare materiale promozionale e documentale',           categoria: A, risorsa: 'file' },
  { codice: 'file.upload_tracciato',             nome: 'Upload Tracciato',           descrizione: 'Caricare file tracciato per la promozione',               categoria: A, risorsa: 'file' },
  { codice: 'file.upload_kit_manuali',           nome: 'Upload Kit Manuali',         descrizione: 'Caricare file per kit manuali',                           categoria: A, risorsa: 'file' },
  { codice: 'file.sostituisci',                  nome: 'Sostituisci File',           descrizione: 'Sostituire un file esistente nel kit runtime',             categoria: A, risorsa: 'file' },
  { codice: 'file.upload_olympus',               nome: 'Upload Immagini Olympus',   descrizione: 'Caricare forzatamente immagini su Olympus',                categoria: A, risorsa: 'file' },
  { codice: 'file.download',                     nome: 'Download File',              descrizione: 'Scaricare file singoli, ZIP o PDF volantini',             categoria: A, risorsa: 'file' },
  { codice: 'file.merge',                        nome: 'Unisci File',               descrizione: 'Unire piu file in uno solo',                               categoria: A, risorsa: 'file' },
  { codice: 'file.aggiorna_immagine_referenza',  nome: 'Aggiorna Immagine Referenza', descrizione: 'Aggiornare l\'immagine di una referenza o gruppo', categoria: A, risorsa: 'file' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  AZIONI — ORDINI DI STAMPA                                     ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'ordini_stampa.crea',             nome: 'Crea Ordine di Stampa',   descrizione: 'Creare un nuovo ordine di stampa',                          categoria: A, risorsa: 'ordini_stampa' },
  { codice: 'ordini_stampa.avvia_ftp',        nome: 'Avvia Processo FTP',      descrizione: 'Avviare il processo FTP verso Olympus',                     categoria: A, risorsa: 'ordini_stampa' },
  { codice: 'ordini_stampa.visualizza',       nome: 'Visualizza Ordini',       descrizione: 'Visualizzare ordini di stampa in corso e completati',       categoria: A, risorsa: 'ordini_stampa' },
  { codice: 'ordini_stampa.raggruppa_file',   nome: 'Raggruppa File',          descrizione: 'Raggruppare file per uguaglianza e gestire merge gruppi',  categoria: A, risorsa: 'ordini_stampa' },
  { codice: 'ordini_stampa.download_report',  nome: 'Download Report Excel',   descrizione: 'Scaricare report Excel degli ordini di stampa',            categoria: A, risorsa: 'ordini_stampa' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  AZIONI — WEBPLIANT                                            ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'webpliant.crea_workspace',       nome: 'Crea Workspace',          descrizione: 'Creare un nuovo workspace WebPliant',                      categoria: A, risorsa: 'webpliant' },
  { codice: 'webpliant.elimina_workspace',    nome: 'Elimina Workspace',       descrizione: 'Eliminare un workspace WebPliant',                         categoria: A, risorsa: 'webpliant' },
  { codice: 'webpliant.configura',            nome: 'Configura Workspace',     descrizione: 'Salvare e configurare un workspace WebPliant',             categoria: A, risorsa: 'webpliant' },
  { codice: 'webpliant.visualizza',           nome: 'Visualizza Workspace',    descrizione: 'Visualizzare la lista e i dettagli dei workspace',         categoria: A, risorsa: 'webpliant' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  AZIONI — REFERENZE                                            ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'referenze.importa',                 nome: 'Importa Referenze',           descrizione: 'Importare referenze da Istanta e ricercare referenze promo', categoria: A, risorsa: 'referenze' },
  { codice: 'referenze.modifica',                nome: 'Modifica Referenze',          descrizione: 'Modificare referenze e contenuti WebPliant',                categoria: A, risorsa: 'referenze' },
  { codice: 'referenze.crea_contenuti_aggiuntivi', nome: 'Crea Contenuti Aggiuntivi', descrizione: 'Creare contenuti aggiuntivi per referenza (ricette, vini)', categoria: A, risorsa: 'referenze' },
  { codice: 'referenze.visualizza',              nome: 'Visualizza Referenze',        descrizione: 'Visualizzare la lista e i dettagli delle referenze',        categoria: A, risorsa: 'referenze' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  AZIONI — UTENTI                                               ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'utenti.crea',               nome: 'Crea Utente',            descrizione: 'Registrare nuovi utenti',                         categoria: A, risorsa: 'utenti' },
  { codice: 'utenti.modifica',           nome: 'Modifica Utente',        descrizione: 'Modificare profili e impostazioni utenti',         categoria: A, risorsa: 'utenti' },
  { codice: 'utenti.elimina',            nome: 'Elimina Utente',         descrizione: 'Eliminare utenti dal sistema',                     categoria: A, risorsa: 'utenti' },
  { codice: 'utenti.visualizza',         nome: 'Visualizza Utenti',      descrizione: 'Visualizzare la lista utenti',                     categoria: A, risorsa: 'utenti' },
  { codice: 'utenti.esporta',            nome: 'Esporta Utenti',         descrizione: 'Esportare la lista utenti in CSV/Excel',           categoria: A, risorsa: 'utenti' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  AZIONI — IMPOSTAZIONI                                         ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'impostazioni.modifica_generali',         nome: 'Modifica Impostazioni',       descrizione: 'Modificare impostazioni generali e traduzioni campi',           categoria: A, risorsa: 'impostazioni' },
  { codice: 'impostazioni.gestisci_formati',          nome: 'Gestisci Formati',            descrizione: 'Creare e eliminare formati',                                    categoria: A, risorsa: 'impostazioni' },
  { codice: 'impostazioni.gestisci_tipo_export',      nome: 'Gestisci Tipi Export',        descrizione: 'Creare e eliminare tipi di export',                             categoria: A, risorsa: 'impostazioni' },
  { codice: 'impostazioni.gestisci_naming_convention', nome: 'Gestisci Naming Convention', descrizione: 'Creare e eliminare naming convention',                          categoria: A, risorsa: 'impostazioni' },
  { codice: 'impostazioni.gestisci_contratti_tipografia', nome: 'Gestisci Contratti Tipografia', descrizione: 'Creare e modificare contratti con la tipografia',        categoria: A, risorsa: 'impostazioni' },
  { codice: 'impostazioni.gestisci_pagine_singular',  nome: 'Gestisci Pagine Singular',    descrizione: 'Configurare le pagine Singular per una GDO',                   categoria: A, risorsa: 'impostazioni' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  AZIONI — WHATSAPP                                             ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'whatsapp.invia_campagna',      nome: 'Invia Campagna',           descrizione: 'Creare e avviare l\'invio di una campagna WhatsApp',          categoria: A, risorsa: 'whatsapp' },
  { codice: 'whatsapp.annulla_campagna',    nome: 'Annulla Campagna',         descrizione: 'Annullare una campagna WhatsApp in corso',                    categoria: A, risorsa: 'whatsapp' },
  { codice: 'whatsapp.visualizza_campagne', nome: 'Visualizza Campagne',      descrizione: 'Visualizzare la lista e i dettagli delle campagne',           categoria: A, risorsa: 'whatsapp' },
  { codice: 'whatsapp.gestisci_templates',  nome: 'Gestisci Templates',       descrizione: 'Creare, modificare e inviare template WhatsApp a Meta',       categoria: A, risorsa: 'whatsapp' },
  { codice: 'whatsapp.gestisci_presets',    nome: 'Gestisci Presets',         descrizione: 'Creare e modificare preset per template WhatsApp',             categoria: A, risorsa: 'whatsapp' },
  { codice: 'whatsapp.registra_utente',     nome: 'Registra Utente WhatsApp', descrizione: 'Registrare utenti per WhatsApp Business',                    categoria: A, risorsa: 'whatsapp' },
  { codice: 'whatsapp.business_chat',       nome: 'Business Chat',            descrizione: 'Inviare e ricevere messaggi nella business chat',             categoria: A, risorsa: 'whatsapp' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  AZIONI — API & WEBHOOK                                        ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'api.visualizza_statistiche',  nome: 'Visualizza Statistiche API', descrizione: 'Visualizzare le statistiche di utilizzo delle API',         categoria: A, risorsa: 'api' },
  { codice: 'api.test',                    nome: 'Test API',                   descrizione: 'Eseguire test delle API',                                   categoria: A, risorsa: 'api' },
  { codice: 'api.gestisci_chiavi',         nome: 'Gestisci Chiavi API',        descrizione: 'Creare e revocare chiavi API',                              categoria: A, risorsa: 'api' },
  { codice: 'api.gestisci_plugin',         nome: 'Gestisci Plugin',            descrizione: 'Configurare e gestire il plugin API',                       categoria: A, risorsa: 'api' },
  { codice: 'webhook.gestisci',            nome: 'Gestisci Webhook',           descrizione: 'Creare, modificare e eliminare webhook',                    categoria: A, risorsa: 'webhook' },
  { codice: 'webhook.visualizza',          nome: 'Visualizza Webhook',         descrizione: 'Visualizzare la lista e lo stato dei webhook',              categoria: A, risorsa: 'webhook' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  AZIONI — GDO                                                  ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'gdo.upload_icona',            nome: 'Upload Icona GDO',          descrizione: 'Caricare l\'icona di una GDO',                              categoria: A, risorsa: 'gdo' },
  { codice: 'gdo.gestisci_punti_vendita',  nome: 'Gestisci Punti Vendita',    descrizione: 'Configurare e gestire i punti vendita',                    categoria: A, risorsa: 'gdo' },
  { codice: 'gdo.gestisci_aree_canali',   nome: 'Gestisci Aree e Canali',    descrizione: 'Configurare aree geografiche e canali distributivi',       categoria: A, risorsa: 'gdo' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  AZIONI — PERMESSI                                             ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'permessi.gestisci',           nome: 'Gestisci Permessi',          descrizione: 'Modificare i permessi dei ruoli e gli override GDO',        categoria: A, risorsa: 'permessi' },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  AZIONI — AI                                                   ║
  // ╚══════════════════════════════════════════════════════════════════╝
  { codice: 'ai.gestisci_ricette',        nome: 'Gestisci Ricette',           descrizione: 'Creare e modificare ricette tramite AI',                    categoria: A, risorsa: 'ai' },
  { codice: 'ai.gestisci_vini',           nome: 'Gestisci Approfondimento Vini', descrizione: 'Creare e modificare approfondimenti vini tramite AI',   categoria: A, risorsa: 'ai' },
];

/**
 * Permessi abilitati di default per ogni ruolo.
 * Il Superadmin non e incluso perche ha bypass totale (hardcoded).
 *
 * Legenda:
 *   AGENZIA     = accesso operativo completo (tutto tranne superadmin-only)
 *   GDO         = visualizzazione + WhatsApp + gestione propri punti vendita
 *   PUNTOVENDITA = sola lettura promozioni e materiali
 *   GUEST       = minimo indispensabile
 */
export const PERMESSI_RUOLO_DEFAULTS: Record<string, string[]> = {

  [TIPO_UTENTI.AGENZIA]: [
    // Pagine
    'pagina.dashboard', 'pagina.profilo_utente', 'pagina.barcode_reader',
    'pagina.promozioni', 'pagina.nuova_lavorazione', 'pagina.lavorazioni_in_corso', 'pagina.storico_lavorazioni',
    'pagina.volantini', 'pagina.storico_volantini',
    'pagina.materiali_attivi', 'pagina.materiali_in_corso', 'pagina.storico_materiali', 'pagina.contenuti_digitali',
    'pagina.nuovo_ods', 'pagina.ods_in_corso', 'pagina.ods_completati',
    'pagina.impostazioni_webpliant', 'pagina.webpliant_disponibili',
    'pagina.aree_e_canali', 'pagina.punti_vendita', 'pagina.gestione_ricette', 'pagina.gestione_vini',
    'pagina.impostazioni_tipografia', 'pagina.impostazioni_produzione',
    'pagina.gestione_utenti',
    'pagina.gestione_api', 'pagina.documentazione',
    // Azioni — Promozioni
    'promo.crea', 'promo.modifica', 'promo.elimina', 'promo.visualizza',
    // Azioni — Kit Runtime
    'kit_runtime.crea', 'kit_runtime.elimina', 'kit_runtime.elimina_file',
    'kit_runtime.revisione', 'kit_runtime.riporta_in_lavorazione',
    'kit_runtime.pubblica', 'kit_runtime.cambia_stato', 'kit_runtime.visualizza',
    // Azioni — Design Kit
    'design_kit.crea', 'design_kit.modifica', 'design_kit.visualizza',
    // Azioni — Raccoglitore Kit
    'raccoglitore_kit.crea', 'raccoglitore_kit.modifica', 'raccoglitore_kit.elimina',
    'raccoglitore_kit.gestisci_filtri', 'raccoglitore_kit.gestisci_declinazioni', 'raccoglitore_kit.visualizza',
    // Azioni — File
    'file.upload_materiale', 'file.upload_tracciato', 'file.upload_kit_manuali',
    'file.sostituisci', 'file.upload_olympus', 'file.download', 'file.merge', 'file.aggiorna_immagine_referenza',
    // Azioni — Ordini di Stampa
    'ordini_stampa.crea', 'ordini_stampa.avvia_ftp', 'ordini_stampa.visualizza',
    'ordini_stampa.raggruppa_file', 'ordini_stampa.download_report',
    // Azioni — WebPliant
    'webpliant.crea_workspace', 'webpliant.elimina_workspace', 'webpliant.configura', 'webpliant.visualizza',
    // Azioni — Referenze
    'referenze.importa', 'referenze.modifica', 'referenze.crea_contenuti_aggiuntivi', 'referenze.visualizza',
    // Azioni — Utenti
    'utenti.crea', 'utenti.modifica', 'utenti.elimina', 'utenti.visualizza', 'utenti.esporta',
    // Azioni — Impostazioni
    'impostazioni.modifica_generali', 'impostazioni.gestisci_formati',
    'impostazioni.gestisci_tipo_export', 'impostazioni.gestisci_naming_convention',
    'impostazioni.gestisci_contratti_tipografia',
    // Azioni — GDO
    'gdo.upload_icona', 'gdo.gestisci_punti_vendita', 'gdo.gestisci_aree_canali',
    // Azioni — AI
    'ai.gestisci_ricette', 'ai.gestisci_vini',
    // Azioni — API
    'api.visualizza_statistiche', 'api.test', 'api.gestisci_chiavi', 'api.gestisci_plugin',
    'webhook.gestisci', 'webhook.visualizza',
  ],

  [TIPO_UTENTI.GDO]: [
    // Pagine
    'pagina.dashboard', 'pagina.profilo_utente',
    'pagina.promozioni', 'pagina.lavorazioni_in_corso', 'pagina.storico_lavorazioni',
    'pagina.volantini', 'pagina.storico_volantini',
    'pagina.materiali_attivi', 'pagina.materiali_in_corso', 'pagina.storico_materiali', 'pagina.contenuti_digitali',
    'pagina.ods_in_corso', 'pagina.ods_completati',
    'pagina.webpliant_disponibili',
    'pagina.punti_vendita', 'pagina.gestione_ricette', 'pagina.gestione_vini',
    'pagina.invio_campagna_whatsapp', 'pagina.campagne_whatsapp', 'pagina.business_chat', 'pagina.gestione_whatsapp_admin',
    'pagina.gestione_api', 'pagina.documentazione',
    'pagina.gestione_utenti',
    // Azioni
    'promo.visualizza',
    'kit_runtime.visualizza',
    'design_kit.visualizza',
    'raccoglitore_kit.visualizza',
    'file.download',
    'ordini_stampa.visualizza', 'ordini_stampa.download_report',
    'webpliant.visualizza',
    'referenze.visualizza',
    'utenti.visualizza',
    'whatsapp.invia_campagna', 'whatsapp.annulla_campagna', 'whatsapp.visualizza_campagne',
    'whatsapp.gestisci_presets', 'whatsapp.registra_utente', 'whatsapp.business_chat',
    'gdo.gestisci_punti_vendita', 'gdo.gestisci_aree_canali',
    'ai.gestisci_ricette', 'ai.gestisci_vini',
    'api.visualizza_statistiche',
  ],

  [TIPO_UTENTI.PUNTOVENDITA]: [
    // Pagine
    'pagina.dashboard', 'pagina.profilo_utente', 'pagina.barcode_reader',
    'pagina.promozioni', 'pagina.lavorazioni_in_corso', 'pagina.storico_lavorazioni',
    'pagina.volantini',
    'pagina.materiali_attivi',
    'pagina.webpliant_disponibili',
    'pagina.contenuti_digitali',
    // Azioni
    'promo.visualizza',
    'kit_runtime.visualizza',
    'file.download',
    'webpliant.visualizza',
    'referenze.visualizza',
  ],

  [TIPO_UTENTI.MARKETING]: [
    // Pagine
    'pagina.dashboard', 'pagina.profilo_utente',
    'pagina.promozioni', 'pagina.lavorazioni_in_corso', 'pagina.storico_lavorazioni',
    'pagina.volantini',
    'pagina.materiali_attivi',
    'pagina.contenuti_digitali',
    // Azioni
    'promo.visualizza',
    'kit_runtime.visualizza',
    'file.download',
    'webpliant.visualizza',
  ],

  [TIPO_UTENTI.GUEST]: [
    // Pagine
    'pagina.dashboard', 'pagina.profilo_utente',
    'pagina.promozioni', 'pagina.lavorazioni_in_corso',
    // Azioni
    'promo.visualizza',
    'kit_runtime.visualizza',
  ],
};
