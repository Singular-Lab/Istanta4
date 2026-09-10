import { DataTypes, Model, Optional } from 'sequelize';
import { STATO_LAVORAZIONE_KIT_RUNTIME, TIPO_KIT_DESIGN } from '../../../lib/enums';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Modello RuntimeKit per gestione kit di runtime
 * Basato sulla struttura MongoDB fornita dall'utente
 */

export interface RuntimeKitAttributes {
  id: string;
  id_area: string;
  filtro: any[];
  filtro_contesto: Array<{
    titolo_filtro: string;
    condizioni: Array<{
      nome_field: string;
      operatore: string;
      valore: string;
      id_addestramento: string;
    }>;
  }>;
  id_design: string;
  id_canale: string;
  id_formato: string;
  tipi_di_export_in_kit: Array<{
    tipo_di_export_guid_id: string;
    filtro: Array<{
      titolo_filtro: string;
      condizioni: Array<{
        nome_field: string;
        operatore: string;
        valore: string;
        id_addestramento: string;
      }>;
    }>;
    use_webhook?: boolean;
    webhook_events?: string;
  }>;
  quantita_copie: number;
  titolo: string;
  id_raccoglitore: string;
  stato: string;
  id_promo: string;
  tipo: TIPO_KIT_DESIGN;
  nome_area?: string;
  nome_canale?: string;
  codice_area?: string;
  codice_canale?: string;
  webpliant?: any[];
  declinazioni?: any[];
  stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME;
  files_data: Array<{
    id: string;
    nome: string;
    direttive: string;
    is_optional: boolean;
    nome_originale?: string;
    tipo_export?: string;
    id_runtime?: string;
  }>;
  tags: Array<string>;
  inizio_lavorazione?: Date;
  fine_lavorazione?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface RuntimeKitCreationAttributes extends Optional<RuntimeKitAttributes, "id" | "createdAt" | "updatedAt"> { }

class RuntimeKit extends Model<RuntimeKitAttributes, RuntimeKitCreationAttributes> implements RuntimeKitAttributes {
  declare id: string;
  declare id_area: string;
  declare filtro: any[];
  declare filtro_contesto: Array<{
    titolo_filtro: string;
    condizioni: Array<{
      nome_field: string;
      operatore: string;
      valore: string;
      id_addestramento: string;
    }>;
  }>;
  declare id_design: string;
  declare id_canale: string;
  declare id_formato: string;
  declare tipi_di_export_in_kit: Array<{
    tipo_di_export_guid_id: string;
    filtro: Array<{
      titolo_filtro: string;
      condizioni: Array<{
        nome_field: string;
        operatore: string;
        valore: string;
        id_addestramento: string;
      }>;
    }>;
    use_webhook?: boolean;
    webhook_events?: string;
  }>;
  declare quantita_copie: number;
  declare titolo: string;
  declare id_raccoglitore: string;
  declare stato: string;
  declare id_promo: string;
  declare tipo: TIPO_KIT_DESIGN;
  declare nome_area?: string;
  declare nome_canale?: string;
  declare codice_area?: string;
  declare codice_canale?: string;
  declare webpliant?: any[];
  declare declinazioni?: any[];
  declare stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME;
  declare files_data: Array<{
    id: string;
    nome: string;
    direttive: string;
    is_optional: boolean;
    nome_originale?: string;
    tipo_export?: string;
    id_runtime?: string;
  }>;
  declare tags: Array<string>;
  declare inizio_lavorazione?: Date;
  declare fine_lavorazione?: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
}

const RuntimeKitDefine = sequelize.define<RuntimeKit>("runtime_kit", {
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
    type: DataTypes.UUID,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo id_area non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo id_area non può essere null'
      }
    }
  },
  filtro: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo filtro non può essere null'
      },
      isValidArray(value: any) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo filtro deve essere un array');
        }
      }
    }
  },
  filtro_contesto: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo filtro_contesto non può essere null'
      },
      isValidContextFilter(value: any[]) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo filtro_contesto deve essere un array');
        }
        for (const item of value) {
          if (!item || typeof item !== 'object') {
            throw new Error('Ogni elemento di filtro_contesto deve essere un oggetto');
          }
          if (!item.titolo_filtro || typeof item.titolo_filtro !== 'string') {
            throw new Error('Ogni elemento di filtro_contesto deve avere un titolo_filtro valido');
          }
          if (!Array.isArray(item.condizioni)) {
            throw new Error('Le condizioni in filtro_contesto devono essere un array');
          }
        }
      }
    }
  },
  id_design: {
    type: DataTypes.UUID,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo id_design non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo id_design non può essere null'
      }
    }
  },
  id_canale: {
    type: DataTypes.UUID,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo id_canale non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo id_canale non può essere null'
      }
    }
  },
  id_formato: {
    type: DataTypes.UUID,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo id_formato non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo id_formato non può essere null'
      }
    }
  },
  tipi_di_export_in_kit: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo tipi_di_export_in_kit non può essere null'
      },
      isValidExportTypes(value: any[]) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo tipi_di_export_in_kit deve essere un array');
        }
        for (const item of value) {
          if (!item || typeof item !== 'object') {
            throw new Error('Ogni elemento di tipi_di_export_in_kit deve essere un oggetto');
          }
          if (!item.tipo_di_export_guid_id || typeof item.tipo_di_export_guid_id !== 'string') {
            throw new Error('Ogni elemento di tipi_di_export_in_kit deve avere un tipo_di_export_guid_id valido');
          }
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(item.tipo_di_export_guid_id)) {
            throw new Error(`GUID non valido in tipi_di_export_in_kit: ${item.tipo_di_export_guid_id}`);
          }
          if (item.filtro !== null && item.filtro !== undefined && !Array.isArray(item.filtro)) {
            throw new Error('Il campo filtro in tipi_di_export_in_kit deve essere null o un array');
          }
        }
      }
    }
  },
  quantita_copie: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      notNull: {
        msg: 'Il campo quantita_copie non può essere null'
      },
      isInt: {
        msg: 'Il campo quantita_copie deve essere un numero intero'
      },
      min: {
        args: [1],
        msg: 'Il campo quantita_copie deve essere maggiore di 0'
      }
    }
  },
  titolo: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo titolo non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo titolo non può essere null'
      },
      len: {
        args: [1, 255],
        msg: 'Il campo titolo deve essere compreso tra 1 e 255 caratteri'
      }
    }
  },
  id_raccoglitore: {
    type: DataTypes.UUID,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo id_raccoglitore non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo id_raccoglitore non può essere null'
      }
    }
  },
  stato: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo stato non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo stato non può essere null'
      },
      len: {
        args: [1, 50],
        msg: 'Il campo stato deve essere compreso tra 1 e 50 caratteri'
      }
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
  tipo: {
    type: DataTypes.ENUM(TIPO_KIT_DESIGN.AUTOMATICO, TIPO_KIT_DESIGN.MANUALE, TIPO_KIT_DESIGN.SEMI_AUTOMATICO),
    allowNull: false,
    validate: {
      notNull: {
        msg: 'Il campo tipo non può essere null'
      },
      isIn: {
        args: [[TIPO_KIT_DESIGN.AUTOMATICO, TIPO_KIT_DESIGN.MANUALE, TIPO_KIT_DESIGN.SEMI_AUTOMATICO]],
        msg: 'Il campo tipo deve essere AUTOMATICO, MANUALE o SEMI_AUTOMATICO'
      }
    }
  },
  nome_area: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo nome_area deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  nome_canale: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo nome_canale deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  codice_area: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 50],
        msg: 'Il campo codice_area deve essere compreso tra 0 e 50 caratteri'
      }
    }
  },
  codice_canale: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 50],
        msg: 'Il campo codice_canale deve essere compreso tra 0 e 50 caratteri'
      }
    }
  },
  webpliant: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    validate: {
      isValidArray(value: any) {
        if (value !== null && value !== undefined && !Array.isArray(value)) {
          throw new Error('Il campo webpliant deve essere un array o null');
        }
      }
    }
  },
  declinazioni: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    validate: {
      isValidArray(value: any) {
        if (value !== null && value !== undefined && !Array.isArray(value)) {
          throw new Error('Il campo declinazioni deve essere un array o null');
        }
      }
    }
  },
  stato_lavorazione: {
    type: DataTypes.ENUM(
      STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE,
      STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI,
      STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO,
      STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE,
      STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO
    ),
    allowNull: false,
    validate: {
      notNull: {
        msg: 'Il campo stato_lavorazione non può essere null'
      },
      isIn: {
        args: [[
          STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE,
          STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI,
          STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO,
          STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE,
          STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO
        ]],
        msg: 'Il campo stato_lavorazione deve essere uno degli stati validi'
      }
    }
  },
  files_data: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo files_data non può essere null'
      },
      isValidFilesArray(value: any[]) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo files_data deve essere un array');
        }
      }
    }
  },
  inizio_lavorazione: {
    type: DataTypes.DATE,
    allowNull: true
  },
  fine_lavorazione: {
    type: DataTypes.DATE,
    allowNull: true
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: "I tags non possono essere null"
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
  tableName: "runtime_kit",
  freezeTableName: true,
  indexes: [
    {
      fields: ['id_area']
    },
    {
      fields: ['id_canale']
    },
    {
      fields: ['id_formato']
    },
    {
      fields: ['id_design']
    },
    {
      fields: ['id_raccoglitore']
    },
    {
      fields: ['id_promo']
    },
    {
      fields: ['tipo']
    },
    {
      fields: ['stato']
    },
    {
      fields: ['stato_lavorazione']
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
      // Validazione che il titolo non sia vuoto
      if (!this.titolo || (typeof this.titolo === 'string' && this.titolo.trim().length === 0)) {
        throw new Error('Il titolo non può essere vuoto');
      }

      // Validazione che la quantità copie sia positiva
      if (typeof this.quantita_copie === 'number' && this.quantita_copie <= 0) {
        throw new Error('La quantità copie deve essere maggiore di 0');
      }

      // Validazione che almeno un tipo di export sia configurato
      if (!this.tipi_di_export_in_kit || !Array.isArray(this.tipi_di_export_in_kit) || this.tipi_di_export_in_kit.length === 0) {
        throw new Error('Deve essere configurato almeno un tipo di export');
      }
    }
  }
});

// Hook per gestire errori durante la creazione
RuntimeKitDefine.addHook('beforeCreate', (runtimeKit: RuntimeKit) => {
  if (!runtimeKit.titolo || runtimeKit.titolo.trim().length === 0) {
    throw new Error('Il campo titolo è obbligatorio e non può essere vuoto');
  }

  if (!runtimeKit.id_area) {
    throw new Error('Il campo id_area è obbligatorio');
  }

  if (!runtimeKit.id_canale) {
    throw new Error('Il campo id_canale è obbligatorio');
  }

  if (!runtimeKit.id_formato) {
    throw new Error('Il campo id_formato è obbligatorio');
  }

  if (!runtimeKit.id_design) {
    throw new Error('Il campo id_design è obbligatorio');
  }

  if (!runtimeKit.id_raccoglitore) {
    throw new Error('Il campo id_raccoglitore è obbligatorio');
  }

  if (!runtimeKit.id_promo) {
    throw new Error('Il campo id_promo è obbligatorio');
  }
});

// Hook per gestire errori durante l'aggiornamento
RuntimeKitDefine.addHook('beforeUpdate', (runtimeKit: RuntimeKit) => {
  if (runtimeKit.titolo !== undefined && (!runtimeKit.titolo || runtimeKit.titolo.trim().length === 0)) {
    throw new Error('Il campo titolo non può essere vuoto');
  }

  if (runtimeKit.id_area !== undefined && !runtimeKit.id_area) {
    throw new Error('Il campo id_area non può essere vuoto');
  }

  if (runtimeKit.id_canale !== undefined && !runtimeKit.id_canale) {
    throw new Error('Il campo id_canale non può essere vuoto');
  }

  if (runtimeKit.id_formato !== undefined && !runtimeKit.id_formato) {
    throw new Error('Il campo id_formato non può essere vuoto');
  }

  if (runtimeKit.id_design !== undefined && !runtimeKit.id_design) {
    throw new Error('Il campo id_design non può essere vuoto');
  }

  if (runtimeKit.id_raccoglitore !== undefined && !runtimeKit.id_raccoglitore) {
    throw new Error('Il campo id_raccoglitore non può essere vuoto');
  }

  if (runtimeKit.id_promo !== undefined && !runtimeKit.id_promo) {
    throw new Error('Il campo id_promo non può essere vuoto');
  }
});

export { RuntimeKitDefine as RuntimeKit };
