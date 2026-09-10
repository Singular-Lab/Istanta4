import { DataTypes, Model, Optional } from 'sequelize';
import { MODALITA_TIPO_EXPORT } from '../../../lib/enums';
import { Filtro, TipiDiExportAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';

type TipiDiExportCreationAttributes = Optional<TipiDiExportAttributes, "id_tipiexport">;

class TipiDiExportClass
  extends Model<TipiDiExportAttributes, TipiDiExportCreationAttributes>
  implements TipiDiExportAttributes {
  declare id_tipiexport: string;
  declare nome_tipiexport: string;
  declare codice_tipiexport: string;
  declare modalita_tipiexport?: MODALITA_TIPO_EXPORT;
  declare guid_namingconvention_tipiexport?: string;
  declare filtri_tipiexport?: Filtro[] | undefined;  // Ora verrà salvato come JSONB
  declare createdat?: Date;
  declare updatedat: Date;
}

const TipiDiExport = sequelize.define<TipiDiExportClass>(
  "tipi_export",
  {
    id_tipiexport: {
      type: DataTypes.UUID,
      defaultValue: sequelize.fn("uuid_generate_v4"),
      primaryKey: true,
    },
    nome_tipiexport: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    codice_tipiexport: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    modalita_tipiexport: {
      type: DataTypes.ENUM(...Object.values(MODALITA_TIPO_EXPORT)),
      allowNull: false,
    },
    guid_namingconvention_tipiexport: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    // ECCO QUI il campo in JSONB
    filtri_tipiexport: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    createdat: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updatedat: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: false,
    tableName: "tipi_export",
    freezeTableName: true,
  }
);

export { TipiDiExport as TipiDiExport };
