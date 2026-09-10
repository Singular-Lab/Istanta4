import { DataTypes, Model, Optional } from 'sequelize';
import { EVENTI_WEBHOOK, TIPO_KIT_DESIGN } from '../../../lib/enums';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Modello DesignKit per gestione kit di design
 * Basato sulla struttura MongoDB fornita dall'utente
 */

export interface DesignKitAttributes {
  id: string;
  id_area: string;
  filtro: any[];
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
    webhook_events?: EVENTI_WEBHOOK;
  }>;
  quantita_copie: number;
  titolo: string;
  id_raccoglitore: string;
  stato: string;
  declinazioni: any[];
  context: any[];
  tipo: TIPO_KIT_DESIGN;
  filtro_contesto: Array<{
    titolo_filtro: string;
    condizioni: Array<{
      nome_field: string;
      operatore: string;
      valore: string;
      id_addestramento: string;
    }>;
  }>;
  tags: Array<string>;
  createdAt: Date;
  updatedAt: Date;
}

interface DesignKitCreationAttributes extends Optional<DesignKitAttributes, "id" | "createdAt" | "updatedAt"> { }

class DesignKit extends Model<DesignKitAttributes, DesignKitCreationAttributes> implements DesignKitAttributes {
  declare id: string;
  declare id_area: string;
  declare filtro: any[];
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
    webhook_events?: EVENTI_WEBHOOK;
  }>;
  declare quantita_copie: number;
  declare titolo: string;
  declare id_raccoglitore: string;
  declare stato: string;
  declare declinazioni: any[];
  declare context: any[];
  declare tipo: TIPO_KIT_DESIGN;
  declare filtro_contesto: Array<{
    titolo_filtro: string;
    condizioni: Array<{
      nome_field: string;
      operatore: string;
      valore: string;
      id_addestramento: string;
    }>;
  }>;
  declare tags: Array<string>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

const DesignKitDefine = sequelize.define<DesignKit>("design_kit", {
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
          if (item.webhook_events && !Object.values(EVENTI_WEBHOOK).includes(item.webhook_events)) {
            throw new Error(`Evento webhook non valido: ${item.webhook_events}`);
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
  declinazioni: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo declinazioni non può essere null'
      },
      isValidArray(value: any) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo declinazioni deve essere un array');
        }
      }
    }
  },
  context: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo context non può essere null'
      },
      isValidArray(value: any) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo context deve essere un array');
        }
      }
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
  tableName: "design_kit",
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
      fields: ['id_raccoglitore']
    },
    {
      fields: ['tipo']
    },
    {
      fields: ['stato']
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
DesignKitDefine.addHook('beforeCreate', (designKit: DesignKit) => {
  // Validazione aggiuntiva per i campi obbligatori

  if (!designKit.titolo || designKit.titolo.trim().length === 0) {
    throw new Error('Il campo titolo è obbligatorio e non può essere vuoto');
  }

  if (!designKit.id_area) {
    throw new Error('Il campo id_area è obbligatorio');
  }

  if (!designKit.id_canale) {
    throw new Error('Il campo id_canale è obbligatorio');
  }

  if (!designKit.id_formato) {
    throw new Error('Il campo id_formato è obbligatorio');
  }

  if (!designKit.id_raccoglitore) {
    throw new Error('Il campo id_raccoglitore è obbligatorio');
  }
});

// Hook per gestire errori durante l'aggiornamento
DesignKitDefine.addHook('beforeUpdate', (designKit: DesignKit) => {
  // Validazione per i campi che non possono essere vuoti
  if (designKit.titolo !== undefined && (!designKit.titolo || designKit.titolo.trim().length === 0)) {
    throw new Error('Il campo titolo non può essere vuoto');
  }

  if (designKit.id_area !== undefined && !designKit.id_area) {
    throw new Error('Il campo id_area non può essere vuoto');
  }

  if (designKit.id_canale !== undefined && !designKit.id_canale) {
    throw new Error('Il campo id_canale non può essere vuoto');
  }

  if (designKit.id_formato !== undefined && !designKit.id_formato) {
    throw new Error('Il campo id_formato non può essere vuoto');
  }

  if (designKit.id_raccoglitore !== undefined && !designKit.id_raccoglitore) {
    throw new Error('Il campo id_raccoglitore non può essere vuoto');
  }
});

export { DesignKitDefine as DesignKit };
