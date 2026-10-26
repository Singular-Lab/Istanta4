import { DataTypes, Model, Optional, UUIDV4 } from 'sequelize';
import { CanaliAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';



type CanaliCreationAttributes = Optional<CanaliAttributes, 'id_canali'>;

class Canale extends Model<CanaliAttributes, CanaliCreationAttributes> implements CanaliAttributes {
  declare id_canali: string;
  declare codice_canali: string;
  declare nome_canali: string;
  declare id_gdo_canali: string;
  declare createdat?: Date;
  declare updatedat: Date;
}

// usa sequelize.define per definire il modello

const Canali = sequelize.define<Canale>("canali", {
  id_canali: {
    type: DataTypes.UUID,
    defaultValue: UUIDV4,
    primaryKey: true
  },
  codice_canali: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nome_canali: {
    type: DataTypes.STRING,
    allowNull: false
  },
  id_gdo_canali: {
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
  tableName: "canali",
  freezeTableName: true
});

export { Canali as Canale };
