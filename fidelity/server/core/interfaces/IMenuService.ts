import { TIPO_UTENTI } from '../../../lib/enums';
import { MenuElement } from '../../../lib/types';
import type { ContestoAccesso } from '../accessi/contestoAccesso';

export interface MenuItemDTO {
  id_menu_item?: string;
  tipo_utente: TIPO_UTENTI;
  /** Sotto-ruolo GDO del menu (null = menu base del tipo). */
  id_ruolo_utente_gdo?: string | null;
  titolo: string;
  tipo: 'separator' | 'item';
  icona?: string | null;
  pathname?: string | null;
  /** Permesso richiesto dalla pagina: ricavato dal catalogo delle pagine, in sola lettura. */
  codice_permesso?: string | null;
  disabilitato?: boolean;
  start_page?: boolean;
  ordinamento: number;
  id_parent?: string | null;
  subMenu?: MenuItemDTO[];
}

export interface IMenuService {
  /** Menu configurato per tipo e sotto-ruolo, senza filtri (per la gestione). */
  getMenuConfigurato(tipoUtente: TIPO_UTENTI, idRuoloGdo?: string | null): Promise<MenuElement[]>;
  /** Menu dell'utente: solo le voci delle pagine che può aprire. */
  getMenuDiUtente(contesto: ContestoAccesso): Promise<MenuElement[]>;
  getMenuItemsPerUtente(tipoUtente: TIPO_UTENTI, idRuoloGdo?: string | null): Promise<MenuItemDTO[]>;
  saveMenu(tipoUtente: TIPO_UTENTI, idRuoloGdo: string | null, items: MenuItemDTO[]): Promise<void>;
  /** Riporta il solo menu del Superadmin a quello predefinito; restituisce il numero di voci. */
  ripristinaMenuPredefiniti(): Promise<number>;
}
