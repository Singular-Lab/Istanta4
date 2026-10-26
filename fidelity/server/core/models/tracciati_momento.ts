import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

export type TracciatiMomentoAttributes = {
  id?: string;
  id_promo: string;
  nome: string;
  tracciati_ids: string[];
  confronti_ids: string[];
  ordine: number;
  snapshot: boolean;
  risultato: any;
  createdat?: Date;
  updatedat?: Date;
};

type TracciatiMomentoCreationAttributes = Optional<TracciatiMomentoAttributes, 'id'>;

export class TracciatiMomentoClass
  extends Model<TracciatiMomentoAttributes, TracciatiMomentoCreationAttributes>
  implements TracciatiMomentoAttributes {
  declare id: string;
  declare id_promo: string;
  declare nome: string;
  declare tracciati_ids: string[];
  declare confronti_ids: string[];
  declare ordine: number;
  declare snapshot: boolean;
  declare risultato: any;
  declare createdat?: Date;
  declare updatedat?: Date;
}

const TracciatiMomento = sequelize.define<TracciatiMomentoClass>(
  'tracciati_momento',
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
    nome: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    tracciati_ids: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    confronti_ids: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    ordine: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    snapshot: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    risultato: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null
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
    tableName: 'tracciati_momento',
    freezeTableName: true,
  }
);

export { TracciatiMomento };
