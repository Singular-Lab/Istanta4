// src/db/models/WhatsappQueueJob.ts

import { DataTypes, Model, Optional, fn } from 'sequelize';
import { sequelize } from '../../db/SequelizeConnector';

import { GDOWhatsappQueueJobStatus } from '../../../../lib/enums';
import type { GDOWhatsappQueueJobAttributes } from '../../../../lib/types';


export type GDOWhatsappQueueJobCreationAttributes = Optional<
    GDOWhatsappQueueJobAttributes,
    | 'id_whatsapp_queue_job'
    | 'campagna_id_whatsapp_queue_job'
    | 'attempts_whatsapp_queue_job'
    | 'max_attempts_whatsapp_queue_job'
    | 'status_whatsapp_queue_job'
    | 'run_at_whatsapp_queue_job'
    | 'last_error_whatsapp_queue_job'
    | 'createdat'
    | 'updatedat'
>;

class GDOWhatsappQueueJobClass extends Model<
    GDOWhatsappQueueJobCreationAttributes,
    GDOWhatsappQueueJobAttributes
> implements GDOWhatsappQueueJobAttributes {
    declare id_whatsapp_queue_job: string;
    declare bulk_id_whatsapp_queue_job: string;
    declare campagna_id_whatsapp_queue_job: string;
    declare index_whatsapp_queue_job: number;
    declare total_whatsapp_queue_job: number;

    declare to_whatsapp_queue_job: string;
    declare body_whatsapp_queue_job: string;

    declare attempts_whatsapp_queue_job: number;
    declare max_attempts_whatsapp_queue_job: number;

    declare status_whatsapp_queue_job: GDOWhatsappQueueJobStatus;

    declare run_at_whatsapp_queue_job: Date;
    declare last_error_whatsapp_queue_job: string | null;

    declare createdat?: Date;
    declare updatedat?: Date;
}

const GDOWhatsappQueueJob = GDOWhatsappQueueJobClass.init(
    {
        id_whatsapp_queue_job: {
            type: DataTypes.UUID,
            defaultValue: fn('uuid_generate_v4'),
            primaryKey: true,
        },

        bulk_id_whatsapp_queue_job: {
            type: DataTypes.UUID,
            allowNull: false,
        },

        campagna_id_whatsapp_queue_job: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'gdo_whatsapp_campagne',
                key: 'id_whatsapp_campagna',
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        },

        index_whatsapp_queue_job: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },

        total_whatsapp_queue_job: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },

        to_whatsapp_queue_job: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        body_whatsapp_queue_job: {
            type: DataTypes.JSONB,
            allowNull: false,
        },

        attempts_whatsapp_queue_job: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },

        max_attempts_whatsapp_queue_job: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 5,
        },

        status_whatsapp_queue_job: {
            type: DataTypes.ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'),
            allowNull: false,
            defaultValue: 'PENDING',
        },

        run_at_whatsapp_queue_job: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },

        last_error_whatsapp_queue_job: {
            type: DataTypes.TEXT,
            allowNull: true,
        },

        createdat: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: fn('NOW'),
        },

        updatedat: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: fn('NOW'),
        },
    },
    {
        sequelize,
        tableName: 'gdo_whatsapp_message_queue',
        modelName: 'GDOWhatsappMessageQueue',
        timestamps: false,

        indexes: [
            {
                name: 'idx_wa_queue_status_runat',
                fields: ['status_whatsapp_queue_job', 'run_at_whatsapp_queue_job'],
                using: 'BTREE',
            },
            {
                name: 'idx_wa_queue_bulk',
                fields: ['bulk_id_whatsapp_queue_job'],
                using: 'BTREE',
            },
            {
                name: 'idx_wa_queue_campagna',
                fields: ['campagna_id_whatsapp_queue_job'],
                using: 'BTREE',
            },
            {
                name: 'idx_wa_queue_runat',
                fields: ['run_at_whatsapp_queue_job'],
                using: 'BTREE',
            },
            {
                name: 'idx_wa_queue_status',
                fields: ['status_whatsapp_queue_job'],
                using: 'BTREE',
            },
        ],
    }
);

export { GDOWhatsappQueueJob };
