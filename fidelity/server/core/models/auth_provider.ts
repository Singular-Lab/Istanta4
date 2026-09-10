import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db';

export interface AuthProviderAttributes {
  id: string;
  codice: string;
  nome: string;
  descrizione: string | null;
  icona: string;
  tipo: 'internal' | 'oidc' | 'saml' | 'custom';
  ordine: number;
  attivo: boolean;
  config_client: Record<string, unknown> | null;
  config_server: Record<string, unknown> | null;
  ruoli_ammessi: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

type AuthProviderCreationAttributes = Optional<
  AuthProviderAttributes,
  'id' | 'descrizione' | 'icona' | 'ordine' | 'attivo' | 'config_client' | 'config_server' | 'ruoli_ammessi' | 'createdAt' | 'updatedAt'
>;

export class AuthProvider
  extends Model<AuthProviderAttributes, AuthProviderCreationAttributes>
  implements AuthProviderAttributes {
  declare id: string;
  declare codice: string;
  declare nome: string;
  declare descrizione: string | null;
  declare icona: string;
  declare tipo: 'internal' | 'oidc' | 'saml' | 'custom';
  declare ordine: number;
  declare attivo: boolean;
  declare config_client: Record<string, unknown> | null;
  declare config_server: Record<string, unknown> | null;
  declare ruoli_ammessi: string[] | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

AuthProvider.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    codice: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: 'Codice univoco del provider (email_password, entra_id, google, ecc.)',
    },
    nome: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Nome visualizzato del provider',
    },
    descrizione: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descrizione opzionale del provider',
    },
    icona: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'Key',
      comment: 'Nome icona Lucide oppure stringa base64 (data:image/...)',
    },
    tipo: {
      type: DataTypes.ENUM('internal', 'oidc', 'saml', 'custom'),
      allowNull: false,
      comment: 'Tipo di autenticazione del provider',
    },
    ordine: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Ordine di visualizzazione',
    },
    attivo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Se il provider è abilitato',
    },
    config_client: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Configurazione lato client (authorize_url, client_id, scope, redirect_uri)',
    },
    config_server: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Configurazione lato server (client_secret, token_url, jwks_uri) - MAI esposto al client',
    },
    ruoli_ammessi: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Array di TIPO_UTENTI che possono usare questo provider, null = tutti',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'auth_providers',
    timestamps: true,
    indexes: [
      { name: 'idx_auth_provider_codice', unique: true, fields: ['codice'] },
      { name: 'idx_auth_provider_attivo', fields: ['attivo'] },
      { name: 'idx_auth_provider_ordine', fields: ['ordine'] },
    ],
    comment: 'Provider di autenticazione configurabili per il login hub',
  }
);

export default AuthProvider;
