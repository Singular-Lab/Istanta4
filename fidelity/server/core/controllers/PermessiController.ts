import { Request, Response } from 'express';
import { PERMESSI } from '../../../lib/accessi/catalogo';
import { TIPO_UTENTI } from '../../../lib/enums';
import { UnauthorizedError } from '../../../lib/errors';
import { leggiContestoAccesso } from '../accessi/contestoAccesso';
import { BaseController } from '../base/BaseController';
import type { AmbitoPermessi, IPermessiService, ModificaPermesso } from '../interfaces/IPermessiService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';

const testo = (valore: unknown): string | null =>
  typeof valore === 'string' && valore.length > 0 ? valore : null;

export class PermessiController extends BaseController {
  constructor(private readonly permessiService: IPermessiService) {
    super('/api/permessi');
  }

  protected setupRoutes(): void {
    const gestione = [authMiddleware, permissionGuard(PERMESSI.SISTEMA.GESTISCI_ACCESSI)];

    // Permessi effettivi dell'utente collegato (menu, pulsanti, pagine nel client)
    this.router.get('/effettivi', authMiddleware, this.getPermessiEffettivi.bind(this));

    // Gestione accessi (solo Superadmin: permesso di sistema)
    this.router.get('/ruoli', ...gestione, this.getRuoli.bind(this));
    this.router.get('/configurazione', ...gestione, this.getConfigurazione.bind(this));
    this.router.put('/configurazione', ...gestione, this.salvaConfigurazione.bind(this));
    this.router.delete('/override', ...gestione, this.ripristinaOverride.bind(this));
    this.router.get('/confronto', ...gestione, this.getConfronto.bind(this));
  }

  private ambitoDa(sorgente: Record<string, unknown>): AmbitoPermessi {
    return {
      tipo: testo(sorgente.tipo) as TIPO_UTENTI,
      idRuoloGdo: testo(sorgente.ruoloGdo),
      idGdo: testo(sorgente.gdo),
    };
  }

  private async getPermessiEffettivi(req: Request, res: Response): Promise<void> {
    try {
      const contesto = await leggiContestoAccesso(req, res);
      if (!contesto) throw new UnauthorizedError({ message: 'Sessione non valida' });
      const permessi = await this.permessiService.getPermessiEffettivi(contesto);
      this.sendResponse(res, 200, { permessi, superadmin: contesto.superadmin });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getRuoli(_req: Request, res: Response): Promise<void> {
    try {
      this.sendResponse(res, 200, await this.permessiService.getRuoliGestibili());
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getConfigurazione(req: Request, res: Response): Promise<void> {
    try {
      const ambito = this.ambitoDa(req.query as Record<string, unknown>);
      this.sendResponse(res, 200, await this.permessiService.getConfigurazione(ambito));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async salvaConfigurazione(req: Request, res: Response): Promise<void> {
    try {
      const corpo = (req.body ?? {}) as Record<string, unknown>;
      const modifiche = corpo.modifiche as ModificaPermesso[] | undefined;
      if (!Array.isArray(modifiche) || modifiche.some(m => typeof m?.codice !== 'string' || (m.abilitato !== null && typeof m.abilitato !== 'boolean'))) {
        return this.sendResponse(res, 400, { message: 'Formato delle modifiche non valido' });
      }
      const configurazione = await this.permessiService.salvaConfigurazione(this.ambitoDa(corpo), modifiche);
      this.sendResponse(res, 200, configurazione);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async ripristinaOverride(req: Request, res: Response): Promise<void> {
    try {
      const ambito = this.ambitoDa(req.query as Record<string, unknown>);
      if (!ambito.idGdo) {
        return this.sendResponse(res, 400, { message: 'Indicare la GDO di cui ripristinare gli override' });
      }
      const rimossi = await this.permessiService.ripristinaOverride({ ...ambito, idGdo: ambito.idGdo });
      this.sendResponse(res, 200, { rimossi });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getConfronto(req: Request, res: Response): Promise<void> {
    try {
      this.sendResponse(res, 200, await this.permessiService.getConfronto(testo(req.query.gdo)));
    } catch (error) {
      this.handleError(res, error);
    }
  }
}
