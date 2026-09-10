import { DataTypes, Model, Optional } from 'sequelize';
import { FICO_ORIGIN } from '../../../lib/enums';
import { sequelize } from '../db/SequelizeConnector';

type UtentiGuestAttributes = {
  id_UtentiGuest: string,
  dettagliUtente_UtentiGuest: string,
  origine_UtentiGuest: FICO_ORIGIN,
  email_UtentiGuest: string,
  createdat?: Date,
  updatedat: Date
}

type UtentiGuestCreationAttributes = Optional<UtentiGuestAttributes, 'id_UtentiGuest'>;

class UtentiGuestExt extends Model<UtentiGuestAttributes, UtentiGuestCreationAttributes> implements UtentiGuestAttributes {
  declare id_UtentiGuest: string;
  declare dettagliUtente_UtentiGuest: string;
  declare origine_UtentiGuest: FICO_ORIGIN;
  declare email_UtentiGuest: string;
  declare createdat?: Date;
  declare updatedat: Date;
}


const UtentiGuest = sequelize.define<UtentiGuestExt>("utenti_guest", {
  id_UtentiGuest: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  dettagliUtente_UtentiGuest: {
    type: DataTypes.STRING,
    allowNull: false
  },
  origine_UtentiGuest: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email_UtentiGuest: {
    type: DataTypes.STRING,
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
  tableName: "utenti_guest",
  freezeTableName: true
});

export { UtentiGuest };
