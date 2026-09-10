import { DataTypes, Model, Optional } from 'sequelize';
import { STATO_LOG_FILE } from '../../../lib/enums';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Modello FilesRuntimeLog per gestione log dei file runtime
 * Basato sulla struttura MongoDB fornita dall'utente
 */

export interface FilesRuntimeLogAttributes {
  id: string;
  id_kit_runtime: string;
  nome_file: string;
  data_registrazione: Date;
  versione: number;
  stato: STATO_LOG_FILE;
  logs: Array<{
    messaggio?: string;
    data_notifica?: Date;
    azione: 'Upload' | 'Download' | 'Rifiutato' | 'Accettato';
    utente_notifica?: string;
    dettagli_aggiuntivi?: any;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface FilesRuntimeLogCreationAttributes extends Optional<FilesRuntimeLogAttributes, "id" | "createdAt" | "updatedAt"> { }

class FilesRuntimeLog extends Model<FilesRuntimeLogAttributes, FilesRuntimeLogCreationAttributes> implements FilesRuntimeLogAttributes {
  declare id: string;
  declare id_kit_runtime: string;
  declare nome_file: string;
  declare data_registrazione: Date;
  declare versione: number;
  declare stato: STATO_LOG_FILE;
  declare logs: Array<{
    messaggio?: string;
    data_notifica?: Date;
    azione: 'Upload' | 'Download' | 'Rifiutato' | 'Accettato';
    utente_notifica?: string;
    dettagli_aggiuntivi?: any;
  }>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

const FilesRuntimeLogDefine = sequelize.define<FilesRuntimeLog>("files_runtime_log", {
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
  id_kit_runtime: {
    type: DataTypes.UUID,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo id_kit_runtime non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo id_kit_runtime non può essere null'
      }
    }
  },
  nome_file: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo nome_file non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo nome_file non può essere null'
      },
      len: {
        args: [1, 255],
        msg: 'Il campo nome_file deve essere compreso tra 1 e 255 caratteri'
      }
    }
  },
  data_registrazione: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      notNull: {
        msg: 'Il campo data_registrazione non può essere null'
      },
      isDate: {
        msg: 'Il campo data_registrazione deve essere una data valida',
        args: true
      }
    }
  },
  versione: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: {
        msg: 'Il campo versione non può essere null'
      },
      isInt: {
        msg: 'Il campo versione deve essere un numero intero'
      },
      min: {
        args: [1],
        msg: 'Il campo versione deve essere maggiore di 0'
      }
    }
  },
  stato: {
    type: DataTypes.ENUM(
      STATO_LOG_FILE.IN_ATTESA,
      STATO_LOG_FILE.IN_REVISIONE,
      STATO_LOG_FILE.ACCETTATO,
      STATO_LOG_FILE.ERRORE,
      STATO_LOG_FILE.PUBBLICATO,
      STATO_LOG_FILE.IN_ATTESA_DI_CORREGGO,
      STATO_LOG_FILE.CORREGGO_PUBBLICATO,
      STATO_LOG_FILE.CORREGGO_ERRORE
    ),
    allowNull: false,
    validate: {
      notNull: {
        msg: 'Il campo stato non può essere null'
      },
      isIn: {
        args: [[
          STATO_LOG_FILE.IN_ATTESA,
          STATO_LOG_FILE.IN_REVISIONE,
          STATO_LOG_FILE.ACCETTATO,
          STATO_LOG_FILE.ERRORE,
          STATO_LOG_FILE.PUBBLICATO,
          STATO_LOG_FILE.IN_ATTESA_DI_CORREGGO,
          STATO_LOG_FILE.CORREGGO_PUBBLICATO,
          STATO_LOG_FILE.CORREGGO_ERRORE
        ]],
        msg: 'Il campo stato deve essere uno degli stati validi'
      }
    }
  },
  logs: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo logs non può essere null'
      },
      isValidLogs(value: any[]) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo logs deve essere un array');
        }
        for (const log of value) {
          if (!log || typeof log !== 'object') {
            throw new Error('Ogni elemento di logs deve essere un oggetto');
          }
          if (!log.azione) {
            throw new Error('Ogni elemento di logs deve avere un campo azione');
          }
          if (!['Upload', 'Download', 'Rifiutato', 'Accettato'].includes(log.azione)) {
            throw new Error('Il campo azione deve essere uno di: Upload, Download, Rifiutato, Accettato');
          }
          if (log.data_notifica && !(log.data_notifica instanceof Date) && isNaN(new Date(log.data_notifica).getTime())) {
            throw new Error('Il campo data_notifica deve essere una data valida');
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
  tableName: "files_runtime_log",
  freezeTableName: true,
  indexes: [
    {
      fields: ['id_kit_runtime']
    },
    {
      fields: ['nome_file']
    },
    {
      fields: ['stato']
    },
    {
      fields: ['data_registrazione']
    },
    {
      fields: ['versione']
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
      // Validazione che il nome_file non sia vuoto (skip per update parziali dove il campo non è presente)
      if (this.nome_file !== undefined && (!this.nome_file || (typeof this.nome_file === 'string' && this.nome_file.trim().length === 0))) {
        throw new Error('Il nome_file non può essere vuoto');
      }

      // Validazione che la versione sia positiva (skip per update parziali)
      if (this.versione !== undefined && typeof this.versione === 'number' && this.versione <= 0) {
        throw new Error('La versione deve essere maggiore di 0');
      }

      // Validazione che data_registrazione sia una data valida (skip per update parziali)
      if (this.data_registrazione !== undefined && (!this.data_registrazione || (!(this.data_registrazione instanceof Date) && isNaN(new Date(this.data_registrazione as any).getTime())))) {
        throw new Error('La data_registrazione deve essere una data valida');
      }
    }
  }
});

// Hook per gestire errori durante la creazione
FilesRuntimeLogDefine.addHook('beforeCreate', (filesRuntimeLog: FilesRuntimeLog) => {
  if (!filesRuntimeLog.nome_file || filesRuntimeLog.nome_file.trim().length === 0) {
    throw new Error('Il campo nome_file è obbligatorio e non può essere vuoto');
  }

  if (!filesRuntimeLog.id_kit_runtime) {
    throw new Error('Il campo id_kit_runtime è obbligatorio');
  }

  if (!filesRuntimeLog.data_registrazione) {
    throw new Error('Il campo data_registrazione è obbligatorio');
  }

  if (!filesRuntimeLog.versione || filesRuntimeLog.versione <= 0) {
    throw new Error('Il campo versione è obbligatorio e deve essere maggiore di 0');
  }

  if (!filesRuntimeLog.stato) {
    throw new Error('Il campo stato è obbligatorio');
  }
});

// Hook per gestire errori durante l'aggiornamento
FilesRuntimeLogDefine.addHook('beforeUpdate', (filesRuntimeLog: FilesRuntimeLog) => {
  if (filesRuntimeLog.nome_file !== undefined && (!filesRuntimeLog.nome_file || filesRuntimeLog.nome_file.trim().length === 0)) {
    throw new Error('Il campo nome_file non può essere vuoto');
  }

  if (filesRuntimeLog.id_kit_runtime !== undefined && !filesRuntimeLog.id_kit_runtime) {
    throw new Error('Il campo id_kit_runtime non può essere vuoto');
  }

  if (filesRuntimeLog.data_registrazione !== undefined && !filesRuntimeLog.data_registrazione) {
    throw new Error('Il campo data_registrazione non può essere vuoto');
  }

  if (filesRuntimeLog.versione !== undefined && (!filesRuntimeLog.versione || filesRuntimeLog.versione <= 0)) {
    throw new Error('Il campo versione deve essere maggiore di 0');
  }

  if (filesRuntimeLog.stato !== undefined && !filesRuntimeLog.stato) {
    throw new Error('Il campo stato non può essere vuoto');
  }
});

export { FilesRuntimeLogDefine as FilesRuntimeLog };
