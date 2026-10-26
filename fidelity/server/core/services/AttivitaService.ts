import { QueryTypes } from 'sequelize';
import { CATEGORIA_ATTIVITA } from '../../../lib/enums';
import { wrapDatabaseError } from '../../../lib/errors';
import { sequelize } from '../db';
import { AttivitaResponseDTO } from '../dto';
import { IAttivitaService } from '../interfaces/IAttivitaService';
import { Utente } from '../models';
import { Attivita } from '../models/attivita';
import { AttivitaUtente } from '../models/attivita_utente';
import type { IAttivitaRepository } from '../repositories/AttivitaRepository';
import { AttivitaRepository } from '../repositories/AttivitaRepository';
import type { IUserRepository } from '../repositories/UserRepository';
import { UserRepository } from '../repositories/UserRepository';

/**
 * Opzioni di filtro per le attività
 */
export interface GetAttivitaOptions {
  limit?: number;
  offset?: number;
  categoria?: CATEGORIA_ATTIVITA;
  soloNonLette?: boolean;
}

/**
 * Risposta con conteggio notifiche non lette
 */
export interface UnreadCountResponse {
  totale: number;
  per_categoria: Record<string, number>;
}

export class AttivitaService implements IAttivitaService {
  constructor(
    private readonly attivitaRepository: IAttivitaRepository = new AttivitaRepository(),
    private readonly userRepository: IUserRepository = new UserRepository()
  ) {}

  /**
   * Recupera le attività per un utente con:
   * - Cutoff temporale (vede solo attività create dopo la sua registrazione)
   * - Filtro per categoria
   * - Filtro per stato lettura
   */
  async get_attivita(
    userId?: string,
    limit: number = 50,
    offset: number = 0,
    options?: GetAttivitaOptions
  ): Promise<AttivitaResponseDTO[]> {
    try {
      if (userId) {
        // Recupera il tipo utente per i filtri
        const utente = await Utente.findByPk(userId);
        const tipoUtenteRichiedente = utente?.tipo_utenti;

        // Utilizza la funzione specifica per l'utente con cutoff temporale
        const query = `SELECT * FROM public.get_attivita_for_user(
          :userId,
          :tipoUtenteRichiedente,
          :limit,
          :offset,
          :categoria,
          :soloNonLette
        )`;

        const attivita_list_from_db = await sequelize.query(query, {
          type: QueryTypes.SELECT,
          replacements: {
            userId,
            tipoUtenteRichiedente,
            limit: options?.limit ?? limit,
            offset: options?.offset ?? offset,
            categoria: options?.categoria ?? null,
            soloNonLette: options?.soloNonLette ?? false
          }
        }) as AttivitaResponseDTO[];

        return attivita_list_from_db;
      } else {
        // Utilizza la view base se non c'è userId
        const query = `SELECT * FROM public.v_attivita LIMIT :limit OFFSET :offset`;

        const attivita_list_from_db = await sequelize.query(query, {
          type: QueryTypes.SELECT,
          replacements: { limit, offset }
        }) as AttivitaResponseDTO[];

        return attivita_list_from_db;
      }
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il recupero delle attività",
        operation: 'get',
        entity: 'Attivita',
      });
    }
  }

  /**
   * Conta le notifiche non lette per un utente (rispettando il cutoff temporale)
   */
  async countUnreadForUser(userId: string): Promise<UnreadCountResponse> {
    try {
      const utente = await Utente.findByPk(userId);
      const tipoUtenteRichiedente = utente?.tipo_utenti;

      const query = `SELECT * FROM public.count_unread_attivita_for_user(:userId, :tipoUtenteRichiedente)`;

      const result = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        replacements: { userId, tipoUtenteRichiedente }
      }) as Array<{ totale: string; per_categoria: Record<string, number> }>;

      if (result.length > 0) {
        return {
          totale: parseInt(result[0].totale, 10),
          per_categoria: result[0].per_categoria || {}
        };
      }

      return { totale: 0, per_categoria: {} };
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il conteggio delle attività non lette",
        operation: 'count',
        entity: 'Attivita',
      });
    }
  }

  /**
   * Esegue la pulizia delle attività scadute
   */
  async cleanupExpiredAttivita(): Promise<number> {
    try {
      const query = `SELECT public.cleanup_expired_attivita() AS deleted`;
      const result = await sequelize.query(query, {
        type: QueryTypes.SELECT
      }) as Array<{ deleted: number }>;

      return result[0]?.deleted ?? 0;
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante la pulizia delle attività scadute",
        operation: 'delete',
        entity: 'Attivita',
      });
    }
  }

  async mark_as_read(userId: string, idAttivita: string): Promise<void> {
    try {
      // Inserisci un record per indicare che l'attività è stata letta
      await AttivitaUtente.upsert({
        id_utente_attivita_utente: userId,
        id_attivita_attivita_utente: idAttivita,
        letto_attivita_utente: true,
        data_lettura_attivita_utente: new Date()
      });
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il marking come letto",
        operation: 'update',
        entity: 'AttivitaUtente',
      });
    }
  }

  async mark_as_unread(userId: string, idAttivita: string): Promise<void> {
    try {
      // Rimuovi il record per indicare che l'attività non è stata letta
      await AttivitaUtente.destroy({
        where: {
          id_utente_attivita_utente: userId,
          id_attivita_attivita_utente: idAttivita
        }
      });
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il marking come non letto",
        operation: 'delete',
        entity: 'AttivitaUtente',
      });
    }
  }

  async mark_all_as_read(userId: string): Promise<void> {
    try {
      const tutteLeAttivita = await Attivita.findAll({ attributes: ['id_attivita'] });
      const esistenti = await AttivitaUtente.findAll({
        where: { id_utente_attivita_utente: userId },
        attributes: ['id_attivita_attivita_utente']
      });
      const esistentiSet = new Set(esistenti.map(e => e.id_attivita_attivita_utente));
      const daCreare = tutteLeAttivita
        .filter(a => !esistentiSet.has(a.id_attivita))
        .map(a => ({
          id_utente_attivita_utente: userId,
          id_attivita_attivita_utente: a.id_attivita,
          letto_attivita_utente: true,
          data_lettura_attivita_utente: new Date()
        }));
      if (daCreare.length > 0) await AttivitaUtente.bulkCreate(daCreare, { ignoreDuplicates: true });
      await AttivitaUtente.update(
        { letto_attivita_utente: true, data_lettura_attivita_utente: new Date() },
        { where: { id_utente_attivita_utente: userId, letto_attivita_utente: false } }
      );
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il marking di tutte le attività come lette",
        operation: 'update',
        entity: 'AttivitaUtente',
      });
    }
  }

  // Metodi aggiuntivi per la gestione delle attività utente
  async findUnreadByUser(userId: string): Promise<any[]> {
    try {
      return await AttivitaUtente.findAll({
        where: {
          id_utente_attivita_utente: userId,
          letto_attivita_utente: false
        },
        include: [
          {
            model: Attivita,
            as: 'attivita',
            attributes: ['id_attivita', 'tipo_attivita', 'meta_attivita', 'createdat']
          }
        ],
        order: [['createdat', 'DESC']]
      });
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il recupero delle attività non lette",
        operation: 'get',
        entity: 'AttivitaUtente',
      });
    }
  }

  async findReadByUser(userId: string): Promise<any[]> {
    try {
      return await AttivitaUtente.findAll({
        where: {
          id_utente_attivita_utente: userId,
          letto_attivita_utente: true
        },
        include: [
          {
            model: Attivita,
            as: 'attivita',
            attributes: ['id_attivita', 'tipo_attivita', 'meta_attivita', 'createdat']
          }
        ],
        order: [['data_lettura_attivita_utente', 'DESC']]
      });
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il recupero delle attività lette",
        operation: 'get',
        entity: 'AttivitaUtente',
      });
    }
  }

  async countUnreadByUser(userId: string): Promise<number> {
    try {
      return await AttivitaUtente.count({
        where: {
          id_utente_attivita_utente: userId,
          letto_attivita_utente: false
        }
      });
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il conteggio delle attività non lette",
        operation: 'count',
        entity: 'AttivitaUtente',
      });
    }
  }

  async markAllAsReadForUser(userId: string): Promise<[number]> {
    try {
      return await AttivitaUtente.update(
        {
          letto_attivita_utente: true,
          data_lettura_attivita_utente: new Date()
        },
        {
          where: {
            id_utente_attivita_utente: userId,
            letto_attivita_utente: false
          }
        }
      );
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il marking di tutte le attività come lette",
        operation: 'update',
        entity: 'AttivitaUtente',
      });
    }
  }

  async markAsReadWithReturn(userId: string, idAttivita: string): Promise<AttivitaResponseDTO[]> {
    try {
      // Usa upsert per inserire o aggiornare il record
      await AttivitaUtente.upsert({
        id_utente_attivita_utente: userId,
        id_attivita_attivita_utente: idAttivita,
        letto_attivita_utente: true,
        data_lettura_attivita_utente: new Date()
      });

      // Restituisci le attività aggiornate
      return await this.getAttivitaWithReadStatus(userId);
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il marking come letto",
        operation: 'update',
        entity: 'AttivitaUtente',
      });
    }
  }

  private async getAttivitaWithReadStatus(userId: string, limit: number = 50, offset: number = 0): Promise<AttivitaResponseDTO[]> {
    const query = `
            SELECT
                a.id_attivita AS id,
                a.createdat AS data_creazione,
                a.idutente_attivita AS assegnato_a_id,
                COALESCE(u.nome_utenti, 'N/A'::character varying) AS nome_assegnato,
                COALESCE(u.cognome_utenti, 'N/A'::character varying) AS cognome_assegnato,
                a.tipo_attivita AS tipo,
                a.meta_attivita AS meta,
                CASE
                    WHEN au.id_attivita_utente IS NOT NULL THEN true
                    ELSE false
                END AS is_read
            FROM attivita a
            LEFT JOIN utenti u ON a.idutente_attivita = u.id_utenti
            LEFT JOIN attivita_utente au ON a.id_attivita = au.id_attivita_attivita_utente
                AND au.id_utente_attivita_utente = :userId
            ORDER BY a.createdat DESC
            LIMIT :limit OFFSET :offset
        `;

    const result = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements: { userId, limit, offset }
    });

    return result as AttivitaResponseDTO[];
  }

  // Metodi per query ottimizzate
  async getAttivitaUnreadOnly(userId: string, limit: number = 20): Promise<AttivitaResponseDTO[]> {
    try {
      const query = `
                SELECT
                    a.id_attivita AS id,
                    a.createdat AS data_creazione,
                    a.idutente_attivita AS assegnato_a_id,
                    COALESCE(u.nome_utenti, 'N/A'::character varying) AS nome_assegnato,
                    COALESCE(u.cognome_utenti, 'N/A'::character varying) AS cognome_assegnato,
                    a.tipo_attivita AS tipo,
                    a.meta_attivita AS meta,
                    false AS is_read
                FROM attivita a
                LEFT JOIN utenti u ON a.idutente_attivita = u.id_utenti
                WHERE a.id_attivita NOT IN (
                    SELECT DISTINCT id_attivita_attivita_utente
                    FROM attivita_utente
                    WHERE id_utente_attivita_utente = :userId
                )
                ORDER BY a.createdat DESC
                LIMIT :limit
            `;

      const result = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        replacements: { userId, limit }
      });

      return result as AttivitaResponseDTO[];
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il recupero delle attività non lette",
        operation: 'get',
        entity: 'Attivita',
      });
    }
  }

  async getAttivitaReadOnly(userId: string, limit: number = 20, offset: number = 0): Promise<AttivitaResponseDTO[]> {
    try {
      const query = `
                SELECT
                    a.id_attivita AS id,
                    a.createdat AS data_creazione,
                    a.idutente_attivita AS assegnato_a_id,
                    COALESCE(u.nome_utenti, 'N/A'::character varying) AS nome_assegnato,
                    COALESCE(u.cognome_utenti, 'N/A'::character varying) AS cognome_assegnato,
                    a.tipo_attivita AS tipo,
                    a.meta_attivita AS meta,
                    true AS is_read,
                    au.data_lettura_attivita_utente AS data_lettura
                FROM attivita a
                LEFT JOIN utenti u ON a.idutente_attivita = u.id_utenti
                INNER JOIN attivita_utente au ON a.id_attivita = au.id_attivita_attivita_utente
                WHERE au.id_utente_attivita_utente = :userId
                ORDER BY au.data_lettura_attivita_utente DESC
                LIMIT :limit OFFSET :offset
            `;

      const result = await sequelize.query(query, {
        type: QueryTypes.SELECT,
        replacements: { userId, limit, offset }
      });

      return result as AttivitaResponseDTO[];
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il recupero delle attività lette",
        operation: 'get',
        entity: 'Attivita',
      });
    }
  }

  async getAttivitaCount(userId?: string): Promise<{ total: number; unread: number; read: number }> {
    try {
      let totalQuery = "SELECT COUNT(*) as total FROM attivita";
      let unreadQuery = `
                SELECT COUNT(*) as unread
                FROM attivita a
                WHERE a.id_attivita NOT IN (
                    SELECT DISTINCT id_attivita_attivita_utente
                    FROM attivita_utente
                    WHERE id_utente_attivita_utente = :userId
                )
            `;
      let readQuery = `
                SELECT COUNT(*) as read
                FROM attivita_utente
                WHERE id_utente_attivita_utente = :userId
            `;

      const [totalResult, unreadResult, readResult] = await Promise.all([
        sequelize.query(totalQuery, { type: QueryTypes.SELECT }),
        sequelize.query(unreadQuery, {
          type: QueryTypes.SELECT,
          replacements: { userId: userId || '00000000-0000-0000-0000-000000000000' }
        }),
        sequelize.query(readQuery, {
          type: QueryTypes.SELECT,
          replacements: { userId: userId || '00000000-0000-0000-0000-000000000000' }
        })
      ]);

      type CountRow = { total: string; unread: string; read: string };
      return {
        total: parseInt((totalResult[0] as CountRow).total, 10),
        unread: parseInt((unreadResult[0] as CountRow).unread, 10),
        read: parseInt((readResult[0] as CountRow).read, 10)
      };
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il conteggio delle attività",
        operation: 'count',
        entity: 'Attivita',
      });
    }
  }
}
