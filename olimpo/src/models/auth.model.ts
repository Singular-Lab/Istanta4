import { FICO_ORIGIN, TIPO_UTENTE_FICO_FINALE } from '@enums/enums';
import { AuthPolicy, IAuth } from '@server_types/types';
import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  Default,
} from 'sequelize-typescript';

@Table({
  tableName: 'auth',
  timestamps: false,
  freezeTableName: true,
})
export class Auth extends Model<IAuth> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  public id?: string;

  @Column(DataType.STRING)
  public email: string;

  @Column(DataType.STRING)
  public public_key: string;

  @Column(DataType.STRING)
  public private_key: string;

  @Column(DataType.JSON)
  public meta_utente: AuthPolicy;

  @Column(DataType.ENUM(...Object.values(TIPO_UTENTE_FICO_FINALE)))
  public tipo_utente: TIPO_UTENTE_FICO_FINALE;

  @Column(DataType.ENUM(...Object.values(FICO_ORIGIN)))
  public origine: FICO_ORIGIN;

  @Column(DataType.BOOLEAN)
  public is_valid: boolean;

  @Column(DataType.DATE)
  public expires_at: Date;
}

