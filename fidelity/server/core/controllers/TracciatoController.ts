import { Request, Response } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import { BaseController } from '../base/BaseController';
import { ITracciatoService } from '../interfaces/ITracciatoService';
import { authMiddleware } from '../middleware/authMiddleware';
import { ServerUtils } from '../utils/ServerUtils';

export class TracciatoController extends BaseController {
    constructor(private tracciatoService: ITracciatoService) {
        super('/api');
    }
    protected setupRoutes(): void {
        this.initializeRoutes();
    }
    public initializeRoutes(): void {
        this.router.get('/tracciati', authMiddleware, this.getAllTracciati.bind(this));
        this.router.get('/tracciati/promo/:idPromo', authMiddleware, this.getAllTracciatiPerPromo.bind(this));
        this.router.get('/tracciati/confronto/contesto', authMiddleware, this.getContestoConfronto.bind(this));
        this.router.get('/tracciati/confronto/reports', authMiddleware, this.getReportsConfronto.bind(this));
        this.router.get('/tracciati/confronto/reports/:id', authMiddleware, this.getReportConfrontoById.bind(this));
        // Momenti (prima delle route parametriche /:idTracciato)
        this.router.get('/tracciati/momenti/promo/:idPromo', authMiddleware, this.getMomentiPerPromo.bind(this));
        this.router.post('/tracciati/momenti', authMiddleware, this.createMomento.bind(this));
        this.router.put('/tracciati/momenti/:idMomento', authMiddleware, this.updateMomento.bind(this));
        this.router.delete('/tracciati/momenti/:idMomento', authMiddleware, this.deleteMomento.bind(this));
        this.router.post('/tracciati/momenti/:idMomento/risultato', authMiddleware, this.calcolaRisultatoMomento.bind(this));
        this.router.delete('/tracciati/momenti/:idMomento/risultato', authMiddleware, this.resetRisultatoMomento.bind(this));
        this.router.post('/tracciati/momenti/confronti', authMiddleware, this.createMomentoConfronto.bind(this));
        this.router.patch('/tracciati/momenti/confronti/:idConfronto', authMiddleware, this.updateConfrontoMeta.bind(this));
        this.router.get('/tracciati/momenti/confronti/:idConfronto', authMiddleware, this.getMomentoConfrontoById.bind(this));
        this.router.post('/tracciati/momenti/confronti/:idConfronto/risultato', authMiddleware, this.calcolaRisultatoMomentoConfronto.bind(this));
        this.router.delete('/tracciati/momenti/confronti/:idConfronto/risultato', authMiddleware, this.resetRisultatoConfronto.bind(this));
        // Schemi
        this.router.get('/tracciati/schemi', authMiddleware, this.getAllSchemi.bind(this));
        this.router.post('/tracciati/schemi', authMiddleware, this.createSchema.bind(this));
        this.router.put('/tracciati/schemi/:idSchema', authMiddleware, this.updateSchema.bind(this));
        this.router.delete('/tracciati/schemi/:idSchema', authMiddleware, this.deleteSchema.bind(this));
        this.router.post('/tracciati/schemi/:idSchema/applica', authMiddleware, this.applicaSchema.bind(this));
        this.router.get('/tracciati/:idTracciato/parse', authMiddleware, this.parseTracciatoById.bind(this));
        this.router.get('/tracciati/:idTracciato/download', authMiddleware, this.scaricaTracciato.bind(this));
        this.router.get('/tracciati/:idTracciato', authMiddleware, this.getTracciatoById.bind(this));
        this.router.delete('/tracciati/:idTracciato', authMiddleware, this.deleteTracciato.bind(this));
    }

    private async getAllTracciati(req: Request, res: Response): Promise<void> {
        try {
            const includeBlob = req.query.includeBlob === 'true';
            const tracciati = await this.tracciatoService.getAllTracciati(includeBlob);
            res.status(HttpStatusCode.OK).json(tracciati);
        } catch (error: any) {
            error = JSON.stringify(error);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                message: "Errore durante il recupero dei tracciati"
            });
        }
    }

    private async getAllTracciatiPerPromo(req: Request, res: Response): Promise<void> {
        try {
            const idPromo = req.params.idPromo;
            if (!ServerUtils.checkIfValueIsValid(idPromo)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({
                    message: "ID Promo non specificato"
                });
                return;
            }
            const includeBlob = req.query.includeBlob === 'true';
            const tracciati = await this.tracciatoService.getTracciatiByPromoId(idPromo, includeBlob);
            res.status(HttpStatusCode.OK).json(tracciati);
        } catch (error: any) {
            error = JSON.stringify(error);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                message: "Errore durante il recupero dei tracciati"
            });
        }
    }
    private async getTracciatoById(req: Request, res: Response): Promise<void> {
        try {
            const idTracciato = req.params.idTracciato;
            if (!ServerUtils.checkIfValueIsValid(idTracciato)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({
                    message: "ID Tracciato non specificato"
                });
                return;
            }
            const includeBlob = req.query.includeBlob === 'true';
            const tracciato = await this.tracciatoService.getTracciatoById(idTracciato, includeBlob);
            res.status(HttpStatusCode.OK).json(tracciato);
        } catch (error: any) {
            error = JSON.stringify(error);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                message: "Errore durante il recupero del tracciato"
            });
        }
    }

    private async parseTracciatoById(req: Request, res: Response): Promise<void> {
        try {
            const idTracciato = req.params.idTracciato;
            if (!ServerUtils.checkIfValueIsValid(idTracciato)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({
                    message: "ID Tracciato non specificato"
                });
                return;
            }
            const parsedData = await this.tracciatoService.parseTracciatoById(idTracciato);
            res.status(HttpStatusCode.OK).json(parsedData);
        } catch (error: any) {
            console.error('Error parsing tracciato:', error);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                message: "Errore durante il parsing del tracciato",
                error: error.message
            });
        }
    }

    private async scaricaTracciato(req: Request, res: Response): Promise<void> {
        try {
            const idTracciato = req.params.idTracciato;

            if (!ServerUtils.checkIfValueIsValid(idTracciato)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({
                    message: "ID Tracciato non specificato"
                });
                return;
            }

            const tracciato = await this.tracciatoService.getTracciatoById(idTracciato, true);
            if (!tracciato || !tracciato.blobfile) {
                res.status(HttpStatusCode.NOT_FOUND).json({
                    message: "Tracciato non trovato o file non disponibile"
                });
                return;
            }

            const fileBuffer = Buffer.from(tracciato.blobfile);
            const filename = tracciato.filename || 'tracciato.xlsx';
            const encodedFilename = encodeURIComponent(filename);

            res.setHeader('Content-Length', fileBuffer.length);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
            res.status(HttpStatusCode.OK).send(fileBuffer);
        } catch (error: any) {
            console.error('Error downloading tracciato:', error);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                message: "Errore durante il download del tracciato",
                error: error.message
            });
        }
    }

    private async deleteTracciato(req: Request, res: Response): Promise<void> {
        try {
            const idTracciato = req.params.idTracciato;

            if (!ServerUtils.checkIfValueIsValid(idTracciato)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({
                    message: "ID Tracciato non specificato"
                });
                return;
            }

            const deleted = await this.tracciatoService.deleteTracciato(idTracciato);

            if (!deleted) {
                res.status(HttpStatusCode.NOT_FOUND).json({
                    success: false,
                    message: "Tracciato non trovato"
                });
                return;
            }

            res.status(HttpStatusCode.OK).json({
                success: true,
                message: "Tracciato eliminato con successo"
            });
        } catch (error: any) {
            console.error('Error deleting tracciato:', error);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "Errore durante l'eliminazione del tracciato",
                error: error.message
            });
        }
    }

    private async getReportsConfronto(req: Request, res: Response): Promise<void> {
        try {
            const idPromo = req.query.idPromo as string | undefined;
            if (!ServerUtils.checkIfValueIsValid(idPromo)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: "ID Promo non specificato" });
                return;
            }
            const reports = await this.tracciatoService.getReportsConfronto(idPromo);
            res.status(HttpStatusCode.OK).json(reports);
        } catch (error: any) {
            console.error('Error fetching reports confronto:', error);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: "Errore durante il recupero dei report" });
        }
    }

    private async getReportConfrontoById(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id;
            if (!ServerUtils.checkIfValueIsValid(id)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: "ID report non specificato" });
                return;
            }
            const report = await this.tracciatoService.getReportConfrontoById(id);
            if (!report) {
                res.status(HttpStatusCode.NOT_FOUND).json({ message: "Report non trovato" });
                return;
            }
            res.status(HttpStatusCode.OK).json(report);
        } catch (error: any) {
            console.error('Error fetching report confronto by id:', error);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: "Errore durante il recupero del report" });
        }
    }

    private async getMomentiPerPromo(req: Request, res: Response): Promise<void> {
        try {
            const idPromo = req.params.idPromo;
            if (!ServerUtils.checkIfValueIsValid(idPromo)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'ID Promo non specificato' });
                return;
            }
            const momenti = await this.tracciatoService.getMomentiPerPromo(idPromo);
            res.status(HttpStatusCode.OK).json(momenti);
        } catch (error: any) {
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Errore durante il recupero dei momenti' });
        }
    }

    private async createMomento(req: Request, res: Response): Promise<void> {
        try {
            const { id_promo, nome, snapshot } = req.body ?? {};
            if (!ServerUtils.checkIfValueIsValid(id_promo) || !ServerUtils.checkIfValueIsValid(nome)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'id_promo e nome sono obbligatori' });
                return;
            }
            const momento = await this.tracciatoService.createMomento(id_promo, nome, snapshot === true);
            res.status(HttpStatusCode.OK).json(momento);
        } catch (error: any) {
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Errore durante la creazione del momento' });
        }
    }

    private async updateMomento(req: Request, res: Response): Promise<void> {
        try {
            const idMomento = req.params.idMomento;
            if (!ServerUtils.checkIfValueIsValid(idMomento)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'ID Momento non specificato' });
                return;
            }
            const { nome, tracciati_ids, confronti_ids, ordine } = req.body ?? {};
            const updated = await this.tracciatoService.updateMomento(idMomento, { nome, tracciati_ids, confronti_ids, ordine });
            if (!updated) {
                res.status(HttpStatusCode.NOT_FOUND).json({ message: 'Momento non trovato' });
                return;
            }
            res.status(HttpStatusCode.OK).json(updated);
        } catch (error: any) {
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Errore durante l\'aggiornamento del momento' });
        }
    }

    private async deleteMomento(req: Request, res: Response): Promise<void> {
        try {
            const idMomento = req.params.idMomento;
            if (!ServerUtils.checkIfValueIsValid(idMomento)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'ID Momento non specificato' });
                return;
            }
            const deleted = await this.tracciatoService.deleteMomento(idMomento);
            if (!deleted) {
                res.status(HttpStatusCode.NOT_FOUND).json({ success: false, message: 'Momento non trovato' });
                return;
            }
            res.status(HttpStatusCode.OK).json({ success: true });
        } catch (error: any) {
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Errore durante l\'eliminazione del momento' });
        }
    }

    private async calcolaRisultatoMomento(req: Request, res: Response): Promise<void> {
        try {
            const idMomento = req.params.idMomento;
            if (!ServerUtils.checkIfValueIsValid(idMomento)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'ID Momento non specificato' });
                return;
            }
            const risultato = await this.tracciatoService.calcolaRisultatoMomento(idMomento, req);
            res.status(HttpStatusCode.OK).json(risultato);
        } catch (error: any) {
            if (error?.httpStatus === 404) {
                res.status(HttpStatusCode.NOT_FOUND).json({ message: 'Momento non trovato' });
                return;
            }
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Errore durante il calcolo del risultato del momento' });
        }
    }

    private async resetRisultatoMomento(req: Request, res: Response): Promise<void> {
        try {
            const idMomento = req.params.idMomento;
            if (!ServerUtils.checkIfValueIsValid(idMomento)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'ID Momento non specificato' });
                return;
            }
            const risultato = await this.tracciatoService.resetRisultatoMomento(idMomento);
            res.status(HttpStatusCode.OK).json(risultato);
        } catch (error: any) {
            if (error?.httpStatus === 404) {
                res.status(HttpStatusCode.NOT_FOUND).json({ message: 'Momento non trovato' });
                return;
            }
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Errore durante il reset del risultato del momento' });
        }
    }

    private async createMomentoConfronto(req: Request, res: Response): Promise<void> {
        try {
            const { primario, secondario } = req.body ?? {};
            if (!ServerUtils.checkIfValueIsValid(primario) || !ServerUtils.checkIfValueIsValid(secondario)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'primario e secondario sono obbligatori' });
                return;
            }
            const confronto = await this.tracciatoService.createMomentoConfronto(primario, secondario);
            res.status(HttpStatusCode.OK).json(confronto);
        } catch (error: any) {
            if (error?.httpStatus === 400) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: error?.message ?? 'Dati confronto non validi' });
                return;
            }
            if (error?.httpStatus === 404) {
                res.status(HttpStatusCode.NOT_FOUND).json({ message: error?.message ?? 'Momento non trovato' });
                return;
            }
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Errore durante la creazione del confronto momento' });
        }
    }

    private async getMomentoConfrontoById(req: Request, res: Response): Promise<void> {
        try {
            const idConfronto = req.params.idConfronto;
            if (!ServerUtils.checkIfValueIsValid(idConfronto)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'ID Confronto non specificato' });
                return;
            }
            const confronto = await this.tracciatoService.getMomentoConfrontoById(idConfronto);
            if (!confronto) {
                res.status(HttpStatusCode.NOT_FOUND).json({ message: 'Confronto non trovato' });
                return;
            }
            res.status(HttpStatusCode.OK).json(confronto);
        } catch (error: any) {
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Errore durante il recupero del confronto' });
        }
    }

    private async updateConfrontoMeta(req: Request, res: Response): Promise<void> {
        try {
            const idConfronto = req.params.idConfronto;
            if (!ServerUtils.checkIfValueIsValid(idConfronto)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'ID Confronto non specificato' });
                return;
            }
            const { terremoto_degrado_massimo } = req.body ?? {};
            const confronto = await this.tracciatoService.updateConfrontoMeta(idConfronto, { terremoto_degrado_massimo });
            if (!confronto) {
                res.status(HttpStatusCode.NOT_FOUND).json({ message: 'Confronto non trovato' });
                return;
            }
            res.status(HttpStatusCode.OK).json(confronto);
        } catch (error: any) {
            if (error?.httpStatus === 400) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: error?.message ?? 'Dati confronto non validi' });
                return;
            }
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Errore durante l\'aggiornamento del confronto' });
        }
    }

    private async calcolaRisultatoMomentoConfronto(req: Request, res: Response): Promise<void> {
        try {
            const idConfronto = req.params.idConfronto;
            if (!ServerUtils.checkIfValueIsValid(idConfronto)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'ID Confronto non specificato' });
                return;
            }
            const risultato = await this.tracciatoService.calcolaRisultatoMomentoConfronto(idConfronto, req);
            res.status(HttpStatusCode.OK).json(risultato);
        } catch (error: any) {
            if (error?.httpStatus === 400) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: error?.message ?? 'Dati confronto non validi' });
                return;
            }
            if (error?.httpStatus === 404) {
                res.status(HttpStatusCode.NOT_FOUND).json({ message: error?.message ?? 'Confronto non trovato' });
                return;
            }
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Errore durante il calcolo del risultato del confronto: ' + error.message });
        }
    }

    private async resetRisultatoConfronto(req: Request, res: Response): Promise<void> {
        try {
            const idConfronto = req.params.idConfronto;
            if (!ServerUtils.checkIfValueIsValid(idConfronto)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'ID Confronto non specificato' });
                return;
            }
            const confronto = await this.tracciatoService.resetRisultatoConfronto(idConfronto);
            res.status(HttpStatusCode.OK).json(confronto);
        } catch (error: any) {
            if (error?.httpStatus === 404) {
                res.status(HttpStatusCode.NOT_FOUND).json({ message: error?.message ?? 'Confronto non trovato' });
                return;
            }
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Errore durante il reset del confronto' });
        }
    }

    // ─── Schemi ────────────────────────────────────────────────────────────────

    private async getAllSchemi(_req: Request, res: Response): Promise<void> {
        try {
            const schemi = await this.tracciatoService.getAllSchemi();
            res.status(HttpStatusCode.OK).json(schemi);
        } catch {
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Errore durante il recupero degli schemi' });
        }
    }

    private async createSchema(req: Request, res: Response): Promise<void> {
        try {
            const { nome, tipo, items, confronti } = req.body ?? {};
            if (!ServerUtils.checkIfValueIsValid(nome) || !Array.isArray(items)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'nome e items sono obbligatori' });
                return;
            }
            const TIPI_VALIDI = ['BUSINESS', 'AGENZIA'];
            if (!Array.isArray(tipo) || tipo.length === 0 || tipo.some((t: string) => !TIPI_VALIDI.includes(t))) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'tipo deve essere un array non vuoto con valori in: BUSINESS, AGENZIA' });
                return;
            }
            if (confronti !== undefined && !Array.isArray(confronti)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'confronti deve essere un array' });
                return;
            }
            if (Array.isArray(confronti) && confronti.some((c: any) => c.a === c.b)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'confronti non può contenere coppie con lo stesso item' });
                return;
            }
            const schema = await this.tracciatoService.createSchema(nome, tipo, items, confronti ?? []);
            res.status(HttpStatusCode.OK).json(schema);
        } catch {
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Errore durante la creazione dello schema' });
        }
    }

    private async updateSchema(req: Request, res: Response): Promise<void> {
        try {
            const idSchema = req.params.idSchema;
            if (!ServerUtils.checkIfValueIsValid(idSchema)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'ID Schema non specificato' });
                return;
            }
            const { nome, tipo, items, confronti } = req.body ?? {};
            const TIPI_VALIDI = ['BUSINESS', 'AGENZIA'];
            if (tipo !== undefined && (!Array.isArray(tipo) || tipo.length === 0 || tipo.some((t: string) => !TIPI_VALIDI.includes(t)))) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'tipo deve essere un array non vuoto con valori in: BUSINESS, AGENZIA' });
                return;
            }
            if (confronti !== undefined && !Array.isArray(confronti)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'confronti deve essere un array' });
                return;
            }
            if (Array.isArray(confronti) && confronti.some((c: any) => c.a === c.b)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'confronti non può contenere coppie con lo stesso item' });
                return;
            }
            const updated = await this.tracciatoService.updateSchema(idSchema, { nome, tipo, items, confronti });
            if (!updated) { res.status(HttpStatusCode.NOT_FOUND).json({ message: 'Schema non trovato' }); return; }
            res.status(HttpStatusCode.OK).json(updated);
        } catch {
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Errore durante l\'aggiornamento dello schema' });
        }
    }

    private async deleteSchema(req: Request, res: Response): Promise<void> {
        try {
            const idSchema = req.params.idSchema;
            if (!ServerUtils.checkIfValueIsValid(idSchema)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'ID Schema non specificato' });
                return;
            }
            const deleted = await this.tracciatoService.deleteSchema(idSchema);
            if (!deleted) { res.status(HttpStatusCode.NOT_FOUND).json({ success: false, message: 'Schema non trovato' }); return; }
            res.status(HttpStatusCode.OK).json({ success: true });
        } catch {
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Errore durante l\'eliminazione dello schema' });
        }
    }

    private async applicaSchema(req: Request, res: Response): Promise<void> {
        try {
            const idSchema = req.params.idSchema;
            const { idPromo } = req.body ?? {};
            if (!ServerUtils.checkIfValueIsValid(idSchema) || !ServerUtils.checkIfValueIsValid(idPromo)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'idSchema e idPromo sono obbligatori' });
                return;
            }
            const momenti = await this.tracciatoService.applicaSchema(idSchema, idPromo);
            res.status(HttpStatusCode.OK).json(momenti);
        } catch (error: any) {
            if (error?.httpStatus === 404) { res.status(HttpStatusCode.NOT_FOUND).json({ message: 'Schema non trovato' }); return; }
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Errore durante l\'applicazione dello schema' });
        }
    }

    private async getContestoConfronto(req: Request, res: Response): Promise<void> {
        try {
            const idPromo = req.query.idPromo as string | undefined;

            if (!ServerUtils.checkIfValueIsValid(idPromo)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({
                    message: "ID Promo non specificato"
                });
                return;
            }

            const contesto = await this.tracciatoService.getContestoPerConfronto(idPromo, req);
            res.status(HttpStatusCode.OK).json(contesto);
        } catch (error: any) {
            console.error('Error starting tracciati compare:', error);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                message: "Errore durante l'avvio del confronto tracciati",
                error: error.message
            });
        }
    }

}
