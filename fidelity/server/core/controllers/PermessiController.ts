import { Request, Response } from 'express';
import { TIPO_UTENTI } from '../../../lib/enums';
import { BaseController } from '../base/BaseController';
import type { IPermessiService } from '../interfaces/IPermessiService';
import { authMiddleware } from '../middleware/authMiddleware';
import { invalidatePermissionCache, permissionGuard } from '../middleware/permissionGuard';

export class PermessiController extends BaseController {
  private permessiService: IPermessiService;

  constructor(permessiService: IPermessiService) {
    super('/api/permessi');
    this.permessiService = permessiService;
  }

  protected setupRoutes(): void {
    // Catalogo permessi (tutti gli autenticati)
    this.router.get('/', authMiddleware, this.getAllPermessi.bind(this));

    // Permessi effettivi dell'utente loggato (per il frontend)
    this.router.get('/effettivi', authMiddleware, this.getPermessiEffettivi.bind(this));

    // Permessi per ruolo (solo Superadmin)
    this.router.get('/ruolo/:tipoUtente', authMiddleware, permissionGuard('permessi.gestisci'), this.getPermessiPerRuolo.bind(this));

    // Permessi con override GDO (solo Superadmin)
    this.router.get('/ruolo/:tipoUtente/gdo/:idGdo', authMiddleware, permissionGuard('permessi.gestisci'), this.getPermessiConOverride.bind(this));

    // Aggiorna permessi globali per ruolo (solo Superadmin)
    this.router.put('/ruolo/:tipoUtente', authMiddleware, permissionGuard('permessi.gestisci'), this.setPermessiRuolo.bind(this));

    // Aggiorna override GDO (solo Superadmin)
    this.router.put('/ruolo/:tipoUtente/gdo/:idGdo', authMiddleware, permissionGuard('permessi.gestisci'), this.setPermessiRuoloGdo.bind(this));

    // Reset override GDO (solo Superadmin)
    this.router.delete('/ruolo/:tipoUtente/gdo/:idGdo', authMiddleware, permissionGuard('permessi.gestisci'), this.resetOverrideGdo.bind(this));

    // Seed permessi (solo Superadmin - operazione una tantum)
    this.router.post('/seed', authMiddleware, permissionGuard('permessi.gestisci'), this.seedPermessi.bind(this));

    // Reseed permessi (solo Superadmin - svuota e ricrea tutto il catalogo)
    this.router.post('/reseed', authMiddleware, permissionGuard('permessi.gestisci'), this.reseedPermessi.bind(this));
  }

  /** Estrae il query param ?ruoloGdo=<uuid> se presente */
  private getRuoloGdo(req: Request): string | undefined {
    const val = req.query.ruoloGdo;
    return typeof val === 'string' && val.length > 0 ? val : undefined;
  }

  private async getAllPermessi(_req: Request, res: Response): Promise<void> {
    try {
      const permessi = await this.permessiService.getAllPermessi();
      this.sendResponse(res, 200, permessi);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getPermessiEffettivi(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.session.id_utente as string;
      const permessi = await this.permessiService.getPermessiUtente(userId);
      this.sendResponse(res, 200, { permessi });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getPermessiPerRuolo(req: Request, res: Response): Promise<void> {
    try {
      const tipoUtente = req.params.tipoUtente as TIPO_UTENTI;
      if (!Object.values(TIPO_UTENTI).includes(tipoUtente)) {
        return this.sendResponse(res, 400, { message: 'Tipo utente non valido' });
      }
      const idRuoloGdo = this.getRuoloGdo(req);
      const permessi = await this.permessiService.getPermessiPerRuolo(tipoUtente, idRuoloGdo);
      this.sendResponse(res, 200, permessi);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getPermessiConOverride(req: Request, res: Response): Promise<void> {
    try {
      const tipoUtente = req.params.tipoUtente as TIPO_UTENTI;
      const idGdo = req.params.idGdo;
      const idRuoloGdo = this.getRuoloGdo(req);
      const permessi = await this.permessiService.getPermessiEffettiviConDettagli(tipoUtente, idGdo, idRuoloGdo);
      this.sendResponse(res, 200, permessi);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async setPermessiRuolo(req: Request, res: Response): Promise<void> {
    try {
      const tipoUtente = req.params.tipoUtente as TIPO_UTENTI;
      const { permessi } = req.body as { permessi: { id_permesso: string; abilitato: boolean }[] };

      if (!permessi || !Array.isArray(permessi)) {
        return this.sendResponse(res, 400, { message: 'Formato permessi non valido' });
      }

      const idRuoloGdo = this.getRuoloGdo(req);
      await this.permessiService.setPermessiRuolo(tipoUtente, permessi, idRuoloGdo);
      this.sendResponse(res, 200, { message: 'Permessi aggiornati' });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async setPermessiRuoloGdo(req: Request, res: Response): Promise<void> {
    try {
      const tipoUtente = req.params.tipoUtente as TIPO_UTENTI;
      const idGdo = req.params.idGdo;
      const { permessi } = req.body as { permessi: { id_permesso: string; abilitato: boolean }[] };

      if (!permessi || !Array.isArray(permessi)) {
        return this.sendResponse(res, 400, { message: 'Formato permessi non valido' });
      }

      const idRuoloGdo = this.getRuoloGdo(req);
      await this.permessiService.setPermessiRuoloGdo(idGdo, tipoUtente, permessi, idRuoloGdo);
      invalidatePermissionCache(req);
      this.sendResponse(res, 200, { message: 'Override GDO aggiornati' });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async resetOverrideGdo(req: Request, res: Response): Promise<void> {
    try {
      const tipoUtente = req.params.tipoUtente as TIPO_UTENTI;
      const idGdo = req.params.idGdo;
      const idRuoloGdo = this.getRuoloGdo(req);

      await this.permessiService.resetOverrideGdo(idGdo, tipoUtente, idRuoloGdo);
      this.sendResponse(res, 200, { message: 'Override GDO rimossi' });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async seedPermessi(_req: Request, res: Response): Promise<void> {
    try {
      await this.permessiService.seedPermessiIniziali();
      this.sendResponse(res, 200, { message: 'Seed permessi completato' });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async reseedPermessi(_req: Request, res: Response): Promise<void> {
    try {
      await this.permessiService.reseedPermessi();
      this.sendResponse(res, 200, { message: 'Reseed permessi completato. Catalogo aggiornato.' });
    } catch (error) {
      this.handleError(res, error);
    }
  }
}
