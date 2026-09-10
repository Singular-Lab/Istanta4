import { DataTypes, Model, Optional } from 'sequelize';
import { UtentiAnonimiAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';



interface UtentiAnonimiCreationAttributes extends Optional<UtentiAnonimiAttributes, "id_utenti_anonimi"> { }

class UtentiAnonimi extends Model<UtentiAnonimiAttributes, UtentiAnonimiCreationAttributes> implements UtentiAnonimiAttributes {
  declare id_utenti_anonimi?: string;
  declare meta_utenti_anonimi: object;
  declare createdat?: Date;
  declare updatedat?: Date;
}

const UtentiAnonimiDefine = sequelize.define<UtentiAnonimi>("utenti_anonimi", {
  id_utenti_anonimi: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true
  },
  meta_utenti_anonimi: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  createdat: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updatedat: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: false,
  tableName: "utenti_anonimi",
  freezeTableName: true
});

export { UtentiAnonimiDefine as UtentiAnonimi };
