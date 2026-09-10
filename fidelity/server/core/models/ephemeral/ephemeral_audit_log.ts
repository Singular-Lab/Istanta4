import { DataTypes, Model, Optional, fn } from 'sequelize';
import { sequelize } from '../../db/SequelizeConnector';

export type EphemeralAuditEventType =
    | 'CHALLENGE_START'
    | 'CHALLENGE_COMPLETE'
    | 'CHALLENGE_FAILED'
    | 'CHALLENGE_EXPIRED'
    | 'TOKEN_ISSUED'
    | 'TOKEN_VALIDATED'
    | 'TOKEN_VALIDATION_FAILED'
    | 'TOKEN_EXPIRED'
    | 'TOKEN_REVOKED'
    | 'ORIGIN_BLOCKED'
    | 'RATE_LIMIT_EXCEEDED'
    | 'FINGERPRINT_MISMATCH'
    | 'VERSION_MISMATCH'
    | 'REPLAY_ATTACK_DETECTED';

export interface EphemeralAuditLogAttributes {
    id_ephemeral_audit_log?: string;
    event_type_ephemeral_audit_log: EphemeralAuditEventType;
    challenge_id_ephemeral_audit_log: string | null;
    jti_ephemeral_audit_log: string | null;
    origin_ephemeral_audit_log: string;
    ip_address_ephemeral_audit_log: string;
    user_agent_ephemeral_audit_log: string;
    fp_version_ephemeral_audit_log: string | null;
    success_ephemeral_audit_log: boolean;
    error_message_ephemeral_audit_log: string | null;
    metadata_ephemeral_audit_log: object | null;
    createdat?: Date;
}

export type EphemeralAuditLogCreationAttributes = Optional<
    EphemeralAuditLogAttributes,
    | 'id_ephemeral_audit_log'
    | 'challenge_id_ephemeral_audit_log'
    | 'jti_ephemeral_audit_log'
    | 'fp_version_ephemeral_audit_log'
    | 'error_message_ephemeral_audit_log'
    | 'metadata_ephemeral_audit_log'
    | 'createdat'
>;

class EphemeralAuditLogClass
    extends Model<EphemeralAuditLogAttributes, EphemeralAuditLogCreationAttributes>
    implements EphemeralAuditLogAttributes {
    declare id_ephemeral_audit_log?: string;
    declare event_type_ephemeral_audit_log: EphemeralAuditEventType;
    declare challenge_id_ephemeral_audit_log: string | null;
    declare jti_ephemeral_audit_log: string | null;
    declare origin_ephemeral_audit_log: string;
    declare ip_address_ephemeral_audit_log: string;
    declare user_agent_ephemeral_audit_log: string;
    declare fp_version_ephemeral_audit_log: string | null;
    declare success_ephemeral_audit_log: boolean;
    declare error_message_ephemeral_audit_log: string | null;
    declare metadata_ephemeral_audit_log: object | null;
    declare createdat?: Date;
}

const EphemeralAuditLog = EphemeralAuditLogClass.init(
    {
        id_ephemeral_audit_log: {
            type: DataTypes.UUID,
            defaultValue: fn('uuid_generate_v4'),
            primaryKey: true,
            field: 'id_ephemeral_audit_log'
        },
        event_type_ephemeral_audit_log: {
            type: DataTypes.STRING(50),
            allowNull: false,
            field: 'event_type_ephemeral_audit_log',
            comment: 'Tipo evento tracciato'
        },
        challenge_id_ephemeral_audit_log: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'challenge_id_ephemeral_audit_log',
            comment: 'Riferimento al challenge (se applicabile)'
        },
        jti_ephemeral_audit_log: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'jti_ephemeral_audit_log',
            comment: 'Riferimento al token JTI (se applicabile)'
        },
        origin_ephemeral_audit_log: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'origin_ephemeral_audit_log',
            comment: 'Origine richiedente'
        },
        ip_address_ephemeral_audit_log: {
            type: DataTypes.STRING(45),
            allowNull: false,
            field: 'ip_address_ephemeral_audit_log',
            comment: 'IP richiedente (supporto IPv6)'
        },
        user_agent_ephemeral_audit_log: {
            type: DataTypes.TEXT,
            allowNull: false,
            field: 'user_agent_ephemeral_audit_log',
            comment: 'User-Agent browser'
        },
        fp_version_ephemeral_audit_log: {
            type: DataTypes.STRING(20),
            allowNull: true,
            field: 'fp_version_ephemeral_audit_log',
            comment: 'Versione plugin FP (es: 1.0.0)'
        },
        success_ephemeral_audit_log: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            field: 'success_ephemeral_audit_log',
            comment: 'Flag successo/fallimento operazione'
        },
        error_message_ephemeral_audit_log: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'error_message_ephemeral_audit_log',
            comment: 'Messaggio errore se fallito'
        },
        metadata_ephemeral_audit_log: {
            type: DataTypes.JSONB,
            allowNull: true,
            field: 'metadata_ephemeral_audit_log',
            comment: 'Dati aggiuntivi in formato JSON'
        },
        createdat: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: fn('NOW'),
            field: 'createdat'
        }
    },
    {
        sequelize,
        tableName: 'ephemeral_audit_log',
        modelName: 'EphemeralAuditLog',
        timestamps: false,
        underscored: true,
        indexes: [
            {
                name: 'idx_ephemeral_audit_log_event_type',
                fields: ['event_type_ephemeral_audit_log'],
                using: 'BTREE'
            },
            {
                name: 'idx_ephemeral_audit_log_challenge_id',
                fields: ['challenge_id_ephemeral_audit_log'],
                using: 'BTREE'
            },
            {
                name: 'idx_ephemeral_audit_log_jti',
                fields: ['jti_ephemeral_audit_log'],
                using: 'BTREE'
            },
            {
                name: 'idx_ephemeral_audit_log_origin',
                fields: ['origin_ephemeral_audit_log'],
                using: 'BTREE'
            },
            {
                name: 'idx_ephemeral_audit_log_ip',
                fields: ['ip_address_ephemeral_audit_log'],
                using: 'BTREE'
            },
            {
                name: 'idx_ephemeral_audit_log_success',
                fields: ['success_ephemeral_audit_log'],
                using: 'BTREE'
            },
            {
                name: 'idx_ephemeral_audit_log_createdat',
                fields: ['createdat'],
                using: 'BTREE'
            }
        ]
    }
);

export { EphemeralAuditLog };
