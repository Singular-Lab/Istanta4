import { DataTypes, Model, Optional } from 'sequelize';
import { STATO_TENTATIVO_WEBHOOK } from '../../../lib/enums';
import { sequelize } from '../db/SequelizeConnector';

export interface TentativoWebhookAttributes {
  id_tentativo: string;
  webhook_id_tentativo: string;
  payload_id_tentativo: string;
  numero_tentativo_tentativo: number;
  stato_tentativo: STATO_TENTATIVO_WEBHOOK;
  http_status_tentativo?: number;
  response_body_tentativo?: string;
  messaggio_errore_tentativo?: string;
  durata_ms_tentativo: number;
  createdat_tentativo: Date;
}

interface TentativoWebhookCreationAttributes extends Optional<TentativoWebhookAttributes,
  'id_tentativo' | 'createdat_tentativo'
> { }

export class TentativoWebhook extends Model<TentativoWebhookAttributes, TentativoWebhookCreationAttributes>
  implements TentativoWebhookAttributes {

  // Le proprietà sono gestite automaticamente da Sequelize
  // attraverso i getter e setter generati dall'init()

  declare id_tentativo: string;
  declare webhook_id_tentativo: string;
  declare payload_id_tentativo: string;
  declare numero_tentativo_tentativo: number;
  declare stato_tentativo: STATO_TENTATIVO_WEBHOOK;
  declare http_status_tentativo?: number;
  declare response_body_tentativo?: string;
  declare messaggio_errore_tentativo?: string;
  declare durata_ms_tentativo: number;
  declare createdat_tentativo: Date;
}

TentativoWebhook.init({
  id_tentativo: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
    field: 'id_tentativo'
  },
  webhook_id_tentativo: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'webhook_id_tentativo'
  },
  payload_id_tentativo: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'payload_id_tentativo'
  },
  numero_tentativo_tentativo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'numero_tentativo_tentativo'
  },
  stato_tentativo: {
    type: DataTypes.ENUM(...Object.values(STATO_TENTATIVO_WEBHOOK)),
    allowNull: false,
    field: 'stato_tentativo'
  },
  http_status_tentativo: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'http_status_tentativo'
  },
  response_body_tentativo: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'response_body_tentativo'
  },
  messaggio_errore_tentativo: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'messaggio_errore_tentativo'
  },
  durata_ms_tentativo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'durata_ms_tentativo'
  },
  createdat_tentativo: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'createdat_tentativo'
  }
}, {
  sequelize,
  tableName: 'tentativi_webhook',
  timestamps: false,
  indexes: [
    {
      fields: ['webhook_id_tentativo']
    },
    {
      fields: ['stato_tentativo']
    },
    {
      fields: ['createdat_tentativo']
    }
  ]
});

// Le relazioni sono ora gestite centralmente in relazioni.ts
