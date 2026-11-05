import type { Request, Response } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import { gdoOperativaPerRichiesta, operaPerPiuGdo } from '../accessi/contestoAccesso';
import { BaseController } from '../base/BaseController';
import type { IAvanzamentoProduzioneService } from '../interfaces/IAvanzamentoProduzioneService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';

/**
 * Pagina Avanzamento produzione (contratto in lib/produzione/avanzamento.ts): le promo in corso
 * della GDO della sessione con i loro kit, per chi può vedere i kit in lavorazione.
 */
export class AvanzamentoProduzioneController extends BaseController {
  constructor(private readonly avanzamento: IAvanzamentoProduzioneService) {
    super('/api/produzione');
  }

  protected setupRoutes(): void {
    this.router.get('/avanzamento', authMiddleware, permissionGuard('kit_runtime.visualizza'), this.getAvanzamento.bind(this));
  }

  /**
   * Sempre la GDO della sessione, qualunque cosa arrivi nella richiesta. Senza GDO chi lavora per
   * più GDO (Superadmin, Agenzia) vede tutte le promo, gli altri nessuna.
   */
  private async getAvanzamento(req: Request, res: Response): Promise<void> {
    try {
      const idGdo = await gdoOperativaPerRichiesta(req, res);
      if (!idGdo && !operaPerPiuGdo(req.session?.tipo_utente)) {
        this.sendResponse(res, HttpStatusCode.OK, { promozioni: [] });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, await this.avanzamento.getAvanzamento(idGdo, req));
    } catch (error) {
      this.handleError(res, error);
    }
  }
}
