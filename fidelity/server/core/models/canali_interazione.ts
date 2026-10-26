import { DataTypes, Model, Optional } from 'sequelize';
import { STATO_CANALI_INTERAZIONE, TIPI_CANALI_INTERAZIONE } from '../../../lib/enums';
import { CanaliInterazioneAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';


type CanaliInterazioneCreationAttributes = Optional<CanaliInterazioneAttributes, 'id_canaliinterazione'>;

class CanaliInterazione extends Model<CanaliInterazioneAttributes, CanaliInterazioneCreationAttributes> implements CanaliInterazioneCreationAttributes {
  declare id_canaliinterazione: string;
  declare idutente_canaliinterazione: string;
  declare tipo_canaliinterazione: TIPI_CANALI_INTERAZIONE;
  declare stato_canaliinterazione: STATO_CANALI_INTERAZIONE;
}

// usa sequelize.define per definire il modello

const CanaleInterazione = sequelize.define<CanaliInterazione>("canali_interazione", {
  id_canaliinterazione: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  idutente_canaliinterazione: {
    type: DataTypes.UUID
  },
  tipo_canaliinterazione: {
    type: DataTypes.ENUM(...Object.values(TIPI_CANALI_INTERAZIONE))
  },
  stato_canaliinterazione: {
    type: DataTypes.ENUM(...Object.values(STATO_CANALI_INTERAZIONE))
  }
}, {
  timestamps: false,
  tableName: "canali_interazione",
  freezeTableName: true
});

export { CanaleInterazione as CanaleInterazione };
