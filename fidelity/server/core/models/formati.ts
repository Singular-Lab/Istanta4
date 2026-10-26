import { DataTypes, Model, Optional } from 'sequelize';
import { FormatiAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';


type FormatiCreationAttributes = Optional<FormatiAttributes, "id_formati">;


class FormatiClass extends Model<FormatiAttributes, FormatiCreationAttributes> implements FormatiAttributes {
  declare id_formati: string;
  declare nome_formati: string;
  declare codice_formati: string;
  declare descrizione_formati: string;
  declare tipo_lavorazione_formati: number;
  declare createdat?: Date;
  declare updatedat: Date;

}


// usa sequelize.define per definire il modello

const Formati = sequelize.define<FormatiClass>("formati", {
  id_formati: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true
  },
  nome_formati: {
    type: DataTypes.STRING,
    allowNull: false
  },
  codice_formati: {
    type: DataTypes.STRING,
    allowNull: false
  },
  descrizione_formati: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tipo_lavorazione_formati: {
    type: DataTypes.INTEGER,
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
  tableName: "formati",
  freezeTableName: true
});


export { Formati as Formati };
