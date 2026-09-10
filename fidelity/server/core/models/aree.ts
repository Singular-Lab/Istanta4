import { DataTypes, Model, Optional } from 'sequelize';
import { AreeAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';




type AreeCreationAttributes = Optional<AreeAttributes, 'id_aree'>;

class Area extends Model<AreeAttributes, AreeCreationAttributes> implements AreeAttributes {
  declare id_aree: string;
  declare codice_aree: string;
  declare nome_aree: string;
  declare id_gdo_aree: string;
  declare createdat?: Date;
  declare updatedat: Date;
}
// usa sequelize.define per definire il modello

const Aree = sequelize.define<Area>("aree", {
  id_aree: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  codice_aree: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nome_aree: {
    type: DataTypes.STRING,
    allowNull: false
  },
  id_gdo_aree: {
    type: DataTypes.UUID,
    allowNull: false
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
  tableName: "aree",
  freezeTableName: true
});

export { Aree as Area };
