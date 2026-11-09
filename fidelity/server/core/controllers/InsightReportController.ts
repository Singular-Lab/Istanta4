import type { Request, Response } from 'express';
import { PERMESSI } from '../../../lib/accessi/catalogo';
import { HttpStatusCode } from '../../../lib/enums';
import { BadRequestError } from '../../../lib/errors';
import { ambitoGdoDellaRichiesta } from '../accessi/contestoAccesso';
import { BaseController } from '../base/BaseController';
import type { IReportVolantinoService } from '../interfaces/IReportVolantinoService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Report PDF del volantino (contratto in lib/insightVolantino/report.ts): dati e sezioni del report,
 * che il browser impagina. Si legge con "materiali.visualizza", come la scheda degli insight, nell'ambito
 * GDO della sessione (superadmin e agenzia: tutte, o quella in ?gdo=); un kit fuori ambito e' 404.
 *
 * Due segmenti dopo /flyer-insights: non si confonde con la scheda (GET /api/flyer-insights/:id,
 * VolantinoController), in qualunque ordine siano registrati i controller.
 */
export class InsightReportController extends BaseController {
  constructor(private readonly reportVolantino: IReportVolantinoService) {
    super('/api');
  }

  protected setupRoutes(): void {
    this.router.get(
      '/flyer-insights/:idKit/report',
      authMiddleware,
      permissionGuard(PERMESSI.MATERIALI.VISUALIZZA),
      this.getReport.bind(this),
    );
  }

  /** L'id del kit si controlla prima di leggere la sessione: un id malformato e' 400 senza toccare il database. */
  private async getReport(req: Request<{ idKit: string }>, res: Response): Promise<void> {
    try {
      const { idKit } = req.params;
      if (!UUID.test(idKit)) throw new BadRequestError({ message: "Volantino non valido: serve l'id del kit" });
      const ambito = await ambitoGdoDellaRichiesta(req, res, req.query.gdo);
      this.sendResponse(res, HttpStatusCode.OK, await this.reportVolantino.report(idKit, ambito));
    } catch (error) {
      this.handleError(res, error);
    }
  }
}
