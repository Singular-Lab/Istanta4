import type { CreateOptions, DestroyOptions, FindOptions, UpdateOptions } from 'sequelize';
import type { UtenteAttributes } from '../../../lib/types';
import { Utente } from '../models/utenti';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository } from './IBaseRepository';

type UtenteInstance = InstanceType<typeof Utente>;

export interface IUserRepository extends IBaseRepository<UtenteInstance, string> {
    findByEmail(email: string): Promise<UtenteInstance | null>;
    findByPhone(phone: string): Promise<UtenteInstance | null>;
    findOneByOptions(options: FindOptions<UtenteAttributes>): Promise<UtenteInstance | null>;
    findAllByOptions(options: FindOptions<UtenteAttributes>): Promise<UtenteInstance[]>;
    createWithOptions(
        values: Partial<UtenteAttributes>,
        options?: CreateOptions<UtenteAttributes>
    ): Promise<UtenteInstance>;
    updateWhere(
        values: Partial<UtenteAttributes>,
        options: UpdateOptions<UtenteAttributes>
    ): Promise<number>;
    destroyWhere(options: DestroyOptions<UtenteAttributes>): Promise<number>;
}

export class UserRepository
    extends BaseRepository<UtenteInstance, UtenteAttributes, string>
    implements IUserRepository {
    constructor() {
        super(Utente, 'id_utenti');
    }

    findByEmail(email: string): Promise<UtenteInstance | null> {
        return this.model.findOne({ where: { email_utenti: email } });
    }

    findByPhone(phone: string): Promise<UtenteInstance | null> {
        return this.model.findOne({ where: { telefono_utenti: phone } });
    }

    findOneByOptions(options: FindOptions<UtenteAttributes>): Promise<UtenteInstance | null> {
        return this.model.findOne(options);
    }

    findAllByOptions(options: FindOptions<UtenteAttributes>): Promise<UtenteInstance[]> {
        return this.model.findAll(options);
    }

    createWithOptions(
        values: Partial<UtenteAttributes>,
        options?: CreateOptions<UtenteAttributes>
    ): Promise<UtenteInstance> {
        return this.model.create(values as any, options);
    }

    async updateWhere(
        values: Partial<UtenteAttributes>,
        options: UpdateOptions<UtenteAttributes>
    ): Promise<number> {
        const [affectedRows] = await this.model.update(values as any, options);
        return affectedRows;
    }

    destroyWhere(options: DestroyOptions<UtenteAttributes>): Promise<number> {
        return this.model.destroy(options);
    }
}
