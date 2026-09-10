import { TIPO_UTENTI } from '../../../lib/enums';
import { MenuElement } from '../../../lib/types';

export interface MenuItemDTO {
  id_menu_item?: string;
  tipo_utente: TIPO_UTENTI;
  ruolo_gdo?: string | null;
  titolo: string;
  tipo: 'separator' | 'item';
  icona?: string | null;
  pathname?: string | null;
  codice_permesso?: string | null;
  disabilitato?: boolean;
  start_page?: boolean;
  ordinamento: number;
  id_parent?: string | null;
  subMenu?: MenuItemDTO[];
}

export interface IMenuService {
  getMenuPerUtente(tipoUtente: string, ruoloGdo?: string): Promise<MenuElement[]>;
  getMenuItemsPerUtente(tipoUtente: string, ruoloGdo?: string): Promise<MenuItemDTO[]>;
  getAllMenuConfigurations(): Promise<Record<string, MenuItemDTO[]>>;
  saveMenu(tipoUtente: string, ruoloGdo: string | null, items: MenuItemDTO[]): Promise<void>;
  invalidateCache(tipoUtente?: string, ruoloGdo?: string): void;
  seedMenuDaJson(): Promise<void>;
}
