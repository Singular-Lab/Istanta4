import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Tracciati dell'archivio storico salvati in FP e non ancora accettati da Istanta
 * (POST /api/tracciati/archivio). L'allineamento (services/AllineamentoIstanta.ts) li invia uno
 * alla volta a nome di chi li ha caricati; la riga se ne va quando Istanta li accetta. Ci finisce
 * anche il tracciato del flusso normale (uploadTracciato) che Istanta non ha accettato. Una riga
 * con prossimo_tentativo nel futuro e' in pausa dopo un errore; con inviando_dal recente qualcuno
 * la sta inviando (il giro o "Rimanda a Istanta").
 */

export interface TracciatiInvioIstantaAttributes {
  id_tracciato: string;
  /** Chi ha caricato la lista: il passaporto verso Istanta e' il suo. */
  id_utente: string;
  tentativi: number;
  ultimo_errore: string | null;
  prossimo_tentativo: Date;
  /** Invio in corso da quando; null se nessuno la sta inviando. */
  inviando_dal: Date | null;
  creato_il: Date;
}

type TracciatiInvioIstantaCreationAttributes = Optional<TracciatiInvioIstantaAttributes, 'tentativi' | 'ultimo_errore' | 'prossimo_tentativo' | 'inviando_dal' | 'creato_il'>;

class TracciatiInvioIstanta extends Model<TracciatiInvioIstantaAttributes, TracciatiInvioIstantaCreationAttributes> implements TracciatiInvioIstantaAttributes {
  declare id_tracciato: string;
  declare id_utente: string;
  declare tentativi: number;
  declare ultimo_errore: string | null;
  declare prossimo_tentativo: Date;
  declare inviando_dal: Date | null;
  declare creato_il: Date;
}

const TracciatiInvioIstantaDefine = sequelize.define<TracciatiInvioIstanta>('tracciati_invio_istanta', {
  // Eliminato il tracciato non c'e' piu' nulla da inviare
  id_tracciato: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false,
    references: { model: 'tracciati', key: 'id_tracciati' },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
  id_utente: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tentativi: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  ultimo_errore: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  prossimo_tentativo: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  inviando_dal: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  creato_il: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'tracciati_invio_istanta',
  freezeTableName: true,
  timestamps: false,
  // Il prossimo da inviare
  indexes: [{ name: 'tracciati_invio_istanta_prossimo_tentativo', fields: ['prossimo_tentativo'] }],
});

export { TracciatiInvioIstantaDefine as TracciatiInvioIstanta };
