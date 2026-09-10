import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Modello FilesRuntime per gestione file di runtime
 * Basato sulla struttura MongoDB fornita dall'utente
 */

export interface FilesRuntimeAttributes {
  id: string;
  url?: string;
  id_runtime?: string;
  direttive?: string;
  nome?: string;
  nome_originale?: string;
  is_optional?: boolean;
  id_olimpo_cloud?: string;
  meta_olimpo_cloud?: any;
  tipo_export?: string;
  blob?: string;
  mime?: string;
  error?: string;
  pages?: number;
  is_merged_group?: boolean;
  merged_group_id?: string;
  merged_file_ids?: string[];
  virtual_dir?: any;
  tipo_export_codice?: string;
  id_ordine_stampa?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FilesRuntimeCreationAttributes extends Optional<FilesRuntimeAttributes, "id" | "createdAt" | "updatedAt"> { }

class FilesRuntime extends Model<FilesRuntimeAttributes, FilesRuntimeCreationAttributes> implements FilesRuntimeAttributes {
  declare id: string;
  declare url?: string;
  declare id_runtime?: string;
  declare direttive?: string;
  declare nome?: string;
  declare nome_originale?: string;
  declare is_optional?: boolean;
  declare id_olimpo_cloud?: string;
  declare meta_olimpo_cloud?: any;
  declare tipo_export?: string;
  declare blob?: string;
  declare mime?: string;
  declare error?: string;
  declare pages?: number;
  declare is_merged_group?: boolean;
  declare merged_group_id?: string;
  declare merged_file_ids?: string[];
  declare virtual_dir?: any;
  declare tipo_export_codice?: string;
  declare id_ordine_stampa?: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

const FilesRuntimeDefine = sequelize.define<FilesRuntime>("files_runtime", {
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
  url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  id_runtime: {
    type: DataTypes.UUID,
    allowNull: true
  },
  direttive: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 10000],
        msg: 'Il campo direttive deve essere compreso tra 0 e 10000 caratteri'
      }
    }
  },
  nome: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo nome deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  nome_originale: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo nome_originale deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  is_optional: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
    validate: {
      isBoolean: {
        msg: 'Il campo is_optional deve essere un valore booleano'
      }
    }
  },
  id_olimpo_cloud: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo id_olimpo_cloud deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  meta_olimpo_cloud: {
    type: DataTypes.JSONB,
    allowNull: true,
    validate: {
      isValidObject(value: any) {
        if (value !== null && value !== undefined && typeof value !== 'object') {
          throw new Error('Il campo meta_olimpo_cloud deve essere un oggetto o null');
        }
      }
    }
  },
  tipo_export: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 100],
        msg: 'Il campo tipo_export deve essere compreso tra 0 e 100 caratteri'
      }
    }
  },
  blob: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 1000000],
        msg: 'Il campo blob deve essere compreso tra 0 e 1000000 caratteri'
      }
    }
  },
  mime: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 100],
        msg: 'Il campo mime deve essere compreso tra 0 e 100 caratteri'
      },
      isValidMimeType(value: string) {
        if (value && !/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/.test(value)) {
          throw new Error('Il campo mime deve essere un tipo MIME valido');
        }
      }
    }
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 5000],
        msg: 'Il campo error deve essere compreso tra 0 e 5000 caratteri'
      }
    }
  },
  pages: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      isInt: {
        msg: 'Il campo pages deve essere un numero intero'
      }
    }
  },
  is_merged_group: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
  merged_group_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  merged_file_ids: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: true,
    defaultValue: []
  },
  virtual_dir: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  tipo_export_codice: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 100],
        msg: 'Il campo tipo_export_codice deve essere compreso tra 0 e 100 caratteri'
      }
    }
  },
  id_ordine_stampa: {
    type: DataTypes.STRING,
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
  tableName: "files_runtime",
  freezeTableName: true,
  indexes: [
    {
      fields: ['id_runtime']
    },
    {
      fields: ['nome']
    },
    {
      fields: ['tipo_export']
    },
    {
      fields: ['is_optional']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['updatedAt']
    },
    {
      fields: ['tipo_export_codice']
    },
    {
      fields: ['id_ordine_stampa', 'is_merged_group']
    }
  ],
  validate: {
    validazioneCoerenza() {
      // Validazione che se è presente un blob, deve essere specificato anche il mime type
      if (this.blob && !this.mime) {
        throw new Error('Se è presente un blob, deve essere specificato anche il mime type');
      }
    }
  }
});

// Hook per gestire errori durante la creazione
FilesRuntimeDefine.addHook('beforeCreate', (filesRuntime: FilesRuntime) => {
  // Validazione che se è presente un blob, deve essere specificato anche il mime type
  if (filesRuntime.blob && !filesRuntime.mime) {
    throw new Error('Se è presente un blob, deve essere specificato anche il mime type');
  }
});

// Hook per gestire errori durante l'aggiornamento
FilesRuntimeDefine.addHook('beforeUpdate', (filesRuntime: FilesRuntime) => {
  // Validazione che se è presente un blob, deve essere specificato anche il mime type
  if (filesRuntime.blob && !filesRuntime.mime) {
    throw new Error('Se è presente un blob, deve essere specificato anche il mime type');
  }
});

export { FilesRuntimeDefine as FilesRuntime };
