import { Request } from 'express';
import { STATO_ORDINI_STAMPA } from '../../../lib/enums';
import { MergedGroupFile, OrdiniDiStampaAttributes, VirtualDirectory } from '../../../lib/types';
import { ContrattoTipografiaResponseDTO, type OrdiniDiStampaResponseDTO, type PromoResponseDTO } from '../dto';
import type { GroupingJobState } from '../services/OrdiniStampaService';

export interface IOrdiniStampaService {
    creaOrdineStampa(data: {
        idPromo: string;
    }): Promise<OrdiniDiStampaAttributes>;
    getOrdineById(id: string): Promise<OrdiniDiStampaAttributes>;
    updateStatoOrdineStampa(id: string, stato: STATO_ORDINI_STAMPA): Promise<OrdiniDiStampaAttributes>;

    deleteOrdineStampa(id: string): Promise<boolean>;

    getAllOrdiniDiStampaInCorso(): Promise<OrdiniDiStampaResponseDTO[]>;
    processFTPPopOlimpo(params: {
        req: Request;
        idOrdineDiStampa: string;
        kitIds: Record<string, boolean>;
        socketId: string;
    }): Promise<void>;
    getAllOrdiniDiStampaFiniti(): Promise<(OrdiniDiStampaResponseDTO & { nomePromo: string })[]>;
    creaOrdineDiStampa(data: OrdiniDiStampaAttributes): Promise<any>;
    getPromoDaIdStampa(id: string): Promise<PromoResponseDTO>;
    getContrattoTipografia(): Promise<ContrattoTipografiaResponseDTO>;

    getFileFromOlimpo(id: string): Promise<Buffer>;
    getOrdineDiStampaById(idOrdineDiStampa: string): Promise<any>;
    getOrdiniInviiByOrdineStampa(idOrdineDiStampa: string): Promise<any>;
    getExcelReportBuffer(idInvio: string): Promise<Buffer | null>;
    groupFilesByEquality(params: {
        req: Request;
        idOrdineDiStampa: string;
        socketId: string;
    }): Promise<void>;
    getGroupingStatus(idOrdineDiStampa: string): GroupingJobState | null;
    getVirtualDirectories(params: {
        req: Request;
        idOrdineDiStampa: string;
    }): Promise<VirtualDirectory[]>;
    mergeGroupFiles(params: {
        idOrdineDiStampa: string;
        groupId: string;
        nome: string;
        virtualDir: string;
        files: Array<{
            id_olimpo_cloud: string;
            nome: string;
            id_runtime: string;
            nome_kit: string;
            tipo_export: string;
            pages?: number;
            meta_olimpo_cloud?: any;
        }>;
    }): Promise<any>;
    getMergedFilesByOrdine(idOrdineDiStampa: string): Promise<MergedGroupFile[]>;
    deleteMergedGroup(params: {
        idOrdineDiStampa: string;
        mergedFileId: string;
    }): Promise<boolean>;
}
