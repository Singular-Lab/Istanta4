import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db';

// Interfaccia per gli attributi del modello
interface PluginAnalyticsEventAttributes {
  id_plugin_analytics_event: string;
  event_id: string;
  event_type: string;
  timestamp_event: Date;
  slug: string;
  fp_version: string;
  page_origin: string;
  page_path: string;
  session_id: string;
  sequence: number;
  viewport: Record<string, unknown> | null;
  ip_address: string;
  user_agent: string;
  event_data: Record<string, unknown> | null;
  created_at: Date;
}

// Interfaccia per i parametri di creazione
interface PluginAnalyticsEventCreationAttributes
  extends Optional<PluginAnalyticsEventAttributes, 'id_plugin_analytics_event' | 'created_at'> {}

// Classe del modello
export class PluginAnalyticsEvent
  extends Model<PluginAnalyticsEventAttributes, PluginAnalyticsEventCreationAttributes>
  implements PluginAnalyticsEventAttributes
{
  declare id_plugin_analytics_event: string;
  declare event_id: string;
  declare event_type: string;
  declare timestamp_event: Date;
  declare slug: string;
  declare fp_version: string;
  declare page_origin: string;
  declare page_path: string;
  declare session_id: string;
  declare sequence: number;
  declare viewport: Record<string, unknown> | null;
  declare ip_address: string;
  declare user_agent: string;
  declare event_data: Record<string, unknown> | null;
  declare created_at: Date;

  public readonly createdAt!: Date;
}

// Definizione del modello
PluginAnalyticsEvent.init(
  {
    id_plugin_analytics_event: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    event_id: {
      type: DataTypes.STRING(36),
      allowNull: false,
      comment: 'UUID generato dal client',
    },
    event_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Tipo di evento (PluginEventType)',
    },
    timestamp_event: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Timestamp evento generato dal client',
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Slug configurazione plugin',
    },
    fp_version: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Versione del plugin',
    },
    page_origin: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Origin della pagina host (es: https://example.com)',
    },
    page_path: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Path della pagina host (senza query string)',
    },
    session_id: {
      type: DataTypes.STRING(36),
      allowNull: false,
      comment: 'ID sessione (random per page-load, non un cookie)',
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Numero di sequenza monotonicamente crescente per sessione (replay ordering)',
    },
    viewport: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Stato del viewport al momento dell\'evento (viewportWidth, viewportHeight, scrollX, scrollY, documentWidth, documentHeight)',
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: false,
      comment: 'Indirizzo IP del client',
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User-Agent del browser',
    },
    event_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Payload specifico per tipo di evento',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'plugin_analytics_events',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        name: 'idx_pae_event_type',
        fields: ['event_type'],
      },
      {
        name: 'idx_pae_slug',
        fields: ['slug'],
      },
      {
        name: 'idx_pae_timestamp',
        fields: ['timestamp_event'],
      },
      {
        name: 'idx_pae_session',
        fields: ['session_id'],
      },
      {
        name: 'idx_pae_origin',
        fields: ['page_origin'],
      },
      {
        name: 'idx_pae_composite',
        fields: ['slug', 'event_type', 'timestamp_event'],
      },
      {
        name: 'idx_pae_session_sequence',
        fields: ['session_id', 'sequence'],
      },
    ],
    comment: 'Eventi analytics raccolti dal plugin FP su siti terzi',
  }
);

export default PluginAnalyticsEvent;
