import type {
    CategoryScoreboardTimeline,
    ReportOptionDTO,
    SavedPromoScoreboard,
    TracciatoQueryRequest,
    TracciatoQueryResult,
    TracciatoReport,
} from '../../../lib/types';

export interface IScoreboardService {
    getAllPromoScoreboards(): Promise<SavedPromoScoreboard[]>;
    getCategoryScoreboardTimeline(settoriNomi: string[]): Promise<CategoryScoreboardTimeline>;
    getPromoScoreboard(idPromo: string): Promise<TracciatoReport | null>;
    calcolaPromoScoreboard(idPromo: string): Promise<TracciatoReport>;
    calcolaMultiPromoScoreboard(
        promoIds: string[],
        confrontoFilter?: { primarioIndex: number; secondarioIndex: number },
    ): Promise<TracciatoReport>;
    calcolaQueryScoreboard(query: TracciatoQueryRequest): Promise<TracciatoQueryResult>;
    getReportOptions(): ReportOptionDTO[];
    calcolaQueryDaOpzione(optionId: string): Promise<TracciatoQueryResult>;
}
