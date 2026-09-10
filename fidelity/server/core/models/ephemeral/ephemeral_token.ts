import { DataTypes, Model, Optional, fn } from 'sequelize';
import { sequelize } from '../../db/SequelizeConnector';

export interface EphemeralTokenAttributes {
    id_ephemeral_token?: string;
    jti_ephemeral_token: string;
    token_ephemeral_token: string;
    challenge_id_ephemeral_token: string;
    origin_ephemeral_token: string;
    browser_hash_ephemeral_token: string;
    scope_ephemeral_token: string;
    ip_address_ephemeral_token: string;
    user_agent_ephemeral_token: string;
    fp_version_ephemeral_token: string;
    issued_at_ephemeral_token: number;
    expires_at_utc_ephemeral_token: number;
    revoked_ephemeral_token: boolean;
    last_used_at_ephemeral_token: Date | null;
    use_count_ephemeral_token: number;
    createdat?: Date;
    updatedat?: Date;
}

export type EphemeralTokenCreationAttributes = Optional<
    EphemeralTokenAttributes,
    | 'id_ephemeral_token'
    | 'revoked_ephemeral_token'
    | 'last_used_at_ephemeral_token'
    | 'use_count_ephemeral_token'
    | 'createdat'
    | 'updatedat'
>;

class EphemeralTokenClass
    extends Model<EphemeralTokenAttributes, EphemeralTokenCreationAttributes>
    implements EphemeralTokenAttributes {
    declare id_ephemeral_token?: string;
    declare jti_ephemeral_token: string;
    declare token_ephemeral_token: string;
    declare challenge_id_ephemeral_token: string;
    declare origin_ephemeral_token: string;
    declare browser_hash_ephemeral_token: string;
    declare scope_ephemeral_token: string;
    declare ip_address_ephemeral_token: string;
    declare user_agent_ephemeral_token: string;
    declare fp_version_ephemeral_token: string;
    declare issued_at_ephemeral_token: number;
    declare expires_at_utc_ephemeral_token: number;
    declare revoked_ephemeral_token: boolean;
    declare last_used_at_ephemeral_token: Date | null;
    declare use_count_ephemeral_token: number;
    declare createdat?: Date;
    declare updatedat?: Date;
}

const EphemeralToken = EphemeralTokenClass.init(
    {
        id_ephemeral_token: {
            type: DataTypes.UUID,
            defaultValue: fn('uuid_generate_v4'),
            primaryKey: true,
            field: 'id_ephemeral_token'
        },
        jti_ephemeral_token: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'jti_ephemeral_token',
            comment: 'JWT ID univoco per prevenzione replay attacks'
        },
        token_ephemeral_token: {
            type: DataTypes.TEXT,
            allowNull: false,
            field: 'token_ephemeral_token',
            comment: 'Token firmato HMAC-SHA256'
        },
        challenge_id_ephemeral_token: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'challenge_id_ephemeral_token',
            comment: 'Riferimento al challenge che ha generato questo token'
        },
        origin_ephemeral_token: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'origin_ephemeral_token',
            comment: 'Origine vincolata per questo token'
        },
        browser_hash_ephemeral_token: {
            type: DataTypes.STRING(64),
            allowNull: false,
            field: 'browser_hash_ephemeral_token',
            comment: 'SHA-256 fingerprint browser (base64)'
        },
        scope_ephemeral_token: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: 'promo:read,refs:read',
            field: 'scope_ephemeral_token',
            comment: 'Scope permessi separati da virgola'
        },
        ip_address_ephemeral_token: {
            type: DataTypes.STRING(45),
            allowNull: false,
            field: 'ip_address_ephemeral_token',
            comment: 'IP emissione token (supporto IPv6)'
        },
        user_agent_ephemeral_token: {
            type: DataTypes.TEXT,
            allowNull: false,
            field: 'user_agent_ephemeral_token',
            comment: 'User-Agent browser al momento emissione'
        },
        fp_version_ephemeral_token: {
            type: DataTypes.STRING(20),
            allowNull: false,
            field: 'fp_version_ephemeral_token',
            comment: 'Versione plugin FP (es: 1.0.0)'
        },
        issued_at_ephemeral_token: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'issued_at_ephemeral_token',
            comment: 'Timestamp emissione Unix millisecondi'
        },
        expires_at_utc_ephemeral_token: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'expires_at_utc_ephemeral_token',
            comment: 'Timestamp scadenza Unix millisecondi (TTL 5 minuti)'
        },
        revoked_ephemeral_token: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            field: 'revoked_ephemeral_token',
            comment: 'Flag revoca manuale'
        },
        last_used_at_ephemeral_token: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'last_used_at_ephemeral_token',
            comment: 'Timestamp ultimo utilizzo token'
        },
        use_count_ephemeral_token: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: 'use_count_ephemeral_token',
            comment: 'Contatore utilizzi token'
        },
        createdat: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: fn('NOW'),
            field: 'createdat'
        },
        updatedat: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: fn('NOW'),
            field: 'updatedat'
        }
    },
    {
        sequelize,
        tableName: 'ephemeral_tokens',
        modelName: 'EphemeralToken',
        timestamps: false,
        underscored: true,
        indexes: [
            {
                name: 'ephemeral_token_jti_uq',
                unique: true,
                fields: ['jti_ephemeral_token'],
            },
            {
                name: 'idx_ephemeral_token_challenge_id',
                fields: ['challenge_id_ephemeral_token'],
                using: 'BTREE'
            },
            {
                name: 'idx_ephemeral_token_origin',
                fields: ['origin_ephemeral_token'],
                using: 'BTREE'
            },
            {
                name: 'idx_ephemeral_token_expires',
                fields: ['expires_at_utc_ephemeral_token'],
                using: 'BTREE'
            },
            {
                name: 'idx_ephemeral_token_revoked',
                fields: ['revoked_ephemeral_token'],
                using: 'BTREE'
            },
            {
                name: 'idx_ephemeral_token_browser_hash',
                fields: ['browser_hash_ephemeral_token'],
                using: 'BTREE'
            },
            {
                name: 'idx_ephemeral_token_ip',
                fields: ['ip_address_ephemeral_token'],
                using: 'BTREE'
            }
        ]
    }
);

export { EphemeralToken };
