import { Request, Response } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import type { IAgenziaLib } from '../agenzia_lib/types';
import { BaseController } from '../base/BaseController';
import type { IScoreboardService } from '../interfaces/IScoreboardService';
import type { IUserService } from '../interfaces/IUserService';
import { authMiddleware } from '../middleware/authMiddleware';
import { ServerUtils } from '../utils/ServerUtils';

export class ScoreboardController extends BaseController {
    constructor(
        private scoreboardService: IScoreboardService,
        private userService: IUserService,
        private agenziaLib: IAgenziaLib,
    ) {
        super('/api');
    }

    protected setupRoutes(): void {
        this.initializeRoutes();
    }

    public initializeRoutes(): void {
        this.router.get('/scoreboard', authMiddleware, this.getAllPromoScoreboards.bind(this));
        this.router.get('/scoreboard/category-timeline', authMiddleware, this.getCategoryScoreboardTimeline.bind(this));
        this.router.get('/scoreboard/promo/:idPromo', authMiddleware, this.getPromoScoreboard.bind(this));
        this.router.post('/scoreboard/promo/:idPromo', authMiddleware, this.calcolaPromoScoreboard.bind(this));
        this.router.post('/scoreboard/multi-promo', authMiddleware, this.calcolaMultiPromoScoreboard.bind(this));
        this.router.post('/scoreboard/query', authMiddleware, this.calcolaQueryScoreboard.bind(this));
        this.router.get('/scoreboard/report-options', authMiddleware, this.getReportOptions.bind(this));
        this.router.post('/scoreboard/opzione', authMiddleware, this.calcolaQueryDaOpzione.bind(this));
    }

    private async getAllPromoScoreboards(_req: Request, res: Response): Promise<void> {
        try {
            const scoreboards = await this.scoreboardService.getAllPromoScoreboards();
            res.status(HttpStatusCode.OK).json(scoreboards);
        } catch (error: unknown) {
            this.handleError(res, error);
        }
    }

    private async getCategoryScoreboardTimeline(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.session.id_utente as string;
            if (!ServerUtils.checkIfValueIsValid(userId)) {
                res.status(HttpStatusCode.UNAUTHORIZED).json({ message: 'Utente non autorizzato' });
                return;
            }

            const user = await this.userService.getUserById(userId);
            if (!user) {
                res.status(HttpStatusCode.NOT_FOUND).json({ message: 'Utente non trovato' });
                return;
            }

            const filters = this.agenziaLib.getGlobalFiltersForUser({
                tipo: user.tipo,
                meta: user.meta,
            });

            const timeline = await this.scoreboardService.getCategoryScoreboardTimeline(filters?.settoriNomi ?? []);
            res.status(HttpStatusCode.OK).json(timeline);
        } catch (error: unknown) {
            this.handleError(res, error);
        }
    }

    private async getPromoScoreboard(req: Request, res: Response): Promise<void> {
        try {
            const idPromo = req.params.idPromo;
            if (!ServerUtils.checkIfValueIsValid(idPromo)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'ID Promo non specificato' });
                return;
            }
            const report = await this.scoreboardService.getPromoScoreboard(idPromo);
            if (!report) {
                res.status(HttpStatusCode.NOT_FOUND).json({ message: 'Scoreboard non ancora calcolato per questa promo' });
                return;
            }
            res.status(HttpStatusCode.OK).json(report);
        } catch (error: unknown) {
            this.handleError(res, error);
        }
    }

    private async calcolaPromoScoreboard(req: Request, res: Response): Promise<void> {
        try {
            const idPromo = req.params.idPromo;
            if (!ServerUtils.checkIfValueIsValid(idPromo)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'ID Promo non specificato' });
                return;
            }
            const report = await this.scoreboardService.calcolaPromoScoreboard(idPromo);
            res.status(HttpStatusCode.OK).json(report);
        } catch (error: unknown) {
            this.handleError(res, error);
        }
    }

    private async calcolaMultiPromoScoreboard(req: Request, res: Response): Promise<void> {
        try {
            const { promoIds, confrontoFilter } = req.body ?? {};
            if (!Array.isArray(promoIds) || promoIds.length === 0) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'Specificare almeno una promo' });
                return;
            }
            const report = await this.scoreboardService.calcolaMultiPromoScoreboard(promoIds, confrontoFilter);
            res.status(HttpStatusCode.OK).json(report);
        } catch (error: unknown) {
            this.handleError(res, error);
        }
    }

    private async calcolaQueryScoreboard(req: Request, res: Response): Promise<void> {
        try {
            const query = req.body;
            if (!query?.promoFilter || !query?.momentoSelector || !query?.aggregazione) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'Query incompleta: promoFilter, momentoSelector e aggregazione sono obbligatori' });
                return;
            }
            const result = await this.scoreboardService.calcolaQueryScoreboard(query);
            res.status(HttpStatusCode.OK).json(result);
        } catch (error: unknown) {
            this.handleError(res, error);
        }
    }

    private getReportOptions(_req: Request, res: Response): void {
        try {
            const options = this.scoreboardService.getReportOptions();
            res.status(HttpStatusCode.OK).json(options);
        } catch (error: unknown) {
            this.handleError(res, error);
        }
    }

    private async calcolaQueryDaOpzione(req: Request, res: Response): Promise<void> {
        try {
            const { optionId } = req.body as { optionId?: string };
            if (!ServerUtils.checkIfValueIsValid(optionId)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'optionId non specificato' });
                return;
            }
            const result = await this.scoreboardService.calcolaQueryDaOpzione(optionId!);
            res.status(HttpStatusCode.OK).json(result);
        } catch (error: unknown) {
            this.handleError(res, error);
        }
    }
}
