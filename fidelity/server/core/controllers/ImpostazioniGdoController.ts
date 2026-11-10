import type { Request, Response } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import { BadRequestError } from '../../../lib/errors';
import { percorsiImpostazioniGdo } from '../../../lib/impostazioniGdo/tipi';
import { gdoOperativaPerRichiesta } from '../accessi/contestoAccesso';
import { BaseController } from '../base/BaseController';
import type { IImpostazioniGdoService } from '../interfaces/IImpostazioniGdoService';
import { authMiddleware } from '../middleware/authMiddleware';
import { jsonGrande } from '../middleware/jsonGrande';
import { permissionGuard } from '../middleware/permissionGuard';
import { AuditLogService } from '../services/AuditLogService';
import { idGdoCliente } from '../services/configPerGdo';

/**
 * Impostazioni GDO (spec impostazioni-gdo, contratto in lib/impostazioniGdo/tipi.ts): tutte le rotte
 * con "impostazioni.modifica_generali", sulla GDO della sessione (superadmin e agenzia: quella in
 * ?gdo=, altrimenti la GDO dell'installazione). Ogni PUT salva solo la sua sezione, finisce nel
 * Registro Audit e risponde con le impostazioni aggiornate.
 *
 * Il mapping dei campi e il suo Sync restano su /api/referenze/campi-non-tradotti; l'icona della GDO
 * su POST /api/gdo/icona; /api/saveWebpliantConfig e /api/get_config restano per chi li usa ancora.
 */

type Lavoro = (idGdo: string) => Promise<unknown>;

export class ImpostazioniGdoController extends BaseController {
  constructor(private readonly impostazioni: IImpostazioniGdoService) {
    super('/api');
  }

  protected setupRoutes(): void {
    const modifica = [authMiddleware, permissionGuard('impostazioni.modifica_generali')];
    const percorsi = percorsiImpostazioniGdo;

    this.router.get(percorsi.impostazioni, ...modifica, (req, res) =>
      this.rispondi(req, res, idGdo => this.impostazioni.leggi(idGdo, req)));
    this.router.put(percorsi.identita, ...modifica, (req, res) =>
      this.salva(req, res, 'identita', idGdo => this.impostazioni.salvaIdentita(idGdo, req.body, req)));
    this.router.put(percorsi.reparti, ...modifica, (req, res) =>
      this.salva(req, res, 'reparti', idGdo => this.impostazioni.salvaReparti(idGdo, req.body, req)));
    this.router.put(percorsi.campiReferenze, ...modifica, (req, res) =>
      this.salva(req, res, 'campi_referenze', idGdo => this.impostazioni.salvaCampiReferenze(idGdo, req.body, req)));
    // Loghi e icona in base64: il body grande si legge solo dopo autenticazione e permesso
    this.router.put(percorsi.sitoWeb, ...modifica, jsonGrande, (req, res) =>
      this.salva(req, res, 'sito_web', idGdo => this.impostazioni.salvaSitoWeb(idGdo, req.body, req.session?.private_key, req)));
    this.router.post(percorsi.verificaInsightVolantino, ...modifica, this.verificaInsight.bind(this));
    this.router.put(percorsi.insightVolantino, ...modifica, this.salvaInsight.bind(this));
    this.router.delete(percorsi.insightVolantino, ...modifica, (req, res) =>
      this.salva(req, res, 'insight_volantino', idGdo => this.impostazioni.eliminaInsightVolantino(idGdo, req), 'clear'));
  }

  /** La GDO delle impostazioni: quella della sessione, o in ?gdo= per chi opera per piu' GDO, o quella dell'installazione. */
  private async gdoDellaRichiesta(req: Request, res: Response): Promise<string> {
    const idGdo = (await gdoOperativaPerRichiesta(req, res, req.query.gdo)) ?? (await idGdoCliente());
    if (!idGdo) throw new BadRequestError({ message: 'Nessuna GDO di cui gestire le impostazioni: indicarla con ?gdo=' });
    return idGdo;
  }

  private async rispondi(req: Request, res: Response, lavoro: Lavoro): Promise<void> {
    try {
      const idGdo = await this.gdoDellaRichiesta(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await lavoro(idGdo));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /** Un salvataggio: la risposta del servizio, e la voce nel Registro Audit con la GDO e la sezione. */
  private async salva(req: Request, res: Response, sezione: string, lavoro: Lavoro, azione = 'set'): Promise<void> {
    try {
      const idGdo = await this.gdoDellaRichiesta(req, res);
      const risultato = await lavoro(idGdo);
      AuditLogService.getInstance().configurationChanged(req, 'impostazioni_gdo', azione, { idGdo, sezione });
      this.sendResponse(res, HttpStatusCode.OK, risultato);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async verificaInsight(req: Request, res: Response): Promise<void> {
    try {
      this.sendResponse(res, HttpStatusCode.OK, this.impostazioni.verificaInsightVolantino(configurazioneDelCorpo(req.body)));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Non valida: 400 come ogni errore del progetto (BadRequestError), con l'esito della verifica in
   * details (details.errori: percorso e messaggio); niente salvato e niente nel Registro Audit.
   */
  private salvaInsight(req: Request, res: Response): Promise<void> {
    return this.salva(req, res, 'insight_volantino', idGdo =>
      this.impostazioni.salvaInsightVolantino(idGdo, configurazioneDelCorpo(req.body), req.session?.id_utente ?? null, req));
  }
}

/** { configurazione } dal corpo della richiesta; senza, la verifica dice che manca. */
function configurazioneDelCorpo(corpo: unknown): unknown {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) return undefined;
  return (corpo as { configurazione?: unknown }).configurazione;
}
