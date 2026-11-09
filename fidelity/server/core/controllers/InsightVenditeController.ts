import type { Request, Response } from 'express';
import { PERMESSI } from '../../../lib/accessi/catalogo';
import { HttpStatusCode } from '../../../lib/enums';
import { ValidationError } from '../../../lib/errors';
import type { RichiestaSimulazione } from '../../../lib/insightVolantino/rendimento';
import { ambitoGdoDellaRichiesta, type AmbitoGdo } from '../accessi/contestoAccesso';
import { BaseController } from '../base/BaseController';
import type { IInsightVenditeService } from '../interfaces/IInsightVenditeService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { CHIAVE_PRODOTTO } from '../services/AnalisiKitService';
import { erroreSimulazione } from '../utils/previsioneInsight';

/**
 * Rendimento dalle vendite, previsione e simulazione degli insight del volantino (contratto in
 * lib/insightVolantino/rendimento.ts). Si leggono con "materiali.visualizza", come la scheda e i
 * confronti degli insight, nell'ambito GDO della sessione (superadmin e agenzia: tutte, o quella in
 * ?gdo=). Un kit fuori ambito, o un id che non e' un kit, risponde 404 dal servizio.
 *
 * Tutti i percorsi hanno due segmenti dopo /flyer-insights e un nome fisso nel secondo (vendite,
 * previsione, simulazione): non finiscono nella scheda (/flyer-insights/:id, un segmento) ne' nei
 * confronti (confronti, varianti/:id, prodotti/:chiave), in qualunque ordine siano registrati.
 */
export class InsightVenditeController extends BaseController {
  constructor(private readonly vendite: IInsightVenditeService) {
    super('/api');
  }

  protected setupRoutes(): void {
    const visualizza = [authMiddleware, permissionGuard(PERMESSI.MATERIALI.VISUALIZZA)];

    this.router.get('/flyer-insights/:idKit/vendite', ...visualizza, this.getRendimento.bind(this));
    this.router.get('/flyer-insights/:idKit/previsione', ...visualizza, this.getPrevisione.bind(this));
    this.router.get('/flyer-insights/:idKit/simulazione', ...visualizza, this.getSimulazione.bind(this));
  }

  /**
   * Controlla i parametri prima di leggere la sessione: una richiesta malformata e' 400 senza
   * toccare il database. Poi la risposta JSON del lavoro (anche null), o l'errore.
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

  private getRendimento(req: Request<{ idKit: string }>, res: Response): Promise<void> {
    const { idKit } = req.params;
    return this.rispondi(req, res, () => undefined, ambito => this.vendite.rendimento(idKit, ambito));
  }

  private getPrevisione(req: Request<{ idKit: string }>, res: Response): Promise<void> {
    const { idKit } = req.params;
    return this.rispondi(req, res, () => undefined, ambito => this.vendite.previsione(idKit, ambito));
  }

  private getSimulazione(req: Request<{ idKit: string }>, res: Response): Promise<void> {
    const { idKit } = req.params;
    const richiesta = richiestaDallaQuery(req.query);
    return this.rispondi(
      req,
      res,
      () => {
        const errore = erroreSimulazione(richiesta) ?? (CHIAVE_PRODOTTO.test(richiesta.chiave) ? null : 'Prodotto non valido');
        if (errore) throw new ValidationError({ message: errore, field: 'simulazione' });
      },
      ambito => this.vendite.simula(idKit, richiesta, ambito),
    );
  }
}

/**
 * La simulazione dalla query (?chiave=&pagina=&x=&y=&spazio=&sconto=): numeri come testo, sconto
 * facoltativo (assente o vuoto = senza sconto). Un valore mancante, ripetuto o che non e' un numero
 * diventa NaN e la validazione lo rifiuta.
 */
export function richiestaDallaQuery(query: Request['query']): RichiestaSimulazione {
  const testo = (nome: string): string => {
    const valore = query[nome];
    return typeof valore === 'string' ? valore.trim() : '';
  };
  const numero = (nome: string): number => {
    const valore = testo(nome);
    return valore === '' ? Number.NaN : Number(valore);
  };
  const sconto = query.sconto;
  const senzaSconto = sconto === undefined || (typeof sconto === 'string' && sconto.trim() === '');
  return {
    chiave: testo('chiave'),
    pagina: numero('pagina'),
    x: numero('x'),
    y: numero('y'),
    spazio: numero('spazio'),
    sconto: senzaSconto ? null : numero('sconto'),
  };
}
