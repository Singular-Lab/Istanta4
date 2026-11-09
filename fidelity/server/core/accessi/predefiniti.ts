import { RUOLO_UTENTE_GDO, TIPO_UTENTI } from '../../../lib/enums';
import { CodicePermesso, PERMESSI as P } from '../../../lib/accessi/catalogo';
import { presetDi } from '../../../lib/accessi/preset';

/**
 * Permessi con cui nasce un'installazione nuova (catalogo vuoto).
 * Il Superadmin non compare: ha sempre tutti i permessi. Agenzia, Category e Marketing nascono dai
 * preset della gestione accessi (lib/accessi/preset.ts).
 * Su un'installazione esistente valgono i permessi salvati, non questi.
 */
export const PERMESSI_PREDEFINITI: Partial<Record<TIPO_UTENTI, CodicePermesso[]>> = {
  // Produzione e Gestione interna, senza Visualizzazione ne' Comunicazione (D9)
  [TIPO_UTENTI.AGENZIA]: presetDi('agenzia').permessi,
  [TIPO_UTENTI.GDO]: [
    P.PROMO.VISUALIZZA,
    P.KIT_RUNTIME.VISUALIZZA,
    P.DESIGN_KIT.VISUALIZZA,
    P.RACCOGLITORE_KIT.VISUALIZZA,
    P.FILE.DOWNLOAD,
    P.MATERIALI.VISUALIZZA, P.MATERIALI.SCARICA, P.VOLANTINI.VISUALIZZA,
    P.ANALISI.VISUALIZZA,
    P.ORDINI_STAMPA.VISUALIZZA, P.ORDINI_STAMPA.DOWNLOAD_REPORT,
    P.WEBPLIANT.VISUALIZZA,
    P.REFERENZE.VISUALIZZA,
    P.UTENTI.VISUALIZZA,
    P.WHATSAPP.VISUALIZZA_CAMPAGNE, P.WHATSAPP.INVIA_CAMPAGNA, P.WHATSAPP.ANNULLA_CAMPAGNA, P.WHATSAPP.GESTISCI_PRESETS,
    P.GDO.VISUALIZZA, P.GDO.GESTISCI_PUNTI_VENDITA, P.GDO.GESTISCI_AREE_CANALI,
    P.AI.GESTISCI_RICETTE, P.AI.GESTISCI_VINI,
    P.API.VISUALIZZA_STATISTICHE,
  ],
  [TIPO_UTENTI.PUNTOVENDITA]: [
    P.PROMO.VISUALIZZA,
    P.KIT_RUNTIME.VISUALIZZA,
    P.FILE.DOWNLOAD,
    P.MATERIALI.VISUALIZZA, P.MATERIALI.SCARICA, P.VOLANTINI.VISUALIZZA,
    P.WEBPLIANT.VISUALIZZA,
    P.REFERENZE.VISUALIZZA,
    P.STRUMENTI.VISUALIZZA,
  ],
  // Consultano i dati dei volantini e non seguono la produzione (D2)
  [TIPO_UTENTI.CATEGORY]: presetDi('solo-visualizzazione').permessi,
  [TIPO_UTENTI.MARKETING]: presetDi('solo-visualizzazione').permessi,
  [TIPO_UTENTI.GUEST]: [
    P.PROMO.VISUALIZZA,
    P.KIT_RUNTIME.VISUALIZZA,
    P.VOLANTINI.VISUALIZZA,
  ],
};

/**
 * Permessi in piu' per un sotto-ruolo GDO, oltre a quelli del tipo GDO: l'import delle vendite del
 * cliente all'ADMIN della GDO. Su un'installazione nuova li scrive scriviPredefiniti; a quelle
 * esistenti li concede una volta la preparazione degli accessi (migrazioneVendite.ts, schema 3).
 * Il Superadmin non compare: ha sempre tutti i permessi.
 */
export const PERMESSI_PREDEFINITI_SOTTORUOLO_GDO: Partial<Record<RUOLO_UTENTE_GDO, CodicePermesso[]>> = {
  [RUOLO_UTENTE_GDO.ADMIN]: [P.ANALISI.IMPORTA_VENDITE],
};

/** "GDO_ADMIN", " admin " e "ADMIN" sono lo stesso sotto-ruolo, come nella migrazione del menu. */
export const normalizzaNomeSottoRuolo = (nome: string): string => (nome ?? '').trim().toUpperCase().replace(/^GDO_/, '');

/** I permessi in piu' di un sotto-ruolo GDO dal suo nome in ruolo_utente_gdo; nessuno se non ne ha. */
export const permessiPredefinitiDelSottoRuolo = (nome: string): CodicePermesso[] =>
  PERMESSI_PREDEFINITI_SOTTORUOLO_GDO[normalizzaNomeSottoRuolo(nome) as RUOLO_UTENTE_GDO] ?? [];
