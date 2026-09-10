import { Model, DataTypes, Op } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Mixin per aggiungere funzionalità di soft delete ai modelli
 */
export const SoftDeleteMixin = {
    deletedat: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'deletedat'
    },

    // Metodi di istanza
    softDelete: async function(this: any) {
        this.deletedat = new Date();
        return await this.save();
    },

    restore: async function(this: any) {
        this.deletedat = null;
        return await this.save();
    },

    isDeleted: function(this: any): boolean {
        return this.deletedat !== null;
    }
};

/**
 * Mixin per aggiungere funzionalità di audit trail
 */
export const AuditMixin = {
    createdby: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'createdby'
    },

    updatedby: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'updatedby'
    },

    // Metodi di istanza
    setCreatedBy: function(this: any, userId: string) {
        this.createdby = userId;
    },

    setUpdatedBy: function(this: any, userId: string) {
        this.updatedby = userId;
    }
};

/**
 * Mixin per aggiungere funzionalità di versioning
 */
export const VersioningMixin = {
    version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        field: 'version'
    },

    // Metodi di istanza
    incrementVersion: async function(this: any) {
        this.version += 1;
        return await this.save();
    },

    getVersion: function(this: any): number {
        return this.version;
    }
};

/**
 * Mixin per aggiungere funzionalità di ricerca full-text
 */
export const FullTextSearchMixin = {
    // Metodi statici per ricerca full-text
    searchByText: async function(this: any, searchTerm: string, fields: string[]) {
        const searchConditions = fields.map(field => ({
            [field]: {
                [Op.iLike]: `%${searchTerm}%`
            }
        }));

        return await this.findAll({
            where: {
                [Op.or]: searchConditions
            },
            order: [['createdat', 'DESC']]
        });
    },

    searchAdvanced: async function(this: any, options: {
        searchTerm?: string;
        fields?: string[];
        filters?: Record<string, any>;
        orderBy?: string;
        orderDirection?: 'ASC' | 'DESC';
        limit?: number;
        offset?: number;
    }) {
        const {
            searchTerm,
            fields = [],
            filters = {},
            orderBy = 'createdat',
            orderDirection = 'DESC',
            limit,
            offset
        } = options;

        const whereConditions: any = { ...filters };

        if (searchTerm && fields.length > 0) {
            const searchConditions = fields.map(field => ({
                [field]: {
                    [Op.iLike]: `%${searchTerm}%`
                }
            }));
            whereConditions[Op.or] = searchConditions;
        }

        const queryOptions: any = {
            where: whereConditions,
            order: [[orderBy, orderDirection]]
        };

        if (limit) queryOptions.limit = limit;
        if (offset) queryOptions.offset = offset;

        return await this.findAll(queryOptions);
    }
};

/**
 * Mixin per aggiungere funzionalità di cache
 */
export const CacheMixin = {
    // Metodi statici per gestione cache
    async findWithCache(this: any, key: string, queryFn: () => Promise<any>, ttl: number = 300) {
        // Implementazione base - può essere estesa con Redis o altri sistemi di cache
        const cacheKey = `${this.name}_${key}`;
        
        // Per ora restituisce direttamente il risultato della query
        // In un'implementazione reale, qui andrebbe la logica di cache
        return await queryFn();
    },

    async invalidateCache(this: any, pattern: string) {
        // Logica per invalidare la cache
        console.log(`Cache invalidata per pattern: ${pattern}`);
    }
};

/**
 * Mixin per aggiungere funzionalità di export/import
 */
export const ExportImportMixin = {
    // Metodi di istanza per export
    toJSON: function(this: any, options: { includePrivate?: boolean } = {}) {
        const data = this.get({ plain: true });
        
        if (!options.includePrivate) {
            // Rimuovi campi sensibili
            delete data.password;
            delete data.privateKey;
            delete data.secret;
        }
        
        return data;
    },

    toCSV: function(this: any, fields: string[]): string {
        const data = this.get({ plain: true });
        return fields.map(field => data[field] || '').join(',');
    },

    // Metodi statici per import
    bulkCreateFromCSV: async function(this: any, csvData: string[], fields: string[]) {
        const records = csvData.map(row => {
            const values = row.split(',');
            const record: any = {};
            fields.forEach((field, index) => {
                record[field] = values[index]?.trim();
            });
            return record;
        });

        return await this.bulkCreate(records, {
            validate: true,
            ignoreDuplicates: true
        });
    }
};

/**
 * Mixin per aggiungere funzionalità di validazione avanzata
 */
export const ValidationMixin = {
    // Metodi di istanza per validazione
    validateCustom: function(this: any, rules: Record<string, any>): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        for (const [field, rule] of Object.entries(rules)) {
            const value = this[field];
            
            if (rule.required && !value) {
                errors.push(`${field} è obbligatorio`);
            }
            
            if (rule.minLength && value && value.length < rule.minLength) {
                errors.push(`${field} deve avere almeno ${rule.minLength} caratteri`);
            }
            
            if (rule.maxLength && value && value.length > rule.maxLength) {
                errors.push(`${field} non può superare ${rule.maxLength} caratteri`);
            }
            
            if (rule.pattern && value && !rule.pattern.test(value)) {
                errors.push(`${field} non rispetta il formato richiesto`);
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    },

    // Metodi statici per validazione bulk
    validateBulk: function(this: any, records: any[], rules: Record<string, any>) {
        const results : any[] = [];
        
        for (const record of records) {
            const instance = (this as any).build(record);
            const validation = instance.validateCustom(rules);
            results.push({
                record,
                ...validation
            });
        }
        return results;
    }
};

/**
 * Mixin per aggiungere funzionalità di statistiche
 */
export const StatisticsMixin = {
    // Metodi statici per statistiche
    getStatistics: async function(this: any, groupBy?: string) {
        const attributes: any[] = [
            [sequelize.fn('COUNT', sequelize.col('id')), 'total']
        ];

        if (groupBy) {
            attributes.push(groupBy);
        }

        const options: any = {
            attributes,
            group: groupBy ? [groupBy] : undefined
        };

        return await this.findAll(options);
    },

    getGrowthRate: async function(this: any, dateField: string, period: 'day' | 'week' | 'month' = 'month') {
        const now = new Date();
        const periods = {
            day: 30,
            week: 12,
            month: 12
        };

        const results : any[] = [];
        
        for (let i = 0; i < periods[period]; i++) {
            const startDate = new Date(now);
            const endDate = new Date(now);
            
            switch (period) {
                case 'day':
                    startDate.setDate(startDate.getDate() - i);
                    endDate.setDate(endDate.getDate() - i + 1);
                    break;
                case 'week':
                    startDate.setDate(startDate.getDate() - (i * 7));
                    endDate.setDate(endDate.getDate() - (i * 7) + 7);
                    break;
                case 'month':
                    startDate.setMonth(startDate.getMonth() - i);
                    endDate.setMonth(endDate.getMonth() - i + 1);
                    break;
            }

            const count = await this.count({
                where: {
                    [dateField]: {
                        [Op.gte]: startDate,
                        [Op.lt]: endDate
                    }
                }
            });

            results.push({
                period: new Date(startDate), // Clona la data per evitare mutazioni accidentali
                count: typeof count === 'number' ? count : 0 // Garantisce che count sia sempre un numero
            });
        }

        return results.reverse();
    }
};

/**
 * Funzione helper per applicare mixins ai modelli
 */
export function applyMixins(model: any, mixins: string[]) {
    mixins.forEach(mixinName => {
        switch (mixinName) {
            case 'softDelete':
                Object.assign(model.prototype, SoftDeleteMixin);
                break;
            case 'audit':
                Object.assign(model.prototype, AuditMixin);
                break;
            case 'versioning':
                Object.assign(model.prototype, VersioningMixin);
                break;
            case 'fullTextSearch':
                Object.assign(model, FullTextSearchMixin);
                break;
            case 'cache':
                Object.assign(model, CacheMixin);
                break;
            case 'exportImport':
                Object.assign(model.prototype, ExportImportMixin);
                Object.assign(model, ExportImportMixin);
                break;
            case 'validation':
                Object.assign(model.prototype, ValidationMixin);
                Object.assign(model, ValidationMixin);
                break;
            case 'statistics':
                Object.assign(model, StatisticsMixin);
                break;
        }
    });
} 