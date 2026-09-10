import { Request, Response } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import { BaseController } from '../base/BaseController';
import { uploadSvgIcon } from '../config/multerConfig';
import { IGdoService } from '../interfaces/IGdoService';
import { IServiceFacade } from '../interfaces/IServiceFacade';
import { IWebPliantService } from '../interfaces/IWebPliantService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { GDO } from '../models';

export class GdoController extends BaseController {
  constructor(
    private gdoService: IGdoService,
    private webPliantService: IWebPliantService,
    private serviceFacade: IServiceFacade
  ) {
    super('/api');
  }

  protected setupRoutes(): void {
    this.initializeRoutes();
  }

  public initializeRoutes(): void {
    // GDO Management
    this.router.get('/getGDOById/:id', authMiddleware, this.getGDOById.bind(this));
    this.router.get('/getGDOByUtenteId', authMiddleware, this.getGDOByUtenteId.bind(this));
    this.router.put('/saveGestionePagineSingular', authMiddleware, permissionGuard('impostazioni.gestisci_pagine_singular'), this.saveGestionePagineSingular.bind(this));
    this.router.get('/get_all_ruoli_gdo', authMiddleware, this.getAllRuoliGDO.bind(this));
    this.router.get('/get_all_gdo', authMiddleware, this.getAllGDO.bind(this));
    this.router.get('/get_all_aree_canali_combinazioni', authMiddleware, permissionGuard('gdo.gestisci_aree_canali'), this.getAllAreeCanaliECombinazioni.bind(this));
    //scoperta da permissionGuard perchè chiamata solo interna
    this.router.get("/get_all_combinazioni_canale_area", authMiddleware, this.getAllCombinazioniCanaleArea.bind(this));
    // GDO Workspace
    this.router.get('/tuttiIWorkspaceDaGDO', authMiddleware, this.getTuttiIWorkspaceDaGDO.bind(this));
    this.router.get("/gdo/icona", this.getIcona.bind(this))
    this.router.post(
      '/gdo/icona',
      authMiddleware,
      permissionGuard('gdo.upload_icona'),
      uploadSvgIcon.single('icona'),
      async (req: Request, res: Response) => {
        try {
          const idGDO = req.session?.id_gdo;

          if (!idGDO) {
            this.sendResponse(res, HttpStatusCode.UNAUTHORIZED, { message: 'Sessione non valida' });
            return;
          }

          if (!req.file) {
            this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: 'File SVG mancante' });
            return;
          }

          const { buffer, mimetype } = req.file;

          if (mimetype !== 'image/svg+xml') {
            this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: 'Formato SVG non valido' });
            return;
          }

          // sicurezza minima: verifica contenuto
          // const svgString = buffer.toString('utf-8');
          // if (!svgString.startsWith('<svg') || /<script/i.test(svgString)) {
          //   this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: 'SVG non valido' });
          //   return;
          // }

          const gdo = await GDO.findByPk(idGDO);
          if (!gdo) {
            this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'GDO non trovata' });
            return;
          }

          // salva i BYTE (Buffer)
          await gdo.update({
            icona_gdo: buffer, // <── BYTE ARRAY
          });

          this.sendResponse(res, HttpStatusCode.OK, { message: 'Icona caricata correttamente' });

        } catch (error: any) {
          this.handleError(res, error);
        }
      }
    );

    //TODO attenzione da questo metodo scaturira poi la gestione multi-gdo da SUPERADMIN
  }


  private async getIcona(req: Request, res: Response): Promise<void> {
    try {
      const idGDO = req.session?.id_gdo;
      if (!idGDO) {
        this.sendResponse(res, HttpStatusCode.UNAUTHORIZED, { message: 'Sessione non valida' });
        return;
      }

      const gdo = await GDO.findByPk(idGDO);

      if (!gdo || !gdo.icona_gdo) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Icona non disponibile' });
        return;
      }

      // Restituiamo il buffer SVG con gli header corretti per evitare CORB/CORS
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.status(HttpStatusCode.OK).send(gdo.icona_gdo);

    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getAllCombinazioniCanaleArea(req: Request, res: Response): Promise<void> {
    try {
      const { combinazioni } = await this.serviceFacade.getAllAreeCanaliECombinazioni();
      this.sendResponse(res, HttpStatusCode.OK, combinazioni);
    } catch (error) {
      this.handleError(res, error);
    }
  }
  private async getAllGDO(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.gdoService.getAllGDO();
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getAllRuoliGDO(req: Request, res: Response): Promise<void> {
    try {

      const result = await this.gdoService.getAllRuoliGDO();
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }


  private async getGDOById(req: Request, res: Response): Promise<void> {
    try {
      const gdo = await this.gdoService.getGDOById(req.params.id);
      if (!gdo) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: "GDO non trovata" });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, gdo);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getGDOByUtenteId(req: Request, res: Response): Promise<void> {
    try {
      const gdo = await this.gdoService.getGDOByUtenteId(req.session.id_utente as string);
      if (!gdo) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: "GDO non trovata" });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, gdo);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async saveGestionePagineSingular(req: Request, res: Response): Promise<void> {
    try {
      const { idGdo, gestionePagineSingulari } = req.body;
      if (!idGdo || !gestionePagineSingulari) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: "Dati mancanti" });
        return;
      }

      const result = await this.gdoService.saveGestionePagineSingular(idGdo, gestionePagineSingulari);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }


  private async getTuttiIWorkspaceDaGDO(req: Request, res: Response): Promise<void> {
    try {
      const gdo = await this.gdoService.getGDOByUtenteId(req.session.id_utente as string);
      if (!gdo) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { error: "GDO non trovata" });
        return;
      }
      if (!gdo.id) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { error: "Non è stato possibile identificare la GDO" });
        return;
      }
      const result = await this.webPliantService.getAllWorkspaceWebPliantDaIdGdo(gdo.id);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getAllAreeCanaliECombinazioni(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.serviceFacade.getAllAreeCanaliECombinazioni();
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }



}
