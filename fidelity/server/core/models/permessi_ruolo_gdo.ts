import { DataTypes, Model, Optional } from 'sequelize';
import { TIPO_UTENTI } from '../../../lib/enums';
import { PermessoRuoloGdoAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';

type PermessoRuoloGdoCreationAttributes = Optional<PermessoRuoloGdoAttributes, 'id_permesso_ruolo_gdo'>;

class PermessoRuoloGdoClass extends Model<PermessoRuoloGdoAttributes, PermessoRuoloGdoCreationAttributes> implements PermessoRuoloGdoAttributes {
  declare id_permesso_ruolo_gdo: string;
  declare id_gdo: string;
  declare tipo_utente: string;
  declare id_permesso: string;
  declare id_ruolo_utente_gdo?: string;
  declare abilitato: boolean;
  declare createdat?: Date;
  declare updatedat: Date;
}

const PermessoRuoloGdo = sequelize.define<PermessoRuoloGdoClass>("permessi_ruolo_gdo", {
  id_permesso_ruolo_gdo: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  id_gdo: {
    type: DataTypes.UUID,
    allowNull: false,
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
  tableName: "permessi_ruolo_gdo",
  freezeTableName: true,
  indexes: [
    // L'indice univoco è gestito via raw SQL con COALESCE per gestire i NULL
    // su id_ruolo_utente_gdo (vedi PermessiRepository.migrateLegacyGdoConstraint)
    { fields: ['id_gdo'] },
  ],
});

export { PermessoRuoloGdo };
