import axios from 'axios';
import { Request, Response } from 'express';
import 'express-session';
import { CATEGORIA_ATTIVITA, HttpStatusCode, TIPO_ATTIVITA } from '../../../lib/enums';
import { DataWebPliant } from '../../../lib/types';
import { BaseController } from '../base/BaseController';
import config from '../config';
import { IGdoService } from '../interfaces/IGdoService';
import { IWebPliantService } from '../interfaces/IWebPliantService';
import { authMiddleware } from '../middleware/authMiddleware';
import { log } from '../logger';
import { permissionGuard } from '../middleware/permissionGuard';
import { GDO } from '../models/gdo';
import { ServerUtils } from '../utils/ServerUtils';

export class WebPliantController extends BaseController {

  constructor(
    private webPliantService: IWebPliantService,
    private gdoService: IGdoService
  ) {
    super('/api');
  }

  public initializeRoutes(): void {
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.router.put('/aggiungiWorkspaceWebPliant', authMiddleware, permissionGuard('webpliant.crea_workspace'), this.aggiungiWorkspaceWebPliant.bind(this));
    this.router.delete('/eliminaWorkspaceWebPliant', authMiddleware, permissionGuard('webpliant.elimina_workspace'), this.eliminaWorkspaceWebPliant.bind(this));
    this.router.get('/tuttiIWorkspaceDaGDO', authMiddleware, permissionGuard('webpliant.visualizza'), this.tuttiIWorkspaceDaGDO.bind(this));
    this.router.get('/allWorkspace', authMiddleware, permissionGuard('webpliant.visualizza'), this.getAllWorkspace.bind(this));
    this.router.get('/prendiWorkspaceDaID/:idWorkspace', this.prendiWorkspaceDaID.bind(this));
    this.router.put('/getDataValiditaPerCarosello', authMiddleware, permissionGuard('webpliant.visualizza'), this.getDataValiditaPerCarosello.bind(this));
    this.router.get('/getIdsWorkspace', authMiddleware, permissionGuard('webpliant.visualizza'), this.getIdsWorkspace.bind(this));
    this.router.get('/getReferenzeWebPliant', this.getReferenzeWebPliant.bind(this));
    this.router.put('/datoMassivoPerWebPliant', authMiddleware, permissionGuard('webpliant.visualizza'), this.datoMassivoPerWebPliant.bind(this));
    this.router.post('/salva_workspace_webpliant', authMiddleware, permissionGuard('webpliant.configura'), this.salvaWorkspaceWebpliant.bind(this));
    this.router.get('/get_field_options_filtri', authMiddleware, permissionGuard('webpliant.visualizza'), this.get_field_options_filtri.bind(this));
    this.router.put('/getCampiDaRaggruppamento', authMiddleware, permissionGuard('webpliant.visualizza'), this.getCampiDaRaggruppamento.bind(this));
  }

  private async aggiungiWorkspaceWebPliant(req: Request, res: Response): Promise<void> {
    try {
      if (req.body.idGDO == undefined) {
        //FIXME: da rimuovere al più presto che crea problemi enormi al funzionamento della struttura
        const gdo = (await GDO.findAll())[0];
        if (gdo == null) {
          this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { error: "GDO non trovata" });
          return;
        }
        req.body.idGDO = gdo.id_gdo as string;
      }
      const result = await this.webPliantService.aggiungiWorkspaceWebPliant(req.body);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async eliminaWorkspaceWebPliant(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.webPliantService.eliminaWorkspaceWebPliant(req.query.id as string);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async tuttiIWorkspaceDaGDO(req: Request, res: Response): Promise<void> {
    try {
      if (!req.session?.id_utente) {
        this.sendResponse(res, HttpStatusCode.UNAUTHORIZED, { message: 'User not authenticated' });
        return;
      }
      const result = await this.webPliantService.tuttiIWorkspaceDaGDO(req.session.id_utente as string);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getAllWorkspace(_req: Request, res: Response): Promise<void> {
    try {
      const result = await this.webPliantService.getAllWorkspaceWebPliant();
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async prendiWorkspaceDaID(req: Request, res: Response): Promise<void> {
    try {
      const idWorkspace = req.params.idWorkspace;
      const isEditor = req.query.isEditor as string === "true";
      const result = await this.webPliantService.prendiWorkspaceDaID(idWorkspace, isEditor);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getDataValiditaPerCarosello(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.webPliantService.getDataValiditaPerCarosello(req.body.designContent, req.body.referenze);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getIdsWorkspace(req: Request, res: Response): Promise<void> {
    try {
      if (!req.session?.id_utente) {
        this.sendResponse(res, HttpStatusCode.UNAUTHORIZED, { message: 'User not authenticated' });
        return;
      }
      const gdo = await this.gdoService.getGDOByUtenteId(req.session.id_utente as string);
      if (gdo == null) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { error: "GDO non trovata" });
        return;
      }
      const result = await this.webPliantService.getAllWorkspaceWebPliantDaIdGdo(gdo.id as string);
      const ids = result.map((r: any) => { return { id: r.idWorkspace, nome: r.nomeWorkspace } });
      this.sendResponse(res, HttpStatusCode.OK, ids);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getReferenzeWebPliant(req: Request, res: Response): Promise<void> {
    try {
      const idWorkspace = (req.query.id ?? req.query.idWorkspace) as string;
      const rawDate = (req.query.date ?? req.query.dataSelezionata) as string | undefined;
      const dataSelezionata = rawDate ? new Date(rawDate) : new Date();
      const idArea = req.query.idArea as string | undefined;
      const idCanale = req.query.idCanale as string | undefined;
      const isEditor = req.query.isEditor === 'true';
      const result = await this.webPliantService.getReferenzeWebPliant(idWorkspace, dataSelezionata, idArea, idCanale, isEditor);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async datoMassivoPerWebPliant(_req: Request, res: Response): Promise<void> {
    try {
      const result = await this.webPliantService.getDatoMassivoPerWebPliant();
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async salvaWorkspaceWebpliant(req: Request, res: Response): Promise<void> {
    const workspace = req.body as DataWebPliant;
    // Controllo preliminare per far sì di inviare i base64 delle immagini e dei video, se presenti, ad Olympus e sostituire i src con i link
    const uploadPromises = workspace.webpliant.map(async (w) => {
      await Promise.all(w.struttura.map(async (s) => {
        const processContent = async (content: any) => {
          try {
            if (content == undefined || content == null) {
              return;
            }
            if (content.srcDesktop && content.srcDesktop.includes("data:video/mp4;base64,")) {
              const formDataDesktop = new FormData();
              const buffer = Buffer.from(content.srcDesktop.split(",")[1], "base64");
              const blob = new Blob([buffer], { type: "video/mp4" });
              formDataDesktop.append("data", JSON.stringify({ id: s.id, device: "desktop", type: "video" }));
              formDataDesktop.append("file", blob, "video_" + s.id + ".mp4");
              const resultAxios = await axios.post<{ esito: boolean, content: { id: string, file: string, device: string, type: string } }>(
                config.OLYMPUS_IP_ADDRESS + "/materiali/uploadVideoBase",
                formDataDesktop,
                {
                  headers: {
                    "Authorization": req.session.private_key,
                  }
                }
              );
              content.srcDesktop = `${config.OLYMPUS_IP_ADDRESS}/materiali/getVideoOnDemand?guidId=${resultAxios.data.content.file}`;
            }
            else if (content.thumbnailSrcDesktop != undefined && content.thumbnailSrcDesktop.includes("data:image")) {
              const formData = new FormData();
              const buffer = Buffer.from(content.thumbnailSrcDesktop.split(",")[1], "base64");
              const blob = new Blob([buffer], { type: "image/png" });
              formData.append("data", JSON.stringify({ id: s.id, device: "desktop", type: "thumbnail" }));
              formData.append("file", blob, "thumbnail_" + s.id + ".png");
              const resultAxios = await axios.post<{ esito: boolean, record: { guidId: string } }>(
                config.OLYMPUS_IP_ADDRESS + "/foto/uploadFotoWebPliant",
                formData,
                {
                  headers: {
                    "Authorization": req.session.private_key,
                  }
                }
              );
              content.thumbnailSrcDesktop = `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${resultAxios.data.record.guidId}`;
            }
            else if (content.srcMobile && content.srcMobile.includes("data:video/mp4;base64,")) {
              const formDataMobile = new FormData();
              formDataMobile.append("data", JSON.stringify({ id: s.id, device: "mobile", type: "video" }));
              const buffer = Buffer.from(content.srcMobile.split(",")[1], "base64");
              const blob = new Blob([buffer], { type: "video/mp4" });
              formDataMobile.append("file", blob, "video_" + s.id + ".mp4");
              const resultAxios = await axios.post<{ esito: boolean, content: { id: string, file: string, device: string, type: string } }>(
                config.OLYMPUS_IP_ADDRESS + "/materiali/uploadVideoBase",
                formDataMobile,
                {
                  headers: {
                    "Authorization": req.session.private_key,
                  }
                }
              );
              content.srcMobile = `${config.OLYMPUS_IP_ADDRESS}/materiali/getVideoOnDemand?guidId=${resultAxios.data.content.file}`;

            }
            else if (content.thumbnailSrcMobile != undefined && content.thumbnailSrcMobile.includes("data:image")) {
              const formData = new FormData();
              const buffer = Buffer.from(content.thumbnailSrcMobile.split(",")[1], "base64");
              const blob = new Blob([buffer], { type: "image/png" });
              formData.append("data", JSON.stringify({ id: s.id, device: "desktop", type: "thumbnail" }));
              formData.append("file", blob, "thumbnail_" + s.id + ".png");
              const resultAxios = await axios.post<{ esito: boolean, record: { guidId: string } }>(
                config.OLYMPUS_IP_ADDRESS + "/foto/uploadFotoWebPliant",
                formData,
                {
                  headers: {
                    "Authorization": req.session.private_key,
                  }
                }
              );
              content.thumbnailSrcMobile = `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${resultAxios.data.record.guidId}`;
            }
            else if (content.src != undefined) {
              if (content.src.includes("data:image")) {
                const formData = new FormData();
                const mimetype = content.src.split(",")[0].split(":")[1].split(";")[0];
                const buffer = Buffer.from(content.src.split(",")[1], "base64");
                const blob = new Blob([buffer], { type: mimetype });
                formData.append("file", blob, "image_" + s.id + mimetype);
                const resultAxios = await axios.post<{ esito: boolean, record: { guidId: string } }>(
                  config.OLYMPUS_IP_ADDRESS + "/foto/uploadFotoWebPliant",
                  formData,
                  {
                    headers: {
                      "Authorization": req.session.private_key,
                    }
                  }
                );
                content.src = `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${resultAxios.data.record.guidId}&performante=true`;
              }
              if (content.srcMobile != undefined && content.srcMobile.includes("data:image")) {
                const formData = new FormData();
                const mimetype = content.srcMobile.split(",")[0].split(":")[1].split(";")[0];
                const buffer = Buffer.from(content.srcMobile.split(",")[1], "base64");
                const blob = new Blob([buffer], { type: mimetype });
                formData.append("file", blob, "image_" + s.id + mimetype);
                const resultAxios = await axios.post<{ esito: boolean, record: { guidId: string } }>(
                  config.OLYMPUS_IP_ADDRESS + "/foto/uploadFotoWebPliant",
                  formData,
                  {
                    headers: {
                      "Authorization": req.session.private_key,
                    }
                  }
                );
                content.srcMobile = `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${resultAxios.data.record.guidId}&performante=true`;
              }
            }
            else if (content.backgroundImage != undefined) {
              if (content.backgroundImage.includes("data:image")) {
                const formData = new FormData();
                const mimetype = content.backgroundImage.split(",")[0].split(":")[1].split(";")[0];
                const buffer = Buffer.from(content.backgroundImage.split(",")[1], "base64");
                const blob = new Blob([buffer], { type: mimetype });
                formData.append("file", blob, "image_" + s.id + mimetype);
                const resultAxios = await axios.post<{ esito: boolean, record: { guidId: string } }>(
                  config.OLYMPUS_IP_ADDRESS + "/foto/uploadFotoWebPliant",
                  formData,
                  {
                    headers: {
                      "Authorization": req.session.private_key,
                    }
                  }
                );
                content.backgroundImage = `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${resultAxios.data.record.guidId}&performante=true`;
              }
            }
            else if (content.logo != undefined) {
              if (content.logo.srcLogoCarosello?.includes("data:image")) {
                const formData = new FormData();
                const mimetype = content.logo.srcLogoCarosello.split(",")[0].split(":")[1].split(";")[0];
                const buffer = Buffer.from(content.logo.srcLogoCarosello.split(",")[1], "base64");
                const blob = new Blob([buffer], { type: mimetype });
                formData.append("file", blob, "image_" + s.id + mimetype);
                const resultAxios = await axios.post<{ esito: boolean, record: { guidId: string } }>(
                  config.OLYMPUS_IP_ADDRESS + "/foto/uploadFotoWebPliant",
                  formData,
                  {
                    headers: {
                      "Authorization": req.session.private_key,
                    }
                  }
                );
                content.logo.srcLogoCarosello = `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${resultAxios.data.record.guidId}&?height=${content.logo.height}&width=${content.logo.width}&performante=true`;
              }
            }
            else if (content.banner) {
              if (content.banner.includes("data:image")) {
                const formData = new FormData();
                const mimetype = content.banner.split(",")[0].split(":")[1].split(";")[0];
                const buffer = Buffer.from(content.banner.split(",")[1], "base64");
                const blob = new Blob([buffer], { type: mimetype });
                formData.append("file", blob, "image_" + s.id + mimetype);
                const resultAxios = await axios.post<{ esito: boolean, record: { guidId: string } }>(
                  config.OLYMPUS_IP_ADDRESS + "/foto/uploadFotoWebPliant",
                  formData,
                  {
                    headers: {
                      "Authorization": req.session.private_key,
                    }
                  }
                );
                content.banner = `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${resultAxios.data.record.guidId}&performante=true`;
              }
            }
          } catch (error: any) {
            log.error("Errore durante l'elaborazione del contenuto webpliant", error);
            throw error;
          }
        };

        if (s.type === "video" || s.type === "image" || s.type === "carousel" || s.type === "banner") {
          await processContent(s.content);
        } else if (s.type === "row" || s.type === "col") {
          if (s.children && Array.isArray(s.children)) {
            await Promise.all(s.children.map(async (child) => {
              await processContent(child.content);
            }));
          }
        }
      }));
    });

    // Attendi che tutte le promesse di upload siano completate
    await Promise.all(uploadPromises);

    const result = await this.webPliantService.creaWebPliantWorkspace(workspace);

    if (req.session.id_utente) {
      await ServerUtils.CREA_ATTIVITA(
        req.session.id_utente as string,
        TIPO_ATTIVITA.MODIFICA_WORKSPACE_WEBPLIANT,
        CATEGORIA_ATTIVITA.PRODUZIONE,
        {
          nomeWorkspace: workspace.nomeWorkspace || 'Workspace',
          idWorkspace: workspace.idWorkspace,
        }
      );
    }

    res.status(200).json(result);
  }

  private async get_field_options_filtri(_req: Request, res: Response): Promise<void> {
    try {
      const result = await this.webPliantService.get_field_options_filtri();
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getCampiDaRaggruppamento(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.webPliantService.getCampiDaRaggruppamento(req.body);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

}
