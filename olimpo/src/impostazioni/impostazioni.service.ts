import { Injectable } from '@nestjs/common';
import { Foto,FotoAttributes } from 'src/models/foto.model';
import { Auth } from 'src/models/auth.model';
import { Materiali,MaterialiAttributes } from 'src/models/materiali.model';
import * as path from 'path';
import { Op, col, fn, where } from 'sequelize';

type FotoPageParams = {
    offset?: number | string;
    limit?: number | string;
    search?: string;
};

type FotoListItem = {
    id: string;
    file_name: string | null;
    file_name_web: string | null;
    file_name_web_performante: string | null;
    created_at: string | null;
    updated_at: string | null;
};


@Injectable()
export class ImpostazioniService {
    async getAllFoto(): Promise<Foto[]> {
        try {
            return await Foto.findAll();
        } catch (error) {
            throw new Error(`Error fetching all photos: ${error.message}`);
        }
    }

    async getFotoById(id: number): Promise<Foto | null> {
        try {
            return await Foto.findByPk(id);
        } catch (error) {
            throw new Error(`Error fetching photo with id ${id}: ${error.message}`);
        }
    }

    async getFotoPage({ offset, limit, search }: FotoPageParams) {
        try {
            const parsedOffset = this.parseNonNegativeNumber(offset, 0);
            const parsedLimit = this.parseClampedNumber(limit, 100, 1, 200);
            const normalizedSearch = (search || '').trim().toLowerCase();
            const likePattern = `%${normalizedSearch}%`;
            const whereClause = normalizedSearch
                ? {
                    [Op.or]: [
                        where(fn('LOWER', col('id')), { [Op.like]: likePattern }),
                        where(fn('LOWER', col('file_name')), { [Op.like]: likePattern }),
                        where(fn('LOWER', col('file_name_web')), { [Op.like]: likePattern }),
                        where(fn('LOWER', col('file_name_web_performante')), { [Op.like]: likePattern }),
                    ],
                }
                : undefined;

            const [total, rows] = await Promise.all([
                Foto.count({ where: whereClause as any }),
                Foto.findAll({
                    attributes: [
                        'id',
                        'file_name',
                        'file_name_web',
                        'file_name_web_performante',
                        'created_at',
                        'updated_at',
                    ],
                    where: whereClause as any,
                    order: [
                        ['created_at', 'DESC'],
                        ['id', 'DESC'],
                    ],
                    offset: parsedOffset,
                    limit: parsedLimit,
                }),
            ]);

            const items = rows.map((item) => this.mapFotoListItem(item));
            const nextOffset = parsedOffset + items.length;

            return {
                items,
                total,
                offset: parsedOffset,
                limit: parsedLimit,
                search: normalizedSearch,
                hasMore: nextOffset < total,
                nextOffset: nextOffset < total ? nextOffset : null,
            };
        } catch (error) {
            throw new Error(`Error fetching photo page: ${error.message}`);
        }
    }

    async createFoto(fotoAttributes: FotoAttributes): Promise<Foto> {
        try {
            return await Foto.create(fotoAttributes);
        } catch (error) {
            throw new Error(`Error creating photo: ${error.message}`);
        }
    }

    async updateFoto(id: string, fotoAttributes: FotoAttributes): Promise<[number, Foto[]]> {
        try {
            return await Foto.update(fotoAttributes, {
                where: { id },
                returning: true,
            });
        } catch (error) {
            throw new Error(`Error updating photo with id ${id}: ${error.message}`);
        }
    }
    
    async deleteFoto(id: string): Promise<void> {
        try {
            const foto = await Foto.findByPk(id);
            if (!foto) {
                throw new Error(`Photo with id ${id} not found`);
            }
            await foto.destroy();
        } catch (error) {
            throw new Error(`Error deleting photo with id ${id}: ${error.message}`);
        }
    }
    
    async getAllMateriali(): Promise<Materiali[]> {
        try {
            return await Materiali.findAll();
        } catch (error) {
            throw new Error(`Error fetching all materials: ${error.message}`);
        }
    }
    
    async getMaterialiById(id: number): Promise<Materiali | null> {
        return await Materiali.findByPk(id);
    }
    
    async createMateriali(materialiAttributes: MaterialiAttributes): Promise<Materiali> {
        return await Materiali.create(materialiAttributes);
    }
    
    async updateMateriali(id: number, materialiAttributes: MaterialiAttributes): Promise<[number, Materiali[]]> {
        try {
            return await Materiali.update(materialiAttributes, {
                where: { id },
                returning: true,
            });
        } catch (error) {
            throw new Error(`Error updating material with id ${id}: ${error.message}`);
        }
    }
    
    async deleteMateriali(id: number): Promise<void> {
        try {
            const materiali = await Materiali.findByPk(id);
            if (!materiali) {
                throw new Error(`Material with id ${id} not found`);
            }
            await materiali.destroy();
        } catch (error) {
            throw new Error(`Error deleting material with id ${id}: ${error.message}`);
        }
    }

    async getDashboardOverview() {
        try {
            const [foto, materiali, utenti] = await Promise.all([
                Foto.findAll(),
                Materiali.findAll(),
                Auth.findAll(),
            ]);

            const fotoItems = foto
                .map((item) => {
                    const createdAt = item.created_at ? new Date(item.created_at).toISOString() : null;
                    const updatedAt = item.updated_at ? new Date(item.updated_at).toISOString() : null;
                    const hasWebAsset = Boolean(item.file_name_web);
                    const hasWebpAsset = Boolean(item.file_name_web_performante);

                    return {
                        id: item.id,
                        archivioFileName: item.file_name,
                        webFileName: item.file_name_web || null,
                        webpFileName: item.file_name_web_performante || null,
                        hasWebAsset,
                        hasWebpAsset,
                        previewUrl: hasWebAsset
                            ? `/olimpo/foto/getThumbNailOnDemand?guidId=${item.id}&width=960&height=640&performante=${hasWebpAsset}`
                            : null,
                        webUrl: hasWebAsset ? `/olimpo/foto/getFotoOnDemand?guidId=${item.id}` : null,
                        createdAt,
                        updatedAt,
                    };
                })
                .sort((a, b) => this.getTimeValue(b.updatedAt || b.createdAt) - this.getTimeValue(a.updatedAt || a.createdAt));

            const materialiItems = materiali
                .map((item) => {
                    const extension = path.extname(item.file_name || item.original_name || '').replace('.', '').toLowerCase();
                    const isPdf = extension === 'pdf';

                    return {
                        id: item.id,
                        fileName: item.file_name,
                        originalName: item.original_name,
                        pagine: Number(item.pagine || 0),
                        extension,
                        isPdf,
                        thumbnailUrl: isPdf
                            ? `/olimpo/materiali/getThumbnailMaterialePdfs?id=${item.id}&page=1&width=800&height=520`
                            : null,
                        openUrl: `/olimpo/materiali/getMaterialePDF?id=${item.id}`,
                    };
                })
                .sort((a, b) => (a.originalName || a.fileName || '').localeCompare((b.originalName || b.fileName || ''), 'it', { sensitivity: 'base' }));

            const utentiItems = utenti
                .map((item) => {
                    const essentialData = (item.meta_utente?.campi_essenziali || {}) as Record<string, any>;
                    const ruoli = Array.isArray(item.meta_utente?.ruoli) ? item.meta_utente.ruoli : [];
                    const displayName = [essentialData.nome, essentialData.cognome].filter(Boolean).join(' ').trim();

                    return {
                        id: item.id,
                        email: item.email,
                        origin: item.origine,
                        tipoUtente: item.tipo_utente,
                        isValid: item.is_valid !== false,
                        expiresAt: item.expires_at ? new Date(item.expires_at).toISOString() : null,
                        nome: essentialData.nome || '',
                        cognome: essentialData.cognome || '',
                        displayName: displayName || item.email || 'Utente senza nome',
                        ruoliCount: ruoli.length,
                    };
                })
                .sort((a, b) => a.displayName.localeCompare(b.displayName, 'it', { sensitivity: 'base' }));

            return {
                generatedAt: new Date().toISOString(),
                stats: {
                    totalFoto: fotoItems.length,
                    fotoConvertiteWeb: fotoItems.filter((item) => item.hasWebAsset).length,
                    fotoPerformanti: fotoItems.filter((item) => item.hasWebpAsset).length,
                    totalMateriali: materialiItems.length,
                    materialiPdf: materialiItems.filter((item) => item.isPdf).length,
                    totalUtenti: utentiItems.length,
                },
                foto: fotoItems,
                materiali: materialiItems,
                utenti: utentiItems,
            };
        } catch (error) {
            throw new Error(`Error fetching dashboard overview: ${error.message}`);
        }
    }

    private getTimeValue(value: string | null): number {
        if (!value) {
            return 0;
        }

        const parsedValue = new Date(value).getTime();
        return Number.isNaN(parsedValue) ? 0 : parsedValue;
    }

    private mapFotoListItem(item: Foto): FotoListItem {
        return {
            id: item.id,
            file_name: item.file_name || null,
            file_name_web: item.file_name_web || null,
            file_name_web_performante: item.file_name_web_performante || null,
            created_at: item.created_at ? new Date(item.created_at).toISOString() : null,
            updated_at: item.updated_at ? new Date(item.updated_at).toISOString() : null,
        };
    }

    private parseNonNegativeNumber(value: number | string | undefined, fallback: number): number {
        const parsedValue = Number(value);
        if (!Number.isFinite(parsedValue) || parsedValue < 0) {
            return fallback;
        }

        return Math.floor(parsedValue);
    }

    private parseClampedNumber(value: number | string | undefined, fallback: number, min: number, max: number): number {
        const parsedValue = Number(value);
        if (!Number.isFinite(parsedValue)) {
            return fallback;
        }

        const roundedValue = Math.floor(parsedValue);
        return Math.min(Math.max(roundedValue, min), max);
    }
}
