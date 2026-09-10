import { DataTypes, Model, Optional, fn } from 'sequelize';
import { sequelize } from '../../db/SequelizeConnector';

export interface EphemeralChallengeAttributes {
    id_ephemeral_challenge?: string;
    challenge_id_ephemeral_challenge: string;
    nonce_ephemeral_challenge: string;
    origin_ephemeral_challenge: string;
    signature_ephemeral_challenge: string;
    ts_ephemeral_challenge: number;
    ip_address_ephemeral_challenge: string;
    user_agent_ephemeral_challenge: string;
    fp_version_ephemeral_challenge: string;
    used_ephemeral_challenge: boolean;
    createdat?: Date;
    updatedat?: Date;
    expires_at_ephemeral_challenge: Date;
}

export type EphemeralChallengeCreationAttributes = Optional<
    EphemeralChallengeAttributes,
    | 'id_ephemeral_challenge'
    | 'used_ephemeral_challenge'
    | 'createdat'
    | 'updatedat'
>;

class EphemeralChallengeClass
    extends Model<EphemeralChallengeAttributes, EphemeralChallengeCreationAttributes>
    implements EphemeralChallengeAttributes {
    declare id_ephemeral_challenge?: string;
    declare challenge_id_ephemeral_challenge: string;
    declare nonce_ephemeral_challenge: string;
    declare origin_ephemeral_challenge: string;
    declare signature_ephemeral_challenge: string;
    declare ts_ephemeral_challenge: number;
    declare ip_address_ephemeral_challenge: string;
    declare user_agent_ephemeral_challenge: string;
    declare fp_version_ephemeral_challenge: string;
    declare used_ephemeral_challenge: boolean;
    declare createdat?: Date;
    declare updatedat?: Date;
    declare expires_at_ephemeral_challenge: Date;
}

const EphemeralChallenge = EphemeralChallengeClass.init(
    {
        id_ephemeral_challenge: {
            type: DataTypes.UUID,
            defaultValue: fn('uuid_generate_v4'),
            primaryKey: true,
            field: 'id_ephemeral_challenge'
        },
        challenge_id_ephemeral_challenge: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'challenge_id_ephemeral_challenge',
            comment: 'UUID v4 univoco del challenge'
        },
        nonce_ephemeral_challenge: {
            type: DataTypes.STRING(64),
            allowNull: false,
            field: 'nonce_ephemeral_challenge',
            comment: 'Random 32 bytes in formato hex'
        },
        origin_ephemeral_challenge: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'origin_ephemeral_challenge',
            comment: 'Origine richiedente (es: https://example.com)'
        },
        signature_ephemeral_challenge: {
            type: DataTypes.STRING(64),
            allowNull: false,
            field: 'signature_ephemeral_challenge',
            comment: 'HMAC-SHA256 firma del challenge (hex)'
        },
        ts_ephemeral_challenge: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'ts_ephemeral_challenge',
            comment: 'Timestamp Unix millisecondi'
        },
        ip_address_ephemeral_challenge: {
            type: DataTypes.STRING(45),
            allowNull: false,
            field: 'ip_address_ephemeral_challenge',
            comment: 'IP richiedente (supporto IPv6)'
        },
        user_agent_ephemeral_challenge: {
            type: DataTypes.TEXT,
            allowNull: false,
            field: 'user_agent_ephemeral_challenge',
            comment: 'User-Agent browser'
        },
        fp_version_ephemeral_challenge: {
            type: DataTypes.STRING(20),
            allowNull: false,
            field: 'fp_version_ephemeral_challenge',
            comment: 'Versione plugin FP (es: 1.0.0)'
        },
        used_ephemeral_challenge: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            field: 'used_ephemeral_challenge',
            comment: 'Flag se challenge è stato completato'
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
        },
        expires_at_ephemeral_challenge: {
            type: DataTypes.DATE,
            allowNull: false,
            field: 'expires_at_ephemeral_challenge',
            comment: 'TTL 30 secondi per cleanup automatico'
        }
    },
    {
        sequelize,
        tableName: 'ephemeral_challenges',
        modelName: 'EphemeralChallenge',
        timestamps: false,
        underscored: true,
        indexes: [
            {
                name: 'ephemeral_challenge_id_uq',
                unique: true,
                fields: ['challenge_id_ephemeral_challenge'],
            },
            {
                name: 'idx_ephemeral_challenge_origin',
                fields: ['origin_ephemeral_challenge'],
                using: 'BTREE'
            },
            {
                name: 'idx_ephemeral_challenge_ip',
                fields: ['ip_address_ephemeral_challenge'],
                using: 'BTREE'
            },
            {
                name: 'idx_ephemeral_challenge_expires',
                fields: ['expires_at_ephemeral_challenge'],
                using: 'BTREE'
            },
            {
                name: 'idx_ephemeral_challenge_used',
                fields: ['used_ephemeral_challenge'],
                using: 'BTREE'
            }
        ]
    }
);

export { EphemeralChallenge };
