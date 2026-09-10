import { DataTypes, Model, Optional } from 'sequelize';
import { UtentiGDOAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';


type UtentiGDOCreationAttributes = Optional<UtentiGDOAttributes, 'id_utentegdo'>;


class UtentiGDOClass extends Model<UtentiGDOAttributes, UtentiGDOCreationAttributes> implements UtentiGDOAttributes {
  declare id_utentegdo: string;
  declare id_utente_utentegdo: string;
  declare id_gdo_utentegdo: string;
  declare id_ruolo_utente_gdo?: string;
  declare createdat?: Date;
  declare updatedat: Date;

}

const UtentiGDO = sequelize.define<UtentiGDOClass>("utenti_gdo", {
  id_utentegdo: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  id_utente_utentegdo: {
    type: DataTypes.UUID,
    allowNull: false
  },
  id_gdo_utentegdo: {
    type: DataTypes.UUID,
    allowNull: false
  },
  id_ruolo_utente_gdo: {
    type: DataTypes.UUID,
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
  tableName: "utenti_gdo",
  freezeTableName: true,
  indexes: [
    {
      unique: true,
      fields: ['id_utente_utentegdo'],
      name: 'utenti_gdo_utente_unique'
    }
  ]
});


export { UtentiGDO as UtentiGDO };
