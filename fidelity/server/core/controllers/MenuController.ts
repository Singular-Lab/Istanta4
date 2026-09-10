import { Request, Response } from 'express';
import { TIPO_UTENTI } from '../../../lib/enums';
import { UnauthorizedError } from '../../../lib/errors';
import { BaseController } from '../base/BaseController';
import type { IMenuService } from '../interfaces/IMenuService';
import type { IUserService } from '../interfaces/IUserService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import type BadgeService from '../services/BadgeService';

export class MenuController extends BaseController {
  private menuService: IMenuService;
  private userService: IUserService;
  private badgeService: BadgeService;

  constructor(menuService: IMenuService, userService: IUserService, badgeService: BadgeService) {
    super('/api/menu');
    this.menuService = menuService;
    this.userService = userService;
    this.badgeService = badgeService;
  }

  protected setupRoutes(): void {
    // Tutte le configurazioni menu (admin)
    this.router.get('/', authMiddleware, permissionGuard('permessi.gestisci'), this.getAllConfigurations.bind(this));

    // Menu runtime per utente corrente
    this.router.get('/me', authMiddleware, this.getMenuMe.bind(this));

    // Menu per tipo utente (con opzionale ?ruoloGdo=)
    this.router.get('/:tipoUtente', authMiddleware, permissionGuard('permessi.gestisci'), this.getMenuPerTipoUtente.bind(this));

    // Salva menu per tipo utente
    this.router.put('/:tipoUtente', authMiddleware, permissionGuard('permessi.gestisci'), this.saveMenu.bind(this));

    // Seed da menu.json
    this.router.post('/seed', authMiddleware, permissionGuard('permessi.gestisci'), this.seedFromJson.bind(this));
  }

  private getRuoloGdo(req: Request): string | undefined {
    const val = req.query.ruoloGdo;
    return typeof val === 'string' && val.length > 0 ? val : undefined;
  }

  private async getAllConfigurations(_req: Request, res: Response): Promise<void> {
    try {
      const configs = await this.menuService.getAllMenuConfigurations();
      this.sendResponse(res, 200, configs);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getMenuMe(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.session.id_utente as string | undefined;
      const tipoUtente = req.session.tipo_utente as TIPO_UTENTI | undefined;

      if (!userId || !tipoUtente) {
        throw new UnauthorizedError({
          message: 'Sessione non valida',
        });
      }

      const ruoloGdo = tipoUtente === TIPO_UTENTI.GDO
        ? await this.userService.resolveGdoRuoloKey(userId)
        : undefined;

      const menu = await this.menuService.getMenuPerUtente(tipoUtente, ruoloGdo);
      const badges = await this.badgeService.getBadgesForUser(userId, tipoUtente);

      const clonedMenu = JSON.parse(JSON.stringify(menu));

      const injectBadges = (items: any[]) => {
        if (!Array.isArray(items)) return;
        for (const item of items) {
          if (typeof item === 'string') continue;

          const keyByPath = item.pathname && badges[item.pathname];
          const keyByTitle = item.title && badges[item.title];

          if (keyByPath) {
            item.badge = { ...keyByPath };
          } else if (keyByTitle) {
            item.badge = { ...keyByTitle };
          }

          if (Array.isArray(item.subMenu)) {
            injectBadges(item.subMenu);
          }
        }
      };

      if (Array.isArray(clonedMenu)) {
        injectBadges(clonedMenu);
      } else if (clonedMenu && typeof clonedMenu === 'object') {
        Object.keys(clonedMenu).forEach((k) => {
          const val = (clonedMenu as Record<string, any>)[k];
          if (Array.isArray(val)) injectBadges(val);
        });
      }

      this.sendResponse(res, 200, clonedMenu);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getMenuPerTipoUtente(req: Request, res: Response): Promise<void> {
    try {
      const tipoUtente = req.params.tipoUtente;
      const ruoloGdo = this.getRuoloGdo(req);
      const items = await this.menuService.getMenuItemsPerUtente(tipoUtente, ruoloGdo);
      this.sendResponse(res, 200, items);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async saveMenu(req: Request, res: Response): Promise<void> {
    try {
      const tipoUtente = req.params.tipoUtente;
      const ruoloGdo = this.getRuoloGdo(req);
      const { items } = req.body as { items: any[] };

      if (!items || !Array.isArray(items)) {
        return this.sendResponse(res, 400, { message: 'Formato menu non valido' });
      }

      await this.menuService.saveMenu(tipoUtente, ruoloGdo || null, items);
      this.sendResponse(res, 200, { message: 'Menu aggiornato' });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async seedFromJson(_req: Request, res: Response): Promise<void> {
    try {
      await this.menuService.seedMenuDaJson();
      this.sendResponse(res, 200, { message: 'Seed menu da JSON completato' });
    } catch (error) {
      this.handleError(res, error);
    }
  }
}
