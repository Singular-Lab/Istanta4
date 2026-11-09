import type { Request, Response } from 'express';
import { PERMESSI } from '../../../lib/accessi/catalogo';
import { HttpStatusCode } from '../../../lib/enums';
import { BadRequestError } from '../../../lib/errors';
import { ambitoGdoDellaRichiesta, type AmbitoGdo } from '../accessi/contestoAccesso';
import { BaseController } from '../base/BaseController';
import type { IInsightConfrontiService } from '../interfaces/IInsightConfrontiService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { CHIAVE_PRODOTTO } from '../services/AnalisiKitService';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Confronti degli insight del volantino (contratto in lib/insightVolantino/tipi.ts): edizione
 * precedente e varianti, differenze con un'altra variante, viaggio di un prodotto. Si leggono con
 * "materiali.visualizza", come la scheda degli insight, nell'ambito GDO della sessione (superadmin e
 * agenzia: tutte, o quella in ?gdo=).
 *
 * La scheda (GET /api/flyer-insights/:guidIdKitRuntime, VolantinoController) ha un solo segmento dopo
 * /flyer-insights: nessuno di questi percorsi, che ne hanno due o tre, finisce li', in qualunque
 * ordine siano registrati i due controller.
 */
export class InsightConfrontiController extends BaseController {
  constructor(private readonly confronti: IInsightConfrontiService) {
    super('/api');
  }

  protected setupRoutes(): void {
    const visualizza = [authMiddleware, permissionGuard(PERMESSI.MATERIALI.VISUALIZZA)];

    this.router.get('/flyer-insights/:idKit/confronti', ...visualizza, this.getConfronti.bind(this));
    this.router.get('/flyer-insights/:idKit/varianti/:idAltra', ...visualizza, this.getVarianti.bind(this));
    this.router.get('/flyer-insights/:idKit/prodotti/:chiave', ...visualizza, this.getViaggio.bind(this));
  }

  /**
   * Controlla i parametri prima di leggere la sessione: una richiesta malformata e' 400 senza
   * toccare il database. Poi la risposta JSON del lavoro, o l'errore.
   */
  private async rispondi(req: Request, res: Response, valida: () => void, lavoro: (ambito: AmbitoGdo) => Promise<unknown>): Promise<void> {
    try {
      valida();
      const ambito = await ambitoGdoDellaRichiesta(req, res, req.query.gdo);
      this.sendResponse(res, HttpStatusCode.OK, await lavoro(ambito));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private getConfronti(req: Request<{ idKit: string }>, res: Response): Promise<void> {
    const { idKit } = req.params;
    return this.rispondi(req, res, () => idKitValido(idKit), ambito => this.confronti.confronti(idKit, ambito));
  }

  private getVarianti(req: Request<{ idKit: string; idAltra: string }>, res: Response): Promise<void> {
    const { idKit, idAltra } = req.params;
    return this.rispondi(
      req,
      res,
      () => {
        idKitValido(idKit);
        idKitValido(idAltra, 'Variante non valida');
      },
      ambito => this.confronti.differenzeVarianti(idKit, idAltra, ambito),
    );
  }

  private getViaggio(req: Request<{ idKit: string; chiave: string }>, res: Response): Promise<void> {
    const { idKit, chiave } = req.params;
    return this.rispondi(
      req,
      res,
      () => {
        idKitValido(idKit);
        if (!CHIAVE_PRODOTTO.test(chiave)) throw new BadRequestError({ message: 'Prodotto non valido' });
      },
      ambito => this.confronti.viaggioProdotto(idKit, chiave, ambito),
    );
  }
}

function idKitValido(id: string, messaggio = 'Volantino non valido'): void {
  if (!UUID.test(id)) throw new BadRequestError({ message: `${messaggio}: serve l'id del kit` });
}
