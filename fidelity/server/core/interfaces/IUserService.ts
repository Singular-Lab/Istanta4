import { Request } from 'express';
import { Optional } from 'sequelize';
import { TIPO_UTENTI } from '../../../lib/enums';
import { UtenteAttributes, UtentiCanaliInterazioneAttributes, type UtentiMeta } from '../../../lib/types';
import { CreateUtenteDTO, UpdateUtenteDTO, UtentePaginatedResponseDTO, UtenteResponseDTO } from '../dto';
type UtenteCreationAttributes = Optional<UtenteAttributes, 'id_utenti'>;

export interface IUserService {
  // User management
  get_all_utenti_paginated(userId: string, page: number, limit: number): Promise<UtentePaginatedResponseDTO>;
  getUtentiWithFilters(filters: {
    tipoUtente?: string;
    stato?: string;
    sesso?: string;
    haRuoloGDO?: boolean;
    haPuntoVendita?: boolean;
    isAttivo?: boolean;
    isAdmin?: boolean;
    searchTerm?: string;
  }): Promise<any[]>;
  createUser(data: Partial<CreateUtenteDTO>): Promise<UtenteResponseDTO>;
  getUserById(id: string): Promise<UtenteResponseDTO | null>;
  updateUser(id: string, data: UpdateUtenteDTO): Promise<UtenteResponseDTO | null>;
  updateProfile(userId: string, data: UpdateUtenteDTO): Promise<UtenteResponseDTO | null>;
  deleteUser(id: string, tipoUtente: string): Promise<boolean>;
  getAllUsers(): Promise<UtenteResponseDTO[]>;
  getUserByEmail(email: string): Promise<UtenteResponseDTO | null>;

  // Authentication
  login(email: string, password: string, selectedUserType?: TIPO_UTENTI): Promise<{ success: boolean; user?: UtenteResponseDTO; message?: string }>;
  checkLoginForMultipleUsers(email: string, password: string): Promise<{ users: UtenteResponseDTO[], message: string, gdoBlockedByIstanta?: boolean }>;
  register(userData: UtenteCreationAttributes): Promise<UtenteResponseDTO>;
  updatePassword(userId: string, newPassword: string): Promise<boolean>;
  verifyAndUpdatePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean>;

  // User operations
  getAllUtentiOperatori(userId: string): Promise<UtenteResponseDTO[]>;
  get_all_utenti(userId: string): Promise<UtenteResponseDTO[]>;
  get_all_account(userId: string): Promise<any[]>;
  user_menu(userId: string, tipoUtente: TIPO_UTENTI): Promise<any>;
  resolveGdoRuoloKey(userId: string): Promise<string | undefined>;

  // WebPliant operations
  generaNuovaSessioneWebpliant(meta: any): Promise<any>;
  generaNuovoInserimentoWishlistWebpliant(wishlistData: {
    idCanale: string;
    idArea: string;
    idPv: string;
    idWorkspace: string;
    idPagina: string;
    meta: any;
  }): Promise<any>;
  getAllReferenzeFromWishlistId(id: string): Promise<any[]>;
  getParamsWishlistId(id: string): Promise<{
    idArea: string;
    idCanale: string;
    idPv: string;
    idWorkspace: string;
    idPagina: string;
  }>;
  getURLWebpliant(id: string): Promise<string>;
  checkWishlistId(id: string, idArea: string, idCanale: string, idPv: string): Promise<boolean>;
  insertReferenzaInWishlist(idWishList: string, referenza: any): Promise<any>;
  deleteWishlistItem(wishlistId: string, codice: string): Promise<any>;

  // Additional methods needed
  registerUtentePuntoVendita(idUtente: string, idPuntoVendita: string): Promise<any>;
  registerUtenteGDO(utenteGDO: any): Promise<any>;
  registerUserWithTransaction(userData: {
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
  }, currentUserId: string): Promise<UtenteAttributes>;
  getUtentiWhatsappAttivi(): Promise<any[]>;
  checkUserByPhone(phone: string): Promise<any>;
  registerUserWithChannels(utenteData: UtenteCreationAttributes, utenteGDO: any, utenteCanaliInterazioni: UtentiCanaliInterazioneAttributes): Promise<any>;
  autenticaUtenteFico(req: Request): Promise<any>;
  autenticaUtenteAD(req: Request): Promise<any>;

  // User association updates
  updateUserGdoAssociation(userId: string, gdoId: string, ruoloId?: string): Promise<void>;
  updateUserPuntoVenditaAssociation(userId: string, puntoVenditaId: string): Promise<void>;
  refreshMaterializedView(): Promise<void>;
}
