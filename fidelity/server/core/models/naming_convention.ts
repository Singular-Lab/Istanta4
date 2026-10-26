import { DataTypes, Model, Optional } from 'sequelize';
import { NamingConventionAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';


type NamingConventionCreationAttributes = Optional<NamingConventionAttributes, 'id_naming_convention'>;

class NamingConventionClass extends Model<NamingConventionAttributes, NamingConventionCreationAttributes> implements NamingConventionAttributes {
  declare descrizione_naming_convention: string;
  declare fields_naming_convention: string[];
  declare id_naming_convention: string;
  declare nome_naming_convention: string;
  declare createdat?: Date;
  declare updatedat: Date;

}

// usa sequelize.define per definire il modello


const NamingConventions = sequelize.define<NamingConventionClass>("naming_convention", {
  id_naming_convention: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  nome_naming_convention: {
    type: DataTypes.STRING,
    allowNull: false
  },
  descrizione_naming_convention: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fields_naming_convention: {
    type: DataTypes.ARRAY(DataTypes.STRING),
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
  tableName: "naming_convention",
  freezeTableName: true
});

export { NamingConventions as NamingConvention };
