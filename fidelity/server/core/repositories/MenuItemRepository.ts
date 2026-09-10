import { QueryTypes } from 'sequelize';
import { TIPO_MENU_ITEM } from '../../../lib/enums';
import { MenuItemAttributes } from '../../../lib/types';
import { MenuItem } from '../models';
import { configuraRelazioni } from '../models/relazioni';

export class MenuItemRepository {
  /**
   * Garantisce che la self-association di MenuItem sia disponibile
   * prima di eseguire include/order su alias `subMenu`.
   */
  private ensureMenuItemAssociations(): void {
    if (!MenuItem.associations?.subMenu || !MenuItem.associations?.parent) {
      configuraRelazioni();
    }
  }

  async findByTipoUtente(tipoUtente: string, ruoloGdo?: string | null): Promise<any[]> {
    this.ensureMenuItemAssociations();

    return MenuItem.findAll({
      where: {
        tipo_utente: tipoUtente,
        ruolo_gdo: ruoloGdo ?? null,
        id_parent: null,
      },
      include: [{
        model: MenuItem,
        as: 'subMenu',
        required: false,
      }],
      order: [
        ['ordinamento', 'ASC'],
        [{ model: MenuItem, as: 'subMenu' }, 'ordinamento', 'ASC'],
      ],
    });
  }

  /**
   * Restituisce direttamente il menu nel formato runtime frontend
   * (string separatori + object items), costruito da query SQL.
   */
  async findMenuRuntimeByTipoUtente(tipoUtente: string, ruoloGdo?: string | null): Promise<any[]> {
    const rows = await MenuItem.sequelize!.query<{ menu_entry: unknown }>(
      `
      SELECT
        CASE
          WHEN parent.tipo = :separatorType THEN to_jsonb(trim(parent.titolo))
          ELSE jsonb_strip_nulls(
            jsonb_build_object(
              'icon', COALESCE(NULLIF(parent.icona, ''), 'Circle'),
              'pathname', NULLIF(parent.pathname, ''),
              'title', parent.titolo,
              'disabled', CASE WHEN parent.disabilitato THEN true ELSE NULL END,
              'start_page', CASE WHEN parent.start_page THEN true ELSE NULL END,
              'subMenu', COALESCE(
                (
                  SELECT jsonb_agg(
                    jsonb_strip_nulls(
                      jsonb_build_object(
                        'icon', COALESCE(NULLIF(child.icona, ''), 'Circle'),
                        'pathname', NULLIF(child.pathname, ''),
                        'title', child.titolo,
                        'disabled', CASE WHEN child.disabilitato THEN true ELSE NULL END,
                        'start_page', CASE WHEN child.start_page THEN true ELSE NULL END
                      )
                    )
                    ORDER BY child.ordinamento
                  )
                  FROM menu_items child
                  WHERE child.id_parent = parent.id_menu_item
                ),
                '[]'::jsonb
              )
            )
          )
        END AS menu_entry
      FROM menu_items parent
      WHERE parent.tipo_utente = :tipoUtente
        AND parent.ruolo_gdo IS NOT DISTINCT FROM :ruoloGdo
        AND parent.id_parent IS NULL
        AND NULLIF(trim(parent.titolo), '') IS NOT NULL
      ORDER BY parent.ordinamento ASC
      `,
      {
        replacements: {
          tipoUtente,
          ruoloGdo: ruoloGdo ?? null,
          separatorType: TIPO_MENU_ITEM.SEPARATOR,
        },
        type: QueryTypes.SELECT,
      }
    );

    return rows
      .map((row) => row.menu_entry)
      .filter((entry) => entry !== null && entry !== undefined)
      .map((entry) => {
        if (typeof entry === 'string') {
          try {
            return JSON.parse(entry);
          } catch {
            return entry;
          }
        }
        return entry;
      });
  }

  async findAll(): Promise<any[]> {
    this.ensureMenuItemAssociations();

    return MenuItem.findAll({
      where: { id_parent: null },
      include: [{
        model: MenuItem,
        as: 'subMenu',
        required: false,
      }],
      order: [
        ['tipo_utente', 'ASC'],
        ['ruolo_gdo', 'ASC'],
        ['ordinamento', 'ASC'],
      ],
    });
  }

  async bulkCreateItems(items: Omit<MenuItemAttributes, 'id_menu_item'>[]): Promise<any[]> {
    return MenuItem.bulkCreate(
      items.map(item => ({
        ...item,
        createdat: new Date(),
        updatedat: new Date(),
      })) as any[],
      { ignoreDuplicates: false }
    );
  }

  async deleteByTipoUtente(tipoUtente: string, ruoloGdo?: string | null): Promise<number> {
    return MenuItem.destroy({
      where: {
        tipo_utente: tipoUtente,
        ruolo_gdo: ruoloGdo ?? null,
      },
    });
  }

  async deleteAll(): Promise<number> {
    return MenuItem.destroy({ where: {} });
  }

  async count(): Promise<number> {
    return MenuItem.count();
  }
}
