import { DataTypes, Model, Optional } from 'sequelize';
import { RuoloPuntoVenditaAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';



type RuoloPuntoVenditaCreationAttributes = Optional<RuoloPuntoVenditaAttributes, 'id_ruolo_punto_vendita'>;


class RuoloPuntoVenditaClass extends Model<RuoloPuntoVenditaAttributes, RuoloPuntoVenditaCreationAttributes> implements RuoloPuntoVenditaAttributes {
  declare id_ruolo_punto_vendita: string;
  declare ruolo_ruolo_punto_vendita: string;
  declare createdat?: Date;
  declare updatedat: Date;
}

// usa sequelize.define per definire il modello

const RuoloPuntoVendita = sequelize.define<RuoloPuntoVenditaClass>("ruolo_punto_vendita", {
  id_ruolo_punto_vendita: {
    type: DataTypes.UUID,
    // Sì, è corretto: in questo modo imposti come valore di default la funzione Postgres uuid_generate_v4.
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  ruolo_ruolo_punto_vendita: {
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
  tableName: "ruolo_punto_vendita",
  freezeTableName: true
});

export { RuoloPuntoVendita as RuoloPuntoVendita };
