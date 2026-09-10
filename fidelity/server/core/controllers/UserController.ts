import { Request, Response } from 'express';
import 'express-session';
import { Optional } from 'sequelize';
import { encryptString } from '../../../lib/encryption';
import { CATEGORIA_ATTIVITA, HttpStatusCode, STATO_UTENTI, TIPO_ATTIVITA, TIPO_UTENTI } from '../../../lib/enums';
import { ApplicationError, BadRequestError, UnauthorizedError } from '../../../lib/errors';
import { GlobalUserFilter, UtenteAttributes } from '../../../lib/types';
import type { IAgenziaLib } from '../agenzia_lib/types';
import { BaseController } from '../base/BaseController';
import { UtenteResponseDTO } from "../dto";
import { IGdoService } from '../interfaces/IGdoService';
import { IUserService } from '../interfaces/IUserService';
import { log } from '../logger';
import { authMiddleware } from '../middleware/authMiddleware';
import { csrfTokenEndpoint, csrfTokenGenerator } from '../middleware/csrfProtection';
import { permissionGuard } from '../middleware/permissionGuard';
import { authRateLimiter, registrationRateLimiter } from '../middleware/rateLimiter';
import { AuditLogService } from '../services/AuditLogService';
import { MenuCacheService } from '../services/MenuCacheService';
import { calculateSessionTimeout } from '../session';
import { ServerUtils } from '../utils/ServerUtils';

// Import per gestione file
import { renderToBuffer } from '@react-pdf/renderer';
import archiver from 'archiver';
import bcrypt from 'bcrypt';
import * as ExcelJS from 'exceljs';
import multer from 'multer';
import React from 'react';
import * as XLSX from 'xlsx';
import config from '../config';
import { DataTablePdfDocument } from '../pdf/DataTablePdfDocument.js';
import type BadgeService from "../services/BadgeService";
type UtenteCreationAttributes = Optional<UtenteAttributes, 'id_utenti'>;

interface UserPolicyResponse {
  is_authenticated: boolean;
  can_go_to_page: boolean;
  utente: Partial<UtenteResponseDTO> | null;
}
// Interfacce per gestione file
interface ExportOptions {
  format: 'xlsx' | 'xls' | 'csv' | 'pdf' | 'zip';
  filename?: string;
  includeHeaders?: boolean;
  sheetName?: string;
  data?: any[]; // dati già preparati dal frontend (evita una query extra)
}

interface ImportOptions {
  format: 'xlsx' | 'xls' | 'csv';
  skipRows?: number;
  mapping?: Record<string, string>;
}

function normalizeLocalAddress(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/^\[|\]$/g, '').replace(/^::ffff:/, '').toLowerCase();
}

function isLocalAddress(value: string | undefined): boolean {
  const normalizedValue = normalizeLocalAddress(value);
  if (!normalizedValue) return false;

  return normalizedValue === 'localhost'
    || normalizedValue === '::1'
    || normalizedValue === '0:0:0:0:0:0:0:1'
    || normalizedValue.startsWith('127.');
}

function isLocalDevelopmentRequest(req: Request): boolean {
  if (config.NODE_ENV === 'production') {
    return false;
  }

  return isLocalAddress(req.hostname)
    || isLocalAddress(req.ip)
    || isLocalAddress(req.socket.remoteAddress);
}

// Configurazione Multer per upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/csv'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato file non supportato. Usa .xlsx, .xls o .csv'));
    }
  }
});

export class UserController extends BaseController {
  constructor(private userService: IUserService, private badgeService: BadgeService, private gdoService: IGdoService, private agenziaLib: IAgenziaLib) {
    super('/api');
  }

  protected setupRoutes(): void {
    this.initializeRoutes();
  }


  public initializeRoutes(): void {
    // Session and policy routes
    this.router.get('/session/check', this.checkSession.bind(this));
    this.router.get('/policy/check', this.checkPolicy.bind(this));
    this.router.get('/check-user', authMiddleware, this.checkUser.bind(this));
    this.router.get('/csrf-token', csrfTokenGenerator(), csrfTokenEndpoint);
    this.router.get('/session/info', authMiddleware, this.getSessionInfo.bind(this));
    this.router.post('/export_users', authMiddleware, permissionGuard('utenti.esporta'), this.exportUsers.bind(this));
    this.router.post('/dev/hash-password', this.hashPasswordLocalOnly.bind(this));
    // Authentication routes
    this.router.post('/login_user', authRateLimiter, this.loginUser.bind(this));
    this.router.post('/check_login_for_multiple_users', authRateLimiter, this.checkLoginForMultipleUsers.bind(this));
    this.router.get('/logout-user', authMiddleware, this.logoutUser.bind(this));
    this.router.post('/register-user', registrationRateLimiter, authMiddleware, permissionGuard('utenti.crea'), this.registerUser.bind(this));

    // User management routes
    this.router.get('/user_menu', authMiddleware, this.user_menu.bind(this));
    this.router.get('/getAllUtentiOperatori', authMiddleware, permissionGuard('utenti.visualizza'), this.getAllUtentiOperatori.bind(this));
    this.router.get('/get_all_utenti', authMiddleware, permissionGuard('utenti.visualizza'), this.get_all_utenti.bind(this));
    this.router.get("/get_all_utenti_paginated", authMiddleware, permissionGuard('utenti.visualizza'), this.get_all_utenti_paginated.bind(this));
    this.router.get('/get_all_account', authMiddleware, permissionGuard('utenti.visualizza'), this.get_all_account.bind(this));
    this.router.delete('/deleteUser', authMiddleware, permissionGuard('utenti.elimina'), this.deleteUser.bind(this));
    this.router.put('/updateUser', authMiddleware, permissionGuard('utenti.modifica'), this.updateUser.bind(this));

    // WebPliant routes
    this.router.put('/generaNuovaSessioneWebpliant', authMiddleware, this.generaNuovaSessioneWebpliant.bind(this));
    this.router.put('/generaNuovoInserimentoWishlistWebpliant', authMiddleware, this.generaNuovoInserimentoWishlistWebpliant.bind(this));
    this.router.get('/getAllReferenzeFromWishlistId', this.getAllReferenzeFromWishlistId.bind(this));
    this.router.get('/getParamsWishlistId', this.getParamsWishlistId.bind(this));
    this.router.get('/getURLWebpliant', this.getURLWebpliant.bind(this));
    this.router.get('/checkWishlistId', this.checkWishlistId.bind(this));
    this.router.put('/insertReferenzaInWishlist', authMiddleware, this.insertReferenzaInWishlist.bind(this));
    this.router.post('/deleteWishlistItem', authMiddleware, this.deleteWishlistItem.bind(this));


    this.router.get("/autentica_utente_fico", this.autenticaUtenteFico.bind(this));
    this.router.get("/autentica_utente_ad", this.autenticaUtenteAD.bind(this));


    this.router.put("/return_json", this.returnJson.bind(this));
    this.router.put('/update_profile', authMiddleware, this.updateProfile.bind(this));
    this.router.put('/update_password', authMiddleware, this.updatePasswordSelf.bind(this));

    // Global filters
    this.router.get('/utenti/me/global-filters', authMiddleware, this.getGlobalFilters.bind(this));
  }



  private async get_all_utenti_paginated(req: Request, res: Response): Promise<void> {
    try {
      const {
        page,
        limit,
        tipoUtente,
        stato,
        sesso,
        haRuoloGDO,
        haPuntoVendita,
        isAttivo,
        isAdmin,
        searchTerm
      } = req.query;

      // Se ci sono filtri, usa il metodo con filtri
      if (tipoUtente || stato || sesso || haRuoloGDO || haPuntoVendita || isAttivo || isAdmin || searchTerm) {
        const filters = {
          tipoUtente: tipoUtente as string,
          stato: stato as string,
          sesso: sesso as string,
          haRuoloGDO: haRuoloGDO === 'true' ? true : haRuoloGDO === 'false' ? false : undefined,
          haPuntoVendita: haPuntoVendita === 'true' ? true : haPuntoVendita === 'false' ? false : undefined,
          isAttivo: isAttivo === 'true' ? true : isAttivo === 'false' ? false : undefined,
          isAdmin: isAdmin === 'true' ? true : isAdmin === 'false' ? false : undefined,
          searchTerm: searchTerm as string
        };

        const users = await this.userService.getUtentiWithFilters(filters);

        // Implementa paginazione lato server
        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 10;
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;

        const paginatedUsers = users.slice(startIndex, endIndex);

        res.status(HttpStatusCode.OK).json({
          utenti: paginatedUsers,
          total: users.length,
          page: pageNum,
          limit: limitNum,
          total_pages: Math.ceil(users.length / limitNum)
        });
      } else {
        // Usa il metodo originale senza filtri
        const users = await this.userService.get_all_utenti_paginated(
          req.session.id_utente as string,
          parseInt(page as string),
          parseInt(limit as string)
        );
        res.status(HttpStatusCode.OK).json(users);
      }
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.session.id_utente as string;
      if (!userId) {
        throw new UnauthorizedError({
          message: 'Utente non autorizzato',
        });
      }

      // Allowlist: solo i campi che un utente può modificare sul proprio profilo
      const {
        nome_utenti,
        cognome_utenti,
        email_utenti,
        telefono_utenti,
        sesso_utenti,
        residenza_utenti,
        datadinascita_utenti,
        meta_utenti
      } = req.body;
      const updatedData = {
        ...(nome_utenti !== undefined && { nome: nome_utenti }),
        ...(cognome_utenti !== undefined && { cognome: cognome_utenti }),
        ...(email_utenti !== undefined && { email: email_utenti }),
        ...(email_utenti !== undefined && { email: email_utenti }),
        ...(telefono_utenti !== undefined && { telefono: telefono_utenti }),
        ...(sesso_utenti !== undefined && { sesso: sesso_utenti }),
        ...(residenza_utenti !== undefined && { residenza: residenza_utenti }),
        ...(datadinascita_utenti !== undefined && { datadinascita: datadinascita_utenti }),
        ...(meta_utenti !== undefined && { meta: meta_utenti }),
      };

      const utente = await this.userService.updateProfile(userId, updatedData);
      res.status(HttpStatusCode.OK).json(utente);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async updatePasswordSelf(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.session.id_utente as string;
      if (!userId) {
        throw new UnauthorizedError({ message: 'Utente non autorizzato' });
      }

      const { currentPassword, newPassword, confirmPassword } = req.body;

      if (!currentPassword || !newPassword || !confirmPassword) {
        throw new BadRequestError({ message: 'Tutti i campi password sono obbligatori' });
      }

      if (newPassword !== confirmPassword) {
        throw new BadRequestError({ message: 'Le nuove password non coincidono' });
      }

      if (newPassword.length < 8) {
        throw new BadRequestError({ message: 'La nuova password deve contenere almeno 8 caratteri' });
      }

      await this.userService.verifyAndUpdatePassword(userId, currentPassword, newPassword);
      res.status(HttpStatusCode.OK).json({ success: true, message: 'Password aggiornata con successo' });
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async hashPasswordLocalOnly(req: Request, res: Response): Promise<void> {
    try {
      if (!isLocalDevelopmentRequest(req)) {
        res.status(HttpStatusCode.NOT_FOUND).json({ message: 'Not found' });
        return;
      }

      const { password } = req.body as { password?: string };

      if (typeof password !== 'string' || password.length === 0) {
        res.status(HttpStatusCode.BAD_REQUEST).json({
          message: 'Il campo password è obbligatorio'
        });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, config.SALT_ROUNDS);

      res.status(HttpStatusCode.OK).json({
        hashedPassword
      });
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async checkSession(req: Request, res: Response): Promise<void> {
    try {
      if (req.session.id_utente) {
        const getUtente = await this.userService.getUserById(req.session.id_utente as string);
        if (getUtente == null) {
          res.status(HttpStatusCode.OK).json({ is_authenticated: false, utente: null });
          return;
        }
        res.status(HttpStatusCode.OK).json({ is_authenticated: true, utente: getUtente });
      } else {
        res.status(HttpStatusCode.OK).json({ is_authenticated: false, utente: null });
      }
    } catch (error) {
      console.error('Error in checkSession:', error);
      this.handleError(res, error as Error);
    }
  }

  /**
   * Endpoint per ottenere informazioni sulla sessione corrente
   * Restituisce il tempo rimanente prima della scadenza
   */
  private async getSessionInfo(req: Request, res: Response): Promise<void> {
    try {
      // Verifica se l'utente è autenticato
      if (!req.session.id_utente) {
        res.status(HttpStatusCode.UNAUTHORIZED).json({
          success: false,
          error: 'SESSION_EXPIRED',
          timeRemaining: 0
        });
        return;
      }

      const userType = req.session.tipo_utente;
      const lastActivity = req.session.lastActivity
        ? new Date(req.session.lastActivity)
        : new Date();

      // Calcola il timeout dinamico basato sul tipo di utente
      const timeout = calculateSessionTimeout(userType, lastActivity);
      const timeSinceActivity = Date.now() - lastActivity.getTime();
      const timeRemaining = Math.max(0, timeout - timeSinceActivity);

      res.status(HttpStatusCode.OK).json({
        success: true,
        timeRemaining,  // millisecondi rimanenti
        timeout,        // timeout totale in ms
        userId: req.session.id_utente,
        lastActivity: lastActivity.toISOString()
      });
    } catch (error) {
      log.error('Error in getSessionInfo:', error);
      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Errore durante il recupero delle informazioni di sessione'
      });
    }
  }

  private async checkPolicy(req: Request, res: Response): Promise<Response> {
    try {
      let response = {} as UserPolicyResponse;
      const rp = req.query.rp;

      if (!rp) {
        response = {
          is_authenticated: false,
          can_go_to_page: false,
          utente: null
        };
        return res.status(400).json(response);
      }

      const userId = req.session.id_utente;
      const tipoUtente = req.session.tipo_utente as TIPO_UTENTI;

      if (!userId || !tipoUtente) {
        response = {
          is_authenticated: false,
          can_go_to_page: false,
          utente: null
        };
        return res.status(HttpStatusCode.UNAUTHORIZED).json(response);
      }

      // Usa il MenuCacheService per verificare l'accesso
      const menuCacheService = MenuCacheService.getInstance();
      const cleanRequestedPage = (rp as string).split('?')[0];

      // Normalizza il path
      const normalizedPage = cleanRequestedPage.startsWith('/') ? cleanRequestedPage : `/${cleanRequestedPage}`;

      const hasAccess = await menuCacheService.hasPageAccess(userId, tipoUtente, normalizedPage);
      const user = await this.userService.getUserById(userId);
      const sanitizedUser = user ? { ...user } as Partial<UtenteResponseDTO> : null;
      if (sanitizedUser) {
        delete sanitizedUser.private_key;
        delete sanitizedUser.outsider;
      }

      response = {
        is_authenticated: true,
        can_go_to_page: hasAccess,
        utente: sanitizedUser
      };
      if (cleanRequestedPage === "profilo-utente"
        || cleanRequestedPage === "display/files"
        || cleanRequestedPage === "storico-volantini"
        || cleanRequestedPage === "hub/todos"
        || cleanRequestedPage === "auth"
      ) {
        return res.status(HttpStatusCode.OK).json({ ...response, can_go_to_page: true });
      }
      if (!hasAccess) {
        log.warn('Page access denied', {
          userId,
          tipoUtente,
          rp: normalizedPage,
          ip: req.ip
        });
      } else {
        log.debug('Page access granted', {
          userId,
          tipoUtente,
          rp: normalizedPage
        });
      }

      return res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      log.error('Error in checkPolicy', error instanceof Error ? error : new Error(String(error)), {
        rp: req.query.rp,
        userId: req.session.id_utente
      });

      const errorResponse = {
        is_authenticated: false,
        can_go_to_page: false,
        utente: null
      };
      return res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  private async checkUser(req: Request, res: Response): Promise<void> {
    try {
      res.status(HttpStatusCode.OK).json({
        type: "SUCCESS",
        message: "Utente verificato correttamente"
      });
    } catch (error) {
      console.error('Error in checkUser:', error);
      this.handleError(res, error as Error);
    }
  }

  private async checkLoginForMultipleUsers(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await this.userService.checkLoginForMultipleUsers(email, password);
      if (result.users.length === 0) {
        if (result.gdoBlockedByIstanta) {
          res.status(HttpStatusCode.FORBIDDEN).json({
            code: 'ISTANTA_LOGIN_REQUIRED',
            message: 'Per accedere come utente GDO è necessario effettuare il login tramite Istanta.'
          });
          return;
        }
        res.status(HttpStatusCode.BAD_REQUEST).json(new BadRequestError({
          message: 'Email o password non valide'
        }));
        return;
      }
      res.status(HttpStatusCode.OK).json(result.users);
      return;
    } catch (error) {
      console.error('Error in checkLoginForMultipleUsers:', error);
      this.handleError(res, error);
    }
  }
  private async loginUser(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, selectedUserType } = req.body;

      const result = await this.userService.login(
        email,
        password,
        selectedUserType ? selectedUserType as TIPO_UTENTI : undefined
      );
      if (!result.success || !result.user) {
        const auditService = AuditLogService.getInstance();
        auditService.loginFailed(req, email, result.message || 'Login failed');
        res.status(HttpStatusCode.UNAUTHORIZED).json(new UnauthorizedError({
          message: result.message || 'Login failed'
        }));
        return;
      }

      // Rigenera la sessione per prevenire session fixation
      req.session.regenerate((err) => {
        if (err) {
          log.error("Errore durante la rigenerazione della sessione", { error: err, email });
          this.handleError(res, new Error("Errore durante il login"));
          return;
        }

        // Pulisce esplicitamente il cookie jar dalla vecchia sessione
        req.session.requestCookieJar = undefined;
        req.session.isExternalAuth = false;

        // Imposta i dati della nuova sessione
        req.session.id_utente = result.user!.id;
        req.session.private_key = result.user!.private_key;
        req.session.id_gdo = result.user!.id_gdo;
        req.session.email = result.user!.email;
        req.session.tipo_utente = selectedUserType ? selectedUserType as TIPO_UTENTI : result.user!.tipo;

        // Security: traccia IP e UserAgent per prevenire session hijacking
        req.session.lastActivity = new Date();
        req.session.lastIP = req.ip;
        req.session.lastUserAgent = req.get('user-agent');

        req.session.save((err) => {
          if (err) {
            log.error("Errore nel salvataggio della sessione", { error: err, userId: result.user!.id });
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(new ApplicationError({
              message: "Errore del server durante il salvataggio della sessione",
              name: "ApplicationError",
              code: "APPLICATION_ERROR",
              httpStatus: HttpStatusCode.INTERNAL_SERVER_ERROR,
            }));
            return;
          }
          // Log di successo per audit
          const auditService = AuditLogService.getInstance();
          auditService.loginSuccess(req, result.user!.id, result.user!.tipo);

          res.status(HttpStatusCode.OK).json(result.user);
        });
      });

    } catch (error: any) {
      log.auth.loginFailed('Error in loginUser:', req.ip || 'unknown', error);
      const auditService = AuditLogService.getInstance();
      auditService.loginFailed(req, req.body?.email || 'unknown', 'System error during login');
      this.handleError(res, error as Error);
    }
  }

  private async logoutUser(req: Request, res: Response): Promise<void> {
    try {
      if (req.session) {
        // Rimuovo esplicitamente il cookie jar dalla sessione
        req.session.requestCookieJar = undefined;
        const userId = req.session.id_utente as string;
        const auditService = AuditLogService.getInstance();

        log.auth.logout(userId, req.ip || 'unknown');
        auditService.logout(req, userId);

        req.session.destroy((err) => {
          if (err) {
            log.auth.logoutFailed(userId, req.ip || 'unknown', err);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
              message: "Errore del server durante il logout"
            });
            return;
          }
          res.status(HttpStatusCode.OK).json({
            message: "Logout effettuato con successo"
          });
        });
      } else {
        res.status(HttpStatusCode.BAD_REQUEST).json({
          message: "Nessuna sessione attiva"
        });
      }
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async registerUser(req: Request, res: Response): Promise<void> {
    try {
      console.log('registerUser - Start', { body: req.body, sessionUser: req.session.id_utente });

      let { email, nome, cognome, password, tipo, stato, residenza, dataDiNascita, gdoScelta, idPuntoVendita, ruoloGDO, telefono, sesso } = req.body as {
        email: string,
        nome: string,
        cognome: string,
        password: string,
        tipo: TIPO_UTENTI,
        stato: string,
        residenza: string,
        dataDiNascita: string,
        gdoScelta?: string,
        idPuntoVendita?: string,
        ruoloGDO?: string,
        telefono?: string,
        sesso?: string,
      };

      console.log('registerUser - Extracted data', {
        email, nome, cognome, tipo, stato, residenza,
        dataDiNascita, gdoScelta, idPuntoVendita, ruoloGDO, telefono, sesso
      });

      if (!email || !nome || !cognome || !password || !tipo || !stato || !residenza || !dataDiNascita) {
        console.log('registerUser - Missing required fields', {
          hasEmail: !!email, hasNome: !!nome, hasCognome: !!cognome,
          hasPassword: !!password, hasTipo: !!tipo, hasStato: !!stato,
          hasResidenza: !!residenza, hasDataDiNascita: !!dataDiNascita
        });
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "Dati non validi" });
        return;
      }
      const result = await this.userService.registerUserWithTransaction({
        email,
        nome,
        cognome,
        password,
        tipo,
        stato,
        residenza,
        dataDiNascita,
        gdoScelta,
        idPuntoVendita,
        id_ruolo_utente_gdo: ruoloGDO,
        telefono,
        sesso,
      }, req.session.id_utente as string);
      AuditLogService.getInstance().userCreated(req, result.id_utenti, tipo);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Error in registerUser:', error);
      this.handleError(res, error as Error);
    }
  }

  private async user_menu(req: Request, res: Response): Promise<void> {
    try {
      const tipoUtente = req.session.tipo_utente as TIPO_UTENTI;
      const userId = req.session.id_utente as string;

      if (!userId || !tipoUtente) {
        throw new UnauthorizedError({
          message: 'Sessione non valida'
        });
      }

      // Menu runtime da UserService (fonte DB con fallback di servizio)
      const menu = await this.userService.user_menu(userId, tipoUtente);

      // Calcola i badges permission-aware tramite BadgeService
      // Import dinamico per evitare dipendenze circolari e caricare le dipendenze reali
      const { BadgeService } = await import('../services/BadgeService');
      const { PromoService } = await import('../services/PromoService');
      const { OrdiniStampaService } = await import('../services/OrdiniStampaService');

      // Costruisci istanze dei servizi necessari passandogli le dipendenze minime
      // Qui assumiamo che PromoService e OrdiniStampaService non richiedano argomenti nel costruttore
      // (se servono dipendenze, il servizio può essere modificato in futuro per essere risolvibile dal container)
      // @ts-ignore
      // const promoService = new PromoService(undefined, undefined, undefined, undefined, undefined);
      // // @ts-ignore
      // const ordiniService = new OrdiniStampaService(undefined, undefined);


      const badges = await this.badgeService.getBadgesForUser(userId, tipoUtente);

      log.info('Menu retrieved successfully', {
        userId,
        tipoUtente,
        menuItemsCount: Array.isArray(menu) ? menu.length : Object.keys(menu).length,
        badges: Object.keys(badges).length
      });

      // Deep clone the menu so we don't mutate cache or original structure
      const clonedMenu = JSON.parse(JSON.stringify(menu));

      // Helper: inject badge into matching menu items (by pathname or title)
      const injectBadges = (items: any[]) => {
        if (!Array.isArray(items)) return;
        for (const item of items) {
          if (typeof item === 'string') continue; // separator

          const keyByPath = item.pathname && badges[item.pathname];
          const keyByTitle = item.title && badges[item.title];

          if (keyByPath) {
            // attach numeric badge directly as `badge` key
            // Keeping shape minimal: { count, variant? }
            // @ts-ignore
            item.badge = { ...keyByPath };
          } else if (keyByTitle) {
            // @ts-ignore
            item.badge = { ...keyByTitle };
          }

          if (item.subMenu && Array.isArray(item.subMenu)) {
            injectBadges(item.subMenu);
          }
        }
      };

      if (Array.isArray(clonedMenu)) {
        injectBadges(clonedMenu as any[]);
      } else if (clonedMenu && typeof clonedMenu === 'object') {
        // GDO special structure: object with keys containing arrays
        Object.keys(clonedMenu).forEach(k => {
          const val = (clonedMenu as any)[k];
          if (Array.isArray(val)) injectBadges(val);
        });
      }

      // Return the menu as before (same structure), now possibly enriched with `badge` fields
      res.status(HttpStatusCode.OK).json(clonedMenu);
    } catch (error) {
      log.error('Error retrieving user menu', error instanceof Error ? error : new Error(String(error)), {
        userId: req.session.id_utente,
        tipoUtente: req.session.tipo_utente
      });
      this.handleError(res, error as Error);
    }
  }

  private async getAllUtentiOperatori(req: Request, res: Response): Promise<void> {
    try {
      const users = await this.userService.getAllUtentiOperatori(req.session.id_utente as string);
      res.status(HttpStatusCode.OK).json(users);
    } catch (error) {
      console.error('Error in getAllUtentiOperatori:', error);
      this.handleError(res, error as Error);
    }
  }

  private async get_all_utenti(req: Request, res: Response): Promise<void> {
    try {
      const users = await this.userService.get_all_utenti(req.session.id_utente as string);
      res.status(HttpStatusCode.OK).json(users);
    } catch (error) {
      console.error('Error in get_all_utenti:', error);
      this.handleError(res, error as Error);
    }
  }

  private async get_all_account(req: Request, res: Response): Promise<void> {
    try {
      const accounts = await this.userService.get_all_account(req.session.id_utente as string);
      res.status(HttpStatusCode.OK).json(accounts);
    } catch (error) {
      console.error('Error in get_all_account:', error);
      this.handleError(res, error as Error);
    }
  }

  private async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.query;

      // Recupera i dati utente PRIMA della cancellazione per la notifica
      const userInfo = await this.userService.getUserById(id as string);

      const result = await this.userService.deleteUser(id as string, req.session.tipo_utente as TIPO_UTENTI);
      AuditLogService.getInstance().userDeleted(req, id as string);

      if (result && req.session.id_utente) {
        await ServerUtils.CREA_ATTIVITA(
          req.session.id_utente as string,
          TIPO_ATTIVITA.ELIMINAZIONE_UTENTE,
          CATEGORIA_ATTIVITA.ACCOUNT,
          {
            nome: userInfo ? `${userInfo.cognome} ${userInfo.nome}`.trim() : 'Utente sconosciuto',
            email_utenti: userInfo?.email,
            cognome_Utenti: userInfo?.cognome,
            nome_Utenti: userInfo?.nome,
          }
        );
      }

      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Error in deleteUser:', error);
      this.handleError(res, error as Error);
    }
  }

  private async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id, email, nome, cognome, tipo, residenza, dataDiNascita, telefono, sesso, stato, gdoScelta, idPuntoVendita, id_ruolo_utente_gdo } = req.body as {
        id: string;
        email?: string;
        nome?: string;
        cognome?: string;
        tipo?: string;
        residenza?: string;
        dataDiNascita?: string;
        telefono?: string;
        sesso?: string;
        stato?: string;
        gdoScelta?: string;
        idPuntoVendita?: string;
        id_ruolo_utente_gdo?: string;
      };

      if (!id) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "ID utente obbligatorio" });
        return;
      }

      const callerTipo = req.session.tipo_utente;

      // Solo Superadmin può modificare ruolo (tipo) e stato di un utente
      if (tipo !== undefined && callerTipo !== TIPO_UTENTI.SUPERADMIN) {
        res.status(HttpStatusCode.FORBIDDEN).json({ message: "Solo un Superadmin può modificare il ruolo utente" });
        return;
      }
      if (stato !== undefined && callerTipo !== TIPO_UTENTI.SUPERADMIN) {
        res.status(HttpStatusCode.FORBIDDEN).json({ message: "Solo un Superadmin può modificare lo stato utente" });
        return;
      }

      // Validazione: il valore di tipo deve essere un ruolo valido
      if (tipo !== undefined && !Object.values(TIPO_UTENTI).includes(tipo as TIPO_UTENTI)) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "Tipo utente non valido" });
        return;
      }

      const updateData: any = {};
      if (email !== undefined) updateData.email = email.toLowerCase();
      if (nome !== undefined) updateData.nome = nome;
      if (cognome !== undefined) updateData.cognome = cognome;
      if (tipo !== undefined) updateData.tipo = tipo;
      if (residenza !== undefined) updateData.residenza = residenza;
      if (dataDiNascita !== undefined) updateData.datadinascita = new Date(dataDiNascita);
      if (telefono !== undefined) updateData.telefono = telefono || null;
      if (sesso !== undefined) updateData.sesso = sesso || null;
      if (stato !== undefined) updateData.stato = stato;

      const result = await this.userService.updateUser(id, updateData);

      if (!result) {
        res.status(HttpStatusCode.NOT_FOUND).json({ message: "Utente non trovato" });
        return;
      }

      // Aggiorna associazione GDO se necessario
      if (gdoScelta !== undefined) {
        await this.userService.updateUserGdoAssociation(id, gdoScelta, id_ruolo_utente_gdo);
      }

      // Aggiorna associazione PuntoVendita se necessario
      if (idPuntoVendita !== undefined) {
        await this.userService.updateUserPuntoVenditaAssociation(id, idPuntoVendita);
      }

      // Refresh materialized view
      await this.userService.refreshMaterializedView();

      AuditLogService.getInstance().userUpdated(req, id, { changedFields: Object.keys(updateData) });
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Error in updateUser:', error);
      this.handleError(res, error as Error);
    }
  }

  private async generaNuovaSessioneWebpliant(req: Request, res: Response): Promise<void> {
    try {
      const { meta } = req.body;
      const result = await this.userService.generaNuovaSessioneWebpliant(meta || {});
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Error in generaNuovaSessioneWebpliant:', error);
      this.handleError(res, error as Error);
    }
  }

  private async generaNuovoInserimentoWishlistWebpliant(req: Request, res: Response): Promise<void> {
    try {
      const wishlistData = req.body;
      const result = await this.userService.generaNuovoInserimentoWishlistWebpliant(wishlistData);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Error in generaNuovoInserimentoWishlistWebpliant:', error);
      this.handleError(res, error as Error);
    }
  }

  private async getAllReferenzeFromWishlistId(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.query;
      const result = await this.userService.getAllReferenzeFromWishlistId(id as string);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Error in getAllReferenzeFromWishlistId:', error);
      this.handleError(res, error as Error);
    }
  }

  private async getParamsWishlistId(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.query;
      const result = await this.userService.getParamsWishlistId(id as string);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Error in getParamsWishlistId:', error);
      this.handleError(res, error as Error);
    }
  }

  private async getURLWebpliant(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.query;
      const result = await this.userService.getURLWebpliant(id as string);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Error in getURLWebpliant:', error);
      this.handleError(res, error as Error);
    }
  }

  private async checkWishlistId(req: Request, res: Response): Promise<void> {
    try {
      const { id, idArea, idCanale, idPv } = req.query;
      console.log("checkWishlistId - Start", { id, idArea, idCanale, idPv });
      const result = await this.userService.checkWishlistId(
        id as string,
        idArea as string,
        idCanale as string,
        idPv as string
      );
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Error in checkWishlistId:', error);
      this.handleError(res, error as Error);
    }
  }

  private async insertReferenzaInWishlist(req: Request, res: Response): Promise<void> {
    try {
      const { referenza, idWishList } = req.body;
      const result = await this.userService.insertReferenzaInWishlist(idWishList, referenza);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Error in insertReferenzaInWishlist:', error);
      this.handleError(res, error as Error);
    }
  }

  private async deleteWishlistItem(req: Request, res: Response): Promise<void> {
    try {
      const { codice, wishlistId } = req.body;
      const result = await this.userService.deleteWishlistItem(wishlistId, codice);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Error in deleteWishlistItem:', error);
      this.handleError(res, error as Error);
    }
  }

  private async autenticaUtenteFico(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.userService.autenticaUtenteFico(req);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Error in autenticaUtenteFico:', error);
      this.handleError(res, error as Error);
    }
  }

  private async autenticaUtenteAD(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.userService.autenticaUtenteAD(req);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Error in autenticaUtenteAD:', error);
      this.handleError(res, error as Error);
    }
  }

  private async returnJson(req: Request, res: Response): Promise<void> {
    try {
      // Ensure data is a string before passing to crypto
      const data = req.body.data;
      let text: string;

      if (typeof data === 'string') {
        text = data;
      } else if (data && typeof data === 'object') {
        text = JSON.stringify(data);
      } else {
        throw new BadRequestError({ message: 'Il campo data deve essere una stringa o un oggetto serializzabile', details: { field: 'data' } });
      }

      const secret = process.env.FICO_SECRET || '';
      const encryptedData = encryptString(text, secret);
      res.status(HttpStatusCode.OK).json(encryptedData);
    } catch (error) {
      console.error('Error in returnJson:', error);
      this.handleError(res, error as Error);
    }
  }

  // ==================== FILE MANAGEMENT METHODS ====================

  /**
   * Esporta la lista utenti in vari formati
   */
  private async exportUsers(req: Request, res: Response): Promise<void> {
    try {
      const { format = 'xlsx', filename, includeHeaders = true, data: providedData } = req.body as ExportOptions;
      const userId = req.session.id_utente as string;

      if (!userId) {
        throw new UnauthorizedError({ message: 'Utente non autorizzato' });
      }

      // Usa i dati forniti dal frontend se disponibili, altrimenti li recupera dal DB
      let users: any[];
      if (Array.isArray(providedData) && providedData.length > 0) {
        users = providedData;
      } else {
        const dbUsers = await this.userService.get_all_utenti(userId);
        users = dbUsers;
      }

      if (!users || users.length === 0) {
        res.status(HttpStatusCode.NOT_FOUND).json({ message: 'Nessun utente trovato' });
        return;
      }

      const timestamp = new Date().toISOString().split('T')[0];
      const defaultFilename = `utenti_${timestamp}`;

      let buffer: Buffer;
      let mimeType: string;
      let fileExtension: string;

      switch (format) {
        case 'xlsx':
          buffer = await this.createExcelBuffer(users, includeHeaders);
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          fileExtension = 'xlsx';
          break;
        case 'xls':
          buffer = await this.createExcelLegacyBuffer(users, includeHeaders);
          mimeType = 'application/vnd.ms-excel';
          fileExtension = 'xls';
          break;
        case 'csv':
          buffer = await this.createCSVBuffer(users, includeHeaders);
          mimeType = 'text/csv';
          fileExtension = 'csv';
          break;
        case 'pdf':
          buffer = await this.createPDFBuffer(users, includeHeaders);
          mimeType = 'application/pdf';
          fileExtension = 'pdf';
          break;
        case 'zip':
          buffer = await this.createZIPBuffer(users, includeHeaders);
          mimeType = 'application/zip';
          fileExtension = 'zip';
          break;
        default:
          res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'Formato non supportato' });
          return;
      }

      const finalFilename = filename || `${defaultFilename}.${fileExtension}`;

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);

    } catch (error) {
      log.error('Error in exportUsers', error instanceof Error ? error : new Error(String(error)));
      this.handleError(res, error as Error);
    }
  }

  /**
   * Importa utenti da file
   */
  private async importUsers(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.session.id_utente as string;
      if (!userId) {
        throw new UnauthorizedError({ message: 'Utente non autorizzato' });
      }

      if (!req.file) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'Nessun file caricato' });
        return;
      }

      const { skipRows = 1, mapping } = req.body as ImportOptions;
      const file = req.file;

      let importedData: any[] = [];

      // Determina il formato dal mimetype
      let format: 'xlsx' | 'xls' | 'csv';
      if (file.mimetype.includes('spreadsheetml')) {
        format = 'xlsx';
      } else if (file.mimetype.includes('ms-excel')) {
        format = 'xls';
      } else {
        format = 'csv';
      }

      // Parsing del file
      switch (format) {
        case 'xlsx':
          importedData = await this.parseExcelFile(file.buffer, skipRows);
          break;
        case 'xls':
          importedData = await this.parseExcelLegacyFile(file.buffer, skipRows);
          break;
        case 'csv':
          importedData = await this.parseCSVFile(file.buffer, skipRows);
          break;
      }

      if (importedData.length === 0) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'Nessun dato valido trovato nel file' });
        return;
      }

      // Processa i dati importati
      const results = await this.processImportedUsers(importedData, mapping, userId);

      res.status(HttpStatusCode.OK).json({
        message: 'Import completato',
        totalRows: importedData.length,
        processedRows: results.processed,
        errors: results.errors,
        success: results.success
      });

    } catch (error) {
      log.error('Error in importUsers', error instanceof Error ? error : new Error(String(error)));
      this.handleError(res, error as Error);
    }
  }

  /**
   * Scarica template per import
   */
  private async downloadTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { format = 'xlsx' } = req.query;

      const templateData = [
        {
          'Email': 'esempio@email.com',
          'Nome': 'Mario',
          'Cognome': 'Rossi',
          'Tipo': 'GDO',
          'Stato': 'ATTIVO',
          'Residenza': 'Milano',
          'Data di Nascita': '1990-01-01',
          'GDO Scelta': 'GDO001',
          'ID Punto Vendita': 'PV001'
        }
      ];

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `template_utenti_${timestamp}`;

      let buffer: Buffer;
      let mimeType: string;
      let fileExtension: string;

      switch (format) {
        case 'xlsx':
          buffer = await this.createExcelBuffer(templateData, true);
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          fileExtension = 'xlsx';
          break;
        case 'csv':
          buffer = await this.createCSVBuffer(templateData, true);
          mimeType = 'text/csv';
          fileExtension = 'csv';
          break;
        default:
          res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'Formato template non supportato' });
          return;
      }

      const finalFilename = `${filename}.${fileExtension}`;

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);

    } catch (error) {
      log.error('Error in downloadTemplate', error instanceof Error ? error : new Error(String(error)));
      this.handleError(res, error as Error);
    }
  }

  /**
   * Esporta dati personalizzati
   */
  private async exportCustomData(req: Request, res: Response): Promise<void> {
    try {
      const { data, format = 'xlsx', filename, sheetName = 'Dati' } = req.body;
      const userId = req.session.id_utente as string;

      if (!userId) {
        throw new UnauthorizedError({ message: 'Utente non autorizzato' });
      }

      if (!data || !Array.isArray(data)) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'Dati non validi' });
        return;
      }

      const timestamp = new Date().toISOString().split('T')[0];
      const defaultFilename = `dati_esportati_${timestamp}`;

      let buffer: Buffer;
      let mimeType: string;
      let fileExtension: string;

      switch (format) {
        case 'xlsx':
          buffer = await this.createExcelBuffer(data, true);
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          fileExtension = 'xlsx';
          break;
        case 'csv':
          buffer = await this.createCSVBuffer(data, true);
          mimeType = 'text/csv';
          fileExtension = 'csv';
          break;
        case 'pdf':
          buffer = await this.createPDFBuffer(data, true);
          mimeType = 'application/pdf';
          fileExtension = 'pdf';
          break;
        default:
          res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'Formato non supportato' });
          return;
      }

      const finalFilename = filename || `${defaultFilename}.${fileExtension}`;

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);

    } catch (error) {
      log.error('Error in exportCustomData', error instanceof Error ? error : new Error(String(error)));
      this.handleError(res, error as Error);
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Crea buffer Excel moderno (ExcelJS)
   */
  private async createExcelBuffer(data: any[], includeHeaders: boolean = true, sheetName: string = 'Dati'): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    if (data.length === 0) {
      throw new BadRequestError({ message: 'Nessun dato da esportare', details: { field: 'data' } });
    }

    // Aggiungi headers se richiesto
    if (includeHeaders) {
      const headers = Object.keys(data[0]);
      worksheet.addRow(headers);

      // Stile headers
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    }

    // Aggiungi dati
    data.forEach(row => {
      const values = Object.values(row);
      worksheet.addRow(values);
    });

    // Auto-fit colonne
    worksheet.columns.forEach(column => {
      column.width = 15;
    });

    return await workbook.xlsx.writeBuffer() as any;
  }

  /**
   * Crea buffer Excel legacy (XLSX)
   */
  private async createExcelLegacyBuffer(data: any[], includeHeaders: boolean = true): Promise<Buffer> {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dati');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xls' }) as Buffer;
  }

  /**
   * Crea buffer PDF con react-pdf (corporate layout)
   */
  private async createPDFBuffer(data: any[], includeHeaders: boolean = true): Promise<Buffer> {
    if (!data.length) {
      throw new BadRequestError({ message: 'Nessun dato da esportare' });
    }

    const headers = Object.keys(data[0]);
    const rows = data.map(row => Object.values(row).map(v => String(v ?? '')));
    const landscape = headers.length > 6;

    const element = React.createElement(DataTablePdfDocument, {
      headers,
      rows,
      landscape,
    });

    const buffer = await renderToBuffer(element as any);
    return Buffer.from(buffer);
  }
  /**
   * Crea buffer ZIP
   */
  private async createZIPBuffer(data: any[], includeHeaders: boolean = true): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk) => {
        chunks.push(chunk);
      });

      archive.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      archive.on('error', (err) => {
        reject(err);
      });

      // Aggiungi file Excel
      this.createExcelBuffer(data, includeHeaders).then(excelBuffer => {
        archive.append(excelBuffer, { name: 'dati.xlsx' });

        // Aggiungi file CSV
        return this.createCSVBuffer(data, includeHeaders);
      }).then(csvBuffer => {
        archive.append(csvBuffer, { name: 'dati.csv' });
        archive.finalize();
      }).catch(reject);
    });
  }

  /**
   * Parsing file Excel moderno
   */
  private async parseExcelFile(buffer: Buffer, skipRows: number = 1): Promise<any[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    const data: any[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= skipRows) return;

      const rowData: any = {};
      row.eachCell((cell, colNumber) => {
        const header = worksheet.getRow(1).getCell(colNumber).value as string;
        rowData[header] = cell.value;
      });
      data.push(rowData);
    });

    return data;
  }

  /**
   * Parsing file Excel legacy
   */
  private async parseExcelLegacyFile(buffer: Buffer, skipRows: number = 1): Promise<any[]> {
    const workbook = XLSX.read(buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    return jsonData.slice(skipRows);
  }

  /**
   * Parsing file CSV
   */
  private async parseCSVFile(buffer: Buffer, skipRows: number = 1): Promise<any[]> {
    const csvText = buffer.toString('utf-8');
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    const data: any[] = [];
    for (let i = skipRows + 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const rowData: any = {};
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });
        data.push(rowData);
      }
    }

    return data;
  }

  /**
   * Processa utenti importati
   */
  private async processImportedUsers(data: any[], mapping: Record<string, string> = {}, userId: string): Promise<{
    processed: number;
    errors: string[];
    success: any[];
  }> {
    const results = {
      processed: 0,
      errors: [] as string[],
      success: [] as any[]
    };

    for (const row of data) {
      try {
        // Applica mapping se fornito
        const mappedData = mapping ? this.applyMapping(row, mapping) : row;

        // Valida dati
        const validation = this.validateUserData(mappedData);
        if (!validation.isValid) {
          results.errors.push(`Riga ${results.processed + 1}: ${validation.errors.join(', ')}`);
          continue;
        }

        // Crea utente
        const utente: UtenteCreationAttributes = {
          email_utenti: mappedData.email || mappedData.Email,
          password_utenti: 'PasswordTemporanea123!',
          nome_utenti: mappedData.nome || mappedData.Nome,
          cognome_utenti: mappedData.cognome || mappedData.Cognome,
          tipo_utenti: mappedData.tipo || mappedData.Tipo as TIPO_UTENTI,
          stato_utenti: (mappedData.stato || mappedData.Stato) as STATO_UTENTI,
          residenza_utenti: mappedData.residenza || mappedData.Residenza,
          datadinascita_utenti: new Date(mappedData.dataDiNascita || mappedData['Data di Nascita']),
          outsider_utenti: false
        };

        const result = await this.userService.register(utente);
        results.success.push(result);
        results.processed++;

      } catch (error) {
        results.errors.push(`Riga ${results.processed + 1}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
      }
    }

    return results;
  }

  /**
   * Applica mapping ai dati
   */
  private applyMapping(data: any, mapping: Record<string, string>): any {
    const mapped: any = {};
    Object.keys(mapping).forEach(key => {
      mapped[key] = data[mapping[key]];
    });
    return mapped;
  }

  /**
   * Valida dati utente
   */
  private validateUserData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.email && !data.Email) errors.push('Email mancante');
    if (!data.nome && !data.Nome) errors.push('Nome mancante');
    if (!data.cognome && !data.Cognome) errors.push('Cognome mancante');
    if (!data.tipo && !data.Tipo) errors.push('Tipo utente mancante');

    return {
      isValid: errors.length === 0,
      errors
    };
  }


  /**
   * Crea buffer CSV
   */
  private async createCSVBuffer(data: any[], includeHeaders: boolean): Promise<Buffer> {
    let csv = '';

    if (includeHeaders && data.length > 0) {
      const headers = Object.keys(data[0]);
      csv += headers.join(',') + '\n';
    }

    data.forEach(row => {
      const values = Object.values(row).map(value =>
        typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      );
      csv += values.join(',') + '\n';
    });

    return Buffer.from(csv, 'utf-8');
  }

  private async getGlobalFilters(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.session.id_utente as string;
      const user = await this.userService.getUserById(userId);
      if (!user) throw new Error('Utente non trovato');
      const filters: GlobalUserFilter = this.agenziaLib.getGlobalFiltersForUser({
        tipo: user.tipo,
        meta: user.meta,
      });
      this.sendResponse(res, HttpStatusCode.OK, filters);
    } catch (err) {
      this.handleError(res, err);
    }
  }
}
