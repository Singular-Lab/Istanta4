import { Request, Response } from 'express';
import { CATEGORIA_ATTIVITA, HttpStatusCode } from '../../../lib/enums';
import { UnauthorizedError } from '../../../lib/errors';
import { BaseController } from '../base/BaseController';
import { IAttivitaService } from '../interfaces/IAttivitaService';
import { authMiddleware } from '../middleware/authMiddleware';

export class AttivitaController extends BaseController {

  constructor(
    private attivitaService: IAttivitaService
  ) {
    super('/api');
  }

  public initializeRoutes(): void {
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.router.get('/get_attivita', authMiddleware, this.get_attivita.bind(this));
    this.router.get('/get_attivita_count', authMiddleware, this.get_attivita_count.bind(this));
    this.router.put('/mark_as_read', authMiddleware, this.mark_as_read.bind(this));
    this.router.put('/mark_as_unread', authMiddleware, this.mark_as_unread.bind(this));
    this.router.put('/mark_all_as_read', authMiddleware, this.mark_all_as_read.bind(this));
  }

  /**
   * GET /api/get_attivita
   * Recupera le attività per l'utente corrente con:
   * - Cutoff temporale (utente vede solo attività create dopo la sua registrazione)
   * - Filtro per categoria (opzionale)
   * - Filtro solo non lette (opzionale)
   *
   * Query params:
   * - limit: number (default 50)
   * - offset: number (default 0)
   * - categoria: CATEGORIA_ATTIVITA (opzionale)
   * - soloNonLette: boolean (opzionale)
   */
  private async get_attivita(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.session.id_utente;
      if (!userId) {
        throw new UnauthorizedError({ message: "Utente non autenticato" });
      }

      // Estrai parametri dalla query
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const rawCategoria = req.query.categoria as string | undefined;
      const categoria = rawCategoria !== undefined && Object.values(CATEGORIA_ATTIVITA).includes(rawCategoria as CATEGORIA_ATTIVITA)
        ? rawCategoria as CATEGORIA_ATTIVITA
        : undefined;
      const soloNonLette = req.query.soloNonLette === 'true';

      const attivita = await this.attivitaService.get_attivita(userId, limit, offset, {
        categoria,
        soloNonLette
      });
      this.sendResponse(res, HttpStatusCode.OK, attivita);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * GET /api/get_attivita_count
   * Restituisce il conteggio delle notifiche non lette per l'utente corrente
   * Include conteggio totale e per categoria
   */
  private async get_attivita_count(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.session.id_utente;
      if (!userId) {
        throw new UnauthorizedError({ message: "Utente non autenticato" });
      }

      const counts = await this.attivitaService.countUnreadForUser(userId);
      this.sendResponse(res, HttpStatusCode.OK, counts);
    } catch (error) {
      this.handleError(res, error);
    }
  }






  private async mark_as_read(req: Request, res: Response): Promise<void> {
    try {
      const idAttivita = req.body.idAttivita;
      const userId = req.session.id_utente;
      if (!userId) {
        throw new UnauthorizedError({ message: "Utente non autenticato" });
      }
      await this.attivitaService.mark_as_read(userId, idAttivita);
      this.sendResponse(res, HttpStatusCode.OK, { message: "Attività marcata come letta" });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async mark_as_unread(req: Request, res: Response): Promise<void> {
    try {
      const idAttivita = req.body.idAttivita;
      const userId = req.session.id_utente;
      if (!userId) {
        throw new UnauthorizedError({ message: "Utente non autenticato" });
      }
      const attivita = await this.attivitaService.mark_as_unread(userId, idAttivita);
      this.sendResponse(res, HttpStatusCode.OK, attivita);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async mark_all_as_read(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.session.id_utente;
      if (!userId) {
        throw new UnauthorizedError({ message: "Utente non autenticato" });
      }
      const attivita = await this.attivitaService.mark_all_as_read(userId);
      this.sendResponse(res, HttpStatusCode.OK, { message: "Tutte le attività sono state marcate come lette" });
    } catch (error) {
      this.handleError(res, error);
    }
  }
}
