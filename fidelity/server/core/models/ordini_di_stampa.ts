import { DataTypes, Model, Optional } from 'sequelize';
import { STATO_ORDINI_STAMPA } from '../../../lib/enums';
import { OrdiniDiStampaAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';

interface OrdiniDiStampaCreationAttributes extends Optional<OrdiniDiStampaAttributes, "id_ordinistampa"> { }

class OrdiniDiStampa extends Model<OrdiniDiStampaAttributes, OrdiniDiStampaCreationAttributes> implements OrdiniDiStampaAttributes {
  declare idutente_ordinistampa: string;
  declare id_ordinistampa?: string;
  declare id_promo_ordinistampa: string;
  declare stato_ordinistampa: STATO_ORDINI_STAMPA;
  declare data_di_conferma_ordinistampa: string;
  declare createdat?: Date;
  declare updatedat?: Date;
}

const OrdiniDiStampaDefine = sequelize.define<OrdiniDiStampa>("ordini_stampa", {
  id_ordinistampa: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  idutente_ordinistampa: {
    type: DataTypes.UUID,
    allowNull: false
  },
  id_promo_ordinistampa: {
    type: DataTypes.STRING, // VARCHAR
    allowNull: false
  },
  stato_ordinistampa: {
    type: DataTypes.ENUM(...Object.values(STATO_ORDINI_STAMPA)),
    allowNull: false
  },

  data_di_conferma_ordinistampa: {
    type: DataTypes.DATE,
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
  tableName: "ordini_stampa",
  freezeTableName: true
});

export { OrdiniDiStampaDefine as OrdiniDiStampa };
