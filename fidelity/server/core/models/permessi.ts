import { DataTypes, Model, Optional } from 'sequelize';
import { CATEGORIA_PERMESSO } from '../../../lib/enums';
import { PermessoAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';

type PermessoCreationAttributes = Optional<PermessoAttributes, 'id_permesso'>;

class PermessoClass extends Model<PermessoAttributes, PermessoCreationAttributes> implements PermessoAttributes {
  declare id_permesso: string;
  declare codice: string;
  declare nome: string;
  declare descrizione?: string;
  declare categoria: string;
  declare risorsa: string;
  declare createdat?: Date;
  declare updatedat: Date;
}

const Permesso = sequelize.define<PermessoClass>("permessi", {
  id_permesso: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  codice: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  nome: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  descrizione: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  categoria: {
    type: DataTypes.ENUM(...Object.values(CATEGORIA_PERMESSO)),
    allowNull: false,
  },
  risorsa: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  createdat: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  updatedat: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: false,
  tableName: "permessi",
  freezeTableName: true,
  indexes: [
    { name: 'permessi_codice_uq', unique: true, fields: ['codice'] },
    { fields: ['categoria'] },
    { fields: ['risorsa'] },
  ],
});

export { Permesso };
