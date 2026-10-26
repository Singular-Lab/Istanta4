import { Request } from "express";



export interface IIstantaService {
    getCombinazioniDaIstanta(promoId: string, req: Request): Promise<{
        esito: boolean;
        error: string;
        lista: Array<{
            guidIdArea: string;
            guidIdCanale: string;
            traccia: any[];
        }>;
    }>;
    downloadKitsByTipoDiExport(data: {
        guidIdTipoDiExport: string;
        guidIdKitRuntime: string;
        guidIdGdo: string;
        guidIdArea: string;
        guidIdCanale: string;
        data_da: Date;
        data_a: Date;
    }, req: Request): Promise<any>;
    getStatusImportazione(guidId: string, req: Request): Promise<any>;
}