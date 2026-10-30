import type { Request, Response } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import { BadRequestError, NotFoundError } from '../../../lib/errors';
import { gdoOperativaPerRichiesta, operaPerPiuGdo } from '../accessi/contestoAccesso';
import { BaseController } from '../base/BaseController';
import type { IAnalisiPuntoVenditaService } from '../interfaces/IAnalisiPuntoVenditaService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';

const numero = (valore: unknown): number | undefined => {
  if (typeof valore !== 'string' || valore.trim() === '') return undefined;
  const intero = Number.parseInt(valore, 10);
  return Number.isFinite(intero) ? intero : undefined;
};

/**
 * Le pagine del punto vendita costruite sulla timeline dei volantini (contratto in
 * lib/puntiVendita/analisi.ts). Letture con "gdo.visualizza"; la qualita' dei dati e le righe
 * dei volantini non abbinate con "gdo.gestisci_punti_vendita".
 *
 * Sullo stesso percorso base ci sono la consultazione ('/', '/:id', '/:id/volantini-attivi') e la
 * storia ('/:id/storia', '/:id/storia/volantini', '/storia/import-export'): nessuno dei loro
 * percorsi copre questi, e in routes.ts questo controller e' registrato prima, cosi' '/rete/...' e
 * '/gestione/...' non finiscono mai in un '/:id'.
 */
export class AnalisiPuntoVenditaController extends BaseController {
  constructor(private readonly analisi: IAnalisiPuntoVenditaService) {
    super('/api/punti-vendita');
  }

  protected setupRoutes(): void {
    const visualizza = [authMiddleware, permissionGuard('gdo.visualizza')];
    const gestisci = [authMiddleware, permissionGuard('gdo.gestisci_punti_vendita')];

    this.router.get('/rete/insegne', ...visualizza, this.getReteInsegne.bind(this));
    this.router.get('/gestione/qualita', ...gestisci, this.getQualita.bind(this));
    this.router.get('/gestione/righe-non-abbinate', ...gestisci, this.getRigheNonAbbinate.bind(this));
    this.router.get('/:id/analisi', ...visualizza, this.getAnalisi.bind(this));
    this.router.get('/:id/volantini/:idKit', ...visualizza, this.getVolantino.bind(this));
    this.router.get('/:id/referenze/:chiave', ...visualizza, this.getReferenza.bind(this));
  }

  /**
   * GDO in cui cercare il PV, come nella storia: quella dell'utente; senza GDO chi lavora per piu'
   * GDO (Superadmin, Agenzia) le vede tutte (null), gli altri nessun PV (404).
   */
  private async gdoDelPuntoVendita(req: Request<{ id: string }>, res: Response): Promise<string | null> {
    const idGdo = await gdoOperativaPerRichiesta(req, res);
    if (idGdo) return idGdo;
    if (operaPerPiuGdo(req.session?.tipo_utente)) return null;
    throw new NotFoundError({ message: 'Punto vendita non trovato', entityType: 'PuntoVendita', entityId: req.params.id });
  }

  /** Rete e gestione sono della GDO della sessione: la richiesta non puo' indicarne un'altra. */
  private async gdoDellaSessione(req: Request, res: Response): Promise<string> {
    const idGdo = await gdoOperativaPerRichiesta(req, res);
    if (!idGdo) throw new BadRequestError({ message: 'GDO non specificata' });
    return idGdo;
  }

  private async getAnalisi(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDelPuntoVendita(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.analisi.analisi(req.params.id, idGdo));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getVolantino(req: Request<{ id: string; idKit: string }>, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDelPuntoVendita(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.analisi.volantino(req.params.id, req.params.idKit, idGdo));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getReferenza(req: Request<{ id: string; chiave: string }>, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDelPuntoVendita(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.analisi.referenza(req.params.id, req.params.chiave, idGdo));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getReteInsegne(req: Request, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.analisi.reteInsegne(idGdo));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getQualita(req: Request, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.analisi.qualita(idGdo));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getRigheNonAbbinate(req: Request, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      const pagina = numero(req.query.pagina);
      const dimensione = numero(req.query.dimensione);
      this.sendResponse(res, HttpStatusCode.OK, await this.analisi.righeNonAbbinate(idGdo, pagina, dimensione));
    } catch (error) {
      this.handleError(res, error);
    }
  }
}
