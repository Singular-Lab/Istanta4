import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { Colorize } from '../../../lib/Colorize';
import { HttpStatusCode } from '../../../lib/enums';
import { BaseController } from '../base/BaseController';
import { ITraduzioneService } from '../interfaces/ITraduzioneService';
import { log } from '../logger';
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
            const language = req.query.lng as string;
            const namespace = req.query.ns as string;

            if (!language || !namespace) {
                res.status(HttpStatusCode.BAD_REQUEST).json({
                    message: "Lingua o namespace non specificati"
                });
                return;
            }

            // Read the translation file directly instead of using the service
            const __dirname = path.resolve();
            const filePath = path.join(__dirname, `public/locales/${language}/${namespace}.json`);

            // Check if file exists before trying to read it
            if (!fs.existsSync(filePath)) {
                // If file doesn't exist, return empty object instead of error
                log.info(Colorize.yellow(`File di traduzione non trovato: ${filePath}`));
                res.status(HttpStatusCode.OK).json({});
                return;
            }

            const traduzioni = await fs.promises.readFile(filePath, 'utf8');

            // Parse the JSON string into an object before sending
            const traductionObject = JSON.parse(traduzioni);
            res.status(HttpStatusCode.OK).json(traductionObject);
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
