/**
 * Route senza chiamanti noti, marcate con il middleware routeDeprecata (T8, 2026-10-29).
 *
 * L'inventario delle route (frontend, plugin, Istanta, IdP, documentazione pubblica, infrastruttura)
 * non ha trovato nessuno che le chiami. Prima di toglierle si osserva per 30 giorni se qualcuno
 * le usa davvero: ogni chiamata autenticata incrementa api_route_senza_chiamanti_total{method,route}
 * e scrive un avviso nel log (al massimo uno ogni 15 minuti per route).
 *
 * Dopo il {@link RIMUOVIBILI_DAL}: le route con contatore a zero si rimuovono (route, gestore, metodi
 * del servizio usati solo da lei e la voce qui sotto); quelle chiamate vanno capite prima di decidere.
 *
 * Non marcare le route chiamate da altri sistemi anche se l'inventario non ne trova traccia
 * (Istanta, plugin /api/external/*, /api/auth/ephemeral/*, IdP, display, /health, /metrics, WebPliant
 * pubblico): il loro nome e' un contratto. Il censimento in __tests__/routeSenzaChiamanti.test.ts
 * confronta questo elenco con le route che montano davvero il middleware.
 */

export type MetodoHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RouteSenzaChiamanti {
  metodo: MetodoHttp;
  /** Pattern completo, come lo registra Express: base del controller + percorso della route. */
  percorso: string;
  motivo: string;
}

export const MARCATE_IL = '2026-10-29';
export const RIMUOVIBILI_DAL = '2026-11-28';

const LEGACY = 'Nessun chiamante nel frontend, nel plugin, nei sistemi esterni o nella documentazione pubblica (inventario T8)';
const INDIRETTA = 'L\'unico chiamante (hook o loader del frontend mai usato) e\' stato rimosso in T8';

export const ROUTE_SENZA_CHIAMANTI: readonly RouteSenzaChiamanti[] = [
  // ─── Legacy: nessun chiamante trovato ───────────────────────────────────────
  { metodo: 'PUT', percorso: '/api/mark_as_unread', motivo: LEGACY },
  { metodo: 'POST', percorso: '/api/saveConfig', motivo: LEGACY },
  { metodo: 'POST', percorso: '/api/saveDashBoardConfig', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/getDashBoardConfig', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/getPluginRegistry', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/getAllKitDesignNoManuale', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/display-contexts/:id', motivo: LEGACY },
  { metodo: 'POST', percorso: '/api/auth/ephemeral/revoke', motivo: LEGACY },
  { metodo: 'PUT', percorso: '/api/get_all_files_documentale', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/getProprietaMetaFilesRuntime', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/getContenutoDigitali', motivo: LEGACY },
  { metodo: 'POST', percorso: '/api/downloadPromoZip', motivo: LEGACY },
  { metodo: 'PUT', percorso: '/api/genera_ricetta_corta', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/get_all_ricette', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/getGDOById/:id', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/getGDOByUtenteId', motivo: LEGACY },
  { metodo: 'PUT', percorso: '/api/salvaGestionePagineSingular', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/getCombinazioniDaIstanta/:id', motivo: LEGACY },
  { metodo: 'PUT', percorso: '/api/avvioRevisioneKitManuale', motivo: LEGACY },
  { metodo: 'PUT', percorso: '/api/riportaInLavorazione', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/get_all_kit_runtime_by_promo/:idPromo', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/log/list', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/log/audit', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/log/history', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/log/view/:filename', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/log/stats', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/log/search', motivo: LEGACY },
  { metodo: 'DELETE', percorso: '/api/log/clear/:filename', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/log/latest', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/promo/dashboard', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/promo/nome/:nomePromo', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/getAllPVFromIdGDO_paginated', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/dispositivo/:id', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/resolveImmaginiGruppo', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/getReferenzaById', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/getDatiPerWebPliantDisponibili', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/getTipoExportById/:id', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/tracciati', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/tracciati/confronto/contesto', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/tracciati/confronto/reports', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/tracciati/confronto/reports/:id', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/check-user', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/prendiIVolantiniCaricatiDaDB', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/tuttiIWorkspaceDaGDO', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/webhooks/:webhookId', motivo: LEGACY },
  { metodo: 'POST', percorso: '/api/webhooks/scatena-evento', motivo: LEGACY },
  { metodo: 'GET', percorso: '/api/whatsapp/campaigns/:bulkId/status', motivo: LEGACY },

  // ─── Morte indirettamente: chiamate solo da codice del frontend rimosso in T8 ─
  { metodo: 'GET', percorso: '/api/getGestionePagineSingular', motivo: `${INDIRETTA}: funzioneCaricamentoGestionePagineSingular` },
  { metodo: 'GET', percorso: '/api/display-contexts/gdo/:id_gdo', motivo: `${INDIRETTA}: useFetchDisplayContextsByGDO` },
  { metodo: 'GET', percorso: '/api/external/filter-templates/by-endpoint-type/:endpointType', motivo: `${INDIRETTA}: useFetchFilterTemplates (solo sessione, non e' un'API del plugin)` },
  { metodo: 'POST', percorso: '/api/external/filter-templates/validate-slug', motivo: `${INDIRETTA}: useValidateFilterTemplateSlug (solo sessione, non e' un'API del plugin)` },
  { metodo: 'GET', percorso: '/api/get_kit_runtime_by_promo/:idPromo', motivo: `${INDIRETTA}: useFetchKitRuntimeByPromo` },
  { metodo: 'GET', percorso: '/api/promo/filtered', motivo: `${INDIRETTA}: useFetchPromoFiltered` },
  { metodo: 'POST', percorso: '/api/scoreboard/multi-promo', motivo: `${INDIRETTA}: useCalcolaMultiPromoScoreboard` },
  { metodo: 'POST', percorso: '/api/scoreboard/query', motivo: `${INDIRETTA}: useCalcolaQueryScoreboard` },
  { metodo: 'GET', percorso: '/api/get_all_utenti', motivo: `${INDIRETTA}: useFetchAllUtenti` },

  // ─── Rimasta senza chiamanti: risposta 501, unione tolta dal frontend in T8 ─────
  { metodo: 'POST', percorso: '/api/mergeFiles', motivo: 'Risponde 501 (unione non implementata) e il confronto/unione dei file e\' stato tolto dal frontend in T8; il permesso file.merge resta nel catalogo' },
];

/** Chiave "METODO /pattern", la stessa che usa il middleware. */
export function chiaveRoute(metodo: string, percorso: string): string {
  return `${metodo.toUpperCase()} ${percorso}`;
}
