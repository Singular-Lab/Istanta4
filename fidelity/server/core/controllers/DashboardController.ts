import { Request, Response } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import { gdoOperativaPerRichiesta, operaPerPiuGdo } from '../accessi/contestoAccesso';
import { BaseController } from '../base/BaseController';
import { DashboardFilterParams, IDashboardService } from '../interfaces/IDashboardService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { routeDeprecata } from '../middleware/routeDeprecata';
export { uploadZip } from '../config/multerConfig';

export class DashboardController extends BaseController {
    constructor(private dashboardService: IDashboardService) {
        super('/api/dashboard');
    }

    protected setupRoutes(): void {
        // Panoramica e storico dei volantini: consultazione, con "volantini.visualizza". Le pagine
        // leggono ora /api/consultazione/volantini (solo pubblicati della GDO): queste si osservano
        // per 30 giorni prima di toglierle (routeSenzaChiamanti.ts)
        const volantini = [authMiddleware, permissionGuard('volantini.visualizza'), routeDeprecata];
        this.router.get('/volantini-in-corso', ...volantini, this.getVolantiniInCorso.bind(this));
        // Lo stato delle lavorazioni e' produzione: solo con il permesso sui kit e per la GDO della
        // sessione. La panoramica non la chiama piu' (ora c'e' Avanzamento produzione).
        this.router.get(
            '/volantini-in-lavorazione',
            authMiddleware,
            permissionGuard('kit_runtime.visualizza'),
            routeDeprecata,
            this.getVolantiniInLavorazione.bind(this)
        );
        this.router.get('/volantini-pubblicati-in-lavorazione', ...volantini, this.getVolantiniPubblicatiInLavorazione.bind(this));
        this.router.get('/storico-volantini', ...volantini, this.getStoricoVolantini.bind(this));


        //Queste sono endpoint che dovranno eliminarsi.
        // this.router.post(
        //     '/pubblica-vol-pdf',
        //     // authMiddleware,
        //     uploadZip.single('file'),
        //     this.pubblicaVolPdf.bind(this)
        // );
    }


    // private async pubblicaVolPdf(req: Request, res: Response) {
    //     try {
    //         if (!req.file) {
    //             return this.sendResponse(res, HttpStatusCode.BAD_REQUEST, {
    //                 message: 'File ZIP mancante'
    //             });
    //         }
    //         //formdata per il tipo di export e id promo
    //         const { exportType, promoId } = req.body;

    //         if (!exportType || !promoId) {
    //             return this.sendResponse(res, HttpStatusCode.BAD_REQUEST, {
    //                 message: 'exportType o promoId mancanti'
    //             });
    //         }
    //         const zipPath = req.file.path;

    //         const DEST_DIR = path.join(
    //             process.cwd(),
    //             'uploads',
    //             'volantini-pdf',
    //             path.parse(req.file.originalname).name
    //         );

    //         fs.mkdirSync(DEST_DIR, { recursive: true });

    //         await fs
    //             .createReadStream(zipPath)
    //             .pipe(unzipper.Extract({ path: DEST_DIR }))
    //             .promise();


    //         await this.dashboardService.pubblicaVolPdf(req, exportType, promoId, DEST_DIR)
    //         fs.unlinkSync(zipPath);

    //         this.sendResponse(res, HttpStatusCode.OK, {
    //             message: 'Volantino pubblicato con successo',
    //             path: DEST_DIR
    //         });

    //     } catch (error) {
    //         this.handleError(res, error);
    //     }
    // }


    private extractFilters(req: Request): DashboardFilterParams {
        const { id_area, id_canale } = req.query;
        const filters: DashboardFilterParams = {};

        // Gestisce array di aree (può essere stringa singola o array)
        if (id_area) {
            if (Array.isArray(id_area)) {
                filters.id_area = id_area.filter((a): a is string => typeof a === 'string' && a.length > 0);
            } else if (typeof id_area === 'string' && id_area) {
                filters.id_area = [id_area];
            }
        }

        // Gestisce array di canali (può essere stringa singola o array)
        if (id_canale) {
            if (Array.isArray(id_canale)) {
                filters.id_canale = id_canale.filter((c): c is string => typeof c === 'string' && c.length > 0);
            } else if (typeof id_canale === 'string' && id_canale) {
                filters.id_canale = [id_canale];
            }
        }

        return filters;
    }

    private async getVolantiniInCorso(req: Request, res: Response): Promise<void> {
        try {
            const filters = this.extractFilters(req);
            const result = await this.dashboardService.getVolantiniInCorso(filters);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /** GDO della sessione; senza GDO chi lavora per piu' GDO vede tutto, gli altri niente. */
    private async getVolantiniInLavorazione(req: Request, res: Response): Promise<void> {
        try {
            const idGdo = await gdoOperativaPerRichiesta(req, res);
            if (!idGdo && !operaPerPiuGdo(req.session?.tipo_utente)) {
                this.sendResponse(res, HttpStatusCode.OK, { totale: 0, inAttesa: 0, kit: [] });
                return;
            }
            const filters = this.extractFilters(req);
            const result = await this.dashboardService.getVolantiniInLavorazione(filters, idGdo);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    private async getVolantiniPubblicatiInLavorazione(req: Request, res: Response): Promise<void> {
        try {
            const filters = this.extractFilters(req);
            const result = await this.dashboardService.getVolantiniPubblicatiInLavorazione(filters);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    private async getStoricoVolantini(req: Request, res: Response): Promise<void> {
        try {
            const filters = this.extractFilters(req);
            const limitParam = req.query.limit;
            const limit = limitParam ? parseInt(limitParam as string, 10) : undefined;
            const result = await this.dashboardService.getStoricoVolantini(filters, limit);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error) {
            this.handleError(res, error);
        }
    }
}
