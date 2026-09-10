import { Request, Response } from 'express';
import 'express-session';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import util from 'util';
import { v4 as uuidv4 } from 'uuid';
import { EVENTI_WEBHOOK, HttpStatusCode, STATO_LOG_FILE } from '../../../lib/enums';
import { Config, FileItemKitLog, OggettoTipiDiExport, ReferenzeIstanta } from '../../../lib/types';
import { BaseController } from '../base/BaseController';
import config from '../config';
import { IConfigService } from '../interfaces/IConfigService';
import { IImpostazioniService } from '../interfaces/IImpostazioniService';
import { authMiddleware } from '../middleware/authMiddleware';
import { ServerUtils } from '../utils/ServerUtils';

import { TYPES, container } from '../di';
import type { IKitRuntimeService } from '../interfaces/IKitRuntimeService';
import { IWebhookService } from '../interfaces/IWebhookService';
import { ConfigModel, ReferenzeIstantaModel } from '../models/mongoose';
import { TraduttoreReferenze } from '../utils/Translator';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ImpostazioniController extends BaseController {
  protected setupRoutes(): void {

    this.router.put("/update_data_fields_translation_map", authMiddleware, this.updateDataFieldsTranslationMap.bind(this));
    // =========================
    // GESTIONE PAGINE E UI
    // =========================
    this.router.get('/getGestionePagineSingular', authMiddleware, this.getGestionePagineSingular.bind(this));
    this.router.put('/salvaGestionePagineSingular', authMiddleware, this.salvaGestionePagineSingular.bind(this));

    // =========================
    // PROMOZIONI E TIMELINE
    // =========================
    this.router.get('/getAllPromoForTimeline', authMiddleware, this.getAllPromoForTimeline.bind(this));

    // =========================
    // WEBPLIANT E REFERENZE (dipendono da webhookService/configService)
    // =========================

    this.router.get("/richiediConfigMapDatafields", authMiddleware, this.richiediConfigMapDatafields.bind(this));

    // =========================
    // IMPOSTAZIONI QUICK SEARCH
    // =========================
    this.router.get('/get_quick_search_settings', authMiddleware, this.getQuickSearchSettings.bind(this));
  }

  constructor(
    private impostazioniService: IImpostazioniService,
    private webhookService: IWebhookService,
    private configService: IConfigService
  ) {
    super('/api');
  }

  public initializeRoutes(): void {
    this.setupRoutes();
  }


  private async updateDataFieldsTranslationMap(req: Request, res: Response): Promise<void> {

    try {
      const allReferenze = await ReferenzeIstantaModel.find().lean() as unknown as ReferenzeIstanta[];
      const config = await ConfigModel.findOne().lean() as unknown as Config;
      const dataFieldsTranslationMap = config.webpliant?.data_fields_refs;
      for (const ref of allReferenze) {
        const dataFields = TraduttoreReferenze.traduci_data_fields(ref.dataFields, dataFieldsTranslationMap);
        const compiledFields = TraduttoreReferenze.traduci_compiled_fields(ref.compiledFields, dataFieldsTranslationMap);
        const deletedFields = TraduttoreReferenze.traduci_deleted_fields(ref.deletedFields, dataFieldsTranslationMap);
        if (Array.isArray(ref.groupElements) && ref.groupElements.length) {
          for (let [key, groupElement] of Object.entries(ref.groupElements)) {
            const index = Number(key);
            if (!isNaN(index)) {
              ref.groupElements[index] = TraduttoreReferenze.traduci_data_fields(groupElement, dataFieldsTranslationMap);
            }
          }
        }
        ref.dataFields = dataFields;
        ref.compiledFields = compiledFields;
        ref.deletedFields = deletedFields;
        await ReferenzeIstantaModel.updateOne({ _id: ref._id }, { $set: ref });
      }
      res.status(HttpStatusCode.OK).json({ message: "Mappa di traduzione aggiornata con successo" });


    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getGestionePagineSingular(req: Request, res: Response): Promise<void> {
    try {
      const pathJson = path.join(process.cwd(), "config", "menu.json");
      const menu = JSON.parse(await util.promisify(fs.readFile)(pathJson, 'utf8'));
      res.status(HttpStatusCode.OK).json(menu);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async salvaGestionePagineSingular(req: Request, res: Response): Promise<void> {
    try {
      const pathJson = path.join(process.cwd(), "config", "menu.json");
      const menu = JSON.parse(await util.promisify(fs.readFile)(pathJson, 'utf8'));
      await fs.promises.writeFile(pathJson, JSON.stringify(req.body, null, 2));
      res.status(HttpStatusCode.OK).json({ message: "Pagina singular salvata con successo" });
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getAllPromoForTimeline(req: Request, res: Response): Promise<void> {
    try {
      const idArea = req.query.idArea as string;
      const idCanale = req.query.idCanale as string;
      const promi = await this.impostazioniService.getAllPromoForTimeline(idArea, idCanale);
      res.status(HttpStatusCode.OK).json(promi);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }



  private async richiediConfigMapDatafields(req: Request, res: Response): Promise<void> {
    try {
      let configWebpliant = await this.configService.getConfigWebPliantFromVolantino();
      const webpliantFields = configWebpliant.data_fields_refs.map((data_field) => data_field.expected_input);
      res.status(HttpStatusCode.OK).json(webpliantFields);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getQuickSearchSettings(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.impostazioniService.getQuickSearchSettings(req);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }
}
