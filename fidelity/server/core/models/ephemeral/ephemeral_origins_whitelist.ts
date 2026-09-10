import { DataTypes, Model, Optional, fn } from 'sequelize';
import { sequelize } from '../../db/SequelizeConnector';

export interface EphemeralOriginsWhitelistAttributes {
    id_ephemeral_origins_whitelist?: string;
    origin_ephemeral_origins_whitelist: string;
    description_ephemeral_origins_whitelist: string | null;
    active_ephemeral_origins_whitelist: boolean;
    rate_limit_per_minute_ephemeral_origins_whitelist: number;
    allowed_scopes_ephemeral_origins_whitelist: string;
    created_by_ephemeral_origins_whitelist: string | null;
    createdat?: Date;
    updatedat?: Date;
}

export type EphemeralOriginsWhitelistCreationAttributes = Optional<
    EphemeralOriginsWhitelistAttributes,
    | 'id_ephemeral_origins_whitelist'
    | 'description_ephemeral_origins_whitelist'
    | 'active_ephemeral_origins_whitelist'
    | 'rate_limit_per_minute_ephemeral_origins_whitelist'
    | 'allowed_scopes_ephemeral_origins_whitelist'
    | 'created_by_ephemeral_origins_whitelist'
    | 'createdat'
    | 'updatedat'
>;

class EphemeralOriginsWhitelistClass
    extends Model<EphemeralOriginsWhitelistAttributes, EphemeralOriginsWhitelistCreationAttributes>
    implements EphemeralOriginsWhitelistAttributes {
    declare id_ephemeral_origins_whitelist?: string;
    declare origin_ephemeral_origins_whitelist: string;
    declare description_ephemeral_origins_whitelist: string | null;
    declare active_ephemeral_origins_whitelist: boolean;
    declare rate_limit_per_minute_ephemeral_origins_whitelist: number;
    declare allowed_scopes_ephemeral_origins_whitelist: string;
    declare created_by_ephemeral_origins_whitelist: string | null;
    declare createdat?: Date;
    declare updatedat?: Date;
}

const EphemeralOriginsWhitelist = EphemeralOriginsWhitelistClass.init(
    {
        id_ephemeral_origins_whitelist: {
            type: DataTypes.UUID,
            defaultValue: fn('uuid_generate_v4'),
            primaryKey: true,
            field: 'id_ephemeral_origins_whitelist'
        },
        origin_ephemeral_origins_whitelist: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'origin_ephemeral_origins_whitelist',
            comment: 'Origine permessa (es: https://example.com) - deve includere protocollo e porta se diversa da default'
        },
        description_ephemeral_origins_whitelist: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'description_ephemeral_origins_whitelist',
            comment: 'Descrizione dominio (es: "Sito Cliente XYZ")'
        },
        active_ephemeral_origins_whitelist: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            field: 'active_ephemeral_origins_whitelist',
            comment: 'Flag attivo/disattivo - se false, origin viene bloccato'
        },
        rate_limit_per_minute_ephemeral_origins_whitelist: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 50,
            field: 'rate_limit_per_minute_ephemeral_origins_whitelist',
            comment: 'Rate limit personalizzato per questo origin (challenge/min)'
        },
        allowed_scopes_ephemeral_origins_whitelist: {
            type: DataTypes.STRING(500),
            allowNull: false,
            defaultValue: 'promo:read,refs:read',
            field: 'allowed_scopes_ephemeral_origins_whitelist',
            comment: 'Scope permessi per questo origin (separati da virgola)'
        },
        created_by_ephemeral_origins_whitelist: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'created_by_ephemeral_origins_whitelist',
            comment: 'ID utente che ha creato questa entry (FK verso users.id)'
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
        tableName: 'ephemeral_origins_whitelist',
        modelName: 'EphemeralOriginsWhitelist',
        timestamps: false,
        underscored: true,
        indexes: [
            {
                name: 'ephemeral_origins_origin_uq',
                unique: true,
                fields: ['origin_ephemeral_origins_whitelist'],
            },
            {
                name: 'idx_ephemeral_origins_whitelist_active',
                fields: ['active_ephemeral_origins_whitelist'],
                using: 'BTREE'
            },
            {
                name: 'idx_ephemeral_origins_whitelist_created_by',
                fields: ['created_by_ephemeral_origins_whitelist'],
                using: 'BTREE'
            }
        ]
    }
);

export { EphemeralOriginsWhitelist };
