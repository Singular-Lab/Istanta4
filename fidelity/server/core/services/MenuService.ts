import { TIPO_MENU_ITEM, TIPO_UTENTI } from '../../../lib/enums';
import { BadRequestError } from '../../../lib/errors';
import { paginaPer, puoAprirePagina } from '../../../lib/accessi/pagine';
import type { CodicePermesso } from '../../../lib/accessi/catalogo';
import type { MenuElement, MenuItem as MenuItemType } from '../../../lib/types';
import type { ContestoAccesso } from '../accessi/contestoAccesso';
import { RisolutoreAccessi } from '../accessi/RisolutoreAccessi';
import { incrementaVersionePermessi, leggiVersionePermessi } from '../accessi/versionePermessi';
import { sequelize } from '../db/SequelizeConnector';
import type { IMenuService, MenuItemDTO } from '../interfaces/IMenuService';
import { vociMenuSuperadmin } from '../inizializzazione/inizializzaInstallazione';
import { log } from '../logger';
import { MenuItem } from '../models';
import { MenuItemRepository } from '../repositories/MenuItemRepository';

/**
 * Tiene nel menu solo le voci delle pagine consentite. Una voce senza pagina resta
 * se ha almeno una sottovoce visibile; un'intestazione di sezione resta solo se
 * sotto ha almeno una voce.
 */
export const filtraMenu = (menu: MenuElement[], puoAprire: (percorso: string) => boolean): MenuElement[] => {
  const voci: MenuElement[] = [];
  for (const elemento of menu) {
    if (typeof elemento === 'string') {
      voci.push(elemento);
      continue;
    }
    const sottovoci = Array.isArray(elemento.subMenu)
      ? (filtraMenu(elemento.subMenu, puoAprire) as MenuItemType[])
      : [];
    const consentita = elemento.pathname ? puoAprire(elemento.pathname) : sottovoci.length > 0;
    if (!consentita) continue;
    voci.push({ ...elemento, subMenu: sottovoci });
  }
  return voci.filter((elemento, i) => {
    if (typeof elemento !== 'string') return true;
    const successivo = voci[i + 1];
    return successivo !== undefined && typeof successivo !== 'string';
  });
};

export class MenuService implements IMenuService {
  private cache = new Map<string, { versione: number; menu: MenuElement[] }>();

  constructor(
    private readonly repository: MenuItemRepository,
    private readonly risolutore: RisolutoreAccessi = RisolutoreAccessi.get()
  ) { }

  /**
   * Menu del tipo e del sotto-ruolo; un sotto-ruolo senza menu proprio usa quello base del tipo.
   * La cache segue la versione dei permessi, che cambia anche quando si salva un menu.
   */
  async getMenuConfigurato(tipoUtente: TIPO_UTENTI, idRuoloGdo?: string | null): Promise<MenuElement[]> {
    const versione = await leggiVersionePermessi();
    const chiave = `${tipoUtente}|${idRuoloGdo || ''}`;
    const inCache = this.cache.get(chiave);
    if (inCache && inCache.versione === versione) return inCache.menu;

    let menu: MenuElement[] = [];
    if (idRuoloGdo) menu = await this.repository.findMenuRuntimeByTipoUtente(tipoUtente, idRuoloGdo);
    if (menu.length === 0) menu = await this.repository.findMenuRuntimeByTipoUtente(tipoUtente, null);
    menu = this.ensureHubManagementEntry(menu, tipoUtente);

    if (inCache) this.cache.clear();
    this.cache.set(chiave, { versione, menu });
    return menu;
  }

  async getMenuDiUtente(contesto: ContestoAccesso): Promise<MenuElement[]> {
    const menu = await this.getMenuConfigurato(contesto.tipo, contesto.idRuoloGdo);
    if (contesto.superadmin) return menu;
    const permessi = await this.risolutore.permessiDi(contesto);
    return filtraMenu(menu, percorso => puoAprirePagina(percorso, (codice: CodicePermesso) => permessi.has(codice)));
  }

  async getMenuItemsPerUtente(tipoUtente: TIPO_UTENTI, idRuoloGdo?: string | null): Promise<MenuItemDTO[]> {
    const items = await this.repository.findByTipoUtente(tipoUtente, idRuoloGdo ?? null);
    return items.map((item: any) => this.modelToDTO(item));
  }

  /** Sostituisce il menu del tipo (e del sotto-ruolo) in una transazione. */
  async saveMenu(tipoUtente: TIPO_UTENTI, idRuoloGdo: string | null, items: MenuItemDTO[]): Promise<void> {
    if (!(Object.keys(TIPO_UTENTI) as Array<keyof typeof TIPO_UTENTI>).some(k => TIPO_UTENTI[k] === tipoUtente)) {
      throw new BadRequestError({ message: 'Tipo utente non valido', details: { tipoUtente } });
    }

    await sequelize.transaction(async (transaction) => {
      await this.repository.deleteByTipoUtente(tipoUtente, idRuoloGdo, transaction);
      for (const item of items) {
        const [padre] = await this.repository.bulkCreateItems([this.recordDa(item, tipoUtente, idRuoloGdo, null)], transaction);
        const sottovoci = item.tipo === TIPO_MENU_ITEM.SEPARATOR ? [] : (item.subMenu ?? []);
        if (sottovoci.length > 0) {
          const idPadre = padre.getDataValue('id_menu_item') as string;
          await this.repository.bulkCreateItems(
            sottovoci.map(sub => this.recordDa({ ...sub, tipo: TIPO_MENU_ITEM.ITEM as 'item', start_page: false }, tipoUtente, idRuoloGdo, idPadre)),
            transaction
          );
        }
      }
      await incrementaVersionePermessi(transaction);
    });
    log.info(`Menu salvato per ${tipoUtente}${idRuoloGdo ? ` (sotto-ruolo ${idRuoloGdo})` : ''}: ${items.length} voci`);
  }

  /**
   * Riporta il menu del Superadmin a quello predefinito (server/core/inizializzazione/datiPredefiniti.ts).
   * I menu degli altri tipi di utente non si toccano. Cancellazione, inserimento e incremento della
   * versione dei permessi stanno in una sola transazione: se l'inserimento fallisce il menu resta
   * quello di prima; se riesce, ogni worker ricarica il menu alla richiesta successiva.
   */
  async ripristinaMenuPredefiniti(): Promise<number> {
    const voci = vociMenuSuperadmin();
    await sequelize.transaction(async (transaction) => {
      await MenuItem.destroy({ where: { tipo_utente: TIPO_UTENTI.SUPERADMIN }, transaction });
      await MenuItem.bulkCreate(voci as any[], { transaction });
      await incrementaVersionePermessi(transaction);
    });
    log.info(`Menu predefinito del Superadmin ripristinato: ${voci.length} voci`);
    return voci.length;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private recordDa(item: MenuItemDTO, tipoUtente: TIPO_UTENTI, idRuoloGdo: string | null, idParent: string | null) {
    const pathname = item.pathname || null;
    return {
      tipo_utente: tipoUtente,
      ruolo_gdo: null,
      id_ruolo_utente_gdo: idRuoloGdo,
      titolo: item.titolo,
      tipo: item.tipo,
      icona: item.icona || null,
      pathname,
      // Non si sceglie a mano: è il permesso che la pagina richiede nel catalogo.
      codice_permesso: pathname ? (paginaPer(pathname)?.permesso ?? null) : null,
      disabilitato: item.disabilitato || false,
      start_page: item.start_page || false,
      ordinamento: item.ordinamento,
      id_parent: idParent,
    };
  }

  /**
   * Pagine di sistema aggiunte al menu del Superadmin se mancano, sotto 'GESTIONE INTERNA':
   * il seed MENU_SUPERADMIN non cambia e un menu gia' personalizzato le riceve comunque.
   */
  private static readonly VOCI_SISTEMA: MenuItemType[] = [
    { icon: 'LayoutDashboard', pathname: '/gestione-hub', title: 'Gestione Hub', subMenu: [] },
    { icon: 'KeyRound', pathname: '/gestione-metodi-accesso', title: 'Metodi di accesso', subMenu: [] },
  ];

  private ensureHubManagementEntry(menu: MenuElement[], tipoUtente: string): MenuElement[] {
    if (tipoUtente !== TIPO_UTENTI.SUPERADMIN || !Array.isArray(menu)) {
      return menu;
    }

    return MenuService.VOCI_SISTEMA.reduce((attuale, voce) => this.aggiungiVoceSistema(attuale, voce), menu);
  }

  private aggiungiVoceSistema(menu: MenuElement[], voce: MenuItemType): MenuElement[] {
    const alreadyPresent = menu.some(
      (item) => typeof item !== 'string' && item.pathname === voce.pathname
    );
    if (alreadyPresent) {
      return menu;
    }

    const nextMenu = [...menu];
    const hubItem: MenuItemType = { ...voce, subMenu: [] };

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
   * Converte un model Sequelize in un DTO per la UI.
   */
  private modelToDTO(item: any): MenuItemDTO {
    const pathname = item.getDataValue('pathname');
    const dto: MenuItemDTO = {
      id_menu_item: item.getDataValue('id_menu_item'),
      tipo_utente: item.getDataValue('tipo_utente'),
      id_ruolo_utente_gdo: item.getDataValue('id_ruolo_utente_gdo'),
      titolo: item.getDataValue('titolo'),
      tipo: item.getDataValue('tipo') as 'separator' | 'item',
      icona: item.getDataValue('icona'),
      pathname,
      codice_permesso: pathname ? (paginaPer(pathname)?.permesso ?? null) : null,
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
}
