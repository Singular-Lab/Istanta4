import { Request, Response } from 'express';
import { PERMESSI } from '../../../lib/accessi/catalogo';
import { HttpStatusCode } from '../../../lib/enums';
import { ForbiddenError, UnauthorizedError } from '../../../lib/errors';
import type { AuthProviderInput } from '../../../lib/types';
import { apriSessioneEsterna, redirectErroreAccessoEsterno } from '../accessi/sessioneEsterna';
import type { IAgenziaLib } from '../agenzia_lib/types';
import { BaseController } from '../base/BaseController';
import type { IAuthProviderService } from '../interfaces/IAuthProviderService';
import type { ISamlService } from '../interfaces/ISamlService';
import type { IUserService } from '../interfaces/IUserService';
import { log } from '../logger';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { authRateLimiter } from '../middleware/rateLimiter';
import type { IAuthProviderRepository } from '../repositories/AuthProviderRepository';
import { AuditLogService } from '../services/AuditLogService';
import { motivoRifiutoAccesso } from '../services/authProviders/configurazioneProvider';

/**
 * Metodi di accesso: gestione riservata al Superadmin (sistema.gestisci_metodi_accesso)
 * e flusso di accesso SAML 2.0. Il flusso OIDC e l'elenco pubblico per il login
 * restano in HubController.
 */
export class MetodiAccessoController extends BaseController {
  constructor(
    private authProviderService: IAuthProviderService,
    private samlService: ISamlService,
    private authProviderRepository: IAuthProviderRepository,
    private userService: IUserService,
    private agenziaLib: IAgenziaLib,
  ) {
    super('/api');
  }

  protected setupRoutes(): void {
    const gestione = [authMiddleware, permissionGuard(PERMESSI.SISTEMA.GESTISCI_METODI_ACCESSO)];

    // Le route con percorso fisso prima di quelle con :id
    this.router.get('/auth-providers/admin', ...gestione, this.elenco.bind(this));
    this.router.post('/auth-providers/riordina', ...gestione, this.riordina.bind(this));
    this.router.post('/auth-providers/segreti/migra', ...gestione, this.migraSegreti.bind(this));
    this.router.post('/auth-providers/importa/oidc-discovery', ...gestione, this.importaDiscovery.bind(this));
    this.router.post('/auth-providers/importa/saml-metadata', ...gestione, this.importaMetadati.bind(this));
    this.router.post('/auth-providers', ...gestione, this.crea.bind(this));
    this.router.put('/auth-providers/:id', ...gestione, this.modifica.bind(this));
    this.router.delete('/auth-providers/:id', ...gestione, this.elimina.bind(this));
    this.router.post('/auth-providers/:id/verifica', ...gestione, this.verifica.bind(this));

    // SAML 2.0 — pubblici
    this.router.get('/auth/saml/authorize/:codice', authRateLimiter, this.samlAuthorize.bind(this));
    this.router.post('/auth/saml/acs/:codice', authRateLimiter, this.samlAcs.bind(this));
    this.router.get('/auth/saml/metadata/:codice', this.samlMetadata.bind(this));
  }

  // ─── Gestione ───────────────────────────────────────────

  private audit(req: Request, azione: string, dettagli: Record<string, unknown>): void {
    AuditLogService.getInstance().configurationChanged(req, 'auth_provider', azione, dettagli);
  }

  private async elenco(_req: Request, res: Response): Promise<void> {
    try {
      this.sendResponse(res, HttpStatusCode.OK, await this.authProviderService.getAllProvidersAdmin());
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async crea(req: Request, res: Response): Promise<void> {
    try {
      const provider = await this.authProviderService.createProvider(req.body as AuthProviderInput);
      this.audit(req, 'create', { codice: provider.codice, tipo: provider.tipo });
      this.sendResponse(res, HttpStatusCode.CREATED, provider);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async modifica(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const input = req.body as AuthProviderInput;
      const provider = await this.authProviderService.updateProvider(req.params.id, input);
      if (!provider) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Metodo di accesso non trovato' });
        return;
      }
      // Solo i nomi dei campi: i valori dei segreti non vanno nel registro
      this.audit(req, 'update', {
        codice: provider.codice,
        attivo: provider.attivo,
        campi: Object.keys(input ?? {}),
        segreti_modificati: Object.keys(input?.config_server ?? {}).filter((k) => k in provider.segreti && input.config_server?.[k]),
        segreti_rimossi: input?.segreti_da_rimuovere ?? [],
      });
      this.sendResponse(res, HttpStatusCode.OK, provider);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async elimina(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const eliminato = await this.authProviderService.deleteProvider(req.params.id);
      if (!eliminato) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Metodo di accesso non trovato' });
        return;
      }
      this.audit(req, 'delete', { id: req.params.id });
      this.sendResponse(res, HttpStatusCode.OK, { message: 'Metodo di accesso eliminato' });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async riordina(req: Request, res: Response): Promise<void> {
    try {
      const providers = await this.authProviderService.riordinaProviders(req.body?.ids);
      this.audit(req, 'reorder', { ordine: providers.map((p) => p.codice) });
      this.sendResponse(res, HttpStatusCode.OK, providers);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /** Dalla pagina solo cifratura; il ritorno in chiaro e' dello script cifraSegretiProvider. */
  private async migraSegreti(req: Request, res: Response): Promise<void> {
    try {
      const simulazione = req.body?.simulazione === true;
      const esito = await this.authProviderService.migraSegreti('cifra', simulazione);
      if (!simulazione) this.audit(req, 'encrypt_secrets', { provider: esito.provider, totale: esito.totaleCampi });
      this.sendResponse(res, HttpStatusCode.OK, esito);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async importaDiscovery(req: Request, res: Response): Promise<void> {
    try {
      this.sendResponse(res, HttpStatusCode.OK, await this.authProviderService.importaDiscoveryOidc(req.body?.url));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async importaMetadati(req: Request, res: Response): Promise<void> {
    try {
      this.sendResponse(res, HttpStatusCode.OK, await this.authProviderService.importaMetadatiSaml({
        xml: typeof req.body?.xml === 'string' ? req.body.xml : undefined,
        url: typeof req.body?.url === 'string' ? req.body.url : undefined,
      }));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async verifica(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const esiti = await this.authProviderService.verificaProvider(req.params.id);
      if (!esiti) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Metodo di accesso non trovato' });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, esiti);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // ─── SAML 2.0 ───────────────────────────────────────────

  private async providerSaml(codice: string, soloAttivo: boolean) {
    const provider = await this.authProviderRepository.findByCode(codice);
    if (!provider || provider.tipo !== 'saml' || (soloAttivo && !provider.attivo)) return null;
    return provider;
  }

  /** Avvio dell'accesso: il browser va all'URL restituito, come per OIDC. */
  private async samlAuthorize(req: Request<{ codice: string }>, res: Response): Promise<void> {
    try {
      const provider = await this.providerSaml(req.params.codice, true);
      if (!provider) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Provider SAML non trovato o non attivo' });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, { authorize_url: await this.samlService.getAuthorizeUrl(provider) });
    } catch (error) {
      log.error('[MetodiAccessoController] samlAuthorize error:', error);
      this.handleError(res, error);
    }
  }

  /** Risposta dell'IdP (HTTP-POST binding). */
  private async samlAcs(req: Request<{ codice: string }>, res: Response): Promise<void> {
    try {
      const provider = await this.providerSaml(req.params.codice, true);
      if (!provider) throw new UnauthorizedError({ message: 'Provider SAML non trovato o non attivo' });

      const body = req.body ?? {};
      if (typeof body.SAMLResponse !== 'string') throw new UnauthorizedError({ message: 'Risposta SAML mancante' });

      const claims = await this.samlService.validaRisposta(provider, {
        SAMLResponse: body.SAMLResponse,
        ...(typeof body.RelayState === 'string' ? { RelayState: body.RelayState } : {}),
      });
      if (!claims.email) throw new UnauthorizedError({ message: 'Email non disponibile nella risposta SAML' });

      const parsed = await this.agenziaLib.parseUtenteOIDC(claims.email, claims);
      const rifiuto = motivoRifiutoAccesso(provider, claims.email, parsed.tipo_utente);
      if (rifiuto) throw new ForbiddenError({ message: rifiuto });
      await this.userService.verificaAccountAttivo(parsed.id);

      await apriSessioneEsterna(req, parsed);
      log.info(`[MetodiAccessoController] SAML login riuscito per ${claims.email}`);
      res.redirect('/hub');
    } catch (error) {
      log.error('[MetodiAccessoController] samlAcs error:', error);
      res.redirect(redirectErroreAccessoEsterno(error, 'saml'));
    }
  }

  private async samlMetadata(req: Request<{ codice: string }>, res: Response): Promise<void> {
    try {
      const provider = await this.providerSaml(req.params.codice, false);
      if (!provider) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Provider SAML non trovato' });
        return;
      }
      res.type('application/samlmetadata+xml').send(this.samlService.generaMetadati(provider));
    } catch (error) {
      this.handleError(res, error);
    }
  }
}
