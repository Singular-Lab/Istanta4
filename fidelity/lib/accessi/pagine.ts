import { CodicePermesso, PERMESSI } from './catalogo';
import type { SezionePagina } from './sezioni';

/**
 * Catalogo delle pagine protette e del permesso che ciascuna richiede.
 *
 * - `percorso` usa i segmenti del router (`:param` per i parametri).
 * - `sottopagine: true` estende il permesso a ogni percorso che inizia con quello
 *   della pagina (dettagli, kit, menabò...). Il confronto è sempre per segmenti
 *   interi: "/promozioni" non copre "/promozioni-in-corso".
 * - `permesso: null` significa "basta essere autenticati": solo per le pagine dell'utente su sé
 *   stesso e di servizio (profilo, hub, accesso, documentazione delle API, display).
 * - `sezione` è la sezione del menu della pagina, secondo la sua funzione principale
 *   (lib/accessi/sezioni.ts): decide dove compare la voce, qualunque gruppo abbia scelto
 *   l'amministratore.
 *
 * Una pagina non presente nel catalogo non è accessibile (salvo al Superadmin):
 * un test controlla che ogni rotta del router abbia la sua voce.
 */
export type DefinizionePagina = {
  percorso: string;
  permesso: CodicePermesso | null;
  sottopagine?: boolean;
  sezione: SezionePagina;
};

const P = PERMESSI;

export const PAGINE: DefinizionePagina[] = [
  // Panoramica e storico dei volantini: solo consultazione, lo stato delle lavorazioni è in Avanzamento produzione
  { percorso: '/dashboard', permesso: P.VOLANTINI.VISUALIZZA, sezione: 'visualizzazione' },
  { percorso: '/gdo/dashboard', permesso: P.VOLANTINI.VISUALIZZA, sezione: 'visualizzazione' },
  { percorso: '/storico-volantini', permesso: P.VOLANTINI.VISUALIZZA, sezione: 'visualizzazione' },
  // Dashboard dei dati per Category e Marketing
  { percorso: '/marketing/dashboard', permesso: P.ANALISI.DASHBOARD_MARKETING, sezione: 'visualizzazione' },
  { percorso: '/category/dashboard', permesso: P.ANALISI.DASHBOARD_CATEGORY, sezione: 'visualizzazione' },

  // Aperte a tutti gli utenti autenticati: le pagine dell'utente su sé stesso e di servizio
  { percorso: '/profilo-utente', permesso: null, sezione: 'account' },
  // Documentazione delle API, per chi integra
  { percorso: '/documentazione', permesso: null, sottopagine: true, sezione: 'gestione' },
  { percorso: '/display/files', permesso: null, sezione: 'account' },
  { percorso: '/hub', permesso: null, sottopagine: true, sezione: 'account' },
  { percorso: '/auth', permesso: null, sottopagine: true, sezione: 'account' },

  // Avanzamento delle lavorazioni: promo in corso e stato dei loro kit
  { percorso: '/avanzamento-produzione', permesso: P.KIT_RUNTIME.VISUALIZZA, sezione: 'produzione' },

  // Promozioni
  { percorso: '/promozioni/nuova', permesso: P.PROMO.CREA, sezione: 'produzione' },
  { percorso: '/nuova-promozione', permesso: P.PROMO.CREA, sezione: 'produzione' },
  { percorso: '/promozioni', permesso: P.PROMO.VISUALIZZA, sottopagine: true, sezione: 'produzione' },
  { percorso: '/promozioni-in-corso', permesso: P.PROMO.VISUALIZZA, sezione: 'produzione' },
  { percorso: '/storico-promozioni', permesso: P.PROMO.VISUALIZZA, sezione: 'produzione' },
  // Analisi dei tracciati: consultazione, con il suo permesso (non quello delle promozioni)
  { percorso: '/report/tracciati', permesso: P.ANALISI.VISUALIZZA, sottopagine: true, sezione: 'visualizzazione' },

  // Volantini e materiali
  { percorso: '/volantini/tutti_i_volantini', permesso: P.MATERIALI.VISUALIZZA, sezione: 'visualizzazione' },
  // La vecchia pagina Volantini non c'è più: l'indirizzo porta a Volantini attivi, con il suo permesso
  { percorso: '/volantini', permesso: P.MATERIALI.VISUALIZZA, sezione: 'visualizzazione' },
  // Viste Volantini e POP per periodo, al posto delle pagine Materiali: stesso permesso
  { percorso: '/volantini/attivi', permesso: P.MATERIALI.VISUALIZZA, sezione: 'visualizzazione' },
  { percorso: '/volantini/prossimi', permesso: P.MATERIALI.VISUALIZZA, sezione: 'visualizzazione' },
  { percorso: '/volantini/storico', permesso: P.MATERIALI.VISUALIZZA, sezione: 'visualizzazione' },
  { percorso: '/pop/attivi', permesso: P.MATERIALI.VISUALIZZA, sezione: 'visualizzazione' },
  { percorso: '/pop/prossimi', permesso: P.MATERIALI.VISUALIZZA, sezione: 'visualizzazione' },
  { percorso: '/pop/storico', permesso: P.MATERIALI.VISUALIZZA, sezione: 'visualizzazione' },
  // Consultazione di una promozione, aperta dalle schede delle viste Volantini: pagina di dettaglio, non nel menu
  { percorso: '/volantini/promozioni/:idPromo', permesso: P.MATERIALI.VISUALIZZA, sezione: 'visualizzazione' },
  // Vecchi indirizzi del periodo "in corso", ora redirect verso Prossimi
  { percorso: '/volantini/in-corso', permesso: P.MATERIALI.VISUALIZZA, sezione: 'visualizzazione' },
  { percorso: '/pop/in-corso', permesso: P.MATERIALI.VISUALIZZA, sezione: 'visualizzazione' },
  // Vecchi indirizzi delle pagine Materiali, ora redirect verso Volantini
  { percorso: '/materiali-attivi', permesso: P.MATERIALI.VISUALIZZA, sezione: 'visualizzazione' },
  { percorso: '/materiali-in-corso', permesso: P.MATERIALI.VISUALIZZA, sezione: 'visualizzazione' },
  { percorso: '/storico-materiali', permesso: P.MATERIALI.VISUALIZZA, sezione: 'visualizzazione' },
  { percorso: '/contenuti-digitali', permesso: P.MATERIALI.VISUALIZZA, sezione: 'visualizzazione' },

  // Ordini di stampa
  { percorso: '/nuovo-ods', permesso: P.ORDINI_STAMPA.CREA, sezione: 'produzione' },
  { percorso: '/ods-in-corso', permesso: P.ORDINI_STAMPA.VISUALIZZA, sottopagine: true, sezione: 'produzione' },
  { percorso: '/ods-completati', permesso: P.ORDINI_STAMPA.VISUALIZZA, sottopagine: true, sezione: 'produzione' },
  { percorso: '/ordini-di-stampa', permesso: P.ORDINI_STAMPA.VISUALIZZA, sottopagine: true, sezione: 'produzione' },

  // WebPliant: i workspace sono produzione, l'elenco dei volantini digitali è consultazione
  { percorso: '/webliant/webpliant-disponibili', permesso: P.WEBPLIANT.VISUALIZZA, sezione: 'visualizzazione' },
  { percorso: '/webliant/workspace', permesso: P.WEBPLIANT.CONFIGURA, sezione: 'produzione' },
  // Editor del workspace, a schermo intero fuori dal layout: si apre dalla pagina Workspace WebPliant
  { percorso: '/webliant/workspace/editor', permesso: P.WEBPLIANT.CONFIGURA, sezione: 'produzione' },

  // GDO e punti vendita
  { percorso: '/gestione-interna/aree-e-canali', permesso: P.GDO.VISUALIZZA, sezione: 'gestione' },
  // Consultazione (elenco e scheda con volantini attivi e storia) e gestione, con le sue API
  { percorso: '/punti-vendita', permesso: P.GDO.VISUALIZZA, sottopagine: true, sezione: 'visualizzazione' },
  { percorso: '/gestione-interna/punti-vendita', permesso: P.GDO.GESTISCI_PUNTI_VENDITA, sottopagine: true, sezione: 'gestione' },

  // Utenti
  { percorso: '/gestione-interna/gestione-utenti', permesso: P.UTENTI.VISUALIZZA, sezione: 'gestione' },

  // Impostazioni di produzione
  { percorso: '/impostazioni-tipografia', permesso: P.IMPOSTAZIONI.VISUALIZZA, sezione: 'produzione' },
  { percorso: '/impostazioni-di-produzione', permesso: P.IMPOSTAZIONI.VISUALIZZA, sottopagine: true, sezione: 'produzione' },
  // Impostazioni della GDO: identità, reparti, campi delle referenze, insight del volantino, sito web
  { percorso: '/impostazioni-gdo', permesso: P.IMPOSTAZIONI.MODIFICA_GENERALI, sezione: 'gestione' },

  // Contenuti AI
  { percorso: '/gestione-ricette', permesso: P.AI.GESTISCI_RICETTE, sottopagine: true, sezione: 'produzione' },
  { percorso: '/gestione-approfondimento-vini', permesso: P.AI.GESTISCI_VINI, sottopagine: true, sezione: 'produzione' },

  // WhatsApp
  { percorso: '/whatsapp/campagne-whatsapp', permesso: P.WHATSAPP.VISUALIZZA_CAMPAGNE, sezione: 'comunicazione' },
  { percorso: '/whatsapp/invio-campagna-whatsapp', permesso: P.WHATSAPP.INVIA_CAMPAGNA, sezione: 'comunicazione' },
  { percorso: '/gestione-whatsapp-admin', permesso: P.WHATSAPP.GESTISCI_PRESETS, sezione: 'comunicazione' },
  { percorso: '/whatsapp/gestione-whatsapp-superadmin', permesso: P.SISTEMA.GESTISCI_WHATSAPP, sottopagine: true, sezione: 'comunicazione' },

  // API e webhook
  { percorso: '/gestione-api/statistiche', permesso: P.API.VISUALIZZA_STATISTICHE, sezione: 'gestione' },
  { percorso: '/gestione-api/test', permesso: P.API.TEST, sezione: 'gestione' },
  { percorso: '/gestione-api/keys', permesso: P.API.GESTISCI_CHIAVI, sezione: 'gestione' },
  { percorso: '/gestione-api/plugin', permesso: P.API.GESTISCI_PLUGIN, sezione: 'gestione' },
  { percorso: '/gestione-webhook', permesso: P.WEBHOOK.VISUALIZZA, sezione: 'gestione' },

  // Strumenti di consultazione
  { percorso: '/barcode-reader', permesso: P.STRUMENTI.VISUALIZZA, sezione: 'visualizzazione' },
  { percorso: '/competitor-analyzer', permesso: P.STRUMENTI.VISUALIZZA, sezione: 'visualizzazione' },

  // Sistema
  { percorso: '/gestione-interna/gestione-permessi', permesso: P.SISTEMA.GESTISCI_ACCESSI, sezione: 'sistema' },
  { percorso: '/gestione-interna/gestione-hub', permesso: P.SISTEMA.GESTISCI_HUB, sezione: 'sistema' },
  { percorso: '/gestione-interna/gestione-metodi-accesso', permesso: P.SISTEMA.GESTISCI_METODI_ACCESSO, sezione: 'sistema' },
  { percorso: '/superadmin/dashboard', permesso: P.SISTEMA.DASHBOARD, sezione: 'sistema' },
];

/**
 * Le pagine che si possono mettere nel menu, con il titolo e l'icona proposti dall'editor del menu.
 * Ogni percorso è una pagina vera del router e deve avere la sua voce in PAGINE, da cui prende
 * permesso e sezione (un test lo controlla). Redirect e vecchi indirizzi non ci sono.
 */
export type VoceDiMenu = { percorso: string; titolo: string; icona: string };

export const VOCI_DI_MENU: readonly VoceDiMenu[] = [
  // Produzione
  { percorso: '/avanzamento-produzione', titolo: 'Avanzamento produzione', icona: 'Gauge' },
  { percorso: '/promozioni/nuova', titolo: 'Nuova promozione', icona: 'CirclePlus' },
  { percorso: '/promozioni/in-corso', titolo: 'Promozioni in corso', icona: 'Activity' },
  { percorso: '/promozioni/storico', titolo: 'Storico promozioni', icona: 'History' },
  { percorso: '/nuovo-ods', titolo: 'Nuovo Ordine di Stampa', icona: 'PackagePlus' },
  { percorso: '/ods-in-corso', titolo: 'Ordine di Stampa in corso', icona: 'Truck' },
  { percorso: '/ods-completati', titolo: 'Ordine di Stampa completati', icona: 'CircleCheck' },
  { percorso: '/webliant/workspace', titolo: 'Workspace WebPliant', icona: 'LayoutTemplate' },
  { percorso: '/gestione-ricette', titolo: 'Gestione Ricette', icona: 'BookOpen' },
  { percorso: '/gestione-approfondimento-vini', titolo: 'Approfondimenti Vini', icona: 'Wine' },
  { percorso: '/impostazioni-di-produzione', titolo: 'Impostazioni Kit', icona: 'SlidersVertical' },
  { percorso: '/impostazioni-tipografia', titolo: 'Impostazioni Tipografia', icona: 'FolderTree' },
  { percorso: '/impostazioni-gdo', titolo: 'Impostazioni GDO', icona: 'Building2' },
  // Visualizzazione
  { percorso: '/gdo/dashboard', titolo: 'Panoramica volantini', icona: 'LayoutDashboard' },
  { percorso: '/category/dashboard', titolo: 'Dashboard Category', icona: 'ChartColumn' },
  { percorso: '/marketing/dashboard', titolo: 'Dashboard Marketing', icona: 'ChartLine' },
  { percorso: '/punti-vendita', titolo: 'Punti vendita', icona: 'Store' },
  { percorso: '/volantini/attivi', titolo: 'Volantini attivi', icona: 'FolderOpen' },
  { percorso: '/volantini/prossimi', titolo: 'Volantini prossimi', icona: 'CalendarClock' },
  { percorso: '/volantini/storico', titolo: 'Volantini storico', icona: 'Archive' },
  { percorso: '/pop/attivi', titolo: 'POP attivi', icona: 'FolderOpen' },
  { percorso: '/pop/prossimi', titolo: 'POP prossimi', icona: 'CalendarClock' },
  { percorso: '/pop/storico', titolo: 'POP storico', icona: 'Archive' },
  { percorso: '/storico-volantini', titolo: 'Storico volantini', icona: 'History' },
  { percorso: '/contenuti-digitali', titolo: 'Contenuti digitali', icona: 'MonitorPlay' },
  { percorso: '/webliant/webpliant-disponibili', titolo: 'Webpliant disponibili', icona: 'Wallpaper' },
  { percorso: '/report/tracciati', titolo: 'Report tracciati', icona: 'FileChartColumn' },
  { percorso: '/barcode-reader', titolo: 'Lettore codici a barre', icona: 'ScanBarcode' },
  { percorso: '/competitor-analyzer', titolo: 'Analisi concorrenza', icona: 'ScanSearch' },
  // Comunicazione
  { percorso: '/whatsapp/campagne-whatsapp', titolo: 'Campagne WhatsApp', icona: 'Send' },
  { percorso: '/whatsapp/invio-campagna-whatsapp', titolo: 'Invio campagna WhatsApp', icona: 'MessageSquarePlus' },
  { percorso: '/gestione-whatsapp-admin', titolo: 'Gestione WhatsApp', icona: 'MessageCircle' },
  { percorso: '/whatsapp/gestione-whatsapp-superadmin', titolo: 'Piattaforma WhatsApp', icona: 'PhoneForwarded' },
  // Gestione interna
  { percorso: '/gestione-interna/aree-e-canali', titolo: 'Aree e Canali', icona: 'Globe' },
  { percorso: '/gestione-interna/punti-vendita', titolo: 'Anagrafica punti vendita', icona: 'Store' },
  { percorso: '/gestione-interna/gestione-utenti', titolo: 'Gestione Utenti', icona: 'Users' },
  { percorso: '/gestione-api/keys', titolo: 'Chiavi API', icona: 'Key' },
  { percorso: '/gestione-api/statistiche', titolo: 'Statistiche API', icona: 'ChartNoAxesColumn' },
  { percorso: '/gestione-api/test', titolo: 'Prova delle API', icona: 'FlaskConical' },
  { percorso: '/gestione-api/plugin', titolo: 'Plugin', icona: 'Puzzle' },
  { percorso: '/gestione-webhook', titolo: 'Gestione Webhook', icona: 'Zap' },
  { percorso: '/documentazione', titolo: 'Documentazione API', icona: 'BookOpenText' },
  // Sistema
  { percorso: '/superadmin/dashboard', titolo: 'Dashboard Superadmin', icona: 'LayoutDashboard' },
  { percorso: '/gestione-interna/gestione-permessi', titolo: 'Gestione Permessi', icona: 'Shield' },
  { percorso: '/gestione-interna/gestione-hub', titolo: 'Gestione Hub', icona: 'LayoutGrid' },
  { percorso: '/gestione-interna/gestione-metodi-accesso', titolo: 'Metodi di accesso', icona: 'KeyRound' },
];

/* =======================
   CONFRONTO DEI PERCORSI
   ======================= */

const segmenti = (percorso: string): string[] =>
  percorso.split('?')[0].split('#')[0].split('/').filter(s => s.length > 0);

/** "/promozioni/in-corso/" e "promozioni/in-corso" diventano "/promozioni/in-corso". */
export const normalizzaPercorso = (percorso: string): string => `/${segmenti(percorso || '').join('/')}`;

const corrisponde = (schema: string[], richiesto: string[], sottopagine: boolean): boolean => {
  if (richiesto.length < schema.length) return false;
  if (richiesto.length > schema.length && !sottopagine) return false;
  for (let i = 0; i < schema.length; i++) {
    if (schema[i].charAt(0) === ':') continue;
    if (schema[i] !== richiesto[i]) return false;
  }
  return true;
};

const PAGINE_ORDINATE = PAGINE
  .map(p => ({ pagina: p, schema: segmenti(p.percorso) }))
  // Le voci più specifiche vincono: "/promozioni/nuova" prima di "/promozioni/**".
  .sort((a, b) => {
    if (b.schema.length !== a.schema.length) return b.schema.length - a.schema.length;
    return (a.pagina.sottopagine ? 1 : 0) - (b.pagina.sottopagine ? 1 : 0);
  });

/** Voce del catalogo che governa il percorso, o undefined se la pagina non è censita. */
export const paginaPer = (percorso: string): DefinizionePagina | undefined => {
  const richiesto = segmenti(percorso || '');
  for (const voce of PAGINE_ORDINATE) {
    if (corrisponde(voce.schema, richiesto, !!voce.pagina.sottopagine)) return voce.pagina;
  }
  return undefined;
};

/** Sezione del menu della pagina che governa il percorso, o undefined se la pagina non è censita. */
export const sezioneDiPercorso = (percorso: string): SezionePagina | undefined => paginaPer(percorso)?.sezione;

/**
 * Decide se un percorso è accessibile con i permessi dati.
 * `permessi` sono quelli effettivi (già filtrati dalle regole d'area).
 */
export const puoAprirePagina = (
  percorso: string,
  haPermesso: (codice: CodicePermesso) => boolean,
  superadmin = false
): boolean => {
  if (superadmin) return true;
  const pagina = paginaPer(percorso);
  if (!pagina) return false;
  return pagina.permesso === null || haPermesso(pagina.permesso);
};

/** La voce di menu proposta per un percorso, se la pagina si può mettere nel menu. */
export const voceDiMenuPer = (percorso: string): VoceDiMenu | undefined => {
  const cercato = normalizzaPercorso(percorso);
  return VOCI_DI_MENU.find(v => v.percorso === cercato);
};
