import {
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript';
import { AbsolutePaths } from './absolute_path.model';

@Table({
  tableName: 'foto',
  timestamps: false,
  freezeTableName: true,
})
export class Foto extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  public id: string;

  @Column(DataType.STRING)
  public md5: string;

  @ForeignKey(() => AbsolutePaths)
  @Column(DataType.UUID)
  public id_path_archivio: string;

  @ForeignKey(() => AbsolutePaths)
  @Column(DataType.UUID)
  public id_path_web: string;

  @Column(DataType.STRING)
  public file_name: string;

  @Column(DataType.STRING)
  public file_name_web: string;

  // @ForeignKey(() => Formati)
  // @Column(DataType.UUID)
  // public id_formato: string;

  @Column(DataType.STRING)
  public file_name_web_performante: string;

  @Column(DataType.DATE)
  public created_at: Date;

  @Column(DataType.DATE)
  public updated_at: Date;
}
export type FotoAttributes = {
  id: string
  md5: string
  id_path_archivio: string;
  id_path_web: string;
  file_name: string;
  file_name_web: string;
  //id_formato: string;
  file_name_web_performante: string;
}
