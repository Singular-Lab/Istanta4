import dayjs from 'dayjs';
import { Request as ExpressRequest, Response } from 'express';
import 'express-session';
import { v4 as uuidv4 } from 'uuid';
import { CATEGORIA_ATTIVITA, HttpStatusCode, STATO_LAVORAZIONE_KIT_RUNTIME, STATO_PROMO, TIPO_ATTIVITA, TIPO_KIT_DESIGN } from '../../../lib/enums';
import type { SaveMenaboLayoutRequest } from '../../../lib/types';
import { BaseController } from '../base/BaseController';
import config from '../config';
import { sequelize } from '../db';
import { MongoDBConnection } from '../db/MongoDBConnector';
import { UpdatePromoDTO } from '../dto';
import { IGdoService } from '../interfaces/IGdoService';
import { IImpostazioniService } from '../interfaces/IImpostazioniService';
import { IPromoService } from '../interfaces/IPromoService';
import { log } from '../logger';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';

import { ApprofondimentoVino, RaccoglitoreKit, Ricette } from '../models';
import { Config } from '../models/config';
import { ContenutiAggiuntiviReferenza } from '../models/contenuti_aggiuntivi_referenza';
import { DesignKit } from '../models/design_kit';
import { FilesRuntime } from '../models/files_runtime';
import { FilesRuntimeLog } from '../models/files_runtime_log';
import { Referenze } from '../models/referenze';
import { ReferenzeGruppo } from '../models/referenze_gruppo';
import { RuntimeKit } from '../models/runtime_kit';
import { WorkspaceWebpliant } from '../models/workspace_webpliant';
import { AuditLogService } from '../services/AuditLogService';
import { ServerUtils } from '../utils/ServerUtils';

export class PromoController extends BaseController {
  constructor(
    private promoService: IPromoService,
    private impostazioniService: IImpostazioniService,
    private gdoService: IGdoService
  ) {
    super('/api');
  }

  /*************************************
   * Route registration
   *************************************/
  protected setupRoutes(): void {
    this.initializeRoutes();
  }

  public initializeRoutes(): void {
    // Health check
    this.router.get('/promo/ping', authMiddleware, this.ping.bind(this));

    // Promo collection (static routes BEFORE parameterized)
    this.router.get('/promo', authMiddleware, permissionGuard('promo.visualizza'), this.getAllPromos.bind(this));
    this.router.get('/promo/filtered', authMiddleware, permissionGuard('promo.visualizza'), this.getAllPromosFiltered.bind(this));
    this.router.get('/promo/in-corso', authMiddleware, permissionGuard('promo.visualizza'), this.getAllPromosInCorso.bind(this));
    this.router.get('/promo/timeline', authMiddleware, permissionGuard('promo.visualizza'), this.getAllPromosTimeline.bind(this));
    this.router.get('/promo/storico', authMiddleware, permissionGuard('promo.visualizza'), this.getAllPromosStorico.bind(this));
    this.router.get('/promo/contesto', authMiddleware, permissionGuard('promo.crea'), this.getContestoPerNuovaLavorazione.bind(this));
    this.router.get('/promo/contesto-importazione', authMiddleware, permissionGuard('promo.crea'), this.get_contesto_per_importazione.bind(this));
    this.router.get('/promo/dashboard', authMiddleware, permissionGuard('promo.visualizza'), this.getPromozioniInCorsoPerDashboard.bind(this));
    this.router.get('/promo/test-notifica', this.testNotifica.bind(this));

    // Promo creation
    this.router.post('/promo', authMiddleware, permissionGuard('promo.crea'), this.inizioNuovaLavorazione.bind(this));
    // Promo by ID (parameterized routes)
    this.router.get("/promo/nome/:nomePromo", authMiddleware, permissionGuard('promo.visualizza'), this.getPromoByNome.bind(this))
    this.router.put('/promo/:id', authMiddleware, permissionGuard('promo.modifica'), this.updatePromo.bind(this));
    this.router.delete('/promo/:id',
      authMiddleware,
      permissionGuard("promo.elimina"),
      this.deletePromo.bind(this)
    );
    this.router.delete(
      '/promo/:id/stato/:stato',
      authMiddleware,
      permissionGuard("promo.elimina"),
      this.deleteLavorazione.bind(this)
    );
    this.router.get("/promo/menabo", authMiddleware, this.getDatoPerMenabo.bind(this))
    this.router.get('/promo/:idPromo/menabo-layout', authMiddleware, this.getMenaboLayout.bind(this));
    this.router.put('/promo/:idPromo/menabo-layout', authMiddleware, this.saveMenaboLayout.bind(this));
    this.router.post('/promo/:idPromo/export/xlsx', authMiddleware, this.exportMenaboExcel.bind(this));
    this.router.post('/promo/:idPromo/export/indesign-json', authMiddleware, permissionGuard('promo.visualizza'), this.exportIndesignPluginJson.bind(this));
    this.router.get('/promo/:idPromo', authMiddleware, permissionGuard('promo.visualizza'), this.getPromoById.bind(this));
  }

  /*************************************
   * LEGACY – newly‑ported handlers
   *************************************/
  private ping(_req: ExpressRequest, res: Response): void {
    res.status(HttpStatusCode.OK).json({ message: 'pong' });
  }
  //#region MIGRAZIONE MONGODB
  private async promo_migrazione_raccoglitore_kit(_req: ExpressRequest, res: Response): Promise<void> {
    let transaction: Awaited<ReturnType<typeof sequelize.transaction>> | null = null;
    const migrationResults: Record<string, { data: any[]; skipped: string[]; total: number }> = {};

    try {
      // Verifica connessione MongoDB
      if (!MongoDBConnection.connection?.db) {
        this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
          message: "Connessione MongoDB non disponibile"
        });
        return;
      }

      const mongoDb = MongoDBConnection.connection.db;

      // ========================================
      // FASE 1: FETCH DATI DA MONGODB
      // ========================================
      const [
        allRaccoglitoreKitDocs,
        allDesignKitDocs,
        allRuntimeKitDocs,
        allFilesRuntimeDocs,
        allReferenzeDocs,
        allFilesRuntimeLogDocs,
        allConfigDocs,
        allRicetteDocs,
        allApprofondimentoVinoDocs,
        allWorkspaceWebpliantDocs,
        allContenutiAggiuntiviReferenzaDocs,
        allReferenzeGruppoDocs
      ] = await Promise.all([
        mongoDb.collection("raccoglitori_kit").find().toArray(),
        mongoDb.collection("combinazioni_design").find().toArray(),
        mongoDb.collection("combinazioni_runtime").find().toArray(),
        mongoDb.collection("files_runtime").find().toArray(),
        mongoDb.collection("referenze_webpliant").find().toArray(),
        mongoDb.collection("files_runtime_log").find().toArray(),
        mongoDb.collection("config").find().toArray(),
        mongoDb.collection("ricette_ai_prima_versione").find().toArray(),
        mongoDb.collection("approfondimento_vino").find().toArray(),
        mongoDb.collection("workspaces_webpliant").find().toArray(),
        mongoDb.collection("contenuti_aggiuntivi_referenza").find().toArray(),
        mongoDb.collection("referenze_gruppo").find().toArray()
      ]);

      // ========================================
      // FASE 2: TRASFORMAZIONE DATI
      // ========================================

      // Risultati della trasformazione

      // Trasformazione Raccoglitori Kit
      migrationResults.raccoglitoreKit = this.transformRaccoglitoreKit(allRaccoglitoreKitDocs || []);

      // Trasformazione Design Kit
      migrationResults.designKit = this.transformDesignKit(allDesignKitDocs || []);

      // Trasformazione Runtime Kit
      migrationResults.runtimeKit = this.transformRuntimeKit(allRuntimeKitDocs || []);

      // Trasformazione Files Runtime
      migrationResults.filesRuntime = this.transformFilesRuntime(allFilesRuntimeDocs || []);

      // Trasformazione Referenze
      migrationResults.referenze = this.transformReferenze(allReferenzeDocs || []);

      // Trasformazione Files Runtime Log
      migrationResults.filesRuntimeLog = this.transformFilesRuntimeLog(allFilesRuntimeLogDocs || []);

      // Trasformazione Config
      migrationResults.config = this.transformConfig(allConfigDocs || []);

      // Trasformazione Ricette
      migrationResults.ricette = this.transformRicette(allRicetteDocs || []);

      // Trasformazione Approfondimenti Vino
      migrationResults.approfondimentoVino = this.transformApprofondimentoVino(allApprofondimentoVinoDocs || []);

      // Trasformazione Workspace Webpliant
      migrationResults.workspaceWebpliant = this.transformWorkspaceWebpliant(allWorkspaceWebpliantDocs || []);

      // Trasformazione Contenuti Aggiuntivi Referenza
      migrationResults.contenutiAggiuntiviReferenza = this.transformContenutiAggiuntiviReferenza(allContenutiAggiuntiviReferenzaDocs || []);

      // Trasformazione Referenze Gruppo
      migrationResults.referenzeGruppo = this.transformReferenzeGruppo(allReferenzeGruppoDocs || []);

      // ========================================
      // FASE 2.5: VALIDAZIONE INTEGRITÀ REFERENZIALE
      // ========================================

      // Crea set di ID validi per la validazione FK
      const validRaccoglitoreKitIds = new Set(migrationResults.raccoglitoreKit.data.map(r => r.id));
      const validDesignKitIds = new Set(migrationResults.designKit.data.map(d => d.id));
      const validRuntimeKitIds = new Set(migrationResults.runtimeKit.data.map(r => r.id));

      // Filtra DesignKit con id_raccoglitore valido
      migrationResults.designKit.data = migrationResults.designKit.data.filter(dk => {
        if (!validRaccoglitoreKitIds.has(dk.id_raccoglitore)) {
          migrationResults.designKit.skipped.push(`${dk.titolo} (FK raccoglitore non valido: ${dk.id_raccoglitore})`);
          return false;
        }
        return true;
      });
      // Aggiorna set di ID validi dopo il filtro
      validDesignKitIds.clear();
      migrationResults.designKit.data.forEach(d => validDesignKitIds.add(d.id));

      // Filtra RuntimeKit con id_design e id_raccoglitore validi
      migrationResults.runtimeKit.data = migrationResults.runtimeKit.data.filter(rk => {
        if (!validDesignKitIds.has(rk.id_design)) {
          migrationResults.runtimeKit.skipped.push(`${rk.titolo} (FK design non valido: ${rk.id_design})`);
          return false;
        }
        if (!validRaccoglitoreKitIds.has(rk.id_raccoglitore)) {
          migrationResults.runtimeKit.skipped.push(`${rk.titolo} (FK raccoglitore non valido: ${rk.id_raccoglitore})`);
          return false;
        }
        return true;
      });
      // Aggiorna set di ID validi dopo il filtro
      validRuntimeKitIds.clear();
      migrationResults.runtimeKit.data.forEach(r => validRuntimeKitIds.add(r.id));

      // Filtra FilesRuntime con id_runtime valido
      migrationResults.filesRuntime.data = migrationResults.filesRuntime.data.filter(fr => {
        if (fr.id_runtime && !validRuntimeKitIds.has(fr.id_runtime)) {
          migrationResults.filesRuntime.skipped.push(`${fr.nome || fr.id} (FK runtime non valido: ${fr.id_runtime})`);
          return false;
        }
        return true;
      });

      // Filtra Referenze con id_runtime_kit valido
      migrationResults.referenze.data = migrationResults.referenze.data.filter(ref => {
        if (!validRuntimeKitIds.has(ref.id_runtime_kit)) {
          migrationResults.referenze.skipped.push(`${ref.codice_box} (FK runtime non valido: ${ref.id_runtime_kit})`);
          return false;
        }
        return true;
      });

      // Filtra FilesRuntimeLog con id_kit_runtime valido
      migrationResults.filesRuntimeLog.data = migrationResults.filesRuntimeLog.data.filter(frl => {
        if (!validRuntimeKitIds.has(frl.id_kit_runtime)) {
          migrationResults.filesRuntimeLog.skipped.push(`${frl.nome_file} (FK runtime non valido: ${frl.id_kit_runtime})`);
          return false;
        }
        return true;
      });

      // ========================================
      // FASE 3: PULIZIA E MIGRAZIONE CON TRANSACTION
      // ========================================
      transaction = await sequelize.transaction();

      // Drop di tutte le tabelle coinvolte in un colpo solo (evita problemi di FK ordering)
      await sequelize.query(`
        DROP TABLE IF EXISTS
          files_runtime_log,
          referenze,
          files_runtime,
          runtime_kit,
          design_kit,
          raccoglitore_kit,
          config,
          ricette,
          approfondimento_vino,
          workspace_webpliant,
          contenuti_aggiuntivi_referenza,
          referenze_gruppo
        CASCADE
      `);

      // Ricrea le tabelle nell'ordine corretto delle dipendenze FK
      // 1. Tabelle senza FK verso altre tabelle migrate
      await Config.sync({ force: true });
      await Ricette.sync({ force: true });
      await ApprofondimentoVino.sync({ force: true });
      await WorkspaceWebpliant.sync({ force: true });
      await ReferenzeGruppo.sync({ force: true });
      // 2. Catena FK: RaccoglitoreKit -> DesignKit -> RuntimeKit
      await RaccoglitoreKit.sync({ force: true });
      await DesignKit.sync({ force: true });
      await RuntimeKit.sync({ force: true });
      // 3. Tabelle che dipendono da RuntimeKit
      await FilesRuntime.sync({ force: true });
      await Referenze.sync({ force: true });
      await FilesRuntimeLog.sync({ force: true });
      // 4. Tabelle che dipendono da Referenze
      await ContenutiAggiuntiviReferenza.sync({ force: true });

      const bulkCreateOptions = {
        transaction,
        validate: true,
        returning: true
      };

      // Inserimento dati
      let migratedRaccoglitoreKitCount = 0;
      if (migrationResults.raccoglitoreKit.data.length > 0) {
        const result = await RaccoglitoreKit.bulkCreate(migrationResults.raccoglitoreKit.data, bulkCreateOptions);
        migratedRaccoglitoreKitCount = result.length;
      }

      let migratedDesignKitCount = 0;
      if (migrationResults.designKit.data.length > 0) {
        const result = await DesignKit.bulkCreate(migrationResults.designKit.data, bulkCreateOptions);
        migratedDesignKitCount = result.length;
      }

      let migratedRuntimeKitCount = 0;
      if (migrationResults.runtimeKit.data.length > 0) {
        const result = await RuntimeKit.bulkCreate(migrationResults.runtimeKit.data, bulkCreateOptions);
        migratedRuntimeKitCount = result.length;
      }

      let migratedFilesRuntimeCount = 0;
      if (migrationResults.filesRuntime.data.length > 0) {
        const result = await FilesRuntime.bulkCreate(migrationResults.filesRuntime.data, bulkCreateOptions);
        migratedFilesRuntimeCount = result.length;
      }

      let migratedReferenzeCount = 0;
      if (migrationResults.referenze.data.length > 0) {
        const result = await Referenze.bulkCreate(migrationResults.referenze.data, bulkCreateOptions);
        migratedReferenzeCount = result.length;
      }

      let migratedFilesRuntimeLogCount = 0;
      if (migrationResults.filesRuntimeLog.data.length > 0) {
        const result = await FilesRuntimeLog.bulkCreate(migrationResults.filesRuntimeLog.data, bulkCreateOptions);
        migratedFilesRuntimeLogCount = result.length;
      }

      let migratedConfigCount = 0;
      if (migrationResults.config.data.length > 0) {
        const result = await Config.bulkCreate(migrationResults.config.data, bulkCreateOptions);
        migratedConfigCount = result.length;
      }

      let migratedRicetteCount = 0;
      if (migrationResults.ricette.data.length > 0) {
        const result = await Ricette.bulkCreate(migrationResults.ricette.data, bulkCreateOptions);
        migratedRicetteCount = result.length;
      }

      let migratedApprofondimentoVinoCount = 0;
      if (migrationResults.approfondimentoVino.data.length > 0) {
        const result = await ApprofondimentoVino.bulkCreate(migrationResults.approfondimentoVino.data, bulkCreateOptions);
        migratedApprofondimentoVinoCount = result.length;
      }

      let migratedWorkspaceWebpliantCount = 0;
      if (migrationResults.workspaceWebpliant.data.length > 0) {
        const result = await WorkspaceWebpliant.bulkCreate(migrationResults.workspaceWebpliant.data, bulkCreateOptions);
        migratedWorkspaceWebpliantCount = result.length;
      }

      let migratedContenutiAggiuntiviReferenzaCount = 0;
      if (migrationResults.contenutiAggiuntiviReferenza.data.length > 0) {
        const result = await ContenutiAggiuntiviReferenza.bulkCreate(migrationResults.contenutiAggiuntiviReferenza.data, bulkCreateOptions);
        migratedContenutiAggiuntiviReferenzaCount = result.length;
      }

      let migratedReferenzeGruppoCount = 0;
      if (migrationResults.referenzeGruppo.data.length > 0) {
        const result = await ReferenzeGruppo.bulkCreate(migrationResults.referenzeGruppo.data, bulkCreateOptions);
        migratedReferenzeGruppoCount = result.length;
      }

      // Commit della transazione
      await transaction.commit();
      transaction = null;

      // Risposta con riepilogo
      this.sendResponse(res, HttpStatusCode.OK, {
        message: 'Migrazione completata con successo',
        raccoglitoreKit: {
          migratedCount: migratedRaccoglitoreKitCount,
          totalCount: migrationResults.raccoglitoreKit.total,
          skippedCount: migrationResults.raccoglitoreKit.skipped.length,
          skippedItems: migrationResults.raccoglitoreKit.skipped
        },
        designKit: {
          migratedCount: migratedDesignKitCount,
          totalCount: migrationResults.designKit.total,
          skippedCount: migrationResults.designKit.skipped.length,
          skippedItems: migrationResults.designKit.skipped
        },
        runtimeKit: {
          migratedCount: migratedRuntimeKitCount,
          totalCount: migrationResults.runtimeKit.total,
          skippedCount: migrationResults.runtimeKit.skipped.length,
          skippedItems: migrationResults.runtimeKit.skipped
        },
        filesRuntime: {
          migratedCount: migratedFilesRuntimeCount,
          totalCount: migrationResults.filesRuntime.total,
          skippedCount: migrationResults.filesRuntime.skipped.length,
          skippedItems: migrationResults.filesRuntime.skipped
        },
        referenze: {
          migratedCount: migratedReferenzeCount,
          totalCount: migrationResults.referenze.total,
          skippedCount: migrationResults.referenze.skipped.length,
          skippedItems: migrationResults.referenze.skipped
        },
        filesRuntimeLog: {
          migratedCount: migratedFilesRuntimeLogCount,
          totalCount: migrationResults.filesRuntimeLog.total,
          skippedCount: migrationResults.filesRuntimeLog.skipped.length,
          skippedItems: migrationResults.filesRuntimeLog.skipped
        },
        config: {
          migratedCount: migratedConfigCount,
          totalCount: migrationResults.config.total,
          skippedCount: migrationResults.config.skipped.length,
          skippedItems: migrationResults.config.skipped
        },
        ricette: {
          migratedCount: migratedRicetteCount,
          totalCount: migrationResults.ricette.total,
          skippedCount: migrationResults.ricette.skipped.length,
          skippedItems: migrationResults.ricette.skipped
        },
        approfondimentoVino: {
          migratedCount: migratedApprofondimentoVinoCount,
          totalCount: migrationResults.approfondimentoVino.total,
          skippedCount: migrationResults.approfondimentoVino.skipped.length,
          skippedItems: migrationResults.approfondimentoVino.skipped
        },
        workspaceWebpliant: {
          migratedCount: migratedWorkspaceWebpliantCount,
          totalCount: migrationResults.workspaceWebpliant.total,
          skippedCount: migrationResults.workspaceWebpliant.skipped.length,
          skippedItems: migrationResults.workspaceWebpliant.skipped
        },
        contenutiAggiuntiviReferenza: {
          migratedCount: migratedContenutiAggiuntiviReferenzaCount,
          totalCount: migrationResults.contenutiAggiuntiviReferenza.total,
          skippedCount: migrationResults.contenutiAggiuntiviReferenza.skipped.length,
          skippedItems: migrationResults.contenutiAggiuntiviReferenza.skipped
        },
        referenzeGruppo: {
          migratedCount: migratedReferenzeGruppoCount,
          totalCount: migrationResults.referenzeGruppo.total,
          skippedCount: migrationResults.referenzeGruppo.skipped.length,
          skippedItems: migrationResults.referenzeGruppo.skipped
        }
      });

    } catch (error) {
      // Rollback in caso di errore
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          log.error('Errore durante il rollback:', rollbackError);
        }
      }

      // Log dettagliato dell'errore
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      const errorName = error instanceof Error ? error.name : 'Error';

      log.error('Errore durante la migrazione:', { message: errorMessage, name: errorName });

      // Costruisci risposta di errore dettagliata
      const errorResponse: any = {
        message: `Migrazione fallita: ${errorMessage}`,
        error: errorName
      };

      // Aggiungi dettagli sugli elementi saltati per FK non valide se disponibili
      if (typeof migrationResults !== 'undefined') {
        const skippedSummary: Record<string, string[]> = {};

        for (const [key, value] of Object.entries(migrationResults)) {
          if (value.skipped && value.skipped.length > 0) {
            // Filtra solo gli errori FK
            const fkErrors = value.skipped.filter((s: string) => s.includes('FK'));
            if (fkErrors.length > 0) {
              skippedSummary[key] = fkErrors;
            }
          }
        }

        if (Object.keys(skippedSummary).length > 0) {
          errorResponse.fkValidationErrors = skippedSummary;
          errorResponse.message += '. Alcuni elementi sono stati saltati per violazione di integrità referenziale.';
        }
      }

      // Gestione AggregateError per bulk create
      if (error && typeof error === 'object' && 'errors' in error) {
        errorResponse.bulkErrors = (error as any).errors;
      }

      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, errorResponse);
    }
  }

  // ========================================
  // METODI HELPER PER TRASFORMAZIONE DATI
  // ========================================

  private transformRaccoglitoreKit(docs: any[]): { data: any[]; skipped: string[]; total: number } {
    const data: any[] = [];
    const skipped: string[] = [];

    for (const doc of docs) {
      if (!doc.guidId || !doc.titolo || !doc.guidFormato) {
        skipped.push(doc.titolo || 'Senza titolo');
        continue;
      }

      data.push({
        id: doc.guidId,
        id_aree: doc.guidAree || [],
        id_canali: doc.guidCanali || [],
        id_formato: doc.guidFormato,
        id_pv: doc.guidIdPv || [],
        titolo: doc.titolo,
        filtro: doc.filtro || [],
        declinazioni: doc.declinazioni || [],
        tipi_di_export_in_kit: Array.isArray(doc.tipiDiExportInKit)
          ? doc.tipiDiExportInKit.map((item: any) => ({
            tipo_di_export_guid_id: item.tipoDiExportGuidID || item.tipo_di_export_guid_id || null,
            filtro: item.filtro || []
          }))
          : [],
        quantita: doc.quantita || 1,
        tipo: doc.tipo as TIPO_KIT_DESIGN,
        filtro_contesto: doc.filtroContesto || [],
        files: Array.isArray(doc.files)
          ? doc.files.map((item: any) => ({
            id: item.id,
            nome: item.nome,
            direttive: item.direttive,
            isOptional: item.isOptional || false,
            nome_originale: item.nome_originale,
            tipo_export: item.tipo_export,
            id_runtime: item.id_runtime
          }))
          : []
      });
    }

    return { data, skipped, total: docs.length };
  }

  private transformDesignKit(docs: any[]): { data: any[]; skipped: string[]; total: number } {
    const data: any[] = [];
    const skipped: string[] = [];

    for (const doc of docs) {
      if (!doc.guidId || !doc.titolo || !doc.guidArea || !doc.guidCanale || !doc.guidFormato || !doc.guidIdRaccoglitore) {
        skipped.push(doc.titolo || 'Senza titolo');
        continue;
      }

      data.push({
        id: doc.guidId,
        id_area: doc.guidArea,
        filtro: doc.filtro || [],
        id_canale: doc.guidCanale,
        id_formato: doc.guidFormato,
        tipi_di_export_in_kit: Array.isArray(doc.tipiDiExportInKit)
          ? doc.tipiDiExportInKit.map((item: any) => ({
            tipo_di_export_guid_id: item.tipoDiExportGuidID || item.tipo_di_export_guid_id,
            filtro: item.filtro || [],
            use_webhook: item.useWebhook || false,
            webhook_events: item.webhookEvents || null
          }))
          : [],
        quantita_copie: doc.quantitaCopie || 1,
        titolo: doc.titolo,
        id_raccoglitore: doc.guidIdRaccoglitore,
        stato: doc.stato || 'ATTIVO',
        declinazioni: doc.declinazioni || [],
        context: doc.context || [],
        tipo: doc.tipo as TIPO_KIT_DESIGN,
        filtro_contesto: this.transformFiltroContesto(doc.filtroContesto)
      });
    }

    return { data, skipped, total: docs.length };
  }

  private transformRuntimeKit(docs: any[]): { data: any[]; skipped: string[]; total: number } {
    const data: any[] = [];
    const skipped: string[] = [];

    for (const doc of docs) {
      if (!doc.guidId || !doc.titolo || !doc.guidArea || !doc.guidCanale ||
        !doc.guidFormato || !doc.guidIdRaccoglitore || !doc.guidIdDesign || !doc.idPromo) {
        skipped.push(doc.titolo || 'Senza titolo');
        continue;
      }

      data.push({
        id: doc.guidId,
        id_area: doc.guidArea,
        filtro: doc.filtro || [],
        filtro_contesto: this.transformFiltroContesto(doc.filtroContesto),
        id_design: doc.guidIdDesign,
        id_canale: doc.guidCanale,
        id_formato: doc.guidFormato,
        tipi_di_export_in_kit: Array.isArray(doc.tipiDiExportInKit)
          ? doc.tipiDiExportInKit.map((item: any) => ({
            tipo_di_export_guid_id: item.tipoDiExportGuidID || item.tipo_di_export_guid_id,
            filtro: item.filtro || [],
            use_webhook: item.useWebhook || false,
            webhook_events: item.webhookEvents || null
          }))
          : [],
        quantita_copie: doc.quantitaCopie || 1,
        titolo: doc.titolo,
        id_raccoglitore: doc.guidIdRaccoglitore,
        stato: doc.stato || 'ATTIVO',
        id_promo: doc.idPromo,
        tipo: doc.tipo as TIPO_KIT_DESIGN,
        nome_area: doc.nomeArea || null,
        nome_canale: doc.nomeCanale || null,
        codice_area: doc.codiceArea || null,
        codice_canale: doc.codiceCanale || null,
        webpliant: doc.webpliant || [],
        declinazioni: doc.declinazioni || [],
        stato_lavorazione: (doc.stato_lavorazione as STATO_LAVORAZIONE_KIT_RUNTIME) || STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE,
        files_data: Array.isArray(doc.files)
          ? doc.files.map((item: any) => ({
            id: item.id,
            nome: item.nome,
            direttive: item.direttive,
            is_optional: item.isOptional || false,
            nome_originale: item.nome_originale,
            tipo_export: item.tipo_export,
            id_runtime: item.id_runtime
          }))
          : [],
        inizio_lavorazione: doc.inizioLavorazione || null,
        fine_lavorazione: doc.fineLavorazione || null
      });
    }

    return { data, skipped, total: docs.length };
  }

  private transformFilesRuntime(docs: any[]): { data: any[]; skipped: string[]; total: number } {
    const data: any[] = [];
    const skipped: string[] = [];

    for (const doc of docs) {
      if (!doc.id) {
        skipped.push(doc.nome || 'Senza nome');
        continue;
      }

      // Gestione meta_olimpo_cloud: deve essere un oggetto o null
      let metaOlimpoCloud: any = null;
      if (doc.meta_olimpo_cloud) {
        if (typeof doc.meta_olimpo_cloud === 'object') {
          metaOlimpoCloud = doc.meta_olimpo_cloud;
        } else if (typeof doc.meta_olimpo_cloud === 'string') {
          try {
            metaOlimpoCloud = JSON.parse(doc.meta_olimpo_cloud);
          } catch {
            metaOlimpoCloud = null;
          }
        }
      }

      // Costruisci URL OLYMPUS da id_olimpo_cloud se disponibile
      const idOlimpoCloud = doc.id_olimpo_cloud || null;
      const url = idOlimpoCloud
        ? `${config.OLYMPUS_IP_ADDRESS}/materiali/getThumbnailMaterialePdfs?&id=${idOlimpoCloud}`
        : (doc.url || null);

      data.push({
        id: doc.id,
        url,
        id_runtime: doc.id_runtime || null,
        direttive: doc.direttive || null,
        nome: doc.nome || null,
        nome_originale: doc.nome_originale || null,
        is_optional: doc.isOptional || false,
        id_olimpo_cloud: doc.id_olimpo_cloud || null,
        meta_olimpo_cloud: metaOlimpoCloud,
        tipo_export: doc.tipo_export || null,
        blob: doc.blob || null,
        mime: doc.mime || null,
        error: doc.error || null,
        pages: doc.pages || null,
        is_merged_group: doc.is_merged_group || false,
        merged_group_id: doc.merged_group_id || null,
        merged_file_ids: doc.merged_file_ids || [],
        virtual_dir: doc.virtual_dir || null,
        id_ordine_stampa: doc.id_ordine_stampa || null
      });
    }

    return { data, skipped, total: docs.length };
  }

  private transformReferenze(docs: any[]): { data: any[]; skipped: string[]; total: number } {
    const data: any[] = [];
    const skipped: string[] = [];

    for (const doc of docs) {
      if (!doc.id || !doc.codiceBox || !doc.guidIdKitRuntime || !doc.idPromo) {
        skipped.push(doc.codiceBox || 'Senza codice');
        continue;
      }

      data.push({
        id: doc.id,
        compiled_fields: Array.isArray(doc.compiledFields)
          ? doc.compiledFields.map((field: any) => ({
            paragraph_name: field.paragraphName ?? field.paragraph_name,
            label_name: field.labelName ?? field.label_name,
            content: field.content
          }))
          : [],
        deleted_fields: doc.deletedFields || [],
        foto: doc.foto || [],
        meccanica: doc.meccanica,
        codice_box: doc.codiceBox,
        foto_extra: Array.isArray(doc.fotoExtra)
          ? doc.fotoExtra.map((foto: any) => ({
            guid_id: foto.guidId,
            sigla: foto.sigla,
            tipo: foto.tipo
          }))
          : [],
        data_fields: doc.dataFields || {},
        group_elements: doc.groupElements || [],
        id_runtime_kit: doc.guidIdKitRuntime,
        id_promo: doc.idPromo,
        pag: doc.pag ?? null,
        x: doc.x ?? null,
        y: doc.y ?? null,
        w: doc.w ?? null,
        h: doc.h ?? null,
        w_page: doc.wPage ?? null,
        h_page: doc.hPage ?? null,
        perc_ingombro: doc.percIngombro ?? null,
        aspect_ratio: doc.aspectRatio ?? null
      });
    }

    return { data, skipped, total: docs.length };
  }

  private transformFilesRuntimeLog(docs: any[]): { data: any[]; skipped: string[]; total: number } {
    const data: any[] = [];
    const skipped: string[] = [];

    for (const doc of docs) {
      // Salta i file main.json senza validazione completa
      const isMainJson = doc.nome_file === "main.json";

      if (!isMainJson) {
        if (!doc.id || !doc.guid_kit_runtime || !doc.nome_file ||
          !doc.data_registrazione || !doc.versione || !doc.stato) {
          skipped.push(doc.nome_file || 'Senza nome');
          continue;
        }
      } else {
        // Per main.json, verifica almeno i campi essenziali
        if (!doc.id || !doc.guid_kit_runtime) {
          skipped.push(doc.nome_file || 'Senza nome');
          continue;
        }
      }

      data.push({
        id: doc.id,
        id_kit_runtime: doc.guid_kit_runtime,
        nome_file: doc.nome_file,
        data_registrazione: doc.data_registrazione,
        versione: doc.versione,
        stato: doc.stato,
        logs: Array.isArray(doc.logs)
          ? doc.logs.map((logItem: any) => ({
            messaggio: logItem.messaggio,
            data_notifica: logItem.data_notifica,
            azione: logItem.azione,
            utente_notifica: logItem.utente_notifica,
            dettagli_aggiuntivi: logItem.dettagli_aggiuntivi
          }))
          : []
      });
    }

    return { data, skipped, total: docs.length };
  }

  private transformConfig(docs: any[]): { data: any[]; skipped: string[]; total: number } {
    const data: any[] = [];
    const skipped: string[] = [];

    for (const doc of docs) {
      if (!doc.webpliant) {
        skipped.push('Senza webpliant');
        continue;
      }

      data.push({
        webpliant: {
          css_text: doc.webpliant.css_text || null,
          color_gdo: doc.webpliant.color_gdo || null,
          guid_id: doc.webpliant.guidId || null,
          icona_pagina: doc.webpliant.icona_pagina || null,
          logo_header: Array.isArray(doc.webpliant.logo_header)
            ? doc.webpliant.logo_header.map((logo: any) => ({
              url: logo.url,
              base64: logo.base64,
              id_canale: logo.idCanale,
              id_area: logo.idArea,
              id_pv: logo.idPv
            }))
            : [],
          stili: doc.webpliant.stili || [],
          stili_minimal: doc.webpliant.stili_minimal || [],
          data_fields_refs: doc.webpliant.data_fields_refs || [],
          data_fields_files: doc.webpliant.data_fields_files || [],
          meta_volantino: doc.webpliant.meta_volantino || {}
        },
        color: doc.color || null,
        dashboard: doc.dashboard
          ? {
            version: doc.dashboard.version,
            last_updated: doc.dashboard.lastUpdated,
            plugins: Array.isArray(doc.dashboard.plugins)
              ? doc.dashboard.plugins.map((plugin: any) => ({
                id: plugin.id,
                name: plugin.name,
                component: plugin.component,
                props: plugin.props,
                position: plugin.position,
                order: plugin.order,
                grid_col_span: plugin.gridColSpan,
                grid_row_span: plugin.gridRowSpan,
                grid_position: plugin.gridPosition
                  ? {
                    col_start: plugin.gridPosition.colStart,
                    row_start: plugin.gridPosition.rowStart
                  }
                  : null,
                allowed_roles: plugin.allowedRoles,
                is_draggable: plugin.isDraggable,
                is_resizable: plugin.isResizable,
                min_col_span: plugin.minColSpan,
                min_row_span: plugin.minRowSpan,
                is_deletable: plugin.isDeletable,
                show_pagination: plugin.showPagination,
                show_filter: plugin.showFilter,
                base_filter: Array.isArray(plugin.baseFilter)
                  ? plugin.baseFilter.map((f: any) => ({
                    field: f.field || '',
                    operator: f.operator || '',
                    value: f.value ?? null
                  }))
                  : plugin.baseFilter
                    ? [{
                      field: plugin.baseFilter.field || '',
                      operator: plugin.baseFilter.operator || '',
                      value: plugin.baseFilter.value ?? null
                    }]
                    : []
              }))
              : []
          }
          : null,
        dashboards_by_role: doc.dashboardsByRole || null
      });
    }

    return { data, skipped, total: docs.length };
  }

  private transformRicette(docs: any[]): { data: any[]; skipped: string[]; total: number } {
    const data: any[] = [];
    const skipped: string[] = [];

    for (const doc of docs) {
      if (!doc.guid_id || !doc.titolo || !doc.tipo || !doc.stato) {
        skipped.push(doc.titolo || 'Senza titolo');
        continue;
      }

      data.push({
        id: doc.guid_id,
        titolo: doc.titolo,
        ingredienti: Array.isArray(doc.ingredienti)
          ? doc.ingredienti.map((ingrediente: any) => ({
            nome_prodotto: ingrediente.nome_prodotto,
            ean: ingrediente.ean,
            quantita_necessaria: ingrediente.quantita_necessaria,
            peso: ingrediente.peso,
            unita_misura_peso: ingrediente.unita_misura_peso,
            costo_ingrediente_euro: ingrediente.costo_ingrediente_euro,
            costo_per_unita_misura: ingrediente.costo_per_unita_misura,
            incluso_nel_volantino: ingrediente.inclusoNelVolantino
          }))
          : [],
        procedimento: doc.procedimento,
        tempo_in_secondi: doc.tempo_in_secondi,
        costo_in_euro: doc.costo_in_euro,
        tipo: doc.tipo,
        stato: doc.stato,
        abbinamento_vino: doc.abbinamento_vino
          ? {
            vini_abbinati: doc.abbinamento_vino.vini_abbinati,
            motivazione: doc.abbinamento_vino.motivazione
          }
          : null,
        foto_ricetta: Array.isArray(doc.foto_ricetta)
          ? doc.foto_ricetta.map((foto: any) => ({
            id: foto.id || uuidv4(),
            main: foto.main,
            id_olimpo_cloud: foto.id_olimpo_cloud || '',
            url: foto.url || '',
            meta: foto.meta || {},
            prompt: foto.prompt || ''
          }))
          : []
      });
    }

    return { data, skipped, total: docs.length };
  }

  private transformApprofondimentoVino(docs: any[]): { data: any[]; skipped: string[]; total: number } {
    const data: any[] = [];
    const skipped: string[] = [];

    for (const doc of docs) {
      if (!doc.id || !doc.cantina || !doc.nome || !doc.codice) {
        skipped.push(doc.nome || 'Senza nome');
        continue;
      }

      data.push({
        id: doc.id,
        cantina: doc.cantina,
        nome: doc.nome,
        codice: doc.codice,
        anno: doc.anno,
        vino: doc.vino,
        data_creazione: doc.dataCreazione,
        data_pubblicazione: doc.dataPubblicazione,
        provenienza: doc.provenienza,
        colore: doc.colore,
        profumo: doc.profumo,
        gusto: doc.gusto,
        tasso_alcolico: doc.tasso_alcolico,
        temperatura_di_servizio: doc.temperatura_di_servizio,
        abbinamenti: doc.abbinamenti,
        dettagli_cantina: doc.dettagli_cantina
      });
    }

    return { data, skipped, total: docs.length };
  }

  private transformWorkspaceWebpliant(docs: any[]): { data: any[]; skipped: string[]; total: number } {
    const data: any[] = [];
    const skipped: string[] = [];

    for (const doc of docs) {
      if (!doc.idWorkspace || !doc.idGDO) {
        skipped.push(doc.nomeWorkspace || 'Senza nome');
        continue;
      }

      data.push({
        id: doc.idWorkspace,
        id_area: doc.idArea,
        id_canale: doc.idCanale,
        id_gdo: doc.idGDO,
        id_pv: doc.idPV,
        nome_workspace: doc.nomeWorkspace,
        webpliant: Array.isArray(doc.webpliant)
          ? doc.webpliant.map((pagina: any) => ({
            id: pagina.id,
            nome: pagina.nome,
            tipo: pagina.tipo,
            struttura: Array.isArray(pagina.struttura)
              ? pagina.struttura.map((item: any) => ({
                id: item.id,
                parent_id: item.parentId,
                user_locked: {
                  locked: item.user_locked?.locked || false,
                  user_id: item.user_locked?.user_id || ''
                },
                type: item.type,
                children: item.children || [],
                content: item.content || {},
                policy: item.policy || {},
                is_hybrid: item.is_hybrid,
                keyframes: item.keyframes || [],
                alias: item.alias
              }))
              : [],
            settings: {
              mostra_menu_laterale: pagina.settings?.mostra_menu_laterale,
              policy: pagina.settings?.policy
            }
          }))
          : [],
        sitemap: Array.isArray(doc.sitemap)
          ? doc.sitemap.map((item: any) => ({
            id: item.id,
            titolo: item.titolo,
            pagine_collegate: Array.isArray(item.pagine_collegate)
              ? item.pagine_collegate.map((pagina: any) => ({
                id: pagina.id,
                titolo: pagina.titolo
              }))
              : [],
            link_esterno: item.link_esterno,
            impostazioni_avanzate: {
              show: item.impostazioni_avanzate?.show,
              mostra_menu_laterale: item.impostazioni_avanzate?.mostra_menu_laterale
            }
          }))
          : []
      });
    }

    return { data, skipped, total: docs.length };
  }

  private transformContenutiAggiuntiviReferenza(docs: any[]): { data: any[]; skipped: string[]; total: number } {
    const data: any[] = [];
    const skipped: string[] = [];

    for (const doc of docs) {
      if (!doc.id_referenza || !doc.tipo_contenuto || !doc.contenuto) {
        skipped.push(doc.titolo || 'Senza titolo');
        continue;
      }

      data.push({
        id_referenza: doc.id_referenza,
        tipo_contenuto: doc.tipo_contenuto,
        titolo: doc.titolo,
        descrizione: doc.descrizione,
        contenuto: doc.contenuto,
        ordine: doc.ordine,
        attivo: doc.attivo !== undefined ? doc.attivo : true,
        metadata: doc.metadata
      });
    }

    return { data, skipped, total: docs.length };
  }

  private transformReferenzeGruppo(docs: any[]): { data: any[]; skipped: string[]; total: number } {
    const data: any[] = [];
    const skipped: string[] = [];

    for (const doc of docs) {
      if (!doc.id || !doc.guidIdOlympo || !doc.codiceReferenza) {
        skipped.push(doc.codiceReferenza || 'Senza codice');
        continue;
      }

      data.push({
        id: doc.id,
        guid_id_olympo: doc.guidIdOlympo,
        codice_referenza: doc.codiceReferenza,
        id_area: doc.idArea || null,
        id_canale: doc.idCanale || null
      });
    }

    return { data, skipped, total: docs.length };
  }

  private transformFiltroContesto(filtroContesto: any[] | undefined): any[] {
    if (!Array.isArray(filtroContesto)) return [];

    return filtroContesto.map((item: any) => ({
      titolo_filtro: item.titoloFiltro,
      condizioni: Array.isArray(item.condizioni)
        ? item.condizioni.map((cond: any) => ({
          schemaScelto: cond.schemaScelto,
          nome_field: cond.schemaScelto + "." + cond.colonna,
          operatore: cond.operatore,
          colonna: cond.colonna,
          valore: cond.valore
        }))
        : []
    }));
  }

  //#endregion


  private async getPromoByNome(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const nomePromo = req.params.nomePromo as string;
      if (nomePromo == undefined || nomePromo == "") {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, {
          message: "Il nome della promo non è presente"
        });
      }
      const promos = await this.promoService.getPromoByNome(nomePromo);
      this.sendResponse(res, HttpStatusCode.OK, promos);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }




  private async getAllPromosTimeline(req: ExpressRequest, res: Response): Promise<void> {

    try {
      const promos = await this.promoService.getAllPromoTimeline();
      this.sendResponse(res, HttpStatusCode.OK, promos);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getAllPromos(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const promos = await this.promoService.getAllPromo();
      this.sendResponse(res, HttpStatusCode.OK, promos);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getAllPromosFiltered(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const {
        page,
        pageSize,
        search,
        stato,
        validitaDal,
        validitaAl,
        validitaAlFrom,
        validitaAlTo,
        excludeStato,
        sortBy,
        sortDirection
      } = req.query;

      const result = await this.promoService.getAllPromoFiltered({
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
        search: search as string,
        stato: stato as string,
        validitaDal: validitaDal as string,
        validitaAl: validitaAl as string,
        validitaAlFrom: validitaAlFrom as string,
        validitaAlTo: validitaAlTo as string,
        excludeStato: excludeStato as string,
        sortBy: sortBy as 'nome' | 'validita_dal' | 'validita_al' | 'stato' | undefined,
        sortDirection: sortDirection as 'asc' | 'desc' | undefined
      });

      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getAllPromosInCorso(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const promos = await this.promoService.getAllPromo();
      const promosInCorso = promos
        .filter(
          (promo) =>
            promo.stato !== STATO_PROMO.VALIDA &&
            promo.stato !== STATO_PROMO.VALIDA_CON_ERRORI &&
            promo.stato !== STATO_PROMO.ARCHIVIATA
        )
        .sort((a, b) => {
          const dateA = a.data_registrazione ? new Date(a.data_registrazione).getTime() : 0;
          const dateB = b.data_registrazione ? new Date(b.data_registrazione).getTime() : 0;
          return dateB - dateA;
        });
      this.sendResponse(res, HttpStatusCode.OK, promosInCorso);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getAllPromosStorico(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const promos = await this.promoService.getAllPromoStorico();
      this.sendResponse(res, HttpStatusCode.OK, promos);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getPromoById(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const promo = await this.promoService.getPromoById(req.params.idPromo);
      if (!promo) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Promo not found' });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, promo);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async updatePromo(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const data = req.body as UpdatePromoDTO & { id: string };
      data.id = id;
      const dataPerIstanta: any = {
        ...(id && { guid_id: id }),
        ...(data.nome && { nomePromo: data.nome }),
        dataRegistrazione: new Date(),
        ...(data.validita_dal && { validitaDal: dayjs(data.validita_dal).toDate() }),
        ...(data.validita_al && { validitaAl: dayjs(data.validita_al).toDate() }),
        ...(data.data_scadenza && { dataScadenza: dayjs(data.data_scadenza).toDate() }),
        ...(data.context !== undefined && data.context !== null ? { context: data.context } : { context: [] }),
      };
      const resultIstanta = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
        req,
        `${config.ISTANTA_IP_ADDRESS}/FicoProcess/aggiornaPromo`,
        'PUT',
        dataPerIstanta
      );
      if (!resultIstanta.data?.esito) {
        this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, { message: 'Errore durante l\'aggiornamento della promozione in istanta', error: resultIstanta.data?.error });
        return;
      }
      const formdataCorreggo = new FormData();
      formdataCorreggo.append('guid_id', data.id);
      if (data.nome) formdataCorreggo.append('nomePromo', data.nome);
      if (data.validita_dal) formdataCorreggo.append('validitaDal', dayjs(data.validita_dal).toISOString());
      if (data.validita_al) formdataCorreggo.append('validitaAl', dayjs(data.validita_al).toISOString());
      if (data.data_scadenza) formdataCorreggo.append('dataScadenza', dayjs(data.data_scadenza).toISOString());
      //if (data.context) formdataCorreggo.append('context', JSON.stringify(data.context));
      formdataCorreggo.append('dataRegistrazione', dayjs().toISOString());
      // Aggiungi qui gli altri campi se necessario
      // formdataCorreggo.append('altroCampo', data.altroCampo);
      console.log(config.CORREGGO_IP_ADDRESS);
      if (config.CORREGGO_IP_ADDRESS !== "" && config.CORREGGO_IP_ADDRESS !== null && config.CORREGGO_IP_ADDRESS !== undefined) {
        const resultCorreggo = await ServerUtils.sendToFICOApi<{
          error: any;
          esito: any;
          result: boolean,
          error_detail: string
        }>(
          req,
          `${config.CORREGGO_IP_ADDRESS}/UpdateVolData.ashx`,
          'POST',
          formdataCorreggo
        );
        if (resultCorreggo?.data) {
          console.log(resultCorreggo.data);
          const errorDetail = resultCorreggo.data.error_detail || '';
          const isVolantinoMissing = typeof errorDetail === 'string' && errorDetail.includes('volantino_non_trovato');

          if (!isVolantinoMissing && errorDetail !== '') {
            this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
              message: 'Errore durante l\'aggiornamento della promozione in correggo',
              error: resultCorreggo.data.error
            });
            return;
          }

          if (resultCorreggo.data.esito === false && !isVolantinoMissing) {
            this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
              message: 'Errore durante l\'aggiornamento della promozione in correggo',
              error: resultCorreggo.data.error
            });
            return;
          }
        }
      }
      const promo = await this.promoService.updatePromo(data.id, data);
      if (!promo) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Promo not found' });
        return;
      }
      AuditLogService.getInstance().configurationChanged(req, 'promo', 'update', { promoId: data.id });
      this.sendResponse(res, HttpStatusCode.OK, promo);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async deletePromo(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const resultIstanta = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
        req,
        `${config.ISTANTA_IP_ADDRESS}/FicoProcess/eliminaPromo/${req.params.id}/${true}`,
        'DELETE',
        undefined
      );
      if (!resultIstanta.data.esito) {
        this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, { message: 'Errore durante l\'eliminazione della promozione in istanta', error: resultIstanta.data.error });
        return;
      }
      const success = await this.promoService.deletePromo(req.params.id);
      if (!success) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Promo not found' });
        return;
      }
      AuditLogService.getInstance().configurationChanged(req, 'promo', 'delete', { promoId: req.params.id });
      this.sendResponse(res, HttpStatusCode.NO_CONTENT, null);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async deleteLavorazione(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const { id, stato } = req.params;
      let result: boolean | null = null;
      if (stato === STATO_PROMO.ELIMINATA) {
        const resultIstanta = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
          req,
          `${config.ISTANTA_IP_ADDRESS}/FicoProcess/restore/${id}`,
          'GET',
          undefined
        );
        if (!resultIstanta.data.esito) {
          this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, { message: 'Errore durante l\'eliminazione della promozione in istanta', error: resultIstanta.data.error });
          return;
        }
        result = await this.promoService.riportaInLavorazionePromo(id);
      } else {
        const resultIstanta = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
          req,
          `${config.ISTANTA_IP_ADDRESS}/FicoProcess/eliminaPromo/${id}/${false}`,
          'DELETE',
          undefined
        );
        if (!resultIstanta.data.esito) {
          this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, { message: 'Errore durante l\'eliminazione della promozione in istanta', error: resultIstanta.data.error });
          return;
        }
        result = await this.promoService.deleteNonPermanentePromo(id);
      }
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async inizioNuovaLavorazione(req: ExpressRequest, res: Response): Promise<void> {
    try {
      if (!req.session?.id_utente) {
        this.sendResponse(res, HttpStatusCode.UNAUTHORIZED, { message: 'User not authenticated' });
        return;
      }
      const result = await this.promoService.inizioNuovaLavorazione(req.body, req.session.id_utente, req);

      await ServerUtils.CREA_ATTIVITA(
        req.session.id_utente as string,
        TIPO_ATTIVITA.CREAZIONE_LAVORAZIONE,
        CATEGORIA_ATTIVITA.PRODUZIONE,
        {
          nomePromo: result.nome || req.body.titolo,
          id_promo: result.id,
        }
      );

      AuditLogService.getInstance().configurationChanged(req, 'promo', 'create', { promoId: result.id });
      this.sendResponse(res, HttpStatusCode.CREATED, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getContestoPerNuovaLavorazione(req: ExpressRequest, res: Response): Promise<void> {
    try {
      if (!req.session?.id_utente) {
        this.sendResponse(res, HttpStatusCode.UNAUTHORIZED, { message: 'User not authenticated' });
        return;
      }
      const result = await this.promoService.getContestoPerNuovaLavorazione(req);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async get_contesto_per_importazione(req: ExpressRequest, res: Response): Promise<void> {
    try {
      if (!req.session?.id_utente) {
        this.sendResponse(res, HttpStatusCode.UNAUTHORIZED, { message: 'User not authenticated' });
        return;
      }
      const result = await this.promoService.get_contesto_per_importazione(req);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }


  private async getPromozioniInCorsoPerDashboard(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const result = await this.promoService.getPromozioniInCorsoPerDashboard();
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getDatoPerMenabo(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const idPromo = req.query.idPromo as string;
      const canale = typeof req.query.canale === 'string' ? req.query.canale : undefined;
      const result = await this.promoService.getDatoPerMenabo(idPromo, canale);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getMenaboLayout(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const result = await this.promoService.getMenaboLayout(req.params.idPromo);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async saveMenaboLayout(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const payload = req.body as SaveMenaboLayoutRequest;
      const result = await this.promoService.saveMenaboLayout(req.params.idPromo, payload);
      AuditLogService.getInstance().configurationChanged(req, 'promo_menabo_layout', 'set', { promoId: req.params.idPromo });
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async exportMenaboExcel(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const { layout } = req.body as { layout: import('../../../lib/types').MenaboLayoutDivisioneSalvata };
      const buffer = await this.promoService.generateMenaboExcel(layout);
      const filename = `menabo_${req.params.idPromo}_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async exportIndesignPluginJson(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const { layout } = req.body as { layout: import('../../../lib/types').MenaboLayoutDivisioneSalvata };
      const payload = await this.promoService.generateIndesignPluginJson(layout);
      this.sendResponse(res, HttpStatusCode.OK, payload);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async testNotifica(_req: ExpressRequest, res: Response): Promise<void> {
    try {
      await this.promoService.testNotifica(_req);
      this.sendResponse(res, HttpStatusCode.OK, { message: 'Notifica di test inviata' });
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }


}
