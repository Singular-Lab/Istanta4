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
  Logger: Symbol.for('Logger'),

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

  // Viste Volantini e POP (ex Materiali)
  MaterialiService: Symbol.for('MaterialiService'),

  // Permessi
  PermessiService: Symbol.for('PermessiService'),

  // Menu
  MenuService: Symbol.for('MenuService'),

  // Plugin Analytics
  PluginAnalyticsRepository: Symbol.for('PluginAnalyticsRepository'),

  // Audit Log
  AuditLogService: Symbol.for('AuditLogService'),
  AuditLogRepository: Symbol.for('AuditLogRepository'),

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
  MaterialiRepository: Symbol.for('MaterialiRepository'),

  // Agenzia Lib — logiche custom per cliente
  AgenziaLib: Symbol.for('AgenziaLib'),

  // Hub - Auth Providers & Services
  AuthProviderService: Symbol.for('AuthProviderService'),
  AuthProviderRepository: Symbol.for('AuthProviderRepository'),
  OidcService: Symbol.for('OidcService'),
  SamlService: Symbol.for('SamlService'),
  HubServiceService: Symbol.for('HubServiceService'),
  HubServiceRepository: Symbol.for('HubServiceRepository'),
  HubNewsService: Symbol.for('HubNewsService'),
  HubNewsRepository: Symbol.for('HubNewsRepository'),
} as const;

export type ServiceTypes = typeof TYPES;
