import {
  Column,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';

@Table({
  tableName: 'private_sessions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  freezeTableName: true,
})
export class PrivateSession extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  public id: string;

  @Unique
  @Column(DataType.STRING)
  public token_hash: string;

  @Column(DataType.STRING)
  public csrf_token_hash: string;

  @Column(DataType.STRING)
  public session_subject: string;

  @Column(DataType.STRING)
  public ip_address: string;

  @Column(DataType.TEXT)
  public user_agent: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  public is_valid: boolean;

  @Column(DataType.DATE)
  public expires_at: Date;

  @Column(DataType.DATE)
  public last_seen_at: Date;

  @Column(DataType.DATE)
  public revoked_at: Date;

  @Column(DataType.JSONB)
  public meta: Record<string, any>;

  @Column(DataType.DATE)
  public created_at: Date;

  @Column(DataType.DATE)
  public updated_at: Date;
}
