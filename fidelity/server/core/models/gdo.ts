import { DataTypes, Model, Optional } from 'sequelize';
import { GDOAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';




type GDOCreationAttributes = Optional<GDOAttributes, 'id_gdo'>;

class GDO extends Model<GDOAttributes, GDOCreationAttributes> implements GDOAttributes {
  declare id_gdo: string;
  declare nome_gdo: string;
  declare idparent_gdo: string;
  declare ragione_sociale_gdo?: string;
  declare icona_gdo?: Buffer;
  declare createdat?: Date;
  declare updatedat: Date;

}
// usa sequelize.define per definire il modello

const GDOs = sequelize.define<GDO>("gdo", {
  id_gdo: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  nome_gdo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  idparent_gdo: {
    type: DataTypes.UUID,
    allowNull: true
  },
  ragione_sociale_gdo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  icona_gdo: {
    type: DataTypes.BLOB,
    allowNull: true
  },
  createdat: {
    type: DataTypes.DATE,
    allowNull: true
  },
  updatedat: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: false,
  tableName: "gdo",
  freezeTableName: true
});

export { GDOs as GDO };
