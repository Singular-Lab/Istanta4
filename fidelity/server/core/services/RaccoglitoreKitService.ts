import { Request } from 'express';
import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Colorize } from '../../../lib/Colorize';
import { STATO_COMBINAZIONI, TIPO_KIT_DESIGN } from '../../../lib/enums';
import { ExternalApiError, NotFoundError, wrapDatabaseError } from '../../../lib/errors';
import { DESIGN_KIT_MONGO, Declinazione, FileItemKit, OggettoTipiDiExport, RaccoglitoreKit } from '../../../lib/types';
import config from '../config';
import { sequelize } from '../db/SequelizeConnector';
import { FormatiResponseDTO } from '../dto';
import { IRaccoglitoreKitService } from '../interfaces/IRaccoglitoreKitService';
import { log } from '../logger';
import { CombinazioneCanaleArea } from '../models';
import { Area } from '../models/aree';
import { Canale } from '../models/canali';
import { DesignKit } from '../models/design_kit';
import { Formati } from '../models/formati';
import { PuntoVendita } from '../models/punto_vendita/punti_vendita';
import { RaccoglitoreKit as RaccoglitoreKitModel } from '../models/raccoglitore_kit';
import { ServerUtils } from '../utils/ServerUtils';

/** Maps a raw DesignKit PG row (singular id_area/id_canale) to camelCase shape */
function mapPgKitToMongo(pgKit: any): any {
  return {
    ...pgKit,
    guidId: pgKit.id,
    guidArea: pgKit.id_area,
    guidCanale: pgKit.id_canale,
    guidFormato: pgKit.id_formato,
    guidIdRaccoglitore: pgKit.id_raccoglitore,
    tipiDiExportInKit: pgKit.tipi_di_export_in_kit,
    quantitaCopie: pgKit.quantita_copie,
    filtroContesto: pgKit.filtro_contesto,
  };
}

/** Maps a raw RaccoglitoreKit PG row to the RaccoglitoreKit client shape */
function mapPgRaccoglitoreKitToMongo(pgKit: any): RaccoglitoreKit {
  return {
    ...pgKit,
    guidId: pgKit.id,
    guidAree: pgKit.id_aree ?? [],
    guidCanali: pgKit.id_canali ?? [],
    guidFormato: pgKit.id_formato,
    guidIdPv: pgKit.id_pv ?? [],
    titolo: pgKit.titolo,
    filtro: pgKit.filtro ?? [],
    declinazioni: pgKit.declinazioni ?? [],
    quantita: pgKit.quantita,
    tipo: pgKit.tipo,
    filtroContesto: pgKit.filtro_contesto ?? [],
    tags: pgKit.tags ?? [],
    files: pgKit.files ?? [],
    tipiDiExportInKit: (pgKit.tipi_di_export_in_kit ?? []).map((t: any) => ({
      tipoDiExportGuidID: t.tipoDiExportGuidID ?? t.tipo_di_export_guid_id,
      filtro: t.filtro ?? [],
      useWebhook: t.useWebhook ?? t.use_webhook,
      webhookEvents: t.webhookEvents ?? t.webhook_events,
    })),
  };
}

function mapMongoKitToPg(mongoKit: any): any {
  return {
    id: mongoKit.guidId,
    id_area: mongoKit.guidArea,
    id_canale: mongoKit.guidCanale,
    id_formato: mongoKit.guidFormato,
    id_raccoglitore: mongoKit.guidIdRaccoglitore,
    tipi_di_export_in_kit: (mongoKit.tipiDiExportInKit || []).map((t: any) => ({
      tipo_di_export_guid_id: t.tipoDiExportGuidID,
      filtro: t.filtro ?? [],
      use_webhook: t.useWebhook,
      webhook_events: t.webhookEvents,
    })),
    quantita_copie: mongoKit.quantitaCopie,
    filtro_contesto: mongoKit.filtroContesto,
    titolo: mongoKit.titolo,
    tipo: mongoKit.tipo,
    stato: mongoKit.stato,
    tags: mongoKit.tags ?? [],
    declinazioni: mongoKit.declinazioni,
    filtro: mongoKit.filtri ?? mongoKit.filtro,
    files: mongoKit.files,
  };
}

export class RaccoglitoreKitService implements IRaccoglitoreKitService {
  constructor() { }

  async getRaccoglitoreKitById(id: string): Promise<RaccoglitoreKit | null> {
    try {
      const result = await RaccoglitoreKitModel.findOne({ where: { id }, raw: true });
      return result ? mapPgRaccoglitoreKitToMongo(result) : null;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero del raccoglitore"), {
        message: "Errore durante il recupero del raccoglitore",
        operation: 'findOne',
        entity: 'RaccoglitoreKitModel',
        details: { error }
      });
    }
  }

  async eliminaRaccoglitoreKit(id: string): Promise<any> {
    try {
      await RaccoglitoreKitModel.destroy({ where: { id }, limit: 1 });
      const eliminaCombinazioni = await DesignKit.destroy({ where: { id_raccoglitore: id } });
      return eliminaCombinazioni;
    } catch (error: any) {
      console.error(Colorize.bgRed(error));
      throw wrapDatabaseError(new Error("Errore durante la creazione della combinazione di design"), {
        message: "Errore durante la creazione della combinazione di design",
        operation: 'destroy',
        entity: 'RaccoglitoreKitModel',
        details: { error }
      });
    }
  }

  async updateRaccoglitoreKit(data: {
    id: string;
    titolo: string;
    quantita: number;
    tipiDiExportInKit: OggettoTipiDiExport[];
    guidAree: string[];
    guidCanali: string[];
    guidIdPv?: string[];
    guidFormato: string;
    tags?: string[];
    tipo: TIPO_KIT_DESIGN;
    files?: FileItemKit[];
  }): Promise<any> {
    try {
      let arrayCombinazioniDesign: DESIGN_KIT_MONGO[] = [];
      const getAllCombinazioni = await this.getAllCombinazioniDesignByIdTemplate(data.id);
      const areePromises = data.guidAree.map(async (area) => {
        if (area == undefined) {
          throw new NotFoundError({
            message: "Area non trovata",
            entityType: 'Area',
            entityId: area
          });
        }
        const areaEsiste = await Area.findByPk(area);
        const formato = await this.getFormatoById(data.guidFormato);
        if (areaEsiste == null) {
          throw new NotFoundError({
            message: `Area ${area} non esistente`,
            entityType: 'Area',
            entityId: area
          });
        }

        const canaliPromises = data.guidCanali.map(async (canale) => {
          if (canale == undefined) {
            throw new NotFoundError({
              message: "Dati mancanti",
              entityType: 'Canale',
              entityId: canale
            });
          }
          const canaleEsiste = await Canale.findByPk(canale);
          if (canaleEsiste == null) {
            throw new NotFoundError({
              message: `Canale ${canale} non esistente`,
              entityType: 'Canale',
              entityId: canale
            });
          }
          const combinazioneCanaleArea = await CombinazioneCanaleArea.findOne({
            where: {
              id_canale_combinazione_canale_area: canaleEsiste.id_canali,
              id_area_combinazione_canale_area: areaEsiste.id_aree
            }
          });
          if (combinazioneCanaleArea != undefined || combinazioneCanaleArea != null) {
            if (data.guidIdPv == undefined || data.guidIdPv.length == 0) {
              const guidId = getAllCombinazioni.find(combinazione => combinazione.guidCanale == canale && combinazione.guidArea == area);
              if (guidId != undefined) {
                arrayCombinazioniDesign.push({
                  guidId: guidId.guidId,
                  guidArea: areaEsiste.id_aree,
                  filtro: [],
                  guidCanale: canaleEsiste.id_canali,
                  guidFormato: data.guidFormato,
                  tipiDiExportInKit: data.tipiDiExportInKit,
                  quantitaCopie: data.quantita,
                  titolo: data.titolo != "" ? `${data.titolo}_${canaleEsiste.codice_canali}${areaEsiste.codice_aree}_${formato?.codice}` : `${canaleEsiste.codice_canali}${areaEsiste.codice_aree}_${formato?.codice}`,
                  guidIdRaccoglitore: data.id,
                  stato: STATO_COMBINAZIONI.ATTIVO,
                  filtroContesto: [],
                  tags: data.tags ?? [],
                  files: data.files,
                  tipo: data.tipo,
                });
              } else {
                arrayCombinazioniDesign.push({
                  guidId: uuidv4(),
                  guidArea: areaEsiste.id_aree,
                  filtro: [],
                  guidCanale: canaleEsiste.id_canali,
                  guidFormato: data.guidFormato,
                  tipiDiExportInKit: data.tipiDiExportInKit,
                  quantitaCopie: data.quantita,
                  titolo: data.titolo != "" ? `${data.titolo}_${canaleEsiste.codice_canali}${areaEsiste.codice_aree}_${formato?.codice}` : `${canaleEsiste.codice_canali}${areaEsiste.codice_aree}_${formato?.codice}`,
                  guidIdRaccoglitore: data.id,
                  stato: STATO_COMBINAZIONI.ATTIVO,
                  filtroContesto: [],
                  tags: data.tags ?? [],
                  files: data.files,
                  tipo: data.tipo,
                });
              }
            } else {
              const pvPromises = data.guidIdPv.map(async (pv) => {
                if (pv == undefined) {
                  return;
                }
                const pvEsiste = await PuntoVendita.findByPk(pv);
                if (pvEsiste == null) {
                  return;
                }
                const guidId = getAllCombinazioni.find(combinazione => combinazione.guidCanale == canale && combinazione.guidArea == area && combinazione.guidPv == pv);
                if (guidId != undefined) {
                  arrayCombinazioniDesign.push({
                    guidId: guidId.guidId,
                    guidArea: areaEsiste.id_aree,
                    filtro: [],
                    guidCanale: canaleEsiste.id_canali,
                    guidFormato: data.guidFormato,
                    tipiDiExportInKit: data.tipiDiExportInKit,
                    quantitaCopie: data.quantita,
                    titolo: data.titolo != "" ? `${data.titolo}_${canaleEsiste.codice_canali}${areaEsiste.codice_aree}_${pvEsiste.nome_puntivendita}_${formato?.codice}` : `${canaleEsiste.codice_canali}${areaEsiste.codice_aree}_${pvEsiste.nome_puntivendita}_${formato?.codice}`,
                    guidIdRaccoglitore: data.id,
                    stato: STATO_COMBINAZIONI.ATTIVO,
                    filtroContesto: [],
                    tags: data.tags ?? [],
                    files: data.files,
                    tipo: data.tipo,
                  });
                } else {
                  arrayCombinazioniDesign.push({
                    guidId: uuidv4(),
                    guidArea: areaEsiste.id_aree,
                    filtro: [],
                    guidCanale: canaleEsiste.id_canali,
                    guidFormato: data.guidFormato,
                    tipiDiExportInKit: data.tipiDiExportInKit,
                    quantitaCopie: data.quantita,
                    titolo: data.titolo != "" ? `${data.titolo}_${canaleEsiste.codice_canali}${areaEsiste.codice_aree}_${pvEsiste.nome_puntivendita}_${formato?.codice}` : `${canaleEsiste.codice_canali}${areaEsiste.codice_aree}_${pvEsiste.nome_puntivendita}_${formato?.codice}`,
                    guidIdRaccoglitore: data.id,
                    stato: STATO_COMBINAZIONI.ATTIVO,
                    filtroContesto: [],
                    tags: data.tags ?? [],
                    files: data.files,
                    tipo: data.tipo,
                  });
                }
              });
              await Promise.all(pvPromises);
            }
          }
        });
        await Promise.all(canaliPromises);
      });
      await Promise.all(areePromises);
      const modificaCombinazioni = await this.updateCombinazioniDesign(data.id, arrayCombinazioniDesign);
      const pgData: any = {
        titolo: data.titolo,
        quantita: data.quantita,
        tipi_di_export_in_kit: (data.tipiDiExportInKit || []).map((t: OggettoTipiDiExport) => ({
          tipo_di_export_guid_id: t.tipoDiExportGuidID,
          filtro: t.filtro ?? [],
          use_webhook: t.useWebhook,
          webhook_events: t.webhookEvents,
        })),
        id_aree: data.guidAree,
        id_canali: data.guidCanali,
        id_pv: data.guidIdPv ?? [],
        id_formato: data.guidFormato,
        tags: data.tags ?? [],
        tipo: data.tipo,
        files: data.files ?? [],
      };
      const [count] = await RaccoglitoreKitModel.update(pgData, { where: { id: data.id } });
      if (modificaCombinazioni.esito && count >= 0) {
        return { esito: true, error: "" };
      } else {
        return { esito: false, error: { modifica: modificaCombinazioni.error, update: "Nessun documento aggiornato" } };
      }
    } catch (error) {
      console.error(Colorize.bgRed(error));
      if (error instanceof NotFoundError) {
        throw error;
      } else {
        throw wrapDatabaseError(new Error("Errore durante l'aggiornamento del raccoglitore kit"), {
          message: "Errore durante l'aggiornamento del raccoglitore kit",
          operation: 'update',
          entity: 'RaccoglitoreKitModel',
          details: { error }
        });
      }
    }
  }

  /** Filtri */

  async creaFiltroPerRaccoglitoreById(idCombinazione: string, filtri: any[]): Promise<any> {
    const transaction = await sequelize.transaction();
    try {
      const result = await RaccoglitoreKitModel.update(
        { filtro: filtri },
        { where: { id: idCombinazione }, validate: false, transaction },
      );
      await DesignKit.update({
        filtro: filtri
      }, {
        where: { id_raccoglitore: idCombinazione }, validate: false, transaction
      });
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      console.error(Colorize.bgRed('Errore durante la creazione del filtro:'), error);
      throw wrapDatabaseError(error, {
        message: "Errore durante la creazione del filtro",
        operation: 'update',
        entity: 'DesignKit',
        details: { error }
      });
    }
  }

  async getFiltroById(idCombinazione: string): Promise<any> {
    try {
      const result = await RaccoglitoreKitModel.findOne({ where: { id: idCombinazione }, raw: true }) as any;
      if (result == null) {
        return null;
      }
      const filtro = result.filtro;
      return filtro;
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante il recupero del filtro:'), error);
      throw wrapDatabaseError(new Error("Errore durante il recupero del filtro"), {
        message: "Errore durante il recupero del filtro",
        operation: 'findOne',
        entity: 'RaccoglitoreKitModel',
        details: { error }
      });
    }
  }

  async creaFiltroContestoPerRaccoglitoreById(idCombinazione: string, filtriContext: any[]): Promise<any> {
    try {
      const resultUpdateFiltroContestoTemplate = await RaccoglitoreKitModel.update(
        { filtro_contesto: filtriContext },
        {
          where: { id: idCombinazione },
          validate: false,
        } as any
      );
      const result = await DesignKit.update(
        { filtro_contesto: filtriContext } as any,
        {
          where: { id_raccoglitore: idCombinazione },
          validate: false
        }
      );
      return { resultUpdateFiltroContestoTemplate, result };
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante la creazione del filtro contesto",
        operation: 'update',
        entity: 'DesignKit',
        details: { error }
      });
    }
  }

  async getFiltroContestoDaIstanta(req: Request): Promise<any[]> {
    try {
      const result = await ServerUtils.sendToFICOApi<{ schemi: any[], esito: boolean, error: string }>(
        req,
        `${config.ISTANTA_IP_ADDRESS}/FicoProcess/getSchemasContext`,
        'GET',
        undefined
      );
      if (!result.data.esito) {
        throw new ExternalApiError({
          message: result.data.error || 'Errore API Istanta per filtri contesto',
          service: 'Istanta',
          endpoint: '/FicoProcess/getSchemasContext',
        });
      }
      return result.data.schemi;
    } catch (error) {
      if (error instanceof ExternalApiError) throw error;
      throw wrapDatabaseError(error, {
        message: "Errore durante il recupero dei filtri contesto",
        operation: 'sendToFICOApi',
        entity: 'ServerUtils',
        details: { error }
      });
    }
  }

  /** Declinazioni */

  async getAllDeclinazioniKitDaIstanta(req: Request): Promise<any> {
    try {
      const result = await ServerUtils.sendToFICOApi<{ content: any[], esito: boolean, error: string }>(
        req,
        `${config.ISTANTA_IP_ADDRESS}/FicoProcess/getAllDeclinazioniKit`,
        'GET',
        undefined
      );
      if (!result.data.esito) {
        throw new ExternalApiError({
          message: result.data.error || 'Errore API Istanta per declinazioni kit',
          service: 'Istanta',
          endpoint: '/FicoProcess/getAllDeclinazioniKit',
        });
      }
      return result.data.content;
    } catch (error) {
      if (error instanceof ExternalApiError) throw error;
      throw wrapDatabaseError(error, {
        message: "Errore durante il recupero delle declinazioni",
        operation: 'sendToFICOApi',
        entity: 'ServerUtils',
        details: { error }
      });
    }
  }

  async creaDeclinazioniPerRaccoglitoreById(guidId: string, declinazioni: Declinazione[]): Promise<any> {
    try {
      const result = await RaccoglitoreKitModel.update(
        { declinazioni } as any,
        { where: { id: guidId } }
      );
      const updateAllDesingKit = await DesignKit.update(
        { declinazioni } as any,
        { where: { id_raccoglitore: guidId } }
      );
      if (updateAllDesingKit[0] === 0) {
        console.error(Colorize.bgRed('Errore durante l\'aggiornamento delle declinazioni nei design kit per il raccoglitore:'), guidId);
      }
      return result;
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante la creazione delle declinazioni",
        operation: 'update',
        entity: 'RaccoglitoreKitModel',
        details: { error }
      });
    }
  }

  async creaDeclinazioniPerCombinazioneById(guidId: string, declinazioni: Declinazione[]): Promise<any> {
    try {
      const result = await DesignKit.update(
        { declinazioni } as any,
        { where: { id: guidId } }
      );
      return result;
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante la creazione delle declinazioni",
        operation: 'update',
        entity: 'DesignKit',
        details: { error }
      });
    }
  }

  // --- Private helpers ---

  private async getAllCombinazioniDesignByIdTemplate(guidIdTemplate: string): Promise<DESIGN_KIT_MONGO[]> {
    try {
      const combinazioni = await DesignKit.findAll({ where: { id_raccoglitore: guidIdTemplate }, raw: true });
      if (!combinazioni) return [];
      const mapped = combinazioni.map(mapPgKitToMongo) as any[];
      await Promise.all(mapped.map(async (combinazione) => {
        const area = await Area.findByPk(combinazione.id_area);
        if (area) {
          combinazione.nomeArea = area.nome_aree;
        }
        const canale = await Canale.findByPk(combinazione.id_canale);
        if (canale) {
          combinazione.nomeCanale = canale.nome_canali;
        }
      }));
      return mapped as unknown as DESIGN_KIT_MONGO[];
    } catch (error: any) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il recupero delle combinazioni",
        operation: 'find',
        entity: 'DesignKit',
        details: { error }
      });
    }
  }

  private async getFormatoById(id: string): Promise<FormatiResponseDTO | null> {
    try {
      const formato = await Formati.findByPk(id);
      if (!formato) return null;
      const response: FormatiResponseDTO = {
        id: formato.id_formati ?? '',
        nome: formato.nome_formati,
        codice: formato.codice_formati,
        descrizione: formato.descrizione_formati,
        tipo_lavorazione: formato.tipo_lavorazione_formati,
        createdat: formato.createdat,
        updatedat: formato.updatedat ?? new Date()
      };
      return response;
    } catch (error: any) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il recupero del formato",
        operation: 'findByPk',
        entity: 'Formati',
        details: { error }
      });
    }
  }

  async creaTemplateCombinazione(data: { guidId: string, titolo: string, filtro: any[], declinazioni: any[], tipiDiExportInKit: OggettoTipiDiExport[], quantita: number }): Promise<any> {
    try {
      const d = data as any;
      const resultCreazioneCombinazioneDesign = await RaccoglitoreKitModel.create({
        id: data.guidId,
        titolo: data.titolo,
        filtro: data.filtro ?? [],
        declinazioni: data.declinazioni ?? [],
        tipi_di_export_in_kit: (data.tipiDiExportInKit || []).map((t: OggettoTipiDiExport) => ({
          tipo_di_export_guid_id: t.tipoDiExportGuidID,
          filtro: t.filtro ?? [],
          use_webhook: t.useWebhook,
          webhook_events: t.webhookEvents,
        })),
        quantita: data.quantita,
        id_aree: d.guidAree ?? [],
        id_canali: d.guidCanali ?? [],
        id_pv: d.guidIdPv ?? [],
        id_formato: d.guidFormato,
        tags: d.tags ?? [],
        tipo: d.tipo,
        files: d.files ?? [],
      } as any);
      return resultCreazioneCombinazioneDesign
        ? mapPgRaccoglitoreKitToMongo(resultCreazioneCombinazioneDesign.get({ plain: true }))
        : null;
    } catch (error: any) {
      throw wrapDatabaseError(error, {
        message: "Errore durante la creazione del template combinazione",
        operation: 'create',
        entity: 'RaccoglitoreKitModel',
        details: { data },
      });
    }
  }

  async checkSeRaccoglitoreEsisteDaDati(data: {
    titolo: string,
    filtro: any[],
    declinazioni: any[],
    tipiDiExportInKit: any[],
    quantita: number,
    tipo: TIPO_KIT_DESIGN,
  }): Promise<boolean> {
    try {
      if (data.tipiDiExportInKit == undefined || Array.isArray(data.tipiDiExportInKit) == false) {
        data.tipiDiExportInKit = [];
      }
      if (data.declinazioni == undefined || Array.isArray(data.declinazioni) == false) {
        data.declinazioni = [];
      }
      if (data.filtro == undefined || Array.isArray(data.filtro) == false) {
        data.filtro = [];
      }
      log.debug("filtro", { filtro: data.filtro });
      log.debug("declinazioni", { declinazioni: data.declinazioni });
      log.debug("tipiDiExportInKit", { tipiDiExportInKit: data.tipiDiExportInKit });

      const sortedData = {
        ...data,
        filtro: (data.filtro && data.filtro.length > 0) ? (data.filtro || []).sort((a, b) => (a.nome_field || '').localeCompare(b.nome_field || '')) : [],
        declinazioni: (data.declinazioni && data.declinazioni.length > 0) ? (data.declinazioni || []).sort((a, b) => (a.chiave || '').localeCompare(b.chiave || '')) : [],
      };

      // Cerca per campi scalari, poi verifica i JSONB con isEqual in JS
      const raccoglitori = await RaccoglitoreKitModel.findAll({
        where: {
          titolo: sortedData.titolo,
          quantita: sortedData.quantita,
          tipo: data.tipo,
        },
        raw: true,
      });

      if (!raccoglitori || raccoglitori.length === 0) return false;

      return raccoglitori.some((r: any) =>
        _.isEqual(r.filtro, sortedData.filtro) &&
        _.isEqual(r.declinazioni, sortedData.declinazioni) &&
        _.isEqual(r.tipi_di_export_in_kit, sortedData.tipiDiExportInKit)
      );
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante il recupero delle combinazioni"), {
        message: "Errore durante il recupero delle combinazioni",
        operation: 'findAll',
        entity: 'RaccoglitoreKitModel',
        details: { error }
      });
    }
  }

  async createBulkCombinazioneDesign(data: { guidArea: string; guidCanale: string; guidFormato: string; tipiDiExportInKit: OggettoTipiDiExport[]; quantitaCopie: number; titolo: string; }[]): Promise<any> {
    try {
      const pgData = data.map(d => mapMongoKitToPg(d));
      const created = await DesignKit.bulkCreate(pgData as any);
      if (!created) return null;
      return created.map(c => mapPgKitToMongo(c.get({ plain: true })));
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante la creazione della combinazione di design"), {
        message: "Errore durante la creazione della combinazione di design",
        operation: 'bulkCreate',
        entity: 'DesignKit',
        details: { data },
      });
    }
  }

  private async updateCombinazioniDesign(id: string, data: DESIGN_KIT_MONGO[]) {
    try {
      // Recupera le combinazioni esistenti dal database
      const existingPg = await DesignKit.findAll({ where: { id_raccoglitore: id }, raw: true });
      const existingCombinations = existingPg.map(mapPgKitToMongo) as unknown as DESIGN_KIT_MONGO[];

      // Mappa per tenere traccia delle combinazioni esistenti
      const existingMap = new Map(existingCombinations?.map(comb => [comb.guidId, comb]));
      const map = new Map(existingCombinations?.map(comb => [comb.guidId, comb]));
      // Array per le nuove combinazioni e quelle da aggiornare
      const toUpdate: DESIGN_KIT_MONGO[] = [];
      const toCreate: DESIGN_KIT_MONGO[] = [];

      // Controlla le combinazioni fornite
      for (const comb of data) {
        const existingComb = existingMap.get(comb.guidId);

        if (existingComb) {
          // Se esiste, controlla se ci sono differenze tra area e canale
          if (existingComb.guidArea !== comb.guidArea
            || existingComb.guidCanale !== comb.guidCanale
            || existingComb.files !== comb.files
            || existingComb.guidFormato !== comb.guidFormato
            || existingComb.quantitaCopie !== comb.quantitaCopie
            || existingComb.tipiDiExportInKit !== comb.tipiDiExportInKit
            || existingComb.titolo !== comb.titolo
          ) {
            // Se ci sono differenze, aggiungi all'array di aggiornamento
            toUpdate.push(comb);
          }
          // Rimuovi dalla mappa per tenere traccia delle combinazioni da eliminare
          existingMap.delete(comb.guidId);
        } else {
          // Se non esiste, aggiungi all'array di creazione
          toCreate.push(comb);
        }
      }

      // Array per le combinazioni da eliminare
      const toDelete = Array.from(existingMap.values());

      // Aggiorna le combinazioni esistenti
      for (const comb of toUpdate) {
        const mapFiles = map.get(comb.guidId)?.files;
        const combFiles = comb.files;
        log.info(`Aggiornamento combinazione con guidId: ${comb.guidId}`);

        try {
          if (!_.isEqual(mapFiles, combFiles)) {
            log.info("Files diversi, aggiorno tutto");
            const pgUpdateData = mapMongoKitToPg(comb);
            delete pgUpdateData.id; // non aggiornare il PK
            const [modifiedCount] = await DesignKit.update(pgUpdateData, { where: { id: comb.guidId } });
            log.info(`Risultato aggiornamento: modificati ${modifiedCount} documenti`);

            if (modifiedCount === 0) {
              log.info(`Tentativo alternativo per guidId: ${comb.guidId}`);
              await DesignKit.update(pgUpdateData, { where: { id: comb.guidId } });
              const found = await DesignKit.findOne({ where: { id: comb.guidId }, raw: true });
              log.info(`Risultato alternativo: ${found ? "Successo" : "Fallimento"}`);
            }
          } else {
            log.info("Files uguali, non aggiorno i files");
            const pgUpdateData = mapMongoKitToPg(comb);
            delete pgUpdateData.id;
            delete pgUpdateData.files;
            const [modifiedCount] = await DesignKit.update(pgUpdateData, { where: { id: comb.guidId } });
            log.info(`Risultato aggiornamento senza files: modificati ${modifiedCount} documenti`);
          }
        } catch (error) {
          console.error(`Errore durante l'aggiornamento di ${comb.guidId}:`, error);
        }
      }

      // Crea nuove combinazioni
      if (toCreate.length > 0) {
        const pgToCreate = toCreate.map(mapMongoKitToPg);
        await DesignKit.bulkCreate(pgToCreate as any);
      }

      // Elimina le combinazioni non più valide
      for (const comb of toDelete) {
        await DesignKit.destroy({ where: { id: comb.guidId }, limit: 1 });
      }

      return { esito: true, error: "" };
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante l'aggiornamento delle combinazioni di design"), {
        message: "Errore durante l'aggiornamento delle combinazioni di design",
        operation: 'update',
        entity: 'DesignKit',
        details: { error }
      });
    }
  }
}
