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
  declare datadiconferma_ordinistampa?: Date | null;
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
  // Colonna storica delle installazioni esistenti, non usata dal codice: si conserva col suo
  // tipo (TIMESTAMP senza fuso) e 0009 la aggiunge dove manca, cosi' lo schema e' uguale ovunque
  datadiconferma_ordinistampa: {
    type: 'TIMESTAMP',
    allowNull: true
  },
  // Obbligatorie (0005_obbligatorieta): le valorizza l'applicazione, che le crea senza indicarle
  createdat: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  // L'invio FTP la usa come blocco (OrdiniStampaService.prenotaInvio)
  updatedat: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: false,
  tableName: "ordini_stampa",
  freezeTableName: true
});

export { OrdiniDiStampaDefine as OrdiniDiStampa };
