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
 * Il viaggio di un prodotto negli insight del volantino (contratto in lib/insightVolantino/tipi.ts).
 * Si legge con "materiali.visualizza", come la scheda degli insight, nell'ambito GDO della sessione
 * (superadmin e agenzia: tutte, o quella in ?gdo=). La pagina non confronta piu' il volantino con
 * l'edizione precedente ne' con le altre varianti: il confronto con l'edizione precedente resta nel
 * report PDF (InsightReportController).
 *
 * La scheda (GET /api/flyer-insights/:guidIdKitRuntime, VolantinoController) ha un solo segmento dopo
 * /flyer-insights: questo percorso, che ne ha tre, non finisce li', in qualunque ordine siano
 * registrati i due controller.
 */
export class InsightConfrontiController extends BaseController {
  constructor(private readonly confronti: IInsightConfrontiService) {
    super('/api');
  }

  protected setupRoutes(): void {
    const visualizza = [authMiddleware, permissionGuard(PERMESSI.MATERIALI.VISUALIZZA)];

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

function idKitValido(id: string): void {
  if (!UUID.test(id)) throw new BadRequestError({ message: "Volantino non valido: serve l'id del kit" });
}
