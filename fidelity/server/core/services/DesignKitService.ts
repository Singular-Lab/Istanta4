import { Request } from 'express';
import { Op } from 'sequelize';
import { MODALITA_TIPO_EXPORT, TIPO_KIT_DESIGN } from '../../../lib/enums';
import { NotFoundError, wrapDatabaseError } from '../../../lib/errors';
import { log } from '../logger';
import { DESIGN_KIT_MONGO, FileItemKit, OggettoTipiDiExport, RaccoglitoreKit } from '../../../lib/types';
import { AreaResponseDTO, CanaleResponseDTO, FormatiResponseDTO, PuntoVenditaResponseDTO, TipiDiExportResponseDTO } from '../dto';
import { IDesignKitService } from '../interfaces/IDesignKitService';
import { Area } from '../models/aree';
import { Canale } from '../models/canali';
import { DesignKit } from '../models/design_kit';
import { Formati } from '../models/formati';
import { PuntoVendita } from '../models/punto_vendita/punti_vendita';
import { RaccoglitoreKit as RaccoglitoreKitModel } from '../models/raccoglitore_kit';
import { TipiDiExport } from '../models/tipi_di_export';

function mapToDesignKitMongo(pgKit: any): any {
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

export class DesignKitService implements IDesignKitService {
  constructor() { }

  async getAllKitDesign(): Promise<DESIGN_KIT_MONGO[]> {
    try {
      const kitDesign = await DesignKit.findAll({ raw: true });
      return kitDesign.map(mapToDesignKitMongo) as unknown as DESIGN_KIT_MONGO[];
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero dei kit design"), {
        message: "Errore durante il recupero dei kit design",
        operation: 'getAllKitDesign',
        entity: 'DesignKit',
        details: { error }
      });
    }
  }

  async getAllKitDesignNoManuale(): Promise<any[]> {
    try {
      const kit = await DesignKit.findAll({ where: { tipo: { [Op.ne]: TIPO_KIT_DESIGN.MANUALE } }, raw: true });
      return kit.map(mapToDesignKitMongo);
    } catch (error) {
      log.error('Impossibile recuperare i kit design non manuali', error instanceof Error ? error : new Error(String(error)));
      throw wrapDatabaseError(new Error("Errore durante il recupero dei kit design"), {
        message: "Errore durante il recupero dei kit design",
        operation: 'find',
        entity: 'DesignKit',
        details: { error }
      });
    }
  }

  async createCombinazioneDesign(data: {
    quantitaCopie: number;
    tipiDiExportInKit: OggettoTipiDiExport[];
    guidFormato: string;
    guidPv: string;
    guidArea: string;
    guidCanale: string;
    titolo: string;
  }): Promise<RaccoglitoreKit | null> {
    try {
      const resultCreazioneCombinazioneDesign = await DesignKit.create({
        id_area: data.guidArea,
        id_canale: data.guidCanale,
        id_formato: data.guidFormato,
        tipi_di_export_in_kit: data.tipiDiExportInKit,
        quantita_copie: data.quantitaCopie,
        titolo: data.titolo,
      } as any);
      if (!resultCreazioneCombinazioneDesign) {
        return null;
      }
      return mapToDesignKitMongo(resultCreazioneCombinazioneDesign.get({ plain: true })) as unknown as RaccoglitoreKit;
    } catch (error) {
      log.error('Impossibile creare la combinazione design', error instanceof Error ? error : new Error(String(error)));
      throw wrapDatabaseError(new Error("Errore durante la creazione della combinazione design"), {
        message: "Errore durante la creazione della combinazione design",
        operation: 'create',
        entity: 'DesignKit',
        details: { data },
      });
    }
  }

  async getAllCombinazioniDesignByIdTemplate(guidIdTemplate: string): Promise<DESIGN_KIT_MONGO[]> {
    try {
      const combinazioni = await DesignKit.findAll({ where: { id_raccoglitore: guidIdTemplate }, raw: true });
      if (!combinazioni) return [];
      const mapped = combinazioni.map(mapToDesignKitMongo) as any[];
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
      throw wrapDatabaseError(new Error("Errore durante il recupero delle combinazioni"), {
        message: "Errore durante il recupero delle combinazioni",
        operation: 'find',
        entity: 'DesignKit',
        details: { error }
      });
    }
  }

  async getCombinazioneDesignById(guidIdCombinazione: string): Promise<DESIGN_KIT_MONGO | null> {
    try {
      const combinazione = await DesignKit.findOne({ where: { id: guidIdCombinazione }, raw: true });
      if (!combinazione) return null;
      const mapped = mapToDesignKitMongo(combinazione) as any;
      const area = await Area.findByPk(mapped.id_area);
      if (area) {
        mapped.nomeArea = area.nome_aree;
      }
      const canale = await Canale.findByPk(mapped.id_canale);
      if (canale) {
        mapped.nomeCanale = canale.nome_canali;
      }
      return mapped as unknown as DESIGN_KIT_MONGO;
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante il recupero delle combinazioni"), {
        message: "Errore durante il recupero delle combinazioni",
        operation: 'findOne',
        entity: 'DesignKit',
        details: { error }
      });
    }
  }

  async updateCombinazioneDesign(data: DESIGN_KIT_MONGO): Promise<DESIGN_KIT_MONGO> {
    try {
      const pgData: Record<string, any> = {};
      if (data.guidArea !== undefined) pgData.id_area = data.guidArea;
      if (data.guidCanale !== undefined) pgData.id_canale = data.guidCanale;
      if (data.guidFormato !== undefined) pgData.id_formato = data.guidFormato;
      if (data.guidIdRaccoglitore !== undefined) pgData.id_raccoglitore = data.guidIdRaccoglitore;
      if (data.tipiDiExportInKit !== undefined) pgData.tipi_di_export_in_kit = data.tipiDiExportInKit;
      if (data.quantitaCopie !== undefined) pgData.quantita_copie = data.quantitaCopie;
      if (data.filtroContesto !== undefined) pgData.filtro_contesto = data.filtroContesto;
      if (data.tags !== undefined) pgData.tags = data.tags;
      if (data.titolo !== undefined) pgData.titolo = data.titolo;
      if (data.tipo !== undefined) pgData.tipo = data.tipo;
      if (data.declinazioni !== undefined) pgData.declinazioni = data.declinazioni;
      if ((data as any).filtri !== undefined) pgData.filtro = (data as any).filtri;
      if ((data as any).stato !== undefined) pgData.stato = (data as any).stato;

      const [count] = await DesignKit.update(pgData, { where: { id: data.guidId } });
      if (count === 0) {
        throw new NotFoundError({
          message: "Combinazione design non trovata",
          entityType: 'DesignKit',
          entityId: data.guidId,
        });
      }
      const result = await DesignKit.findOne({ where: { id: data.guidId }, raw: true });
      if (!result) {
        throw new NotFoundError({
          message: "Combinazione design non trovata dopo l'aggiornamento",
          entityType: 'DesignKit',
          entityId: data.guidId,
        });
      }
      return mapToDesignKitMongo(result) as unknown as DESIGN_KIT_MONGO;
    } catch (error) {
      log.error('Impossibile aggiornare la combinazione design', error instanceof Error ? error : new Error(String(error)), { guidId: data.guidId });
      throw wrapDatabaseError(new Error("Errore durante l'aggiornamento della combinazione design"), {
        message: "Errore durante l'aggiornamento della combinazione design",
        operation: 'update',
        entity: 'DesignKit',
        details: { error }
      });
    }
  }

  async get_all_template_combinazioni_design(): Promise<any[]> {
    try {
      // Step 1: ottieni tutti i raccoglitori template
      const raccoglitori = await RaccoglitoreKitModel.findAll({ raw: true });
      if (raccoglitori.length === 0) return [];

      const raccoglitoriIds = raccoglitori.map((r: any) => r.id);

      // Step 2: ottieni tutti i kit design associati
      const allKits = await DesignKit.findAll({
        where: { id_raccoglitore: { [Op.in]: raccoglitoriIds } },
        raw: true,
      });

      // Mappa raccoglitore → conteggio kit
      const countMap = new Map<string, number>();
      // Mappa raccoglitore → primo id_formato
      const formatoMap = new Map<string, string>();
      for (const k of allKits) {
        const key = (k as any).id_raccoglitore;
        countMap.set(key, (countMap.get(key) ?? 0) + 1);
        if (!formatoMap.has(key) && (k as any).id_formato) {
          formatoMap.set(key, (k as any).id_formato);
        }
      }

      // Step 3: ottieni i formati con un'unica query
      const formatoIds = [...new Set([...formatoMap.values()])].filter(Boolean);
      const formati = formatoIds.length > 0
        ? await Formati.findAll({ where: { id_formati: { [Op.in]: formatoIds } } })
        : [];
      const formatiMap = new Map(formati.map(f => [f.id_formati, f]));

      return raccoglitori.map((r: any) => ({
        ...r,
        guidId: r.id,
        quantitaKit: countMap.get(r.id) ?? 0,
        formatoTemplate: formatoMap.get(r.id) ?? null,
        codiceFormato: formatiMap.get(formatoMap.get(r.id) ?? '')?.codice_formati ?? "Formato non specificato",
      }));
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero delle combinazioni"), {
        message: "Errore durante il recupero delle combinazioni",
        operation: 'findAll',
        entity: 'RaccoglitoreKitModel',
        details: { error }
      });
    }
  }

  async get_info_creazione_combinazioni_design(): Promise<{
    tipiExport: TipiDiExportResponseDTO[];
    formati: FormatiResponseDTO[];
    canali: CanaleResponseDTO[];
    aree: AreaResponseDTO[];
    puntiVendita: PuntoVenditaResponseDTO[];
  }> {
    try {
      const [tipiExport, formati, canali, aree, puntiVendita] = await Promise.all([
        TipiDiExport.findAll(),
        Formati.findAll(),
        Canale.findAll(),
        Area.findAll(),
        PuntoVendita.findAll()
      ]);
      const canaliResponse: CanaleResponseDTO[] = canali.map(canale => ({
        id: canale.id_canali,
        updatedat: canale.updatedat,
        codice: canale.codice_canali,
        nome: canale.nome_canali,
        id_gdo: canale.id_gdo_canali
      }));
      const areeResponse: AreaResponseDTO[] = aree.map(area => ({
        id: area.id_aree,
        updatedat: area.updatedat,
        codice: area.codice_aree,
        nome: area.nome_aree,
        id_gdo: area.id_gdo_aree,
      }));
      const tipiExportResponse: TipiDiExportResponseDTO[] = tipiExport.map((tipo: any) => ({
        id: tipo.id_tipiexport,
        nome: tipo.nome_tipiexport,
        codice: tipo.codice_tipiexport,
        modalita: tipo.modalita_tipiexport as MODALITA_TIPO_EXPORT,
        guid_namingconvention: tipo.guid_namingconvention_tipiexport,
        filtri: tipo.filtri_tipiexport,
        createdat: tipo.createdat,
        updatedat: tipo.updatedat
      }));
      const formatiResponse: FormatiResponseDTO[] = formati.map(formato => ({
        id: formato.id_formati,
        nome: formato.nome_formati,
        codice: formato.codice_formati,
        descrizione: formato.descrizione_formati,
        tipo_lavorazione: formato.tipo_lavorazione_formati,
        updatedat: formato.updatedat
      }));
      const puntiVenditaResponse: PuntoVenditaResponseDTO[] = puntiVendita.map(punto => ({
        id: punto.id_puntivendita,
        nome: punto.nome_puntivendita,
        citta: punto.citta_puntivendita,
        cap: punto.cap_puntivendita,
        indirizzo: punto.indirizzo_puntivendita,
        id_combinazione_canale_area: punto.id_combinazione_canale_area_puntivendita,
        id_gdo: punto.id_gdo_puntivendita,
        ragionesociale: punto.ragionesociale_puntivendita,
        provincia: punto.provincia_puntivendita,
        regione: punto.regione_puntivendita,
        telefono: punto.telefono_puntivendita,
        createdat: punto.createdat,
        updatedat: punto.updatedat,
        indirizzo_completo: punto.indirizzo_puntivendita,
        coordinate: {
          lat: punto.lat_puntivendita ?? 0,
          lon: punto.lon_puntivendita ?? 0
        },
        nome_display: punto.nome_puntivendita,
        has_coordinate: typeof punto.lat_puntivendita === 'number' && typeof punto.lon_puntivendita === 'number',
        sigla_combinazione: (canaliResponse.find(c => c.id === punto.id_combinazione_canale_area_puntivendita)?.codice || '') + (areeResponse.find(a => a.id === punto.id_combinazione_canale_area_puntivendita)?.codice || '')
      }));
      return {
        tipiExport: tipiExportResponse,
        formati: formatiResponse,
        canali: canaliResponse,
        aree: areeResponse,
        puntiVendita: puntiVenditaResponse
      };
    } catch (error) {
      log.error('Impossibile recuperare le informazioni per la creazione di combinazioni design', error instanceof Error ? error : new Error(String(error)));
      throw wrapDatabaseError(new Error("Errore durante il recupero delle informazioni"), {
        message: "Errore durante il recupero delle informazioni",
        operation: 'findAll',
        entity: 'TipiDiExport',
        details: { error }
      });
    }
  }

  async creaCombinazioniDesign(data: {
    titolo: string;
    guidCanale: string[];
    guidArea: string[];
    guidPv?: string[];
    guidFormato: string;
    quantitaCopie: number;
    declinazioni?: any[];
    filtri?: any[];
    tipo: TIPO_KIT_DESIGN;
    tipiDiExportInKit: OggettoTipiDiExport[];
    files?: FileItemKit[];
  }, req: Request): Promise<any> {
    try {
      const result = await DesignKit.create({
        id_canale: data.guidCanale?.[0],
        id_area: data.guidArea?.[0],
        id_formato: data.guidFormato,
        quantita_copie: data.quantitaCopie,
        declinazioni: data.declinazioni,
        filtro: data.filtri,
        tipo: data.tipo,
        tipi_di_export_in_kit: data.tipiDiExportInKit,
        titolo: data.titolo,
      } as any);
      return mapToDesignKitMongo(result.get({ plain: true }));
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante la creazione delle combinazioni design"), {
        message: "Errore durante la creazione delle combinazioni design",
        operation: 'create',
        entity: 'DesignKit',
        details: { error }
      });
    }
  }
}
