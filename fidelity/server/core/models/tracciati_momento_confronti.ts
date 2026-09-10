import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

export type TracciatiMomentoConfrontiAttributes = {
  id?: string;
  primario: string;
  secondario: string;
  tipo: 'lineare' | 'non_lineare';
  risultato?: unknown | null;
  report?: unknown | null;
  terremoto_degrado_massimo?: number | null;
  createdat?: Date;
  updatedat?: Date;
};

type TracciatiMomentoConfrontiCreationAttributes = Optional<TracciatiMomentoConfrontiAttributes, 'id'>;

export class TracciatiMomentoConfrontiClass
  extends Model<TracciatiMomentoConfrontiAttributes, TracciatiMomentoConfrontiCreationAttributes>
  implements TracciatiMomentoConfrontiAttributes {
  declare id: string;
  declare primario: string;
  declare secondario: string;
  declare tipo: 'lineare' | 'non_lineare';
  declare risultato?: unknown | null;
  declare report?: unknown | null;
  declare terremoto_degrado_massimo?: number | null;
  declare createdat?: Date;
  declare updatedat?: Date;
}

const TracciatiMomentoConfronti = sequelize.define(
  'tracciati_momento_confronti',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: sequelize.fn('uuid_generate_v4'),
      primaryKey: true,
    },
    primario: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    secondario: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    tipo: {
      type: DataTypes.ENUM('lineare', 'non_lineare'),
      allowNull: false,
      defaultValue: 'lineare',
    },
    risultato: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
    },
    report: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null
    },
    terremoto_degrado_massimo: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: null,
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
    tableName: 'tracciati_momento_confronti',
    freezeTableName: true,
  }
) as typeof TracciatiMomentoConfrontiClass;

export { TracciatiMomentoConfronti };
