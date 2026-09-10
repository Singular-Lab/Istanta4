import { DataTypes, Model, Optional } from 'sequelize';
import type { ContextConfronto, ResultConfrontoItem, TracciatoReport } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';

export type TracciatiReportAttributes = {
  id?: string;
  id_promo: string;
  tracciati_ids: string[];
  context: ContextConfronto[];
  istanta_result: ResultConfrontoItem[];
  report: TracciatoReport;
  createdat?: Date;
  updatedat?: Date;
};

type TracciatiReportCreationAttributes = Optional<TracciatiReportAttributes, 'id'>;

export class TracciatiReportClass
  extends Model<TracciatiReportAttributes, TracciatiReportCreationAttributes>
  implements TracciatiReportAttributes {
  declare id: string;
  declare id_promo: string;
  declare tracciati_ids: string[];
  declare context: ContextConfronto[];
  declare istanta_result: ResultConfrontoItem[];
  declare report: TracciatoReport;
  declare createdat?: Date;
  declare updatedat?: Date;
}

const TracciatiReport = sequelize.define<TracciatiReportClass>(
  'tracciati_report',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: sequelize.fn('uuid_generate_v4'),
      primaryKey: true,
    },
    id_promo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    tracciati_ids: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    context: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    istanta_result: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    report: {
      type: DataTypes.JSONB,
      allowNull: false,
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
    tableName: 'tracciati_report',
    freezeTableName: true,
  }
);

export { TracciatiReport };
