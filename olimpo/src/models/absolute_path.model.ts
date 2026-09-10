import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Foto } from './foto.model';

@Table({
  tableName: 'absolute_paths',
  timestamps: false,
  freezeTableName: true,
})
export class AbsolutePaths extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  public id: string;

  @Column(DataType.STRING)
  public path: string;

  @Column(DataType.STRING)
  public tipo: string;

  @Column(DataType.BOOLEAN)
  public active: boolean;
}
