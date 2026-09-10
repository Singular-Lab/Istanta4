
import { DataTypes, Model, Optional } from 'sequelize';
import { RuoloUtenteGDOAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';


type RuoloUtenteGDOCreationAttributes = Optional<RuoloUtenteGDOAttributes, 'id_ruolo_utente_gdo'>;


class RuoloUtenteGDOClass extends Model<RuoloUtenteGDOAttributes, RuoloUtenteGDOCreationAttributes> implements RuoloUtenteGDOAttributes {
  declare id_ruolo_utente_gdo: string;
  declare ruolo_ruolo_utente_gdo: string;
  declare api_key_ruolo_utente_gdo?: string;
  declare createdat?: Date;
  declare updatedat: Date;
}


const RuoloUtenteGDO = sequelize.define<RuoloUtenteGDOClass>("ruolo_utente_gdo", {
  id_ruolo_utente_gdo: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  ruolo_ruolo_utente_gdo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  api_key_ruolo_utente_gdo: {
    type: DataTypes.STRING,
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
  tableName: "ruolo_utente_gdo",
  freezeTableName: true
});

export { RuoloUtenteGDO as RuoloUtenteGDO };
