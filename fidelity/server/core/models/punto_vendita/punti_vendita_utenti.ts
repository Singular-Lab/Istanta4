import { DataTypes, Model, Optional } from 'sequelize';
import { PuntiVenditaUtentiAttributes } from '../../../../lib/types';
import { sequelize } from '../../db/SequelizeConnector';


type PuntiVenditaUtentiCreationAttributes = Optional<PuntiVenditaUtentiAttributes, 'id_puntivenditautenti'>;


class PuntoVenditaUtenti extends Model<PuntiVenditaUtentiAttributes, PuntiVenditaUtentiCreationAttributes> implements PuntiVenditaUtentiAttributes {
  declare id_puntivenditautenti: string;
  declare idutenti_puntivenditautenti: string;
  declare idpuntivendita_puntivenditautenti: string;
  // declare tipoUtentiPuntoVendita_PuntiVenditaUtenti:string;
  declare createdat?: Date;
  declare updatedat: Date;
}

// usa sequelize.define per definire il modello

const PuntiVenditaUtenti = sequelize.define<PuntoVenditaUtenti>("punti_vendita_utenti", {
  id_puntivenditautenti: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  idutenti_puntivenditautenti: {
    type: DataTypes.UUID,
    allowNull: false
  },
  idpuntivendita_puntivenditautenti: {
    type: DataTypes.UUID,
    allowNull: false
  },
  // tipoUtentiPuntoVendita_PuntiVenditaUtenti: {
  //     type: DataTypes.STRING,
  //     allowNull: true
  // },
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
  tableName: "punti_vendita_utenti",
  freezeTableName: true
});

export { PuntiVenditaUtenti as PuntoVenditaUtenti };
