import dayjs from 'dayjs';
import { Request as ExpressRequest, Response } from 'express';
import 'express-session';
import { CATEGORIA_ATTIVITA, HttpStatusCode, STATO_PROMO, TIPO_ATTIVITA } from '../../../lib/enums';
import { ExternalApiError } from '../../../lib/errors';
import type { SaveMenaboLayoutRequest } from '../../../lib/types';
import { BaseController } from '../base/BaseController';
import config from '../config';
import { UpdatePromoDTO } from '../dto';
import { IGdoService } from '../interfaces/IGdoService';
import { IImpostazioniService } from '../interfaces/IImpostazioniService';
import { IPromoService } from '../interfaces/IPromoService';
import { log } from '../logger';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';

import { AuditLogService } from '../services/AuditLogService';
import { esitoIstanta, verificaRisposta } from '../utils/rispostaServizi';
import { ServerUtils } from '../utils/ServerUtils';

// UpdateVolData.ashx: un volantino che Correggo non ha ancora non e un errore
const aggiornamentoCorreggoRiuscito = (d: any): boolean =>
  String(d?.error_detail ?? '').includes('volantino_non_trovato') ||
  (typeof d === 'object' && d !== null && d.result !== 'error' && d.result !== false && d.esito !== false && !d.error_detail);

// eliminaPromo definitiva: una promo che Istanta non ha piu e gia eliminata, si completa la cancellazione locale
const eliminazioneIstantaRiuscita = (d: any): boolean => esitoIstanta(d) || d?.error === 'promo_not_found';

export class PromoController extends BaseController {
  constructor(
    private promoService: IPromoService,
    private impostazioniService: IImpostazioniService,
    private gdoService: IGdoService
  ) {
    super('/api');
  }

  /*************************************
   * Route registration
   *************************************/
  protected setupRoutes(): void {
    this.initializeRoutes();
  }

  public initializeRoutes(): void {
    // Health check
    this.router.get('/promo/ping', authMiddleware, this.ping.bind(this));

    // Promo collection (static routes BEFORE parameterized)
    this.router.get('/promo', authMiddleware, permissionGuard('promo.visualizza'), this.getAllPromos.bind(this));
    this.router.get('/promo/filtered', authMiddleware, permissionGuard('promo.visualizza'), this.getAllPromosFiltered.bind(this));
    this.router.get('/promo/in-corso', authMiddleware, permissionGuard('promo.visualizza'), this.getAllPromosInCorso.bind(this));
    this.router.get('/promo/timeline', authMiddleware, permissionGuard('promo.visualizza'), this.getAllPromosTimeline.bind(this));
    this.router.get('/promo/storico', authMiddleware, permissionGuard('promo.visualizza'), this.getAllPromosStorico.bind(this));
    this.router.get('/promo/contesto', authMiddleware, permissionGuard('promo.crea'), this.getContestoPerNuovaLavorazione.bind(this));
    this.router.get('/promo/contesto-importazione', authMiddleware, permissionGuard('promo.crea'), this.get_contesto_per_importazione.bind(this));
    this.router.get('/promo/visibilita-opzioni', authMiddleware, permissionGuard('promo.visualizza'), this.getVisibilitaOpzioni.bind(this));
    this.router.get('/promo/dashboard', authMiddleware, permissionGuard('promo.visualizza'), this.getPromozioniInCorsoPerDashboard.bind(this));

    // Promo creation
    this.router.post('/promo', authMiddleware, permissionGuard('promo.crea'), this.inizioNuovaLavorazione.bind(this));
    // Promo by ID (parameterized routes)
    this.router.get("/promo/nome/:nomePromo", authMiddleware, permissionGuard('promo.visualizza'), this.getPromoByNome.bind(this))
    this.router.put('/promo/:id', authMiddleware, permissionGuard('promo.modifica'), this.updatePromo.bind(this));
    this.router.delete('/promo/:id',
      authMiddleware,
      permissionGuard("promo.elimina"),
      this.deletePromo.bind(this)
    );
    this.router.delete(
      '/promo/:id/stato/:stato',
      authMiddleware,
      permissionGuard("promo.elimina"),
      this.deleteLavorazione.bind(this)
    );
    this.router.get("/promo/menabo", authMiddleware, this.getDatoPerMenabo.bind(this))
    this.router.get('/promo/:idPromo/menabo-layout', authMiddleware, this.getMenaboLayout.bind(this));
    this.router.put('/promo/:idPromo/menabo-layout', authMiddleware, permissionGuard('promo.modifica'), this.saveMenaboLayout.bind(this));
    this.router.post('/promo/:idPromo/export/xlsx', authMiddleware, permissionGuard('promo.visualizza'), this.exportMenaboExcel.bind(this));
    this.router.post('/promo/:idPromo/export/indesign-json', authMiddleware, permissionGuard('promo.visualizza'), this.exportIndesignPluginJson.bind(this));
    this.router.get('/promo/:idPromo', authMiddleware, permissionGuard('promo.visualizza'), this.getPromoById.bind(this));
  }

  /*************************************
   * LEGACY – newly‑ported handlers
   *************************************/
  private ping(_req: ExpressRequest, res: Response): void {
    res.status(HttpStatusCode.OK).json({ message: 'pong' });
  }


  private async getPromoByNome(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const nomePromo = req.params.nomePromo as string;
      if (nomePromo == undefined || nomePromo == "") {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, {
          message: "Il nome della promo non è presente"
        });
      }
      const promos = await this.promoService.getPromoByNome(nomePromo);
      this.sendResponse(res, HttpStatusCode.OK, promos);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }




  private async getAllPromosTimeline(req: ExpressRequest, res: Response): Promise<void> {

    try {
      const promos = await this.promoService.getAllPromoTimeline();
      this.sendResponse(res, HttpStatusCode.OK, promos);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getAllPromos(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const promos = await this.promoService.getAllPromo();
      this.sendResponse(res, HttpStatusCode.OK, promos);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getAllPromosFiltered(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const {
        page,
        pageSize,
        search,
        stato,
        validitaDal,
        validitaAl,
        validitaAlFrom,
        validitaAlTo,
        excludeStato,
        sortBy,
        sortDirection
      } = req.query;

      const result = await this.promoService.getAllPromoFiltered({
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
        search: search as string,
        stato: stato as string,
        validitaDal: validitaDal as string,
        validitaAl: validitaAl as string,
        validitaAlFrom: validitaAlFrom as string,
        validitaAlTo: validitaAlTo as string,
        excludeStato: excludeStato as string,
        sortBy: sortBy as 'nome' | 'validita_dal' | 'validita_al' | 'stato' | undefined,
        sortDirection: sortDirection as 'asc' | 'desc' | undefined
      });

      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getAllPromosInCorso(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const promos = await this.promoService.getAllPromo();
      const promosInCorso = promos
        .filter(
          (promo) =>
            promo.stato !== STATO_PROMO.VALIDA &&
            promo.stato !== STATO_PROMO.VALIDA_CON_ERRORI &&
            promo.stato !== STATO_PROMO.ARCHIVIATA
        )
        .sort((a, b) => {
          const dateA = a.data_registrazione ? new Date(a.data_registrazione).getTime() : 0;
          const dateB = b.data_registrazione ? new Date(b.data_registrazione).getTime() : 0;
          return dateB - dateA;
        });
      this.sendResponse(res, HttpStatusCode.OK, promosInCorso);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getAllPromosStorico(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const promos = await this.promoService.getAllPromoStorico();
      this.sendResponse(res, HttpStatusCode.OK, promos);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getPromoById(req: ExpressRequest<{ idPromo: string }>, res: Response): Promise<void> {
    try {
      const promo = await this.promoService.getPromoById(req.params.idPromo);
      if (!promo) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Promo not found' });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, promo);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async updatePromo(req: ExpressRequest<{ id: string }>, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const data = req.body as UpdatePromoDTO & { id: string };
      data.id = id;
      const dataPerIstanta: any = {
        ...(id && { guid_id: id }),
        ...(data.nome && { nomePromo: data.nome }),
        dataRegistrazione: new Date(),
        ...(data.validita_dal && { validitaDal: dayjs(data.validita_dal).toDate() }),
        ...(data.validita_al && { validitaAl: dayjs(data.validita_al).toDate() }),
        ...(data.data_scadenza && { dataScadenza: dayjs(data.data_scadenza).toDate() }),
        ...(data.context !== undefined && data.context !== null ? { context: data.context } : { context: [] }),
      };
      verificaRisposta(
        await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
          req,
          `${config.ISTANTA_IP_ADDRESS}/FicoProcess/aggiornaPromo`,
          'PUT',
          dataPerIstanta
        ),
        'ISTANTA',
        '/FicoProcess/aggiornaPromo'
      );
      const formdataCorreggo = new FormData();
      formdataCorreggo.append('guid_id', data.id);
      if (data.nome) formdataCorreggo.append('nomePromo', data.nome);
      if (data.validita_dal) formdataCorreggo.append('validitaDal', dayjs(data.validita_dal).toISOString());
      if (data.validita_al) formdataCorreggo.append('validitaAl', dayjs(data.validita_al).toISOString());
      if (data.data_scadenza) formdataCorreggo.append('dataScadenza', dayjs(data.data_scadenza).toISOString());
      //if (data.context) formdataCorreggo.append('context', JSON.stringify(data.context));
      formdataCorreggo.append('dataRegistrazione', dayjs().toISOString());
      // Aggiungi qui gli altri campi se necessario
      // formdataCorreggo.append('altroCampo', data.altroCampo);
      // Correggo non blocca: Istanta e gia aggiornata, l'operatore riceve un avviso
      const avvisi: string[] = [];
      if (config.CORREGGO_IP_ADDRESS) {
        try {
          verificaRisposta(
            await ServerUtils.sendToFICOApi(req, `${config.CORREGGO_IP_ADDRESS}/UpdateVolData.ashx`, 'POST', formdataCorreggo),
            'CORREGGO',
            '/UpdateVolData.ashx',
            aggiornamentoCorreggoRiuscito
          );
        } catch (error) {
          if (!(error instanceof ExternalApiError)) throw error;
          log.warn("Correggo non ha ricevuto l'aggiornamento della promo", { promoId: data.id, motivo: error.message });
          avvisi.push(`Correggo non ha ricevuto l'aggiornamento: ${error.message}`);
        }
      }
      const promo = await this.promoService.updatePromo(data.id, data);
      if (!promo) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Promo not found' });
        return;
      }
      AuditLogService.getInstance().configurationChanged(req, 'promo', 'update', { promoId: data.id });
      this.sendResponse(res, HttpStatusCode.OK, avvisi.length ? { ...promo, avvisi } : promo);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async deletePromo(req: ExpressRequest<{ id: string }>, res: Response): Promise<void> {
    try {
      verificaRisposta(
        await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
          req,
          `${config.ISTANTA_IP_ADDRESS}/FicoProcess/eliminaPromo/${req.params.id}/${true}`,
          'DELETE',
          undefined
        ),
        'ISTANTA',
        '/FicoProcess/eliminaPromo',
        eliminazioneIstantaRiuscita
      );
      const success = await this.promoService.deletePromo(req.params.id);
      if (!success) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Promo not found' });
        return;
      }
      AuditLogService.getInstance().configurationChanged(req, 'promo', 'delete', { promoId: req.params.id });
      this.sendResponse(res, HttpStatusCode.NO_CONTENT, null);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async deleteLavorazione(req: ExpressRequest<{ id: string; stato: string }>, res: Response): Promise<void> {
    try {
      const { id, stato } = req.params;
      // :stato e lo stato che l'operatore vede: se nel frattempo e cambiato, eliminare o ripristinare non e piu la sua scelta
      const promo = await this.promoService.getPromoById(id);
      if ((promo.stato === STATO_PROMO.ELIMINATA) !== (stato === STATO_PROMO.ELIMINATA)) {
        this.sendResponse(res, HttpStatusCode.CONFLICT, { message: 'Lo stato della promo è cambiato, ricarica la pagina' });
        return;
      }
      let result: boolean | null = null;
      if (stato === STATO_PROMO.ELIMINATA) {
        verificaRisposta(
          await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
            req,
            `${config.ISTANTA_IP_ADDRESS}/FicoProcess/restore/${id}`,
            'GET',
            undefined
          ),
          'ISTANTA',
          '/FicoProcess/restore'
        );
        result = await this.promoService.riportaInLavorazionePromo(id);
      } else {
        verificaRisposta(
          await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
            req,
            `${config.ISTANTA_IP_ADDRESS}/FicoProcess/eliminaPromo/${id}/${false}`,
            'DELETE',
            undefined
          ),
          'ISTANTA',
          '/FicoProcess/eliminaPromo'
        );
        result = await this.promoService.deleteNonPermanentePromo(id);
      }
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async inizioNuovaLavorazione(req: ExpressRequest, res: Response): Promise<void> {
    try {
      if (!req.session?.id_utente) {
        this.sendResponse(res, HttpStatusCode.UNAUTHORIZED, { message: 'User not authenticated' });
        return;
      }
      const result = await this.promoService.inizioNuovaLavorazione(req.body, req.session.id_utente, req);

      await ServerUtils.CREA_ATTIVITA(
        req.session.id_utente as string,
        TIPO_ATTIVITA.CREAZIONE_LAVORAZIONE,
        CATEGORIA_ATTIVITA.PRODUZIONE,
        {
          nomePromo: result.nome || req.body.titolo,
          id_promo: result.id,
        }
      );

      AuditLogService.getInstance().configurationChanged(req, 'promo', 'create', { promoId: result.id });
      this.sendResponse(res, HttpStatusCode.CREATED, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getContestoPerNuovaLavorazione(req: ExpressRequest, res: Response): Promise<void> {
    try {
      if (!req.session?.id_utente) {
        this.sendResponse(res, HttpStatusCode.UNAUTHORIZED, { message: 'User not authenticated' });
        return;
      }
      const result = await this.promoService.getContestoPerNuovaLavorazione(req);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private getVisibilitaOpzioni(_req: ExpressRequest, res: Response): void {
    this.sendResponse(res, HttpStatusCode.OK, this.promoService.getVisibilitaOpzioni());
  }

  private async get_contesto_per_importazione(req: ExpressRequest, res: Response): Promise<void> {
    try {
      if (!req.session?.id_utente) {
        this.sendResponse(res, HttpStatusCode.UNAUTHORIZED, { message: 'User not authenticated' });
        return;
      }
      const result = await this.promoService.get_contesto_per_importazione(req);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }


  private async getPromozioniInCorsoPerDashboard(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const result = await this.promoService.getPromozioniInCorsoPerDashboard();
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getDatoPerMenabo(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const idPromo = req.query.idPromo as string;
      const canale = typeof req.query.canale === 'string' ? req.query.canale : undefined;
      const result = await this.promoService.getDatoPerMenabo(idPromo, canale);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getMenaboLayout(req: ExpressRequest<{ idPromo: string }>, res: Response): Promise<void> {
    try {
      const result = await this.promoService.getMenaboLayout(req.params.idPromo);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async saveMenaboLayout(req: ExpressRequest<{ idPromo: string }>, res: Response): Promise<void> {
    try {
      const payload = req.body as SaveMenaboLayoutRequest;
      const result = await this.promoService.saveMenaboLayout(req.params.idPromo, payload);
      AuditLogService.getInstance().configurationChanged(req, 'promo_menabo_layout', 'set', { promoId: req.params.idPromo });
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async exportMenaboExcel(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const { layout } = req.body as { layout: import('../../../lib/types').MenaboLayoutDivisioneSalvata };
      const buffer = await this.promoService.generateMenaboExcel(layout);
      const filename = `menabo_${req.params.idPromo}_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async exportIndesignPluginJson(req: ExpressRequest, res: Response): Promise<void> {
    try {
      const { layout } = req.body as { layout: import('../../../lib/types').MenaboLayoutDivisioneSalvata };
      const payload = await this.promoService.generateIndesignPluginJson(layout);
      this.sendResponse(res, HttpStatusCode.OK, payload);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

}
