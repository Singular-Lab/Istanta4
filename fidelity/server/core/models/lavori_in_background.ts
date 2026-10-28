import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Lavori lunghi (import, raggruppamenti, ...) eseguiti in background da un worker del cluster.
 * Lo stato sta qui e non nella memoria del processo: con piu worker senza sticky session
 * stato, annullamento e decisioni arrivano a un worker qualsiasi.
 */

/** Stati di un lavoro. Stringhe e non ENUM: un tipo di lavoro nuovo non richiede di alterare la colonna. */
export const STATO_LAVORO = {
  IN_CORSO: 'IN_CORSO',
  IN_ATTESA_DECISIONE: 'IN_ATTESA_DECISIONE',
  COMPLETATO: 'COMPLETATO',
  ANNULLATO: 'ANNULLATO',
  ERRORE: 'ERRORE',
  /** Il processo che lo eseguiva si e fermato (riavvio, crash) prima di concluderlo. */
  INTERROTTO: 'INTERROTTO',
} as const;

export type StatoLavoro = typeof STATO_LAVORO[keyof typeof STATO_LAVORO];

/** Stati attivi: al piu un lavoro attivo per tipo e chiave. */
export const STATI_LAVORO_ATTIVI: StatoLavoro[] = [STATO_LAVORO.IN_CORSO, STATO_LAVORO.IN_ATTESA_DECISIONE];

export interface LavoroInBackgroundAttributes {
  id: string;
  /** Tipo di lavoro, es. import_punti_vendita. */
  tipo: string;
  /** Ambito in cui il lavoro e unico mentre e attivo, es. l'id della GDO o dell'ordine. */
  chiave: string;
  id_utente: string | null;
  id_gdo: string | null;
  stato: StatoLavoro;
  /** Avanzamento nella forma che il tipo di lavoro restituisce al client. */
  avanzamento: any;
  /** Identifica la richiesta su cui il lavoro e fermo: una decisione vale solo per quella. */
  attesa: string | null;
  richiesta_decisione: any;
  /** Decisione registrata (o prenotata da chi la sta applicando) sulla richiesta in attesa. */
  decisione: any;
  annullamento_richiesto: boolean;
  risultato: any;
  errore: string | null;
  /** Rinnovato da chi esegue il lavoro: se e vecchio il processo si e fermato. */
  heartbeat_at: Date;
  concluso_at: Date | null;
  createdat?: Date;
  updatedat?: Date;
}

type LavoroInBackgroundCreationAttributes = Optional<
  LavoroInBackgroundAttributes,
  'id' | 'id_utente' | 'id_gdo' | 'avanzamento' | 'attesa' | 'richiesta_decisione' | 'decisione' | 'annullamento_richiesto' | 'risultato' | 'errore' | 'heartbeat_at' | 'concluso_at'
>;

class LavoroInBackground extends Model<LavoroInBackgroundAttributes, LavoroInBackgroundCreationAttributes> implements LavoroInBackgroundAttributes {
  declare id: string;
  declare tipo: string;
  declare chiave: string;
  declare id_utente: string | null;
  declare id_gdo: string | null;
  declare stato: StatoLavoro;
  declare avanzamento: any;
  declare attesa: string | null;
  declare richiesta_decisione: any;
  declare decisione: any;
  declare annullamento_richiesto: boolean;
  declare risultato: any;
  declare errore: string | null;
  declare heartbeat_at: Date;
  declare concluso_at: Date | null;
  declare createdat?: Date;
  declare updatedat?: Date;
}

const LavoroInBackgroundDefine = sequelize.define<LavoroInBackground>('lavori_in_background', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  tipo: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  chiave: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  // Stringhe: un lavoro di sistema puo non avere utente, e l'id non deve per forza essere un UUID
  id_utente: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  id_gdo: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  stato: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: STATO_LAVORO.IN_CORSO,
    validate: { isIn: [Object.values(STATO_LAVORO)] },
  },
  avanzamento: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  attesa: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  richiesta_decisione: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  decisione: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  annullamento_richiesto: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  risultato: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  errore: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  heartbeat_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  concluso_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'lavori_in_background',
  freezeTableName: true,
  timestamps: true,
  createdAt: 'createdat',
  updatedAt: 'updatedat',
  indexes: [
    // Il controllo "un solo lavoro attivo per tipo e chiave" e la lettura dell'ultimo per ordine
    { name: 'idx_lavori_in_background_tipo_chiave_stato', fields: ['tipo', 'chiave', 'stato'] },
    // L'ultimo lavoro dell'utente, per ritrovarlo dopo aver ricaricato la pagina
    { name: 'idx_lavori_in_background_tipo_utente', fields: ['tipo', 'id_utente', 'createdat'] },
  ],
});

export { LavoroInBackgroundDefine as LavoroInBackground };
