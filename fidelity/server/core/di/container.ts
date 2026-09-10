import { Container } from "inversify";
import "reflect-metadata";
import { TYPES } from "./types";

// Infrastructure
import { sequelize } from "../db/SequelizeConnector";
import { log } from "../logger";

// Interfaces
import type { IAreaService } from "../interfaces/IAreaService";
import type { IAttivitaService } from "../interfaces/IAttivitaService";
import type { ICanaleService } from "../interfaces/ICanaleService";
import type { ICombinazioneAreeCanaliService } from "../interfaces/ICombinazioneAreeCanaliService";
import type { IConfigService } from "../interfaces/IConfigService";
import type { IDashboardService } from "../interfaces/IDashboardService";
import type { IExternalApiService } from "../interfaces/IExternalApiService";
import type { IGPTService } from "../interfaces/IGPTService";
import type { IGdoService } from "../interfaces/IGdoService";
import type { IImpostazioniService } from "../interfaces/IImpostazioniService";
import type { IIstantaService } from "../interfaces/IIstantaService";
import type { IOrdiniStampaService } from "../interfaces/IOrdiniStampaService";
import type { IPromoService } from "../interfaces/IPromoService";
import type { IPuntoVenditaService } from "../interfaces/IPuntoVenditaService";
import type { IServiceFacade } from "../interfaces/IServiceFacade";
import type { ITracciatoService } from "../interfaces/ITracciatoService";
import type { ITraduzioneService } from "../interfaces/ITraduzioneService";
import type { IUserService } from "../interfaces/IUserService";
import type { IWebhookService } from "../interfaces/IWebhookService";
import type { IWhatsAppService } from "../interfaces/IWhatsAppService";

// Decomposed service interfaces
import type { IContrattoTipografiaService } from "../interfaces/IContrattoTipografiaService";
import type { IDesignKitService } from "../interfaces/IDesignKitService";
import type { IFileManagementService } from "../interfaces/IFileManagementService";
import type { IFormatoService } from "../interfaces/IFormatoService";
import type { IKitRuntimeService } from "../interfaces/IKitRuntimeService";
import type { INamingConventionService } from "../interfaces/INamingConventionService";
import type { IRaccoglitoreKitService } from "../interfaces/IRaccoglitoreKitService";
import type { IReferenzeService } from "../interfaces/IReferenzeService";
import type { ITipoExportService } from "../interfaces/ITipoExportService";
import type { IVolantinoService } from "../interfaces/IVolantinoService";
import type { IWebPliantService } from "../interfaces/IWebPliantService";
import type { IApprofondimentoVinoRepository } from "../repositories/ApprofondimentoVinoRepository";
import type { IAreaRepository } from "../repositories/AreaRepository";
import type { IAttivitaRepository } from "../repositories/AttivitaRepository";
import type { ICanaleRepository } from "../repositories/CanaleRepository";
import type { ICombinazioneCanaleAreaRepository } from "../repositories/CombinazioneCanaleAreaRepository";
import type { IContenutiAggiuntiviReferenzaRepository } from "../repositories/ContenutiAggiuntiviReferenzaRepository";
import type { IContrattoTipografiaRepository } from "../repositories/ContrattoTipografiaRepository";
import type { IDesignKitRepository } from "../repositories/DesignKitRepository";
import type { IFilesRuntimeRepository } from "../repositories/FilesRuntimeRepository";
import type { IFilterTemplateRepository } from "../repositories/FilterTemplateRepository";
import type { IFormatiRepository } from "../repositories/FormatiRepository";
import type { IGdoRepository } from "../repositories/GdoRepository";
import type { INamingConventionRepository } from "../repositories/NamingConventionRepository";
import type { IOrdiniStampaInviiRepository } from "../repositories/OrdiniStampaInviiRepository";
import type { IOrdiniStampaRepository } from "../repositories/OrdiniStampaRepository";
import type { IPromoRepository } from "../repositories/PromoRepository";
import type { IPuntoVenditaRepository } from "../repositories/PuntoVenditaRepository";
import type { IRaccoglitoreKitRepository } from "../repositories/RaccoglitoreKitRepository";
import type { IReferenzeGruppoRepository } from "../repositories/ReferenzeGruppoRepository";
import type { IReferenzeRepository } from "../repositories/ReferenzeRepository";
import type { IRicetteRepository } from "../repositories/RicetteRepository";
import type { IRuntimeKitRepository } from "../repositories/RuntimeKitRepository";
import type { IRuoloUtenteGdoRepository } from "../repositories/RuoloUtenteGdoRepository";
import type { IStatisticheApiRepository } from "../repositories/StatisticheApiRepository";
import type { ITentativoWebhookRepository } from "../repositories/TentativoWebhookRepository";
import type { ITipiDiExportRepository } from "../repositories/TipiDiExportRepository";
import type { ITracciatiMomentoRepository } from "../repositories/TracciatiMomentoRepository";
import type { ITracciatiReportRepository } from "../repositories/TracciatiReportRepository";
import type { ITracciatiRepository } from "../repositories/TracciatiRepository";
import type { ITracciatiSchemaRepository } from "../repositories/TracciatiSchemaRepository";
import type { IUserRepository } from "../repositories/UserRepository";
import type { IUtentiGdoRepository } from "../repositories/UtentiGdoRepository";
import type { IWebhookRepository } from "../repositories/WebhookRepository";

// Implementations
import { ApprofondimentoVinoRepository } from "../repositories/ApprofondimentoVinoRepository";
import { AreaRepository } from "../repositories/AreaRepository";
import { AttivitaRepository } from "../repositories/AttivitaRepository";
import { CanaleRepository } from "../repositories/CanaleRepository";
import { CombinazioneCanaleAreaRepository } from "../repositories/CombinazioneCanaleAreaRepository";
import { ContenutiAggiuntiviReferenzaRepository } from "../repositories/ContenutiAggiuntiviReferenzaRepository";
import { ContrattoTipografiaRepository } from "../repositories/ContrattoTipografiaRepository";
import { DesignKitRepository } from "../repositories/DesignKitRepository";
import { FilesRuntimeRepository } from "../repositories/FilesRuntimeRepository";
import { FilterTemplateRepository } from "../repositories/FilterTemplateRepository";
import { FormatiRepository } from "../repositories/FormatiRepository";
import { GdoRepository } from "../repositories/GdoRepository";
import { NamingConventionRepository } from "../repositories/NamingConventionRepository";
import { OrdiniStampaInviiRepository } from "../repositories/OrdiniStampaInviiRepository";
import { OrdiniStampaRepository } from "../repositories/OrdiniStampaRepository";
import { PromoRepository } from "../repositories/PromoRepository";
import { PuntoVenditaRepository } from "../repositories/PuntoVenditaRepository";
import { RaccoglitoreKitRepository } from "../repositories/RaccoglitoreKitRepository";
import { ReferenzeGruppoRepository } from "../repositories/ReferenzeGruppoRepository";
import { ReferenzeRepository } from "../repositories/ReferenzeRepository";
import { RicetteRepository } from "../repositories/RicetteRepository";
import { RuntimeKitRepository } from "../repositories/RuntimeKitRepository";
import { RuoloUtenteGdoRepository } from "../repositories/RuoloUtenteGdoRepository";
import { StatisticheApiRepository } from "../repositories/StatisticheApiRepository";
import { TentativoWebhookRepository } from "../repositories/TentativoWebhookRepository";
import { TipiDiExportRepository } from "../repositories/TipiDiExportRepository";
import { TracciatiMomentoRepository } from "../repositories/TracciatiMomentoRepository";
import { TracciatiReportRepository } from "../repositories/TracciatiReportRepository";
import { TracciatiRepository } from "../repositories/TracciatiRepository";
import { TracciatiSchemaRepository } from "../repositories/TracciatiSchemaRepository";
import { UserRepository } from "../repositories/UserRepository";
import { UtentiGdoRepository } from "../repositories/UtentiGdoRepository";
import { WebhookRepository } from "../repositories/WebhookRepository";
import { AreaService } from "../services/AreaService";
import { AttivitaService } from "../services/AttivitaService";
import BadgeService from "../services/BadgeService";
import { CanaleService } from "../services/CanaleService";
import { CombinazioneAreeCanaliService } from "../services/CombinazioneAreeCanaliService";
import { ConfigService } from "../services/ConfigService";
import { DashboardService } from "../services/DashboardService";
import { DesignKitService } from "../services/DesignKitService";
import { DisplayContextService } from "../services/DisplayContextService";
import { ExternalApiService } from "../services/ExternalApiService";
import { FileManagementService } from "../services/FileManagementService";
import { FilterTemplateService } from "../services/FilterTemplateService";
import { FormatoService } from "../services/FormatoService";
import { GPTService } from "../services/GPTService";
import { GdoService } from "../services/GdoService";
import { ImpostazioniService } from "../services/ImpostazioniService";
import { IstantaService } from "../services/IstantaService";
import { KitRuntimeService } from "../services/KitRuntimeService";
import { LogService } from "../services/LogService";
import { OrdiniStampaService } from "../services/OrdiniStampaService";
import { PromoService } from "../services/PromoService";
import { PuntoVenditaService } from "../services/PuntoVenditaService";
import { RaccoglitoreKitService } from "../services/RaccoglitoreKitService";
import { ReferenzeService } from "../services/ReferenzeService";
import { ServiceFacade } from "../services/ServiceFacade";
import { StatisticheApiService } from "../services/StatisticheApiService";
import { TipoExportService } from "../services/TipoExportService";
import { TracciatoService } from "../services/TracciatoService";
import { TraduzioneService } from "../services/TraduzioneService";
import { UserService } from "../services/UserService";
import { VolantinoService } from "../services/VolantinoService";
import { WebPliantService } from "../services/WebPliantService";
import { WebhookService } from "../services/WebhookService";
import { WhatsAppService } from "../services/WhatsAppService";

// Decomposed service implementations
import { ContrattoTipografiaService } from "../services/ContrattoTipografiaService";
import { NamingConventionService } from "../services/NamingConventionService";

// Menu & Permessi
import type { IMenuService } from "../interfaces/IMenuService";
import type { IPermessiService } from "../interfaces/IPermessiService";
import { type IAuditLogRepository, AuditLogRepository } from "../repositories/AuditLogRepository";
import { MenuItemRepository } from "../repositories/MenuItemRepository";
import { PermessiRepository } from "../repositories/PermessiRepository";
import { type IPluginAnalyticsRepository, PluginAnalyticsRepository } from "../repositories/PluginAnalyticsRepository";
import { AuditLogService } from "../services/AuditLogService";
import { MenuService } from "../services/MenuService";
import { PermessiService } from "../services/PermessiService";

// Hub - Auth Providers & Services & News
import type { IAuthProviderService } from "../interfaces/IAuthProviderService";
import type { IHubNewsService } from "../interfaces/IHubNewsService";
import type { IHubServiceService } from "../interfaces/IHubServiceService";
import type { IOidcService } from "../interfaces/IOidcService";
import type { IAuthProviderRepository } from "../repositories/AuthProviderRepository";
import { AuthProviderRepository } from "../repositories/AuthProviderRepository";
import type { IHubNewsRepository } from "../repositories/HubNewsRepository";
import { HubNewsRepository } from "../repositories/HubNewsRepository";
import type { IHubServiceRepository } from "../repositories/HubServiceRepository";
import { HubServiceRepository } from "../repositories/HubServiceRepository";
import { AuthProviderService } from "../services/AuthProviderService";
import { HubNewsService } from "../services/HubNewsService";
import { HubServiceService } from "../services/HubServiceService";
import { OidcService } from "../services/OidcService";

// Agenzia Lib
import { loadAgenziaLib } from "../agenzia_lib/loader";
import type { IAgenziaLib } from "../agenzia_lib/types";

const container = new Container({
  defaultScope: "Singleton",   // opzione valida
});

/** Infrastructure */
function bindInfrastructure() {
  container.bind(TYPES.Database).toConstantValue(sequelize);
  container.bind(TYPES.Logger).toConstantValue(log);
}

function bindRepositories() {
  container.bind<IGdoRepository>(TYPES.GdoRepository).toDynamicValue(() => new GdoRepository()).inSingletonScope();
  container.bind<IUserRepository>(TYPES.UserRepository).toDynamicValue(() => new UserRepository()).inSingletonScope();
  container.bind<IPuntoVenditaRepository>(TYPES.PuntoVenditaRepository).toDynamicValue(() => new PuntoVenditaRepository()).inSingletonScope();
  container.bind<IPromoRepository>(TYPES.PromoRepository).toDynamicValue(() => new PromoRepository()).inSingletonScope();
  container.bind<IAreaRepository>(TYPES.AreaRepository).toDynamicValue(() => new AreaRepository()).inSingletonScope();
  container.bind<ICanaleRepository>(TYPES.CanaleRepository).toDynamicValue(() => new CanaleRepository()).inSingletonScope();
  container.bind<IAttivitaRepository>(TYPES.AttivitaRepository).toDynamicValue(() => new AttivitaRepository()).inSingletonScope();
  container.bind<IOrdiniStampaRepository>(TYPES.OrdiniStampaRepository).toDynamicValue(() => new OrdiniStampaRepository()).inSingletonScope();
  container.bind<IReferenzeRepository>(TYPES.ReferenzeRepository).toDynamicValue(() => new ReferenzeRepository()).inSingletonScope();
  container.bind<IRuntimeKitRepository>(TYPES.RuntimeKitRepository).toDynamicValue(() => new RuntimeKitRepository()).inSingletonScope();
  container.bind<IDesignKitRepository>(TYPES.DesignKitRepository).toDynamicValue(() => new DesignKitRepository()).inSingletonScope();
  container.bind<IFormatiRepository>(TYPES.FormatiRepository).toDynamicValue(() => new FormatiRepository()).inSingletonScope();
  container.bind<ICombinazioneCanaleAreaRepository>(TYPES.CombinazioneCanaleAreaRepository).toDynamicValue(() => new CombinazioneCanaleAreaRepository()).inSingletonScope();
  container.bind<IWebhookRepository>(TYPES.WebhookRepository).toDynamicValue(() => new WebhookRepository()).inSingletonScope();
  container.bind<ITracciatiRepository>(TYPES.TracciatiRepository).toDynamicValue(() => new TracciatiRepository()).inSingletonScope();
  container.bind<ITracciatiReportRepository>(TYPES.TracciatiReportRepository).toDynamicValue(() => new TracciatiReportRepository()).inSingletonScope();
  container.bind<ITracciatiMomentoRepository>(TYPES.TracciatiMomentoRepository).toDynamicValue(() => new TracciatiMomentoRepository()).inSingletonScope();
  container.bind<ITracciatiSchemaRepository>(TYPES.TracciatiSchemaRepository).toDynamicValue(() => new TracciatiSchemaRepository()).inSingletonScope();
  container.bind<IUtentiGdoRepository>(TYPES.UtentiGdoRepository).toDynamicValue(() => new UtentiGdoRepository()).inSingletonScope();
  container.bind<IRuoloUtenteGdoRepository>(TYPES.RuoloUtenteGdoRepository).toDynamicValue(() => new RuoloUtenteGdoRepository()).inSingletonScope();
  container.bind<IFilesRuntimeRepository>(TYPES.FilesRuntimeRepository).toDynamicValue(() => new FilesRuntimeRepository()).inSingletonScope();
  container.bind<IRaccoglitoreKitRepository>(TYPES.RaccoglitoreKitRepository).toDynamicValue(() => new RaccoglitoreKitRepository()).inSingletonScope();
  container.bind<IFilterTemplateRepository>(TYPES.FilterTemplateRepository).toDynamicValue(() => new FilterTemplateRepository()).inSingletonScope();
  container.bind<ITipiDiExportRepository>(TYPES.TipiDiExportRepository).toDynamicValue(() => new TipiDiExportRepository()).inSingletonScope();
  container.bind<IRicetteRepository>(TYPES.RicetteRepository).toDynamicValue(() => new RicetteRepository()).inSingletonScope();
  container.bind<IStatisticheApiRepository>(TYPES.StatisticheApiRepository).toDynamicValue(() => new StatisticheApiRepository()).inSingletonScope();
  container.bind<IContrattoTipografiaRepository>(TYPES.ContrattoTipografiaRepository).toDynamicValue(() => new ContrattoTipografiaRepository()).inSingletonScope();
  container.bind<INamingConventionRepository>(TYPES.NamingConventionRepository).toDynamicValue(() => new NamingConventionRepository()).inSingletonScope();
  container.bind<IOrdiniStampaInviiRepository>(TYPES.OrdiniStampaInviiRepository).toDynamicValue(() => new OrdiniStampaInviiRepository()).inSingletonScope();
  container.bind<ITentativoWebhookRepository>(TYPES.TentativoWebhookRepository).toDynamicValue(() => new TentativoWebhookRepository()).inSingletonScope();
  container.bind<IReferenzeGruppoRepository>(TYPES.ReferenzeGruppoRepository).toDynamicValue(() => new ReferenzeGruppoRepository()).inSingletonScope();
  container.bind<IApprofondimentoVinoRepository>(TYPES.ApprofondimentoVinoRepository).toDynamicValue(() => new ApprofondimentoVinoRepository()).inSingletonScope();
  container.bind<IContenutiAggiuntiviReferenzaRepository>(TYPES.ContenutiAggiuntiviReferenzaRepository).toDynamicValue(() => new ContenutiAggiuntiviReferenzaRepository()).inSingletonScope();
  container.bind<PermessiRepository>(TYPES.PermessiRepository).toDynamicValue(() => new PermessiRepository()).inSingletonScope();
  container.bind<MenuItemRepository>(TYPES.MenuItemRepository).toDynamicValue(() => new MenuItemRepository()).inSingletonScope();
  container.bind<IPluginAnalyticsRepository>(TYPES.PluginAnalyticsRepository).toDynamicValue(() => new PluginAnalyticsRepository()).inSingletonScope();
  container.bind<IAuditLogRepository>(TYPES.AuditLogRepository).toDynamicValue(() => new AuditLogRepository()).inSingletonScope();

  // Hub
  container.bind<IAuthProviderRepository>(TYPES.AuthProviderRepository).toDynamicValue(() => new AuthProviderRepository()).inSingletonScope();
  container.bind<IHubServiceRepository>(TYPES.HubServiceRepository).toDynamicValue(() => new HubServiceRepository()).inSingletonScope();
  container.bind<IHubNewsRepository>(TYPES.HubNewsRepository).toDynamicValue(() => new HubNewsRepository()).inSingletonScope();
}

/** Services */
function bindServices() {
  // Simple bindings
  container.bind<IWebhookService>(TYPES.WebhookService).toDynamicValue(
    (context) => new WebhookService(
      context.get<IWebhookRepository>(TYPES.WebhookRepository),
      context.get<ITentativoWebhookRepository>(TYPES.TentativoWebhookRepository)
    )
  );
  container.bind<IIstantaService>(TYPES.IstantaService).toDynamicValue(() => new IstantaService());
  container
    .bind<IGdoService>(TYPES.GdoService)
    .toDynamicValue((context) => new GdoService(
      context.get<IGdoRepository>(TYPES.GdoRepository),
      context.get<IRuoloUtenteGdoRepository>(TYPES.RuoloUtenteGdoRepository)
    ));
  container.bind<IAreaService>(TYPES.AreaService).toDynamicValue(
    (context) => new AreaService(context.get<IAreaRepository>(TYPES.AreaRepository))
  );
  container.bind<ICanaleService>(TYPES.CanaleService).toDynamicValue(
    (context) => new CanaleService(context.get<ICanaleRepository>(TYPES.CanaleRepository))
  );
  container.bind<IConfigService>(TYPES.ConfigService).toDynamicValue(() => new ConfigService());
  container.bind<IPuntoVenditaService>(TYPES.PuntoVenditaService).toDynamicValue(
    (context) => new PuntoVenditaService(context.get<IPuntoVenditaRepository>(TYPES.PuntoVenditaRepository))
  );
  container.bind<IUserService>(TYPES.UserService).toDynamicValue(
    (context) => new UserService(
      context.get<IUserRepository>(TYPES.UserRepository),
      context.get<IMenuService>(TYPES.MenuService)
    )
  );
  container
    .bind<ICombinazioneAreeCanaliService>(TYPES.CombinazioneAreeCanaliService)
    .toDynamicValue((context) => new CombinazioneAreeCanaliService(
      context.get<ICombinazioneCanaleAreaRepository>(TYPES.CombinazioneCanaleAreaRepository),
      context.get<ICanaleRepository>(TYPES.CanaleRepository),
      context.get<IAreaRepository>(TYPES.AreaRepository)
    ));

  container.bind<ITraduzioneService>(TYPES.TraduzioneService).toDynamicValue(() => new TraduzioneService());
  container.bind<ITracciatoService>(TYPES.TracciatoService).toDynamicValue(
    (context) => new TracciatoService(
      context.get<ITracciatiRepository>(TYPES.TracciatiRepository),
      context.get<IAgenziaLib>(TYPES.AgenziaLib),
      context.get<ITracciatiReportRepository>(TYPES.TracciatiReportRepository),
      context.get<ITracciatiMomentoRepository>(TYPES.TracciatiMomentoRepository),
      context.get<ITracciatiSchemaRepository>(TYPES.TracciatiSchemaRepository)
    ),
  );

  container.bind(TYPES.LogService).toDynamicValue(() => new LogService());
  container.bind<IAttivitaService>(TYPES.AttivitaService).toDynamicValue(
    (context) => new AttivitaService(
      context.get<IAttivitaRepository>(TYPES.AttivitaRepository),
      context.get<IUserRepository>(TYPES.UserRepository)
    )
  );
  container.bind<IExternalApiService>(TYPES.ExternalApiService).toDynamicValue(() => new ExternalApiService());
  container.bind(TYPES.StatisticheApiService).toDynamicValue(
    (context) => new StatisticheApiService(
      context.get<IStatisticheApiRepository>(TYPES.StatisticheApiRepository)
    )
  );

  container.bind<IDashboardService>(TYPES.DashboardService).toDynamicValue(
    (context) => new DashboardService(
      context.get<IPromoRepository>(TYPES.PromoRepository),
      context.get<IFormatiRepository>(TYPES.FormatiRepository)
    )
  );
  container.bind(TYPES.FilterTemplateService).toDynamicValue(
    (context) => new FilterTemplateService(
      context.get<IFilterTemplateRepository>(TYPES.FilterTemplateRepository),
      context.get<IUserRepository>(TYPES.UserRepository)
    )
  );
  container.bind(TYPES.DisplayContextService).toDynamicValue(() => new DisplayContextService());

  // Bindings with dependencies via the context
  container.bind<IImpostazioniService>(TYPES.ImpostazioniService).toDynamicValue(
    (context) => new ImpostazioniService(
      context.get<IIstantaService>(TYPES.IstantaService),
      context.get<IWebhookService>(TYPES.WebhookService),
      context.get<IUserService>(TYPES.UserService),
      context.get<IMenuService>(TYPES.MenuService)
    )
  );

  container.bind<IWhatsAppService>(TYPES.WhatsAppService).toDynamicValue(
    (context) =>
      new WhatsAppService(
        context.get<IUserService>(TYPES.UserService)
      )
  );

  container.bind<IPromoService>(TYPES.PromoService).toDynamicValue(
    (context) => new PromoService(
      context.get<IWebPliantService>(TYPES.WebPliantService),
      context.get<IIstantaService>(TYPES.IstantaService),
      context.get<IPromoRepository>(TYPES.PromoRepository),
      context.get<IAgenziaLib>(TYPES.AgenziaLib),
      context.get<IConfigService>(TYPES.ConfigService)
    )
  );

  container.bind<IOrdiniStampaService>(TYPES.OrdiniStampaService).toDynamicValue(
    (context) => new OrdiniStampaService(
      context.get<IGdoService>(TYPES.GdoService),
      context.get<IKitRuntimeService>(TYPES.KitRuntimeService)
    )
  );

  container.bind<IGPTService>(TYPES.GPTService).toDynamicValue(
    (context) => new GPTService(context.get<IImpostazioniService>(TYPES.ImpostazioniService))
  );

  container.bind<IServiceFacade>(TYPES.ServiceFacade).toDynamicValue(
    (context) =>
      new ServiceFacade(
        context.get<IGdoService>(TYPES.GdoService),
        context.get<IAreaService>(TYPES.AreaService),
        context.get<ICanaleService>(TYPES.CanaleService),
        context.get<IPuntoVenditaService>(TYPES.PuntoVenditaService),
        context.get<IFormatoService>(TYPES.FormatoService),
        context.get<ITipoExportService>(TYPES.TipoExportService),
        context.get<ICombinazioneAreeCanaliService>(TYPES.CombinazioneAreeCanaliService)
      )
  );

  container.bind(TYPES.BadgeService).toDynamicValue(
    (context) =>
      new BadgeService(
        context.get<IPromoService>(TYPES.PromoService),
        context.get<IOrdiniStampaService>(TYPES.OrdiniStampaService)
      )
  );

  // ─── Decomposed Services ─────────────────────────────────────────
  container.bind<IFormatoService>(TYPES.FormatoService).toDynamicValue(
    () => new FormatoService()
  );
  container.bind<ITipoExportService>(TYPES.TipoExportService).toDynamicValue(
    (context) => new TipoExportService(
      context.get<ITipiDiExportRepository>(TYPES.TipiDiExportRepository),
      context.get<IFormatiRepository>(TYPES.FormatiRepository),
      context.get<IRaccoglitoreKitRepository>(TYPES.RaccoglitoreKitRepository)
    )
  );
  container.bind<INamingConventionService>(TYPES.NamingConventionService).toDynamicValue(
    () => new NamingConventionService()
  );
  container.bind<IContrattoTipografiaService>(TYPES.ContrattoTipografiaService).toDynamicValue(
    () => new ContrattoTipografiaService()
  );

  container.bind<IKitRuntimeService>(TYPES.KitRuntimeService).toDynamicValue(
    (context) => new KitRuntimeService(
      context.get<IIstantaService>(TYPES.IstantaService),
      context.get<IWebhookService>(TYPES.WebhookService)
    )
  );
  container.bind<IDesignKitService>(TYPES.DesignKitService).toDynamicValue(
    () => new DesignKitService()
  );
  container.bind<IRaccoglitoreKitService>(TYPES.RaccoglitoreKitService).toDynamicValue(
    () => new RaccoglitoreKitService()
  );
  container.bind<IReferenzeService>(TYPES.ReferenzeService).toDynamicValue(
    (context) => new ReferenzeService(
      context.get<IPromoRepository>(TYPES.PromoRepository),
      context.get<IWebPliantService>(TYPES.WebPliantService)
    )
  );
  container.bind<IWebPliantService>(TYPES.WebPliantService).toDynamicValue(
    (context) => new WebPliantService(
      context.get<IPromoRepository>(TYPES.PromoRepository),
      context.get<IAreaService>(TYPES.AreaService),
      context.get<ICanaleService>(TYPES.CanaleService),
      context.get<IGdoService>(TYPES.GdoService),
      context.get<ITipoExportService>(TYPES.TipoExportService)
    )
  );
  container.bind<IFileManagementService>(TYPES.FileManagementService).toDynamicValue(
    (context) => new FileManagementService(
      context.get<IKitRuntimeService>(TYPES.KitRuntimeService),
      context.get<ITipoExportService>(TYPES.TipoExportService),
      context.get<IConfigService>(TYPES.ConfigService),
      context.get<IAreaService>(TYPES.AreaService),
      context.get<ICanaleService>(TYPES.CanaleService),
      context.get<IWebhookService>(TYPES.WebhookService),
      context.get<IPromoRepository>(TYPES.PromoRepository)
    )
  );
  container.bind<IVolantinoService>(TYPES.VolantinoService).toDynamicValue(
    (context) => new VolantinoService(context.get<IConfigService>(TYPES.ConfigService))
  );

  // Permessi
  container.bind<IPermessiService>(TYPES.PermessiService).toDynamicValue(
    (context) => new PermessiService(
      context.get<PermessiRepository>(TYPES.PermessiRepository)
    )
  );

  container.bind<IMenuService>(TYPES.MenuService).toDynamicValue(
    (context) => new MenuService(
      context.get<MenuItemRepository>(TYPES.MenuItemRepository)
    )
  );

  // Hub - Auth Providers & Services
  container.bind<IAuthProviderService>(TYPES.AuthProviderService).toDynamicValue(
    (context) => new AuthProviderService(
      context.get<IAuthProviderRepository>(TYPES.AuthProviderRepository)
    )
  );
  container.bind<IHubServiceService>(TYPES.HubServiceService).toDynamicValue(
    (context) => new HubServiceService(
      context.get<IHubServiceRepository>(TYPES.HubServiceRepository)
    )
  );
  container.bind<IHubNewsService>(TYPES.HubNewsService).toDynamicValue(
    (context) => new HubNewsService(
      context.get<IHubNewsRepository>(TYPES.HubNewsRepository)
    )
  );
  container.bind<IOidcService>(TYPES.OidcService).toDynamicValue(
    () => new OidcService()
  );

  // Audit Log — singleton con repository iniettato
  container.bind(TYPES.AuditLogService).toDynamicValue(
    (context) => {
      const service = AuditLogService.getInstance();
      service.setRepository(context.get<IAuditLogRepository>(TYPES.AuditLogRepository));
      return service;
    }
  );
}

/** Initialize */
export async function initializeContainer(): Promise<Container> {
  bindInfrastructure();
  bindRepositories();
  bindServices();

  // AgenziaLib — caricamento async basato su CLIENT_ID dall'env
  const agenziaLib = await loadAgenziaLib(
    container.get<IUserService>(TYPES.UserService)
  );
  container.bind<IAgenziaLib>(TYPES.AgenziaLib).toConstantValue(agenziaLib);

  log.info(
    "IoC Container initialized successfully",
    { bindings: container.isBound(TYPES.UserService) ? "Services bound" : "Binding failed" }
  );
  return container;
}

export function getService<T>(id: symbol): T {
  return container.get<T>(id);
}

export function hasBinding(id: symbol): boolean {
  return container.isBound(id);
}

export function resetContainer(): void {
  container.unbindAll();
}

export { container };
