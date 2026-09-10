import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Modello WorkspaceWebpliant per gestione workspace webpliant
 * Basato sulla struttura MongoDB fornita dall'utente
 */

export interface WorkspaceWebpliantAttributes {
  id: string;
  id_area?: string;
  id_canale?: string;
  id_gdo: string;
  id_pv?: string;
  nome_workspace?: string;
  webpliant: Array<{
    id: string;
    nome: string;
    tipo: string;
    struttura: Array<{
      id: string;
      parent_id: string;
      user_locked: {
        locked: boolean;
        user_id: string;
      };
      type: string;
      children: any[];
      content: any;
      policy: any;
      is_hybrid?: boolean;
      keyframes: any[];
      alias?: string;
    }>;
    settings: {
      mostra_menu_laterale?: boolean;
      policy?: any;
    };
  }>;
  sitemap: Array<{
    id: string;
    titolo: string;
    pagine_collegate: Array<{
      id: string;
      titolo: string;
    }>;
    link_esterno?: string;
    impostazioni_avanzate: {
      show?: boolean;
      mostra_menu_laterale?: boolean;
    };
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkspaceWebpliantCreationAttributes extends Optional<WorkspaceWebpliantAttributes, "id" | "createdAt" | "updatedAt"> { }

class WorkspaceWebpliant extends Model<WorkspaceWebpliantAttributes, WorkspaceWebpliantCreationAttributes> implements WorkspaceWebpliantAttributes {
  declare id: string;
  declare id_area?: string;
  declare id_canale?: string;
  declare id_gdo: string;
  declare id_pv?: string;
  declare nome_workspace?: string;
  declare webpliant: Array<{
    id: string;
    nome: string;
    tipo: string;
    struttura: Array<{
      id: string;
      parent_id: string;
      user_locked: {
        locked: boolean;
        user_id: string;
      };
      type: string;
      children: any[];
      content: any;
      policy: any;
      is_hybrid?: boolean;
      keyframes: any[];
      alias?: string;
    }>;
    settings: {
      mostra_menu_laterale?: boolean;
      policy?: any;
    };
  }>;
  declare sitemap: Array<{
    id: string;
    titolo: string;
    pagine_collegate: Array<{
      id: string;
      titolo: string;
    }>;
    link_esterno?: string;
    impostazioni_avanzate: {
      show?: boolean;
      mostra_menu_laterale?: boolean;
    };
  }>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

const WorkspaceWebpliantDefine = sequelize.define<WorkspaceWebpliant>("workspace_webpliant", {
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
  id_area: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo id_area deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  id_canale: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo id_canale deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  id_gdo: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo id_gdo non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo id_gdo non può essere null'
      },
      len: {
        args: [1, 255],
        msg: 'Il campo id_gdo deve essere compreso tra 1 e 255 caratteri'
      }
    }
  },
  id_pv: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo id_pv deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  nome_workspace: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo nome_workspace deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  webpliant: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo webpliant non può essere null'
      },
      isValidWebpliant(value: any[]) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo webpliant deve essere un array');
        }
        for (const pagina of value) {
          if (!pagina || typeof pagina !== 'object') {
            throw new Error('Ogni pagina webpliant deve essere un oggetto');
          }
          if (!pagina.id) {
            throw new Error('Ogni pagina webpliant deve avere un id');
          }
          if (!pagina.nome) {
            throw new Error('Ogni pagina webpliant deve avere un nome');
          }
          if (!pagina.tipo) {
            throw new Error('Ogni pagina webpliant deve avere un tipo');
          }
          if (!Array.isArray(pagina.struttura)) {
            throw new Error('Il campo struttura deve essere un array');
          }
          for (const item of pagina.struttura) {
            if (!item || typeof item !== 'object') {
              throw new Error('Ogni elemento della struttura deve essere un oggetto');
            }
            if (!item.id) {
              throw new Error('Ogni elemento della struttura deve avere un id');
            }
            if (!item.type) {
              throw new Error('Ogni elemento della struttura deve avere un type');
            }
            if (!Array.isArray(item.children)) {
              throw new Error('Il campo children deve essere un array');
            }
            if (!item.content) {
              throw new Error('Ogni elemento della struttura deve avere un content');
            }
            if (!item.policy) {
              throw new Error('Ogni elemento della struttura deve avere un policy');
            }
            if (!Array.isArray(item.keyframes)) {
              throw new Error('Il campo keyframes deve essere un array');
            }
          }
          if (!pagina.settings || typeof pagina.settings !== 'object') {
            throw new Error('Ogni pagina webpliant deve avere un settings valido');
          }
        }
      }
    }
  },
  sitemap: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo sitemap non può essere null'
      },
      isValidSitemap(value: any[]) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo sitemap deve essere un array');
        }
        for (const item of value) {
          if (!item || typeof item !== 'object') {
            throw new Error('Ogni elemento della sitemap deve essere un oggetto');
          }
          if (!item.id) {
            throw new Error('Ogni elemento della sitemap deve avere un id');
          }
          if (!item.titolo) {
            throw new Error('Ogni elemento della sitemap deve avere un titolo');
          }
          if (!Array.isArray(item.pagine_collegate)) {
            throw new Error('Il campo pagine_collegate deve essere un array');
          }
          for (const pagina of item.pagine_collegate) {
            if (!pagina || typeof pagina !== 'object') {
              throw new Error('Ogni pagina collegata deve essere un oggetto');
            }
            if (!pagina.id) {
              throw new Error('Ogni pagina collegata deve avere un id');
            }
            if (!pagina.titolo) {
              throw new Error('Ogni pagina collegata deve avere un titolo');
            }
          }
          if (!item.impostazioni_avanzate || typeof item.impostazioni_avanzate !== 'object') {
            throw new Error('Ogni elemento della sitemap deve avere un impostazioni_avanzate valido');
          }
        }
      }
    }
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
  tableName: "workspace_webpliant",
  freezeTableName: true,
  indexes: [
    {
      fields: ['id_area']
    },
    {
      fields: ['id_canale']
    },
    {
      fields: ['id_gdo']
    },
    {
      fields: ['id_pv']
    },
    {
      fields: ['nome_workspace']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['updatedAt']
    }
  ],
  validate: {
    validazioneCoerenza() {
      // Validazione che l'id_workspace non sia vuoto
      if (!this.id || (typeof this.id === 'string' && this.id.trim().length === 0)) {
        throw new Error('L\'id_workspace non può essere vuoto');
      }

      // Validazione che l'id_gdo non sia vuoto
      if (!this.id_gdo || (typeof this.id_gdo === 'string' && this.id_gdo.trim().length === 0)) {
        throw new Error('L\'id_gdo non può essere vuoto');
      }
    }
  }
});

// Hook per gestire errori durante la creazione
WorkspaceWebpliantDefine.addHook('beforeCreate', (workspace: WorkspaceWebpliant) => {
  if (!workspace.id || workspace.id.trim().length === 0) {
    throw new Error('Il campo id_workspace è obbligatorio e non può essere vuoto');
  }

  if (!workspace.id_gdo || workspace.id_gdo.trim().length === 0) {
    throw new Error('Il campo id_gdo è obbligatorio e non può essere vuoto');
  }
});

// Hook per gestire errori durante l'aggiornamento
WorkspaceWebpliantDefine.addHook('beforeUpdate', (workspace: WorkspaceWebpliant) => {
  if (workspace.id !== undefined && (!workspace.id || workspace.id.trim().length === 0)) {
    throw new Error('Il campo id_workspace non può essere vuoto');
  }

  if (workspace.id_gdo !== undefined && (!workspace.id_gdo || workspace.id_gdo.trim().length === 0)) {
    throw new Error('Il campo id_gdo non può essere vuoto');
  }
});

export { WorkspaceWebpliantDefine as WorkspaceWebpliant };
