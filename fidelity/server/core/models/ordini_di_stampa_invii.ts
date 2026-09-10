import { DataTypes, Model, Optional } from 'sequelize';
import { OrdiniDiStampaInviiAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';


interface OrdiniDiStampaInviiCreationAttributes extends Optional<OrdiniDiStampaInviiAttributes, "id_ordinistampainvii"> { }

class OrdiniDiStampaInvii extends Model<OrdiniDiStampaInviiAttributes, OrdiniDiStampaInviiCreationAttributes> implements OrdiniDiStampaInviiAttributes {
  declare id_ordinistampainvii: string;
  declare idutente_ordinistampainvii: string;
  declare idordinestampa_ordinistampainvii: string;
  declare excel_ordinistampainvii: Uint8Array;
  declare report_ordinistampainvii: any;
  declare segnalazione_ordinistampainvii: string;
  declare createdat?: Date;
  declare updatedat?: Date;
}



const OrdiniDiStampaInviiDefine = sequelize.define<OrdiniDiStampaInvii>("ordini_stampa_invii", {
  id_ordinistampainvii: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  idutente_ordinistampainvii: {
    type: DataTypes.UUID,
    allowNull: false
  },
  idordinestampa_ordinistampainvii: {
    type: DataTypes.UUID,
    allowNull: false
  },
  excel_ordinistampainvii: {
    type: DataTypes.BLOB,
    allowNull: false
  },
  report_ordinistampainvii: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  segnalazione_ordinistampainvii: {
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
  tableName: "ordini_stampa_invii",
  freezeTableName: true
});

export { OrdiniDiStampaInviiDefine as OrdiniDiStampaInvii };
