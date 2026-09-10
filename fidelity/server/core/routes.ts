import { Express } from 'express';
import { AreaController } from './controllers/AreaController';
import { AttivitaController } from './controllers/AttivitaController';
import { CanaleController } from './controllers/CanaleController';
import { CombinazioneAreeCanaliController } from './controllers/CombinazioneAreeCanaliController';
import { ConfigController } from './controllers/ConfigController';
import { CorreggoController } from './controllers/CorreggoController';
import { DashboardController } from './controllers/DashboardController';
import { SuperadminDashboardController } from './controllers/SuperadminDashboardController';
import { EmailController } from './controllers/EmailController';
import { EphemeralAuthController } from './controllers/EphemeralAuthController';
import { ExternalApiController } from './controllers/ExternalApiController';
import { GPTController } from './controllers/GPTController';
import { GdoController } from './controllers/GdoController';
import { ImpostazioniController } from './controllers/ImpostazioniController';
import { IstantaController } from './controllers/IstantaController';
import { LogController } from './controllers/LogController';
import { OrdiniDiStampaController } from './controllers/OrdiniDiStampaController';
import { PromoController } from './controllers/PromoController';
import { PuntoVenditaController } from './controllers/PuntoVenditaController';
import { ScoreboardController } from './controllers/ScoreboardController';
import { TracciatoController } from './controllers/TracciatoController';
import { TraduzioneController } from './controllers/TraduzioneController';
import { UserController } from './controllers/UserController';
import { WebhookController } from './controllers/WebhookController';
import { WhatsAppController } from './controllers/WhatsAppController';
import { DisplayController } from './controllers/DisplayController';
import { DisplayContextController } from './controllers/DisplayContextController';

// Decomposed controllers
import { FormatoController } from './controllers/FormatoController';
import { TipoExportController } from './controllers/TipoExportController';
import { NamingConventionController } from './controllers/NamingConventionController';
import { ContrattoTipografiaController } from './controllers/ContrattoTipografiaController';
import { KitRuntimeController } from './controllers/KitRuntimeController';
import { DesignKitController } from './controllers/DesignKitController';
import { RaccoglitoreKitController } from './controllers/RaccoglitoreKitController';
import { ReferenzeController } from './controllers/ReferenzeController';
import { WebPliantController } from './controllers/WebPliantController';
import { FileManagementController } from './controllers/FileManagementController';
import { VolantinoController } from './controllers/VolantinoController';

import { IController } from './interfaces/IController';
import { container, initializeContainer, TYPES } from './di';

// Service Interfaces
import type { IAreaService } from './interfaces/IAreaService';
import type { IAttivitaService } from './interfaces/IAttivitaService';
import type { ICanaleService } from './interfaces/ICanaleService';
import type { ICombinazioneAreeCanaliService } from './interfaces/ICombinazioneAreeCanaliService';
import type { IConfigService } from './interfaces/IConfigService';
import type { IDashboardService } from './interfaces/IDashboardService';
import type { IExternalApiService } from './interfaces/IExternalApiService';
import type { IGPTService } from './interfaces/IGPTService';
import type { IGdoService } from './interfaces/IGdoService';
import type { IImpostazioniService } from './interfaces/IImpostazioniService';
import type { IIstantaService } from './interfaces/IIstantaService';
import type { IOrdiniStampaService } from './interfaces/IOrdiniStampaService';
import type { IPromoService } from './interfaces/IPromoService';
import type { IPuntoVenditaService } from './interfaces/IPuntoVenditaService';
import type { IServiceFacade } from './interfaces/IServiceFacade';
import type { IScoreboardService } from './interfaces/IScoreboardService';
import type { ITracciatoService } from './interfaces/ITracciatoService';
import type { ITraduzioneService } from './interfaces/ITraduzioneService';
import type { IUserService } from './interfaces/IUserService';
import type { IWebhookService } from './interfaces/IWebhookService';
import type { IWhatsAppService } from './interfaces/IWhatsAppService';

// Decomposed service interfaces
import type { IFormatoService } from './interfaces/IFormatoService';
import type { ITipoExportService } from './interfaces/ITipoExportService';
import type { INamingConventionService } from './interfaces/INamingConventionService';
import type { IContrattoTipografiaService } from './interfaces/IContrattoTipografiaService';
import type { IKitRuntimeService } from './interfaces/IKitRuntimeService';
import type { IDesignKitService } from './interfaces/IDesignKitService';
import type { IRaccoglitoreKitService } from './interfaces/IRaccoglitoreKitService';
import type { IReferenzeService } from './interfaces/IReferenzeService';
import type { IWebPliantService } from './interfaces/IWebPliantService';
import type { IFileManagementService } from './interfaces/IFileManagementService';
import type { IVolantinoService } from './interfaces/IVolantinoService';

import { ScoreboardService } from './services/ScoreboardService';
import BadgeService from './services/BadgeService';
import { FilterTemplateService } from './services/FilterTemplateService';
import { StatisticheApiService } from './services/StatisticheApiService';
import { DisplayContextService } from './services/DisplayContextService';
import type { IPermessiService } from './interfaces/IPermessiService';
import { PermessiController } from './controllers/PermessiController';
import type { IMenuService } from './interfaces/IMenuService';
import type { IAuthProviderService } from './interfaces/IAuthProviderService';
import type { IAuthProviderRepository } from './repositories/AuthProviderRepository';
import type { IHubServiceService } from './interfaces/IHubServiceService';
import type { IHubNewsService } from './interfaces/IHubNewsService';
import type { IOidcService } from './interfaces/IOidcService';
import { MenuController } from './controllers/MenuController';
import { AuditLogController } from './controllers/AuditLogController';
import { HubController } from './controllers/HubController';
import type { IAgenziaLib } from './agenzia_lib/types';

// Factory per creare i controller
// Uses IoC Container for dependency injection
export async function createControllers(): Promise<IController[]> {
  // Initialize the IoC container (async per AgenziaLib dynamic import)
  await initializeContainer();

  // Resolve services from container
  const webhookService = container.get<IWebhookService>(TYPES.WebhookService);
  const impostazioniService = container.get<IImpostazioniService>(TYPES.ImpostazioniService);
  const gdoService = container.get<IGdoService>(TYPES.GdoService);
  const combinazioneAreeCanaliService = container.get<ICombinazioneAreeCanaliService>(TYPES.CombinazioneAreeCanaliService);
  const puntoVenditaService = container.get<IPuntoVenditaService>(TYPES.PuntoVenditaService);
  const configService = container.get<IConfigService>(TYPES.ConfigService);
  const externalApiService = container.get<IExternalApiService>(TYPES.ExternalApiService);
  const statisticheApiService = container.get<StatisticheApiService>(TYPES.StatisticheApiService);
  const userService = container.get<IUserService>(TYPES.UserService);
  const whatsAppService = container.get<IWhatsAppService>(TYPES.WhatsAppService);
  const areaService = container.get<IAreaService>(TYPES.AreaService);
  const canaleService = container.get<ICanaleService>(TYPES.CanaleService);
  const promoService = container.get<IPromoService>(TYPES.PromoService);
  const ordiniDiStampaService = container.get<IOrdiniStampaService>(TYPES.OrdiniStampaService);
  const traduzioneService = container.get<ITraduzioneService>(TYPES.TraduzioneService);
  const traccatoService = container.get<ITracciatoService>(TYPES.TracciatoService);
  const scoreboardService: IScoreboardService = new ScoreboardService(traccatoService);
  const gptService = container.get<IGPTService>(TYPES.GPTService);
  const attivitaService = container.get<IAttivitaService>(TYPES.AttivitaService);
  const serviceFacade = container.get<IServiceFacade>(TYPES.ServiceFacade);
  const filterTemplateService = container.get<FilterTemplateService>(TYPES.FilterTemplateService);
  const badgeService = container.get<BadgeService>(TYPES.BadgeService);
  const dashboardService = container.get<IDashboardService>(TYPES.DashboardService);
  const displayContextService = container.get<DisplayContextService>(TYPES.DisplayContextService);
  const istantaService = container.get<IIstantaService>(TYPES.IstantaService);

  // Decomposed services
  const formatoService = container.get<IFormatoService>(TYPES.FormatoService);
  const tipoExportService = container.get<ITipoExportService>(TYPES.TipoExportService);
  const namingConventionService = container.get<INamingConventionService>(TYPES.NamingConventionService);
  const contrattoTipografiaService = container.get<IContrattoTipografiaService>(TYPES.ContrattoTipografiaService);
  const kitRuntimeService = container.get<IKitRuntimeService>(TYPES.KitRuntimeService);
  const designKitService = container.get<IDesignKitService>(TYPES.DesignKitService);
  const raccoglitoreKitService = container.get<IRaccoglitoreKitService>(TYPES.RaccoglitoreKitService);
  const referenzeService = container.get<IReferenzeService>(TYPES.ReferenzeService);
  const webPliantService = container.get<IWebPliantService>(TYPES.WebPliantService);
  const fileManagementService = container.get<IFileManagementService>(TYPES.FileManagementService);
  const volantinoService = container.get<IVolantinoService>(TYPES.VolantinoService);
  const permessiService = container.get<IPermessiService>(TYPES.PermessiService);
  const menuService = container.get<IMenuService>(TYPES.MenuService);
  const authProviderService = container.get<IAuthProviderService>(TYPES.AuthProviderService);
  const authProviderRepository = container.get<IAuthProviderRepository>(TYPES.AuthProviderRepository);
  const oidcService = container.get<IOidcService>(TYPES.OidcService);
  const hubServiceService = container.get<IHubServiceService>(TYPES.HubServiceService);
  const hubNewsService = container.get<IHubNewsService>(TYPES.HubNewsService);
  const agenziaLib = container.get<IAgenziaLib>(TYPES.AgenziaLib);

  const logController = new LogController();

  const controllers: IController[] = [
    // Decomposed controllers (registered first for route priority)
    new FormatoController(formatoService),
    new TipoExportController(tipoExportService),
    new NamingConventionController(namingConventionService),
    new ContrattoTipografiaController(contrattoTipografiaService),
    new KitRuntimeController(kitRuntimeService, designKitService),
    new DesignKitController(designKitService, serviceFacade),
    new RaccoglitoreKitController(raccoglitoreKitService),
    new ReferenzeController(referenzeService),
    new WebPliantController(webPliantService, gdoService),
    new FileManagementController(fileManagementService),
    new VolantinoController(volantinoService),

    // Original controllers
    new CorreggoController(kitRuntimeService, serviceFacade),
    new WebhookController(webhookService),
    new ImpostazioniController(impostazioniService, webhookService, configService),
    new UserController(userService, badgeService, gdoService, agenziaLib),
    new CombinazioneAreeCanaliController(combinazioneAreeCanaliService),
    new GPTController(gptService, referenzeService),
    new WhatsAppController(whatsAppService),
    new TraduzioneController(traduzioneService),
    new TracciatoController(traccatoService),
    new ScoreboardController(scoreboardService, userService, agenziaLib),
    new PuntoVenditaController(puntoVenditaService, gdoService),
    new PromoController(promoService, impostazioniService, gdoService),
    new CanaleController(canaleService),
    new AreaController(areaService, gdoService),
    new OrdiniDiStampaController(ordiniDiStampaService, gdoService, kitRuntimeService),
    new GdoController(gdoService, webPliantService, serviceFacade),
    new AttivitaController(attivitaService),
    new ConfigController(configService),
    new DashboardController(dashboardService),
    new SuperadminDashboardController(),
    new IstantaController(istantaService),
    logController,
    new EphemeralAuthController(),
    new ExternalApiController(externalApiService, statisticheApiService, filterTemplateService),
    new EmailController(userService),
    new DisplayController(puntoVenditaService, externalApiService),
    new DisplayContextController(displayContextService),
    new PermessiController(permessiService),
    new MenuController(menuService, userService, badgeService),
    new AuditLogController(),
    new HubController(authProviderService, hubServiceService, hubNewsService, menuService, userService, oidcService, authProviderRepository, agenziaLib),
  ];

  // Trigger inizializzazione AuditLogService con repository dal container
  container.get(TYPES.AuditLogService);

  return controllers;
}

// Funzione per applicare le routes
export async function applyRoutes(app: Express): Promise<void> {
  const controllers = await createControllers();

  controllers.forEach(controller => {
    controller.registerRoutes(app);
  });
}
