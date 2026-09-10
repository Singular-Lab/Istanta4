import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';
import { RegoleMenabo } from '../../../lib/types';

/**
 * Modello Config per gestione configurazioni del sistema
 * Basato sulla struttura MongoDB fornita dall'utente
 */

export interface ConfigAttributes {
  id: string;
  maintenance_alert?: any;
  regole_menabo?: RegoleMenabo;
  webpliant: {
    css_text?: string;
    color_gdo?: string;
    guid_id?: string;
    icona_pagina?: string;
    logo_header?: Array<{
      url?: string;
      base64?: string;
      id_canale?: string;
      id_area?: string;
      id_pv?: string;
    }>;
    stili?: Array<{
      id?: number;
      nome_stile?: string;
      condizioni?: any;
      struttura?: any;
      azioni?: Array<{
        nome?: string;
        campi?: any;
      }>;
    }>;
    stili_minimal?: Array<{
      id?: number;
      nome_stile?: string;
      condizioni?: any;
      struttura?: any;
      azioni?: Array<{
        nome?: string;
        campi?: any;
      }>;
    }>;
    data_fields_refs?: Array<{
      expected_input?: string;
      expected_output?: string;
    }>;
    data_fields_files?: string[];
    meta_volantino?: {
      title?: string;
      description?: string;
    };
  };
  color?: string;
  dashboard?: {
    version?: number;
    last_updated?: Date;
    plugins?: Array<{
      id?: string;
      name?: string;
      component?: string;
      props?: any;
      position?: 'grid';
      order?: number;
      layout?: {
        i?: string;
        x?: number;
        y?: number;
        w?: number;
        h?: number;
        minW?: number;
        minH?: number;
        maxW?: number;
        maxH?: number;
        static?: boolean;
        isDraggable?: boolean;
        isResizable?: boolean;
      };
      allowed_roles?: any[];
      is_draggable?: boolean;
      is_resizable?: boolean;
      min_w?: number;
      min_h?: number;
      is_deletable?: boolean;
      show_pagination?: boolean;
      show_filter?: boolean;
      base_filter?: Array<{
        field: string;
        operator: 'in' | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'notContains' | 'startsWith' | 'endsWith';
        value: any;
      }>;
    }>;
  };
  dashboards_by_role?: any;
  createdAt: Date;
  updatedAt: Date;
}

interface ConfigCreationAttributes extends Optional<ConfigAttributes, "id" | "createdAt" | "updatedAt"> { }

class Config extends Model<ConfigAttributes, ConfigCreationAttributes> implements ConfigAttributes {
  declare id: string;
  declare webpliant: {
    css_text?: string;
    color_gdo?: string;
    guid_id?: string;
    icona_pagina?: string;
    logo_header?: Array<{
      url?: string;
      base64?: string;
      id_canale?: string;
      id_area?: string;
      id_pv?: string;
    }>;
    stili?: Array<{
      id?: number;
      nome_stile?: string;
      condizioni?: any;
      struttura?: any;
      azioni?: Array<{
        nome?: string;
        campi?: any;
      }>;
    }>;
    stili_minimal?: Array<{
      id?: number;
      nome_stile?: string;
      condizioni?: any;
      struttura?: any;
      azioni?: Array<{
        nome?: string;
        campi?: any;
      }>;
    }>;
    data_fields_refs?: Array<{
      expected_input?: string;
      expected_output?: string;
    }>;
    data_fields_files?: string[];
    meta_volantino?: {
      title?: string;
      description?: string;
    };
  };
  declare color?: string;
  declare dashboard?: {
    version?: number;
    last_updated?: Date;
    plugins?: Array<{
      id?: string;
      name?: string;
      component?: string;
      props?: any;
      position?: 'grid';
      order?: number;
      layout?: {
        i?: string;
        x?: number;
        y?: number;
        w?: number;
        h?: number;
        minW?: number;
        minH?: number;
        maxW?: number;
        maxH?: number;
        static?: boolean;
        isDraggable?: boolean;
        isResizable?: boolean;
      };
      allowed_roles?: any[];
      is_draggable?: boolean;
      is_resizable?: boolean;
      min_w?: number;
      min_h?: number;
      is_deletable?: boolean;
      show_pagination?: boolean;
      show_filter?: boolean;
      base_filter?: Array<{
        field: string;
        operator: 'in' | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'notContains' | 'startsWith' | 'endsWith';
        value: any;
      }>;
    }>;
  };
  declare dashboards_by_role?: any;
  declare maintenance_alert?: any;
  declare regole_menabo?: RegoleMenabo;
  declare createdAt: Date;
  declare updatedAt: Date;
}

const ConfigDefine = sequelize.define<Config>("config", {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    validate: {
      notEmpty: {
        msg: 'Il campo id non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo id non può essere null'
      }
    }
  },
  webpliant: {
    type: DataTypes.JSONB,
    allowNull: false,
    validate: {
      notNull: {
        msg: 'Il campo webpliant non può essere null'
      },
      isValidWebpliant(value: any) {
        if (!value || typeof value !== 'object') {
          throw new Error('Il campo webpliant deve essere un oggetto valido');
        }

        // Validazione per logo_header
        if (value.logo_header && Array.isArray(value.logo_header)) {
          for (const logo of value.logo_header) {
            if (typeof logo !== 'object') {
              throw new Error('Ogni elemento di logo_header deve essere un oggetto');
            }
          }
        }

        // Validazione per stili
        if (value.stili && Array.isArray(value.stili)) {
          for (const stile of value.stili) {
            if (typeof stile !== 'object') {
              throw new Error('Ogni elemento di stili deve essere un oggetto');
            }
            if (stile.azioni && Array.isArray(stile.azioni)) {
              for (const azione of stile.azioni) {
                if (typeof azione !== 'object') {
                  throw new Error('Ogni elemento di azioni deve essere un oggetto');
                }
              }
            }
          }
        }

        // Validazione per stili_minimal
        if (value.stili_minimal && Array.isArray(value.stili_minimal)) {
          for (const stile of value.stili_minimal) {
            if (typeof stile !== 'object') {
              throw new Error('Ogni elemento di stili_minimal deve essere un oggetto');
            }
            if (stile.azioni && Array.isArray(stile.azioni)) {
              for (const azione of stile.azioni) {
                if (typeof azione !== 'object') {
                  throw new Error('Ogni elemento di azioni deve essere un oggetto');
                }
              }
            }
          }
        }

        // Validazione per data_fields_refs
        if (value.data_fields_refs && Array.isArray(value.data_fields_refs)) {
          for (const ref of value.data_fields_refs) {
            if (typeof ref !== 'object') {
              throw new Error('Ogni elemento di data_fields_refs deve essere un oggetto');
            }
          }
        }

        // Validazione per data_fields_files
        if (value.data_fields_files && !Array.isArray(value.data_fields_files)) {
          throw new Error('Il campo data_fields_files deve essere un array');
        }
      }
    }
  },
  color: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo color deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  dashboard: {
    type: DataTypes.JSONB,
    allowNull: true,
    validate: {
      isValidDashboard(value: any) {
        if (value && typeof value !== 'object') {
          throw new Error('Il campo dashboard deve essere un oggetto valido');
        }

        if (value && value.plugins && Array.isArray(value.plugins)) {
          for (const plugin of value.plugins) {
            if (typeof plugin !== 'object') {
              throw new Error('Ogni elemento di plugins deve essere un oggetto');
            }

            // Validazione per position
            if (plugin.position && plugin.position !== 'grid') {
              throw new Error('Il campo position deve essere "grid"');
            }

            // Validazione per operator
            if (plugin.base_filter && Array.isArray(plugin.base_filter)) {
              for (const filter of plugin.base_filter) {
                if (typeof filter !== 'object') {
                  throw new Error('Ogni elemento di base_filter deve essere un oggetto');
                }
                if (!filter.field || !filter.operator || filter.value === undefined) {
                  throw new Error('Ogni elemento di base_filter deve avere field, operator e value');
                }
                const validOperators = ['in', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'notContains', 'startsWith', 'endsWith'];
                if (!validOperators.includes(filter.operator)) {
                  throw new Error(`Il campo operator deve essere uno di: ${validOperators.join(', ')}`);
                }
              }
            }
          }
        }
      }
    }
  },
  dashboards_by_role: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  maintenance_alert: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  regole_menabo: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    validate: {
      notNull: {
        msg: 'Il campo createdAt non può essere null'
      },
      isDate: {
        msg: 'Il campo createdAt deve essere una data valida',
        args: true
      }
    }
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    validate: {
      notNull: {
        msg: 'Il campo updatedAt non può essere null'
      },
      isDate: {
        msg: 'Il campo updatedAt deve essere una data valida',
        args: true
      }
    }
  }
}, {
  timestamps: true,
  tableName: "config",
  freezeTableName: true,
  indexes: [
    {
      fields: ['createdAt']
    },
    {
      fields: ['updatedAt']
    }
  ],
  validate: {
    validazioneCoerenza() {
      // Validazione che webpliant sia un oggetto valido
      if (!this.webpliant || typeof this.webpliant !== 'object') {
        throw new Error('Il campo webpliant è obbligatorio e deve essere un oggetto');
      }
    }
  }
});

// Hook per gestire errori durante la creazione
ConfigDefine.addHook('beforeCreate', (config: Config) => {
  if (!config.webpliant || typeof config.webpliant !== 'object') {
    throw new Error('Il campo webpliant è obbligatorio e deve essere un oggetto');
  }
});

// Hook per gestire errori durante l'aggiornamento
ConfigDefine.addHook('beforeUpdate', (config: Config) => {
  if (config.webpliant !== undefined && (!config.webpliant || typeof config.webpliant !== 'object')) {
    throw new Error('Il campo webpliant deve essere un oggetto valido');
  }
});

export { ConfigDefine as Config };
