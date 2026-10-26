/**
 * Repositories Module
 *
 * Exports all repository implementations and interfaces.
 * Repositories abstract data access logic from services.
 */

// Base
export { BaseRepository } from './BaseRepository';
export type {
  IBaseRepository,
  ISoftDeleteRepository,
  PaginatedResult,
  PaginationOptions
} from './IBaseRepository';

// User Repository
export { UserRepository, type IUserRepository } from './UserRepository';

// GDO Repository
export { GdoRepository, type IGdoRepository } from './GdoRepository';

// Punto Vendita Repository
export {
  PuntoVenditaRepository,
  type IPuntoVenditaRepository,
  type PuntoVenditaFilters,
  type PuntoVenditaPaginationParams
} from './PuntoVenditaRepository';

// Promo Repository
export {
  PromoRepository,
  type IPromoRepository,
  type PromoFilters,
  type PromoPaginationParams
} from './PromoRepository';

// Area Repository
export { AreaRepository, type IAreaRepository } from './AreaRepository';

// Canale Repository
export { CanaleRepository, type ICanaleRepository } from './CanaleRepository';

// Attivita Repository
export {
  AttivitaRepository,
  type IAttivitaRepository,
  type AttivitaFilters,
  type AttivitaPaginationParams
} from './AttivitaRepository';

// Ordini Stampa Repository
export {
  OrdiniStampaRepository,
  type IOrdiniStampaRepository,
  type OrdiniStampaFilters,
  type OrdiniStampaPaginationParams
} from './OrdiniStampaRepository';

// Referenze Repository
export {
  ReferenzeRepository,
  type IReferenzeRepository,
  type ReferenzeFilters,
  type ReferenzePaginationParams
} from './ReferenzeRepository';

// RuntimeKit Repository
export {
  RuntimeKitRepository,
  type IRuntimeKitRepository,
  type RuntimeKitFilters,
  type RuntimeKitPaginationParams
} from './RuntimeKitRepository';

// DesignKit Repository
export {
  DesignKitRepository,
  type IDesignKitRepository,
  type DesignKitFilters,
  type DesignKitPaginationParams
} from './DesignKitRepository';

// Formati Repository
export {
  FormatiRepository,
  type IFormatiRepository
} from './FormatiRepository';

// CombinazioneCanaleArea Repository
export {
  CombinazioneCanaleAreaRepository,
  type ICombinazioneCanaleAreaRepository
} from './CombinazioneCanaleAreaRepository';

// Webhook Repository
export {
  WebhookRepository,
  type IWebhookRepository,
  type WebhookFilters,
  type WebhookPaginationParams
} from './WebhookRepository';

// Tracciati Repository
export {
  TracciatiRepository,
  type ITracciatiRepository,
  type TracciatiFilters,
  type TracciatiPaginationParams
} from './TracciatiRepository';

// UtentiGdo Repository
export {
  UtentiGdoRepository,
  type IUtentiGdoRepository
} from './UtentiGdoRepository';

// RuoloUtenteGdo Repository
export {
  RuoloUtenteGdoRepository,
  type IRuoloUtenteGdoRepository
} from './RuoloUtenteGdoRepository';

// FilesRuntime Repository
export {
  FilesRuntimeRepository,
  type IFilesRuntimeRepository,
  type FilesRuntimeFilters,
  type FilesRuntimePaginationParams
} from './FilesRuntimeRepository';

// RaccoglitoreKit Repository
export {
  RaccoglitoreKitRepository,
  type IRaccoglitoreKitRepository,
  type RaccoglitoreKitFilters,
  type RaccoglitoreKitPaginationParams
} from './RaccoglitoreKitRepository';

// FilterTemplate Repository
export {
  FilterTemplateRepository,
  type IFilterTemplateRepository,
  type FilterTemplateFilters,
  type FilterTemplatePaginationParams
} from './FilterTemplateRepository';

// TipiDiExport Repository
export {
  TipiDiExportRepository,
  type ITipiDiExportRepository
} from './TipiDiExportRepository';

// Ricette Repository
export {
  RicetteRepository,
  type IRicetteRepository,
  type RicetteFilters,
  type RicettePaginationParams
} from './RicetteRepository';

// StatisticheApi Repository
export {
  StatisticheApiRepository,
  type IStatisticheApiRepository,
  type StatisticheApiFilters,
  type StatisticheApiPaginationParams
} from './StatisticheApiRepository';

// ContrattoTipografia Repository
export {
  ContrattoTipografiaRepository,
  type IContrattoTipografiaRepository
} from './ContrattoTipografiaRepository';

// NamingConvention Repository
export {
  NamingConventionRepository,
  type INamingConventionRepository
} from './NamingConventionRepository';

// OrdiniStampaInvii Repository
export {
  OrdiniStampaInviiRepository,
  type IOrdiniStampaInviiRepository,
  type OrdiniStampaInviiPaginationParams
} from './OrdiniStampaInviiRepository';

// TentativoWebhook Repository
export {
  TentativoWebhookRepository,
  type ITentativoWebhookRepository,
  type TentativoWebhookFilters,
  type TentativoWebhookPaginationParams
} from './TentativoWebhookRepository';

// ReferenzeGruppo Repository
export {
  ReferenzeGruppoRepository,
  type IReferenzeGruppoRepository,
  type ReferenzeGruppoFilters,
  type ReferenzeGruppoPaginationParams
} from './ReferenzeGruppoRepository';

// ApprofondimentoVino Repository
export {
  ApprofondimentoVinoRepository,
  type IApprofondimentoVinoRepository,
  type ApprofondimentoVinoFilters,
  type ApprofondimentoVinoPaginationParams
} from './ApprofondimentoVinoRepository';

// ContenutiAggiuntiviReferenza Repository
export {
  ContenutiAggiuntiviReferenzaRepository,
  type IContenutiAggiuntiviReferenzaRepository,
  type ContenutiAggiuntiviReferenzaFilters,
  type ContenutiAggiuntiviReferenzaPaginationParams
} from './ContenutiAggiuntiviReferenzaRepository';
