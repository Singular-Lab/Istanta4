import type { NextFunction, Request, RequestHandler, Response } from 'express';
import client, { type Counter } from 'prom-client';
import { log } from '../logger';
import { chiaveRoute, MARCATE_IL } from './routeSenzaChiamanti';

/**
 * Segna le route che l'inventario non vede chiamare da nessuno (elenco e motivi in
 * routeSenzaChiamanti.ts): non cambia la risposta, conta le chiamate e lo scrive nel log.
 *
 * Va messo DOPO le protezioni (authMiddleware, permissionGuard...) e prima del gestore: cosi'
 * conta solo chi entra davvero, non gli scanner che provano gli URL, e non tocca l'autenticazione
 * ne' i censimenti che leggono le protezioni in testa alla catena.
 */

export const NOME_CONTATORE = 'api_route_senza_chiamanti_total';

/** Un avviso per route ogni 15 minuti: il contatore conta tutto, il log dice chi chiama. */
export const INTERVALLO_AVVISI_MS = 15 * 60 * 1000;

type EtichetteContatore = 'method' | 'route';

/** Stesso registro di /metrics; se il modulo viene ricaricato (test) si riusa il contatore gia' registrato. */
function contatoreRouteSenzaChiamanti(): Counter<EtichetteContatore> {
  const esistente = client.register.getSingleMetric(NOME_CONTATORE);
  if (esistente) return esistente as Counter<EtichetteContatore>;
  return new client.Counter({
    name: NOME_CONTATORE,
    help: 'Chiamate alle route senza chiamanti noti, candidate alla rimozione (server/core/middleware/routeSenzaChiamanti.ts)',
    labelNames: ['method', 'route'],
    registers: [client.register],
  });
}

export const contatoreChiamate = contatoreRouteSenzaChiamanti();

/** Pattern della route che sta rispondendo (es. /api/log/view/:filename), mai l'URL concreto. */
function patternRoute(req: Request): string {
  const percorso: unknown = req.route?.path;
  return `${req.baseUrl ?? ''}${percorso === undefined || percorso === null ? req.path : String(percorso)}`;
}

interface OpzioniRouteDeprecata {
  intervalloAvvisiMs?: number;
  ora?: () => number;
}

export function creaRouteDeprecata({ intervalloAvvisiMs = INTERVALLO_AVVISI_MS, ora = Date.now }: OpzioniRouteDeprecata = {}): RequestHandler {
  // Per route: quando e' partito l'ultimo avviso e quante chiamate da allora
  const avvisi = new Map<string, { ultimo: number; chiamateDallUltimoAvviso: number }>();

  return function routeDeprecata(req: Request, _res: Response, next: NextFunction): void {
    const route = patternRoute(req);
    contatoreChiamate.inc({ method: req.method, route });

    const chiave = chiaveRoute(req.method, route);
    const adesso = ora();
    const stato = avvisi.get(chiave);
    if (stato && adesso - stato.ultimo < intervalloAvvisiMs) {
      stato.chiamateDallUltimoAvviso++;
    } else {
      // Solo chi chiama (tipo utente, GDO, come si e' autenticato): nessun dato personale
      log.warn('Chiamata a una route senza chiamanti noti, candidata alla rimozione', {
        context: 'RouteSenzaChiamanti',
        metodo: req.method,
        route,
        tipoUtente: req.session?.tipo_utente,
        idGdo: req.session?.id_gdo,
        chiamateNonRiportate: stato?.chiamateDallUltimoAvviso ?? 0,
        marcataIl: MARCATE_IL,
      });
      avvisi.set(chiave, { ultimo: adesso, chiamateDallUltimoAvviso: 0 });
    }
    next();
  };
}

/** Il middleware da mettere sulle route elencate in routeSenzaChiamanti.ts. */
export const routeDeprecata = creaRouteDeprecata();
