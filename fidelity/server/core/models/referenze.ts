import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Modello Referenze per gestione referenze istanta
 * Basato sulla struttura MongoDB fornita dall'utente
 */

export interface ReferenzeAttributes {
  id: string;
  compiled_fields: Array<{
    paragraph_name?: string;
    label_name?: string;
    content?: string;
  }>;
  deleted_fields: string[];
  foto: string[];
  meccanica: string;
  codice_box: string;
  foto_extra: Array<{
    guid_id: string;
    sigla: string;
    tipo: number;
  }>;
  data_fields: any;
  group_elements: any[];
  id_runtime_kit: string;
  id_promo: string;
  pag?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  w_page?: number;
  h_page?: number;
  perc_ingombro?: number;
  aspect_ratio?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ReferenzeCreationAttributes extends Optional<ReferenzeAttributes, "id" | "createdAt" | "updatedAt"> { }

class Referenze extends Model<ReferenzeAttributes, ReferenzeCreationAttributes> implements ReferenzeAttributes {
  declare id: string;
  declare compiled_fields: Array<{
    paragraph_name?: string;
    label_name?: string;
    content?: string;
  }>;
  declare deleted_fields: string[];
  declare foto: string[];
  declare meccanica: string;
  declare codice_box: string;
  declare foto_extra: Array<{
    guid_id: string;
    sigla: string;
    tipo: number;
  }>;
  declare data_fields: any;
  declare group_elements: any[];
  declare id_runtime_kit: string;
  declare id_promo: string;
  declare pag?: number;
  declare x?: number;
  declare y?: number;
  declare w?: number;
  declare h?: number;
  declare w_page?: number;
  declare h_page?: number;
  declare perc_ingombro?: number;
  declare aspect_ratio?: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

const ReferenzeDefine = sequelize.define<Referenze>("referenze", {
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
  compiled_fields: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo compiled_fields non può essere null'
      },
      isValidCompiledFields(value: any[]) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo compiled_fields deve essere un array');
        }
        for (const field of value) {
          if (!field || typeof field !== 'object') {
            throw new Error('Ogni elemento di compiled_fields deve essere un oggetto');
          }
        }
      }
    }
  },
  deleted_fields: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo deleted_fields non può essere null'
      },
      isValidStringArray(value: string[]) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo deleted_fields deve essere un array');
        }
        for (const field of value) {
          if (typeof field !== 'string') {
            throw new Error('Ogni elemento di deleted_fields deve essere una stringa');
          }
        }
      }
    }
  },
  foto: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo foto non può essere null'
      },
      isValidStringArray(value: string[]) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo foto deve essere un array');
        }
        for (const foto of value) {
          if (typeof foto !== 'string') {
            throw new Error('Ogni elemento di foto deve essere una stringa');
          }
        }
      }
    }
  },
  meccanica: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '',
    validate: {
      notNull: {
        msg: 'Il campo meccanica non può essere null'
      },
    }
  },
  codice_box: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo codice_box non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo codice_box non può essere null'
      },
      len: {
        args: [1, 100],
        msg: 'Il campo codice_box deve essere compreso tra 1 e 100 caratteri'
      }
    }
  },
  foto_extra: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo foto_extra non può essere null'
      },
      isValidFotoExtra(value: any[]) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo foto_extra deve essere un array');
        }
        for (const foto of value) {
          if (!foto || typeof foto !== 'object') {
            throw new Error('Ogni elemento di foto_extra deve essere un oggetto');
          }
          if (!foto.guid_id || typeof foto.tipo !== 'number') {
            throw new Error('Ogni elemento di foto_extra deve avere guid_id, sigla e tipo');
          }
        }
      }
    }
  },
  data_fields: {
    type: DataTypes.JSONB,
    allowNull: false,
    validate: {
      notNull: {
        msg: 'Il campo data_fields non può essere null'
      },
      isValidObject(value: any) {
        if (value === null || value === undefined || typeof value !== 'object') {
          throw new Error('Il campo data_fields deve essere un oggetto valido');
        }
      }
    }
  },
  group_elements: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo group_elements non può essere null'
      },
      isValidArray(value: any) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo group_elements deve essere un array');
        }
      }
    }
  },
  id_runtime_kit: {
    type: DataTypes.UUID,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo id_runtime_kit non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo id_runtime_kit non può essere null'
      },
    }
  },
  id_promo: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo id_promo non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo id_promo non può essere null'
      },
    }
  },
  pag: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  x: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  y: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  w: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  h: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  w_page: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  h_page: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  perc_ingombro: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  aspect_ratio: {
    type: DataTypes.FLOAT,
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
  tableName: "referenze",
  freezeTableName: true,
  indexes: [
    {
      fields: ['id_runtime_kit']
    },
    {
      fields: ['id_promo']
    },
    {
      fields: ['codice_box']
    },
    {
      fields: ['meccanica']
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
      // Validazione che il codice_box non sia vuoto
      if (!this.codice_box || (typeof this.codice_box === 'string' && this.codice_box.trim().length === 0)) {
        throw new Error('Il codice_box non può essere vuoto');
      }

      // Validazione che la meccanica non sia vuota

      // Validazione che data_fields sia un oggetto valido
      if (!this.data_fields || typeof this.data_fields !== 'object') {
        throw new Error('Il campo data_fields deve essere un oggetto valido');
      }
    }
  }
});

// Hook per gestire errori durante la creazione
ReferenzeDefine.addHook('beforeCreate', (referenze: Referenze) => {
  if (!referenze.codice_box || referenze.codice_box.trim().length === 0) {
    throw new Error('Il campo codice_box è obbligatorio e non può essere vuoto');
  }


  if (!referenze.id_runtime_kit) {
    throw new Error('Il campo id_runtime_kit è obbligatorio');
  }

  if (!referenze.id_promo) {
    throw new Error('Il campo id_promo è obbligatorio');
  }

  if (!referenze.data_fields || typeof referenze.data_fields !== 'object') {
    throw new Error('Il campo data_fields deve essere un oggetto valido');
  }
});

// Hook per gestire errori durante l'aggiornamento
ReferenzeDefine.addHook('beforeUpdate', (referenze: Referenze) => {
  if (referenze.codice_box !== undefined && (!referenze.codice_box || referenze.codice_box.trim().length === 0)) {
    throw new Error('Il campo codice_box non può essere vuoto');
  }
  if (referenze.id_runtime_kit !== undefined && !referenze.id_runtime_kit) {
    throw new Error('Il campo id_runtime_kit non può essere vuoto');
  }

  if (referenze.id_promo !== undefined && !referenze.id_promo) {
    throw new Error('Il campo id_promo non può essere vuoto');
  }

  if (referenze.data_fields !== undefined && (!referenze.data_fields || typeof referenze.data_fields !== 'object')) {
    throw new Error('Il campo data_fields deve essere un oggetto valido');
  }
});

export { ReferenzeDefine as Referenze };
