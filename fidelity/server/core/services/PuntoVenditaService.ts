import { Op } from 'sequelize';
import { DatabaseError, NotFoundError } from '../../../lib/errors';
import { CombinazioneCanaleAreaAttributes, PuntiVenditaAttributes } from '../../../lib/types';
import { AreaResponseDTO, CanaleResponseDTO, CreatePuntoVenditaDTO, PuntoVenditaResponseDTO } from '../dto';
import { DisplayContextResponseDTO } from '../dto/DisplayContextDTO';
import {
  CreateDispositivoPuntoVenditaDTO,
  DispositivoPuntoVenditaResponseDTO,
  UpdateDispositivoPuntoVenditaDTO,
  type PuntiVenditaPaginatedResponseDTO
} from '../dto/PuntoVenditaDTO';
import { IPuntoVenditaService } from '../interfaces/IPuntoVenditaService';
import { log } from '../logger';
import { Area, Canale, CombinazioneCanaleArea, PuntoVendita, PuntoVenditaUtenti } from '../models';
import { DisplayContextPuntoVendita } from '../models/punto_vendita/display_context_punto_vendita';
import { DispositivoMetadata, DispositivoPuntoVendita } from '../models/punto_vendita/dispositivi_punto_vendita';
import type { IPuntoVenditaRepository } from '../repositories/PuntoVenditaRepository';

export class PuntoVenditaService implements IPuntoVenditaService {

  constructor(private readonly puntoVenditaRepository: IPuntoVenditaRepository) { }



  /* ======================================================
   * DISPOSITIVI PUNTO VENDITA
   * ====================================================== */

  async getAllDispositiviPuntoVendita(id_pv: string): Promise<DispositivoPuntoVenditaResponseDTO[]> {
    try {
      const dispositivi = await DispositivoPuntoVendita.findAll({
        where: { id_puntivendita: id_pv },
        include: [{
          model: DisplayContextPuntoVendita,
          as: 'displayContext',
          required: false,
        }],
      });
      return dispositivi.map(d => this.mapDispositivoToDTO(d));
    } catch (error) {
      log.error('Errore durante il recupero dei dispositivi del punto vendita', error, { id_pv });
      throw new DatabaseError({
        message: 'Errore durante il recupero di tutti i dispositivi per il punto vendita selezionato',
        cause: error instanceof Error ? error : undefined,
        operation: 'get',
        entity: 'DispositivoPuntoVendita',
      });
    }
  }

  async getDispositivoById(id: string): Promise<DispositivoPuntoVenditaResponseDTO | null> {
    try {
      const device = await DispositivoPuntoVendita.findByPk(id, {
        include: [
          { model: DisplayContextPuntoVendita, as: 'displayContext', required: false },
          { model: PuntoVendita, as: 'puntoVendita', required: false },
        ],
      });
      if (!device) return null;
      return this.mapDispositivoToDTO(device);
    } catch (error) {
      log.error('Errore durante il recupero del dispositivo', error, { id });
      throw new DatabaseError({
        message: 'Errore durante il recupero del dispositivo',
        cause: error instanceof Error ? error : undefined,
        operation: 'get',
        entity: 'DispositivoPuntoVendita',
      });
    }
  }

  async createDispositivo(data: CreateDispositivoPuntoVenditaDTO): Promise<DispositivoPuntoVenditaResponseDTO> {
    try {
      const created = await DispositivoPuntoVendita.create({
        nome_dispositivo: data.nome,
        descrizione_dispositivo: data.descrizione,
        id_puntivendita: data.id_puntivendita,
        secret_dispositivo: data.secret_dispositivo,
        id_display_context_dispositivo: data.id_display_context,
        is_active_dispositivo: data.is_active ?? true,
      });
      return this.mapDispositivoToDTO(created);
    } catch (error) {
      log.error('Errore durante la creazione del dispositivo', error, { id_puntivendita: data.id_puntivendita });
      throw new DatabaseError({
        message: 'Errore durante la creazione del dispositivo',
        cause: error instanceof Error ? error : undefined,
        operation: 'create',
        entity: 'DispositivoPuntoVendita',
      });
    }
  }

  async updateDispositivo(id: string, data: UpdateDispositivoPuntoVenditaDTO): Promise<DispositivoPuntoVenditaResponseDTO | null> {
    try {
      const device = await DispositivoPuntoVendita.findByPk(id);
      if (!device) return null;

      const updateData: Record<string, unknown> = {};
      if (data.nome !== undefined) updateData.nome_dispositivo = data.nome;
      if (data.descrizione !== undefined) updateData.descrizione_dispositivo = data.descrizione;
      if (data.id_display_context !== undefined) updateData.id_display_context_dispositivo = data.id_display_context;
      if (data.is_active !== undefined) updateData.is_active_dispositivo = data.is_active;

      await device.update(updateData);
      return this.mapDispositivoToDTO(device);
    } catch (error) {
      log.error('Errore durante l\'aggiornamento del dispositivo', error, { id });
      throw new DatabaseError({
        message: 'Errore durante l\'aggiornamento del dispositivo',
        cause: error instanceof Error ? error : undefined,
        operation: 'update',
        entity: 'DispositivoPuntoVendita',
      });
    }
  }

  async deleteDispositivo(id: string): Promise<boolean> {
    try {
      const device = await DispositivoPuntoVendita.findByPk(id);
      if (!device) return false;
      await device.destroy();
      return true;
    } catch (error) {
      log.error('Errore durante l\'eliminazione del dispositivo', error, { id });
      throw new DatabaseError({
        message: 'Errore durante l\'eliminazione del dispositivo',
        cause: error instanceof Error ? error : undefined,
        operation: 'delete',
        entity: 'DispositivoPuntoVendita',
      });
    }
  }

  async getDispositivoByToken(token: string): Promise<DispositivoPuntoVenditaResponseDTO | null> {
    try {
      const device = await DispositivoPuntoVendita.findOne({
        where: { token_display_dispositivo: token },
        include: [
          { model: DisplayContextPuntoVendita, as: 'displayContext', required: false },
          { model: PuntoVendita, as: 'puntoVendita', required: false },
        ],
      });
      if (!device) return null;
      return this.mapDispositivoToDTO(device);
    } catch (error) {
      log.error('Errore durante il recupero del dispositivo tramite token', error, { token: token.slice(0, 8) });
      throw new DatabaseError({
        message: 'Errore durante il recupero del dispositivo tramite token',
        cause: error instanceof Error ? error : undefined,
        operation: 'get',
        entity: 'DispositivoPuntoVendita',
      });
    }
  }

  async deviceHeartbeat(token: string, metadata?: DispositivoMetadata): Promise<boolean> {
    try {
      const device = await DispositivoPuntoVendita.findOne({
        where: { token_display_dispositivo: token },
      });
      if (!device) return false;

      const updateData: Record<string, unknown> = {
        last_seen_at_dispositivo: new Date(),
      };
      if (metadata) {
        updateData.metadata_dispositivo = metadata;
      }

      await device.update(updateData);
      return true;
    } catch (error) {
      log.error('Errore durante l\'aggiornamento del heartbeat del dispositivo', error, { token: token.slice(0, 8) });
      return false;
    }
  }

  async regenerateDeviceToken(id: string): Promise<string | null> {
    try {
      const device = await DispositivoPuntoVendita.findByPk(id);
      if (!device) return null;
      return await device.regenerateDisplayToken();
    } catch (error) {
      log.error('Errore durante la rigenerazione del token del dispositivo', error, { id });
      throw new DatabaseError({
        message: 'Errore durante la rigenerazione del token',
        cause: error instanceof Error ? error : undefined,
        operation: 'update',
        entity: 'DispositivoPuntoVendita',
      });
    }
  }

  private mapDispositivoToDTO(device: DispositivoPuntoVendita): DispositivoPuntoVenditaResponseDTO {
    const pvData = (device as any).puntoVendita;
    const ctxData = (device as any).displayContext;

    let displayContextDTO: DisplayContextResponseDTO | undefined;
    if (ctxData) {
      displayContextDTO = {
        id: ctxData.id_display_context,
        nome: ctxData.nome_display_context,
        descrizione: ctxData.descrizione_display_context,
        filters: ctxData.filters_display_context,
        endpoint_type: ctxData.endpoint_type_display_context,
        auto_scroll: ctxData.auto_scroll_display_context,
        scroll_speed: ctxData.scroll_speed_display_context,
        show_indicators: ctxData.show_indicators_display_context,
        show_nav_buttons: ctxData.show_nav_buttons_display_context,
        render_type: ctxData.render_type_display_context,
        meta_options: ctxData.meta_options_display_context,
        id_gdo: ctxData.id_gdo_display_context,
        id_puntivendita: ctxData.id_puntivendita_display_context,
        is_active: ctxData.is_active_display_context,
        createdat: ctxData.createdat,
        updatedat: ctxData.updatedat,
      };
    }

    return {
      id: device.id_dispositivo,
      nome: device.nome_dispositivo,
      descrizione: device.descrizione_dispositivo,
      is_active: device.is_active_dispositivo,
      last_seen_at: device.last_seen_at_dispositivo,
      metadata: device.metadata_dispositivo,
      id_puntivendita: device.id_puntivendita,
      id_display_context: device.id_display_context_dispositivo,
      token_display: device.token_display_dispositivo,
      display_url: device.getDisplayUrl(''),
      is_online: device.isOnline(5),
      createdat: device.createdat!,
      updatedat: device.updatedat!,
      puntoVendita: pvData ? {
        id: pvData.id_puntivendita,
        nome: pvData.nome_puntivendita,
        citta: pvData.citta_puntivendita,
      } : undefined,
      displayContext: displayContextDTO,
    };
  }

  /* ======================================================
   * PUNTI VENDITA
   * ====================================================== */

  private async _fetchMappingData(pvList: PuntiVenditaAttributes[]): Promise<{
    comboMap: Map<string, CombinazioneCanaleAreaAttributes>;
    canaleMap: Map<string, CanaleResponseDTO>;
    areaMap: Map<string, AreaResponseDTO>;
  }> {
    const comboIds = [...new Set(
      pvList.map(pv => pv.id_combinazione_canale_area_puntivendita).filter(Boolean)
    )];

    if (comboIds.length === 0) {
      return { comboMap: new Map(), canaleMap: new Map(), areaMap: new Map() };
    }

    const combinazioni = await CombinazioneCanaleArea.findAll({
      where: { id_combinazione_canale_area: { [Op.in]: comboIds } },
    });

    const canaleIds = [...new Set(combinazioni.map(c => c.id_canale_combinazione_canale_area).filter(Boolean))];
    const areaIds = [...new Set(combinazioni.map(c => c.id_area_combinazione_canale_area).filter(Boolean))];

    const [canali, aree] = await Promise.all([
      canaleIds.length ? Canale.findAll({ where: { id_canali: { [Op.in]: canaleIds } } }) : Promise.resolve([]),
      areaIds.length ? Area.findAll({ where: { id_aree: { [Op.in]: areaIds } } }) : Promise.resolve([]),
    ]);

    return {
      comboMap: new Map(combinazioni.map(c => [c.id_combinazione_canale_area, c as CombinazioneCanaleAreaAttributes])),
      canaleMap: new Map(canali.map(c => [c.id_canali as string, {
        id: c.id_canali, codice: c.codice_canali, nome: c.nome_canali,
        id_gdo: c.id_gdo_canali, updatedat: c.updatedat,
      } as CanaleResponseDTO])),
      areaMap: new Map(aree.map(a => [a.id_aree as string, {
        id: a.id_aree, codice: a.codice_aree, nome: a.nome_aree,
        id_gdo: a.id_gdo_aree, updatedat: a.updatedat,
      } as AreaResponseDTO])),
    };
  }

  private mapToDTO(
    pv: PuntiVenditaAttributes,
    comboMap: Map<string, CombinazioneCanaleAreaAttributes>,
    canaleMap: Map<string, CanaleResponseDTO>,
    areaMap: Map<string, AreaResponseDTO>,
  ): PuntoVenditaResponseDTO {
    const combo = comboMap.get(pv.id_combinazione_canale_area_puntivendita ?? '');
    if (!combo) {
      throw new NotFoundError({
        message: `Combinazione canale-area non trovata per il punto vendita ${pv.id_puntivendita}`,
        entityType: 'CombinazioneCanaleArea',
        entityId: pv.id_combinazione_canale_area_puntivendita,
      });
    }

    const canale = canaleMap.get(combo.id_canale_combinazione_canale_area ?? '');
    const area = areaMap.get(combo.id_area_combinazione_canale_area ?? '');

    const lat = toNumberOrNull(pv.lat_puntivendita);
    const lon = toNumberOrNull(pv.lon_puntivendita);

    return {
      id: pv.id_puntivendita || '',
      nome: pv.nome_puntivendita,
      nome_display: pv.nome_puntivendita,
      citta: pv.citta_puntivendita,
      cap: pv.cap_puntivendita,
      indirizzo: pv.indirizzo_puntivendita,
      provincia: pv.provincia_puntivendita,
      regione: pv.regione_puntivendita,
      telefono: pv.telefono_puntivendita,
      id_combinazione_canale_area: pv.id_combinazione_canale_area_puntivendita,
      id_gdo: pv.id_gdo_puntivendita || '',
      indirizzo_completo: pv.indirizzo_puntivendita,
      coordinate: {
        lat: lat || 0,
        lon: lon || 0
      },
      has_coordinate: lat !== null && lon !== null,
      createdat: pv.createdat ?? new Date(),
      updatedat: pv.updatedat ?? new Date(),
      sigla_combinazione: `${canale?.codice ?? ''}${area?.codice ?? ''}`
    };
  }
  async getAllPuntiVendita(): Promise<PuntoVenditaResponseDTO[]> {
    try {
      const puntiVendita = await this.puntoVenditaRepository.findAll();
      const { comboMap, canaleMap, areaMap } = await this._fetchMappingData(puntiVendita as PuntiVenditaAttributes[]);
      return puntiVendita.map((pv: PuntiVenditaAttributes) => this.mapToDTO(pv, comboMap, canaleMap, areaMap));
    } catch (error) {
      log.error('Errore durante il recupero di tutti i punti vendita', error);
      throw new DatabaseError({
        message: 'Errore durante il recupero di tutti i punti vendita',
        cause: error instanceof Error ? error : undefined,
        operation: 'get',
        entity: 'PuntoVendita',
      });
    }
  }

  async getPuntoVenditaById(id: string): Promise<PuntoVenditaResponseDTO | null> {
    try {
      const pv = await this.puntoVenditaRepository.findById(id) as PuntiVenditaAttributes | null;
      if (!pv) return null;

      const [{ comboMap, canaleMap, areaMap }, utentiCollegati] = await Promise.all([
        this._fetchMappingData([pv]),
        PuntoVenditaUtenti.count({ where: { idpuntivendita_puntivenditautenti: id } }),
      ]);

      return {
        ...this.mapToDTO(pv, comboMap, canaleMap, areaMap),
        numero_utenti_collegati: utentiCollegati,
      };
    } catch (error) {
      log.error('Errore durante il recupero del punto vendita', error, { id });
      throw new DatabaseError({
        message: 'Errore durante il recupero del punto vendita',
        cause: error instanceof Error ? error : undefined,
        operation: 'get',
        entity: 'PuntoVendita',
      });
    }
  }

  async createPuntoVendita(data: Partial<CreatePuntoVenditaDTO>): Promise<PuntoVenditaResponseDTO> {
    try {
      // il dato è questo
      const dataToCreate: PuntiVenditaAttributes = {
        nome_puntivendita: data.nome ?? "",
        citta_puntivendita: data.citta ?? "",
        cap_puntivendita: data.cap ?? "",
        indirizzo_puntivendita: data.indirizzo ?? "",
        provincia_puntivendita: data.provincia ?? "",
        regione_puntivendita: data.regione ?? "",
        telefono_puntivendita: data.telefono ?? "",
        id_combinazione_canale_area_puntivendita: data.id_combinazione_canale_area ?? "",
        id_gdo_puntivendita: data.id_gdo ?? "",
        lat_puntivendita: (data as any).coordinate?.lat ?? null,
        lon_puntivendita: (data as any).coordinate?.lon ?? null,
        createdat: new Date(),
      }
      const created = await this.puntoVenditaRepository.create(dataToCreate);
      const result = await this.getPuntoVenditaById(created.id_puntivendita || '');
      if (!result) {
        throw new NotFoundError({
          message: `Punto vendita appena creato non trovato: ${created.id_puntivendita}`,
          entityType: 'PuntoVendita',
          entityId: created.id_puntivendita,
        });
      }
      return result;
    } catch (error) {
      log.error('Errore durante la creazione del punto vendita', error, { id_gdo: data.id_gdo });
      throw new DatabaseError({
        message: 'Errore durante la creazione del punto vendita',
        cause: error instanceof Error ? error : undefined,
        operation: 'create',
        entity: 'PuntoVendita',
      });
    }
  }

  async updatePuntoVendita(id: string, data: Partial<CreatePuntoVenditaDTO>): Promise<PuntoVenditaResponseDTO | null> {
    try {
      const puntoVendita = await this.puntoVenditaRepository.findById(id);
      if (!puntoVendita) return null;

      const updatePayload: Partial<PuntiVenditaAttributes> = {};

      if (data.nome !== undefined) updatePayload.nome_puntivendita = data.nome;
      if (data.citta !== undefined) updatePayload.citta_puntivendita = data.citta;
      if (data.cap !== undefined) updatePayload.cap_puntivendita = data.cap;
      if (data.indirizzo !== undefined) updatePayload.indirizzo_puntivendita = data.indirizzo;
      if (data.id_combinazione_canale_area !== undefined) {
        updatePayload.id_combinazione_canale_area_puntivendita = data.id_combinazione_canale_area;
      }
      if (data.id_gdo !== undefined) updatePayload.id_gdo_puntivendita = data.id_gdo;
      if (data.provincia !== undefined) updatePayload.provincia_puntivendita = data.provincia;
      if (data.regione !== undefined) updatePayload.regione_puntivendita = data.regione;
      if (data.telefono !== undefined) updatePayload.telefono_puntivendita = data.telefono;

      const ragioneSocialeValue = (data as any).ragioneSociale ?? data.ragionesociale;
      if (ragioneSocialeValue !== undefined) {
        updatePayload.ragionesociale_puntivendita = ragioneSocialeValue;
      }

      const coordinate = (data as any).coordinate;
      if (coordinate?.lat !== undefined) updatePayload.lat_puntivendita = coordinate.lat;
      if (coordinate?.lon !== undefined) updatePayload.lon_puntivendita = coordinate.lon;
      if (data.lat !== undefined) updatePayload.lat_puntivendita = data.lat;
      if (data.lon !== undefined) updatePayload.lon_puntivendita = data.lon;

      if (Object.keys(updatePayload).length === 0) {
        return await this.getPuntoVenditaById(id);
      }

      await this.puntoVenditaRepository.update(id, updatePayload);
      return await this.getPuntoVenditaById(id);
    } catch (error) {
      log.error('Errore durante l\'aggiornamento del punto vendita', error, { id });
      throw new DatabaseError({
        message: 'Errore durante l\'aggiornamento del punto vendita',
        cause: error instanceof Error ? error : undefined,
        operation: 'update',
        entity: 'PuntoVendita',
      });
    }
  }

  async deletePuntoVendita(id: string): Promise<boolean> {
    try {
      return await this.puntoVenditaRepository.delete(id);
    } catch (error) {
      log.error('Errore durante l\'eliminazione del punto vendita', error, { id });
      throw new DatabaseError({
        message: 'Errore durante l\'eliminazione del punto vendita',
        cause: error instanceof Error ? error : undefined,
        operation: 'delete',
        entity: 'PuntoVendita',
      });
    }
  }

  async getPuntiVenditaByGDOId(gdoId: string): Promise<PuntoVenditaResponseDTO[]> {
    try {
      const puntiVendita = await this.puntoVenditaRepository.findByGdoId(gdoId);

      return puntiVendita.map((pv: PuntiVenditaAttributes) => ({
        id: pv.id_puntivendita || '',
        nome: pv.nome_puntivendita,
        nome_display: pv.nome_puntivendita,
        citta: pv.citta_puntivendita,
        cap: pv.cap_puntivendita,
        indirizzo: pv.indirizzo_puntivendita,
        provincia: pv.provincia_puntivendita,
        regione: pv.regione_puntivendita,
        telefono: pv.telefono_puntivendita,
        id_combinazione_canale_area: pv.id_combinazione_canale_area_puntivendita,
        id_gdo: pv.id_gdo_puntivendita || '',
        indirizzo_completo: pv.indirizzo_puntivendita,
        coordinate: {
          lat: pv.lat_puntivendita ?? null,
          lon: pv.lon_puntivendita ?? null
        },
        has_coordinate: !!(pv.lat_puntivendita && pv.lon_puntivendita),
        createdat: pv.createdat || new Date(),
        updatedat: pv.updatedat || new Date()
      }));
    } catch (error) {
      log.error('Errore durante il recupero dei punti vendita per GDO', error, { gdoId });
      throw new DatabaseError({
        message: 'Errore durante il recupero dei punti vendita per GDO',
        cause: error instanceof Error ? error : undefined,
        operation: 'get',
        entity: 'PuntoVendita',
      });
    }
  }

  async getPuntiVenditaByAreaId(areaId: string): Promise<PuntoVenditaResponseDTO[]> {
    try {
      const puntiVendita = await this.puntoVenditaRepository.findByAreaId(areaId);
      const { comboMap, canaleMap, areaMap } = await this._fetchMappingData(puntiVendita as PuntiVenditaAttributes[]);
      return puntiVendita.map((pv: PuntiVenditaAttributes) => this.mapToDTO(pv, comboMap, canaleMap, areaMap));
    } catch (error) {
      log.error('Errore durante il recupero dei punti vendita per area', error, { areaId });
      throw new DatabaseError({
        message: 'Errore durante il recupero dei punti vendita per area',
        cause: error instanceof Error ? error : undefined,
        operation: 'get',
        entity: 'PuntoVendita',
      });
    }
  }

  async getPuntiVenditaByRegione(regione: string): Promise<PuntoVenditaResponseDTO[]> {
    try {
      const puntiVendita = await this.puntoVenditaRepository.findByRegione(regione);
      const { comboMap, canaleMap, areaMap } = await this._fetchMappingData(puntiVendita as PuntiVenditaAttributes[]);
      return puntiVendita.map((pv: PuntiVenditaAttributes) => this.mapToDTO(pv, comboMap, canaleMap, areaMap));
    } catch (error) {
      log.error('Errore durante il recupero dei punti vendita per regione', error, { regione });
      throw new DatabaseError({
        message: 'Errore durante il recupero dei punti vendita per regione',
        cause: error instanceof Error ? error : undefined,
        operation: 'get',
        entity: 'PuntoVendita',
      });
    }
  }

  async getPuntiVenditaByProvincia(provincia: string): Promise<PuntoVenditaResponseDTO[]> {
    try {
      const puntiVendita = await this.puntoVenditaRepository.findByProvincia(provincia);
      const { comboMap, canaleMap, areaMap } = await this._fetchMappingData(puntiVendita as PuntiVenditaAttributes[]);
      return puntiVendita.map((pv: PuntiVenditaAttributes) => this.mapToDTO(pv, comboMap, canaleMap, areaMap));
    } catch (error) {
      log.error('Errore durante il recupero dei punti vendita per provincia', error, { provincia });
      throw new DatabaseError({
        message: 'Errore durante il recupero dei punti vendita per provincia',
        cause: error instanceof Error ? error : undefined,
        operation: 'get',
        entity: 'PuntoVendita',
      });
    }
  }

  async getPuntiVenditaByCitta(citta: string): Promise<PuntoVenditaResponseDTO[]> {
    try {
      const puntiVendita = await this.puntoVenditaRepository.findByCitta(citta);
      const { comboMap, canaleMap, areaMap } = await this._fetchMappingData(puntiVendita as PuntiVenditaAttributes[]);
      return puntiVendita.map((pv: PuntiVenditaAttributes) => this.mapToDTO(pv, comboMap, canaleMap, areaMap));
    } catch (error) {
      log.error('Errore durante il recupero dei punti vendita per città', error, { citta });
      throw new DatabaseError({
        message: 'Errore durante il recupero dei punti vendita per città',
        cause: error instanceof Error ? error : undefined,
        operation: 'get',
        entity: 'PuntoVendita',
      });
    }
  }

  async searchPuntiVendita(query: string): Promise<PuntoVenditaResponseDTO[]> {
    try {
      const puntiVendita = await this.puntoVenditaRepository.search(query);
      const { comboMap, canaleMap, areaMap } = await this._fetchMappingData(puntiVendita as PuntiVenditaAttributes[]);
      return puntiVendita.map((pv: PuntiVenditaAttributes) => this.mapToDTO(pv, comboMap, canaleMap, areaMap));
    } catch (error) {
      log.error('Errore durante la ricerca dei punti vendita', error, { query });
      throw new DatabaseError({
        message: 'Errore durante la ricerca dei punti vendita',
        cause: error instanceof Error ? error : undefined,
        operation: 'search',
        entity: 'PuntoVendita',
      });
    }
  }

  async getPuntiVenditaByFilters(filters: {
    gdoId?: string;
    areaId?: string;
    canaleId?: string;
    regione?: string;
    provincia?: string;
    citta?: string;
  }): Promise<PuntoVenditaResponseDTO[]> {
    try {
      const puntiVendita = await this.puntoVenditaRepository.findByFilters(filters);
      const { comboMap, canaleMap, areaMap } = await this._fetchMappingData(puntiVendita as PuntiVenditaAttributes[]);
      return puntiVendita.map((pv: PuntiVenditaAttributes) => this.mapToDTO(pv, comboMap, canaleMap, areaMap));
    } catch (error) {
      log.error('Errore durante il recupero dei punti vendita con filtri', error, { filters });
      throw new DatabaseError({
        message: 'Errore durante il recupero dei punti vendita con filtri',
        cause: error instanceof Error ? error : undefined,
        operation: 'get',
        entity: 'PuntoVendita',
      });
    }
  }

  async getAllPuntiVenditaFromIdGDO(idGDO: string): Promise<PuntoVenditaResponseDTO[]> {
    try {
      const puntiVendita = await this.puntoVenditaRepository.findByGdoId(idGDO);
      const { comboMap, canaleMap, areaMap } = await this._fetchMappingData(puntiVendita as PuntiVenditaAttributes[]);
      return puntiVendita.map((pv: PuntiVenditaAttributes) => this.mapToDTO(pv, comboMap, canaleMap, areaMap));
    } catch (error) {
      log.error('Errore durante il recupero di tutti i punti vendita per GDO', error, { idGDO });
      throw new DatabaseError({
        message: 'Errore durante il recupero dei punti vendita per GDO',
        cause: error instanceof Error ? error : undefined,
        operation: 'get',
        entity: 'PuntoVendita',
      });
    }
  }

  async getAllPuntiVenditaPaginated(params: {
    idGDO: string;
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: 'nome' | 'citta' | 'cap' | 'createdat';
    sortDirection?: 'asc' | 'desc';
    hasCoordinate?: boolean;
    idCombinazioneCanaleArea?: string;
  }): Promise<PuntiVenditaPaginatedResponseDTO> {
    try {
      const {
        idGDO,
        page = 1,
        pageSize = 12,
        search = '',
        sortBy = 'nome',
        sortDirection = 'asc',
        hasCoordinate,
        idCombinazioneCanaleArea
      } = params;
      const { rows, count } = await this.puntoVenditaRepository.findPaginatedByGdo({
        idGDO,
        page,
        pageSize,
        search,
        sortBy,
        sortDirection,
        hasCoordinate,
        idCombinazioneCanaleArea,
      });

      const { comboMap, canaleMap, areaMap } = await this._fetchMappingData(rows as PuntiVenditaAttributes[]);
      const puntiVendita = rows.map((pv: PuntiVenditaAttributes) => this.mapToDTO(pv, comboMap, canaleMap, areaMap));

      const totalPages = Math.ceil(count / pageSize);

      return {
        punti_vendita: puntiVendita,
        total: count,
        page: page,
        limit: pageSize,
        total_pages: totalPages
      };
    } catch (error) {
      log.error('Errore durante il recupero paginato dei punti vendita per GDO', error, { idGDO: params.idGDO });
      throw new DatabaseError({
        message: 'Errore durante il recupero paginato dei punti vendita',
        cause: error instanceof Error ? error : undefined,
        operation: 'get',
        entity: 'PuntoVendita',
      });
    }
  }
}
function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}
