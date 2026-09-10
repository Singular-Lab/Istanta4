import { Request as ExpressRequest } from 'express';
import { STATO_PROMO } from '../../../lib/enums';
import { DataWebPliant, IndesignPluginExport, MenaboLayoutDivisioneSalvata, MenaboLayoutSalvato, NuovaPromoPerDashboard, SaveMenaboLayoutRequest } from '../../../lib/types';
import { CreatePromoDTO, PromoResponseDTO, UpdatePromoDTO } from '../dto';
export interface IPromoService {
  // Basic CRUD operations
  createPromo(data: Partial<CreatePromoDTO>): Promise<PromoResponseDTO>;
  getPromoById(id: string): Promise<PromoResponseDTO>;
  updatePromo(id: string, data: Partial<UpdatePromoDTO>): Promise<PromoResponseDTO>;
  deletePromo(id: string): Promise<boolean>;
  getAllPromo(): Promise<PromoResponseDTO[]>;
  getCurrentPromoCount(): Promise<number>;
  getAllPromoStorico(): Promise<PromoResponseDTO[]>;
  getAllPromoTimeline(): Promise<PromoResponseDTO[]>;

  // Promo management
  getAllPromoInCorso(req: ExpressRequest): Promise<NuovaPromoPerDashboard[]>;
  deleteNonPermanentePromo(id: string): Promise<boolean>;
  riportaInLavorazionePromo(id: string): Promise<boolean>;
  updateStatoPromo(idPromo: string, stato: STATO_PROMO): Promise<boolean>;
  inizioNuovaLavorazione(data: {
    titolo: string,
    dataDiScadenza: string,
    dataDiInizio: string,
    dataDiFine: string,
    offsetVisibilita: number,
    context: any
  }, idGDO: string, req: ExpressRequest): Promise<PromoResponseDTO>;
  getContestoPerNuovaLavorazione(req: ExpressRequest): Promise<any>;
  get_contesto_per_importazione(req: ExpressRequest): Promise<any>;
  creaInizioLavorazione(data: CreatePromoDTO): Promise<PromoResponseDTO>;

  // Filtered / paginated
  getAllPromoFiltered(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    stato?: string;
    validitaDal?: string;
    validitaAl?: string;
    validitaAlFrom?: string;
    validitaAlTo?: string;
    excludeStato?: string;
    sortBy?: 'nome' | 'validita_dal' | 'validita_al' | 'stato';
    sortDirection?: 'asc' | 'desc';
  }): Promise<{
    promos: PromoResponseDTO[];
    totalItems: number;
    currentPage: number;
    totalPages: number;
    pageSize: number;
  }>;

  // Utility operations
  prendiPromoDaDB(idPromo: string): Promise<PromoResponseDTO>;
  getPromozioniInCorsoPerDashboard(): Promise<{
    idKit: string;
    idCanale: string;
    nomeCanale: string;
    idArea: string;
    nomeArea: string;
    disattivo_mancanza_referenze: boolean;
    disattivo_mancanza_workspace: boolean;
    workspaceApplicabili: DataWebPliant[];
    messaggio: string;
    data_inizio_promo_corrente: string;
    data_fine_promo_corrente: string;
  }[]>;
  testNotifica(req: ExpressRequest): Promise<void>;
  getPromoByNome(nome: string): Promise<PromoResponseDTO>
  getDatoPerMenabo(idPromo: string, canale?: string): Promise<any>;
  getMenaboLayout(idPromo: string): Promise<MenaboLayoutSalvato | null>;
  saveMenaboLayout(idPromo: string, payload: SaveMenaboLayoutRequest): Promise<MenaboLayoutSalvato>;
  generateMenaboExcel(layout: MenaboLayoutDivisioneSalvata): Promise<Buffer>;
  generateIndesignPluginJson(layout: MenaboLayoutDivisioneSalvata): Promise<IndesignPluginExport>;
}
