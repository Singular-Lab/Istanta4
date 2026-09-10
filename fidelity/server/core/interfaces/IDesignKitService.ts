import { Request } from 'express';
import { TIPO_KIT_DESIGN } from '../../../lib/enums';
import { DESIGN_KIT_MONGO, FileItemKit, OggettoTipiDiExport, RaccoglitoreKit } from '../../../lib/types';
import { AreaResponseDTO, CanaleResponseDTO, FormatiResponseDTO, PuntoVenditaResponseDTO, TipiDiExportResponseDTO } from '../dto';

export interface IDesignKitService {
  getAllKitDesign(): Promise<DESIGN_KIT_MONGO[]>;
  getAllKitDesignNoManuale(): Promise<any[]>;
  createCombinazioneDesign(data: { quantitaCopie: number; tipiDiExportInKit: OggettoTipiDiExport[]; guidFormato: string; guidPv: string; guidArea: string; guidCanale: string; titolo: string }): Promise<RaccoglitoreKit | null>;
  getAllCombinazioniDesignByIdTemplate(guidIdTemplate: string): Promise<DESIGN_KIT_MONGO[]>;
  getCombinazioneDesignById(id: string): Promise<DESIGN_KIT_MONGO | null>;
  updateCombinazioneDesign(data: any): Promise<DESIGN_KIT_MONGO>;
  get_all_template_combinazioni_design(): Promise<any[]>;
  get_info_creazione_combinazioni_design(): Promise<{
    tipiExport: TipiDiExportResponseDTO[];
    formati: FormatiResponseDTO[];
    canali: CanaleResponseDTO[];
    aree: AreaResponseDTO[];
    puntiVendita: PuntoVenditaResponseDTO[];
  }>;

  creaCombinazioniDesign(data: {
    titolo: string; guidCanale: string[]; guidArea: string[];
    guidPv?: string[]; guidFormato: string; quantitaCopie: number;
    declinazioni?: any[]; filtri?: any[]; tipo: TIPO_KIT_DESIGN;
    tipiDiExportInKit: OggettoTipiDiExport[]; files?: FileItemKit[];
  }, req: Request): Promise<any>;
}
