import { RUOLO_UTENTE_GDO, TIPO_UTENTI } from '../../../lib/enums';

/**
 * I dati con cui nasce un'installazione di Fidelity, gli stessi che inserisce a mano
 * docker/fidelity-olimpo/seed-fidelity.sh: le due copie vanno tenute allineate (lo verifica
 * __tests__/deployInizializzazione.test.ts).
 */

/** Il metodo di accesso senza il quale la pagina di login non propone nulla. */
export const PROVIDER_EMAIL_PASSWORD = {
  id: '4720cd6b-298d-42ad-a5a8-be3cd00f39d7',
  codice: 'email_password',
  nome: 'Email e Password',
  descrizione: 'Accedi con le tue credenziali email e password',
  icona: 'Mail',
  tipo: 'internal' as const,
  ordine: 0,
  attivo: true,
};

/** Una voce del menu predefinito: tutte del Superadmin, senza sotto-ruolo GDO e senza padre. */
export interface VoceMenuPredefinita {
  id_menu_item: string;
  titolo: string;
  tipo: 'item' | 'separator';
  icona: string | null;
  pathname: string | null;
  codice_permesso: string | null;
  disabilitato: boolean;
  start_page: boolean;
  ordinamento: number;
}

/**
 * Il menu predefinito del Superadmin. Gli identificativi sono fissi di proposito: sono dati di
 * riferimento e restano gli stessi su tutte le installazioni. I menu degli altri tipi di utente
 * si compongono dalla gestione menu.
 */
export const MENU_SUPERADMIN: readonly VoceMenuPredefinita[] = [
  { id_menu_item: '7ac7896d-fae8-4ab8-98bc-58808c2221d9', titolo: 'VOLANTINI', tipo: 'separator', icona: null, pathname: null, codice_permesso: null, disabilitato: false, start_page: false, ordinamento: 0 },
  { id_menu_item: 'e3e9679d-48e7-4a40-b1c5-5771972452eb', titolo: 'Dashboard', tipo: 'item', icona: 'LayoutDashboard', pathname: '/dashboard', codice_permesso: 'pagina.dashboard', disabilitato: false, start_page: false, ordinamento: 1 },
  { id_menu_item: '97d81e0f-87a5-4d17-a073-4cb5dbc771fe', titolo: 'PROMOZIONI', tipo: 'separator', icona: null, pathname: null, codice_permesso: null, disabilitato: false, start_page: false, ordinamento: 2 },
  { id_menu_item: 'c0a1cb43-d952-48f4-b3d5-3df0136e266e', titolo: 'Nuova promozione', tipo: 'item', icona: 'CirclePlus', pathname: '/promozioni/nuova', codice_permesso: 'pagina.nuova_lavorazione', disabilitato: false, start_page: false, ordinamento: 3 },
  { id_menu_item: 'c51138b8-a5d9-468a-bbe9-dfdc4624e99d', titolo: 'Promozioni in corso', tipo: 'item', icona: 'Activity', pathname: '/promozioni/in-corso', codice_permesso: 'pagina.lavorazioni_in_corso', disabilitato: false, start_page: false, ordinamento: 4 },
  { id_menu_item: 'cf751b87-81e6-4ba5-84d4-d0bef08098c7', titolo: 'Storico promozioni', tipo: 'item', icona: 'History', pathname: '/promozioni/storico', codice_permesso: 'pagina.storico_lavorazioni', disabilitato: false, start_page: false, ordinamento: 5 },
  { id_menu_item: '6b03214e-1da8-4763-a67f-ca911415e8d6', titolo: 'MATERIALI', tipo: 'separator', icona: null, pathname: null, codice_permesso: null, disabilitato: false, start_page: false, ordinamento: 6 },
  { id_menu_item: '9377d668-7ce9-4215-9fca-274422fa533b', titolo: 'Materiali attivi', tipo: 'item', icona: 'FolderOpen', pathname: '/materiali-attivi', codice_permesso: 'pagina.materiali_attivi', disabilitato: false, start_page: false, ordinamento: 7 },
  { id_menu_item: 'c5779471-fe38-4b4a-b7fd-827c5ac5ef8e', titolo: 'Materiali in corso', tipo: 'item', icona: 'Clock', pathname: '/materiali-in-corso', codice_permesso: 'pagina.materiali_in_corso', disabilitato: false, start_page: false, ordinamento: 8 },
  { id_menu_item: 'ee608d8d-5439-4f26-9010-81d88c2dc6a0', titolo: 'Storico materiali', tipo: 'item', icona: 'Archive', pathname: '/storico-materiali', codice_permesso: 'pagina.storico_materiali', disabilitato: false, start_page: false, ordinamento: 9 },
  { id_menu_item: 'cadd7253-7ad9-4cdd-8063-4bd9b2582a8b', titolo: 'ORDINI DI STAMPA', tipo: 'separator', icona: null, pathname: null, codice_permesso: null, disabilitato: false, start_page: false, ordinamento: 10 },
  { id_menu_item: '1fd9830f-75f9-4ea0-a2cf-d3e42c7ea332', titolo: 'Nuovo Ordine di Stampa', tipo: 'item', icona: 'PackagePlus', pathname: '/nuovo-ods', codice_permesso: 'pagina.nuovo_ods', disabilitato: false, start_page: false, ordinamento: 11 },
  { id_menu_item: '1c1c3281-4101-45be-a3ca-3a98dd5962fd', titolo: 'Ordine di Stampa in corso', tipo: 'item', icona: 'Truck', pathname: '/ods-in-corso', codice_permesso: 'pagina.ods_in_corso', disabilitato: false, start_page: false, ordinamento: 12 },
  { id_menu_item: '2d5b27a4-4e2c-4a73-b6db-008da7a52281', titolo: 'Ordine di Stampa completati', tipo: 'item', icona: 'CircleCheck', pathname: '/ods-completati', codice_permesso: 'pagina.ods_completati', disabilitato: false, start_page: false, ordinamento: 13 },
  { id_menu_item: '8b8214c1-51c9-4248-ba81-eddec2754457', titolo: 'WEBPLIANT', tipo: 'separator', icona: null, pathname: null, codice_permesso: null, disabilitato: false, start_page: false, ordinamento: 14 },
  { id_menu_item: '310e96be-2ab8-4588-bcea-20be1026e2d2', titolo: 'Impostazioni WebPliant', tipo: 'item', icona: 'Settings', pathname: '/webliant/impostazioni-webpliant', codice_permesso: 'pagina.impostazioni_webpliant', disabilitato: false, start_page: false, ordinamento: 15 },
  { id_menu_item: '02fa3754-b947-47d7-93c3-c2c5ef29bb65', titolo: 'Webpliant disponibili', tipo: 'item', icona: 'Wallpaper', pathname: '/webliant/webpliant-disponibili', codice_permesso: 'pagina.webpliant_disponibili', disabilitato: false, start_page: false, ordinamento: 16 },
  { id_menu_item: '654b1cda-c84f-42dc-bb08-ce87afb44ff6', titolo: 'SERVIZI', tipo: 'separator', icona: null, pathname: null, codice_permesso: null, disabilitato: false, start_page: false, ordinamento: 17 },
  { id_menu_item: 'ac7d0a01-9558-4db5-9cac-b962e7e3538c', titolo: 'Correggo', tipo: 'item', icona: 'ThumbsUp', pathname: '/dashboard-overview-8', codice_permesso: null, disabilitato: true, start_page: false, ordinamento: 18 },
  { id_menu_item: '52501e5c-d22c-412d-a1a3-c42b4314f22d', titolo: 'Gestione Ricette', tipo: 'item', icona: 'BookOpen', pathname: '/gestione-ricette', codice_permesso: 'pagina.gestione_ricette', disabilitato: false, start_page: false, ordinamento: 19 },
  { id_menu_item: '1b9380f8-15dc-4735-bbfa-7bebe341a836', titolo: 'Approfondimenti Vini', tipo: 'item', icona: 'Wine', pathname: '/gestione-approfondimento-vini', codice_permesso: 'pagina.gestione_vini', disabilitato: false, start_page: false, ordinamento: 20 },
  { id_menu_item: '3e70c8ce-2c65-4208-b5e2-a6850cb3a78b', titolo: 'Whatsapp', tipo: 'item', icona: 'PhoneForwarded', pathname: '/whatsapp/gestione-whatsapp-superadmin', codice_permesso: 'pagina.gestione_whatsapp_superadmin', disabilitato: false, start_page: false, ordinamento: 21 },
  { id_menu_item: '4e36e61c-227b-4180-9501-852878b99215', titolo: 'GESTIONE INTERNA', tipo: 'separator', icona: null, pathname: null, codice_permesso: null, disabilitato: false, start_page: false, ordinamento: 22 },
  { id_menu_item: '71d3dd1c-697a-426b-bafd-4ca4bea4acfe', titolo: 'Aree e Canali', tipo: 'item', icona: 'Globe', pathname: '/aree-e-canali', codice_permesso: 'pagina.aree_e_canali', disabilitato: false, start_page: false, ordinamento: 23 },
  { id_menu_item: '3dde53ae-19df-4cd7-b7ef-ba7246910d79', titolo: 'Punti Vendita', tipo: 'item', icona: 'Store', pathname: '/punti-vendita', codice_permesso: 'pagina.punti_vendita', disabilitato: false, start_page: false, ordinamento: 24 },
  { id_menu_item: '4290ecac-d5be-46be-9090-69293b6ca7ca', titolo: 'Gestione Utenti', tipo: 'item', icona: 'Users', pathname: '/gestione-utenti', codice_permesso: 'pagina.gestione_utenti', disabilitato: false, start_page: false, ordinamento: 25 },
  { id_menu_item: '7fb7ef8a-6626-4879-8222-68603dc4267f', titolo: 'IMPOSTAZIONI', tipo: 'separator', icona: null, pathname: null, codice_permesso: null, disabilitato: false, start_page: false, ordinamento: 26 },
  { id_menu_item: '9d1ab6b0-2bb1-4e45-b6ce-a418fea0106c', titolo: 'Impostazioni Kit', tipo: 'item', icona: 'SlidersVertical', pathname: '/impostazioni-di-produzione', codice_permesso: 'pagina.impostazioni_produzione', disabilitato: false, start_page: false, ordinamento: 27 },
  { id_menu_item: 'fccb70b4-eb04-4e22-b013-6b4222be1f3b', titolo: 'Impostazioni Tipografia', tipo: 'item', icona: 'FolderTree', pathname: '/impostazioni-tipografia', codice_permesso: 'pagina.impostazioni_tipografia', disabilitato: false, start_page: false, ordinamento: 28 },
  { id_menu_item: '2a828c41-ec86-4533-9c8f-ea4580234f2a', titolo: 'Gestione Permessi', tipo: 'item', icona: 'Shield', pathname: '/gestione-permessi', codice_permesso: 'pagina.gestione_permessi', disabilitato: false, start_page: false, ordinamento: 29 },
  { id_menu_item: '1ee578ea-154a-425e-bccd-c15e277559b9', titolo: 'DEVELOPMENT SINGULAR', tipo: 'separator', icona: null, pathname: null, codice_permesso: null, disabilitato: false, start_page: false, ordinamento: 30 },
  { id_menu_item: 'e023fa1c-7af3-4bbe-9fd6-2bf0dd605175', titolo: 'Gestione Pagine', tipo: 'item', icona: 'PanelsTopLeft', pathname: '/gestione-pagine-singular', codice_permesso: 'pagina.gestione_pagine_singular', disabilitato: false, start_page: false, ordinamento: 31 },
  { id_menu_item: '0b8f277c-bd3f-40d4-bf4c-f3b7b907b906', titolo: 'Gestione Webhook', tipo: 'item', icona: 'Zap', pathname: '/gestione-webhook', codice_permesso: 'pagina.gestione_webhook', disabilitato: false, start_page: false, ordinamento: 32 },
];

/** Codici dei servizi dell'hub che Fidelity gestisce da se' (meta.gestito). */
export type ServizioGestito = 'istanta' | 'correggo';

/** Il percorso di ingresso di ciascun servizio gestito, dopo l'indirizzo pubblico dell'applicazione. */
export const INGRESSO_SERVIZIO_GESTITO: Record<ServizioGestito, string> = {
  istanta: '/LoginController/oauth/landed',
  correggo: '/OAuthLanded.ashx',
};

/**
 * I servizi Istanta e Correggo dell'hub, con i tipi di utente che li vedono. L'inizializzazione li crea
 * a ogni deploy se mancano (anche in un hub gia' configurato), uno per tipo di utente; l'indirizzo lo
 * ricava Fidelity dalla configurazione (server/core/services/serviziGestiti.ts) e non si modifica ne'
 * si elimina dalla gestione dell'hub.
 */
export const SERVIZI_GESTITI: readonly {
  codice: ServizioGestito;
  nome: string;
  descrizione: string;
  icona: string;
  colore: string;
  ordine: number;
  tipiUtente: readonly TIPO_UTENTI[];
}[] = [
  {
    codice: 'istanta',
    nome: 'Istanta',
    descrizione: 'Lavorazione e impaginazione dei volantini',
    icona: 'Layers',
    colore: 'primary',
    ordine: 10,
    tipiUtente: [TIPO_UTENTI.SUPERADMIN, TIPO_UTENTI.AGENZIA],
  },
  {
    codice: 'correggo',
    nome: 'Correggo',
    descrizione: 'Correzione delle bozze dei volantini',
    icona: 'ThumbsUp',
    colore: 'primary',
    ordine: 20,
    tipiUtente: [TIPO_UTENTI.SUPERADMIN, TIPO_UTENTI.AGENZIA, TIPO_UTENTI.GDO, TIPO_UTENTI.CATEGORY, TIPO_UTENTI.MARKETING],
  },
];

/** Il servizio interno "Istanta 2 GDO Suite", come lo seminava seedHubData. */
const FP_BASE = {
  codice: 'fidelity_promotion',
  nome: 'Istanta 2 GDO Suite',
  icona: 'Megaphone',
  colore: 'primary',
  url: '/gdo/dashboard',
  tipo_url: 'internal' as const,
  ordine: 0,
  in_evidenza: true,
};

/**
 * Gli altri servizi con cui nasce l'hub ("Istanta 2 GDO Suite", interno, da seedHubData), uno per tipo di
 * utente e sotto-ruolo GDO: si creano solo se l'hub e' vuoto. Istanta e Correggo sono in SERVIZI_GESTITI.
 */
export const SERVIZI_HUB_PREDEFINITI = [
  { ...FP_BASE, tipo_utente: TIPO_UTENTI.SUPERADMIN, ruolo_gdo: null, descrizione: 'Pannello di amministrazione completo per la gestione della piattaforma' },
  { ...FP_BASE, tipo_utente: TIPO_UTENTI.AGENZIA, ruolo_gdo: null, descrizione: 'Crea e gestisci promozioni e materiali marketing per i tuoi clienti' },
  { ...FP_BASE, tipo_utente: TIPO_UTENTI.GDO, ruolo_gdo: RUOLO_UTENTE_GDO.AMMINISTRATORE_DELEGATO, descrizione: 'Gestisci volantini, promozioni e punti vendita della tua catena' },
  { ...FP_BASE, tipo_utente: TIPO_UTENTI.GDO, ruolo_gdo: RUOLO_UTENTE_GDO.DEVELOPER, descrizione: 'Gestisci volantini, promozioni e punti vendita della tua catena' },
  { ...FP_BASE, tipo_utente: TIPO_UTENTI.PUNTOVENDITA, ruolo_gdo: null, descrizione: 'Visualizza promozioni e materiali per il tuo punto vendita' },
  { ...FP_BASE, tipo_utente: TIPO_UTENTI.GUEST, ruolo_gdo: null, descrizione: 'Consulta le promozioni disponibili' },
  { ...FP_BASE, tipo_utente: TIPO_UTENTI.CATEGORY, ruolo_gdo: null, descrizione: 'Gestione promozioni e volantini' },
] as const;
