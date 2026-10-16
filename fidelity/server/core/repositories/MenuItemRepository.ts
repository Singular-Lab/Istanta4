import { QueryTypes, Transaction } from 'sequelize';
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

  /**
   * Menu di un tipo: con idRuoloGdo quello del sotto-ruolo, senza quello base.
   * Le righe storiche con la sola chiave testuale ruolo_gdo, non collegate a un
   * sotto-ruolo, non finiscono mai nel menu base.
   */
  private filtroRuolo(idRuoloGdo: string | null): Record<string, unknown> {
    return idRuoloGdo
      ? { id_ruolo_utente_gdo: idRuoloGdo }
      : { id_ruolo_utente_gdo: null, ruolo_gdo: null };
  }

  async findByTipoUtente(tipoUtente: string, idRuoloGdo: string | null): Promise<any[]> {
    this.ensureMenuItemAssociations();

    return MenuItem.findAll({
      where: {
        tipo_utente: tipoUtente,
        ...this.filtroRuolo(idRuoloGdo),
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
  async findMenuRuntimeByTipoUtente(tipoUtente: string, idRuoloGdo: string | null): Promise<any[]> {
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
        AND parent.id_ruolo_utente_gdo IS NOT DISTINCT FROM :idRuoloGdo
        AND (CAST(:idRuoloGdo AS uuid) IS NOT NULL OR parent.ruolo_gdo IS NULL)
        AND parent.id_parent IS NULL
        AND NULLIF(trim(parent.titolo), '') IS NOT NULL
      ORDER BY parent.ordinamento ASC
      `,
      {
        replacements: {
          tipoUtente,
          idRuoloGdo: idRuoloGdo ?? null,
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

  async bulkCreateItems(items: Omit<MenuItemAttributes, 'id_menu_item'>[], transaction?: Transaction): Promise<any[]> {
    return MenuItem.bulkCreate(
      items.map(item => ({
        ...item,
        createdat: new Date(),
        updatedat: new Date(),
      })) as any[],
      { ignoreDuplicates: false, transaction }
    );
  }

  async deleteByTipoUtente(tipoUtente: string, idRuoloGdo: string | null, transaction?: Transaction): Promise<number> {
    return MenuItem.destroy({
      where: {
        tipo_utente: tipoUtente,
        ...this.filtroRuolo(idRuoloGdo),
      },
      transaction,
    });
  }
}
