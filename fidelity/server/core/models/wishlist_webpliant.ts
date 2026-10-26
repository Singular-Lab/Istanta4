import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

export type WishlistWebpliantAttributes = {
  id_whishlistwepliant: string;
  idcanale_whishlistwepliant: string;
  idarea_whishlistwepliant: string;
  idpv_whishlistwepliant?: string | null;
  meta_whishlistwepliant?: any;
  idworkspace_whishlistwepliant?: string;
  idpagina_whishlistwepliant?: string;
}

interface WishlistWebpliantCreationAttributes extends Optional<WishlistWebpliantAttributes, "id_whishlistwepliant"> { }

class WishlistWebpliant extends Model<WishlistWebpliantAttributes, WishlistWebpliantCreationAttributes> implements WishlistWebpliantAttributes {
  declare id_whishlistwepliant: string;
  declare idcanale_whishlistwepliant: string;
  declare idarea_whishlistwepliant: string;
  declare idpv_whishlistwepliant?: string | null;
  declare meta_whishlistwepliant?: any;
  declare idworkspace_whishlistwepliant?: string;
  declare idpagina_whishlistwepliant?: string;
}

const WishlistWebpliantDefine = sequelize.define<WishlistWebpliant>("wishlist_webpliant", {
  id_whishlistwepliant: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  idcanale_whishlistwepliant: {
    type: DataTypes.UUID,
    allowNull: false
  },
  idarea_whishlistwepliant: {
    type: DataTypes.UUID,
    allowNull: false
  },
  idpv_whishlistwepliant: {
    type: DataTypes.UUID,
    allowNull: true
  },
  meta_whishlistwepliant: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  idworkspace_whishlistwepliant: {
    type: DataTypes.UUID,
    allowNull: true
  },
  idpagina_whishlistwepliant: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  timestamps: false,
  tableName: "wishlist_webpliant",
  freezeTableName: true
});

export { WishlistWebpliantDefine as WishlistWebpliant };
