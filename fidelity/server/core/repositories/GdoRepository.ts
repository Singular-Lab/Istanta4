import { cast, Op } from 'sequelize';
import type { GDOAttributes } from '../../../lib/types';
import { GDO } from '../models/gdo';
import { UtentiGDO } from '../models/utenti_gdo';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository } from './IBaseRepository';

type GDOInstance = InstanceType<typeof GDO>;

export interface IGdoRepository extends IBaseRepository<GDOInstance, string> {
    findByIdWithChildren(id: string): Promise<GDOInstance | null>;
    findByUtenteIdWithChildren(userId: string): Promise<GDOInstance | null>;
}

export class GdoRepository
    extends BaseRepository<GDOInstance, GDOAttributes, string>
    implements IGdoRepository {
    constructor() {
        super(GDO, 'id_gdo');
    }

    async findByIdWithChildren(id: string): Promise<GDOInstance | null> {
        const gdo = await this.model.findOne({
            where: { id_gdo: id },
        });

        if (!gdo) {
            return null;
        }

        const children = await this.model.findAll({
            where: { idparent_gdo: id },
            attributes: ['id_gdo'],
        });

        //@ts-ignore
        gdo.setDataValue('children', children);

        return gdo;
    }

    async findByUtenteIdWithChildren(userId: string): Promise<GDOInstance | null> {
        const utenteGdo = await UtentiGDO.findOne({
            where: { id_utente_utentegdo: { [Op.eq]: cast(userId, 'uuid') } },
        });

        if (!utenteGdo?.id_gdo_utentegdo) {
            return null;
        }

        return this.findByIdWithChildren(utenteGdo.id_gdo_utentegdo);
    }
}
