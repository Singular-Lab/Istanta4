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
// Import delle nuove funzionalità
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { RUOLO_UTENTE_GDO } from '../../../lib/enums';
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
};

export interface ModelSyncOptions {
  force?: boolean;
  alter?: boolean;
  drop?: boolean;
  logging?: boolean;
}

export interface ModelSyncResult {
  modello: string;
  tabella: string;
  successo: boolean;
  tempo_ms: number;
  errore?: string;
}
const ERRORI_IGNORABILI = [
  '42P07',  // PostgreSQL: relation already exists
  '42710',  // PostgreSQL: duplicate object
  '2BP01',  // PostgreSQL: dependent objects still exist (cannot drop)
  '42P01',  // PostgreSQL: table does not exist (utile per DROP IF NOT EXISTS mancante)
  '42703',  // PostgreSQL: column does not exist,
  '42883'
];
export class ModelliManager {
  private static instance: ModelliManager;
  private _modelliSincronizzati: Set<string> = new Set();
  private _ultimaSincronizzazione?: Date;

  private constructor() { }

  public static getInstance(): ModelliManager {
    if (!ModelliManager.instance) {
      ModelliManager.instance = new ModelliManager();
    }
    return ModelliManager.instance;
  }

  /**
   * Sincronizza tutti i modelli con il database
   */
  public async sincronizzaTuttiIModelli(options: ModelSyncOptions = {}): Promise<ModelSyncResult[]> {
    const startTime = Date.now();
    const risultati: ModelSyncResult[] = [];

    log.info(Colorize.bgBlue(`🔄 Inizio sincronizzazione di ${Object.keys(MODELLI_SEQUELIZE).length} modelli Sequelize`));

    // Configurazioni di default
    const syncOptions = {
      force: false,
      alter: true,
      logging: options.logging ?? false,
      ...options
    };

    // Configura relazioni tra modelli
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
      log.info(Colorize.blue('🔗 Configurazione relazioni tra modelli completata'));
    } catch (errore) {
      log.warn(Colorize.yellow('⚠️ Errore configurazione relazioni:', errore));
    }

    // Applica mixins ai modelli (se disponibile)
    // Il ciclo e' sincrono: con forEach e callback async le promesse venivano
    // scartate e il catch qui sotto non poteva intercettarle. Il seed dei ruoli
    // GDO, che era annidato qui dentro, e' stato spostato dopo la creazione
    // delle tabelle.
    try {
      for (const { model } of Object.values(MODELLI_SEQUELIZE)) {
        applyMixins(model, ['fullTextSearch', 'validation', 'statistics']);
      }
      //log.info(Colorize.blue('🔧 Applicazione mixins ai modelli...'));
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

    for (const { chiave, config } of daSincronizzare) {
      const modelStartTime = Date.now();

      try {
        //log.info(`📦 Sincronizzazione modello: ${config.nome} -> ${config.tabella}`);

        // Sincronizza il modello
        await config.model.sync(syncOptions);

        const tempo_ms = Date.now() - modelStartTime;

        risultati.push({
          modello: config.nome,
          tabella: config.tabella,
          successo: true,
          tempo_ms
        });

        this._modelliSincronizzati.add(chiave);

        //log.info(Colorize.green(`✅ ${config.nome} sincronizzato (${tempo_ms}ms)`));

      } catch (error) {
        const tempo_ms = Date.now() - modelStartTime;
        const messaggioErrore = error instanceof Error ? error.message : String(error);

        risultati.push({
          modello: config.nome,
          tabella: config.tabella,
          successo: false,
          tempo_ms,
          errore: messaggioErrore
        });

        log.error(Colorize.red(`❌ Errore sincronizzazione ${config.nome}: ${messaggioErrore}`));
      }
    }
    const fileInCartellaScripts = path.join(process.cwd(), '/server/core/db/scripts');
    const filesInCartellaScripts = await readdir(fileInCartellaScripts);
    for (const file of filesInCartellaScripts) {
      if (file.endsWith('.sql')) {
        const filePath = path.join(fileInCartellaScripts, file);
        const sql = await readFile(filePath, 'utf-8');
        try {
          await sequelize.query(sql);
          //log.info(Colorize.green(`✅ Script ${file} eseguito con successo`));

        } catch (error: any) {
          const codice = error.original?.code;
          if (ERRORI_IGNORABILI.includes(codice)) {
            log.warn(Colorize.yellow(`⚠️ ${file}: ignorato (${codice})`));
          } else {
            log.error(Colorize.red(`❌ Errore script ${file}: [${codice}] ${error.message}`));
          }

        }
      }
    }

    // Seed dei ruoli GDO: qui le tabelle esistono, sia quelle create dai modelli
    // sia quelle toccate dagli script SQL. Girava prima della sincronizzazione,
    // quindi su un database incompleto interrogava una tabella inesistente; e
    // non essendo atteso, il rigetto arrivava a process.on('unhandledRejection')
    // e spegneva il processo prima che il server si alzasse.
    try {
      const allRuoliGDO = await RuoloUtenteGDO.findAll();
      const mancanti = Object.values(RUOLO_UTENTE_GDO)
        .filter(ruolo => !allRuoliGDO.some(r => r.ruolo_ruolo_utente_gdo === ruolo))
        .map(ruolo => ({
          createdat: new Date(),
          updatedat: new Date(),
          ruolo_ruolo_utente_gdo: ruolo
        }));

      if (mancanti.length > 0) {
        await RuoloUtenteGDO.bulkCreate(mancanti, { ignoreDuplicates: false });
      }
    } catch (errore) {
      log.warn(Colorize.yellow('⚠️ Errore seed ruoli GDO:', errore));
    }

    this._ultimaSincronizzazione = new Date();
    const tempoTotale = Date.now() - startTime;

    // Statistiche finali
    const modelli_successo = risultati.filter(r => r.successo).length;
    const modelli_errore = risultati.filter(r => !r.successo).length;

    log.info(Colorize.bgGreen(`🎉 Sincronizzazione completata in ${tempoTotale}ms`));
    log.info(Colorize.green(`   ✅ Successi: ${modelli_successo}`));

    if (modelli_errore > 0) {
      log.warn(Colorize.yellow(`   ⚠️  Errori: ${modelli_errore}`));
    }

    return risultati;
  }

  /**
   * Sincronizza un singolo modello
   */
  public async sincronizzaModello(nomeModello: string, options: ModelSyncOptions = {}): Promise<ModelSyncResult> {
    const config = MODELLI_SEQUELIZE[nomeModello as keyof typeof MODELLI_SEQUELIZE];

    if (!config) {
      throw new Error(`Modello '${nomeModello}' non trovato`);
    }
    const startTime = Date.now();

    try {
      //log.info(`📦 Sincronizzazione modello: ${config.nome}`);

      await config.model.sync({
        force: false,
        alter: true,
        logging: false,
        ...options
      });

      //Seed dopo la sync, non prima: la tabella potrebbe non esistere ancora.
      if (nomeModello == 'RuoloUtenteGDO') {
        const ruoliGDO = Object.values(RUOLO_UTENTE_GDO).map(ruolo => ({
          ruolo_ruolo_utente_gdo: ruolo
        }));
        await RuoloUtenteGDO.bulkCreate(ruoliGDO, {
          updateOnDuplicate: ['ruolo_ruolo_utente_gdo']
        });
      }

      const tempo_ms = Date.now() - startTime;
      this._modelliSincronizzati.add(nomeModello);

      log.info(Colorize.green(`✅ ${config.nome} sincronizzato (${tempo_ms}ms)`));

      return {
        modello: config.nome,
        tabella: config.tabella,
        successo: true,
        tempo_ms
      };

    } catch (error) {
      const tempo_ms = Date.now() - startTime;
      const messaggioErrore = error instanceof Error ? error.message : String(error);

      log.error(Colorize.red(`❌ Errore sincronizzazione ${config.nome}: ${messaggioErrore}`));

      return {
        modello: config.nome,
        tabella: config.tabella,
        successo: false,
        tempo_ms,
        errore: messaggioErrore
      };
    }
  }

  /**
   * Verifica lo stato di sincronizzazione
   */
  public getStatoSincronizzazione() {
    return {
      modelli_totali: Object.keys(MODELLI_SEQUELIZE).length,
      modelli_sincronizzati: this._modelliSincronizzati.size,
      ultima_sincronizzazione: this._ultimaSincronizzazione,
      modelli: Object.entries(MODELLI_SEQUELIZE).map(([chiave, config]) => ({
        chiave,
        nome: config.nome,
        tabella: config.tabella,
        sincronizzato: this._modelliSincronizzati.has(chiave)
      }))
    };
  }

  /**
   * Reimposta lo stato di sincronizzazione
   */
  public reset() {
    this._modelliSincronizzati.clear();
    this._ultimaSincronizzazione = undefined;
    log.info('🔄 Stato sincronizzazione modelli reimpostato');
  }

  /**
   * Verifica la connessione al database
   */
  public async verificaConnessione(): Promise<boolean> {
    try {
      await sequelize.authenticate();
      log.info(Colorize.green('✅ Connessione database verificata'));
      return true;
    } catch (error) {
      log.error(Colorize.red('❌ Errore connessione database:'), error);
      return false;
    }
  }

  /**
   * Crea tutte le tabelle da zero (ATTENZIONE: cancella i dati esistenti!)
   */
  public async creaTabelleForce(): Promise<ModelSyncResult[]> {
    log.warn(Colorize.bgYellow('⚠️  ATTENZIONE: Creazione tabelle con FORCE - I dati esistenti verranno persi!'));

    return await this.sincronizzaTuttiIModelli({
      force: true,
      logging: true
    });
  }

  /**
   * Ottieni tutti i modelli registrati
   */
  public getModelli() {
    return MODELLI_SEQUELIZE;
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
