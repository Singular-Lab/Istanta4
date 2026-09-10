import { Op, type WhereOptions } from 'sequelize';
import type { PuntiVenditaAttributes } from '../../../lib/types';
import { PuntoVendita } from '../models/punto_vendita/punti_vendita';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository } from './IBaseRepository';

type PuntoVenditaInstance = InstanceType<typeof PuntoVendita>;

export interface PuntoVenditaFilters {
    gdoId?: string;
    areaId?: string;
    canaleId?: string;
    regione?: string;
    provincia?: string;
    citta?: string;
}

export interface PuntoVenditaPaginationParams {
    idGDO: string;
    page: number;
    pageSize: number;
    search?: string;
    sortBy?: 'nome' | 'citta' | 'cap' | 'createdat';
    sortDirection?: 'asc' | 'desc';
    hasCoordinate?: boolean;
    idCombinazioneCanaleArea?: string;
}

export interface IPuntoVenditaRepository extends IBaseRepository<PuntoVenditaInstance, string> {
    findByGdoId(gdoId: string): Promise<PuntoVenditaInstance[]>;
    findByAreaId(areaId: string): Promise<PuntoVenditaInstance[]>;
    findByRegione(regione: string): Promise<PuntoVenditaInstance[]>;
    findByProvincia(provincia: string): Promise<PuntoVenditaInstance[]>;
    findByCitta(citta: string): Promise<PuntoVenditaInstance[]>;
    search(query: string): Promise<PuntoVenditaInstance[]>;
    findByFilters(filters: PuntoVenditaFilters): Promise<PuntoVenditaInstance[]>;
    findPaginatedByGdo(params: PuntoVenditaPaginationParams): Promise<{ rows: PuntoVenditaInstance[]; count: number }>;
}

export class PuntoVenditaRepository
    extends BaseRepository<PuntoVenditaInstance, PuntiVenditaAttributes, string>
    implements IPuntoVenditaRepository {
    constructor() {
        super(PuntoVendita, 'id_puntivendita');
    }

    findByGdoId(gdoId: string): Promise<PuntoVenditaInstance[]> {
        return this.model.findAll({ where: { id_gdo_puntivendita: gdoId } });
    }

    findByAreaId(areaId: string): Promise<PuntoVenditaInstance[]> {
        return this.model.findAll({ where: { idArea_PuntiVendita: areaId } as WhereOptions<PuntiVenditaAttributes> });
    }

    findByRegione(regione: string): Promise<PuntoVenditaInstance[]> {
        return this.model.findAll({ where: { regione_puntivendita: regione } });
    }

    findByProvincia(provincia: string): Promise<PuntoVenditaInstance[]> {
        return this.model.findAll({ where: { provincia_puntivendita: provincia } });
    }

    findByCitta(citta: string): Promise<PuntoVenditaInstance[]> {
        return this.model.findAll({ where: { citta_puntivendita: citta } });
    }

    search(query: string): Promise<PuntoVenditaInstance[]> {
        const likeValue = `%${query}%`;
        const where: WhereOptions<PuntiVenditaAttributes> = {
            [Op.or]: [
                { nome_puntivendita: { [Op.like]: likeValue } },
                { indirizzo_puntivendita: { [Op.like]: likeValue } },
                { citta_puntivendita: { [Op.like]: likeValue } },
                { provincia_puntivendita: { [Op.like]: likeValue } },
                { regione_puntivendita: { [Op.like]: likeValue } }
            ]
        };
        return this.model.findAll({ where });
    }

    findByFilters(filters: PuntoVenditaFilters): Promise<PuntoVenditaInstance[]> {
        const where: WhereOptions<PuntiVenditaAttributes> = {};
        if (filters.gdoId) where.id_gdo_puntivendita = filters.gdoId;
        if (filters.areaId) (where as any).idArea_PuntiVendita = filters.areaId;
        if (filters.canaleId) (where as any).idCanale_PuntiVendita = filters.canaleId;
        if (filters.regione) where.regione_puntivendita = filters.regione;
        if (filters.provincia) where.provincia_puntivendita = filters.provincia;
        if (filters.citta) where.citta_puntivendita = filters.citta;
        return this.model.findAll({ where });
    }

    async findPaginatedByGdo(params: PuntoVenditaPaginationParams): Promise<{ rows: PuntoVenditaInstance[]; count: number }> {
        const {
            idGDO,
            page,
            pageSize,
            search,
            sortBy = 'nome',
            sortDirection = 'asc',
            hasCoordinate,
            idCombinazioneCanaleArea
        } = params;

        const andConditions: any[] = [{ id_gdo_puntivendita: idGDO }];

        if (search && search.trim()) {
            const likeValue = `%${search}%`;
            andConditions.push({
                [Op.or]: [
                    { nome_puntivendita: { [Op.like]: likeValue } },
                    { citta_puntivendita: { [Op.like]: likeValue } },
                    { indirizzo_puntivendita: { [Op.like]: likeValue } },
                    { cap_puntivendita: { [Op.like]: likeValue } }
                ]
            });
        }

        if (hasCoordinate === true) {
            andConditions.push({
                lat_puntivendita: { [Op.ne]: null },
                lon_puntivendita: { [Op.ne]: null }
            });
        } else if (hasCoordinate === false) {
            andConditions.push({
                [Op.or]: [
                    { lat_puntivendita: null },
                    { lon_puntivendita: null }
                ]
            });
        }

        if (idCombinazioneCanaleArea) {
            andConditions.push({ id_combinazione_canale_area_puntivendita: idCombinazioneCanaleArea });
        }

        const whereConditions = andConditions.length === 1
            ? andConditions[0]
            : { [Op.and]: andConditions };

        const sortFieldMap: Record<string, string> = {
            nome: 'nome_puntivendita',
            citta: 'citta_puntivendita',
            cap: 'cap_puntivendita',
            createdat: 'createdat'
        };

        const orderField = sortFieldMap[sortBy] || 'nome_puntivendita';
        const offset = (page - 1) * pageSize;

        return this.model.findAndCountAll({
            where: whereConditions,
            order: [[orderField, sortDirection.toUpperCase() as 'ASC' | 'DESC']],
            limit: pageSize,
            offset
        });
    }
}
