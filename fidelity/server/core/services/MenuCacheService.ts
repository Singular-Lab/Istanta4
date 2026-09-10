import { TIPO_UTENTI } from '../../../lib/enums';
import { DatabaseError, NotFoundError, wrapDatabaseError, wrapNotFoundError } from '../../../lib/errors';
import type { MenuElement } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';
import { log } from '../logger';
import { MenuItem } from '../models/menu_item';
import { MenuItemRepository } from '../repositories/MenuItemRepository';

/**
 * Struttura del menu per GDO con ruoli specifici
 * Mantenuta per retrocompatibilita' della signature pubblica.
 */
interface GdoMenuStructure {
  [key: string]: MenuElement[];
}

/**
 * Elemento della cache del menu
 */
interface MenuCacheItem {
  menu: MenuElement[];
  timestamp: number;
  version: string;
}

/**
 * Service per la gestione ottimizzata dei menu utente
 */
export class MenuCacheService {
  private static instance: MenuCacheService;
  private readonly menuRepository = new MenuItemRepository();
  private cache = new Map<string, MenuCacheItem>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minuti
  private menuVersion: string = '0';

  private constructor() {
    // Nessuna inizializzazione da file: il menu viene letto dal DB.
  }

  /**
   * Ottiene l'istanza singleton del service
   */
  public static getInstance(): MenuCacheService {
    if (!MenuCacheService.instance) {
      MenuCacheService.instance = new MenuCacheService();
    }
    return MenuCacheService.instance;
  }

  /**
   * Aggiorna la versione del menu da DB e invalida la cache se rileva modifiche.
   */
  private async refreshMenuVersion(force = false): Promise<void> {
    try {
      const row = await MenuItem.findOne({
        attributes: [
          [sequelize.literal('MAX(COALESCE("updatedat", "createdat"))'), 'menu_version_ts'],
        ],
        raw: true,
      }) as { menu_version_ts?: string | Date | null } | null;
      const maxTs = row?.menu_version_ts ? new Date(row.menu_version_ts).getTime() : 0;
      const nextVersion = maxTs > 0 ? String(maxTs) : 'empty';

      if (nextVersion !== this.menuVersion) {
        this.menuVersion = nextVersion;
        this.invalidateAllCache();
        log.info('Menu version changed in DB, cache invalidated', {
          version: this.menuVersion,
        });
      }
    } catch (error) {
      log.error('Failed to refresh menu version from DB', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Genera una chiave di cache per un utente specifico
   */
  private generateCacheKey(userId: string, tipoUtente: TIPO_UTENTI, ruoloGDO?: string): string {
    const baseKey = `${userId}-${tipoUtente}`;
    return ruoloGDO ? `${baseKey}-${ruoloGDO}` : baseKey;
  }

  /**
   * Verifica se un elemento della cache è ancora valido
   */
  private isCacheValid(cacheItem: MenuCacheItem): boolean {
    const now = Date.now();
    const isNotExpired = (now - cacheItem.timestamp) < this.CACHE_TTL;
    const isVersionCurrent = cacheItem.version === this.menuVersion;

    return isNotExpired && isVersionCurrent;
  }

  /**
   * Ottiene il menu per un utente dal database con ottimizzazione delle query
   */
  private async getUserRoleFromDB(userId: string, tipoUtente: TIPO_UTENTI): Promise<string | null> {
    try {
      if (tipoUtente !== TIPO_UTENTI.GDO) {
        return null;
      }

      // Importa i modelli dinamicamente per evitare dipendenze circolari
      const { UtentiGDO } = await import('../models/utenti_gdo');
      const { RuoloUtenteGDO } = await import('../models/ruolo_gdo');

      // Evita dipendenza dall'alias Sequelize: recupera prima l'id ruolo da utenti_gdo,
      // poi il nome ruolo dalla tabella ruolo_utente_gdo.
      const utenteGdo = await UtentiGDO.findOne({
        where: { id_utente_utentegdo: userId },
        attributes: ['id_ruolo_utente_gdo']
      });

      const ruoloId = utenteGdo?.get('id_ruolo_utente_gdo') as string | null | undefined;
      if (!ruoloId) {
        return null;
      }

      const ruoloGdo = await RuoloUtenteGDO.findOne({
        where: { id_ruolo_utente_gdo: ruoloId },
        attributes: ['ruolo_ruolo_utente_gdo']
      });

      const ruolo = ruoloGdo?.get('ruolo_ruolo_utente_gdo') as string | null | undefined;
      if (ruolo && ruolo.trim().length > 0) {
        return ruolo;
      }

      return null;
    } catch (error) {
      log.error('Error fetching user role from database', error instanceof Error ? error : new Error(String(error)), {
        userId,
        tipoUtente
      });
      return null;
    }
  }

  /**
   * Converte il ruolo GDO recuperato da DB in possibili chiavi ruolo_gdo usate in menu_items.
   */
  private getGdoRoleCandidates(ruoloGDO?: string | null): (string | null)[] {
    if (!ruoloGDO) {
      return ['GDO_ADMIN', null];
    }

    const raw = ruoloGDO.trim();
    const upper = raw.toUpperCase();
    const rawWithPrefix = raw.startsWith('GDO_') ? raw : `GDO_${raw}`;
    const rawWithoutPrefix = raw.startsWith('GDO_') ? raw.replace(/^GDO_/, '') : raw;
    const upperWithPrefix = upper.startsWith('GDO_') ? upper : `GDO_${upper}`;
    const upperWithoutPrefix = upper.startsWith('GDO_') ? upper.replace(/^GDO_/, '') : upper;

    return Array.from(new Set<string | null>([
      rawWithPrefix,
      rawWithoutPrefix,
      upperWithPrefix,
      upperWithoutPrefix,
      'GDO_ADMIN',
      null,
    ]));
  }

  /**
   * Estrae il menu direttamente dal DB (tabella menu_items)
   */
  private async extractMenuForUser(tipoUtente: TIPO_UTENTI, ruoloGDO?: string): Promise<MenuElement[]> {
    await this.refreshMenuVersion();

    try {
      if (tipoUtente === TIPO_UTENTI.GDO) {
        const roleCandidates = this.getGdoRoleCandidates(ruoloGDO);
        for (const roleCandidate of roleCandidates) {
          const menu = await this.menuRepository.findMenuRuntimeByTipoUtente(tipoUtente, roleCandidate);
          if (Array.isArray(menu) && menu.length > 0) {
            return menu as MenuElement[];
          }
        }
      } else {
        const menu = await this.menuRepository.findMenuRuntimeByTipoUtente(tipoUtente, null);
        if (Array.isArray(menu) && menu.length > 0) {
          return menu as MenuElement[];
        }
      }
    } catch (error) {
      throw wrapDatabaseError(new Error('Errore durante il recupero menu da database'), {
        message: 'Errore durante il recupero menu da database',
        operation: 'read',
        entity: 'Menu',
        details: { error },
      });
    }

    throw wrapNotFoundError(new Error(`Menu non definito per il tipo di utente: ${tipoUtente}`), {
      message: `Menu non definito per il tipo di utente: ${tipoUtente}`,
      entityType: 'Menu',
      entityId: tipoUtente,
    });
  }

  /**
   * Ottiene il menu per un utente con cache ottimizzata
   */
  public async getUserMenu(userId: string, tipoUtente: TIPO_UTENTI): Promise<MenuElement[] | GdoMenuStructure> {
    try {
      // Aggiorna la versione prima di valutare la cache locale.
      await this.refreshMenuVersion();

      // Per utenti GDO, ottieni il ruolo dal database
      const ruoloGDO = await this.getUserRoleFromDB(userId, tipoUtente);
      const cacheRoleKey = ruoloGDO ? this.getGdoRoleCandidates(ruoloGDO)[0] || undefined : undefined;

      // Genera la chiave di cache
      const cacheKey = this.generateCacheKey(userId, tipoUtente, cacheRoleKey || undefined);

      // Controlla la cache
      const cachedItem = this.cache.get(cacheKey);
      if (cachedItem && this.isCacheValid(cachedItem)) {
        log.debug('Menu retrieved from cache', {
          userId,
          tipoUtente,
          ruoloGDO,
          cacheKey
        });
        return cachedItem.menu;
      }

      // Se non in cache o non valido, estrai dalla struttura completa
      const menu = await this.extractMenuForUser(tipoUtente, ruoloGDO || undefined);

      // Salva in cache
      const cacheItem: MenuCacheItem = {
        menu,
        timestamp: Date.now(),
        version: this.menuVersion
      };

      this.cache.set(cacheKey, cacheItem);

      log.info('Menu generated and cached', {
        userId,
        tipoUtente,
        ruoloGDO,
        cacheKey,
        menuItemsCount: Array.isArray(menu) ? menu.length : Object.keys(menu).length
      });

      return menu;
    } catch (error) {
      log.error('Error retrieving user menu', error instanceof Error ? error : new Error(String(error)), {
        userId,
        tipoUtente
      });

      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      throw wrapDatabaseError(new Error("Errore durante il recupero del menu per utente"), {
        message: 'Errore durante il recupero del menu per utente',
        operation: 'get',
        entity: 'Menu',
        details: { error }
      });
    }
  }

  /**
   * Normalizza un pathname per confronto accessi.
   */
  private normalizePath(pathname: string): string {
    if (!pathname) return '/';
    const withSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
    if (withSlash.length > 1 && withSlash.endsWith('/')) {
      return withSlash.slice(0, -1);
    }
    return withSlash;
  }

  /**
   * Verifica se requestedPath e menuPath sono compatibili (pagina o sottopagina).
   */
  private matchesPath(requestedPath: string, menuPath: string): boolean {
    if (requestedPath === menuPath) return true;
    return requestedPath.startsWith(`${menuPath}/`) || menuPath.startsWith(`${requestedPath}/`);
  }

  /**
   * Verifica se un utente ha accesso a una specifica pagina
   */
  public async hasPageAccess(userId: string, tipoUtente: TIPO_UTENTI, rp: string): Promise<boolean> {
    try {
      const menu = await this.getUserMenu(userId, tipoUtente);

      const normalizedRequestedPage = this.normalizePath(rp);
      const inspectedPaths: string[] = [];
      if (tipoUtente === TIPO_UTENTI.SUPERADMIN) {
        return true;
      }
      const checkMenuAccess = (menuItems: MenuElement[]): boolean => {
        return menuItems.some(item => {
          if (typeof item === 'string') {
            return false;
          }

          const menuPath = item.pathname ? this.normalizePath(item.pathname) : null;
          if (menuPath) {
            inspectedPaths.push(menuPath);
          }

          // Match diretto o per sottopagine.
          if (menuPath && this.matchesPath(normalizedRequestedPage, menuPath)) {
            return !item.disabled;
          }

          if (item.subMenu && item.subMenu.length > 0) {
            return checkMenuAccess(item.subMenu);
          }

          return false;
        });
      };

      // Runtime menu da DB: sempre array (item + separator).
      const hasAccess = Array.isArray(menu) && checkMenuAccess(menu as MenuElement[]);
      if (!hasAccess) {
        log.warn('Page access not matched against menu items', {
          userId,
          tipoUtente,
          requestedPage: normalizedRequestedPage,
          inspectedPathsCount: inspectedPaths.length,
          inspectedPathsSample: inspectedPaths.slice(0, 30),
        });
      }
      return hasAccess;
    } catch (error) {
      log.error('Error checking page access', error instanceof Error ? error : new Error(String(error)), {
        userId,
        tipoUtente,
        rp
      });
      return false;
    }
  }

  /**
   * Invalida la cache per un utente specifico
   */
  public invalidateUserCache(userId: string): void {
    const keysToDelete: string[] = [];

    this.cache.forEach((_item, key) => {
      if (key.startsWith(`${userId}-`)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));

    log.info('User menu cache invalidated', {
      userId,
      invalidatedKeys: keysToDelete.length
    });
  }

  /**
   * Invalida tutta la cache
   */
  public invalidateAllCache(): void {
    const cacheSize = this.cache.size;
    this.cache.clear();

    log.info('All menu cache invalidated', {
      previousCacheSize: cacheSize
    });
  }

  /**
   * Ottiene statistiche della cache
   */
  public getCacheStats(): {
    size: number;
    hitRate: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const now = Date.now();
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;
    let validEntries = 0;

    this.cache.forEach(item => {
      if (this.isCacheValid(item)) {
        validEntries++;

        if (!oldestTimestamp || item.timestamp < oldestTimestamp) {
          oldestTimestamp = item.timestamp;
        }

        if (!newestTimestamp || item.timestamp > newestTimestamp) {
          newestTimestamp = item.timestamp;
        }
      }
    });

    return {
      size: this.cache.size,
      hitRate: validEntries / Math.max(this.cache.size, 1),
      oldestEntry: oldestTimestamp ? now - oldestTimestamp : null,
      newestEntry: newestTimestamp ? now - newestTimestamp : null
    };
  }

  /**
   * Pulizia periodica della cache per rimuovere elementi scaduti
   */
  public cleanupExpiredCache(): void {
    const keysToDelete: string[] = [];

    this.cache.forEach((item, key) => {
      if (!this.isCacheValid(item)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      log.info('Expired menu cache entries cleaned up', {
        cleanedEntries: keysToDelete.length,
        remainingEntries: this.cache.size
      });
    }
  }

  /**
   * Rilascia le risorse del service.
   */
  public destroy(): void {
    this.cache.clear();
    log.info('MenuCacheService destroyed');
  }
}
