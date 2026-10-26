import { DataTypes, Model, Optional } from 'sequelize';
import { CombinazioneCanaleAreaAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';


type CombinazioneCanaleAreaCreationAttributes = Optional<CombinazioneCanaleAreaAttributes, 'id_combinazione_canale_area'>;

class CombinazioneCanaleArea extends Model<CombinazioneCanaleAreaAttributes, CombinazioneCanaleAreaCreationAttributes> implements CombinazioneCanaleAreaAttributes {
  declare id_combinazione_canale_area: string;
  declare id_canale_combinazione_canale_area: string;
  declare id_area_combinazione_canale_area: string;
  declare stato_combinazione_canale_area: string;
  declare id_gdo_combinazione_canale_area: string;
  declare createdat?: Date;
  declare updatedat: Date;
}

const CombinazioniCanaliAree = sequelize.define<CombinazioneCanaleArea>("combinazioni_canali_aree", {
  id_combinazione_canale_area: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  id_gdo_combinazione_canale_area: {
    type: DataTypes.UUID,
    allowNull: false
  },
  id_canale_combinazione_canale_area: {
    type: DataTypes.UUID,
    allowNull: false
  },
  id_area_combinazione_canale_area: {
    type: DataTypes.UUID,
    allowNull: false
  },
  stato_combinazione_canale_area: {
    type: DataTypes.ENUM('ATTIVO', 'DISATTIVO'),
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
  tableName: "combinazione_canale_area",
  freezeTableName: true
});

export { CombinazioniCanaliAree as CombinazioneCanaleArea }; // esporta il modello CombinazioneCanaleArea per poterlo usare in altri file
