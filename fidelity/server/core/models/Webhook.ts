import { DataTypes, Model, Optional } from 'sequelize';
import { EVENTI_WEBHOOK, STATO_WEBHOOK } from '../../../lib/enums';
import { WebhookAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';


interface WebhookCreationAttributes extends Optional<WebhookAttributes,
  'id_webhook' | 'createdat_webhook' | 'updatedat_webhook'
> { }

export class Webhook extends Model<WebhookAttributes, WebhookCreationAttributes> implements WebhookAttributes {
  public id_webhook!: string;
  public nome_webhook!: string;
  public descrizione_webhook?: string;
  public url_webhook!: string;
  public eventi_webhook!: EVENTI_WEBHOOK[];
  public stato_webhook!: STATO_WEBHOOK;
  public secret_webhook?: string; // TODO: rimuovere

  public timeout_webhook!: number;
  public retry_count_webhook!: number;
  public retry_delay_webhook!: number;
  public headers_personalizzati_webhook?: Record<string, string>;

  // Le statistiche sono calcolate dinamicamente dai tentativi

  public createdat_webhook!: Date;
  public updatedat_webhook!: Date;
  public createdby_webhook!: string;

  // Metodo statico per inizializzare e sincronizzare
}

Webhook.init({
  id_webhook: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
    field: 'id_webhook'
  },
  nome_webhook: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'nome_webhook'
  },
  descrizione_webhook: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'descrizione_webhook'
  },
  url_webhook: {
    type: DataTypes.STRING(2048),
    allowNull: false,
    validate: {
      isUrl: true
    },
    field: 'url_webhook'
  },
  eventi_webhook: {
    type: DataTypes.ARRAY(DataTypes.ENUM(...Object.values(EVENTI_WEBHOOK))),
    allowNull: false,
    defaultValue: [],
    field: 'eventi_webhook'
  },
  stato_webhook: {
    type: DataTypes.ENUM(...Object.values(STATO_WEBHOOK)),
    allowNull: false,
    defaultValue: STATO_WEBHOOK.ATTIVO,
    field: 'stato_webhook'
  },
  secret_webhook: {
    type: DataTypes.STRING(512),
    allowNull: true,
    field: 'secret_webhook'
  },
  timeout_webhook: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30000,
    field: 'timeout_webhook'
  },
  retry_count_webhook: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3,
    field: 'retry_count_webhook'
  },
  retry_delay_webhook: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1000,
    field: 'retry_delay_webhook'
  },
  headers_personalizzati_webhook: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'headers_personalizzati_webhook'
  },
  createdat_webhook: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'createdat_webhook'
  },
  updatedat_webhook: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updatedat_webhook'
  },
  createdby_webhook: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'createdby_webhook'
  }
}, {
  sequelize,
  tableName: 'webhooks',
  timestamps: false,
  indexes: [
    {
      fields: ['stato_webhook']
    },
    {
      fields: ['eventi_webhook'],
      using: 'gin'
    },
    {
      fields: ['createdby_webhook']
    }
  ]
});
