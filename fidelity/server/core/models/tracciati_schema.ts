import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';
import type { TracciatiSchemaConfronto, TracciatiSchemaItem } from '../../../lib/types';

export type TracciatiSchemaAttributes = {
  id?: string;
  nome: string;
  tipo: string[];
  items: TracciatiSchemaItem[];
  confronti: TracciatiSchemaConfronto[];
  createdat?: Date;
  updatedat?: Date;
};

type TracciatiSchemaCreationAttributes = Optional<TracciatiSchemaAttributes, 'id'>;

export class TracciatiSchemaClass
  extends Model<TracciatiSchemaAttributes, TracciatiSchemaCreationAttributes>
  implements TracciatiSchemaAttributes {
  declare id: string;
  declare nome: string;
  declare tipo: string[];
  declare items: TracciatiSchemaItem[];
  declare confronti: TracciatiSchemaConfronto[];
  declare createdat?: Date;
  declare updatedat?: Date;
}

const TracciatiSchema = sequelize.define<TracciatiSchemaClass>(
  'tracciati_schema',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: sequelize.fn('uuid_generate_v4'),
      primaryKey: true,
    },
    nome: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    tipo: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    confronti: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    items: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    createdat: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    updatedat: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    timestamps: false,
    tableName: 'tracciati_schema',
    freezeTableName: true,
  }
);

export { TracciatiSchema };
