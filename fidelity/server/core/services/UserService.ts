import axios from 'axios';
import bcrypt from 'bcrypt';
import { Request } from 'express';
import fs from 'fs';
import path from 'path';
import { Op, QueryTypes } from 'sequelize';
import { decryptString } from '../../../lib/encryption';
import { CATEGORIA_ATTIVITA, STATO_CANALI_INTERAZIONE, STATO_UTENTI, TIPI_CANALI_INTERAZIONE, TIPO_ATTIVITA, TIPO_UTENTI } from '../../../lib/enums';
import { ApplicationError, DatabaseError, ForbiddenError, NotFoundError, ValidationError } from '../../../lib/errors';
import { PROFILE_PHOTO_MAX_SIZE_BYTES, PROFILE_PHOTO_MAX_SIZE_MB } from '../../../lib/profilePhoto';
import { DataFields, GdoMenuStructure, MenuElement, MenuStructure, UtenteAttributes, UtentiCanaliInterazioneAttributes, UtentiGDOAttributes, UtentiMeta } from '../../../lib/types';
import config from '../config';
import { sequelize } from '../db/SequelizeConnector';
import { log } from '../logger';
import { CreateUtenteDTO, UpdateUtenteDTO, UtentePaginatedResponseDTO, UtenteResponseDTO, toUtenteAttributes, toUtenteResponseDTO, updateUtenteAttributes } from '../dto';
import type { IMenuService } from '../interfaces/IMenuService';
import { IUserService } from '../interfaces/IUserService';
import { CanaleInterazione } from '../models/canali_interazione';
import { GDO } from '../models/gdo';
import { PuntoVendita } from '../models/punto_vendita/punti_vendita';
import { PuntoVenditaUtenti } from '../models/punto_vendita/punti_vendita_utenti';
import { RuoloUtenteGDO } from '../models/ruolo_gdo';
import { UtentiAnonimi } from '../models/utenti_anonimi';
import { UtentiGDO } from '../models/utenti_gdo';
import { WishlistWebpliant } from '../models/wishlist_webpliant';
import type { IUserRepository } from '../repositories/UserRepository';
import { ServerUtils } from '../utils/ServerUtils';
export class UserService implements IUserService {

  private menuService?: IMenuService;

  constructor(private readonly userRepository: IUserRepository, menuService?: IMenuService) {
    this.menuService = menuService;
  }


  // Metodo per query avanzate sulla Materialized View
  async getUtentiWithFilters(filters: {
    tipoUtente?: string;
    stato?: string;
    sesso?: string;
    haRuoloGDO?: boolean;
    haPuntoVendita?: boolean;
    isAttivo?: boolean;
    isAdmin?: boolean;
    searchTerm?: string;
  }): Promise<any[]> {
    try {
      let whereClause = 'WHERE 1=1';
      const replacements: any = {};

      if (filters.stato) {
        whereClause += ' AND stato = :stato';
        replacements.stato = filters.stato;
      }

      if (filters.tipoUtente) {
        whereClause += ' AND tipo = :tipoUtente';
        replacements.tipoUtente = filters.tipoUtente;
      }

      if (filters.sesso) {
        whereClause += ' AND sesso = :sesso';
        replacements.sesso = filters.sesso;
      }

      if (filters.haRuoloGDO !== undefined) {
        whereClause += ' AND ha_ruolo_gdo = :haRuoloGDO';
        replacements.haRuoloGDO = filters.haRuoloGDO;
      }

      if (filters.haPuntoVendita !== undefined) {
        whereClause += ' AND ha_punto_vendita = :haPuntoVendita';
        replacements.haPuntoVendita = filters.haPuntoVendita;
      }

      if (filters.isAttivo !== undefined) {
        whereClause += ' AND is_attivo = :isAttivo';
        replacements.isAttivo = filters.isAttivo;
      }

      if (filters.isAdmin !== undefined) {
        whereClause += ' AND is_admin = :isAdmin';
        replacements.isAdmin = filters.isAdmin;
      }

      if (filters.searchTerm) {
        whereClause += ' AND (nome ILIKE :searchTerm OR cognome ILIKE :searchTerm OR email ILIKE :searchTerm OR nome_completo ILIKE :searchTerm)';
        replacements.searchTerm = `%${filters.searchTerm}%`;
      }

      const users = await sequelize.query(`
        SELECT * FROM mv_utenti_completi
        ${whereClause}
        ORDER BY createdat DESC
      `, {
        replacements,
        type: QueryTypes.SELECT
      });

      return users.map((user: any) => ({
        ...user,
        canali_interazione: Array.isArray(user.canali_interazione)
          ? user.canali_interazione
          : JSON.parse(user.canali_interazione || '[]'),
        ruolo_gdo: user.ruolo_gdo
          ? (typeof user.ruolo_gdo === 'string' ? JSON.parse(user.ruolo_gdo) : user.ruolo_gdo)
          : null,
        punto_vendita_collegato: user.punto_vendita_collegato
          ? (typeof user.punto_vendita_collegato === 'string' ? JSON.parse(user.punto_vendita_collegato) : user.punto_vendita_collegato)
          : null
      }));
    } catch (error) {
      log.error('Impossibile eseguire la ricerca filtrata degli utenti', error instanceof Error ? error : new Error(String(error)));
      throw new DatabaseError({
        message: 'Errore durante la ricerca filtrata',
        operation: 'search',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async get_all_utenti_paginated(userId: string, page: number, limit: number): Promise<UtentePaginatedResponseDTO> {
    try {
      const currentUser = await this.userRepository.findById(userId);
      // Query ottimizzata con Materialized View
      const users = await sequelize.query(`
        SELECT * FROM get_utenti_completi_filtered(:currentUserType)
        WHERE id != :userId
        ORDER BY createdat DESC
        LIMIT :limit OFFSET :offset
      `, {
        replacements: {
          currentUserType: currentUser?.tipo_utenti,
          userId,
          limit,
          offset: (page - 1) * limit
        },
        type: QueryTypes.SELECT
      });

      // Query per il conteggio totale
      const totalResult = await sequelize.query(`
        SELECT COUNT(*) as total FROM get_utenti_completi_filtered(:currentUserType)
        WHERE id != :userId
      `, {
        replacements: { currentUserType: currentUser?.tipo_utenti, userId },
        type: QueryTypes.SELECT
      });

      const total = parseInt((totalResult[0] as any).total);

      // Recupera le associazioni GDO per tutti gli utenti nella pagina
      const userIds = users.map((u: any) => u.id);
      const gdoAssociations = userIds.length > 0 ? await sequelize.query(`
        SELECT id_utente_utentegdo, id_gdo_utentegdo
        FROM utenti_gdo
        WHERE id_utente_utentegdo IN (:userIds)
      `, {
        replacements: { userIds },
        type: QueryTypes.SELECT
      }) : [];
      const gdoMap = new Map((gdoAssociations as any[]).map((a: any) => [a.id_utente_utentegdo, a.id_gdo_utentegdo]));

      // Trasformazione dei dati dalla Materialized View
      const utenti = users.map((user: any) => ({
        ...user,
        // Parsing automatico dei campi JSONB (se sono stringhe)
        canali_interazione: typeof user.canali_interazione === 'string'
          ? JSON.parse(user.canali_interazione)
          : user.canali_interazione,
        ruolo_gdo: user.ruolo_gdo && typeof user.ruolo_gdo === 'string'
          ? JSON.parse(user.ruolo_gdo)
          : user.ruolo_gdo,
        punto_vendita_collegato: user.punto_vendita_collegato && typeof user.punto_vendita_collegato === 'string'
          ? JSON.parse(user.punto_vendita_collegato)
          : user.punto_vendita_collegato,
        id_gdo: gdoMap.get(user.id) || null,
      }));

      return {
        utenti: utenti,
        total: total,
        page: page,
        limit: limit,
        total_pages: Math.ceil(total / limit)
      };
    } catch (error) {
      log.error('Impossibile recuperare gli utenti paginati', error instanceof Error ? error : new Error(String(error)), { page, limit });
      throw new DatabaseError({
        message: 'Errore durante il recupero degli utenti paginati',
        operation: 'get',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }
  async registerUserWithChannels(utenteData: Omit<UtenteAttributes, 'id_utenti'> & Partial<Pick<UtenteAttributes, 'id_utenti'>>, utenteGDO: any, utenteCanaliInterazioni: UtentiCanaliInterazioneAttributes): Promise<any> {
    try {
      const utente = await this.userRepository.create(utenteData);
      const localUtenteGDO = await UtentiGDO.create({
        id_utente_utentegdo: utente.id_utenti,
        id_gdo_utentegdo: utenteGDO.id_GDO
      });
      const localUtenteCanaliInterazioni = await CanaleInterazione.create({
        idutente_canaliinterazione: utente.id_utenti,
        id_canaliinterazione: utenteCanaliInterazioni.idCanaleInterazione_UtentiCanaliInterazione,
        tipo_canaliinterazione: TIPI_CANALI_INTERAZIONE.WHATSAPP,
        stato_canaliinterazione: STATO_CANALI_INTERAZIONE.ATTIVO
      });
      return {
        utente,
        localUtenteGDO,
        localUtenteCanaliInterazioni
      };
    }
    catch (error) {
      log.error('Impossibile registrare l\'utente con i canali di interazione', error instanceof Error ? error : new Error(String(error)));
      throw new DatabaseError({
        message: 'Errore durante la registrazione dell\'utente con i canali di interazione',
        operation: 'create',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }
  async checkUserByPhone(phone: string): Promise<any> {
    try {
      const user = await this.userRepository.findByPhone(phone);
      return user;
    } catch (error) {
      log.error('Impossibile recuperare l\'utente tramite numero di telefono', error instanceof Error ? error : new Error(String(error)));
      throw new DatabaseError({
        message: 'Errore durante il recupero dell\'utente tramite telefono',
        operation: 'get',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }
  async getUtentiWhatsappAttivi(): Promise<any[]> {
    try {
      const utenti = await this.userRepository.findAllByOptions({
        where: {
          tipo_utenti: { [Op.notIn]: [TIPO_UTENTI.SUPERADMIN, TIPO_UTENTI.GUEST] },
          stato_utenti: STATO_UTENTI.ATTIVO
        }
      });
      return utenti;
    } catch (error) {
      log.error('Impossibile recuperare gli utenti WhatsApp attivi', error instanceof Error ? error : new Error(String(error)));
      throw new DatabaseError({
        message: 'Errore durante il recupero degli utenti WhatsApp attivi',
        operation: 'get',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }
  async createUser(data: CreateUtenteDTO): Promise<UtenteResponseDTO> {
    try {
      if (!data.tipo) {
        throw new ValidationError({
          message: 'Il tipo di utente è obbligatorio',
          field: 'tipo'
        });
      }
      if (!data.password) {
        throw new ValidationError({
          message: 'La password è obbligatoria',
          field: 'password'
        });
      }
      const saltRounds = parseInt(process.env["SALT_ROUNDS"] || '10');
      const hashedPassword = await bcrypt.hash(data.password, saltRounds);
      data.password = hashedPassword;
      const user = await this.userRepository.create(toUtenteAttributes(data));
      return toUtenteResponseDTO(user);
    } catch (error) {
      console.error('Errore durante la creazione dell\'utente:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError({
        message: 'Errore durante la creazione dell\'utente',
        operation: 'create',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async getUserById(id: string): Promise<UtenteResponseDTO | null> {
    try {
      const user = await this.userRepository.findById(id);
      if (!user) {
        return null;
      }
      const userResponseDTO: UtenteResponseDTO = toUtenteResponseDTO(user);
      if (!userResponseDTO) {
        return null;
      }
      return userResponseDTO;
    } catch (error) {
      console.error('Error in getUserById:', error);
      throw error;
    }
  }

  async updateUser(id: string, data: UpdateUtenteDTO): Promise<UtenteResponseDTO | null> {
    try {
      const user = await this.userRepository.findById(id);
      if (!user) {
        return null;
      }
      const updateData = updateUtenteAttributes(data);
      await user.update(updateData);
      return toUtenteResponseDTO(user);
    } catch (error) {
      console.error('Errore durante l\'aggiornamento dell\'utente:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError({
        message: 'Errore durante l\'aggiornamento dell\'utente',
        operation: 'update',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async updateProfile(userId: string, data: UpdateUtenteDTO): Promise<UtenteResponseDTO | null> {
    const utente = await this.userRepository.findById(userId);

    if (!utente) {
      throw new NotFoundError({
        message: 'Utente non trovato',
        entityType: 'Utente',
        entityId: userId
      });
    }

    const updateData = updateUtenteAttributes(data);

    // Gestione speciale per meta_utenti
    if (data.meta) {
      const existingMeta = utente.meta_utenti || {};
      const incomingMeta = data.meta as Record<string, unknown>;
      const updatedMeta: Record<string, unknown> = { ...existingMeta, ...incomingMeta };

      if (Object.prototype.hasOwnProperty.call(incomingMeta, 'photo')) {
        const incomingPhoto = incomingMeta.photo;

        if (incomingPhoto === null || incomingPhoto === '') {
          delete updatedMeta.photo;
        } else if (typeof incomingPhoto === 'string') {
          const extractedPhoto = incomingPhoto.startsWith('data:')
            ? (incomingPhoto.split(',')[1] ?? '')
            : incomingPhoto;
          const normalizedPhoto = extractedPhoto.replace(/\s/g, '');
          const currentPhoto = typeof existingMeta.photo === 'string'
            ? existingMeta.photo.replace(/\s/g, '')
            : undefined;

          if (!normalizedPhoto) {
            delete updatedMeta.photo;
          } else {
            if (normalizedPhoto !== currentPhoto) {
              const photoSize = Buffer.from(normalizedPhoto, 'base64').length;
              if (photoSize > PROFILE_PHOTO_MAX_SIZE_BYTES) {
                throw new ValidationError({
                  message: `La foto profilo non può superare i ${PROFILE_PHOTO_MAX_SIZE_MB}MB`,
                  field: 'meta.photo'
                });
              }
            }

            updatedMeta.photo = normalizedPhoto;
          }
        } else {
          throw new ValidationError({
            message: 'Formato della foto profilo non valido',
            field: 'meta.photo'
          });
        }
      }

      updateData.meta_utenti = updatedMeta as UtentiMeta;
    }

    const result = await utente.update(updateData);
    return toUtenteResponseDTO(result);
  }


  async updateUserGdoAssociation(userId: string, gdoId: string, ruoloId?: string): Promise<void> {
    // Rimuovi l'associazione GDO esistente
    await UtentiGDO.destroy({ where: { id_utente_utentegdo: userId } });

    if (gdoId) {
      const utenteGDOData: any = {
        id_utente_utentegdo: userId,
        id_gdo_utentegdo: gdoId,
      };
      if (ruoloId) {
        utenteGDOData.id_ruolo_utente_gdo = ruoloId;
      }
      await UtentiGDO.create(utenteGDOData);
    }
  }

  async updateUserPuntoVenditaAssociation(userId: string, puntoVenditaId: string): Promise<void> {
    // Rimuovi l'associazione PuntoVendita esistente
    await PuntoVenditaUtenti.destroy({ where: { idutenti_puntivenditautenti: userId } });

    if (puntoVenditaId) {
      await PuntoVenditaUtenti.create({
        idutenti_puntivenditautenti: userId,
        idpuntivendita_puntivenditautenti: puntoVenditaId,
      });
    }
  }

  async refreshMaterializedView(): Promise<void> {
    await sequelize.query(`REFRESH MATERIALIZED VIEW mv_utenti_completi;`);
  }

  async deleteUser(id: string, tipoUtente: string): Promise<boolean> {
    try {
      const tipo = tipoUtente as TIPO_UTENTI;
      if (tipo === TIPO_UTENTI.SUPERADMIN) {
        const result = await this.userRepository.destroyWhere({ where: { id_utenti: id } });
        await sequelize.query(`
          REFRESH MATERIALIZED VIEW mv_utenti_completi;
        `);
        return result > 0;
      } else if (tipo === TIPO_UTENTI.AGENZIA) {
        const result = await this.userRepository.destroyWhere({
          where: {
            id_utenti: id,
            tipo_utenti: { [Op.notIn]: [TIPO_UTENTI.AGENZIA, TIPO_UTENTI.SUPERADMIN] }
          }
        });
        await sequelize.query(`
          REFRESH MATERIALIZED VIEW mv_utenti_completi;
        `);
        return result > 0;
        //TODO: controllare meglio il controllo di questo else if
      } else if (tipo === TIPO_UTENTI.GDO) {
        const result = await this.userRepository.destroyWhere({
          where: {
            id_utenti: id,
            tipo_utenti: { [Op.notIn]: [TIPO_UTENTI.GDO, TIPO_UTENTI.SUPERADMIN, TIPO_UTENTI.PUNTOVENDITA] }
          }
        });
        await sequelize.query(`
          REFRESH MATERIALIZED VIEW mv_utenti_completi;
        `);
        return result > 0;
      } else if (tipo === TIPO_UTENTI.GUEST) {
        throw new ValidationError({
          message: "Non hai i permessi per eliminare un utente di tipo cliente",
          field: 'tipo_utenti'
        });
      }
      return false;
    } catch (error) {
      console.error('Errore durante l\'eliminazione dell\'utente:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError({
        message: 'Errore durante l\'eliminazione dell\'utente',
        operation: 'delete',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async getAllUsers(): Promise<UtenteResponseDTO[]> {
    try {
      const users = await this.userRepository.findAllByOptions({
        attributes: { exclude: ['password_utenti', 'updatedat'] }
      });
      const userPromises = users.map(async (user: UtenteAttributes) => {
        const [canaliInterazione, puntoVenditaUtente] = await Promise.all([
          CanaleInterazione.findAll({
            where: { idutente_canaliinterazione: user.id_utenti }
          }),
          PuntoVenditaUtenti.findOne({
            where: { idutenti_puntivenditautenti: user.id_utenti }
          })
        ]);

        (user as any).canaliInterazione = canaliInterazione;

        if (puntoVenditaUtente) {
          const pv = await PuntoVendita.findOne({
            where: { id_puntivendita: puntoVenditaUtente.idpuntivendita_puntivenditautenti }
          });
          (user as any).puntoVenditaCollegato = {
            id: puntoVenditaUtente.idpuntivendita_puntivenditautenti,
            nome: pv?.nome_puntivendita,
          };
        }
      });

      await Promise.all(userPromises);
      return users.map(user => toUtenteResponseDTO(user));
    } catch (error) {
      console.error('Errore durante il recupero di tutti gli utenti:', error);
      throw new DatabaseError({
        message: 'Errore durante il recupero di tutti gli utenti',
        operation: 'get',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async getUserByEmail(email: string): Promise<UtenteResponseDTO | null> {
    try {
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        return null;
      }
      return toUtenteResponseDTO(user);
    } catch (error) {
      console.error('Errore durante il recupero dell\'utente tramite email:', error);
      throw new DatabaseError({
        message: 'Errore durante il recupero dell\'utente tramite email',
        operation: 'get',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async login(email: string, password: string, selectedUserType?: TIPO_UTENTI): Promise<{ success: boolean; user?: UtenteResponseDTO; message?: string }> {
    try {
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        return { success: false, message: 'Email o password non valide' };
      }

      if (!user.password_utenti) {
        return { success: false, message: 'Email o password non valide' };
      }
      const isPasswordValid = await bcrypt.compare(password, user.password_utenti);
      if (!isPasswordValid) {
        return { success: false, message: 'Email o password non valide' };
      }

      const userResponseDTO = toUtenteResponseDTO(user);

      // Verifica associazione GDO
      const hasGdo = await UtentiGDO.findOne({ where: { id_utente_utentegdo: user.id_utenti } });
      if (checkIfCanLogin(userResponseDTO) == false) {
        return { success: false, message: 'Il tipo di utente selezionato non ha i permessi per il login standard' };
      }
      // GDO obbligatoria per tutti tranne SUPERADMIN
      if (user.tipo_utenti !== TIPO_UTENTI.SUPERADMIN && !hasGdo) {
        return { success: false, message: 'Account non configurato correttamente: associazione GDO mancante. Contattare l\'amministratore.' };
      }

      if (selectedUserType) {
        // Verifica che l'utente abbia effettivamente accesso al tipo selezionato
        if (selectedUserType === TIPO_UTENTI.GDO) {
          if (!hasGdo) {
            return { success: false, message: 'Non hai accesso come utente GDO' };
          }
          return { success: true, user: { ...userResponseDTO, tipo: selectedUserType, id_gdo: hasGdo.id_gdo_utentegdo } };
        }
        else if (selectedUserType === TIPO_UTENTI.PUNTOVENDITA) {
          const utentePuntoVendita = await PuntoVenditaUtenti.findOne({ where: { idutenti_puntivenditautenti: user.id_utenti } });
          if (!utentePuntoVendita) {
            return { success: false, message: 'Non hai accesso come utente Punto Vendita' };
          }
          return { success: true, user: { ...userResponseDTO, tipo: selectedUserType, id_gdo: hasGdo?.id_gdo_utentegdo } };
        }
        else if (selectedUserType === TIPO_UTENTI.SUPERADMIN && user.tipo_utenti === TIPO_UTENTI.SUPERADMIN) {
          return { success: true, user: { ...userResponseDTO, tipo: selectedUserType, id_gdo: hasGdo?.id_gdo_utentegdo } };
        }
        else if (selectedUserType === TIPO_UTENTI.AGENZIA && user.tipo_utenti === TIPO_UTENTI.AGENZIA) {
          return { success: true, user: { ...userResponseDTO, tipo: selectedUserType, id_gdo: hasGdo?.id_gdo_utentegdo } };
        }
        else if (selectedUserType === TIPO_UTENTI.MARKETING && user.tipo_utenti === TIPO_UTENTI.MARKETING) {
          return { success: true, user: { ...userResponseDTO, tipo: selectedUserType, id_gdo: hasGdo?.id_gdo_utentegdo } };
        }
        else if (selectedUserType === TIPO_UTENTI.GUEST && user.tipo_utenti === TIPO_UTENTI.GUEST) {
          return { success: true, user: { ...userResponseDTO, tipo: selectedUserType, id_gdo: hasGdo?.id_gdo_utentegdo } };
        }
        else if (selectedUserType === TIPO_UTENTI.IT && user.tipo_utenti === TIPO_UTENTI.IT) {
          return { success: true, user: { ...userResponseDTO, tipo: selectedUserType, id_gdo: hasGdo?.id_gdo_utentegdo } };
        }
        else if (selectedUserType === TIPO_UTENTI.CATEGORY && user.tipo_utenti === TIPO_UTENTI.CATEGORY) {
          return { success: true, user: { ...userResponseDTO, tipo: selectedUserType, id_gdo: hasGdo?.id_gdo_utentegdo } };
        }
        else {
          return { success: false, message: 'Tipo di utente non valido' };
        }
      } else {
        // Auto-detect tipo utente
        if (user.tipo_utenti === TIPO_UTENTI.SUPERADMIN) {
          return { success: true, user: { ...userResponseDTO, tipo: TIPO_UTENTI.SUPERADMIN, id_gdo: hasGdo?.id_gdo_utentegdo } };
        }
        if (user.tipo_utenti === TIPO_UTENTI.AGENZIA) {
          return { success: true, user: { ...userResponseDTO, tipo: TIPO_UTENTI.AGENZIA, id_gdo: hasGdo?.id_gdo_utentegdo } };
        }

        // MARKETING e GUEST: usa tipo_utenti con id_gdo (non devono essere trattati come GDO)
        if (user.tipo_utenti === TIPO_UTENTI.MARKETING || user.tipo_utenti === TIPO_UTENTI.GUEST) {
          return { success: true, user: { ...userResponseDTO, tipo: user.tipo_utenti, id_gdo: hasGdo?.id_gdo_utentegdo } };
        }
        const hasPuntoVendita = await PuntoVenditaUtenti.findOne({ where: { idutenti_puntivenditautenti: user.id_utenti } });
        if (hasGdo && !hasPuntoVendita) {
          return { success: true, user: { ...userResponseDTO, tipo: TIPO_UTENTI.GDO, id_gdo: hasGdo.id_gdo_utentegdo } };
        }
        if (hasPuntoVendita && hasGdo) {
          return { success: true, user: { ...userResponseDTO, tipo: TIPO_UTENTI.PUNTOVENDITA, id_gdo: hasGdo?.id_gdo_utentegdo } };
        }
        return { success: true, user: userResponseDTO };
      }
    } catch (error) {
      throw new DatabaseError({
        message: 'Errore durante il login',
        operation: 'get',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async checkLoginForMultipleUsers(email: string, password: string): Promise<{ users: UtenteResponseDTO[], message: string, gdoBlockedByIstanta: boolean }> {
    try {
      const utenteSingolo = await this.userRepository.findByEmail(email);
      if (!utenteSingolo || !utenteSingolo.password_utenti) {
        throw new NotFoundError({
          message: 'Credenziali non valide',
          entityType: 'Utente',
          entityId: email
        });
      }

      const isPasswordValid = await bcrypt.compare(password, utenteSingolo.password_utenti);
      if (!isPasswordValid) {
        throw new NotFoundError({
          message: 'Credenziali non valide',
          entityType: 'Utente',
          entityId: email
        });
      }

      const utentePuntoVendita = await PuntoVenditaUtenti.findOne({ where: { idutenti_puntivenditautenti: utenteSingolo.id_utenti } });
      const utenteGDO = await UtentiGDO.findOne({ where: { id_utente_utentegdo: utenteSingolo.id_utenti } });
      const utenteIsGDO = utenteSingolo.tipo_utenti == TIPO_UTENTI.GDO;
      let utenti: (UtenteAttributes & { page_to_land?: string })[] = []
      if (
        utenteSingolo.tipo_utenti !== TIPO_UTENTI.GUEST &&
        utenteSingolo.tipo_utenti !== TIPO_UTENTI.GDO &&
        utenteSingolo.tipo_utenti !== TIPO_UTENTI.PUNTOVENDITA
      ) {
        utenti.push({
          ...utenteSingolo.toJSON(),
          page_to_land: '/hub'
        });
      }
      // Regola blocco AD (priorità decrescente):
      // 1. need_ad === false → login normale sempre consentito (override esplicito)
      // 2. need_ad === true  → sempre richiesto Istanta
      // 3. need_ad === undefined → si applica la config globale AD_TENANT_ID
      const metaNeedAd = utenteSingolo.meta_utenti?.need_ad;
      const gdoBlockedByIstanta = metaNeedAd === true
        || (metaNeedAd !== false && !!(utenteGDO && utenteIsGDO && config.AD_TENANT_ID != null));
      if (utenteGDO && utenteIsGDO && !gdoBlockedByIstanta) {
        utenti.push({
          ...utenteSingolo.toJSON(),
          tipo_utenti: TIPO_UTENTI.GDO,
          page_to_land: '/hub'
        });
      }
      if (utentePuntoVendita) {
        utenti.push({
          ...utenteSingolo.toJSON(),
          tipo_utenti: TIPO_UTENTI.PUNTOVENDITA,
          page_to_land: '/hub'
        });
      }

      const utentiRispostaDTO: (UtenteResponseDTO & { page_to_land?: string })[] = utenti.map((utente) => {
        return {
          id: utente.id_utenti,
          outsider: utente.outsider_utenti || false,
          nome: utente.nome_utenti || '',
          cognome: utente.cognome_utenti || '',
          email: utente.email_utenti || '',
          datadinascita: utente.datadinascita_utenti,
          residenza: utente.residenza_utenti,
          tipo: utente.tipo_utenti,
          stato: utente.stato_utenti || STATO_UTENTI.ATTIVO,
          sesso: utente.sesso_utenti,
          telefono: utente.telefono_utenti,
          createdat: utente.createdat,
          updatedat: utente.updatedat || new Date(),
          meta: utente.meta_utenti,
          nome_completo: `${utente.nome_utenti || ''} ${utente.cognome_utenti || ''}`.trim(),
          eta: utente.datadinascita_utenti ? Math.floor((new Date().getTime() - new Date(utente.datadinascita_utenti).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : undefined,
          is_attivo: utente.stato_utenti === STATO_UTENTI.ATTIVO,
          is_admin: utente.tipo_utenti === TIPO_UTENTI.SUPERADMIN,
          id_gdo: utenteGDO?.id_gdo_utentegdo,
          page_to_land: utente.page_to_land || ""
        }
      })

      return { users: utentiRispostaDTO, message: 'Utenti trovati', gdoBlockedByIstanta };
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      console.error('Errore durante il login per più utenti:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError({
        message: 'Errore durante il login per più utenti',
        operation: 'get',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }
  async register(userData: any): Promise<UtenteResponseDTO> {
    try {
      if (!userData.password_utenti) {
        throw new ValidationError({
          message: 'La password è obbligatoria',
          field: 'password_utenti'
        });
      }
      const saltRounds = parseInt(process.env["SALT_ROUNDS"] || '10');
      const hashedPassword = await bcrypt.hash(userData.password_utenti, saltRounds);
      userData.password_utenti = hashedPassword;
      const user = await this.userRepository.create(userData);
      return toUtenteResponseDTO(user);
    } catch (error) {
      console.error('Errore durante la registrazione dell\'utente:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError({
        message: 'Errore durante la registrazione dell\'utente',
        operation: 'create',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    try {
      if (!newPassword || newPassword.length < 6) {
        throw new ValidationError({
          message: 'La password deve contenere almeno 6 caratteri',
          field: 'password'
        });
      }

      const saltRounds = parseInt(process.env["SALT_ROUNDS"] || '10');
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      const updatedRows = await this.userRepository.updateWhere(
        { password_utenti: hashedPassword },
        { where: { id_utenti: userId } }
      );

      return updatedRows > 0;
    } catch (error) {
      console.error('Errore durante l\'aggiornamento della password:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError({
        message: 'Errore durante l\'aggiornamento della password',
        operation: 'update',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async verifyAndUpdatePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const utente = await this.userRepository.findById(userId);

    if (!utente) {
      throw new NotFoundError({ message: 'Utente non trovato', entityType: 'Utente', entityId: userId });
    }

    if (utente.outsider_utenti === true) {
      throw new ForbiddenError({ message: 'Gli utenti con autenticazione esterna non possono cambiare la password' });
    }

    if (!utente.password_utenti) {
      throw new ForbiddenError({ message: 'Gli utenti con autenticazione esterna non possono cambiare la password' });
    }

    const isMatch = await bcrypt.compare(currentPassword, utente.password_utenti);
    if (!isMatch) {
      throw new ValidationError({ message: 'La password attuale non è corretta', field: 'currentPassword' });
    }

    return this.updatePassword(userId, newPassword);
  }

  async getAllUtentiOperatori(userId: string): Promise<UtenteResponseDTO[]> {
    try {
      const allUsers = await this.getAllUsers();
      return allUsers.filter(user =>
        user.id !== userId &&
        user.tipo === TIPO_UTENTI.SUPERADMIN
      );
    } catch (error) {
      console.error('Errore durante il recupero degli utenti operatori:', error);
      throw new DatabaseError({
        message: 'Errore durante il recupero degli utenti operatori',
        operation: 'get',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async get_all_utenti(userId: string): Promise<UtenteResponseDTO[]> {
    try {
      const me = await this.getUserById(userId);
      if (!me) {
        throw new NotFoundError({
          message: 'Utente non trovato',
          entityType: 'Utente',
          entityId: userId
        });
      }

      const allUsers = await this.userRepository.findAllByOptions({
        where: {
          id_utenti: {
            [Op.not]: [me.id]
          },
          outsider_utenti: false
        },
        // include: [
        //   {
        //     model: CanaleInterazione,
        //     as: 'canaliInterazione',
        //     required: false
        //   }
        // ]
      });
      return allUsers.map(user => {
        return {
          ...toUtenteResponseDTO(user),
          canaliInterazione: (user as any).canaliInterazione || []
        }
      });
    } catch (error) {
      console.error('Errore durante il recupero di tutti gli utenti:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError({
        message: 'Errore durante il recupero di tutti gli utenti',
        operation: 'get',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async get_all_account(userId: string): Promise<any[]> {
    try {
      const me = await this.getUserById(userId);
      if (!me) {
        throw new NotFoundError({
          message: 'Utente non trovato',
          entityType: 'Utente',
          entityId: userId
        });
      }
      const users = await this.userRepository.findAllByOptions({
        where: { email_utenti: me.email }
      });
      return users.map(user => ({
        id: user.id_utenti,
        email: user.email_utenti,
        tipo: user.tipo_utenti,
        nome: user.nome_utenti,
        cognome: user.cognome_utenti,
        photo: user.meta_utenti?.photo ?? ""
      }));
    } catch (error) {
      console.error('Errore durante il recupero di tutti gli account:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError({
        message: 'Errore durante il recupero di tutti gli account',
        operation: 'get',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async resolveGdoRuoloKey(userId: string): Promise<string | undefined> {
    const ruoloUtenteGDO = await UtentiGDO.findOne({
      where: { id_utente_utentegdo: userId }
    });
    if (ruoloUtenteGDO) {
      const ruoloGDO = await RuoloUtenteGDO.findOne({
        where: { id_ruolo_utente_gdo: ruoloUtenteGDO.id_ruolo_utente_gdo }
      });
      return ruoloGDO?.ruolo_ruolo_utente_gdo
        ? 'GDO_' + ruoloGDO.ruolo_ruolo_utente_gdo
        : undefined;
    }
    return undefined;
  }

  async user_menu(userId: string, tipoUtente: TIPO_UTENTI): Promise<any> {
    try {
      let ruoloGdoKey: string | undefined;

      if (tipoUtente !== TIPO_UTENTI.SUPERADMIN) {
        ruoloGdoKey = await this.resolveGdoRuoloKey(userId);
      }

      // Usa MenuService se disponibile, altrimenti fallback a JSON
      if (this.menuService) {
        const menuUtente = await this.menuService.getMenuPerUtente(tipoUtente, ruoloGdoKey);

        if (!menuUtente || (Array.isArray(menuUtente) && menuUtente.length === 0)) {
          throw new NotFoundError({
            message: 'Menu non definito per il tipo di utente',
            entityType: 'Menu',
            entityId: tipoUtente
          });
        }

        return menuUtente;
      }

      // Fallback: lettura da file JSON
      const pathPerMenu = path.join(process.cwd(), 'config', 'menu.json');
      const menuParsed = JSON.parse(fs.readFileSync(pathPerMenu, 'utf8')) as MenuStructure;

      let menuUtente: MenuElement[] | GdoMenuStructure = [];
      if (tipoUtente === TIPO_UTENTI.GDO) {
        menuUtente = menuParsed["TIPO_UTENTI"].GDO[ruoloGdoKey || 'GDO_ADMIN'];
      } else {
        const menuKey = tipoUtente.toUpperCase();
        if (menuParsed.TIPO_UTENTI.hasOwnProperty(menuKey)) {
          menuUtente = menuParsed.TIPO_UTENTI[menuKey as keyof typeof menuParsed.TIPO_UTENTI];
        } else {
          throw new NotFoundError({
            message: 'Menu non definito per il tipo di utente',
            entityType: 'Menu',
            entityId: tipoUtente,
          });
        }
      }
      if (!menuUtente) {
        throw new NotFoundError({
          message: 'Menu non definito per il tipo di utente',
          entityType: 'Menu',
          entityId: tipoUtente
        });
      }

      return menuUtente;
    } catch (error) {
      console.error('Errore durante il recupero del menu per utente:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError({
        message: 'Errore durante il recupero del menu per utente',
        operation: 'get',
        entity: 'Menu',
        cause: error instanceof Error ? error : undefined
      });
    }
  }


  /**
   * Mappa pathname del menu -> codice permesso pagina.
   * Usata per filtrare le singole voci del menu in base ai permessi dell'utente.
   */
  private static MENU_PATHNAME_PERMISSIONS: Record<string, string> = {
    '/gdo/dashboard': 'pagina.dashboard',
    '/superadmin/dashboard': 'pagina.superadmin_dashboard',
    '/profilo-utente': 'pagina.profilo_utente',
    '/barcode-reader': 'pagina.barcode_reader',
    '/competitor-analyzer': 'pagina.competitor_analyzer',
    // Promozioni
    '/promozioni': 'pagina.promozioni',
    '/promozioni/nuova': 'pagina.nuova_lavorazione',
    '/promozioni/in-corso': 'pagina.lavorazioni_in_corso',
    '/promozioni/storico': 'pagina.storico_lavorazioni',
    // Volantini
    '/volantini': 'pagina.volantini',
    '/storico-volantini': 'pagina.storico_volantini',
    // Materiali
    '/materiali-attivi': 'pagina.materiali_attivi',
    '/materiali-in-corso': 'pagina.materiali_in_corso',
    '/storico-materiali': 'pagina.storico_materiali',
    '/contenuti-digitali': 'pagina.contenuti_digitali',
    // Ordini di Stampa
    '/nuovo-ods': 'pagina.nuovo_ods',
    '/ods-in-corso': 'pagina.ods_in_corso',
    '/ods-completati': 'pagina.ods_completati',
    // WebPliant
    '/webliant/impostazioni-webpliant': 'pagina.impostazioni_webpliant',
    '/webliant/webpliant-disponibili': 'pagina.webpliant_disponibili',
    // Servizi
    '/aree-e-canali': 'pagina.aree_e_canali',
    '/punti-vendita': 'pagina.punti_vendita',
    '/gestione-ricette': 'pagina.gestione_ricette',
    '/gestione-approfondimento-vini': 'pagina.gestione_vini',
    // Impostazioni
    '/impostazioni-tipografia': 'pagina.impostazioni_tipografia',
    '/impostazioni-di-produzione': 'pagina.impostazioni_produzione',
    '/gestione-pagine-singular': 'pagina.gestione_pagine_singular',
    '/gestione-permessi': 'pagina.gestione_permessi',
    '/gestione-hub': 'pagina.gestione_hub',
    // Utenti
    '/gestione-utenti': 'pagina.gestione_utenti',
    // WhatsApp
    '/whatsapp/invio-campagna-whatsapp': 'pagina.invio_campagna_whatsapp',
    '/whatsapp/campagne-whatsapp': 'pagina.campagne_whatsapp',
    '/whatsapp/business-chat': 'pagina.business_chat',
    '/whatsapp/gestione-whatsapp-superadmin': 'pagina.gestione_whatsapp_superadmin',
    '/gestione-whatsapp-admin': 'pagina.gestione_whatsapp_admin',
    // API & Docs
    '/gestione-api/statistiche': 'pagina.gestione_api',
    '/gestione-api/test': 'pagina.gestione_api',
    '/gestione-api/keys': 'pagina.gestione_api',
    '/gestione-api/plugin': 'pagina.gestione_api',
    '/gestione-webhook': 'pagina.gestione_webhook',
    '/documentazione': 'pagina.documentazione',
  };

  private async filterMenuByPermissions(menu: MenuElement[], userId: string): Promise<MenuElement[]> {
    try {
      const { PermessiService } = await import('./PermessiService');
      const { PermessiRepository } = await import('../repositories/PermessiRepository');
      const service = new PermessiService(new PermessiRepository());
      const permessiUtente = await service.getPermessiUtente(userId);

      const filtered: MenuElement[] = [];
      let lastWasHeader = false;

      for (const item of menu) {
        if (typeof item === 'string') {
          // E' un header di sezione — aggiungiamo provvisoriamente e rimuoviamo se vuoto dopo
          filtered.push(item);
          lastWasHeader = true;
        } else {
          // E' una voce di menu con pathname
          const pathname = (item as any).pathname as string | undefined;
          if (pathname) {
            const permCode = UserService.MENU_PATHNAME_PERMISSIONS[pathname];
            // Se non ha un permesso mappato, lo mostra sempre; se ha un permesso, verifica
            if (!permCode || permessiUtente.includes(permCode)) {
              filtered.push(item);
              lastWasHeader = false;
            }
          } else {
            filtered.push(item);
            lastWasHeader = false;
          }
        }
      }

      // Rimuovi header di sezione rimasti orfani (senza voci sotto)
      const cleaned: MenuElement[] = [];
      for (let i = 0; i < filtered.length; i++) {
        if (typeof filtered[i] === 'string') {
          // Verifica se la prossima voce e un'altra stringa o fine array (= sezione vuota)
          const next = filtered[i + 1];
          if (next !== undefined && typeof next !== 'string') {
            cleaned.push(filtered[i]);
          }
        } else {
          cleaned.push(filtered[i]);
        }
      }

      return cleaned;
    } catch (error) {
      console.error('Errore nel filtraggio menu per permessi, restituisco menu completo:', error);
      return menu;
    }
  }

  async generaNuovaSessioneWebpliant(meta: any): Promise<any> {
    try {
      const result = await UtentiAnonimi.create({
        meta_utenti_anonimi: meta || {}
      });
      return result.id_utenti_anonimi;
    } catch (error) {
      console.error('Errore durante la generazione di una nuova sessione Webpliant:', error);
      throw new DatabaseError({
        message: 'Errore durante la generazione di una nuova sessione Webpliant',
        operation: 'create',
        entity: 'UtentiAnonimi',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async generaNuovoInserimentoWishlistWebpliant(wishlistData: {
    idCanale: string;
    idArea: string;
    idPv: string | null;
    idWorkspace: string;
    idPagina: string;
    meta: any;
  }): Promise<any> {
    try {
      if (!wishlistData.idCanale || !wishlistData.idArea || !wishlistData.idWorkspace || !wishlistData.idPagina) {
        throw new ValidationError({
          message: 'Dati di inserimento non validi',
          field: 'wishlistData'
        });
      }
      if (wishlistData.idPv == "") {
        wishlistData.idPv = null;
      }
      // Riscrittura per rispettare la convenzione snake_case e gestire idpv vuoto come stringa vuota
      const result = await WishlistWebpliant.create({
        idcanale_whishlistwepliant: wishlistData.idCanale,
        idarea_whishlistwepliant: wishlistData.idArea,
        idpv_whishlistwepliant: wishlistData.idPv,
        meta_whishlistwepliant: wishlistData.meta,
        idworkspace_whishlistwepliant: wishlistData.idWorkspace,
        idpagina_whishlistwepliant: wishlistData.idPagina
      });
      return result.id_whishlistwepliant;
    } catch (error) {
      console.error('Errore durante la creazione di un nuovo inserimento nella wishlist Webpliant:', error);
      throw new DatabaseError({
        message: 'Errore durante la creazione di un nuovo inserimento nella wishlist Webpliant',
        operation: 'create',
        entity: 'WishlistWebpliant',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async getAllReferenzeFromWishlistId(id: string): Promise<any[]> {
    try {
      const result = await WishlistWebpliant.findOne({
        where: { id_whishlistwepliant: id }
      });
      if (!result) {
        return [];
      }
      return result?.meta_whishlistwepliant?.referenze || [];
    } catch (error) {
      console.error('Errore durante il recupero delle referenze dalla wishlist:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError({
        message: 'Errore durante il recupero delle referenze dalla wishlist',
        operation: 'get',
        entity: 'WishlistWebpliant',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async getParamsWishlistId(id: string): Promise<{
    idArea: string;
    idCanale: string;
    idPv: string;
    idWorkspace: string;
    idPagina: string;
  }> {
    try {
      const result = await WishlistWebpliant.findOne({
        where: { id_whishlistwepliant: id }
      });
      if (!result) {
        throw new NotFoundError({
          message: 'Wishlist non trovata',
          entityType: 'WishlistWebpliant',
          entityId: id
        });
      }
      return {
        idArea: result?.idarea_whishlistwepliant || '',
        idCanale: result?.idcanale_whishlistwepliant || '',
        idPv: result?.idpv_whishlistwepliant || '',
        idWorkspace: result?.idworkspace_whishlistwepliant || '',
        idPagina: result?.idpagina_whishlistwepliant || ''
      };
    } catch (error) {
      console.error('Errore durante il recupero dei parametri della wishlist:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError({
        message: 'Errore durante il recupero dei parametri della wishlist',
        operation: 'get',
        entity: 'WishlistWebpliant',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async getURLWebpliant(id: string): Promise<string> {
    try {
      const result = await WishlistWebpliant.findOne({
        where: { id_whishlistwepliant: id }
      });
      if (!result) {
        throw new NotFoundError({
          message: 'Wishlist non trovata',
          entityType: 'WishlistWebpliant',
          entityId: id
        });
      }
      if (!result?.meta_whishlistwepliant?.URL_WEBPLIANT) {
        throw new NotFoundError({
          message: 'URL non trovato per la wishlist specificata',
          entityType: 'WishlistWebpliant',
          entityId: id
        });
      }
      return result.meta_whishlistwepliant.URL_WEBPLIANT;
    } catch (error) {
      console.error('Errore durante il recupero dell\'URL Webpliant:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError({
        message: 'Errore durante il recupero dell\'URL Webpliant',
        operation: 'get',
        entity: 'WishlistWebpliant',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async checkWishlistId(id: string, idArea: string, idCanale: string, idPv: string): Promise<boolean> {
    try {
      const result = await WishlistWebpliant.findOne({
        where: {
          id_whishlistwepliant: id,
          idarea_whishlistwepliant: idArea,
          idcanale_whishlistwepliant: idCanale
        }
      });
      return result !== null;
    } catch (error) {
      console.error('Errore durante il controllo dell\'ID wishlist:', error);
      throw new DatabaseError({
        message: 'Errore durante il controllo dell\'ID wishlist',
        operation: 'check',
        entity: 'WishlistWebpliant',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async insertReferenzaInWishlist(idWishList: string, referenza: any): Promise<any> {
    try {
      const wishlist = await WishlistWebpliant.findOne({
        where: { id_whishlistwepliant: idWishList }
      });
      if (!wishlist) {
        throw new NotFoundError({
          message: 'Wishlist non trovata',
          entityType: 'WishlistWebpliant',
          entityId: idWishList
        });
      }

      const referenze: DataFields[] = wishlist.meta_whishlistwepliant?.referenze || [];
      // Controllo più robusto per trovare la referenza: verifica che dataFields esista e che il codice sia definito
      const existingReferenza = referenze.find((ref) => {
        if (!ref || !ref.codice_referenza || !referenza?.codice_referenza) return false;
        // Confronto in modo stringa per evitare problemi di tipo
        return String(ref.codice_referenza) === String(referenza.codice_referenza);
      });

      if (existingReferenza) {
        Object.assign(existingReferenza, referenza);
      } else {
        referenze.push(referenza);
      }

      await WishlistWebpliant.update(
        {
          meta_whishlistwepliant: {
            ...wishlist.meta_whishlistwepliant,
            referenze
          }
        },
        { where: { id_whishlistwepliant: idWishList } }
      );

      return true;
    } catch (error) {
      console.error('Errore durante l\'inserimento della referenza nella wishlist:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError({
        message: 'Errore durante l\'inserimento della referenza nella wishlist',
        operation: 'update',
        entity: 'WishlistWebpliant',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async deleteWishlistItem(wishlistId: string, codice: string): Promise<any> {
    try {
      const wishlist = await WishlistWebpliant.findOne({
        where: { id_whishlistwepliant: wishlistId }
      });
      if (!wishlist) {
        throw new NotFoundError({
          message: 'Wishlist non trovata',
          entityType: 'WishlistWebpliant',
          entityId: wishlistId
        });
      }

      const referenze: DataFields[] = wishlist.meta_whishlistwepliant?.referenze || [];
      // Filtro più robusto: confronto come stringa per evitare problemi di tipo
      const updatedReferenze = referenze.filter((ref) => {
        if (!ref || !ref.codice_referenza) return true;
        return String(ref.codice_referenza) !== String(codice);
      });
      await WishlistWebpliant.update(
        { meta_whishlistwepliant: { referenze: updatedReferenze } },
        { where: { id_whishlistwepliant: wishlistId } }
      );

      return true;
    } catch (error) {
      console.error('Errore durante l\'eliminazione dell\'elemento dalla wishlist:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError({
        message: 'Errore durante l\'eliminazione dell\'elemento dalla wishlist',
        operation: 'delete',
        entity: 'WishlistWebpliant',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async registerUtentePuntoVendita(idUtente: string, idPuntoVendita: string): Promise<any> {
    try {
      const puntoVenditaUtente = await PuntoVenditaUtenti.create({
        idutenti_puntivenditautenti: idUtente,
        idpuntivendita_puntivenditautenti: idPuntoVendita
      });
      return puntoVenditaUtente;
    } catch (error) {
      console.error('Errore durante la registrazione dell\'utente al punto vendita:', error);
      throw new DatabaseError({
        message: 'Errore durante la registrazione dell\'utente al punto vendita',
        operation: 'create',
        entity: 'PuntoVenditaUtenti',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async registerUtenteGDO(utenteGDO: UtentiGDOAttributes): Promise<any> {
    try {
      const resultCreazioneUtenteGDO = await UtentiGDO.create({
        id_utente_utentegdo: utenteGDO.id_utente_utentegdo,
        id_gdo_utentegdo: utenteGDO.id_gdo_utentegdo,
      });
      return resultCreazioneUtenteGDO;
    } catch (error) {
      console.error('Errore durante la registrazione dell\'utente alla GDO:', error);
      throw new DatabaseError({
        message: 'Errore durante la registrazione dell\'utente alla GDO',
        operation: 'create',
        entity: 'UtentiGDO',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async registerUserWithTransaction(userData: {
    email: string;
    nome: string;
    cognome: string;
    password?: string;
    tipo: TIPO_UTENTI;
    stato: string;
    residenza: string;
    dataDiNascita: string;
    gdoScelta?: string;
    idPuntoVendita?: string;
    id_ruolo_utente_gdo?: string;
    telefono?: string;
    sesso?: string;
    meta?: UtentiMeta;
  }, currentUserId: string): Promise<UtenteAttributes> {
    const transaction = await sequelize.transaction();

    try {
      console.log('registerUserWithTransaction - Start', {
        userData: { ...userData, password: '***HIDDEN***' },
        currentUserId
      });

      // Validazione campi obbligatori
      if (!userData.email || !userData.nome || !userData.cognome ||
        !userData.tipo || !userData.stato || !userData.residenza || !userData.dataDiNascita) {
        console.log('registerUserWithTransaction - Missing required fields');
        throw new ValidationError({
          message: 'Dati non validi',
          field: 'userData'
        });
      }

      let gdoScelta = userData.gdoScelta;
      let idRuoloGDO: string | undefined = undefined;

      // Tutti i tipi tranne SUPERADMIN richiedono associazione GDO
      const requiresGdo = userData.tipo !== TIPO_UTENTI.SUPERADMIN;

      if (requiresGdo) {
        if (gdoScelta) {
          const gdoExists = await GDO.findOne({
            where: {
              id_gdo: gdoScelta
            }
          });
          if (!gdoExists) {
            throw new ValidationError({
              message: "GDO non trovata",
              field: 'gdoScelta'
            });
          }
        } else {
          const findGdo = await GDO.findOne();
          if (!findGdo) {
            throw new ValidationError({
              message: "Nessuna GDO disponibile nel sistema",
              field: 'gdoScelta'
            });
          }
          gdoScelta = findGdo.id_gdo;
        }

        if (userData.id_ruolo_utente_gdo) {
          const findRuoloGDO = await RuoloUtenteGDO.findOne({
            where: {
              id_ruolo_utente_gdo: userData.id_ruolo_utente_gdo
            },
          });
          if (!findRuoloGDO) {
            throw new ValidationError({
              message: "Ruolo GDO non trovato",
              field: 'id_ruolo_utente_gdo'
            });
          }
          idRuoloGDO = findRuoloGDO.id_ruolo_utente_gdo;
        }
      }

      // Validazioni specifiche per tipo utente
      if (requiresGdo && !gdoScelta) {
        console.log('registerUserWithTransaction - User type requires gdoScelta', { tipo: userData.tipo });
        throw new ValidationError({
          message: "Tutti gli utenti (escluso Superadmin) devono essere associati a una GDO",
          field: 'gdoScelta'
        });
      }


      if (userData.tipo === TIPO_UTENTI.PUNTOVENDITA && !userData.idPuntoVendita) {
        console.log('registerUserWithTransaction - PUNTOVENDITA user type requires idPuntoVendita');
        throw new ValidationError({
          message: "Dati non validi, un'utente Punto Vendita deve essere associato ad un Punto Vendita",
          field: 'idPuntoVendita'
        });
      }
      let pos: { lat: number; lon: number } | null = null;
      // Se è presente l'indirizzo allora cercare le posizioni lat long
      if (userData.residenza) {
        const posizione = await geocodeAddress(userData.residenza);
        if (posizione) {
          console.log('registerUserWithTransaction - Geocoding successful', { posizione });
          pos = posizione;
        } else {
          console.log('registerUserWithTransaction - Geocoding failed for address', { address: userData.residenza });
        }
      }

      // Creazione utente
      const utente: any = {
        //normalizziamo da qui l'email
        email_utenti: userData.email.toLowerCase(),
        password_utenti: userData.password ?? null,
        meta_utenti: userData.meta ?? null,
        nome_utenti: userData.nome,
        cognome_utenti: userData.cognome,
        tipo_utenti: userData.tipo,
        stato_utenti: userData.stato as STATO_UTENTI,
        residenza_utenti: userData.residenza,
        datadinascita_utenti: new Date(userData.dataDiNascita),
        outsider_utenti: false,
        telefono_utenti: userData.telefono || null,
        sesso_utenti: userData.sesso || null,
        lat_utenti: pos ? pos.lat : null,
        lon_utenti: pos ? pos.lon : null,
      };

      console.log('registerUserWithTransaction - Creating user', {
        utente: { ...utente, password_utenti: '***HIDDEN***' }
      });

      // Hash della password (solo se fornita — gli utenti OIDC non hanno password locale)
      if (utente.password_utenti) {
        const saltRounds = parseInt(process.env["SALT_ROUNDS"] || '10');
        utente.password_utenti = await bcrypt.hash(utente.password_utenti, saltRounds);
      }

      const result = await this.userRepository.createWithOptions(utente, { transaction });
      console.log('registerUserWithTransaction - User created', { userId: result.id_utenti });

      // Pulizia dati sensibili
      if (result.dataValues) {
        delete result.dataValues.privatekey_utenti;
        delete result.dataValues.password_utenti;
      }

      // Registrazione come PUNTOVENDITA se necessario
      if (userData.tipo === TIPO_UTENTI.PUNTOVENDITA && userData.idPuntoVendita) {
        console.log('registerUserWithTransaction - Registering user as PUNTOVENDITA', {
          userId: result.id_utenti,
          idPuntoVendita: userData.idPuntoVendita
        });
        await PuntoVenditaUtenti.create({
          idutenti_puntivenditautenti: result.id_utenti,
          idpuntivendita_puntivenditautenti: userData.idPuntoVendita
        }, { transaction });
        console.log('registerUserWithTransaction - User registered as PUNTOVENDITA successfully');
      }

      // Creazione associazione UtentiGDO per tutti i tipi tranne SUPERADMIN
      if (requiresGdo && gdoScelta) {
        console.log('registerUserWithTransaction - Creating UtentiGDO association', {
          userId: result.id_utenti,
          gdoScelta,
          idRuoloGDO,
          tipoUtente: userData.tipo
        });
        const utenteGDOData: any = {
          id_utente_utentegdo: result.id_utenti,
          id_gdo_utentegdo: gdoScelta
        };

        // Aggiungi il ruolo solo se presente
        if (idRuoloGDO) {
          utenteGDOData.id_ruolo_utente_gdo = idRuoloGDO;
        }

        await UtentiGDO.create(utenteGDOData, { transaction });
        console.log('registerUserWithTransaction - UtentiGDO association created successfully');
      }

      // Creazione activity log
      console.log('registerUserWithTransaction - Creating activity log');
      const utenteToSend = { ...utente };
      delete utenteToSend.password_utenti;
      await ServerUtils.CREA_ATTIVITA(
        currentUserId,
        TIPO_ATTIVITA.CREAZIONE_UTENTE,
        CATEGORIA_ATTIVITA.ACCOUNT,
        { ...utenteToSend });
      console.log('registerUserWithTransaction - Activity log created');

      // Commit della transazione
      //NOTE: in questo momento per la gestione degli utenti usiamo un materialize view
      //NOTE: quindi quello che dobbiamo fare è aggiornare il materialize view
      await sequelize.query(`
        REFRESH MATERIALIZED VIEW mv_utenti_completi;
      `, { transaction });
      await transaction.commit();
      console.log('registerUserWithTransaction - Transaction committed successfully');
      return result;
    } catch (error) {
      // Rollback della transazione in caso di errore
      await transaction.rollback();
      console.error('registerUserWithTransaction - Transaction rolled back due to error:', error);

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new DatabaseError({
        message: 'Errore durante la registrazione dell\'utente',
        operation: 'create',
        entity: 'Utente',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async autenticaUtenteAD(req: Request): Promise<any> {
    let context = req.query.context as string;
    if (!context) {
      throw new ValidationError({
        message: 'Context non trovato',
        field: 'context'
      });
    }

    context = context.replace(/ /g, '+');

    const secret = process.env.FICO_SECRET || '';
    try {
      const decryptedText = decryptString(context, secret);
      const data = JSON.parse(decryptedText) as {
        tenantId: string;
        tokenAD: string;
        queryParams: Record<string, string>;
      };

      // 1. Verifica tenantId
      if (data.tenantId !== config.AD_TENANT_ID) {
        throw new ValidationError({
          message: 'Tenant non corrispondente',
          field: 'tenantId'
        });
      }

      // 2. Estrai email e trova utente esistente
      const emailDaToLower = data.queryParams?.email;
      if (!emailDaToLower) {
        throw new ValidationError({
          message: 'Email non trovata nel payload',
          field: 'email'
        });
      }
      const email = emailDaToLower.toLowerCase();
      // const email = emailDaToLower;
      const user = await this.userRepository.findOneByOptions({
        where: {
          email_utenti: email,
          stato_utenti: STATO_UTENTI.ATTIVO
        }
      });
      const saveSession = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              console.error('Session save error:', err);
              reject(err);
            } else {
              console.log('Session saved successfully, session ID:', req.sessionID);
              resolve();
            }
          });
        });
      };

      if (!user) {
        // throw new NotFoundError({
        //   message: 'user_not_found',
        //   entityType: 'Utente'
        // });
        //NOTE dobbiamo crearlo nuovo
        //HACK per ora con dei campi estremamente statici.
        const gdo = await GDO.findOne()
        const newUser = await this.registerUserWithTransaction({
          tipo: TIPO_UTENTI.GDO,
          nome: "Test",
          cognome: "Test",
          email,
          password: "Test1234@",
          stato: STATO_UTENTI.ATTIVO,
          residenza: "Rotonda della Pace, 56121 Pisa PI",
          dataDiNascita: new Date().toISOString().split('T')[0],
          gdoScelta: gdo.id_gdo,
          id_ruolo_utente_gdo: "4f1444d9-b92e-4de7-a1bf-f28325ee360e",
          meta: { need_ad: true }
        }, "f063eb66-2512-408e-a92c-4ef0e6178640")
        req.session.id_utente = newUser.id_utenti;
        req.session.tipo_utente = newUser.tipo_utenti;
        req.session.email = newUser.email_utenti;
        req.session.private_key = newUser.privatekey_utenti;
        req.session.cookie.maxAge = 60 * 60 * 1000; // 1 ora
        req.session.isExternalAuth = true;
        await saveSession();
      } else {
        // 3. Segna l'utente come AD se non già segnato
        if (!user.meta_utenti?.need_ad) {
          await user.update({ meta_utenti: { ...user.meta_utenti, need_ad: true } });
        }
        // 4. Imposta sessione
        req.session.id_utente = user.id_utenti;
        req.session.tipo_utente = user.tipo_utenti;
        req.session.email = user.email_utenti;
        req.session.private_key = user.privatekey_utenti;
        req.session.cookie.maxAge = 60 * 60 * 1000; // 1 ora
        req.session.isExternalAuth = true;
        await saveSession();
      }




      // 4. Chiama AuthADLanded su IS con tokenAD nell'header ADToken per verifica e invalidazione
      try {
        const response = await ServerUtils.sendToFICOApi<{
          esito: boolean;
          error?: "token_expired" | "user_not_found" | "no_token";
        }>(
          req,
          config.ISTANTA_IP_ADDRESS + "/FicoProcess/AuthADLanded",
          "GET",
          {},
          {
            "ADToken": data.tokenAD
          }
        );

        if (response.data.esito) {
          return { route: "/", queryParams: {} };
        } else {
          // IS ha rifiutato: restituiamo il codice errore al frontend senza lanciare eccezione
          return { isError: true, errorCode: response.data.error ?? "auth_failed" };
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        console.error('AuthADLanded request failed:', error);
        throw new ValidationError({
          message: 'Autenticazione AD fallita',
          field: 'context'
        });
      }
    } catch (error) {
      console.error('autenticaUtenteAD failed:', error);
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new ValidationError({
        message: 'Decriptazione fallita',
        field: 'context'
      });
    }
  }

  async autenticaUtenteFico(req: Request): Promise<any> {
    let context = req.query.context as string;
    if (!context) {
      throw new ValidationError({
        message: 'Context non trovato',
        field: 'context'
      });
    }

    // Replace spaces with '+' to handle URL decoding issues where '+' is converted to a space.
    context = context.replace(/ /g, '+');

    const secret = process.env.FICO_SECRET || '';
    try {
      const decryptedText = decryptString(context, secret);
      const data = JSON.parse(decryptedText) as {
        publicKey: string;
        route: string;
        queryParams: {
          [key: string]: any;
        };
      };
      const result = await axios.get(`${config.OLYMPUS_IP_ADDRESS}/auth/checkIdentity`, {
        headers: {
          'fico-secret': config.FICO_SECRET as string,
          'Authorization': `Bearer ${data.publicKey}`
        }
      });
      console.log(result.data);
      const user = await this.userRepository.findOneByOptions({
        where: {
          email_utenti: result.data.username,
          tipo_utenti: result.data.tipoUtente,
          stato_utenti: STATO_UTENTI.ATTIVO
        }
      });
      // Helper function to promisify session save
      const saveSession = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              console.error('Session save error:', err);
              reject(err);
            } else {
              console.log('Session saved successfully, session ID:', req.sessionID);
              resolve();
            }
          });
        });
      };

      const setSessionData = (user: any, isNewUser: boolean = false) => {
        console.log(`Setting session for ${isNewUser ? 'new' : 'existing'} user:`, user.id_utenti);
        req.session.id_utente = user.id_utenti;
        req.session.tipo_utente = user.tipo_utenti;
        req.session.email = user.email_utenti;
        req.session.private_key = user.privatekey_utenti;
        req.session.cookie.maxAge = 60 * 60 * 1000; // 1 ora
        req.session.isExternalAuth = true;
      };

      if (user) {
        setSessionData(user);
        await saveSession();
      } else {
        const newUser = await this.userRepository.create({
          email_utenti: result.data.username,
          outsider_utenti: true,
          tipo_utenti: result.data.tipoUtente,
          nome_utenti: result.data.userPolicy.campi_essenziali.nome,
          cognome_utenti: result.data.userPolicy.campi_essenziali.cognome,
          privatekey_utenti: result.data.privateKey,
          stato_utenti: STATO_UTENTI.ATTIVO
        });
        setSessionData(newUser, true);
        await saveSession();
      }
      try {
        const response = await ServerUtils.sendToFICOApi<{
          esito: boolean,
        }>(
          req,
          config.ISTANTA_IP_ADDRESS + "/FicoProcess/AuthLanded",
          "GET",
          {},
          {
            "Authorization": "Bearer " + data.publicKey
          }
        )

        if (response.data.esito) {
          return data;
        } else {
          throw new ValidationError({
            message: 'Autenticazione fallita, la chiamata AuthLanded non ha restituito esito positivo, con ip: ' + config.ISTANTA_IP_ADDRESS + "/FicoProcess/AuthLanded",
            field: 'context'
          });
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        console.error('AuthLanded request failed:', error);
        throw new ValidationError({
          message: 'Autenticazione fallita',
          field: 'context'
        });
      }
    } catch (error) {
      console.error('Decryption failed:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError({
        message: 'Decriptazione fallita',
        field: 'context'
      });
    }
  }
}
async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const encoded = encodeURIComponent(address);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=it`,
      {
        headers: {
          'User-Agent': 'FP/1.0' // Nominatim richiede un User-Agent
        }
      }
    );

    const data = await response.json() as any[];

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
      };
    }

    return null;
  } catch (error) {
    console.error('Errore geocoding:', error);
    return null;
  }
}
function checkIfCanLogin(utente: UtenteResponseDTO): boolean {
  if (utente.meta?.need_ad === false) return true;  // override esplicito: login normale consentito
  if (utente.meta?.need_ad === true) return false;  // override esplicito: richiede Istanta
  if (config.AD_TENANT_ID != null && utente.tipo == TIPO_UTENTI.GDO) return false; // config globale
  return true;
}
