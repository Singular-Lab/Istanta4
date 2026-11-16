import { Request, Response } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import { ExternalApiError } from '../../../lib/errors';
import { BaseController } from '../base/BaseController';
import { log } from '../logger';
import { ITracciatoService } from '../interfaces/ITracciatoService';
import { authMiddleware } from '../middleware/authMiddleware';
import { routeDeprecata } from '../middleware/routeDeprecata';
import { permissionGuard } from '../middleware/permissionGuard';
import { ServerUtils } from '../utils/ServerUtils';
import { AuditLogService } from '../services/AuditLogService';
import { Promo } from '../models/promo';
import { TracciatiInvioIstanta } from '../models/tracciati_invio_istanta';
import { aggiornaContestoInAttesa, inviaPrenotata, prenotaTracciato, statoIstantaTracciati } from '../services/AllineamentoIstanta';
import type { IIstantaService } from '../interfaces/IIstantaService';
import { daScartareInIstanta, motivoTracciatoNonEliminabile, tracciatoNonImportato } from '../../../lib/produzione/eliminazioneTracciato';
import { statoImportazioniCondiviso } from '../services/StatoImportazioniCondiviso';

/** Perche' un tracciato non si elimina: si elimina solo se Istanta non l'ha importato. */
type RifiutoEliminazione = { status: HttpStatusCode; motivo: string };

export class TracciatoController extends BaseController {
    /** istantaService: per leggere lo stato dell'importazione e scartarla prima di eliminare un tracciato. */
    constructor(private tracciatoService: ITracciatoService, private istantaService?: Pick<IIstantaService, 'getStatusImportazione' | 'scartaImportazione'>) {
        super('/api');
    }
    protected setupRoutes(): void {
        this.initializeRoutes();
    }
    public initializeRoutes(): void {
        // Tracciati, momenti e schemi sono della promozione (produzione); i risultati dei momenti e
        // dei confronti si consultano anche dal Report tracciati
        const promo = [authMiddleware, permissionGuard('promo.visualizza')];
        const consulta = [authMiddleware, permissionGuard(['promo.visualizza', 'analisi.visualizza'])];
        const momenti = [authMiddleware, permissionGuard('promo.gestisci_momenti')];
        const schemi = [authMiddleware, permissionGuard('promo.gestisci_schemi')];

        this.router.get('/tracciati', authMiddleware, routeDeprecata, this.getAllTracciati.bind(this));
        // DB1 recupera questi tracciati con WebClient.DownloadString, senza una sessione Fidelity.
        this.router.get('/tracciati/promo/:idPromo', this.getAllTracciatiPerPromo.bind(this));
        this.router.get('/tracciati/confronto/contesto', authMiddleware, routeDeprecata, this.getContestoConfronto.bind(this));
        this.router.get('/tracciati/confronto/reports', authMiddleware, routeDeprecata, this.getReportsConfronto.bind(this));
        this.router.get('/tracciati/confronto/reports/:id', authMiddleware, routeDeprecata, this.getReportConfrontoById.bind(this));
        // Momenti (prima delle route parametriche /:idTracciato)
        this.router.get('/tracciati/momenti/promo/:idPromo', ...consulta, this.getMomentiPerPromo.bind(this));
        this.router.post('/tracciati/momenti', ...momenti, this.createMomento.bind(this));
        this.router.put('/tracciati/momenti/:idMomento', ...momenti, this.updateMomento.bind(this));
        this.router.delete('/tracciati/momenti/:idMomento', ...momenti, this.deleteMomento.bind(this));
        this.router.post('/tracciati/momenti/:idMomento/risultato', ...momenti, this.calcolaRisultatoMomento.bind(this));
        this.router.delete('/tracciati/momenti/:idMomento/risultato', ...momenti, this.resetRisultatoMomento.bind(this));
        this.router.post('/tracciati/momenti/confronti', ...momenti, this.createMomentoConfronto.bind(this));
        this.router.patch('/tracciati/momenti/confronti/:idConfronto', ...momenti, this.updateConfrontoMeta.bind(this));
        this.router.get('/tracciati/momenti/confronti/:idConfronto', ...consulta, this.getMomentoConfrontoById.bind(this));
        this.router.post('/tracciati/momenti/confronti/:idConfronto/risultato', ...momenti, this.calcolaRisultatoMomentoConfronto.bind(this));
        this.router.delete('/tracciati/momenti/confronti/:idConfronto/risultato', ...momenti, this.resetRisultatoConfronto.bind(this));
        // Schemi
        this.router.get('/tracciati/schemi', ...promo, this.getAllSchemi.bind(this));
        this.router.post('/tracciati/schemi', ...schemi, this.createSchema.bind(this));
        this.router.put('/tracciati/schemi/:idSchema', ...schemi, this.updateSchema.bind(this));
        this.router.delete('/tracciati/schemi/:idSchema', ...schemi, this.deleteSchema.bind(this));
        this.router.post('/tracciati/schemi/:idSchema/applica', ...schemi, this.applicaSchema.bind(this));
        this.router.get('/tracciati/:idTracciato/parse', ...promo, this.parseTracciatoById.bind(this));
        this.router.get('/tracciati/:idTracciato/download', ...promo, this.scaricaTracciato.bind(this));
        this.router.put('/tracciati/:idTracciato/nome', authMiddleware, permissionGuard('file.upload_tracciato'), this.rinominaTracciato.bind(this));
        // Tracciati salvati in FP e non ancora accettati da Istanta
        this.router.post('/tracciati/:idTracciato/rimanda-istanta', authMiddleware, permissionGuard('file.upload_tracciato'), this.rimandaAIstanta.bind(this));
        this.router.put('/tracciati/:idTracciato/contesto', authMiddleware, permissionGuard('file.upload_tracciato'), this.modificaContestoInAttesa.bind(this));
        this.router.get('/tracciati/:idTracciato', ...promo, this.getTracciatoById.bind(this));
        // Solo il Superadmin elimina, e solo un tracciato non importato (spec ciclo-promozione-importazione)
        this.router.delete('/tracciati/:idTracciato', authMiddleware, permissionGuard('sistema.elimina_tracciati'), this.deleteTracciato.bind(this));
    }

    private async getAllTracciati(req: Request, res: Response): Promise<void> {
        try {
            const includeBlob = req.query.includeBlob === 'true';
            const tracciati = await this.tracciatoService.getAllTracciati(includeBlob);
            res.status(HttpStatusCode.OK).json(tracciati);
        } catch (error: any) {
            log.error("Errore durante il recupero dei tracciati", error);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                message: "Errore durante il recupero dei tracciati"
            });
        }
    }

    private async getAllTracciatiPerPromo(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
        try {
            const idPromo = req.params.idPromo;
            if (!ServerUtils.checkIfValueIsValid(idPromo)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({
                    message: "ID Promo non specificato"
                });
                return;
            }
            const includeBlob = req.query.includeBlob === 'true';
            // Con includeJson il blobfile di ogni tracciato e' il file JSON di /parse al posto dell'xlsx
            const includeJson = req.query.includeJson === 'true';
            const tracciati = await this.tracciatoService.getTracciatiByPromoId(idPromo, includeBlob, includeJson);
            res.status(HttpStatusCode.OK).json(tracciati);
        } catch (error: any) {
            log.error("Errore durante il recupero dei tracciati", error);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                message: "Errore durante il recupero dei tracciati"
            });
        }
    }
    private async getTracciatoById(req: Request<{ idTracciato: string }>, res: Response): Promise<void> {
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
            log.error("Errore durante il recupero del tracciato", error);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                message: "Errore durante il recupero del tracciato"
            });
        }
    }

    private async parseTracciatoById(req: Request<{ idTracciato: string }>, res: Response): Promise<void> {
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
        } catch (error) {
            // Tracciato inesistente 404, senza file 400: 500 solo per gli errori imprevisti
            this.handleError(res, error);
        }
    }

    private async scaricaTracciato(req: Request<{ idTracciato: string }>, res: Response): Promise<void> {
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

    // Cambia solo il nome mostrato in FP: file, filename originale e importazione in Istanta restano invariati
    private async rinominaTracciato(req: Request<{ idTracciato: string }>, res: Response): Promise<void> {
        try {
            const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
            if (!nome || nome.length > 255) {
                res.status(HttpStatusCode.BAD_REQUEST).json({
                    message: "Il nome del tracciato è obbligatorio e non può superare i 255 caratteri"
                });
                return;
            }

            const tracciato = await this.tracciatoService.updateTracciato(req.params.idTracciato, { nome });
            if (!tracciato) {
                res.status(HttpStatusCode.NOT_FOUND).json({ message: "Tracciato non trovato" });
                return;
            }

            res.status(HttpStatusCode.OK).json({ ...tracciato, blobfile: undefined });
        } catch (error: any) {
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                message: "Errore durante la rinomina del tracciato"
            });
        }
    }

    /** "Rimanda a Istanta": invia subito il tracciato in coda e risponde con l'esito. */
    private async rimandaAIstanta(req: Request<{ idTracciato: string }>, res: Response): Promise<void> {
        try {
            const idTracciato = req.params.idTracciato;
            const prenotata = await prenotaTracciato(idTracciato);
            if (!prenotata) {
                const inCoda = await TracciatiInvioIstanta.findByPk(idTracciato, { attributes: ['id_tracciato'] });
                res.status(HttpStatusCode.CONFLICT).json({
                    message: inCoda ? "Il tracciato si sta gia' inviando a Istanta: riprova fra poco" : "Il tracciato e' gia' in Istanta",
                });
                return;
            }
            const esito = await inviaPrenotata(prenotata, req as unknown as Request);
            if (esito.esito === 'sparita') {
                res.status(HttpStatusCode.NOT_FOUND).json({ message: "Tracciato non trovato" });
                return;
            }
            AuditLogService.getInstance().entityChanged(req, 'tracciato', 'rimanda_istanta', { type: 'Tracciato', id: idTracciato }, { esito: esito.esito });
            res.status(HttpStatusCode.OK).json(esito);
        } catch (error) {
            log.error("Errore durante il rinvio del tracciato a Istanta", error as Error);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: "Errore durante il rinvio del tracciato a Istanta" });
        }
    }

    /** Contesto di un tracciato ancora in coda per Istanta: quello che gli si mandera'. */
    private async modificaContestoInAttesa(req: Request<{ idTracciato: string }>, res: Response): Promise<void> {
        try {
            const context = req.body?.context;
            if (!Array.isArray(context)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: "context: serve l'elenco dei campi del contesto" });
                return;
            }
            const etichetta = (context as Array<{ nome_field?: unknown; user_value?: unknown }>).find((c) => c?.nome_field === 'idLabel');
            if (typeof etichetta?.user_value === 'string' && etichetta.user_value.length > 40) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: "La label personalizzata non può superare i 40 caratteri" });
                return;
            }
            const esito = await aggiornaContestoInAttesa(req.params.idTracciato, context);
            if (esito === 'inesistente') {
                res.status(HttpStatusCode.NOT_FOUND).json({ message: "Tracciato non trovato" });
                return;
            }
            if (esito !== 'aggiornato') {
                res.status(HttpStatusCode.CONFLICT).json({
                    message: esito === 'inviato'
                        ? "Il tracciato e' gia' in Istanta: il contesto non si puo' piu' modificare"
                        : "Il tracciato si sta inviando a Istanta: riprova fra poco",
                });
                return;
            }
            AuditLogService.getInstance().entityChanged(req, 'tracciato', 'modifica_contesto', { type: 'Tracciato', id: req.params.idTracciato });
            res.status(HttpStatusCode.OK).json({ esito });
        } catch (error) {
            log.error("Errore durante la modifica del contesto del tracciato", error as Error);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: "Errore durante la modifica del contesto del tracciato" });
        }
    }

    private async deleteTracciato(req: Request<{ idTracciato: string }>, res: Response): Promise<void> {
        try {
            const idTracciato = req.params.idTracciato;

            if (!ServerUtils.checkIfValueIsValid(idTracciato)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({
                    message: "ID Tracciato non specificato"
                });
                return;
            }

            // Il tracciato si legge prima: serve il suo stato per sapere se si puo' eliminare, e per
            // il Registro Audit nome, file e promo, perche' dopo la cancellazione non ne resta niente.
            // Se la lettura non riesce non si elimina niente (errore 500 qui sotto).
            const tracciato = await this.tracciatoService.getTracciatoById(idTracciato);
            if (!tracciato) {
                res.status(HttpStatusCode.NOT_FOUND).json({
                    success: false,
                    message: "Tracciato non trovato"
                });
                return;
            }

            const rifiuto = await this.rifiutoEliminazione(idTracciato, tracciato.stato, req);
            if (rifiuto) {
                res.status(rifiuto.status).json({ success: false, message: rifiuto.motivo });
                return;
            }

            const nomePromo = tracciato.id_promo
                ? await Promo.findByPk(tracciato.id_promo, { attributes: ['nome_promo'] }).then((p) => p?.nome_promo ?? null).catch(() => null)
                : null;

            const deleted = await this.tracciatoService.deleteTracciato(idTracciato);
            // Lo stato letto prima dello scarto non vale piu'
            statoImportazioniCondiviso.dimentica(idTracciato);
            // Niente piu' da inviare a Istanta. La chiave esterna di solito lo fa da sola, ma su
            // un'installazione vecchia senza chiave primaria in tracciati non c'e'.
            await TracciatiInvioIstanta.destroy({ where: { id_tracciato: idTracciato } }).catch((error) =>
                log.warn(`Tracciato ${idTracciato} eliminato, coda verso Istanta non ripulita`, error));

            if (!deleted) {
                res.status(HttpStatusCode.NOT_FOUND).json({
                    success: false,
                    message: "Tracciato non trovato"
                });
                return;
            }

            AuditLogService.getInstance().entityChanged(req, 'tracciato', 'delete', { type: 'Tracciato', id: idTracciato }, {
                tracciatoId: idTracciato,
                fileName: tracciato?.filename ?? null,
                nomeTracciato: tracciato?.nome ?? null,
                promoId: tracciato?.id_promo ?? null,
                nomePromo
            });

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

    /**
     * Un tracciato si elimina solo se Istanta non l'ha importato (lib/produzione/eliminazioneTracciato).
     * In attesa di Istanta e "Scartato" si sanno da FP; altrimenti decide lo stato dell'importazione
     * letto da Istanta, e se Istanta non risponde non si elimina niente. Un tracciato arrivato in
     * Istanta, con l'importazione in attesa di conferma o esaminata, si elimina solo dopo che Istanta
     * ne ha scartato l'importazione: se nel frattempo e' partita, resta.
     */
    private async rifiutoEliminazione(idTracciato: string, statoTracciato: string | null | undefined, req: Request): Promise<RifiutoEliminazione | null> {
        const coda = (await statoIstantaTracciati([idTracciato])).get(idTracciato);
        if (tracciatoNonImportato({ inAttesaIstanta: !!coda && coda.stato !== 'inviato', statoTracciato })) {
            return null;
        }
        let statoImportazione: string | null = null;
        try {
            if (!this.istantaService) throw new Error('Servizio Istanta non configurato');
            statoImportazione = (await this.istantaService.getStatusImportazione(idTracciato, req))?.stato ?? null;
        } catch (error) {
            log.warn(`Stato dell'importazione del tracciato ${idTracciato} non verificabile: non si elimina`, {
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                status: HttpStatusCode.SERVICE_UNAVAILABLE,
                motivo: "Non è stato possibile verificare in Istanta lo stato dell'importazione del tracciato: riprova più tardi.",
            };
        }
        if (!tracciatoNonImportato({ inAttesaIstanta: false, statoTracciato, statoImportazione })) {
            return { status: HttpStatusCode.CONFLICT, motivo: motivoTracciatoNonEliminabile(statoImportazione) };
        }
        if (!daScartareInIstanta(statoImportazione)) {
            return null;
        }
        // Senza lo scarto, confermando le importazioni della promo Istanta lo importerebbe lo stesso.
        // Se poi la cancellazione in FP non riesce, il tracciato resta con l'importazione scartata e si
        // puo' eliminare di nuovo.
        let scarto: { scartata: boolean; stato: string | null };
        try {
            if (!this.istantaService) throw new Error('Servizio Istanta non configurato');
            scarto = await this.istantaService.scartaImportazione(idTracciato, req);
        } catch (error) {
            log.warn(`Importazione del tracciato ${idTracciato} non scartata in Istanta: non si elimina`, {
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                status: HttpStatusCode.SERVICE_UNAVAILABLE,
                motivo: "Non è stato possibile scartare in Istanta l'importazione del tracciato: riprova più tardi.",
            };
        }
        return scarto.scartata ? null : { status: HttpStatusCode.CONFLICT, motivo: motivoTracciatoNonEliminabile(scarto.stato) };
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

    private async getReportConfrontoById(req: Request<{ id: string }>, res: Response): Promise<void> {
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

    private async getMomentiPerPromo(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
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

    private async updateMomento(req: Request<{ idMomento: string }>, res: Response): Promise<void> {
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

    private async deleteMomento(req: Request<{ idMomento: string }>, res: Response): Promise<void> {
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

    private async calcolaRisultatoMomento(req: Request<{ idMomento: string }>, res: Response): Promise<void> {
        try {
            const idMomento = req.params.idMomento;
            if (!ServerUtils.checkIfValueIsValid(idMomento)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'ID Momento non specificato' });
                return;
            }
            const risultato = await this.tracciatoService.calcolaRisultatoMomento(idMomento, req);
            res.status(HttpStatusCode.OK).json(risultato);
        } catch (error: any) {
            if (error instanceof ExternalApiError) {
                this.handleError(res, error);
                return;
            }
            if (error?.httpStatus === 404) {
                res.status(HttpStatusCode.NOT_FOUND).json({ message: 'Momento non trovato' });
                return;
            }
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: 'Errore durante il calcolo del risultato del momento' });
        }
    }

    private async resetRisultatoMomento(req: Request<{ idMomento: string }>, res: Response): Promise<void> {
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

    private async getMomentoConfrontoById(req: Request<{ idConfronto: string }>, res: Response): Promise<void> {
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

    private async updateConfrontoMeta(req: Request<{ idConfronto: string }>, res: Response): Promise<void> {
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

    private async calcolaRisultatoMomentoConfronto(req: Request<{ idConfronto: string }>, res: Response): Promise<void> {
        try {
            const idConfronto = req.params.idConfronto;
            if (!ServerUtils.checkIfValueIsValid(idConfronto)) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'ID Confronto non specificato' });
                return;
            }
            const risultato = await this.tracciatoService.calcolaRisultatoMomentoConfronto(idConfronto, req);
            res.status(HttpStatusCode.OK).json(risultato);
        } catch (error: any) {
            if (error instanceof ExternalApiError) {
                this.handleError(res, error);
                return;
            }
            if (error?.httpStatus === 400) {
                res.status(HttpStatusCode.BAD_REQUEST).json({ message: error?.message ?? 'Dati confronto non validi' });
                return;
            }
            if (error?.httpStatus === 404) {
                res.status(HttpStatusCode.NOT_FOUND).json({ message: error?.message ?? 'Confronto non trovato' });
                return;
            }
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: `Errore durante il calcolo del risultato del confronto: ${error.message}` });
        }
    }

    private async resetRisultatoConfronto(req: Request<{ idConfronto: string }>, res: Response): Promise<void> {
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

    private async updateSchema(req: Request<{ idSchema: string }>, res: Response): Promise<void> {
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

    private async deleteSchema(req: Request<{ idSchema: string }>, res: Response): Promise<void> {
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

    private async applicaSchema(req: Request<{ idSchema: string }>, res: Response): Promise<void> {
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
            if (error instanceof ExternalApiError) {
                this.handleError(res, error);
                return;
            }
            console.error('Error starting tracciati compare:', error);
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                message: "Errore durante l'avvio del confronto tracciati",
                error: error.message
            });
        }
    }

}
