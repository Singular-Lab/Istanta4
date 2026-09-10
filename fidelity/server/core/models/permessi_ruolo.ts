import { DataTypes, Model, Optional } from 'sequelize';
import { TIPO_UTENTI } from '../../../lib/enums';
import { PermessoRuoloAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';

type PermessoRuoloCreationAttributes = Optional<PermessoRuoloAttributes, 'id_permesso_ruolo'>;

class PermessoRuoloClass extends Model<PermessoRuoloAttributes, PermessoRuoloCreationAttributes> implements PermessoRuoloAttributes {
  declare id_permesso_ruolo: string;
  declare tipo_utente: string;
  declare id_permesso: string;
  declare id_ruolo_utente_gdo?: string;
  declare abilitato: boolean;
  declare createdat?: Date;
  declare updatedat: Date;
}

const PermessoRuolo = sequelize.define<PermessoRuoloClass>("permessi_ruolo", {
  id_permesso_ruolo: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  tipo_utente: {
    type: DataTypes.ENUM(...Object.values(TIPO_UTENTI)),
    allowNull: false,
  },
  id_permesso: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  id_ruolo_utente_gdo: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  abilitato: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
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
  tableName: "permessi_ruolo",
  freezeTableName: true,
  indexes: [
    {
      unique: true,
      fields: ['tipo_utente', 'id_permesso', 'id_ruolo_utente_gdo'],
    },
  ],
});

export { PermessoRuolo };
