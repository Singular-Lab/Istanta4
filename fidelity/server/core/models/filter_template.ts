import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db';

export interface FilterCondition {
  field: string;
  operator:
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in';
  value: string;
  priority?: number;
}

export type FilterTemplateEndpointType = 'refs' | 'refs-html' | 'files';

/**
 * Opzioni di visualizzazione per il plugin
 */
export interface FilterTemplateDisplayOptions {
  autoScroll?: boolean;
  scrollSpeed?: number;
  showIndicators?: boolean;
  showNavButtons?: boolean;
}

export interface FilterTemplateAttributes {
  id_filter_template: string;
  nome: string;
  slug: string;
  descrizione: string | null;
  parent_template_id: string | null;
  template_ids?: string[];
  export_codes?: string[];
  filters: FilterCondition[][];
  endpoint_type: FilterTemplateEndpointType;
  render_type?: 'carousel' | 'grid';
  // Opzioni di visualizzazione per il plugin
  auto_scroll: boolean;
  scroll_speed: number;
  show_indicators: boolean;
  show_nav_buttons: boolean;
  meta_options: Record<string, unknown>;
  id_gdo: string;
  id_agenzia: string | null;
  id_utente_creatore: string;
  is_active: boolean;
  is_latest: boolean;
  version: number;
  deleted_at: Date | null;
  deleted_by: string | null;
  createdat: Date;
  updatedat: Date;
}

export type FilterTemplateRenderType = 'carousel' | 'grid' | 'list';

type FilterTemplateCreationAttributes = Optional<
  FilterTemplateAttributes,
  | 'id_filter_template'
  | 'descrizione'
  | 'id_agenzia'
  | 'render_type'
  | 'template_ids'
  | 'export_codes'
  | 'auto_scroll'
  | 'scroll_speed'
  | 'show_indicators'
  | 'show_nav_buttons'
  | 'meta_options'
  | 'parent_template_id'
  | 'is_active'
  | 'is_latest'
  | 'deleted_at'
  | 'deleted_by'
  | 'createdat'
  | 'updatedat'
>;

export class FilterTemplate
  extends Model<FilterTemplateAttributes, FilterTemplateCreationAttributes>
  implements FilterTemplateAttributes {
  declare id_filter_template: string;
  declare nome: string;
  declare slug: string;
  declare descrizione: string | null;
  declare parent_template_id: string | null;
  declare template_ids: string[];
  declare export_codes: string[];
  declare filters: FilterCondition[][];
  declare endpoint_type: FilterTemplateEndpointType;
  declare render_type?: 'carousel' | 'grid';
  declare auto_scroll: boolean;
  declare scroll_speed: number;
  declare show_indicators: boolean;
  declare show_nav_buttons: boolean;
  declare meta_options: Record<string, unknown>;
  declare id_gdo: string;
  declare id_agenzia: string | null;
  declare id_utente_creatore: string;
  declare is_active: boolean;
  declare is_latest: boolean;
  declare version: number;
  declare deleted_at: Date | null;
  declare deleted_by: string | null;
  declare createdat: Date;
  declare updatedat: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public static isValidSlug(slug: string): boolean {
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    return slugRegex.test(slug) && slug.length <= 100;
  }

  public static generateSlugFromName(nome: string): string {
    return nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100);
  }
}

FilterTemplate.init(
  {
    id_filter_template: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    nome: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Nome visualizzato del template'
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Identificatore univoco per GDO',
      validate: {
        isLowercase: true,
        is: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      }
    },
    descrizione: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descrizione opzionale del template'
    },
    parent_template_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Identificatore della prima versione per mantenere la lineage'
    },
    template_ids: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
      defaultValue: [],
      comment: 'Lista di template correlati utilizzati in cascata'
    },
    export_codes: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
      comment: 'Lista di codici tipo export (per modalità files)'
    },
    filters: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Array di gruppi di condizioni filtro (Array<FilterCondition[]>)'
    },
    endpoint_type: {
      type: DataTypes.ENUM('refs', 'refs-html', 'files'),
      allowNull: false,
      comment: 'Tipo di endpoint per cui il template è applicabile'
    },
    render_type: {
      type: DataTypes.ENUM('carousel', 'grid', 'list'),
      allowNull: true,
      comment: 'Tipo di rendering per il template'
    },
    auto_scroll: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Abilita auto-scroll nel carousel'
    },
    scroll_speed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5000,
      comment: 'Velocità auto-scroll in millisecondi'
    },
    show_indicators: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Mostra indicatori carousel'
    },
    show_nav_buttons: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Mostra bottoni navigazione carousel'
    },
    meta_options: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Opzioni di rendering o serializzazione extra'
    },
    id_gdo: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'FK alla GDO proprietaria del template'
    },
    id_agenzia: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "FK opzionale all'agenzia"
    },
    id_utente_creatore: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "FK all'utente che ha creato il template"
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Se il template è attivo e utilizzabile'
    },
    is_latest: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Indica se questa versione è la più recente'
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: "Il template ha delle versioni per gestire meglio il cambio di modifiche in una webapp esterna"
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp di soft delete per la versione'
    },
    deleted_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "Utente che ha eseguito il soft delete della versione"
    },
    createdat: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedat: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: 'filter_templates',
    timestamps: true,
    createdAt: 'createdat',
    updatedAt: 'updatedat',
    indexes: [
      {
        name: 'idx_filter_template_slug_gdo_version',
        unique: true,
        fields: ['slug', 'id_gdo', 'version']
      },
      {
        name: 'idx_filter_template_latest',
        fields: ['slug', 'id_gdo', 'is_latest']
      },
      {
        name: 'idx_filter_template_gdo',
        fields: ['id_gdo']
      },
      {
        name: 'idx_filter_template_endpoint_type',
        fields: ['endpoint_type']
      },
      {
        name: 'idx_filter_template_is_active',
        fields: ['is_active']
      },
      {
        name: 'idx_filter_template_creatore',
        fields: ['id_utente_creatore']
      },
      {
        name: 'idx_filter_template_deleted',
        fields: ['deleted_at']
      }
    ],
    comment:
      'Template di filtri riutilizzabili per le API esterne, con scope a livello di GDO/Agenzia'
  }
);

export default FilterTemplate;
