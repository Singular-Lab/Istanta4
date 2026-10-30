import { Request, Response } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import { BadRequestError } from '../../../lib/errors';
import { gdoOperativaPerRichiesta } from '../accessi/contestoAccesso';
import { BaseController } from '../base/BaseController';
import type { IConsultazionePuntiVenditaService } from '../interfaces/IConsultazionePuntiVenditaService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';

/**
 * Consultazione dei punti vendita (pagine /punti-vendita), in sola lettura e con "gdo.visualizza".
 * Contratto in lib/puntiVendita/consultazione.ts. La GDO e' sempre quella della sessione: la
 * richiesta non puo' indicarne un'altra.
 *
 * Sullo stesso percorso base la storia del punto vendita (/:id/storia, /storia/import-export)
 * ha il suo controller: qui solo percorsi esatti, che non la coprono.
 */
export class ConsultazionePuntiVenditaController extends BaseController {
  constructor(private readonly consultazioneService: IConsultazionePuntiVenditaService) {
    super('/api/punti-vendita');
  }

  protected setupRoutes(): void {
    const visualizza = [authMiddleware, permissionGuard('gdo.visualizza')];

    this.router.get('/', ...visualizza, this.elenca.bind(this));
    this.router.get('/:id', ...visualizza, this.dettaglio.bind(this));
    this.router.get('/:id/volantini-attivi', ...visualizza, this.volantiniAttivi.bind(this));
  }

  private async gdoDellaSessione(req: Request, res: Response): Promise<string> {
    const idGdo = await gdoOperativaPerRichiesta(req, res);
    if (!idGdo) throw new BadRequestError({ message: 'GDO non specificata' });
    return idGdo;
  }

  private async elenca(req: Request, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.consultazioneService.elenca(idGdo));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async dettaglio(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.consultazioneService.dettaglio(idGdo, req.params.id));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async volantiniAttivi(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.consultazioneService.volantiniAttivi(idGdo, req.params.id));
    } catch (error) {
      this.handleError(res, error);
    }
  }
}
