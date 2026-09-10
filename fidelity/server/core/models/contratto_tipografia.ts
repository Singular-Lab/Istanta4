import { DataTypes, Model, Optional } from 'sequelize';
import { ContrattoTipografiaAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';

type ContrattoTipografiaCreationAttributes = Optional<ContrattoTipografiaAttributes, 'id_contrattotipografia'>;

class ContrattoTipografia extends Model<ContrattoTipografiaAttributes, ContrattoTipografiaCreationAttributes> implements ContrattoTipografiaAttributes {
  declare id_contrattotipografia?: string;
  declare nome_contrattotipografia: string;
  declare tipiexport_contrattotipografia: string[];
  declare id_gdo_contrattotipografia: string;
  declare json_contrattotipografia?: any;
  declare user_ftp_contrattotipografia?: string;
  declare host_ftp_contrattotipografia?: string;
  declare pwd_ftp_contrattotipografia?: string;
  declare port_ftp_contrattotipografia?: number;
  declare createdat?: Date;
  declare updatedat?: Date;
}



const ContrattoTipografiaModel = sequelize.define<ContrattoTipografia>("contratto_tipografia", {
  id_contrattotipografia: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  tipiexport_contrattotipografia: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false
  },
  nome_contrattotipografia: {
    type: DataTypes.STRING,
    allowNull: false
  },
  id_gdo_contrattotipografia: {
    type: DataTypes.UUID,
    allowNull: false
  },
  user_ftp_contrattotipografia: {
    type: DataTypes.STRING,
    allowNull: true
  },
  host_ftp_contrattotipografia: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pwd_ftp_contrattotipografia: {
    type: DataTypes.STRING,
    allowNull: true
  },
  port_ftp_contrattotipografia: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
      max: 65535
    }
  },
  json_contrattotipografia: {
    type: DataTypes.JSONB,
    allowNull: true
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
  tableName: "contratto_tipografia",
  freezeTableName: true
});


export { ContrattoTipografiaModel as ContrattoTipografia }; // esporta il modello ContrattoTipografia per poterlo usare in altri file
