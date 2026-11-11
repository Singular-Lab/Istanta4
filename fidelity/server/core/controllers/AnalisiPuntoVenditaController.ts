import type { Request, Response } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import { BadRequestError, NotFoundError } from '../../../lib/errors';
import { gdoOperativaPerRichiesta, operaPerPiuGdo } from '../accessi/contestoAccesso';
import { BaseController } from '../base/BaseController';
import type { IAnalisiPuntoVenditaService } from '../interfaces/IAnalisiPuntoVenditaService';
import type { CollegamentiPuntiVenditaVolantino } from '../interfaces/IStoriaPuntoVenditaService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import {
  eventoPosizioniRighe,
  type GestorePosizioniRighe,
  type IndirizzoDaCercare,
  posizioniRigheJobs,
  RicercaPosizioniGiaInCorso,
} from '../services/PosizioniRigheJob';
import { cercaPosizione, type PosizioneTrovata } from '../utils/geocodifica';
import { roomUtente } from '../utils/socketRooms';
import { emitToClients } from '../../ws-server';

const numero = (valore: unknown): number | undefined => {
  if (typeof valore !== 'string' || valore.trim() === '') return undefined;
  const intero = Number.parseInt(valore, 10);
  return Number.isFinite(intero) ? intero : undefined;
};

/**
 * Le pagine del punto vendita costruite sulla timeline dei volantini (contratto in
 * lib/puntiVendita/analisi.ts). Letture con "gdo.visualizza"; la qualita' dei dati, le righe
 * dei volantini non abbinate, i loro collegamenti fatti a mano, la verifica e il cambio dei
 * collegamenti e la ricerca delle posizioni delle righe con "gdo.gestisci_punti_vendita".
 * La ricerca delle posizioni gira in background (PosizioniRigheJob): l'avanzamento arriva via
 * socket all'utente che l'ha avviata.
 *
 * Sullo stesso percorso base ci sono la consultazione ('/', '/:id', '/:id/volantini-attivi') e la
 * storia ('/:id/storia', '/:id/storia/volantini', '/storia/import-export'): nessuno dei loro
 * percorsi copre questi, e in routes.ts questo controller e' registrato prima, cosi' '/rete/...' e
 * '/gestione/...' non finiscono mai in un '/:id'.
 */
export class AnalisiPuntoVenditaController extends BaseController {
  constructor(
    private readonly analisi: IAnalisiPuntoVenditaService,
    private readonly collegamenti: CollegamentiPuntiVenditaVolantino,
    private readonly posizioni: Pick<GestorePosizioniRighe, 'avvia' | 'stato' | 'ultima' | 'annulla'> = posizioniRigheJobs,
    private readonly cerca: (indirizzo: IndirizzoDaCercare) => Promise<PosizioneTrovata | undefined> = cercaPosizione,
    private readonly emetti: (evento: string, dati: unknown, room: string) => void = emitToClients,
  ) {
    super('/api/punti-vendita');
  }

  protected setupRoutes(): void {
    const visualizza = [authMiddleware, permissionGuard('gdo.visualizza')];
    const gestisci = [authMiddleware, permissionGuard('gdo.gestisci_punti_vendita')];

    this.router.get('/rete/insegne', ...visualizza, this.getReteInsegne.bind(this));
    this.router.get('/gestione/qualita', ...gestisci, this.getQualita.bind(this));
    this.router.get('/gestione/righe-non-abbinate', ...gestisci, this.getRigheNonAbbinate.bind(this));
    this.router.get('/gestione/righe-non-abbinate/volantini', ...gestisci, this.getVolantiniRiga.bind(this));
    this.router.post('/gestione/righe-non-abbinate/collega', ...gestisci, this.postCollega.bind(this));
    this.router.get('/gestione/collegamenti-manuali', ...gestisci, this.getCollegamenti.bind(this));
    this.router.delete('/gestione/collegamenti-manuali/:idCollegamento', ...gestisci, this.deleteCollegamento.bind(this));
    this.router.get('/gestione/verifica-collegamenti', ...gestisci, this.getVerifica.bind(this));
    this.router.put('/gestione/collegamenti/cambia', ...gestisci, this.putCambiaCollegamento.bind(this));
    this.router.post('/gestione/posizioni-righe', ...gestisci, this.postPosizioni.bind(this));
    this.router.get('/gestione/posizioni-righe/stato', ...gestisci, this.getStatoPosizioni.bind(this));
    this.router.post('/gestione/posizioni-righe/:jobId/annulla', ...gestisci, this.postAnnullaPosizioni.bind(this));
    this.router.put('/gestione/posizioni-righe', ...gestisci, this.putPosizione.bind(this));
    this.router.get('/:id/analisi', ...visualizza, this.getAnalisi.bind(this));
    this.router.get('/:id/volantini/:idKit', ...visualizza, this.getVolantino.bind(this));
    this.router.get('/:id/referenze/:chiave', ...visualizza, this.getReferenza.bind(this));
  }

  /**
   * GDO in cui cercare il PV, come nella storia: quella dell'utente; senza GDO chi lavora per piu'
   * GDO (Superadmin, Agenzia) le vede tutte (null), gli altri nessun PV (404).
   */
  private async gdoDelPuntoVendita(req: Request<{ id: string }>, res: Response): Promise<string | null> {
    const idGdo = await gdoOperativaPerRichiesta(req, res);
    if (idGdo) return idGdo;
    if (operaPerPiuGdo(req.session?.tipo_utente)) return null;
    throw new NotFoundError({ message: 'Punto vendita non trovato', entityType: 'PuntoVendita', entityId: req.params.id });
  }

  /** Rete e gestione sono della GDO della sessione: la richiesta non puo' indicarne un'altra. */
  private async gdoDellaSessione(req: Request, res: Response): Promise<string> {
    const idGdo = await gdoOperativaPerRichiesta(req, res);
    if (!idGdo) throw new BadRequestError({ message: 'GDO non specificata' });
    return idGdo;
  }

  private async getAnalisi(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDelPuntoVendita(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.analisi.analisi(req.params.id, idGdo));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getVolantino(req: Request<{ id: string; idKit: string }>, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDelPuntoVendita(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.analisi.volantino(req.params.id, req.params.idKit, idGdo));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getReferenza(req: Request<{ id: string; chiave: string }>, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDelPuntoVendita(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.analisi.referenza(req.params.id, req.params.chiave, idGdo));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getReteInsegne(req: Request, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.analisi.reteInsegne(idGdo));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getQualita(req: Request, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.analisi.qualita(idGdo));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getRigheNonAbbinate(req: Request, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      const pagina = numero(req.query.pagina);
      const dimensione = numero(req.query.dimensione);
      this.sendResponse(res, HttpStatusCode.OK, await this.analisi.righeNonAbbinate(idGdo, pagina, dimensione));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getVolantiniRiga(req: Request, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.analisi.volantiniRigaNonAbbinata(idGdo, req.query.chiave));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async postCollega(req: Request, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      const idUtente = req.session?.id_utente ? String(req.session.id_utente) : null;
      this.sendResponse(res, HttpStatusCode.OK, await this.collegamenti.collega(idGdo, req.body, idUtente));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getCollegamenti(req: Request, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      const pagina = numero(req.query.pagina);
      const dimensione = numero(req.query.dimensione);
      this.sendResponse(res, HttpStatusCode.OK, await this.collegamenti.collegamenti(idGdo, pagina, dimensione));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async deleteCollegamento(req: Request<{ idCollegamento: string }>, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.collegamenti.scollega(idGdo, req.params.idCollegamento));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private idUtente(req: Request): string | null {
    return req.session?.id_utente ? String(req.session.id_utente) : null;
  }

  private async getVerifica(req: Request, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.analisi.verificaCollegamenti(idGdo, {
        esito: req.query.esito,
        tipo: req.query.tipo,
        pagina: numero(req.query.pagina),
        dimensione: numero(req.query.dimensione),
      }));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async putCambiaCollegamento(req: Request, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.collegamenti.cambiaCollegamento(idGdo, req.body, this.idUtente(req)));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /** Avvia la ricerca delle posizioni e risponde subito: l'avanzamento arriva via socket a chi l'ha avviata. */
  private async postPosizioni(req: Request, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      const idUtente = this.idUtente(req);
      if (!idUtente) throw new BadRequestError({ message: 'Utente non riconosciuto' });
      const indirizzi = await this.analisi.indirizziDaCercare(idGdo, req.body?.nonTrovate === true);
      const { stato } = await this.posizioni.avvia(idGdo, idUtente, indirizzi, {
        cerca: indirizzo => this.cerca(indirizzo),
        salva: (chiave, esito) => this.analisi.salvaRicercaPosizione(idGdo, chiave, esito, idUtente),
        notifica: (evento, statoJob) => this.emetti(eventoPosizioniRighe(statoJob.jobId, evento), statoJob, roomUtente(idUtente)),
      });
      this.sendResponse(res, HttpStatusCode.ACCEPTED, stato);
    } catch (error) {
      if (error instanceof RicercaPosizioniGiaInCorso) {
        this.sendResponse(res, HttpStatusCode.CONFLICT, { message: error.message, stato: error.stato });
        return;
      }
      this.handleError(res, error);
    }
  }

  /** Lo stato di una ricerca (?jobId=) o, senza jobId, quella attiva sulla GDO o l'ultima finita da poco. */
  private async getStatoPosizioni(req: Request, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : undefined;
      const stato = jobId ? await this.posizioni.stato(jobId, idGdo) : await this.posizioni.ultima(idGdo);
      this.sendResponse(res, HttpStatusCode.OK, { stato: stato ?? null });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async postAnnullaPosizioni(req: Request<{ jobId: string }>, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      const stato = await this.posizioni.annulla(req.params.jobId, idGdo);
      if (!stato) throw new NotFoundError({ message: 'Ricerca delle posizioni non trovata', entityType: 'RicercaPosizioni', entityId: req.params.jobId });
      this.sendResponse(res, HttpStatusCode.OK, { stato });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async putPosizione(req: Request, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaSessione(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.analisi.correggiPosizione(idGdo, req.body, this.idUtente(req)));
    } catch (error) {
      this.handleError(res, error);
    }
  }
}
