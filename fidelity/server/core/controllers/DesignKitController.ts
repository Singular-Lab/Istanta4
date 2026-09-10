import { Request, Response } from 'express';
import 'express-session';
import { v4 as uuidv4 } from 'uuid';
import { CATEGORIA_ATTIVITA, HttpStatusCode, STATO_COMBINAZIONI, TIPO_ATTIVITA, TIPO_KIT_DESIGN } from '../../../lib/enums';
import { BadRequestError, NotFoundError } from '../../../lib/errors';
import { DESIGN_KIT_MONGO, FileItemKit, Filtro, OggettoTipiDiExport } from '../../../lib/types';
import { BaseController } from '../base/BaseController';
import { TYPES, container } from '../di';
import { IDesignKitService } from '../interfaces/IDesignKitService';
import { IFormatoService } from '../interfaces/IFormatoService';
import { IRaccoglitoreKitService } from '../interfaces/IRaccoglitoreKitService';
import { IServiceFacade } from '../interfaces/IServiceFacade';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { Area, Canale } from "../models";
import { ServerUtils } from '../utils/ServerUtils';
export class DesignKitController extends BaseController {

  constructor(
    private designKitService: IDesignKitService,
    private serviceFacade: IServiceFacade
  ) {
    super('/api');
  }

  public initializeRoutes(): void {
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.router.get('/get_info_creazione_combinazioni_design', authMiddleware, permissionGuard('design_kit.visualizza'), this.get_info_creazione_combinazioni_design.bind(this));
    this.router.put('/creaCombinazioniDesign', authMiddleware, permissionGuard('design_kit.crea'), this.creaCombinazioniDesign.bind(this));
    this.router.put('/getAllCombinazioniDesignByIdTemplate', authMiddleware, permissionGuard('design_kit.visualizza'), this.getAllCombinazioniDesignByIdTemplate.bind(this));
    this.router.get('/getCombinazioneDesignById/:id', authMiddleware, permissionGuard('design_kit.visualizza'), this.getCombinazioneDesignById.bind(this));
    this.router.put('/updateCombinazioneDesign', authMiddleware, permissionGuard('design_kit.modifica'), this.updateCombinazioneDesign.bind(this));
    this.router.get('/get_all_template_combinazioni_design', authMiddleware, permissionGuard('design_kit.visualizza'), this.get_all_template_combinazioni_design.bind(this));
    this.router.get('/get_all_kit_design', authMiddleware, permissionGuard('design_kit.visualizza'), this.getAllKitDesign.bind(this));
    this.router.get('/getAllKitDesignNoManuale', authMiddleware, permissionGuard('design_kit.visualizza'), this.getAllKitDesignNoManuale.bind(this));
  }

  private async get_info_creazione_combinazioni_design(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.designKitService.get_info_creazione_combinazioni_design();
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async creaCombinazioniDesign(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as {
        titolo: string,
        guidCanale: string[],
        guidArea: string[],
        guidPv?: string[],
        guidFormato: string,
        quantitaCopie: number,
        declinazioni?: any[],
        filtri?: Filtro[],
        tipo: TIPO_KIT_DESIGN,
        tipiDiExportInKit: OggettoTipiDiExport[],
        files?: FileItemKit[]
      };

      if (
        !ServerUtils.checkIfValueIsValid(data.quantitaCopie) ||
        !ServerUtils.checkIfValueIsValid(data.guidFormato) ||
        !ServerUtils.checkIfValueIsValid(data.titolo) ||
        (!Array.isArray(data.guidArea) && !Array.isArray(data.guidCanale))
      ) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "Dati mancanti" });
        return;
      }

      let arrayCombinazioniDesign: DESIGN_KIT_MONGO[] = [];
      const guidIdRaccoglitore = uuidv4();

      // Ottieni la GDO dell'utente
      const GDO = await this.serviceFacade.getGDOByUtenteId(req.session.id_utente as string);
      if (!GDO || !GDO.id) {
        const error = ServerUtils.createErrorObject("GDO non trovata", HttpStatusCode.BAD_REQUEST, {
          gdo_not_found: true
        });
        res.status(HttpStatusCode.BAD_REQUEST).json(error);
        return;
      }

      // Verifica che sia selezionata almeno un'area o un canale
      if (data.guidArea.length === 0 && data.guidCanale.length === 0) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "Errore: deve essere selezionata almeno un'area o un canale" });
        return;
      }
      // Se non ci sono aree selezionate, prendi tutte le aree disponibili
      else if (data.guidArea.length === 0 && data.guidCanale.length > 0) {
        const tutteLeAree = await this.serviceFacade.getAllAreas();
        data.guidArea = tutteLeAree.map(area => area.id).filter((id): id is string => id !== undefined);
      }
      // Se non ci sono canali selezionati, prendi tutti i canali disponibili
      else if (data.guidCanale.length === 0 && data.guidArea.length > 0) {
        const tuttiICanali = await this.serviceFacade.getAllCanali();
        data.guidCanale = tuttiICanali.map(canale => canale.id).filter((id): id is string => id !== undefined);
      }

      // Ordina gli array
      data.guidArea.sort();
      data.guidCanale.sort();
      if (data.guidPv) data.guidPv.sort();

      // Verifica se esiste già un raccoglitore con gli stessi dati
      const datiPerCheck = {
        titolo: data.titolo,
        filtro: data.filtri ?? [],
        declinazioni: data.declinazioni ?? [],
        tipiDiExportInKit: data.tipiDiExportInKit,
        quantita: data.quantitaCopie,
        tipo: data.tipo
      };

      const checkSeEsisteRaccoglitore = await container.get<IRaccoglitoreKitService>(TYPES.RaccoglitoreKitService).checkSeRaccoglitoreEsisteDaDati(datiPerCheck);
      if (checkSeEsisteRaccoglitore) {
        const error = ServerUtils.createErrorObject("Raccoglitore già esistente", HttpStatusCode.BAD_REQUEST, {
          template_exist: true
        });
        res.status(HttpStatusCode.BAD_REQUEST).json(error);
        return;
      }

      // Ottieni tutte le combinazioni area/canale disponibili
      const allaCanaleAreaCombinazioni = await this.serviceFacade.getAllCombinazioniForGDO(GDO?.id as string);

      // Filtra le aree e i canali in base alle combinazioni esistenti
      const combinazioniPresenti = data.guidArea.filter(area =>
        data.guidCanale.some(canale =>
          allaCanaleAreaCombinazioni.some(combinazione =>
            combinazione.id_area === area &&
            combinazione.id_canale === canale
          )
        )
      );

      data.guidArea = combinazioniPresenti;
      data.guidCanale = data.guidCanale.filter(canale =>
        combinazioniPresenti.some(area =>
          allaCanaleAreaCombinazioni.some(combinazione =>
            combinazione.id_area === area &&
            combinazione.id_canale === canale
          )
        )
      );

      // Crea le combinazioni design
      try {
        const formato = await container.get<IFormatoService>(TYPES.FormatoService).getFormatoById(data.guidFormato);

        for (const area of data.guidArea) {
          if (!ServerUtils.checkIfValueIsValid(area)) {
            throw new BadRequestError({ message: 'Dati mancanti: ID area non valido', details: { field: 'guidArea' } });
          }

          const areaEsiste = await Area.findByPk(area);
          if (!areaEsiste) {
            throw new NotFoundError({ message: `Area ${area} non esistente`, entityType: 'area', entityId: area });
          }

          for (const canale of data.guidCanale) {
            if (!ServerUtils.checkIfValueIsValid(canale)) {
              throw new BadRequestError({ message: 'Dati mancanti: ID canale non valido', details: { field: 'guidCanale' } });
            }

            const canaleEsiste = await Canale.findByPk(canale);
            if (!canaleEsiste) {
              throw new NotFoundError({ message: `Canale ${canale} non esistente`, entityType: 'canale', entityId: canale });
            }

            if (!data.guidPv || data.guidPv.length === 0) {
              if (data.tipo === TIPO_KIT_DESIGN.MANUALE) {
                arrayCombinazioniDesign.push({
                  guidId: uuidv4(),
                  guidArea: areaEsiste.id_aree,
                  filtro: data.filtri ?? [],
                  guidCanale: canaleEsiste.id_canali,
                  guidFormato: data.guidFormato,
                  tipiDiExportInKit: data.tipiDiExportInKit,
                  quantitaCopie: data.quantitaCopie,
                  titolo: data.titolo,
                  guidIdRaccoglitore: guidIdRaccoglitore,
                  stato: STATO_COMBINAZIONI.ATTIVO,
                  declinazioni: data.declinazioni ?? [],
                  filtroContesto: [],
                  tipo: data.tipo,
                  files: data.files
                });
              } else if (data.tipo === TIPO_KIT_DESIGN.AUTOMATICO) {
                arrayCombinazioniDesign.push({
                  guidId: uuidv4(),
                  guidArea: areaEsiste.id_aree,
                  filtro: data.filtri ?? [],
                  guidCanale: canaleEsiste.id_canali,
                  guidFormato: data.guidFormato,
                  tipiDiExportInKit: data.tipiDiExportInKit,
                  quantitaCopie: data.quantitaCopie,
                  titolo: data.titolo !== "" ? `${data.titolo}_${canaleEsiste.codice_canali}${areaEsiste.codice_aree}_${formato?.codice}` : `${canaleEsiste.codice_canali}${areaEsiste.codice_aree}_${formato?.codice}`,
                  guidIdRaccoglitore: guidIdRaccoglitore,
                  stato: STATO_COMBINAZIONI.ATTIVO,
                  declinazioni: data.declinazioni ?? [],
                  filtroContesto: [],
                  tipo: data.tipo,
                });
              }
            } else {
              for (const pv of data.guidPv) {
                if (!ServerUtils.checkIfValueIsValid(pv)) continue;

                const pvEsiste = await this.serviceFacade.getPuntoVenditaById(pv);
                if (!pvEsiste) continue;

                if (data.tipo === TIPO_KIT_DESIGN.MANUALE) {
                  arrayCombinazioniDesign.push({
                    guidId: uuidv4(),
                    guidArea: areaEsiste.id_aree,
                    filtro: data.filtri ?? [],
                    guidCanale: canaleEsiste.id_canali,
                    guidFormato: data.guidFormato,
                    tipiDiExportInKit: data.tipiDiExportInKit,
                    quantitaCopie: data.quantitaCopie,
                    titolo: data.titolo !== "" ? `${data.titolo}_${canaleEsiste.codice_canali}${areaEsiste.codice_aree}_${pvEsiste.nome}_${formato?.codice}` : `${canaleEsiste.codice_canali}${areaEsiste.codice_aree}_${pvEsiste.nome}_${formato?.codice}`,
                    guidIdRaccoglitore: guidIdRaccoglitore,
                    stato: STATO_COMBINAZIONI.ATTIVO,
                    declinazioni: data.declinazioni ?? [],
                    filtroContesto: [],
                    tipo: data.tipo,
                    files: data.files
                  });
                } else {
                  arrayCombinazioniDesign.push({
                    guidId: uuidv4(),
                    guidArea: areaEsiste.id_aree,
                    filtro: data.filtri ?? [],
                    guidCanale: canaleEsiste.id_canali,
                    guidFormato: data.guidFormato,
                    tipiDiExportInKit: data.tipiDiExportInKit,
                    quantitaCopie: data.quantitaCopie,
                    titolo: data.titolo !== "" ? `${data.titolo}_${canaleEsiste.codice_canali}${areaEsiste.codice_aree}_${pvEsiste.nome}_${formato?.codice}` : `${canaleEsiste.codice_canali}${areaEsiste.codice_aree}_${pvEsiste.nome}_${formato?.codice}`,
                    guidIdRaccoglitore: guidIdRaccoglitore,
                    declinazioni: data.declinazioni ?? [],
                    stato: STATO_COMBINAZIONI.ATTIVO,
                    filtroContesto: [],
                    tipo: data.tipo,
                  });
                }
              }
            }
          }
        }
      } catch (error: any) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: error.message });
        return;
      }

      if (arrayCombinazioniDesign.length === 0) {
        res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: "Errore durante la creazione delle combinazioni, le combinazioni risultano essere 0" });
        return;
      }

      // Crea il template per le combinazioni
      const oggettoPerTemplate = {
        guidAree: data.guidArea,
        guidCanali: data.guidCanale,
        guidIdPv: data.guidPv || [],
        guidId: guidIdRaccoglitore,
        titolo: data.titolo,
        filtro: data.filtri ?? [],
        declinazioni: data.declinazioni ?? [],
        tipiDiExportInKit: data.tipiDiExportInKit,
        quantita: data.quantitaCopie,
        guidFormato: data.guidFormato,
        tipo: data.tipo,
        files: data.files ?? []
      };

      const resultInsertTemplate = await container.get<IRaccoglitoreKitService>(TYPES.RaccoglitoreKitService).creaTemplateCombinazione(oggettoPerTemplate);
      if (!resultInsertTemplate) {
        res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: "Errore durante la creazione del template" });
        return;
      }

      const resultInsert = await container.get<IRaccoglitoreKitService>(TYPES.RaccoglitoreKitService).createBulkCombinazioneDesign(arrayCombinazioniDesign);

      if (req.session.id_utente) {
        await ServerUtils.CREA_ATTIVITA(
          req.session.id_utente as string,
          TIPO_ATTIVITA.CREAZIONE_DESIGN_KIT,
          CATEGORIA_ATTIVITA.PRODUZIONE,
          {
            nome: data.titolo,
            tipo: data.tipo,
            quantita: arrayCombinazioniDesign.length,
          }
        );
      }

      res.status(HttpStatusCode.OK).json(resultInsert);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getAllCombinazioniDesignByIdTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { guidIdTemplate } = req.body;
      const combinazioni = await this.designKitService.getAllCombinazioniDesignByIdTemplate(guidIdTemplate);
      res.status(HttpStatusCode.OK).json(combinazioni);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getCombinazioneDesignById(req: Request, res: Response): Promise<void> {
    try {
      const idCombinazione = req.params.id;
      const combinazione = await this.designKitService.getCombinazioneDesignById(idCombinazione as string);
      if (!combinazione) {
        res.status(HttpStatusCode.NOT_FOUND).json({ message: "Combinazione non trovata" });
        return;
      }
      res.status(HttpStatusCode.OK).json(combinazione);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async updateCombinazioneDesign(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body;
      if (!data || !data.guidId) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "Dati mancanti" });
        return;
      }
      const result = await this.designKitService.updateCombinazioneDesign(data);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async get_all_template_combinazioni_design(req: Request, res: Response): Promise<void> {
    try {
      const combinazioni = await this.designKitService.get_all_template_combinazioni_design();
      res.status(HttpStatusCode.OK).json(combinazioni);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getAllKitDesign(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.designKitService.getAllKitDesign();
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getAllKitDesignNoManuale(req: Request, res: Response): Promise<void> {
    try {
      const kitDesign = await this.designKitService.getAllKitDesignNoManuale();
      res.status(HttpStatusCode.OK).json(kitDesign);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }
}
