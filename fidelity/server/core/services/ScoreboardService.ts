import type {
    CategoryScoreboardTimeline,
    ReportOptionDTO,
    SavedPromoScoreboard,
    TracciatoQueryRequest,
    TracciatoQueryResult,
    TracciatoReport,
} from '../../../lib/types';
import type { IScoreboardService } from '../interfaces/IScoreboardService';
import type { ITracciatoService } from '../interfaces/ITracciatoService';

export class ScoreboardService implements IScoreboardService {
    constructor(private tracciatoService: ITracciatoService) {}

    getAllPromoScoreboards(): Promise<SavedPromoScoreboard[]> {
        return this.tracciatoService.getAllPromoScoreboards();
    }

    getCategoryScoreboardTimeline(settoriNomi: string[]): Promise<CategoryScoreboardTimeline> {
        return this.tracciatoService.getCategoryScoreboardTimeline(settoriNomi);
    }

    getPromoScoreboard(idPromo: string): Promise<TracciatoReport | null> {
        return this.tracciatoService.getPromoScoreboard(idPromo);
    }

    calcolaPromoScoreboard(idPromo: string): Promise<TracciatoReport> {
        return this.tracciatoService.calcolaPromoScoreboard(idPromo);
    }

    calcolaMultiPromoScoreboard(
        promoIds: string[],
        confrontoFilter?: { primarioIndex: number; secondarioIndex: number },
    ): Promise<TracciatoReport> {
        return this.tracciatoService.calcolaMultiPromoScoreboard(promoIds, confrontoFilter);
    }

    calcolaQueryScoreboard(query: TracciatoQueryRequest): Promise<TracciatoQueryResult> {
        return this.tracciatoService.calcolaQueryScoreboard(query);
    }

    getReportOptions(): ReportOptionDTO[] {
        return this.tracciatoService.getReportOptions();
    }

    calcolaQueryDaOpzione(optionId: string): Promise<TracciatoQueryResult> {
        return this.tracciatoService.calcolaQueryDaOpzione(optionId);
    }
}
