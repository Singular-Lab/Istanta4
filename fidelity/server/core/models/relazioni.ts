import { Colorize } from '../../../lib/Colorize';
import { log } from '../logger';

// Import di tutti i modelli
import { TentativoWebhook } from './TentativoWebhook';
import { Webhook } from './Webhook';
import { Area } from './aree';
import { Attivita } from './attivita';
import { AttivitaUtente } from './attivita_utente';
import { Canale } from './canali';
import { CanaleInterazione } from './canali_interazione';
import { CombinazioneCanaleArea } from './combinazioni_canali_aree';
import { DesignKit } from './design_kit';
import { FilesRuntime } from './files_runtime';
import { FilesRuntimeLog } from './files_runtime_log';
import { FilterTemplate } from './filter_template';
import { Formati } from './formati';
import { GDO } from './gdo';
import { OrdiniDiStampa } from './ordini_di_stampa';
import { OrdiniDiStampaInvii } from './ordini_di_stampa_invii';
import { Promo } from './promo';
import { PuntoVendita } from './punto_vendita/punti_vendita';
import { PuntoVenditaUtenti } from './punto_vendita/punti_vendita_utenti';
import { RaccoglitoreKit } from './raccoglitore_kit';
import { Referenze } from './referenze';
import { RuntimeKit } from './runtime_kit';
import { RuoloUtenteGDO } from './ruolo_gdo';
import { Tracciati } from './tracciati';
import { Utente } from './utenti';
import { UtentiGDO } from './utenti_gdo';
import { GDOWhatsappConversation } from './whatsapp/gdo_whatsapp_conversions';
import { GDOWhatsappMessage } from './whatsapp/gdo_whatsapp_messages';
import { GDOWhatsappNumbers } from './whatsapp/gdo_whatsapp_numbers';
import { GDOWhatsappTemplate } from './whatsapp/gdo_whatsapp_template';
import { DisplayContextPuntoVendita } from './punto_vendita/display_context_punto_vendita';
import { DispositivoPuntoVendita } from './punto_vendita/dispositivi_punto_vendita';
import { WishlistWebpliant } from './wishlist_webpliant';
import { MenuItem } from './menu_item';
import { Permesso } from './permessi';
import { PermessoRuolo } from './permessi_ruolo';
import { PermessoRuoloGdo } from './permessi_ruolo_gdo';

// Flag per evitare la configurazione multipla delle relazioni
let relazioniConfigurate = false;

/**
 * Configura tutte le relazioni tra i modelli Sequelize
 * Questo file centralizza la gestione delle associazioni per evitare problemi di dipendenze circolari
 */
export function configuraRelazioni(): void {
  try {
    // Evita la configurazione multipla delle relazioni
    if (relazioniConfigurate) {
      log.info(Colorize.yellow('⚠️  Relazioni già configurate, skip...'));
      return;
    }

    log.info(Colorize.blue('🔗 Configurazione relazioni tra modelli...'));

    // ========================================
    // RELAZIONI UTENTI E GDO
    // ========================================
    CanaleInterazione.belongsTo(Utente, {
      foreignKey: 'idutente_canaliinterazione',
      as: 'utente',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    Utente.hasMany(CanaleInterazione, {
      foreignKey: 'idutente_canaliinterazione',
      as: 'canaliInterazione',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    // UtentiGDO -> Utente (belongsTo)
    UtentiGDO.belongsTo(Utente, {
      foreignKey: 'id_utente_utentegdo',
      as: 'utente',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Utente -> UtentiGDO (hasMany)
    Utente.hasMany(UtentiGDO, {
      foreignKey: 'id_utente_utentegdo',
      as: 'utenti_gdo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // UtentiGDO -> GDO (belongsTo)
    UtentiGDO.belongsTo(GDO, {
      foreignKey: 'id_gdo_utentegdo',
      as: 'gdo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // GDO -> UtentiGDO (hasMany)
    GDO.hasMany(UtentiGDO, {
      foreignKey: 'id_gdo_utentegdo',
      as: 'utenti_gdo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // UtentiGDO -> RuoloUtenteGDO (belongsTo)
    UtentiGDO.belongsTo(RuoloUtenteGDO, {
      foreignKey: 'id_ruolo_utente_gdo',
      as: 'ruolo',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // RuoloUtenteGDO -> UtentiGDO (hasMany)
    RuoloUtenteGDO.hasMany(UtentiGDO, {
      foreignKey: 'id_ruolo_utente_gdo',
      as: 'utenti_gdo',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni Utenti-GDO configurate'));

    // ========================================
    // RELAZIONI PUNTI VENDITA
    // ========================================

    // PuntoVendita -> GDO (belongsTo)
    PuntoVendita.belongsTo(GDO, {
      foreignKey: 'id_gdo_puntivendita',
      as: 'gdo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // GDO -> PuntoVendita (hasMany)
    GDO.hasMany(PuntoVendita, {
      foreignKey: 'id_gdo_puntivendita',
      as: 'punti_vendita',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // PuntoVendita -> CombinazioneCanaleArea (belongsTo)
    PuntoVendita.belongsTo(CombinazioneCanaleArea, {
      foreignKey: 'id_combinazione_canale_area_puntivendita',
      as: 'combinazione_canale_area',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // CombinazioneCanaleArea -> PuntoVendita (hasMany)
    CombinazioneCanaleArea.hasMany(PuntoVendita, {
      foreignKey: 'id_combinazione_canale_area_puntivendita',
      as: 'punti_vendita',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // PuntoVenditaUtenti -> PuntoVendita (belongsTo)
    PuntoVenditaUtenti.belongsTo(PuntoVendita, {
      foreignKey: 'idpuntivendita_puntivenditautenti',
      as: 'punto_vendita',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // PuntoVendita -> PuntoVenditaUtenti (hasMany)
    PuntoVendita.hasMany(PuntoVenditaUtenti, {
      foreignKey: 'idpuntivendita_puntivenditautenti',
      as: 'punti_vendita_utenti',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // PuntoVenditaUtenti -> Utente (belongsTo)
    PuntoVenditaUtenti.belongsTo(Utente, {
      foreignKey: 'idutenti_puntivenditautenti',
      as: 'utente',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Utente -> PuntoVenditaUtenti (hasMany)
    Utente.hasMany(PuntoVenditaUtenti, {
      foreignKey: 'idutenti_puntivenditautenti',
      as: 'punti_vendita_utenti',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni Punti Vendita configurate'));

    // ========================================
    // RELAZIONI ORDINI DI STAMPA
    // ========================================

    // OrdiniDiStampa -> Utente (belongsTo)
    OrdiniDiStampa.belongsTo(Utente, {
      foreignKey: 'idutente_ordinistampa',
      as: 'utente',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Utente -> OrdiniDiStampa (hasMany)
    Utente.hasMany(OrdiniDiStampa, {
      foreignKey: 'idutente_ordinistampa',
      as: 'ordini_stampa',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // OrdiniDiStampa -> Promo (belongsTo)
    OrdiniDiStampa.belongsTo(Promo, {
      foreignKey: 'id_promo_ordinistampa',
      as: 'promo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Promo -> OrdiniDiStampa (hasMany)
    Promo.hasMany(OrdiniDiStampa, {
      foreignKey: 'id_promo_ordinistampa',
      as: 'ordini_stampa',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // OrdiniDiStampaInvii -> OrdiniDiStampa (belongsTo)
    OrdiniDiStampaInvii.belongsTo(OrdiniDiStampa, {
      foreignKey: 'idordinestampa_ordinistampainvii',
      as: 'ordine_stampa',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // OrdiniDiStampa -> OrdiniDiStampaInvii (hasMany)
    OrdiniDiStampa.hasMany(OrdiniDiStampaInvii, {
      foreignKey: 'idordinestampa_ordinistampainvii',
      as: 'invii',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // OrdiniDiStampaInvii -> Utente (belongsTo)
    OrdiniDiStampaInvii.belongsTo(Utente, {
      foreignKey: 'idutente_ordinistampainvii',
      as: 'utente',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Utente -> OrdiniDiStampaInvii (hasMany)
    Utente.hasMany(OrdiniDiStampaInvii, {
      foreignKey: 'idutente_ordinistampainvii',
      as: 'ordini_stampa_invii',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni Ordini di Stampa configurate'));

    // ========================================
    // RELAZIONI ATTIVITÀ
    // ========================================

    // AttivitaUtente -> Utente (belongsTo)
    AttivitaUtente.belongsTo(Utente, {
      foreignKey: 'id_utente_attivita_utente',
      as: 'utente',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Utente -> AttivitaUtente (hasMany)
    Utente.hasMany(AttivitaUtente, {
      foreignKey: 'id_utente_attivita_utente',
      as: 'attivita_utente',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // AttivitaUtente -> Attivita (belongsTo)
    AttivitaUtente.belongsTo(Attivita, {
      foreignKey: 'id_attivita_attivita_utente',
      as: 'attivita',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Attivita -> AttivitaUtente (hasMany)
    Attivita.hasMany(AttivitaUtente, {
      foreignKey: 'id_attivita_attivita_utente',
      as: 'attivita_utente',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Attivita -> Utente (belongsTo) - per l'utente che ha creato l'attività
    Attivita.belongsTo(Utente, {
      foreignKey: 'idutente_attivita',
      as: 'utente_creatore',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // Utente -> Attivita (hasMany) - per le attività create dall'utente
    Utente.hasMany(Attivita, {
      foreignKey: 'idutente_attivita',
      as: 'attivita_create',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
    Utente.hasMany(GDOWhatsappConversation, {
      foreignKey: 'id_utente_gdowhatsappconversation',
      as: 'whatsapp_conversations',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni Attività configurate'));

    // ========================================
    // RELAZIONI WEBHOOK
    // ========================================

    // TentativoWebhook -> Webhook (belongsTo)
    TentativoWebhook.belongsTo(Webhook, {
      foreignKey: 'webhook_id_tentativo',
      as: 'webhook',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Webhook -> TentativoWebhook (hasMany)
    Webhook.hasMany(TentativoWebhook, {
      foreignKey: 'webhook_id_tentativo',
      as: 'tentativi',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni Webhook configurate'));

    // ========================================
    // RELAZIONI COMBINAZIONI CANALI E AREE
    // ========================================

    // CombinazioneCanaleArea -> Canale (belongsTo)
    CombinazioneCanaleArea.belongsTo(Canale, {
      foreignKey: 'id_canale_combinazione_canale_area',
      as: 'canale',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Canale -> CombinazioneCanaleArea (hasMany)
    Canale.hasMany(CombinazioneCanaleArea, {
      foreignKey: 'id_canale_combinazione_canale_area',
      as: 'combinazioni_canale_area',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // CombinazioneCanaleArea -> Area (belongsTo)
    CombinazioneCanaleArea.belongsTo(Area, {
      foreignKey: 'id_area_combinazione_canale_area',
      as: 'area',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Area -> CombinazioneCanaleArea (hasMany)
    Area.hasMany(CombinazioneCanaleArea, {
      foreignKey: 'id_area_combinazione_canale_area',
      as: 'combinazioni_canale_area',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // CombinazioneCanaleArea -> GDO (belongsTo)
    CombinazioneCanaleArea.belongsTo(GDO, {
      foreignKey: 'id_gdo_combinazione_canale_area',
      as: 'gdo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // GDO -> CombinazioneCanaleArea (hasMany)
    GDO.hasMany(CombinazioneCanaleArea, {
      foreignKey: 'id_gdo_combinazione_canale_area',
      as: 'combinazioni_canale_area',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni Combinazioni Canali e Aree configurate'));

    // ========================================
    // RELAZIONI GDO (SELF-REFERENCING)
    // ========================================

    // GDO -> GDO (belongsTo) - per la gerarchia parent/child
    GDO.belongsTo(GDO, {
      foreignKey: 'idparent_gdo',
      as: 'parent',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // GDO -> GDO (hasMany) - per i figli
    GDO.hasMany(GDO, {
      foreignKey: 'idparent_gdo',
      as: 'children',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
    GDO.hasMany(GDOWhatsappNumbers, {
      foreignKey: 'id_gdo_gdowhatsappnumbers',
      as: 'whatsapp_numbers',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    GDO.hasMany(GDOWhatsappTemplate, {
      foreignKey: 'id_gdo_gdowhatsapptemplate',
      as: 'whatsapp_templates',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    GDO.hasMany(GDOWhatsappConversation, {
      foreignKey: 'id_gdo_gdowhatsappconversation',
      as: 'whatsapp_conversations',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni GDO self-referencing configurate'));

    // ========================================
    // RELAZIONI WISHLIST WEBPLIANT
    // ========================================

    // WishlistWebpliant -> Canale (belongsTo)
    WishlistWebpliant.belongsTo(Canale, {
      foreignKey: 'idcanale_whishlistwepliant',
      as: 'canale',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Canale -> WishlistWebpliant (hasMany)
    Canale.hasMany(WishlistWebpliant, {
      foreignKey: 'idcanale_whishlistwepliant',
      as: 'wishlist_webpliant',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // WishlistWebpliant -> Area (belongsTo)
    WishlistWebpliant.belongsTo(Area, {
      foreignKey: 'idarea_whishlistwepliant',
      as: 'area',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Area -> WishlistWebpliant (hasMany)
    Area.hasMany(WishlistWebpliant, {
      foreignKey: 'idarea_whishlistwepliant',
      as: 'wishlist_webpliant',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // WishlistWebpliant -> PuntoVendita (belongsTo)
    WishlistWebpliant.belongsTo(PuntoVendita, {
      foreignKey: 'idpv_whishlistwepliant',
      as: 'punto_vendita',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // PuntoVendita -> WishlistWebpliant (hasMany)
    PuntoVendita.hasMany(WishlistWebpliant, {
      foreignKey: 'idpv_whishlistwepliant',
      as: 'wishlist_webpliant',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni Wishlist Webpliant configurate'));

    // ========================================
    // RELAZIONI TRACCIATI
    // ========================================

    // Tracciati -> Promo (belongsTo)
    Tracciati.belongsTo(Promo, {
      foreignKey: 'id_promo_tracciati',
      as: 'promo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Promo -> Tracciati (hasMany)
    Promo.hasMany(Tracciati, {
      foreignKey: 'id_promo_tracciati',
      as: 'tracciati',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni Tracciati configurate'));

    // ========================================
    // RELAZIONI AREE E CANALI CON GDO
    // ========================================

    // Area -> GDO (belongsTo)
    Area.belongsTo(GDO, {
      foreignKey: 'id_gdo_aree',
      as: 'gdo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // GDO -> Area (hasMany)
    GDO.hasMany(Area, {
      foreignKey: 'id_gdo_aree',
      as: 'aree',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Canale -> GDO (belongsTo)
    Canale.belongsTo(GDO, {
      foreignKey: 'id_gdo_canali',
      as: 'gdo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // GDO -> Canale (hasMany)
    GDO.hasMany(Canale, {
      foreignKey: 'id_gdo_canali',
      as: 'canali',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni Aree e Canali con GDO configurate'));

    // ========================================
    // RELAZIONI DESIGN KIT
    // ========================================

    // DesignKit -> RaccoglitoreKit (belongsTo)
    DesignKit.belongsTo(RaccoglitoreKit, {
      foreignKey: 'id_raccoglitore',
      as: 'raccoglitore',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // DesignKit -> Area (belongsTo)
    DesignKit.belongsTo(Area, {
      foreignKey: 'id_area',
      as: 'area',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // DesignKit -> Canale (belongsTo)
    DesignKit.belongsTo(Canale, {
      foreignKey: 'id_canale',
      as: 'canale',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // DesignKit -> Formati (belongsTo)
    DesignKit.belongsTo(Formati, {
      foreignKey: 'id_formato',
      as: 'formato',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // RaccoglitoreKit -> DesignKit (hasMany)
    RaccoglitoreKit.hasMany(DesignKit, {
      foreignKey: 'id_raccoglitore',
      as: 'designKits',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Area -> DesignKit (hasMany)
    Area.hasMany(DesignKit, {
      foreignKey: 'id_area',
      as: 'designKits',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Canale -> DesignKit (hasMany)
    Canale.hasMany(DesignKit, {
      foreignKey: 'id_canale',
      as: 'designKits',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Formati -> DesignKit (hasMany)
    Formati.hasMany(DesignKit, {
      foreignKey: 'id_formato',
      as: 'designKits',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni DesignKit configurate'));

    // ========================================
    // RELAZIONI RUNTIME KIT
    // ========================================

    // RuntimeKit -> RaccoglitoreKit (belongsTo)
    RuntimeKit.belongsTo(RaccoglitoreKit, {
      foreignKey: 'id_raccoglitore',
      as: 'raccoglitore',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // RuntimeKit -> DesignKit (belongsTo)
    RuntimeKit.belongsTo(DesignKit, {
      foreignKey: 'id_design',
      as: 'designKit',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // RuntimeKit -> Area (belongsTo)
    RuntimeKit.belongsTo(Area, {
      foreignKey: 'id_area',
      as: 'area',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // RuntimeKit -> Canale (belongsTo)
    RuntimeKit.belongsTo(Canale, {
      foreignKey: 'id_canale',
      as: 'canale',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // RuntimeKit -> Formati (belongsTo)
    RuntimeKit.belongsTo(Formati, {
      foreignKey: 'id_formato',
      as: 'formato',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // RuntimeKit -> Promo (belongsTo)
    RuntimeKit.belongsTo(Promo, {
      foreignKey: 'id_promo',
      as: 'promo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // RaccoglitoreKit -> RuntimeKit (hasMany)
    RaccoglitoreKit.hasMany(RuntimeKit, {
      foreignKey: 'id_raccoglitore',
      as: 'runtimeKits',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // DesignKit -> RuntimeKit (hasMany)
    DesignKit.hasMany(RuntimeKit, {
      foreignKey: 'id_design',
      as: 'runtimeKits',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Area -> RuntimeKit (hasMany)
    Area.hasMany(RuntimeKit, {
      foreignKey: 'id_area',
      as: 'runtimeKits',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Canale -> RuntimeKit (hasMany)
    Canale.hasMany(RuntimeKit, {
      foreignKey: 'id_canale',
      as: 'runtimeKits',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Formati -> RuntimeKit (hasMany)
    Formati.hasMany(RuntimeKit, {
      foreignKey: 'id_formato',
      as: 'runtimeKits',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Promo -> RuntimeKit (hasMany)
    Promo.hasMany(RuntimeKit, {
      foreignKey: 'id_promo',
      as: 'runtimeKits',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni RuntimeKit configurate'));

    // ========================================
    // RELAZIONI FILES RUNTIME
    // ========================================

    // FilesRuntime -> RuntimeKit (belongsTo)
    FilesRuntime.belongsTo(RuntimeKit, {
      foreignKey: 'id_runtime',
      as: 'runtimeKit',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // RuntimeKit -> FilesRuntime (hasMany)
    RuntimeKit.hasMany(FilesRuntime, {
      foreignKey: 'id_runtime',
      as: 'files',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni FilesRuntime configurate'));

    // ========================================
    // RELAZIONI REFERENZE
    // ========================================

    // Referenze -> RuntimeKit (belongsTo)
    Referenze.belongsTo(RuntimeKit, {
      foreignKey: 'id_runtime_kit',
      as: 'runtimeKit',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Referenze -> Promo (belongsTo)
    Referenze.belongsTo(Promo, {
      foreignKey: 'id_promo',
      as: 'promo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // RuntimeKit -> Referenze (hasMany)
    RuntimeKit.hasMany(Referenze, {
      foreignKey: 'id_runtime_kit',
      as: 'referenze',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Promo -> Referenze (hasMany)
    Promo.hasMany(Referenze, {
      foreignKey: 'id_promo',
      as: 'referenze',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni Referenze configurate'));

    // ========================================
    // RELAZIONI FILES RUNTIME LOG
    // ========================================

    // FilesRuntimeLog -> RuntimeKit (belongsTo)
    FilesRuntimeLog.belongsTo(RuntimeKit, {
      foreignKey: 'id_kit_runtime',
      as: 'runtimeKit',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // RuntimeKit -> FilesRuntimeLog (hasMany)
    RuntimeKit.hasMany(FilesRuntimeLog, {
      foreignKey: 'id_kit_runtime',
      as: 'filesRuntimeLogs',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni FilesRuntimeLog configurate'));

    // ========================================
    // RELAZIONI RACCOGLITORE KIT
    // ========================================

    // RaccoglitoreKit -> Formati (belongsTo)
    RaccoglitoreKit.belongsTo(Formati, {
      foreignKey: 'id_formato',
      as: 'formato',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Formati -> RaccoglitoreKit (hasMany)
    Formati.hasMany(RaccoglitoreKit, {
      foreignKey: 'id_formato',
      as: 'raccoglitoreKits',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // RaccoglitoreKit -> Area (belongsToMany)
    RaccoglitoreKit.belongsToMany(Area, {
      through: 'raccoglitore_kit_aree',
      foreignKey: 'id_raccoglitore_kit',
      otherKey: 'id_area',
      as: 'aree',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Area -> RaccoglitoreKit (belongsToMany)
    Area.belongsToMany(RaccoglitoreKit, {
      through: 'raccoglitore_kit_aree',
      foreignKey: 'id_area',
      otherKey: 'id_raccoglitore_kit',
      as: 'raccoglitoreKits',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // RaccoglitoreKit -> Canale (belongsToMany)
    RaccoglitoreKit.belongsToMany(Canale, {
      through: 'raccoglitore_kit_canali',
      foreignKey: 'id_raccoglitore_kit',
      otherKey: 'id_canale',
      as: 'canali',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Canale -> RaccoglitoreKit (belongsToMany)
    Canale.belongsToMany(RaccoglitoreKit, {
      through: 'raccoglitore_kit_canali',
      foreignKey: 'id_canale',
      otherKey: 'id_raccoglitore_kit',
      as: 'raccoglitoreKits',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // RaccoglitoreKit -> PuntoVendita (belongsToMany)
    RaccoglitoreKit.belongsToMany(PuntoVendita, {
      through: 'raccoglitore_kit_punti_vendita',
      foreignKey: 'id_raccoglitore_kit',
      otherKey: 'id_punto_vendita',
      as: 'punti_vendita',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // PuntoVendita -> RaccoglitoreKit (belongsToMany)
    PuntoVendita.belongsToMany(RaccoglitoreKit, {
      through: 'raccoglitore_kit_punti_vendita',
      foreignKey: 'id_punto_vendita',
      otherKey: 'id_raccoglitore_kit',
      as: 'raccoglitoreKits',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // RaccoglitoreKit -> Promo (belongsToMany)
    RaccoglitoreKit.belongsToMany(Promo, {
      through: 'raccoglitore_kit_promo',
      foreignKey: 'id_raccoglitore_kit',
      otherKey: 'id_promo',
      as: 'promo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Promo -> RaccoglitoreKit (belongsToMany)
    Promo.belongsToMany(RaccoglitoreKit, {
      through: 'raccoglitore_kit_promo',
      foreignKey: 'id_promo',
      otherKey: 'id_raccoglitore_kit',
      as: 'raccoglitoreKits',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // RaccoglitoreKit -> GDO (belongsToMany)
    RaccoglitoreKit.belongsToMany(GDO, {
      through: 'raccoglitore_kit_gdo',
      foreignKey: 'id_raccoglitore_kit',
      otherKey: 'id_gdo',
      as: 'gdos',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // GDO -> RaccoglitoreKit (belongsToMany)
    GDO.belongsToMany(RaccoglitoreKit, {
      through: 'raccoglitore_kit_gdo',
      foreignKey: 'id_gdo',
      otherKey: 'id_raccoglitore_kit',
      as: 'raccoglitoreKits',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    GDOWhatsappNumbers.belongsTo(GDO, {
      foreignKey: 'id_gdo_gdowhatsappnumbers',
      as: 'gdo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    GDOWhatsappTemplate.belongsTo(GDO, {
      foreignKey: 'id_gdo_gdowhatsapptemplate',
      as: 'gdo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    GDOWhatsappConversation.belongsTo(GDO, {
      foreignKey: 'id_gdo_gdowhatsappconversation',
      as: 'gdo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    GDOWhatsappConversation.belongsTo(Utente, {
      foreignKey: 'id_utente_gdowhatsappconversation',
      as: 'utente',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    GDOWhatsappMessage.belongsTo(GDOWhatsappConversation, {
      foreignKey: 'id_conversation_gdowhatsappmessage',
      as: 'conversation',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni RaccoglitoreKit configurate'));

    // ========================================
    // RELAZIONI FILTER TEMPLATE
    // ========================================

    // FilterTemplate -> GDO (belongsTo)
    FilterTemplate.belongsTo(GDO, {
      foreignKey: 'id_gdo',
      as: 'gdo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // GDO -> FilterTemplate (hasMany)
    GDO.hasMany(FilterTemplate, {
      foreignKey: 'id_gdo',
      as: 'filter_templates',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // FilterTemplate -> Utente (belongsTo) - Creatore
    FilterTemplate.belongsTo(Utente, {
      foreignKey: 'id_utente_creatore',
      as: 'creatore',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // Utente -> FilterTemplate (hasMany)
    Utente.hasMany(FilterTemplate, {
      foreignKey: 'id_utente_creatore',
      as: 'filter_templates_creati',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni FilterTemplate configurate'));

    // ========================================
    // RELAZIONI DISPOSITIVI E DISPLAY CONTEXT PUNTO VENDITA
    // ========================================

    // PuntoVendita -> DispositivoPuntoVendita (hasMany)
    PuntoVendita.hasMany(DispositivoPuntoVendita, {
      foreignKey: 'id_puntivendita',
      as: 'dispositivi',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // DispositivoPuntoVendita -> PuntoVendita (belongsTo)
    DispositivoPuntoVendita.belongsTo(PuntoVendita, {
      foreignKey: 'id_puntivendita',
      as: 'puntoVendita',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // DisplayContextPuntoVendita -> GDO (belongsTo)
    DisplayContextPuntoVendita.belongsTo(GDO, {
      foreignKey: 'id_gdo_display_context',
      as: 'gdo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // GDO -> DisplayContextPuntoVendita (hasMany)
    GDO.hasMany(DisplayContextPuntoVendita, {
      foreignKey: 'id_gdo_display_context',
      as: 'display_contexts',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // DisplayContextPuntoVendita -> PuntoVendita (belongsTo, opzionale)
    DisplayContextPuntoVendita.belongsTo(PuntoVendita, {
      foreignKey: 'id_puntivendita_display_context',
      as: 'puntoVendita',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // PuntoVendita -> DisplayContextPuntoVendita (hasMany)
    PuntoVendita.hasMany(DisplayContextPuntoVendita, {
      foreignKey: 'id_puntivendita_display_context',
      as: 'display_contexts',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // DispositivoPuntoVendita -> DisplayContextPuntoVendita (belongsTo)
    DispositivoPuntoVendita.belongsTo(DisplayContextPuntoVendita, {
      foreignKey: 'id_display_context_dispositivo',
      as: 'displayContext',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // DisplayContextPuntoVendita -> DispositivoPuntoVendita (hasMany)
    DisplayContextPuntoVendita.hasMany(DispositivoPuntoVendita, {
      foreignKey: 'id_display_context_dispositivo',
      as: 'dispositivi',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    log.info(Colorize.green('✅ Relazioni Dispositivi e Display Context configurate'));

    // ========================================
    // RELAZIONI PERMESSI
    // ========================================

    Permesso.hasMany(PermessoRuolo, {
      foreignKey: 'id_permesso',
      as: 'permessiRuolo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    PermessoRuolo.belongsTo(Permesso, {
      foreignKey: 'id_permesso',
      as: 'permesso'
    });

    Permesso.hasMany(PermessoRuoloGdo, {
      foreignKey: 'id_permesso',
      as: 'permessiRuoloGdo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    PermessoRuoloGdo.belongsTo(Permesso, {
      foreignKey: 'id_permesso',
      as: 'permesso'
    });

    GDO.hasMany(PermessoRuoloGdo, {
      foreignKey: 'id_gdo',
      as: 'permessiOverride',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    PermessoRuoloGdo.belongsTo(GDO, {
      foreignKey: 'id_gdo',
      as: 'gdo'
    });

    // Relazioni RuoloUtenteGDO <-> Permessi (sotto-ruoli GDO)
    RuoloUtenteGDO.hasMany(PermessoRuolo, {
      foreignKey: 'id_ruolo_utente_gdo',
      as: 'permessiRuolo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    PermessoRuolo.belongsTo(RuoloUtenteGDO, {
      foreignKey: 'id_ruolo_utente_gdo',
      as: 'ruoloGdo'
    });

    RuoloUtenteGDO.hasMany(PermessoRuoloGdo, {
      foreignKey: 'id_ruolo_utente_gdo',
      as: 'permessiRuoloGdo',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    PermessoRuoloGdo.belongsTo(RuoloUtenteGDO, {
      foreignKey: 'id_ruolo_utente_gdo',
      as: 'ruoloGdo'
    });

    log.info(Colorize.green('✅ Relazioni Permessi configurate'));

    // ========================
    // MENU ITEMS — Self-reference per subMenu
    // ========================
    MenuItem.hasMany(MenuItem, {
      foreignKey: 'id_parent',
      as: 'subMenu',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    MenuItem.belongsTo(MenuItem, {
      foreignKey: 'id_parent',
      as: 'parent'
    });

    log.info(Colorize.green('✅ Relazioni MenuItem configurate'));

    log.info(Colorize.bgGreen('🎉 Tutte le relazioni tra modelli sono state configurate con successo!'));

    // Marca le relazioni come configurate
    relazioniConfigurate = true;

  } catch (error) {
    log.error(Colorize.red('❌ Errore durante la configurazione delle relazioni:'), error);
    throw error;
  }
}

/**
 * Resetta il flag delle relazioni configurate (utile per i test)
 */
export function resetRelazioni(): void {
  relazioniConfigurate = false;
  log.info(Colorize.blue('🔄 Flag relazioni resettato'));
}

/**
 * Verifica che tutte le relazioni siano state configurate correttamente
 */
export function verificaRelazioni(): boolean {
  try {
    log.info(Colorize.blue('🔍 Verifica configurazione relazioni...'));

    // Verifica che i modelli abbiano le associazioni configurate
    const modelli = [
      { nome: 'Utente', model: Utente },
      { nome: 'UtentiGDO', model: UtentiGDO },
      { nome: 'GDO', model: GDO },
      { nome: 'PuntoVendita', model: PuntoVendita },
      { nome: 'OrdiniDiStampa', model: OrdiniDiStampa },
      { nome: 'AttivitaUtente', model: AttivitaUtente },
      { nome: 'Webhook', model: Webhook }
    ];

    let tutteConfigurate = true;

    for (const { nome, model } of modelli) {
      const associazioni = Object.keys(model.associations);
      if (associazioni.length === 0) {
        log.warn(Colorize.yellow(`⚠️  ${nome}: nessuna associazione configurata`));
        tutteConfigurate = false;
      } else {
        log.info(Colorize.green(`✅ ${nome}: ${associazioni.length} associazioni configurate`));
      }
    }

    if (tutteConfigurate) {
      log.info(Colorize.bgGreen('🎉 Tutte le relazioni sono configurate correttamente!'));
    } else {
      log.warn(Colorize.bgYellow('⚠️  Alcune relazioni potrebbero non essere configurate correttamente'));
    }

    return tutteConfigurate;

  } catch (error) {
    log.error(Colorize.red('❌ Errore durante la verifica delle relazioni:'), error);
    return false;
  }
}

/**
 * Ottieni informazioni dettagliate sulle relazioni di un modello specifico
 */
export function getInfoRelazioni(nomeModello: string): any {
  try {
    const modelli: { [key: string]: any } = {
      'Utente': Utente,
      'UtentiGDO': UtentiGDO,
      'GDO': GDO,
      'PuntoVendita': PuntoVendita,
      'OrdiniDiStampa': OrdiniDiStampa,
      'AttivitaUtente': AttivitaUtente,
      'Webhook': Webhook,
      'Promo': Promo,
      'Attivita': Attivita
    };

    const modello = modelli[nomeModello];
    if (!modello) {
      throw new Error(`Modello '${nomeModello}' non trovato`);
    }

    const associazioni = Object.entries(modello.associations).map(([nome, associazione]: [string, any]) => ({
      nome,
      tipo: associazione.associationType,
      modello_target: associazione.target.name,
      foreign_key: associazione.foreignKey,
      as: associazione.as
    }));

    return {
      modello: nomeModello,
      associazioni,
      totale_associazioni: associazioni.length
    };

  } catch (error) {
    log.error(Colorize.red(`❌ Errore nel recupero info relazioni per ${nomeModello}:`), error);
    return null;
  }
}

const relazioniExports = {
  configuraRelazioni,
  resetRelazioni,
  verificaRelazioni,
  getInfoRelazioni
};

export default relazioniExports;
