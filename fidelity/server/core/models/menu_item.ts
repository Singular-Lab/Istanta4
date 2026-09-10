import { DataTypes, Model, Optional } from 'sequelize';
import { TIPO_MENU_ITEM, TIPO_UTENTI } from '../../../lib/enums';
import { MenuItemAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';

type MenuItemCreationAttributes = Optional<MenuItemAttributes, 'id_menu_item'>;

class MenuItemClass extends Model<MenuItemAttributes, MenuItemCreationAttributes> implements MenuItemAttributes {
  declare id_menu_item: string;
  declare tipo_utente: TIPO_UTENTI;
  declare ruolo_gdo?: string | null;
  declare titolo: string;
  declare tipo: string;
  declare icona?: string | null;
  declare pathname?: string | null;
  declare codice_permesso?: string | null;
  declare disabilitato?: boolean;
  declare start_page?: boolean;
  declare ordinamento: number;
  declare id_parent?: string | null;
  declare createdat?: Date;
  declare updatedat?: Date;
}

const MenuItem = sequelize.define<MenuItemClass>("menu_items", {
  id_menu_item: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  tipo_utente: {
    type: DataTypes.ENUM(...Object.values(TIPO_UTENTI)),
    allowNull: false,
  },
  ruolo_gdo: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  titolo: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  tipo: {
    type: DataTypes.ENUM(...Object.values(TIPO_MENU_ITEM)),
    allowNull: false,
  },
  icona: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  pathname: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  codice_permesso: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  disabilitato: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  start_page: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  ordinamento: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  id_parent: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  createdat: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  updatedat: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: false,
  tableName: "menu_items",
  freezeTableName: true,
  indexes: [
    {
      fields: ['tipo_utente', 'ruolo_gdo', 'ordinamento'],
      name: 'menu_items_order',
    },
  ],
});

export { MenuItem };
