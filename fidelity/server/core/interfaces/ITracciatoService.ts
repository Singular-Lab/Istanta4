import type { CategoryScoreboardTimeline, ReportOptionDTO, SavedPromoScoreboard, SavedReportConfronto, SavedReportConfrontoSummary, TipoSchema, TracciatoQueryRequest, TracciatoQueryResult, TracciatoReport, TracciatiMomentoConfrontoResponseDTO, TracciatiMomentoResponseDTO, TracciatiSchemaConfronto, TracciatiSchemaItem, TracciatiSchemaResponseDTO } from '../../../lib/types';
import { CreateTracciatiDTO, TracciatiResponseDTO, UpdateTracciatiDTO } from '../dto';

export interface ITracciatoService {
    // CRUD Operations
    getAllTracciati(includeBlob?: boolean): Promise<TracciatiResponseDTO[]>;
    getTracciatoById(id: string, includeBlob?: boolean): Promise<TracciatiResponseDTO | null>;
    createTracciato(data: CreateTracciatiDTO): Promise<TracciatiResponseDTO>;
    updateTracciato(id: string, data: Partial<UpdateTracciatiDTO>): Promise<TracciatiResponseDTO | null>;
    deleteTracciato(id: string): Promise<boolean>;

    // Business Operations
    getTracciatiByPromoId(promoId: string, includeBlob?: boolean): Promise<TracciatiResponseDTO[]>;
    getTracciatiByDataCreazione(dataInizio: Date, dataFine: Date): Promise<TracciatiResponseDTO[]>;
    getTracciatiByDataModifica(dataInizio: Date, dataFine: Date): Promise<TracciatiResponseDTO[]>;
    searchTracciati(query: string): Promise<TracciatiResponseDTO[]>;
    getTracciatiByFilters(filters: {
        gdoId?: string;
        promoId?: string;
        stato?: string;
        tipo?: string;
        dataCreazioneInizio?: Date;
        dataCreazioneFine?: Date;
        dataModificaInizio?: Date;
        dataModificaFine?: Date;
    }): Promise<TracciatiResponseDTO[]>;
    processTracciato(id: string): Promise<TracciatiResponseDTO | null>;
    validateTracciato(id: string): Promise<{ isValid: boolean; errors: string[] }>;
    parseTracciatoById(id: string): Promise<{ sheets: { name: string; rows: (string | number | null)[][] }[] }>;
    getContestoPerConfronto(idPromo: string, req: Express.Request): Promise<{
        list: {
            content: { titolo: string; valore: string }[],
            idField: string,
            titoloField: string,
            tipoField: string,
            visible: boolean,
            esito: boolean,
            error: string | null
            nullable: boolean
        }[], esito: boolean, error: string | null
    }>;
    getReportsConfronto(idPromo: string): Promise<SavedReportConfrontoSummary[]>;
    getReportConfrontoById(id: string): Promise<SavedReportConfronto | null>;

    // Gestione Momenti
    getMomentiPerPromo(idPromo: string): Promise<TracciatiMomentoResponseDTO[]>;
    createMomento(idPromo: string, nome: string, snapshot?: boolean): Promise<TracciatiMomentoResponseDTO>;
    updateMomento(id: string, data: { nome?: string; tracciati_ids?: string[]; confronti_ids?: string[]; ordine?: number }): Promise<TracciatiMomentoResponseDTO | null>;
    deleteMomento(id: string): Promise<boolean>;
    calcolaRisultatoMomento(idMomento: string, req: Express.Request): Promise<TracciatiMomentoResponseDTO>;
    resetRisultatoMomento(idMomento: string): Promise<TracciatiMomentoResponseDTO | null>;
    createMomentoConfronto(primario: string, secondario: string): Promise<TracciatiMomentoConfrontoResponseDTO>;
    getMomentoConfrontoById(idConfronto: string): Promise<TracciatiMomentoConfrontoResponseDTO | null>;
    updateConfrontoMeta(idConfronto: string, data: { terremoto_degrado_massimo?: number | null }): Promise<TracciatiMomentoConfrontoResponseDTO | null>;
    calcolaRisultatoMomentoConfronto(idConfronto: string, req: Express.Request): Promise<TracciatiMomentoConfrontoResponseDTO>;
    resetRisultatoConfronto(idConfronto: string): Promise<TracciatiMomentoConfrontoResponseDTO | null>;
    getAllPromoScoreboards(): Promise<SavedPromoScoreboard[]>;
    getCategoryScoreboardTimeline(settoriNomi: string[]): Promise<CategoryScoreboardTimeline>;
    getPromoScoreboard(idPromo: string): Promise<TracciatoReport | null>;
    calcolaPromoScoreboard(idPromo: string): Promise<TracciatoReport>;
    calcolaMultiPromoScoreboard(promoIds: string[], confrontoFilter?: { primarioIndex: number; secondarioIndex: number }): Promise<TracciatoReport>;
    calcolaQueryScoreboard(query: TracciatoQueryRequest): Promise<TracciatoQueryResult>;
    getReportOptions(): ReportOptionDTO[];
    calcolaQueryDaOpzione(optionId: string): Promise<TracciatoQueryResult>;
    // Gestione Schemi
    getAllSchemi(): Promise<TracciatiSchemaResponseDTO[]>;
    createSchema(nome: string, tipo: TipoSchema[], items: TracciatiSchemaItem[], confronti?: TracciatiSchemaConfronto[]): Promise<TracciatiSchemaResponseDTO>;
    updateSchema(id: string, data: { nome?: string; tipo?: TipoSchema[]; items?: TracciatiSchemaItem[]; confronti?: TracciatiSchemaConfronto[] }): Promise<TracciatiSchemaResponseDTO | null>;
    deleteSchema(id: string): Promise<boolean>;
    applicaSchema(idSchema: string, idPromo: string): Promise<TracciatiMomentoResponseDTO[]>;
}
