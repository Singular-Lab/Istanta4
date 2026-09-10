import { DataTypes, Model, Optional } from 'sequelize';
import { TracciatiAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';


type TracciatiCreationAttributes = Optional<TracciatiAttributes, 'id_tracciati'>;

class TracciatiClass extends Model<TracciatiAttributes, TracciatiCreationAttributes> implements TracciatiAttributes {
  declare id_tracciati: string;
  declare id_promo_tracciati: string;
  declare context_tracciati: any;
  declare stato_tracciati?: string;
  declare filename_tracciati: string;
  declare blobfile_tracciati: Uint8Array;
  declare createdat?: Date;
  declare updatedat: Date;

}

// usa sequelize.define per definire il modello
const Tracciati = sequelize.define<TracciatiClass>("tracciati", {
  id_tracciati: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  id_promo_tracciati: {
    type: DataTypes.UUID,
    allowNull: false
  },
  context_tracciati: {
    type: DataTypes.JSON,
    allowNull: false
  },
  filename_tracciati: {
    type: DataTypes.STRING,
    allowNull: false
  },
  blobfile_tracciati: {
    type: DataTypes.BLOB,
    allowNull: false
  },
  stato_tracciati: {
    type: DataTypes.STRING,
    allowNull: true
  },
  createdat: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  },
  updatedat: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: false,
  tableName: "tracciati",
  freezeTableName: true
});

export { Tracciati as Tracciati };
