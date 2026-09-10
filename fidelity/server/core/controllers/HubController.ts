import { Request, Response } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { encryptString } from '../../../lib/encryption';
import { HttpStatusCode, TIPO_UTENTI } from '../../../lib/enums';
import {
  ExternalApiError,
  ForbiddenError,
  isAppError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '../../../lib/errors';
import type { IAgenziaLib } from '../agenzia_lib/types';
import { BaseController } from '../base/BaseController';
import config from '../config';
import { uploadHubServiceDocuments, uploadHubServiceVideos } from '../config/multerConfig';
import type { IAuthProviderService } from '../interfaces/IAuthProviderService';
import type { IHubNewsService } from '../interfaces/IHubNewsService';
import type { IHubServiceService } from '../interfaces/IHubServiceService';
import type { IMenuService } from '../interfaces/IMenuService';
import type { IOidcService, OidcUserClaims } from '../interfaces/IOidcService';
import type { IUserService } from '../interfaces/IUserService';
import { log } from '../logger';
import { authMiddleware } from '../middleware/authMiddleware';
import type { IAuthProviderRepository } from '../repositories/AuthProviderRepository';
import { AuditLogService } from '../services/AuditLogService';
import { buildHubUserContext, type HubUserContext } from '../services/hubRoleUtils';
import { ServerUtils } from '../utils/ServerUtils';

function createSingleFileUploadMiddleware(
  upload: ReturnType<typeof uploadHubServiceDocuments.single>
) {
  return (req: Request, res: Response, next: (error?: unknown) => void) => {
    upload(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        res.status(HttpStatusCode.BAD_REQUEST).json({
          success: false,
          error: error.code,
          message: error.message,
        });
        return;
      }

      if (error) {
        res.status(HttpStatusCode.BAD_REQUEST).json({
          success: false,
          error: 'UPLOAD_ERROR',
          message: error instanceof Error ? error.message : 'Upload non riuscito',
        });
        return;
      }

      next();
    });
  };
}

function deriveAssetTitle(fileName: string): string {
  const baseName = path.basename(fileName, path.extname(fileName));
  const normalized = baseName.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized || fileName;
}

export class HubController extends BaseController {
  constructor(
    private authProviderService: IAuthProviderService,
    private hubServiceService: IHubServiceService,
    private hubNewsService: IHubNewsService,
    private menuService?: IMenuService,
    private userService?: IUserService,
    private oidcService?: IOidcService,
    private authProviderRepository?: IAuthProviderRepository,
    private agenziaLib?: IAgenziaLib
  ) {
    super('/api');
  }

  protected setupRoutes(): void {
    const uploadHubServiceDocumentMiddleware = createSingleFileUploadMiddleware(uploadHubServiceDocuments.single('file'));
    const uploadHubServiceVideoMiddleware = createSingleFileUploadMiddleware(uploadHubServiceVideos.single('file'));

    // Pubblico — lista provider attivi per il login
    this.router.get('/auth-providers', this.getAuthProviders.bind(this));

    // OIDC — flusso di autenticazione (pubblici)
    this.router.get('/auth/oidc/authorize/:codice', this.oidcAuthorize.bind(this));
    this.router.get('/auth/oidc/callback', this.oidcCallback.bind(this));
    //HACK questa è una chiamata creata per TEST
    this.router.get('/auth/oidc/fake-callback', this.oidcFakeCallback.bind(this));

    // Autenticato — info utente sessione per la dashboard hub
    this.router.get('/hub-user-info', authMiddleware, this.getHubUserInfo.bind(this));

    // Autenticato — URL con contesto criptato per servizi external_fico
    this.router.get('/hub-services/fico-context', authMiddleware, this.getFicoContext.bind(this));

    // Autenticato — servizi per il ruolo dell'utente
    this.router.get('/hub-services', authMiddleware, this.getHubServices.bind(this));

    // Admin — tutti i servizi raggruppati per codice
    this.router.get('/hub-services/admin', authMiddleware, this.getHubServicesAdmin.bind(this));
    this.router.post('/hub-services/assets/document', uploadHubServiceDocumentMiddleware, authMiddleware, this.uploadHubServiceDocument.bind(this));
    this.router.post('/hub-services/assets/video', uploadHubServiceVideoMiddleware, authMiddleware, this.uploadHubServiceVideo.bind(this));

    // Admin CRUD — Auth Providers
    this.router.post('/auth-providers', authMiddleware, this.createAuthProvider.bind(this));
    this.router.put('/auth-providers/:id', authMiddleware, this.updateAuthProvider.bind(this));
    this.router.delete('/auth-providers/:id', authMiddleware, this.deleteAuthProvider.bind(this));

    // Autenticato — news per il ruolo dell'utente
    this.router.get('/hub-news', authMiddleware, this.getHubNews.bind(this));
    this.router.get('/hub-news/admin', authMiddleware, this.getHubNewsAdmin.bind(this));

    // Admin CRUD — Hub Services
    this.router.post('/hub-services', authMiddleware, this.createHubService.bind(this));
    this.router.post('/hub-services/bulk', authMiddleware, this.bulkCreateHubService.bind(this));
    this.router.patch('/hub-services/bulk', authMiddleware, this.bulkUpdateHubServices.bind(this));
    this.router.put('/hub-services/:id', authMiddleware, this.updateHubService.bind(this));
    this.router.delete('/hub-services/by-code/:codice', authMiddleware, this.deleteHubServiceByCode.bind(this));
    this.router.delete('/hub-services/:id', authMiddleware, this.deleteHubService.bind(this));

    // Admin CRUD — Hub News
    this.router.post('/hub-news', authMiddleware, this.createHubNews.bind(this));
    this.router.put('/hub-news/:id', authMiddleware, this.updateHubNews.bind(this));
    this.router.delete('/hub-news/:id', authMiddleware, this.deleteHubNews.bind(this));
  }

  // ─── Auth Providers ─────────────────────────────────────────

  private async getAuthProviders(req: Request, res: Response): Promise<void> {
    try {
      const providers = await this.authProviderService.getActiveProviders();
      this.sendResponse(res, HttpStatusCode.OK, providers);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async createAuthProvider(req: Request, res: Response): Promise<void> {
    try {
      if (req.session?.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
        this.sendResponse(res, HttpStatusCode.FORBIDDEN, { message: 'Solo Superadmin può creare provider' });
        return;
      }
      const provider = await this.authProviderService.createProvider(req.body);
      this.sendResponse(res, HttpStatusCode.CREATED, provider);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async updateAuthProvider(req: Request, res: Response): Promise<void> {
    try {
      if (req.session?.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
        this.sendResponse(res, HttpStatusCode.FORBIDDEN, { message: 'Solo Superadmin può modificare provider' });
        return;
      }
      const provider = await this.authProviderService.updateProvider(req.params.id, req.body);
      if (!provider) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Provider non trovato' });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, provider);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async deleteAuthProvider(req: Request, res: Response): Promise<void> {
    try {
      if (req.session?.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
        this.sendResponse(res, HttpStatusCode.FORBIDDEN, { message: 'Solo Superadmin può eliminare provider' });
        return;
      }
      const deleted = await this.authProviderService.deleteProvider(req.params.id);
      if (!deleted) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Provider non trovato' });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, { message: 'Provider eliminato' });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // ─── OIDC Flow ─────────────────────────────────────────

  /**
   * Step 1: Genera l'authorize URL con PKCE e salva state/nonce/code_verifier in sessione.
   * Il frontend chiama GET /api/auth/oidc/authorize/:codice e riceve l'URL a cui fare redirect.
   */
  private async oidcAuthorize(req: Request, res: Response): Promise<void> {
    try {
      const { codice } = req.params;

      if (!this.oidcService || !this.authProviderRepository) {
        this.sendResponse(res, HttpStatusCode.SERVICE_UNAVAILABLE, { message: 'OIDC non configurato' });
        return;
      }

      // Carica il provider completo (con config_server) dal repository
      const provider = await this.authProviderRepository.findByCode(codice);
      if (!provider || !provider.attivo || provider.tipo !== 'oidc') {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Provider OIDC non trovato o non attivo' });
        return;
      }

      const { params, code_verifier, nonce, state } = await this.oidcService.generateAuthorizeParams(provider);

      // Salva in sessione per la callback
      req.session.oidc_state = state;
      req.session.oidc_nonce = nonce;
      req.session.oidc_code_verifier = code_verifier;
      req.session.oidc_provider_code = codice;

      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => err ? reject(err) : resolve());
      });

      // Compone l'URL di autorizzazione completo
      const authorizeUrl = new URL(params.authorize_url);
      authorizeUrl.searchParams.set('client_id', params.client_id);
      authorizeUrl.searchParams.set('response_type', 'code');
      authorizeUrl.searchParams.set('redirect_uri', params.redirect_uri);
      authorizeUrl.searchParams.set('scope', params.scope);
      authorizeUrl.searchParams.set('state', params.state);
      authorizeUrl.searchParams.set('nonce', params.nonce);
      authorizeUrl.searchParams.set('code_challenge', params.code_challenge);
      authorizeUrl.searchParams.set('code_challenge_method', params.code_challenge_method);
      authorizeUrl.searchParams.set('response_mode', 'query');

      this.sendResponse(res, HttpStatusCode.OK, { authorize_url: authorizeUrl.toString() });
    } catch (error) {
      log.error('[HubController] oidcAuthorize error:', error);
      this.handleError(res, error);
    }
  }

  /**
   * Step 2: Callback OIDC — riceve il code da Entra ID / provider OIDC,
   * scambia per token, valida id_token, cerca/crea utente, crea sessione.
   */
  private async oidcCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state, error: oidcError, error_description } = req.query;

      // Gestisci errori dal provider
      if (oidcError) {
        log.warn(`[HubController] OIDC error from provider: ${oidcError} - ${error_description}`);
        res.redirect(`/login?reason=oidc_error&message=${encodeURIComponent(String(error_description || oidcError))}`);
        return;
      }

      if (!code || typeof code !== 'string') {
        res.redirect('/login?reason=oidc_error&message=Codice+di+autorizzazione+mancante');
        return;
      }

      if (!this.oidcService || !this.authProviderRepository || !this.userService) {
        res.redirect('/login?reason=oidc_error&message=OIDC+non+configurato');
        return;
      }

      // Verifica state (CSRF protection)
      const expectedState = req.session.oidc_state;
      if (!expectedState || state !== expectedState) {
        log.warn('[HubController] OIDC state mismatch', { expected: expectedState, received: state });
        res.redirect('/login?reason=oidc_error&message=Richiesta+non+valida+(state+mismatch)');
        return;
      }

      const providerCode = req.session.oidc_provider_code;
      const codeVerifier = req.session.oidc_code_verifier;
      const expectedNonce = req.session.oidc_nonce;

      if (!providerCode || !codeVerifier || !expectedNonce) {
        res.redirect('/login?reason=oidc_error&message=Sessione+OIDC+scaduta');
        return;
      }

      // Carica il provider con config_server
      const provider = await this.authProviderRepository.findByCode(providerCode);
      if (!provider || !provider.attivo) {
        res.redirect('/login?reason=oidc_error&message=Provider+non+trovato');
        return;
      }

      // Scambia code per token
      const tokens = await this.oidcService.exchangeCodeForTokens(provider, code, codeVerifier);

      // Valida l'id_token
      const claims = await this.oidcService.validateIdToken(provider, tokens.id_token, expectedNonce);

      const email = claims.email || claims.preferred_username;
      if (!email) {
        log.error('[HubController] OIDC: nessuna email nei claims', claims);
        res.redirect('/login?reason=oidc_error&message=Email+non+disponibile+dal+provider');
        return;
      }

      // Parsing utente via AgenziaLib (logica custom per cliente)
      if (!this.agenziaLib) {
        res.redirect('/login?reason=oidc_error&message=AgenziaLib+non+configurata');
        return;
      }

      const parsed = await this.agenziaLib.parseUtenteOIDC(email, claims);

      // Rigenera la sessione per prevenire session fixation
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => err ? reject(err) : resolve());
      });

      // Imposta i dati della nuova sessione dal risultato di AgenziaLib
      req.session.id_utente = parsed.id;
      req.session.private_key = parsed.private_key;
      req.session.id_gdo = parsed.id_gdo;
      req.session.email = parsed.email;
      req.session.tipo_utente = parsed.tipo_utente;
      req.session.codice_posizione = parsed.codice_posizione;
      req.session.isExternalAuth = true;

      // Security tracking
      req.session.lastActivity = new Date();
      req.session.lastIP = req.ip;
      req.session.lastUserAgent = req.get('user-agent');

      // Pulisci i dati OIDC dalla sessione
      req.session.oidc_state = undefined;
      req.session.oidc_nonce = undefined;
      req.session.oidc_code_verifier = undefined;
      req.session.oidc_provider_code = undefined;

      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => err ? reject(err) : resolve());
      });

      // Audit log
      const auditService = AuditLogService.getInstance();
      auditService.loginSuccess(req, parsed.id, parsed.tipo_utente);

      log.info(`[HubController] OIDC login riuscito per ${email} via fake-callback`);

      // Redirect alla dashboard
      res.redirect('/hub');
    } catch (error) {
      log.error('[HubController] oidcCallback error:', error);
      res.redirect(this.oidcErrorRedirect(error));
    }
  }
  private async oidcFakeCallback(req: Request, res: Response): Promise<void> {
    try {
      const { oid, email } = req.query;

      const falseClaims: OidcUserClaims = {
        sub: "",
        oid: oid as string,
        email: email as string
      }
      const parsed = await this.agenziaLib.parseUtenteOIDC(email as string, falseClaims);

      // Rigenera la sessione per prevenire session fixation
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => err ? reject(err) : resolve());
      });

      // Imposta i dati della nuova sessione dal risultato di AgenziaLib
      req.session.id_utente = parsed.id;
      req.session.private_key = parsed.private_key;
      req.session.id_gdo = parsed.id_gdo;
      req.session.email = parsed.email;
      req.session.tipo_utente = parsed.tipo_utente;
      req.session.codice_posizione = parsed.codice_posizione;
      req.session.isExternalAuth = true;
      // Security tracking
      req.session.lastActivity = new Date();
      req.session.lastIP = req.ip;
      req.session.lastUserAgent = req.get('user-agent');

      // Pulisci i dati OIDC dalla sessione
      req.session.oidc_state = undefined;
      req.session.oidc_nonce = undefined;
      req.session.oidc_code_verifier = undefined;
      req.session.oidc_provider_code = undefined;

      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => err ? reject(err) : resolve());
      });

      // Audit log
      const auditService = AuditLogService.getInstance();
      auditService.loginSuccess(req, parsed.id, parsed.tipo_utente);

      log.info(`[HubController] OIDC login riuscito per ${email} via fake-callback`);

      // Redirect alla dashboard
      res.redirect('/hub');
    } catch (error) {
      log.error('[HubController] oidcCallback error:', error);
      res.redirect(this.oidcErrorRedirect(error));
    }
  }

  // ─── OIDC Error Mapping ────────────────────────────────────

  /**
   * Mappa un errore lanciato da `parseUtenteOIDC` (o dal flusso OIDC) in un URL
   * di redirect verso `/login` con `reason` e `message` appropriati, così che
   * l'interfaccia possa mostrare messaggi distinti per ogni casistica.
   *
   * Reason codes:
   * - `oidc_user_not_found`       → utente non trovato/non censito
   * - `oidc_access_denied`        → accesso negato (Forbidden/Unauthorized)
   * - `oidc_service_unavailable`  → servizio esterno non disponibile
   * - `oidc_rate_limited`         → rate limit superato
   * - `oidc_external_error`       → errore generico API esterna
   * - `oidc_error`                → fallback generico
   */
  private oidcErrorRedirect(error: unknown): string {
    const base = '/login';

    if (error instanceof NotFoundError) {
      return `${base}?reason=oidc_user_not_found&message=${encodeURIComponent(error.message)}`;
    }

    if (error instanceof ForbiddenError || error instanceof UnauthorizedError) {
      return `${base}?reason=oidc_access_denied&message=${encodeURIComponent(error.message)}`;
    }

    if (error instanceof ServiceUnavailableError) {
      return `${base}?reason=oidc_service_unavailable&message=${encodeURIComponent(error.message)}`;
    }

    if (error instanceof RateLimitError) {
      return `${base}?reason=oidc_rate_limited&message=${encodeURIComponent(error.message)}`;
    }

    if (error instanceof ExternalApiError) {
      return `${base}?reason=oidc_external_error&message=${encodeURIComponent(error.message)}`;
    }

    if (isAppError(error)) {
      return `${base}?reason=oidc_error&message=${encodeURIComponent(error.message)}`;
    }

    return `${base}?reason=oidc_error&message=${encodeURIComponent('Errore durante autenticazione')}`;
  }

  // ─── Hub User Info ─────────────────────────────────────────

  private async getHubUserInfo(req: Request, res: Response): Promise<void> {
    try {
      const context = await this.resolveHubUserContext(req);
      const user = await this.userService.getUserById(req.session?.id_utente)
      this.sendResponse(res, HttpStatusCode.OK, {
        id: req.session?.id_utente,
        email: user.email,
        tipo_utente: user.tipo,
        ruolo_gdo_key: user.tipo === TIPO_UTENTI.GDO ? context.ruoloGdoKey : undefined,
        photo: user.meta?.photo ? user.meta?.photo : undefined
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // ─── Hub Services ─────────────────────────────────────────

  private async getHubServices(req: Request, res: Response): Promise<void> {
    try {
      const context = await this.resolveHubUserContext(req);
      const services = await this.hubServiceService.getServicesForRole(context);
      const startPageUrl = await this.resolveStartPage(context.userType, context.ruoloGdoKey);

      const resolvedServices = services.map((service) => {
        if (service.tipo_url === 'internal') {
          return { ...service, url: startPageUrl ?? '/hub' };
        }
        return service;
      });

      this.sendResponse(res, HttpStatusCode.OK, resolvedServices);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getHubServicesAdmin(req: Request, res: Response): Promise<void> {
    try {
      if (req.session?.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
        this.sendResponse(res, HttpStatusCode.FORBIDDEN, { message: 'Solo Superadmin può visualizzare tutti i servizi' });
        return;
      }
      const grouped = await this.hubServiceService.getAllServicesGrouped();
      this.sendResponse(res, HttpStatusCode.OK, grouped);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async uploadHubServiceDocument(req: Request, res: Response): Promise<void> {
    try {
      if (req.session?.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
        this.sendResponse(res, HttpStatusCode.FORBIDDEN, { message: 'Solo Superadmin può caricare documentazione servizio' });
        return;
      }

      if (!req.file) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: 'Nessun file caricato' });
        return;
      }

      const fileHash = crypto.createHash('md5').update(req.file.buffer).digest('hex');
      const fileBlob = new Blob([new Uint8Array(req.file.buffer)], {
        type: req.file.mimetype || 'application/octet-stream',
      });
      const formData = new FormData();
      formData.append('file', fileBlob, req.file.originalname);
      formData.append('json_meta_materiale', JSON.stringify({
        Id: '',
        FileHash: fileHash,
        FileName: req.file.originalname,
        JsonMeta: {
          source: 'hub_service',
          scope: 'documentation',
        },
      }));

      const result = await ServerUtils.sendToFicoApiAxiosUpload<{
        esito: boolean;
        error?: string;
        content: {
          id: string;
          file_name: string;
          pagine?: number;
        };
      }>(
        req,
        `${config.OLYMPUS_IP_ADDRESS}/materiali/uploadMateriale`,
        formData
      );

      if (
        result.status < 200 ||
        result.status >= 300 ||
        !result.data?.esito ||
        !result.data.content?.id
      ) {
        throw new ExternalApiError({
          message: result.data?.error || result.statusText || 'Errore durante il caricamento della documentazione su Olimpo',
          service: 'OLYMPUS',
          endpoint: '/materiali/uploadMateriale',
        });
      }

      const olympusId = result.data.content.id;
      this.sendResponse(res, HttpStatusCode.OK, {
        id: crypto.randomUUID(),
        title: deriveAssetTitle(req.file.originalname),
        original_name: result.data.content.file_name || req.file.originalname,
        mime_type: req.file.mimetype || 'application/octet-stream',
        size: req.file.size,
        extension: path.extname(req.file.originalname).toLowerCase() || undefined,
        id_olimpo_cloud: olympusId,
        download_url: `${config.OLYMPUS_IP_ADDRESS}/materiali/getMaterialePDF?id=${olympusId}`,
        preview_url: req.file.mimetype === 'application/pdf'
          ? `${config.OLYMPUS_IP_ADDRESS}/materiali/getThumbnailMaterialePdfs?&id=${olympusId}`
          : undefined,
        pages: result.data.content.pagine,
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async uploadHubServiceVideo(req: Request, res: Response): Promise<void> {
    try {
      if (req.session?.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
        this.sendResponse(res, HttpStatusCode.FORBIDDEN, { message: 'Solo Superadmin può caricare video servizio' });
        return;
      }

      if (!req.file) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: 'Nessun file caricato' });
        return;
      }

      const fileBlob = new Blob([new Uint8Array(req.file.buffer)], {
        type: req.file.mimetype || 'video/mp4',
      });
      const formData = new FormData();
      formData.append('data', JSON.stringify({
        id: crypto.randomUUID(),
        scope: 'hub_service',
        type: 'video',
      }));
      formData.append('file', fileBlob, req.file.originalname);

      const result = await ServerUtils.sendToFicoApiAxiosUpload<{
        esito: boolean;
        error?: string;
        content?: {
          file: string;
        };
      }>(
        req,
        `${config.OLYMPUS_IP_ADDRESS}/materiali/uploadVideoBase`,
        formData
      );

      const guidId = result.data?.content?.file;
      if (
        result.status < 200 ||
        result.status >= 300 ||
        !result.data?.esito ||
        !guidId
      ) {
        throw new ExternalApiError({
          message: result.data?.error || result.statusText || 'Errore durante il caricamento del video su Olimpo',
          service: 'OLYMPUS',
          endpoint: '/materiali/uploadVideoBase',
        });
      }

      this.sendResponse(res, HttpStatusCode.OK, {
        id: crypto.randomUUID(),
        title: deriveAssetTitle(req.file.originalname),
        kind: 'guide',
        original_name: req.file.originalname,
        mime_type: req.file.mimetype || 'video/mp4',
        size: req.file.size,
        guid_id: guidId,
        url: `${config.OLYMPUS_IP_ADDRESS}/materiali/getVideoOnDemand?guidId=${guidId}`,
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Risolve la start_page dal menu dell'utente per determinare l'URL di atterraggio
   */
  private async resolveStartPage(userType: string, ruoloGdo?: string): Promise<string | null> {
    try {
      if (!this.menuService) return null;

      const menuKey = userType;
      const ruoloKey = (userType === TIPO_UTENTI.GDO && ruoloGdo) ? ruoloGdo : undefined;

      const menu = await this.menuService.getMenuPerUtente(menuKey, ruoloKey);
      if (!Array.isArray(menu) || menu.length === 0) return null;

      const paginaDiStart = menu.find((item: any) => typeof item === 'object' && item.start_page);
      if (paginaDiStart && typeof paginaDiStart === 'object' && 'pathname' in paginaDiStart && paginaDiStart.pathname) {
        return paginaDiStart.pathname;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async createHubService(req: Request, res: Response): Promise<void> {
    try {
      if (req.session?.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
        this.sendResponse(res, HttpStatusCode.FORBIDDEN, { message: 'Solo Superadmin può creare servizi' });
        return;
      }
      const service = await this.hubServiceService.createService(req.body);
      this.sendResponse(res, HttpStatusCode.CREATED, service);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async bulkCreateHubService(req: Request, res: Response): Promise<void> {
    try {
      if (req.session?.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
        this.sendResponse(res, HttpStatusCode.FORBIDDEN, { message: 'Solo Superadmin può creare servizi' });
        return;
      }
      const services = await this.hubServiceService.bulkCreateService(req.body);
      this.sendResponse(res, HttpStatusCode.CREATED, services);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async bulkUpdateHubServices(req: Request, res: Response): Promise<void> {
    try {
      if (req.session?.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
        this.sendResponse(res, HttpStatusCode.FORBIDDEN, { message: 'Solo Superadmin può modificare servizi' });
        return;
      }
      const { ids, patch } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: 'ids deve essere un array non vuoto' });
        return;
      }
      if (!patch || typeof patch !== 'object' || Object.keys(patch).length === 0) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: 'patch deve contenere almeno un campo da aggiornare' });
        return;
      }
      const services = await this.hubServiceService.bulkUpdateServices(ids, patch);
      this.sendResponse(res, HttpStatusCode.OK, services);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async updateHubService(req: Request, res: Response): Promise<void> {
    try {
      if (req.session?.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
        this.sendResponse(res, HttpStatusCode.FORBIDDEN, { message: 'Solo Superadmin può modificare servizi' });
        return;
      }
      const service = await this.hubServiceService.updateService(req.params.id, req.body);
      if (!service) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Servizio non trovato' });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, service);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async deleteHubService(req: Request, res: Response): Promise<void> {
    try {
      if (req.session?.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
        this.sendResponse(res, HttpStatusCode.FORBIDDEN, { message: 'Solo Superadmin può eliminare servizi' });
        return;
      }
      const deleted = await this.hubServiceService.deleteService(req.params.id);
      if (!deleted) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Servizio non trovato' });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, { message: 'Servizio eliminato' });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async deleteHubServiceByCode(req: Request, res: Response): Promise<void> {
    try {
      if (req.session?.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
        this.sendResponse(res, HttpStatusCode.FORBIDDEN, { message: 'Solo Superadmin può eliminare servizi' });
        return;
      }
      const count = await this.hubServiceService.deleteServiceByCode(req.params.codice);
      if (count === 0) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Nessun servizio trovato con questo codice' });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, { message: `${count} record eliminati`, count });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // ─── Hub News ─────────────────────────────────────────

  private async getHubNews(req: Request, res: Response): Promise<void> {
    try {
      const context = await this.resolveHubUserContext(req);
      const news = await this.hubNewsService.getNewsForRole(context);
      this.sendResponse(res, HttpStatusCode.OK, news);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getHubNewsAdmin(req: Request, res: Response): Promise<void> {
    try {
      if (req.session?.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
        this.sendResponse(res, HttpStatusCode.FORBIDDEN, { message: 'Solo Superadmin può visualizzare tutte le news' });
        return;
      }
      const news = await this.hubNewsService.getAllNews();
      this.sendResponse(res, HttpStatusCode.OK, news);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async createHubNews(req: Request, res: Response): Promise<void> {
    try {
      if (req.session?.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
        this.sendResponse(res, HttpStatusCode.FORBIDDEN, { message: 'Solo Superadmin può creare news' });
        return;
      }
      const news = await this.hubNewsService.createNews(req.body);
      this.sendResponse(res, HttpStatusCode.CREATED, news);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async updateHubNews(req: Request, res: Response): Promise<void> {
    try {
      if (req.session?.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
        this.sendResponse(res, HttpStatusCode.FORBIDDEN, { message: 'Solo Superadmin può modificare news' });
        return;
      }
      const news = await this.hubNewsService.updateNews(req.params.id, req.body);
      if (!news) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'News non trovata' });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, news);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async deleteHubNews(req: Request, res: Response): Promise<void> {
    try {
      if (req.session?.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
        this.sendResponse(res, HttpStatusCode.FORBIDDEN, { message: 'Solo Superadmin può eliminare news' });
        return;
      }
      const deleted = await this.hubNewsService.deleteNews(req.params.id);
      if (!deleted) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'News non trovata' });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, { message: 'News eliminata' });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // ─── FICO Context ─────────────────────────────────────────

  /**
   * Restituisce il parametro `context` criptato da appendere all'URL dei servizi external_fico.
   * Contiene: { publicKey, codicePosizione } cifrati con FICO_SECRET (3DES ECB).
   */
  private async getFicoContext(req: Request, res: Response): Promise<void> {
    try {
      const publicKey = await ServerUtils.getPassportFromOlympo(req);
      const codicePosizione = req.session.codice_posizione ?? '';
      const route = typeof req.query.route === 'string' ? req.query.route : undefined;
      const payload = JSON.stringify({ publicKey, codicePosizione, ...(route ? { route } : {}) });
      const context = encryptString(payload, config.FICO_SECRET as string);
      this.sendResponse(res, HttpStatusCode.OK, {
        context,
        base_url: config.FICO_BASE_URL ?? null,
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async resolveHubUserContext(req: Request): Promise<HubUserContext> {
    const userType = req.session?.tipo_utente || '';
    const userId = req.session?.id_utente;

    if (this.userService) {
      const ruoloGdoKey = await this.userService.resolveGdoRuoloKey(userId);
      return buildHubUserContext(userType, ruoloGdoKey);
    }

    return buildHubUserContext(userType);
  }
}
