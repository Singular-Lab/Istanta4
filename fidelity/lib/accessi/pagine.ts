import { CodicePermesso, PERMESSI } from './catalogo';

/**
 * Catalogo delle pagine protette e del permesso che ciascuna richiede.
 *
 * - `percorso` usa i segmenti del router (`:param` per i parametri).
 * - `sottopagine: true` estende il permesso a ogni percorso che inizia con quello
 *   della pagina (dettagli, kit, menabò...). Il confronto è sempre per segmenti
 *   interi: "/promozioni" non copre "/promozioni-in-corso".
 * - `permesso: null` significa "basta essere autenticati".
 *
 * Una pagina non presente nel catalogo non è accessibile (salvo al Superadmin):
 * un test controlla che ogni rotta del router abbia la sua voce.
 */
export type DefinizionePagina = {
  percorso: string;
  permesso: CodicePermesso | null;
  sottopagine?: boolean;
};

const P = PERMESSI;

export const PAGINE: DefinizionePagina[] = [
  // Aperte a tutti gli utenti autenticati
  { percorso: '/dashboard', permesso: null },
  { percorso: '/gdo/dashboard', permesso: null },
  { percorso: '/marketing/dashboard', permesso: null },
  { percorso: '/category/dashboard', permesso: null },
  { percorso: '/profilo-utente', permesso: null },
  { percorso: '/documentazione', permesso: null, sottopagine: true },
  { percorso: '/storico-volantini', permesso: null },
  { percorso: '/display/files', permesso: null },
  { percorso: '/hub', permesso: null, sottopagine: true },
  { percorso: '/auth', permesso: null, sottopagine: true },

  // Promozioni
  { percorso: '/promozioni/nuova', permesso: P.PROMO.CREA },
  { percorso: '/nuova-promozione', permesso: P.PROMO.CREA },
  { percorso: '/promozioni', permesso: P.PROMO.VISUALIZZA, sottopagine: true },
  { percorso: '/promozioni-in-corso', permesso: P.PROMO.VISUALIZZA },
  { percorso: '/storico-promozioni', permesso: P.PROMO.VISUALIZZA },
  { percorso: '/report/tracciati', permesso: P.PROMO.VISUALIZZA, sottopagine: true },

  // Volantini e materiali
  { percorso: '/volantini', permesso: P.VOLANTINI.VISUALIZZA, sottopagine: true },
  // Viste Volantini e POP per periodo, al posto delle pagine Materiali: stesso permesso
  { percorso: '/volantini/in-corso', permesso: P.MATERIALI.VISUALIZZA },
  { percorso: '/volantini/attivi', permesso: P.MATERIALI.VISUALIZZA },
  { percorso: '/volantini/storico', permesso: P.MATERIALI.VISUALIZZA },
  { percorso: '/pop/in-corso', permesso: P.MATERIALI.VISUALIZZA },
  { percorso: '/pop/attivi', permesso: P.MATERIALI.VISUALIZZA },
  { percorso: '/pop/storico', permesso: P.MATERIALI.VISUALIZZA },
  // Vecchi indirizzi delle pagine Materiali, ora redirect verso Volantini
  { percorso: '/materiali-attivi', permesso: P.MATERIALI.VISUALIZZA },
  { percorso: '/materiali-in-corso', permesso: P.MATERIALI.VISUALIZZA },
  { percorso: '/storico-materiali', permesso: P.MATERIALI.VISUALIZZA },
  { percorso: '/contenuti-digitali', permesso: P.MATERIALI.VISUALIZZA },

  // Ordini di stampa
  { percorso: '/nuovo-ods', permesso: P.ORDINI_STAMPA.CREA },
  { percorso: '/ods-in-corso', permesso: P.ORDINI_STAMPA.VISUALIZZA, sottopagine: true },
  { percorso: '/ods-completati', permesso: P.ORDINI_STAMPA.VISUALIZZA, sottopagine: true },
  { percorso: '/ordini-di-stampa', permesso: P.ORDINI_STAMPA.VISUALIZZA, sottopagine: true },

  // WebPliant
  { percorso: '/webliant/webpliant-disponibili', permesso: P.WEBPLIANT.VISUALIZZA },
  { percorso: '/webliant/impostazioni-webpliant', permesso: P.WEBPLIANT.CONFIGURA, sottopagine: true },

  // GDO e punti vendita
  { percorso: '/gestione-interna/aree-e-canali', permesso: P.GDO.VISUALIZZA },
  { percorso: '/gestione-interna/punti-vendita', permesso: P.GDO.VISUALIZZA, sottopagine: true },

  // Utenti
  { percorso: '/gestione-interna/gestione-utenti', permesso: P.UTENTI.VISUALIZZA },

  // Impostazioni
  { percorso: '/impostazioni-tipografia', permesso: P.IMPOSTAZIONI.VISUALIZZA },
  { percorso: '/impostazioni-di-produzione', permesso: P.IMPOSTAZIONI.VISUALIZZA, sottopagine: true },
  { percorso: '/gestione-pagine-singular', permesso: P.IMPOSTAZIONI.GESTISCI_PAGINE_SINGULAR },

  // Contenuti AI
  { percorso: '/gestione-ricette', permesso: P.AI.GESTISCI_RICETTE, sottopagine: true },
  { percorso: '/gestione-approfondimento-vini', permesso: P.AI.GESTISCI_VINI, sottopagine: true },

  // WhatsApp
  { percorso: '/whatsapp/campagne-whatsapp', permesso: P.WHATSAPP.VISUALIZZA_CAMPAGNE },
  { percorso: '/whatsapp/invio-campagna-whatsapp', permesso: P.WHATSAPP.INVIA_CAMPAGNA },
  { percorso: '/gestione-whatsapp-admin', permesso: P.WHATSAPP.GESTISCI_PRESETS },
  { percorso: '/whatsapp/gestione-whatsapp-superadmin', permesso: P.SISTEMA.GESTISCI_WHATSAPP, sottopagine: true },

  // API e webhook
  { percorso: '/gestione-api/statistiche', permesso: P.API.VISUALIZZA_STATISTICHE },
  { percorso: '/gestione-api/test', permesso: P.API.TEST },
  { percorso: '/gestione-api/keys', permesso: P.API.GESTISCI_CHIAVI },
  { percorso: '/gestione-api/plugin', permesso: P.API.GESTISCI_PLUGIN },
  { percorso: '/gestione-webhook', permesso: P.WEBHOOK.VISUALIZZA },

  // Strumenti
  { percorso: '/barcode-reader', permesso: P.STRUMENTI.VISUALIZZA },
  { percorso: '/competitor-analyzer', permesso: P.STRUMENTI.VISUALIZZA },

  // Sistema
  { percorso: '/gestione-interna/gestione-permessi', permesso: P.SISTEMA.GESTISCI_ACCESSI },
  { percorso: '/gestione-interna/gestione-hub', permesso: P.SISTEMA.GESTISCI_HUB },
  { percorso: '/gestione-interna/gestione-metodi-accesso', permesso: P.SISTEMA.GESTISCI_METODI_ACCESSO },
  { percorso: '/superadmin/dashboard', permesso: P.SISTEMA.DASHBOARD },
];

/* =======================
   CONFRONTO DEI PERCORSI
   ======================= */

const segmenti = (percorso: string): string[] =>
  percorso.split('?')[0].split('#')[0].split('/').filter(s => s.length > 0);

/** "/promozioni/in-corso/" e "promozioni/in-corso" diventano "/promozioni/in-corso". */
export const normalizzaPercorso = (percorso: string): string => '/' + segmenti(percorso || '').join('/');

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
