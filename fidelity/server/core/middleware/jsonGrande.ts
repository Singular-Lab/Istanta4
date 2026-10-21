import express, { NextFunction, Request, Response } from 'express';

/**
 * Route che ricevono immagini e video in base64 nel body JSON. Il parser globale
 * (10MB) le salta; ognuna monta jsonGrande dopo autenticazione e permesso, cosi'
 * un body enorme non viene letto prima di sapere chi lo manda.
 */
export const ROUTE_JSON_GRANDE = new Set([
  '/api/salva_workspace_webpliant',
  '/api/saveWebpliantConfig'
]);

export const jsonGrande = express.json({ limit: '200mb' });

const jsonFinoA10MB = express.json({ limit: '10mb' });

/** Parser JSON di tutta l'app: gira prima dell'autenticazione, quindi con un limite basso. */
export function jsonGlobale(req: Request, res: Response, next: NextFunction) {
  if (ROUTE_JSON_GRANDE.has(req.path)) {
    return next();
  }
  return jsonFinoA10MB(req, res, next);
}
