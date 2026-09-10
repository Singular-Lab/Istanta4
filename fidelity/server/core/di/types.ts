/**
 * IoC Container Type Symbols
 *
 * Defines unique symbols for dependency injection bindings.
 * Each symbol represents a service, repository, or infrastructure component
 * that can be resolved from the container.
 */

export const TYPES = {
  // ============================================
  // INFRASTRUCTURE
  // ============================================
  Database: Symbol.for('Database'),
  MongoDatabase: Symbol.for('MongoDatabase'),
  Cache: Symbol.for('Cache'),
  Logger: Symbol.for('Logger'),
  EventBus: Symbol.for('EventBus'),

  // ============================================
  // SERVICES
  // ============================================
  UserService: Symbol.for('UserService'),
  GdoService: Symbol.for('GdoService'),
  PromoService: Symbol.for('PromoService'),
  ImpostazioniService: Symbol.for('ImpostazioniService'),
  WhatsAppService: Symbol.for('WhatsAppService'),
  WebhookService: Symbol.for('WebhookService'),
  IstantaService: Symbol.for('IstantaService'),
  AreaService: Symbol.for('AreaService'),
  CanaleService: Symbol.for('CanaleService'),
  ConfigService: Symbol.for('ConfigService'),
  OrdiniStampaService: Symbol.for('OrdiniStampaService'),
  TraduzioneService: Symbol.for('TraduzioneService'),
  TracciatoService: Symbol.for('TracciatoService'),
  GPTService: Symbol.for('GPTService'),
  LogService: Symbol.for('LogService'),
  AttivitaService: Symbol.for('AttivitaService'),
  PuntoVenditaService: Symbol.for('PuntoVenditaService'),
  CombinazioneAreeCanaliService: Symbol.for('CombinazioneAreeCanaliService'),
  ExternalApiService: Symbol.for('ExternalApiService'),
  StatisticheApiService: Symbol.for('StatisticheApiService'),
  DashboardService: Symbol.for('DashboardService'),
  FilterTemplateService: Symbol.for('FilterTemplateService'),
  BadgeService: Symbol.for('BadgeService'),
  ServiceFacade: Symbol.for('ServiceFacade'),
  DisplayContextService: Symbol.for('DisplayContextService'),
  EphemeralTokenService: Symbol.for('EphemeralTokenService'),
  EmailService: Symbol.for('EmailService'),
  ChronService: Symbol.for('ChronService'),

  // Decomposed from ImpostazioniService
  FormatoService: Symbol.for('FormatoService'),
  TipoExportService: Symbol.for('TipoExportService'),
  NamingConventionService: Symbol.for('NamingConventionService'),
  ContrattoTipografiaService: Symbol.for('ContrattoTipografiaService'),
  KitRuntimeService: Symbol.for('KitRuntimeService'),
  DesignKitService: Symbol.for('DesignKitService'),
  RaccoglitoreKitService: Symbol.for('RaccoglitoreKitService'),

  // Decomposed from PromoService
  ReferenzeService: Symbol.for('ReferenzeService'),
  WebPliantService: Symbol.for('WebPliantService'),
  FileManagementService: Symbol.for('FileManagementService'),
  VolantinoService: Symbol.for('VolantinoService'),

  // Permessi
  PermessiService: Symbol.for('PermessiService'),

  // Menu
  MenuService: Symbol.for('MenuService'),

  // Plugin Analytics
  PluginAnalyticsService: Symbol.for('PluginAnalyticsService'),
  PluginAnalyticsRepository: Symbol.for('PluginAnalyticsRepository'),

  // Audit Log
  AuditLogService: Symbol.for('AuditLogService'),
  AuditLogRepository: Symbol.for('AuditLogRepository'),
  AuditLogController: Symbol.for('AuditLogController'),

  // ============================================
  // REPOSITORIES (for future Repository Pattern)
  // ============================================
  UserRepository: Symbol.for('UserRepository'),
  GdoRepository: Symbol.for('GdoRepository'),
  PromoRepository: Symbol.for('PromoRepository'),
  PuntoVenditaRepository: Symbol.for('PuntoVenditaRepository'),
  AreaRepository: Symbol.for('AreaRepository'),
  CanaleRepository: Symbol.for('CanaleRepository'),
  OrdiniStampaRepository: Symbol.for('OrdiniStampaRepository'),
  WhatsAppRepository: Symbol.for('WhatsAppRepository'),
  AttivitaRepository: Symbol.for('AttivitaRepository'),
  ReferenzeRepository: Symbol.for('ReferenzeRepository'),
  RuntimeKitRepository: Symbol.for('RuntimeKitRepository'),
  DesignKitRepository: Symbol.for('DesignKitRepository'),
  FormatiRepository: Symbol.for('FormatiRepository'),
  CombinazioneCanaleAreaRepository: Symbol.for('CombinazioneCanaleAreaRepository'),
  WebhookRepository: Symbol.for('WebhookRepository'),
  TracciatiRepository: Symbol.for('TracciatiRepository'),
  TracciatiReportRepository: Symbol.for('TracciatiReportRepository'),
  TracciatiMomentoRepository: Symbol.for('TracciatiMomentoRepository'),
  TracciatiSchemaRepository: Symbol.for('TracciatiSchemaRepository'),
  UtentiGdoRepository: Symbol.for('UtentiGdoRepository'),
  RuoloUtenteGdoRepository: Symbol.for('RuoloUtenteGdoRepository'),
  FilesRuntimeRepository: Symbol.for('FilesRuntimeRepository'),
  RaccoglitoreKitRepository: Symbol.for('RaccoglitoreKitRepository'),
  FilterTemplateRepository: Symbol.for('FilterTemplateRepository'),
  TipiDiExportRepository: Symbol.for('TipiDiExportRepository'),
  RicetteRepository: Symbol.for('RicetteRepository'),
  StatisticheApiRepository: Symbol.for('StatisticheApiRepository'),
  ContrattoTipografiaRepository: Symbol.for('ContrattoTipografiaRepository'),
  NamingConventionRepository: Symbol.for('NamingConventionRepository'),
  OrdiniStampaInviiRepository: Symbol.for('OrdiniStampaInviiRepository'),
  TentativoWebhookRepository: Symbol.for('TentativoWebhookRepository'),
  ReferenzeGruppoRepository: Symbol.for('ReferenzeGruppoRepository'),
  ApprofondimentoVinoRepository: Symbol.for('ApprofondimentoVinoRepository'),
  ContenutiAggiuntiviReferenzaRepository: Symbol.for('ContenutiAggiuntiviReferenzaRepository'),
  PermessiRepository: Symbol.for('PermessiRepository'),
  MenuItemRepository: Symbol.for('MenuItemRepository'),

  // ============================================
  // CONTROLLERS
  // ============================================
  UserController: Symbol.for('UserController'),
  GdoController: Symbol.for('GdoController'),
  PromoController: Symbol.for('PromoController'),
  ImpostazioniController: Symbol.for('ImpostazioniController'),
  WhatsAppController: Symbol.for('WhatsAppController'),
  WebhookController: Symbol.for('WebhookController'),
  IstantaController: Symbol.for('IstantaController'),
  AreaController: Symbol.for('AreaController'),
  CanaleController: Symbol.for('CanaleController'),
  ConfigController: Symbol.for('ConfigController'),
  OrdiniDiStampaController: Symbol.for('OrdiniDiStampaController'),
  TraduzioneController: Symbol.for('TraduzioneController'),
  TracciatoController: Symbol.for('TracciatoController'),
  GPTController: Symbol.for('GPTController'),
  LogController: Symbol.for('LogController'),
  AttivitaController: Symbol.for('AttivitaController'),
  PuntoVenditaController: Symbol.for('PuntoVenditaController'),
  CombinazioneAreeCanaliController: Symbol.for('CombinazioneAreeCanaliController'),
  ExternalApiController: Symbol.for('ExternalApiController'),
  DashboardController: Symbol.for('DashboardController'),
  SuperadminDashboardController: Symbol.for('SuperadminDashboardController'),
  CorreggoController: Symbol.for('CorreggoController'),
  EphemeralAuthController: Symbol.for('EphemeralAuthController'),
  EmailController: Symbol.for('EmailController'),
  DisplayController: Symbol.for('DisplayController'),
  DisplayContextController: Symbol.for('DisplayContextController'),

  // Decomposed from ImpostazioniController
  FormatoController: Symbol.for('FormatoController'),
  TipoExportController: Symbol.for('TipoExportController'),
  NamingConventionController: Symbol.for('NamingConventionController'),
  ContrattoTipografiaController: Symbol.for('ContrattoTipografiaController'),
  KitRuntimeController: Symbol.for('KitRuntimeController'),
  DesignKitController: Symbol.for('DesignKitController'),
  RaccoglitoreKitController: Symbol.for('RaccoglitoreKitController'),

  // Decomposed from PromoController
  ReferenzeController: Symbol.for('ReferenzeController'),
  WebPliantController: Symbol.for('WebPliantController'),
  FileManagementController: Symbol.for('FileManagementController'),
  VolantinoController: Symbol.for('VolantinoController'),

  // Permessi
  PermessiController: Symbol.for('PermessiController'),

  // Menu
  MenuController: Symbol.for('MenuController'),

  // Plugin Analytics
  PluginAnalyticsController: Symbol.for('PluginAnalyticsController'),

  // Agenzia Lib — logiche custom per cliente
  AgenziaLib: Symbol.for('AgenziaLib'),

  // Hub - Auth Providers & Services
  AuthProviderService: Symbol.for('AuthProviderService'),
  AuthProviderRepository: Symbol.for('AuthProviderRepository'),
  OidcService: Symbol.for('OidcService'),
  HubServiceService: Symbol.for('HubServiceService'),
  HubServiceRepository: Symbol.for('HubServiceRepository'),
  HubNewsService: Symbol.for('HubNewsService'),
  HubNewsRepository: Symbol.for('HubNewsRepository'),
  HubController: Symbol.for('HubController'),
} as const;

export type ServiceTypes = typeof TYPES;
