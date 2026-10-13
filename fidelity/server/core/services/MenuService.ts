import fs from 'fs';
import path from 'path';
import { TIPO_MENU_ITEM, TIPO_UTENTI } from '../../../lib/enums';
import type { MenuElement, MenuItem as MenuItemType, MenuStructure } from '../../../lib/types';
import type { IMenuService, MenuItemDTO } from '../interfaces/IMenuService';
import { log } from '../logger';
import { MenuItem } from '../models';
import { MenuItemRepository } from '../repositories/MenuItemRepository';
import { sequelize } from '../db/SequelizeConnector';
import { vociMenuSuperadmin } from '../inizializzazione/inizializzaInstallazione';

export class MenuService implements IMenuService {
  private repository: MenuItemRepository;
  private cache = new Map<string, { data: MenuElement[]; expires: number }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minuti

  constructor(repository: MenuItemRepository) {
    this.repository = repository;
  }

  private cacheKey(tipoUtente: string, ruoloGdo?: string): string {
    return `${tipoUtente}::${ruoloGdo || '_base_'}`;
  }

  /**
   * Restituisce il menu nel formato MenuElement[] (compatibile col frontend attuale).
   */
  async getMenuPerUtente(tipoUtente: string, ruoloGdo?: string): Promise<MenuElement[]> {
    const key = this.cacheKey(tipoUtente, ruoloGdo);
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    // Verifica se ci sono dati in DB, altrimenti fallback a JSON
    const count = await this.repository.count();
    if (count === 0) {
      return this.ensureHubManagementEntry(this.getMenuFromJson(tipoUtente, ruoloGdo), tipoUtente);
    }

    const menuElements = this.ensureHubManagementEntry(
      await this.repository.findMenuRuntimeByTipoUtente(tipoUtente, ruoloGdo),
      tipoUtente
    );

    this.cache.set(key, { data: menuElements, expires: Date.now() + this.CACHE_TTL });
    return menuElements;
  }

  /**
   * Restituisce i menu items nel formato DTO (per la UI admin di gestione).
   */
  async getMenuItemsPerUtente(tipoUtente: string, ruoloGdo?: string): Promise<MenuItemDTO[]> {
    const items = await this.repository.findByTipoUtente(tipoUtente, ruoloGdo);
    return items.map((item: any) => this.modelToDTO(item));
  }

  /**
   * Restituisce tutte le configurazioni menu raggruppate per chiave.
   */
  async getAllMenuConfigurations(): Promise<Record<string, MenuItemDTO[]>> {
    const all = await this.repository.findAll();
    const grouped: Record<string, MenuItemDTO[]> = {};

    for (const item of all) {
      const key = this.cacheKey(item.getDataValue('tipo_utente'), item.getDataValue('ruolo_gdo'));
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(this.modelToDTO(item));
    }

    return grouped;
  }

  /**
   * Salva il menu per un tipo utente (e opzionalmente un ruolo GDO).
   * Cancella i vecchi items e li ricrea, poi invalida la cache.
   */
  async saveMenu(tipoUtente: string, ruoloGdo: string | null, items: MenuItemDTO[]): Promise<void> {
    // Cancella tutti i menu items esistenti per questa configurazione
    await this.repository.deleteByTipoUtente(tipoUtente, ruoloGdo);

    // Crea i nuovi items con sotto-menu
    const flatItems = this.flattenDTOsForInsert(items, tipoUtente, ruoloGdo);

    if (flatItems.length > 0) {
      // Prima inserisci i parent (senza id_parent)
      const parents = flatItems.filter(i => !i.id_parent);
      const created = await this.repository.bulkCreateItems(parents);

      // Poi inserisci i children con id_parent risolti
      const children = flatItems.filter(i => i.id_parent);
      if (children.length > 0) {
        // Mappa temporanea ordine → id creato
        const parentMap = new Map<number, string>();
        for (const c of created) {
          parentMap.set(c.getDataValue('ordinamento'), c.getDataValue('id_menu_item'));
        }

        const resolvedChildren = children.map(child => ({
          ...child,
          id_parent: parentMap.get(child._parentOrd as number) || null,
        }));

        await this.repository.bulkCreateItems(
          resolvedChildren.map(({ _parentOrd, ...rest }) => rest) as any[]
        );
      }
    }

    this.invalidateCache(tipoUtente, ruoloGdo || undefined);
    log.info(`Menu salvato per ${tipoUtente}${ruoloGdo ? ` (ruolo: ${ruoloGdo})` : ''}: ${items.length} items`);
  }

  invalidateCache(tipoUtente?: string, ruoloGdo?: string): void {
    if (tipoUtente) {
      const key = this.cacheKey(tipoUtente, ruoloGdo);
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Riporta il menu del Superadmin a quello predefinito (server/core/inizializzazione/datiPredefiniti.ts).
   * I menu degli altri tipi di utente non si toccano. Cancellazione e inserimento stanno in una sola
   * transazione: se l'inserimento fallisce il menu resta quello di prima.
   * Sostituisce "Importa da JSON", che svuotava i menu di tutti e poi leggeva config/menu.json,
   * un file che non esiste.
   */
  async ripristinaMenuPredefiniti(): Promise<number> {
    const voci = vociMenuSuperadmin();
    await sequelize.transaction(async (transaction) => {
      await MenuItem.destroy({ where: { tipo_utente: TIPO_UTENTI.SUPERADMIN }, transaction });
      await MenuItem.bulkCreate(voci as any[], { transaction });
    });
    this.invalidateCache(TIPO_UTENTI.SUPERADMIN);
    log.info(`Menu predefinito del Superadmin ripristinato: ${voci.length} voci`);
    return voci.length;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Fallback: legge il menu dal file JSON (per retrocompatibilita se il DB e vuoto).
   */
  private getMenuFromJson(tipoUtente: string, ruoloGdo?: string): MenuElement[] {
    try {
      const pathPerMenu = path.join(process.cwd(), 'config', 'menu.json');
      const menuParsed = JSON.parse(fs.readFileSync(pathPerMenu, 'utf8')) as MenuStructure;

      if (tipoUtente === 'GDO' && ruoloGdo) {
        const gdoMenus = menuParsed.TIPO_UTENTI.GDO as any;
        return gdoMenus[ruoloGdo] || gdoMenus['GDO_ADMIN'] || [];
      }

      const menu = (menuParsed.TIPO_UTENTI as any)[tipoUtente.toUpperCase()];
      return Array.isArray(menu) ? menu : [];
    } catch {
      return [];
    }
  }

  private ensureHubManagementEntry(menu: MenuElement[], tipoUtente: string): MenuElement[] {
    if (tipoUtente !== TIPO_UTENTI.SUPERADMIN || !Array.isArray(menu)) {
      return menu;
    }

    const pathname = '/gestione-hub';
    const alreadyPresent = menu.some(
      (item) => typeof item !== 'string' && item.pathname === pathname
    );
    if (alreadyPresent) {
      return menu;
    }

    const nextMenu = [...menu];
    const hubItem: MenuItemType = {
      icon: 'LayoutDashboard',
      pathname,
      title: 'Gestione Hub',
      subMenu: [],
    };

    const gestioneInternaIndex = nextMenu.findIndex((item) => item === 'GESTIONE INTERNA');
    if (gestioneInternaIndex >= 0) {
      let insertAt = gestioneInternaIndex + 1;
      while (insertAt < nextMenu.length && typeof nextMenu[insertAt] !== 'string') {
        insertAt += 1;
      }
      nextMenu.splice(insertAt, 0, hubItem);
      return nextMenu;
    }

    return [...nextMenu, 'GESTIONE INTERNA', hubItem];
  }

  /**
   * Converte DB items nel formato MenuElement[] del frontend.
   */
  private dbItemsToMenuElements(items: any[]): MenuElement[] {
    const result: MenuElement[] = [];

    for (const item of items) {
      const tipo = item.getDataValue('tipo');

      if (tipo === TIPO_MENU_ITEM.SEPARATOR) {
        result.push(item.getDataValue('titolo'));
      } else {
        const menuItem: MenuItemType = {
          icon: item.getDataValue('icona') || undefined,
          pathname: item.getDataValue('pathname') || undefined,
          title: item.getDataValue('titolo'),
          disabled: item.getDataValue('disabilitato') || undefined,
          start_page: item.getDataValue('start_page') || undefined,
          subMenu: [],
        };

        // SubMenu
        const subMenuItems = (item as any).subMenu;
        if (subMenuItems && Array.isArray(subMenuItems) && subMenuItems.length > 0) {
          menuItem.subMenu = subMenuItems.map((sub: any) => ({
            icon: sub.getDataValue('icona') || undefined,
            pathname: sub.getDataValue('pathname') || undefined,
            title: sub.getDataValue('titolo'),
            disabled: sub.getDataValue('disabilitato') || undefined,
          }));
        }

        result.push(menuItem);
      }
    }

    return result;
  }

  /**
   * Converte un model Sequelize in un DTO per la UI.
   */
  private modelToDTO(item: any): MenuItemDTO {
    const dto: MenuItemDTO = {
      id_menu_item: item.getDataValue('id_menu_item'),
      tipo_utente: item.getDataValue('tipo_utente'),
      ruolo_gdo: item.getDataValue('ruolo_gdo'),
      titolo: item.getDataValue('titolo'),
      tipo: item.getDataValue('tipo') as 'separator' | 'item',
      icona: item.getDataValue('icona'),
      pathname: item.getDataValue('pathname'),
      codice_permesso: item.getDataValue('codice_permesso'),
      disabilitato: item.getDataValue('disabilitato'),
      start_page: item.getDataValue('start_page'),
      ordinamento: item.getDataValue('ordinamento'),
      id_parent: item.getDataValue('id_parent'),
    };

    const subMenuItems = (item as any).subMenu;
    if (subMenuItems && Array.isArray(subMenuItems) && subMenuItems.length > 0) {
      dto.subMenu = subMenuItems.map((sub: any) => this.modelToDTO(sub));
    }

    return dto;
  }

  /**
   * Appiattisce i DTO per l'inserimento nel DB, gestendo i subMenu.
   */
  private flattenDTOsForInsert(
    items: MenuItemDTO[],
    tipoUtente: string,
    ruoloGdo: string | null
  ): any[] {
    const result: any[] = [];

    for (const item of items) {
      const record: any = {
        tipo_utente: tipoUtente,
        ruolo_gdo: ruoloGdo,
        titolo: item.titolo,
        tipo: item.tipo,
        icona: item.icona || null,
        pathname: item.pathname || null,
        codice_permesso: item.codice_permesso || null,
        disabilitato: item.disabilitato || false,
        start_page: item.start_page || false,
        ordinamento: item.ordinamento,
        id_parent: null,
      };
      result.push(record);

      if (item.subMenu && item.subMenu.length > 0) {
        for (const sub of item.subMenu) {
          result.push({
            tipo_utente: tipoUtente,
            ruolo_gdo: ruoloGdo,
            titolo: sub.titolo,
            tipo: TIPO_MENU_ITEM.ITEM,
            icona: sub.icona || null,
            pathname: sub.pathname || null,
            codice_permesso: sub.codice_permesso || null,
            disabilitato: sub.disabilitato || false,
            start_page: false,
            ordinamento: sub.ordinamento,
            id_parent: '__pending__',
            _parentOrd: item.ordinamento,
          });
        }
      }
    }

    return result;
  }
}
