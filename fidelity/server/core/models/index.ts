import { Colorize } from '../../../lib/Colorize';
import { sequelize } from '../db/SequelizeConnector';
import { log } from '../logger';

// Import di tutti i modelli Sequelize
import { ApprofondimentoVino } from './approfondimento_vino';
import { Area } from './aree';
import { Attivita } from './attivita';
import { Canale } from './canali';
import { CanaleInterazione } from './canali_interazione';
import { CombinazioneCanaleArea } from './combinazioni_canali_aree';
import { Config } from './config';
import { ContenutiAggiuntiviReferenza } from './contenuti_aggiuntivi_referenza';
import { ContrattoTipografia } from './contratto_tipografia';
import { DesignKit } from './design_kit';
import { FilesRuntime } from './files_runtime';
import { FilesRuntimeLog } from './files_runtime_log';
import { Formati } from './formati';
import { GDO } from './gdo';
import { NamingConvention } from './naming_convention';
import { OrdiniDiStampa } from './ordini_di_stampa';
import { OrdiniDiStampaInvii } from './ordini_di_stampa_invii';
import { Promo } from './promo';
import { PromoScoreboard } from './promo_scoreboard';
import { DisplayContextPuntoVendita } from './punto_vendita/display_context_punto_vendita';
import { DispositivoPuntoVendita } from "./punto_vendita/dispositivi_punto_vendita";
import { PuntoVendita } from './punto_vendita/punti_vendita';
import { PuntoVenditaUtenti } from './punto_vendita/punti_vendita_utenti';
import { RaccoglitoreKit } from './raccoglitore_kit';
import { Referenze } from './referenze';
import { ReferenzeGruppo } from './referenze_gruppo';
import { Ricette } from './ricette';
import { RuntimeKit } from './runtime_kit';
import { RuoloPuntoVendita } from './ruolo_punto_vendita';
import { StatisticheApi } from './statistiche_api';
import { TentativoWebhook } from './TentativoWebhook';
import { TipiDiExport } from './tipi_di_export';
import { Tracciati } from './tracciati';
import { TracciatiMomento } from './tracciati_momento';
import { TracciatiMomentoConfronti } from './tracciati_momento_confronti';
import { TracciatiReport } from './tracciati_report';
import { TracciatiSchema } from './tracciati_schema';
import { Utente } from './utenti';
import { UtentiAnonimi } from './utenti_anonimi';
import { UtentiGDO } from './utenti_gdo';
import { UtentiGuest } from './utenti_guest';
import { Webhook } from './Webhook';
import { GDOWhatsappCampagne } from './whatsapp/gdo_whatsapp_campagne';
import { GDOWhatsappConversation } from './whatsapp/gdo_whatsapp_conversions';
import { GDOWhatsappQueueJob } from './whatsapp/gdo_whatsapp_message_queue';
import { GDOWhatsappMessage } from './whatsapp/gdo_whatsapp_messages';
import { GDOWhatsappNumbers } from './whatsapp/gdo_whatsapp_numbers';
import { GDOWhatsappPreset } from './whatsapp/gdo_whatsapp_preset';
import { GDOWhatsappTemplate } from './whatsapp/gdo_whatsapp_template';

import { WishlistWebpliant } from './wishlist_webpliant';
import { WorkspaceWebpliant } from './workspace_webpliant';
// Import dei modelli token effimeri
import { EphemeralAuditLog } from './ephemeral/ephemeral_audit_log';
import { EphemeralChallenge } from './ephemeral/ephemeral_challenge';
import { EphemeralOriginsWhitelist } from './ephemeral/ephemeral_origins_whitelist';
import { EphemeralToken } from './ephemeral/ephemeral_token';
import { AttivitaUtente } from './attivita_utente';
import { FilterTemplate } from './filter_template';
import { applyMixins } from './mixins';
import { MenuItem } from './menu_item';
import { Permesso } from './permessi';
import { PermessoRuolo } from './permessi_ruolo';
import { PermessoRuoloGdo } from './permessi_ruolo_gdo';
import { PluginAnalyticsEvent } from './plugin_analytics_event';
import { RuoloUtenteGDO } from './ruolo_gdo';
import { AuditLog } from './audit_log';
import { AuthProvider } from './auth_provider';
import { HubService } from './hub_service';
import { HubNews } from './hub_news';
import { LavoroInBackground } from './lavori_in_background';

// Elenco di tutti i modelli con metadata
export const MODELLI_SEQUELIZE = {
  // Modelli base
  ApprofondimentoVino: { model: ApprofondimentoVino, nome: 'ApprofondimentoVino', tabella: 'approfondimento_vino' },
  Area: { model: Area, nome: 'Area', tabella: 'aree' },
  Attivita: { model: Attivita, nome: 'Attivita', tabella: 'attivita' },
  Canale: { model: Canale, nome: 'Canale', tabella: 'canali' },
  CanaleInterazione: { model: CanaleInterazione, nome: 'CanaleInterazione', tabella: 'canali_interazione' },
  CombinazioneCanaleArea: { model: CombinazioneCanaleArea, nome: 'CombinazioneCanaleArea', tabella: 'combinazione_canale_area' },
  Config: { model: Config, nome: 'Config', tabella: 'config' },
  ContenutiAggiuntiviReferenza: { model: ContenutiAggiuntiviReferenza, nome: 'ContenutiAggiuntiviReferenza', tabella: 'contenuti_aggiuntivi_referenza' },
  ContrattoTipografia: { model: ContrattoTipografia, nome: 'ContrattoTipografia', tabella: 'contratto_tipografia' },
  Formati: { model: Formati, nome: 'Formati', tabella: 'formati' },
  GDO: { model: GDO, nome: 'GDO', tabella: 'gdo' },
  NamingConvention: { model: NamingConvention, nome: 'NamingConvention', tabella: 'naming_convention' },

  // Modelli ordini
  OrdiniDiStampa: { model: OrdiniDiStampa, nome: 'OrdiniDiStampa', tabella: 'ordini_stampa' },
  OrdiniDiStampaInvii: { model: OrdiniDiStampaInvii, nome: 'OrdiniDiStampaInvii', tabella: 'ordini_stampa_invii' },

  // Modelli punti vendita
  PuntoVendita: { model: PuntoVendita, nome: 'PuntoVendita', tabella: 'punti_vendita' },
  PuntoVenditaUtenti: { model: PuntoVenditaUtenti, nome: 'PuntoVenditaUtenti', tabella: 'punti_vendita_utenti' },
  DispositivoPuntoVendita: { model: DispositivoPuntoVendita, nome: 'DispositivoPuntoVendita', tabella: 'dispositivi_punto_vendita' },
  DisplayContextPuntoVendita: { model: DisplayContextPuntoVendita, nome: 'DisplayContextPuntoVendita', tabella: 'display_context_punto_vendita' },
  // Modelli export
  TipiDiExport: { model: TipiDiExport, nome: 'TipiDiExport', tabella: 'tipi_export' },
  TipoUtentePuntoVendita: { model: RuoloPuntoVendita, nome: 'RuoloPuntoVendita', tabella: 'ruolo_punto_vendita' },
  // Modelli tracciamento
  Tracciati: { model: Tracciati, nome: 'Tracciati', tabella: 'tracciati' },
  TracciatiReport: { model: TracciatiReport, nome: 'TracciatiReport', tabella: 'tracciati_report' },
  TracciatiMomento: { model: TracciatiMomento, nome: 'TracciatiMomento', tabella: 'tracciati_momento' },
  TracciatiMomentoConfronti: { model: TracciatiMomentoConfronti, nome: 'TracciatiMomentoConfronti', tabella: 'tracciati_momento_confronti' },
  TracciatiSchema: { model: TracciatiSchema, nome: 'TracciatiSchema', tabella: 'tracciati_schema' },

  // Modelli utenti
  Utente: { model: Utente, nome: 'Utente', tabella: 'utenti' },
  UtentiAnonimi: { model: UtentiAnonimi, nome: 'UtentiAnonimi', tabella: 'utenti_anonimi' },
  UtentiGDO: { model: UtentiGDO, nome: 'UtentiGDO', tabella: 'utenti_gdo' },
  UtentiGuest: { model: UtentiGuest, nome: 'UtentiGuest', tabella: 'utenti_guest' },

  // Modelli webhook
  Webhook: { model: Webhook, nome: 'Webhook', tabella: 'webhooks' },
  TentativoWebhook: { model: TentativoWebhook, nome: 'TentativoWebhook', tabella: 'tentativi_webhook' },


  //Modelli Whatsapp
  GDOWhatsappTemplate: { model: GDOWhatsappTemplate, nome: 'GDOWhatsappTemplate', tabella: 'gdo_whatsapp_template' },
  GDOWhatsappNumbers: { model: GDOWhatsappNumbers, nome: 'GDOWhatsappNumbers', tabella: 'gdo_whatsapp_numbers' },
  GDOWhatsappPreset: { model: GDOWhatsappPreset, nome: 'GDOWhatsappPreset', tabella: 'gdo_whatsapp_presets' },
  GDOWhatsappConversation: { model: GDOWhatsappConversation, nome: 'GDOWhatsappConversation', tabella: 'gdo_whatsapp_conversations' },
  GDOWhatsappMessage: { model: GDOWhatsappMessage, nome: 'GDOWhatsappMessage', tabella: 'gdo_whatsapp_messages' },
  GDOWhatsappCampagne: { model: GDOWhatsappCampagne, nome: 'GDOWhatsappCampagne', tabella: 'gdo_whatsapp_campagne' },
  GDOWhatsappQueueJob: { model: GDOWhatsappQueueJob, nome: 'GDOWhatsappQueueJob', tabella: 'gdo_whatsapp_message_queue' },

  // Altri modelli
  WishlistWebpliant: { model: WishlistWebpliant, nome: 'WishlistWebpliant', tabella: 'wishlist_webpliant' },
  WorkspaceWebpliant: { model: WorkspaceWebpliant, nome: 'WorkspaceWebpliant', tabella: 'workspace_webpliant' },
  StatisticheApi: { model: StatisticheApi, nome: 'StatisticheApi', tabella: 'statistiche_api' },

  Promo: { model: Promo, nome: 'Promo', tabella: 'promo' },
  PromoScoreboard: { model: PromoScoreboard, nome: 'PromoScoreboard', tabella: 'promo_scoreboard' },
  RaccoglitoreKit: { model: RaccoglitoreKit, nome: 'RaccoglitoreKit', tabella: 'raccoglitore_kit' },
  DesignKit: { model: DesignKit, nome: 'DesignKit', tabella: 'design_kit' },
  RuntimeKit: { model: RuntimeKit, nome: 'RuntimeKit', tabella: 'runtime_kit' },
  FilesRuntime: { model: FilesRuntime, nome: 'FilesRuntime', tabella: 'files_runtime' },
  FilesRuntimeLog: { model: FilesRuntimeLog, nome: 'FilesRuntimeLog', tabella: 'files_runtime_log' },
  Referenze: { model: Referenze, nome: 'Referenze', tabella: 'referenze' },
  ReferenzeGruppo: { model: ReferenzeGruppo, nome: 'ReferenzeGruppo', tabella: 'referenze_gruppo' },
  Ricette: { model: Ricette, nome: 'Ricette', tabella: 'ricette' },
  RuoloUtenteGDO: { model: RuoloUtenteGDO, nome: 'RuoloUtenteGDO', tabella: 'ruolo_utente_gdo' },
  AttivitaUtente: { model: AttivitaUtente, nome: 'AttivitaUtente', tabella: 'attivita_utente' },

  // Modelli token effimeri
  EphemeralChallenge: { model: EphemeralChallenge, nome: 'EphemeralChallenge', tabella: 'ephemeral_challenges' },
  EphemeralToken: { model: EphemeralToken, nome: 'EphemeralToken', tabella: 'ephemeral_tokens' },
  EphemeralOriginsWhitelist: { model: EphemeralOriginsWhitelist, nome: 'EphemeralOriginsWhitelist', tabella: 'ephemeral_origins_whitelist' },
  EphemeralAuditLog: { model: EphemeralAuditLog, nome: 'EphemeralAuditLog', tabella: 'ephemeral_audit_log' },

  //Modello per creazione template filtri
  FilterTemplate: { model: FilterTemplate, nome: 'FilterTemplate', tabella: 'filter_templates' },

  // Modelli permessi
  Permesso: { model: Permesso, nome: 'Permesso', tabella: 'permessi' },
  PermessoRuolo: { model: PermessoRuolo, nome: 'PermessoRuolo', tabella: 'permessi_ruolo' },
  PermessoRuoloGdo: { model: PermessoRuoloGdo, nome: 'PermessoRuoloGdo', tabella: 'permessi_ruolo_gdo' },

  // Modello menu
  MenuItem: { model: MenuItem, nome: 'MenuItem', tabella: 'menu_items' },

  // Plugin analytics
  PluginAnalyticsEvent: { model: PluginAnalyticsEvent, nome: 'PluginAnalyticsEvent', tabella: 'plugin_analytics_events' },

  // Audit log
  AuditLog: { model: AuditLog, nome: 'AuditLog', tabella: 'audit_log' },

  // Hub - Auth Providers & Services
  AuthProvider: { model: AuthProvider, nome: 'AuthProvider', tabella: 'auth_providers' },
  HubService: { model: HubService, nome: 'HubService', tabella: 'hub_services' },
  HubNews: { model: HubNews, nome: 'HubNews', tabella: 'hub_news' },

  // Lavori in background condivisi fra i worker (import, raggruppamenti)
  LavoroInBackground: { model: LavoroInBackground, nome: 'LavoroInBackground', tabella: 'lavori_in_background' },
};

export interface ModelSyncResult {
  modello: string;
  tabella: string;
  successo: boolean;
  tempo_ms: number;
  errore?: string;
}

export interface OpzioniAllineamentoLegacy {
  /** Solo questi modelli (per nome), per il secondo passaggio dopo le migrazioni. */
  soloModelli?: string[];
}

export class ModelliManager {
  private static instance: ModelliManager;

  private constructor() { }

  public static getInstance(): ModelliManager {
    if (!ModelliManager.instance) {
      ModelliManager.instance = new ModelliManager();
    }
    return ModelliManager.instance;
  }

  /**
   * L'ALTER di Sequelize (sync con alter) su tutti i modelli del registro. Lo schema ormai cambia
   * solo con le migrazioni (db/migrazioni): questo resta per l'adozione della baseline su un
   * database creato dalla vecchia sincronizzazione, che va portato ai modelli un'ultima volta.
   * Non esegue script SQL ne' seed: view, correzioni e ruoli GDO li gestisce il runner delle
   * migrazioni. Un modello che fallisce finisce nel risultato e nel log, non ferma gli altri.
   */
  public async allineamentoLegacyPerAdozione(opzioni: OpzioniAllineamentoLegacy = {}): Promise<ModelSyncResult[]> {
    const startTime = Date.now();
    const risultati: ModelSyncResult[] = [];
    const syncOptions = { force: false, alter: true, logging: false };

    // Configura relazioni tra modelli: senza, mancano le chiavi esterne e l'ordine qui sotto
    try {
      const relazioniModule = await import('./relazioni');
      const configuraRelazioni =
        relazioniModule.configuraRelazioni ??
        relazioniModule.default?.configuraRelazioni;

      if (typeof configuraRelazioni !== 'function') {
        throw new TypeError("Export 'configuraRelazioni' non trovato in ./relazioni");
      }

      // Configura le relazioni (il flag interno evita doppia registrazione)
      configuraRelazioni();
    } catch (errore) {
      log.warn(Colorize.yellow('⚠️ Errore configurazione relazioni:', errore));
    }

    // Il ciclo e' sincrono: con forEach e callback async le promesse venivano scartate
    try {
      for (const { model } of Object.values(MODELLI_SEQUELIZE)) {
        applyMixins(model, ['fullTextSearch', 'validation', 'statistics']);
      }
    } catch (errore) {
      log.warn(Colorize.yellow('⚠️ Errore applicazione mixins:', errore));
    }

    // Sincronizza ogni modello, rispettando l'ordine delle dipendenze.
    //
    // L'ordine di dichiarazione di MODELLI_SEQUELIZE non ha relazione con quello
    // delle chiavi esterne: su un database vuoto questo faceva fallire i modelli
    // che dipendono da tabelle non ancora create (es. aree, dichiarata seconda,
    // ha una FK verso gdo, dichiarata decima), con "relation ... does not exist".
    //
    // getModelsTopoSortedByForeignKey e' la stessa API usata da sequelize.sync().
    // Attenzione alla direzione: sequelize.sync() INVERTE l'array prima di creare,
    // quindi l'ordine di creazione corretto e' quello invertito, non quello
    // restituito. Le associazioni sono gia' state configurate qui sopra, quindi
    // il grafo delle dipendenze e' completo.
    type VoceRegistro = {
      chiave: string;
      config: typeof MODELLI_SEQUELIZE[keyof typeof MODELLI_SEQUELIZE];
    };

    // La chiave e' il modello stesso: i tipi concreti del registro e il ModelType
    // restituito dall'ordinamento non coincidono, quindi la mappa resta generica.
    const vociPerModello = new Map<unknown, VoceRegistro>(
      Object.entries(MODELLI_SEQUELIZE).map(([chiave, config]) => [config.model, { chiave, config }])
    );

    const ordinatiPerDipendenza = sequelize.modelManager.getModelsTopoSortedByForeignKey();
    let daSincronizzare: VoceRegistro[];

    if (ordinatiPerDipendenza == null) {
      // Ciclo fra chiavi esterne: oggi non accade, ma se venisse introdotto
      // l'ordinamento non e' calcolabile. Si ripiega sull'ordine di dichiarazione,
      // cioe' sul comportamento precedente, segnalandolo.
      log.warn(Colorize.yellow(
        '⚠️ Dipendenze cicliche fra modelli: impossibile ordinare per chiave esterna, ' +
        'si procede con ordine di dichiarazione e alcune tabelle potrebbero non essere create'
      ));
      daSincronizzare = Object.entries(MODELLI_SEQUELIZE).map(([chiave, config]) => ({ chiave, config }));
    } else {
      // Solo i modelli del registro: le tabelle ponte generate da belongsToMany
      // non sono dichiarate qui e non vengono sincronizzate, come in precedenza.
      daSincronizzare = [...ordinatiPerDipendenza]
        .reverse()
        .map(model => vociPerModello.get(model))
        .filter((voce): voce is VoceRegistro => voce != null);
    }

    if (opzioni.soloModelli) {
      const richiesti = new Set(opzioni.soloModelli);
      daSincronizzare = daSincronizzare.filter(({ config }) => richiesti.has(config.nome));
    }

    log.info(Colorize.bgBlue(`🔄 Allineamento legacy di ${daSincronizzare.length} modelli Sequelize`));

    for (const { config } of daSincronizzare) {
      const modelStartTime = Date.now();

      try {
        await config.model.sync(syncOptions);

        risultati.push({
          modello: config.nome,
          tabella: config.tabella,
          successo: true,
          tempo_ms: Date.now() - modelStartTime
        });
      } catch (error) {
        const messaggioErrore = error instanceof Error ? error.message : String(error);

        risultati.push({
          modello: config.nome,
          tabella: config.tabella,
          successo: false,
          tempo_ms: Date.now() - modelStartTime,
          errore: messaggioErrore
        });

        log.error(Colorize.red(`❌ Errore allineamento ${config.nome}: ${messaggioErrore}`));
      }
    }

    const modelli_errore = risultati.filter(r => !r.successo).length;
    log.info(Colorize.bgGreen(`Allineamento legacy completato in ${Date.now() - startTime}ms`));
    log.info(Colorize.green(`   ✅ Successi: ${risultati.length - modelli_errore}`));
    if (modelli_errore > 0) {
      log.warn(Colorize.yellow(`   ⚠️  Errori: ${modelli_errore}`));
    }

    return risultati;
  }
}

// Esporta l'istanza singleton
export const modelliManager = ModelliManager.getInstance();

// Esporta tutti i modelli per compatibilità
export {
  ApprofondimentoVino, Area, Attivita, Canale, CanaleInterazione, CombinazioneCanaleArea, Config, ContenutiAggiuntiviReferenza,
  ContrattoTipografia, DesignKit, DisplayContextPuntoVendita, DispositivoPuntoVendita, EphemeralAuditLog, EphemeralChallenge, EphemeralOriginsWhitelist, EphemeralToken, FilesRuntime, FilesRuntimeLog, Formati, GDO, NamingConvention,
  OrdiniDiStampa, OrdiniDiStampaInvii, PromoScoreboard, PuntoVendita, PuntoVenditaUtenti, RaccoglitoreKit, Referenze, ReferenzeGruppo, Ricette, RuntimeKit, RuoloPuntoVendita, TentativoWebhook, TipiDiExport, Tracciati, TracciatiMomentoConfronti,
  Utente, UtentiAnonimi, UtentiGDO, UtentiGuest, Webhook, WishlistWebpliant, WorkspaceWebpliant,
  MenuItem, Permesso, PermessoRuolo, PermessoRuoloGdo,
  PluginAnalyticsEvent,
  AuthProvider,
  HubService,
  HubNews
};
