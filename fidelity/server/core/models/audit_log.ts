import { DataTypes, Model, Optional, fn } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

export interface AuditLogAttributes {
    id_audit_log?: string;
    event_type: string;
    severity: string;
    user_id: string | null;
    user_type: string | null;
    session_id: string | null;
    ip_address: string;
    user_agent: string | null;
    resource: string | null;
    action: string | null;
    result: string;
    details: object | null;
    request_id: string | null;
    target_entity_id: string | null;
    target_entity_type: string | null;
    createdat?: Date;
}

export type AuditLogCreationAttributes = Optional<
    AuditLogAttributes,
    | 'id_audit_log'
    | 'user_id'
    | 'user_type'
    | 'session_id'
    | 'user_agent'
    | 'resource'
    | 'action'
    | 'details'
    | 'request_id'
    | 'target_entity_id'
    | 'target_entity_type'
    | 'createdat'
>;

class AuditLogClass
    extends Model<AuditLogAttributes, AuditLogCreationAttributes>
    implements AuditLogAttributes {
    declare id_audit_log?: string;
    declare event_type: string;
    declare severity: string;
    declare user_id: string | null;
    declare user_type: string | null;
    declare session_id: string | null;
    declare ip_address: string;
    declare user_agent: string | null;
    declare resource: string | null;
    declare action: string | null;
    declare result: string;
    declare details: object | null;
    declare request_id: string | null;
    declare target_entity_id: string | null;
    declare target_entity_type: string | null;
    declare createdat?: Date;
}

const AuditLog = AuditLogClass.init(
    {
        id_audit_log: {
            type: DataTypes.UUID,
            defaultValue: fn('uuid_generate_v4'),
            primaryKey: true,
            field: 'id_audit_log'
        },
        event_type: {
            type: DataTypes.STRING(80),
            allowNull: false,
            field: 'event_type',
            comment: 'Tipo di evento audit (AuditEventType)'
        },
        severity: {
            type: DataTypes.STRING(10),
            allowNull: false,
            field: 'severity',
            comment: 'Severità: LOW, MEDIUM, HIGH, CRITICAL'
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'user_id',
            comment: 'ID utente che ha generato l\'evento'
        },
        user_type: {
            type: DataTypes.STRING(30),
            allowNull: true,
            field: 'user_type',
            comment: 'Tipo utente (TIPO_UTENTI)'
        },
        session_id: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'session_id',
            comment: 'ID sessione'
        },
        ip_address: {
            type: DataTypes.STRING(45),
            allowNull: false,
            field: 'ip_address',
            comment: 'IP richiedente (supporto IPv6)'
        },
        user_agent: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'user_agent',
            comment: 'User-Agent browser'
        },
        resource: {
            type: DataTypes.STRING(120),
            allowNull: true,
            field: 'resource',
            comment: 'Risorsa coinvolta (es. promo, user, webhook)'
        },
        action: {
            type: DataTypes.STRING(80),
            allowNull: true,
            field: 'action',
            comment: 'Azione eseguita (es. create, update, delete)'
        },
        result: {
            type: DataTypes.STRING(10),
            allowNull: false,
            defaultValue: 'SUCCESS',
            field: 'result',
            comment: 'Risultato: SUCCESS, FAILURE, PARTIAL'
        },
        details: {
            type: DataTypes.JSONB,
            allowNull: true,
            field: 'details',
            comment: 'Dati aggiuntivi in formato JSON'
        },
        request_id: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'request_id',
            comment: 'X-Request-ID header'
        },
        target_entity_id: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'target_entity_id',
            comment: 'ID dell\'entità target dell\'operazione'
        },
        target_entity_type: {
            type: DataTypes.STRING(80),
            allowNull: true,
            field: 'target_entity_type',
            comment: 'Tipo dell\'entità target (es. Promo, Utente)'
        },
        createdat: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: fn('NOW'),
            field: 'createdat'
        }
    },
    {
        sequelize,
        tableName: 'audit_log',
        modelName: 'AuditLog',
        timestamps: false,
        underscored: true,
        indexes: [
            {
                name: 'idx_audit_log_event_type',
                fields: ['event_type'],
                using: 'BTREE'
            },
            {
                name: 'idx_audit_log_severity',
                fields: ['severity'],
                using: 'BTREE'
            },
            {
                name: 'idx_audit_log_user_id',
                fields: ['user_id'],
                using: 'BTREE'
            },
            {
                name: 'idx_audit_log_createdat',
                fields: ['createdat'],
                using: 'BTREE'
            },
            {
                name: 'idx_audit_log_result',
                fields: ['result'],
                using: 'BTREE'
            },
            {
                name: 'idx_audit_log_target_entity',
                fields: ['target_entity_type', 'target_entity_id'],
                using: 'BTREE'
            },
            {
                name: 'idx_audit_log_sev_date',
                fields: [{ name: 'severity', order: 'ASC' } as any, { name: 'createdat', order: 'DESC' } as any],
                using: 'BTREE'
            }
        ]
    }
);

export type AuditLogInstance = AuditLogClass;

export { AuditLog };
