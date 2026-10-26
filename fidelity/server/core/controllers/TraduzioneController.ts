import { Request, Response } from 'express';
import { Colorize } from '../../../lib/Colorize';
import { HttpStatusCode } from '../../../lib/enums';
import { BaseController } from '../base/BaseController';
import { ITraduzioneService } from '../interfaces/ITraduzioneService';
import { log } from '../logger';

// Codici lingua e namespace di i18next: es. it, it-IT, translation.
const isSafePathSegment = (value: unknown): value is string =>
    typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value);

export class TraduzioneController extends BaseController {
    constructor(private traduzioneService: ITraduzioneService) {
        super('/api/t');
    }
    protected setupRoutes(): void {
        this.initializeRoutes();
    }
    public initializeRoutes(): void {
        this.router.get('/', this.getTraduzioni.bind(this));
    }

    private async getTraduzioni(req: Request, res: Response): Promise<void> {
        try {
            const language = req.query.lng;
            const namespace = req.query.ns;

            if (!language || !namespace) {
                res.status(HttpStatusCode.BAD_REQUEST).json({
                    message: "Lingua o namespace non specificati"
                });
                return;
            }

            // lng e ns finiscono nel path del file: niente separatori ne' '..'.
            if (!isSafePathSegment(language) || !isSafePathSegment(namespace)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({
                    message: "Lingua o namespace non validi"
                });
                return;
            }

            const traduzioni = await this.traduzioneService.getTraduzioni(language, namespace);
            res.status(HttpStatusCode.OK).json(traduzioni);
        } catch (error) {
            // Log the error but return empty translations instead of error
            if (error instanceof Error) {
                log.error(Colorize.yellow("Errore traduzioni:"), error);
            } else {
                log.error(Colorize.yellow("Errore traduzioni sconosciuto"), error);
            }

            // Return empty object instead of error
            res.status(HttpStatusCode.OK).json({});
        }
    }
}
