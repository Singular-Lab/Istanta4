import crypto from "crypto";
import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../db/SequelizeConnector";

/* ======================================================
 * ATTRIBUTES
 * ====================================================== */
export interface DispositivoMetadata {
    /** Informazioni sul browser */
    browser?: {
        name?: string;          // es: Chrome, WebOS Browser
        version?: string;       // es: 120.0.6099
        engine?: string;        // es: Blink, WebKit
        userAgent?: string;
    };

    /** Sistema operativo / piattaforma */
    os?: {
        name?: string;          // es: WebOS, Android TV, Linux
        version?: string;
        platform?: string;      // es: armv7l, aarch64
    };

    /** Informazioni sul display */
    screen?: {
        width?: number;         // px
        height?: number;        // px
        devicePixelRatio?: number;
        orientation?: "landscape" | "portrait";
        refreshRateHz?: number;
    };

    /** Capacità del dispositivo */
    capabilities?: {
        touch?: boolean;
        keyboard?: boolean;
        mouse?: boolean;
        audio?: boolean;
        video?: boolean;
        pdfInline?: boolean;    // supporto iframe/pdf nativo
    };

    /** Rete (best effort, non affidabile al 100%) */
    network?: {
        effectiveType?: "slow-2g" | "2g" | "3g" | "4g" | "5g";
        downlinkMbps?: number;
        rttMs?: number;
    };

    /** Info runtime pagina */
    runtime?: {
        timezone?: string;      // es: Europe/Rome
        locale?: string;        // es: it-IT
        language?: string;      // es: it
    };

    /** Campi liberi per estensioni future */
    extra?: Record<string, unknown>;
}

export interface DispositivoPuntoVenditaAttributes {
    id_dispositivo: string;
    id_puntivendita: string;

    nome_dispositivo: string;
    descrizione_dispositivo?: string;

    secret_dispositivo: string;

    /** Token opaco per URL display: /display/files?t=<token> */
    token_display_dispositivo: string;

    /** FK al display context assegnato */
    id_display_context_dispositivo?: string;

    is_active_dispositivo: boolean;
    last_seen_at_dispositivo?: Date;
    metadata_dispositivo?: DispositivoMetadata;

    createdat?: Date;
    updatedat?: Date;
}

type DispositivoPuntoVenditaCreationAttributes = Optional<
    DispositivoPuntoVenditaAttributes,
    | "id_dispositivo"
    | "descrizione_dispositivo"
    | "token_display_dispositivo"
    | "id_display_context_dispositivo"
    | "last_seen_at_dispositivo"
    | "metadata_dispositivo"
    | "createdat"
    | "updatedat"
>;

/* ======================================================
 * MODEL
 * ====================================================== */

class DispositivoPuntoVendita
    extends Model<
        DispositivoPuntoVenditaAttributes,
        DispositivoPuntoVenditaCreationAttributes
    >
    implements DispositivoPuntoVenditaAttributes {
    declare id_dispositivo: string;
    declare id_puntivendita: string;

    declare nome_dispositivo: string;
    declare descrizione_dispositivo?: string;

    declare secret_dispositivo: string;
    declare token_display_dispositivo: string;
    declare id_display_context_dispositivo?: string;

    declare is_active_dispositivo: boolean;
    declare last_seen_at_dispositivo?: Date;

    declare metadata_dispositivo?: DispositivoMetadata;

    declare createdat?: Date;
    declare updatedat?: Date;

    /* ===============================
     * STATIC METHODS
     * =============================== */

    /** Genera un token opaco sicuro (64 caratteri hex, 256 bit di entropia) */
    public static generateDisplayToken(): string {
        return crypto.randomBytes(32).toString("hex");
    }

    /* ===============================
     * INSTANCE METHODS
     * =============================== */

    public isOnline(thresholdMinutes: number = 5): boolean {
        if (!this.last_seen_at_dispositivo) return false;
        const diff =
            Date.now() - new Date(this.last_seen_at_dispositivo).getTime();
        return diff <= thresholdMinutes * 60 * 1000;
    }

    /** Rigenera il token display e salva */
    public async regenerateDisplayToken(): Promise<string> {
        this.token_display_dispositivo = DispositivoPuntoVendita.generateDisplayToken();
        await this.save({ fields: ["token_display_dispositivo"] });
        return this.token_display_dispositivo;
    }

    /** Costruisce l'URL display completo */
    public getDisplayUrl(baseUrl: string): string {
        return `${baseUrl}/display/files?t=${this.token_display_dispositivo}`;
    }
}

/* ======================================================
 * INIT
 * ====================================================== */

DispositivoPuntoVendita.init(
    {
        id_dispositivo: {
            type: DataTypes.UUID,
            defaultValue: sequelize.fn("uuid_generate_v4"),
            primaryKey: true,
            field: "id_dispositivo",
        },

        id_puntivendita: {
            type: DataTypes.UUID,
            allowNull: false,
            field: "id_puntivendita",
            references: {
                model: "punti_vendita",
                key: "id_puntivendita",
            },
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
        },

        nome_dispositivo: {
            type: DataTypes.STRING(150),
            allowNull: false,
            validate: {
                notEmpty: true,
                len: [2, 150],
            },
            field: "nome_dispositivo",
        },

        descrizione_dispositivo: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: "descrizione_dispositivo",
        },

        secret_dispositivo: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: "secret_dispositivo",
        },

        token_display_dispositivo: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: "token_display_dispositivo",
        },

        id_display_context_dispositivo: {
            type: DataTypes.UUID,
            allowNull: true,
            field: "id_display_context_dispositivo",
            references: {
                model: "display_context_punto_vendita",
                key: "id_display_context",
            },
            onDelete: "SET NULL",
            onUpdate: "CASCADE",
        },

        is_active_dispositivo: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            field: "is_active_dispositivo",
        },

        last_seen_at_dispositivo: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "last_seen_at_dispositivo",
        },

        metadata_dispositivo: {
            type: DataTypes.JSONB,
            allowNull: true,
            field: "metadata_dispositivo",
        },
    },
    {
        sequelize,
        tableName: "dispositivi_punto_vendita",
        timestamps: true,
        createdAt: "createdat",
        updatedAt: "updatedat",
        indexes: [
            {
                fields: ["id_puntivendita"],
            },
            {
                unique: true,
                fields: ["secret_dispositivo"],
            },
            {
                unique: true,
                fields: ["token_display_dispositivo"],
            },
            {
                fields: ["id_display_context_dispositivo"],
            },
            {
                fields: ["is_active_dispositivo"],
            },
            {
                fields: ["last_seen_at_dispositivo"],
            },
        ],
        hooks: {
            beforeValidate: (device: DispositivoPuntoVendita) => {
                if (device.nome_dispositivo) {
                    device.nome_dispositivo = device.nome_dispositivo.trim();
                }
                if (device.descrizione_dispositivo) {
                    device.descrizione_dispositivo =
                        device.descrizione_dispositivo.trim();
                }
                // Auto-genera token display se non fornito
                if (!device.token_display_dispositivo) {
                    device.token_display_dispositivo = DispositivoPuntoVendita.generateDisplayToken();
                }
            },
        },
    }
);

export { DispositivoPuntoVendita };
