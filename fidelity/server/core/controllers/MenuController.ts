import { Request, Response } from 'express';
import { TIPO_UTENTI } from '../../../lib/enums';
import { UnauthorizedError } from '../../../lib/errors';
import { BaseController } from '../base/BaseController';
import type { IMenuService } from '../interfaces/IMenuService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { leggiContestoAccesso } from '../accessi/contestoAccesso';
import { PERMESSI } from '../../../lib/accessi/catalogo';
import type BadgeService from '../services/BadgeService';

export class MenuController extends BaseController {
  private menuService: IMenuService;
  private badgeService: BadgeService;

  constructor(menuService: IMenuService, badgeService: BadgeService) {
    super('/api/menu');
    this.menuService = menuService;
    this.badgeService = badgeService;
  }

  protected setupRoutes(): void {
    const gestione = [authMiddleware, permissionGuard(PERMESSI.SISTEMA.GESTISCI_ACCESSI)];

    // Menu runtime per utente corrente: solo le pagine che puo' aprire
    this.router.get('/me', authMiddleware, this.getMenuMe.bind(this));

    // Menu configurato per tipo utente (con opzionale ?ruoloGdo=<id sotto-ruolo>)
    this.router.get('/:tipoUtente', ...gestione, this.getMenuPerTipoUtente.bind(this));
    this.router.put('/:tipoUtente', ...gestione, this.saveMenu.bind(this));

    // Ripristino del menu predefinito del Superadmin (sostituisce l'import da menu.json)
    this.router.post('/ripristina-predefiniti', ...gestione, this.ripristinaPredefiniti.bind(this));
  }

  private getRuoloGdo(req: Request): string | null {
    const val = req.query.ruoloGdo;
    return typeof val === 'string' && val.length > 0 ? val : null;
  }

  private async getMenuMe(req: Request, res: Response): Promise<void> {
    try {
      const contesto = await leggiContestoAccesso(req, res);
      if (!contesto) {
        throw new UnauthorizedError({
          message: 'Sessione non valida',
        });
      }

      const menu = await this.menuService.getMenuDiUtente(contesto);
      const badges = await this.badgeService.getBadgesForUser(contesto);

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

  private async getMenuPerTipoUtente(req: Request<{ tipoUtente: string }>, res: Response): Promise<void> {
    try {
      const tipoUtente = req.params.tipoUtente as TIPO_UTENTI;
      const items = await this.menuService.getMenuItemsPerUtente(tipoUtente, this.getRuoloGdo(req));
      this.sendResponse(res, 200, items);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async saveMenu(req: Request<{ tipoUtente: string }>, res: Response): Promise<void> {
    try {
      const tipoUtente = req.params.tipoUtente as TIPO_UTENTI;
      const { items } = req.body as { items: any[] };

      if (!items || !Array.isArray(items)) {
        return this.sendResponse(res, 400, { message: 'Formato menu non valido' });
      }

      await this.menuService.saveMenu(tipoUtente, this.getRuoloGdo(req), items);
      this.sendResponse(res, 200, { message: 'Menu aggiornato' });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async ripristinaPredefiniti(_req: Request, res: Response): Promise<void> {
    try {
      const voci = await this.menuService.ripristinaMenuPredefiniti();
      this.sendResponse(res, 200, { message: 'Menu predefinito del Superadmin ripristinato', voci });
    } catch (error) {
      this.handleError(res, error);
    }
  }
}
