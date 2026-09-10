import axios from 'axios';
import CleanCSS from 'clean-css';
import { Request, Response } from 'express';
import 'express-session';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import util from 'util';
import { v4 as uuidv4 } from 'uuid';
import { HttpStatusCode, TIPO_UTENTI } from '../../../lib/enums';
import { BadRequestError, ForbiddenError } from '../../../lib/errors';
import { AvvisoManutenzione, Dashboard, RegoleMenabo } from '../../../lib/types';
import { emitToClients } from '../../ws-server';
import { BaseController } from '../base/BaseController';
import config from '../config';
import {
  FILE_SIZE_LIMITS,
  createDiskStorage,
  createMimeFilter,
  createUpload,
  ensureUploadDir
} from '../config/multerConfig';
import { IConfigService } from '../interfaces/IConfigService';
import { log } from '../logger';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { userRoleGuard } from '../middleware/userRoleGuard';
import { AuditLogService } from '../services/AuditLogService';
import { ServerUtils } from '../utils/ServerUtils';

// Mapping for modalita tipi di export
const modalitaTipiDiExportReverseMapping: { [key: string]: string } = {
  'SINGOLO': 'S',
  'MULTIPLO': 'M'
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nomeDirInsegna = config.ICONE_INSEGNA_DIR as string;
ensureUploadDir(nomeDirInsegna);

const uploadCss = createUpload({
  storage: createDiskStorage(nomeDirInsegna, (_req, file) => `${Date.now()}-${file.originalname}`),
  fileSize: FILE_SIZE_LIMITS.MEDIUM,
  fileFilter: createMimeFilter(['text/css'], 'Formato file non valido. Solo CSS accettato.')
});

export class ConfigController extends BaseController {
  constructor(private configService: IConfigService) {
    super('/api');
  }

  protected setupRoutes(): void {
    this.router.get('/getStiliToText', this.getStiliToText.bind(this));
    this.router.get('/get_config', this.get_config.bind(this));
    this.router.post('/saveConfig', authMiddleware, permissionGuard('impostazioni.modifica_generali'), this.saveConfig.bind(this));
    this.router.post('/caricaStiliInConfig', uploadCss.single('file'), authMiddleware, permissionGuard('impostazioni.modifica_generali'), this.caricaStiliInConfig.bind(this));
    this.router.get('/getConfigWebPliantFromVolantino', this.getConfigWebPliantFromVolantino.bind(this));
    this.router.get('/getColorGDO', this.getColorGDO.bind(this));
    this.router.post('/saveWebpliantConfig', authMiddleware, permissionGuard('impostazioni.modifica_generali'), this.saveWebpliantConfig.bind(this));
    this.router.post('/saveDashBoardConfig', userRoleGuard([TIPO_UTENTI.SUPERADMIN]), authMiddleware, this.saveDashBoardConfig.bind(this));
    this.router.get('/getDashBoardConfig', authMiddleware, this.getDashBoardConfig.bind(this));
    this.router.get('/getPluginRegistry', authMiddleware, permissionGuard('api.gestisci_plugin'), this.getPluginRegistry.bind(this));
    this.router.get('/getFlyerInsightsConfig', this.getFlyerInsightsConfig.bind(this));
    this.router.get('/avviso-manutenzione', authMiddleware, this.getAvvisoManutenzione.bind(this));
    this.router.post('/avviso-manutenzione', authMiddleware, userRoleGuard([TIPO_UTENTI.SUPERADMIN]), this.saveAvvisoManutenzione.bind(this));
    this.router.delete('/avviso-manutenzione', authMiddleware, userRoleGuard([TIPO_UTENTI.SUPERADMIN]), this.deleteAvvisoManutenzione.bind(this));
    this.router.get('/regole-menabo', authMiddleware, this.getRegoleMenabo.bind(this));
    this.router.post('/regole-menabo', authMiddleware, permissionGuard('impostazioni.modifica_generali'), this.saveRegoleMenabo.bind(this));
    this.router.delete('/regole-menabo', authMiddleware, permissionGuard('impostazioni.modifica_generali'), this.deleteRegoleMenabo.bind(this));
  }

  private async get_config(req: Request, res: Response): Promise<void> {
    try {
      const config = await this.configService.get_config();
      this.sendResponse(res, HttpStatusCode.OK, config);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async saveConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = req.body;
      const result = await this.configService.saveConfig(config);
      AuditLogService.getInstance().configurationChanged(req, 'config', 'save');
      this.sendResponse(res, HttpStatusCode.OK, { message: "Configurazione salvata con successo", result });
    } catch (error: any) {
      this.handleError(res, error);
    }
  }
  private async saveDashBoardConfig(req: Request, res: Response): Promise<void> {
    try {
      // Verifica che solo il super admin possa salvare il layout
      const tipoUtente = req.session.tipo_utente;
      if (tipoUtente !== TIPO_UTENTI.SUPERADMIN) {
        log.warn('Tentativo di salvataggio dashboard da utente non autorizzato', {
          userId: req.session.id_utente,
          tipoUtente,
          ip: req.ip
        });
        throw new ForbiddenError({
          message: 'Solo il super amministratore può modificare il layout della dashboard',
          details: {
            requiredRole: TIPO_UTENTI.SUPERADMIN,
            currentRole: tipoUtente
          }
        });
      }

      // Leggi il ruolo target dal body (quale dashboard si sta salvando)
      const { dashboard, role } = req.body as { dashboard: Dashboard; role: TIPO_UTENTI };

      if (!role) {
        throw new BadRequestError({
          message: 'Il ruolo target è obbligatorio per salvare la dashboard'
        });
      }

      const result = await this.configService.saveDashBoardConfig(dashboard, role);
      this.sendResponse(res, HttpStatusCode.OK, { message: `Configurazione dashboard per ${role} salvata con successo`, result });
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async caricaStiliInConfig(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file;
      const id = req.body.id;
      if (!file) {
        throw new BadRequestError({
          message: "File non trovato"
        });
      }
      if (file.mimetype !== "text/css") {
        await util.promisify(fs.unlink)(file.path);
        throw new BadRequestError({
          message: "Formato file non valido"
        });
      }
      const fileContent = await util.promisify(fs.readFile)(file.path, 'utf8');
      const minified = ServerUtils.minifyCSS(fileContent);
      const result = await this.configService.caricaStiliInConfig(id, minified);
      await util.promisify(fs.unlink)(file.path);
      res.status(HttpStatusCode.OK).json({ message: "File elaborato e cancellato con successo" });
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getConfigWebPliantFromVolantino(req: Request, res: Response): Promise<void> {
    try {
      const config = await this.configService.getConfigWebPliantFromVolantino();
      this.sendResponse(res, HttpStatusCode.OK, config);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getStiliToText(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.configService.getStiliToText();
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }
  private async getColorGDO(req: Request, res: Response): Promise<void> {
    try {
      const color = await this.configService.getColoreDaStile();
      res.status(HttpStatusCode.OK).json(color);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async saveWebpliantConfig(req: Request, res: Response): Promise<void> {
    try {
      let configWebpliant = req.body;
      if (typeof configWebpliant === "string") {
        configWebpliant = JSON.parse(configWebpliant);
      }

      if (configWebpliant.webpliant?.data_fields_refs) {
        log.debug('data_fields_refs ricevuti', { data_fields_refs: configWebpliant.webpliant.data_fields_refs });
      }
      if (configWebpliant.webpliant.css_text) {
        const minified = new CleanCSS().minify(configWebpliant.webpliant.css_text).styles;
        configWebpliant.webpliant.css_text = minified;
      }
      const regexBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/;

      for (const logo of configWebpliant.webpliant.logo_header) {
        if (regexBase64.test(logo.base64) && !logo.url) {
          const formData = new FormData();
          const bufferIconaHeader = Buffer.from(logo.base64, 'base64');
          const blobIcona = new Blob([bufferIconaHeader], { type: 'image/png' });
          formData.append('file', blobIcona, `${uuidv4()}.png`);
          formData.append('id', "");
          const result = await axios.post<{ esito: boolean, guidId: string, error: string }>(
            `${config.OLYMPUS_IP_ADDRESS}/foto/updateFotoPathWeb`,
            formData,
            { headers: { Authorization: req.session.private_key } }
          );
          if (result.data.esito) {
            logo.url = `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${result.data.guidId}`;
          } else {
            log.error(result.data.error);
          }
        }
      }

      if (regexBase64.test(configWebpliant.webpliant.icona_pagina)) {
        const formData = new FormData();
        const bufferIconaFavicon = Buffer.from(configWebpliant.webpliant.icona_pagina, 'base64');
        const blobIcona = new Blob([bufferIconaFavicon], { type: 'image/x-icon' });
        formData.append('file', blobIcona, `${uuidv4()}.ico`);
        formData.append('id', "");
        const result = await axios.post<{ esito: boolean, guidId: string, error: string }>(
          `${config.OLYMPUS_IP_ADDRESS}/foto/updateFotoPathWeb`,
          formData,
          { headers: { Authorization: req.session.private_key } }
        );
        if (result.data.esito) {
          configWebpliant.webpliant.icona_pagina = result.data.guidId;
        } else {
          log.error(result.data.error);
        }
      } else if (configWebpliant.webpliant.icona_pagina.startsWith("http")) {
        const url = new URL(configWebpliant.webpliant.icona_pagina);
        configWebpliant.webpliant.icona_pagina = url.searchParams.get("guidId") || "";
      }

      const result = await this.configService.saveConfigWebPliantFromVolantino(configWebpliant, configWebpliant._id);
      res.status(HttpStatusCode.OK).json({ message: "Configurazione salvata con successo", result });
    } catch (error: any) {
      this.handleError(res, error);
    }
  }
  private async getDashBoardConfig(req: Request, res: Response): Promise<void> {
    try {
      // Leggi il ruolo dalla query string, default al ruolo dell'utente loggato
      const role = (req.query.role as TIPO_UTENTI) || req.session.tipo_utente;

      if (!role) {
        throw new BadRequestError({
          message: 'Ruolo non specificato'
        });
      }

      const config = await this.configService.getDashBoardConfig(role);
      this.sendResponse(res, HttpStatusCode.OK, config);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getFlyerInsightsConfig(_req: Request, res: Response): Promise<void> {
    try {
      const config = await this.configService.getFlyerInsightsConfig();
      this.sendResponse(res, HttpStatusCode.OK, config);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getPluginRegistry(req: Request, res: Response): Promise<void> {
    try {
      const pluginRegistry = await this.configService.getPluginRegistry();
      this.sendResponse(res, HttpStatusCode.OK, pluginRegistry);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getAvvisoManutenzione(_req: Request, res: Response): Promise<void> {
    try {
      const avviso = await this.configService.getAvvisoManutenzione();
      this.sendResponse(res, HttpStatusCode.OK, avviso);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async saveAvvisoManutenzione(req: Request, res: Response): Promise<void> {
    try {
      const avviso = req.body as AvvisoManutenzione;
      await this.configService.saveAvvisoManutenzione(avviso);
      emitToClients('avviso_manutenzione', avviso);
      AuditLogService.getInstance().configurationChanged(req, 'maintenance_alert', 'set');
      this.sendResponse(res, HttpStatusCode.OK, { message: "Avviso di manutenzione attivato" });
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async deleteAvvisoManutenzione(req: Request, res: Response): Promise<void> {
    try {
      await this.configService.saveAvvisoManutenzione(null);
      emitToClients('avviso_manutenzione', null);
      AuditLogService.getInstance().configurationChanged(req, 'maintenance_alert', 'clear');
      this.sendResponse(res, HttpStatusCode.OK, { message: "Avviso di manutenzione rimosso" });
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getRegoleMenabo(_req: Request, res: Response): Promise<void> {
    try {
      const regole = await this.configService.getRegoleMenabo();
      this.sendResponse(res, HttpStatusCode.OK, regole);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async saveRegoleMenabo(req: Request, res: Response): Promise<void> {
    try {
      const regole = req.body as RegoleMenabo;
      await this.configService.saveRegoleMenabo(regole);
      AuditLogService.getInstance().configurationChanged(req, 'regole_menabo', 'set');
      this.sendResponse(res, HttpStatusCode.OK, { message: "Regole menabò salvate" });
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async deleteRegoleMenabo(req: Request, res: Response): Promise<void> {
    try {
      await this.configService.saveRegoleMenabo(null);
      AuditLogService.getInstance().configurationChanged(req, 'regole_menabo', 'clear');
      this.sendResponse(res, HttpStatusCode.OK, { message: "Regole menabò rimosse" });
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

}
