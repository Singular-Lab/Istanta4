import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Modello ContenutiAggiuntiviReferenza per gestione contenuti aggiuntivi delle referenze
 * Basato sulla struttura tipica del progetto
 */

export interface ContenutiAggiuntiviReferenzaAttributes {
  id: string;
  id_referenza: string;
  tipo_contenuto: string;
  titolo?: string;
  descrizione?: string;
  contenuto: any;
  ordine?: number;
  attivo: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

interface ContenutiAggiuntiviReferenzaCreationAttributes extends Optional<ContenutiAggiuntiviReferenzaAttributes, "id" | "createdAt" | "updatedAt"> { }

class ContenutiAggiuntiviReferenza extends Model<ContenutiAggiuntiviReferenzaAttributes, ContenutiAggiuntiviReferenzaCreationAttributes> implements ContenutiAggiuntiviReferenzaAttributes {
  declare id: string;
  declare id_referenza: string;
  declare tipo_contenuto: string;
  declare titolo?: string;
  declare descrizione?: string;
  declare contenuto: any;
  declare ordine?: number;
  declare attivo: boolean;
  declare metadata?: any;
  declare createdAt: Date;
  declare updatedAt: Date;
}

const ContenutiAggiuntiviReferenzaDefine = sequelize.define<ContenutiAggiuntiviReferenza>("contenuti_aggiuntivi_referenza", {
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
  id_referenza: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo id_referenza non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo id_referenza non può essere null'
      },
      len: {
        args: [1, 255],
        msg: 'Il campo id_referenza deve essere compreso tra 1 e 255 caratteri'
      }
    }
  },
  tipo_contenuto: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo tipo_contenuto non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo tipo_contenuto non può essere null'
      },
      len: {
        args: [1, 255],
        msg: 'Il campo tipo_contenuto deve essere compreso tra 1 e 255 caratteri'
      }
    }
  },
  titolo: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo titolo deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  descrizione: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 5000],
        msg: 'Il campo descrizione deve essere compreso tra 0 e 5000 caratteri'
      }
    }
  },
  contenuto: {
    type: DataTypes.JSONB,
    allowNull: false,
    validate: {
      notNull: {
        msg: 'Il campo contenuto non può essere null'
      },
      isValidContenuto(value: any) {
        if (value === null || value === undefined) {
          throw new Error('Il campo contenuto deve essere un oggetto valido');
        }
      }
    }
  },
  ordine: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      isInt: {
        msg: 'Il campo ordine deve essere un numero intero'
      },
      min: {
        args: [0],
        msg: 'Il campo ordine deve essere maggiore o uguale a 0'
      }
    }
  },
  attivo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    validate: {
      notNull: {
        msg: 'Il campo attivo non può essere null'
      }
    }
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    validate: {
      isValidMetadata(value: any) {
        if (value !== null && value !== undefined && typeof value !== 'object') {
          throw new Error('Il campo metadata deve essere un oggetto valido');
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
  tableName: "contenuti_aggiuntivi_referenza",
  freezeTableName: true,
  indexes: [
    {
      fields: ['id_referenza']
    },
    {
      fields: ['tipo_contenuto']
    },
    {
      fields: ['attivo']
    },
    {
      fields: ['ordine']
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
      // Validazione che l'id_referenza non sia vuoto
      if (!this.id_referenza || (typeof this.id_referenza === 'string' && this.id_referenza.trim().length === 0)) {
        throw new Error('L\'id_referenza non può essere vuoto');
      }

      // Validazione che il tipo_contenuto non sia vuoto
      if (!this.tipo_contenuto || (typeof this.tipo_contenuto === 'string' && this.tipo_contenuto.trim().length === 0)) {
        throw new Error('Il tipo_contenuto non può essere vuoto');
      }

      // Validazione che il contenuto non sia vuoto
      if (!this.contenuto) {
        throw new Error('Il contenuto non può essere vuoto');
      }
    }
  }
});

// Hook per gestire errori durante la creazione
ContenutiAggiuntiviReferenzaDefine.addHook('beforeCreate', (contenuto: ContenutiAggiuntiviReferenza) => {
  if (!contenuto.id_referenza || contenuto.id_referenza.trim().length === 0) {
    throw new Error('Il campo id_referenza è obbligatorio e non può essere vuoto');
  }

  if (!contenuto.tipo_contenuto || contenuto.tipo_contenuto.trim().length === 0) {
    throw new Error('Il campo tipo_contenuto è obbligatorio e non può essere vuoto');
  }

  if (!contenuto.contenuto) {
    throw new Error('Il campo contenuto è obbligatorio');
  }
});

// Hook per gestire errori durante l'aggiornamento
ContenutiAggiuntiviReferenzaDefine.addHook('beforeUpdate', (contenuto: ContenutiAggiuntiviReferenza) => {
  if (contenuto.id_referenza !== undefined && (!contenuto.id_referenza || contenuto.id_referenza.trim().length === 0)) {
    throw new Error('Il campo id_referenza non può essere vuoto');
  }

  if (contenuto.tipo_contenuto !== undefined && (!contenuto.tipo_contenuto || contenuto.tipo_contenuto.trim().length === 0)) {
    throw new Error('Il campo tipo_contenuto non può essere vuoto');
  }

  if (contenuto.contenuto !== undefined && !contenuto.contenuto) {
    throw new Error('Il campo contenuto non può essere vuoto');
  }
});

export { ContenutiAggiuntiviReferenzaDefine as ContenutiAggiuntiviReferenza };
