import axios from 'axios';
import crypto from 'node:crypto';
import { Transaction } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { EVENTI_WEBHOOK, STATO_TENTATIVO_WEBHOOK, STATO_WEBHOOK } from '../../../lib/enums';
import { DatabaseError, NotFoundError, ValidationError } from '../../../lib/errors';
import { WebhookAttributes, WebhookStatistiche } from '../../../lib/types';
import config from '../config';
import { sequelize } from '../db/SequelizeConnector';
import { IWebhookService, PayloadWebhookData } from '../interfaces/IWebhookService';
import { log } from '../logger';
import { TentativoWebhookAttributes } from '../models/TentativoWebhook';
import type { ITentativoWebhookRepository } from '../repositories/TentativoWebhookRepository';
import { TentativoWebhookRepository } from '../repositories/TentativoWebhookRepository';
import type { IWebhookRepository } from '../repositories/WebhookRepository';
import { WebhookRepository } from '../repositories/WebhookRepository';

const nascondiSecret = (webhook: WebhookAttributes): WebhookAttributes => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { secret_webhook, ...rest } = webhook;
  return rest;
}

export class WebhookService implements IWebhookService {

  constructor(
    private readonly webhookRepository: IWebhookRepository = new WebhookRepository(),
    private readonly tentativoWebhookRepository: ITentativoWebhookRepository = new TentativoWebhookRepository()
  ) {}

  /* ================================
   * OPERAZIONI CRUD
   * ================================ */

  async creaWebhook(datiWebhook: Partial<WebhookAttributes>, creatoBy: string): Promise<WebhookAttributes> {
    const transaction: Transaction = await sequelize.transaction();

    try {
      // Validazioni
      if (!datiWebhook.nome_webhook || !datiWebhook.url_webhook) {
        throw new ValidationError({
          message: 'Nome e URL sono obbligatori',
          field: !datiWebhook.nome_webhook ? 'nome_webhook' : 'url_webhook'
        });
      }

      if (!datiWebhook.eventi_webhook || datiWebhook.eventi_webhook.length === 0) {
        throw new ValidationError({
          message: 'Almeno un evento deve essere specificato',
          field: 'eventi_webhook'
        });
      }

      // Valida URL
      try {
        new URL(datiWebhook.url_webhook);
      } catch {
        throw new ValidationError({
          message: 'URL non valido',
          field: 'url_Webhook'
        });
      }

      const webhookData: Partial<WebhookAttributes> = {
        ...datiWebhook,
        secret_webhook: this.generaSecret(),
        createdby_webhook: creatoBy,
        stato_webhook: datiWebhook.stato_webhook || STATO_WEBHOOK.ATTIVO
      };

      // Assicuriamoci che id_Webhook sia definito
      const webhookData2: WebhookAttributes = {
        ...webhookData as any,
        id_webhook: webhookData.id_webhook || uuidv4()
      };

      const webhook = await this.webhookRepository.create(webhookData2);

      await transaction.commit();

      log.info('Webhook creato con successo:', {
        id: webhook.id_webhook,
        url: webhook.url_webhook,
        eventi: webhook.eventi_webhook
      });

      return webhook.toJSON();
    } catch (error) {
      await transaction.rollback();

      if (error instanceof ValidationError) {
        throw error;
      }

      log.error('Errore nella creazione del webhook:', error);
      throw new DatabaseError({
        message: 'Errore durante la creazione del webhook',
        operation: 'create',
        entity: 'Webhook',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async aggiornaWebhook(idWebhook: string, datiAggiornamento: Partial<WebhookAttributes>): Promise<WebhookAttributes> {
    const transaction: Transaction = await sequelize.transaction();

    try {
      const webhook = await this.webhookRepository.findById(idWebhook);

      if (!webhook) {
        throw new NotFoundError({
          message: 'Webhook non trovato',
          entityType: 'Webhook',
          entityId: idWebhook
        });
      }

      // Validazioni se si sta aggiornando l'URL
      if (datiAggiornamento.url_webhook) {
        try {
          new URL(datiAggiornamento.url_webhook);
        } catch {
          throw new ValidationError({
            message: 'URL non valido',
            field: 'url_Webhook'
          });
        }
      }

      // Impedisce l'aggiornamento del secret
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { secret_webhook, ...datiDaAggiornare } = datiAggiornamento;

      await this.webhookRepository.update(idWebhook, {
        ...datiDaAggiornare,
        updatedat_webhook: new Date()
      } as Partial<WebhookAttributes>);

      await transaction.commit();

      log.info('Webhook aggiornato:', { id: idWebhook });

      const updatedWebhookJson = webhook.toJSON();
      delete (updatedWebhookJson as Partial<WebhookAttributes>).secret_webhook;
      return updatedWebhookJson;
    } catch (error) {
      await transaction.rollback();

      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      log.error('Errore aggiornamento webhook:', error);
      throw new DatabaseError({
        message: 'Errore durante l\'aggiornamento del webhook',
        operation: 'update',
        entity: 'Webhook',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async eliminaWebhook(idWebhook: string): Promise<boolean> {
    const transaction: Transaction = await sequelize.transaction();

    try {
      // Prima elimina tutti i tentativi associati
      await this.tentativoWebhookRepository.deleteByWebhookId(idWebhook);

      // Poi elimina il webhook
      const deleted = await this.webhookRepository.delete(idWebhook);

      if (!deleted) {
        throw new NotFoundError({
          message: 'Webhook non trovato',
          entityType: 'Webhook',
          entityId: idWebhook
        });
      }

      await transaction.commit();
      log.info('Webhook eliminato:', { id: idWebhook });
      return true;
    } catch (error) {
      await transaction.rollback();

      if (error instanceof NotFoundError) {
        throw error;
      }

      log.error('Errore eliminazione webhook:', error);
      return false;
    }
  }

  async ottieniWebhook(idWebhook: string): Promise<WebhookAttributes | null> {
    try {
      const webhook = await this.webhookRepository.findById(idWebhook);
      if (!webhook) return null;
      const webhookData = webhook.toJSON();
      return nascondiSecret(webhookData);
    } catch (error) {
      log.error('Errore recupero webhook:', error);
      throw new DatabaseError({
        message: 'Errore durante il recupero del webhook',
        operation: 'findById',
        entity: 'Webhook',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async ottieniTuttiWebhook(filtri?: { attivo?: boolean; creatoBy?: string; }): Promise<WebhookAttributes[]> {
    try {
      let webhooks;

      if (filtri?.attivo !== undefined && filtri?.creatoBy) {
        // Usa paginazione con filtri combinati
        const result = await this.webhookRepository.findPaginatedWithFilters({
          page: 1,
          pageSize: 1000,
          filters: {
            stato: filtri.attivo ? STATO_WEBHOOK.ATTIVO : STATO_WEBHOOK.DISATTIVO,
            createdBy: filtri.creatoBy
          },
          sortBy: 'createdat_webhook',
          sortDirection: 'desc'
        });
        webhooks = result.data;
      } else if (filtri?.attivo !== undefined) {
        webhooks = await this.webhookRepository.findByStato(
          filtri.attivo ? STATO_WEBHOOK.ATTIVO : STATO_WEBHOOK.DISATTIVO
        );
      } else if (filtri?.creatoBy) {
        webhooks = await this.webhookRepository.findByCreatedBy(filtri.creatoBy);
      } else {
        webhooks = await this.webhookRepository.findAll();
      }

      return webhooks.map(w => nascondiSecret(w.toJSON()));
    } catch (error) {
      log.error('Errore recupero webhooks:', error);
      throw new DatabaseError({
        message: 'Errore durante il recupero dei webhook',
        operation: 'findAll',
        entity: 'Webhook',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  /* ================================
   * INVIO EVENTI
   * ================================ */

  async scatenaEvento(payloadData: PayloadWebhookData): Promise<void> {
    try {
      const { evento, dati, meta } = payloadData;

      const payload = {
        id: uuidv4(),
        evento,
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV || 'development',
        versione: '1.0.0',
        dati,
        meta
      };

      const webhooks = await this.ottieniWebhookPerEvento(evento);

      if (webhooks.length === 0) {
        log.debug('Nessun webhook configurato per l\'evento', { evento });
        return;
      }

      // Invia in parallelo a tutti i webhook
      const promises = webhooks.map(webhook =>
        this.inviaWebhook(webhook, payload)
      );

      await Promise.allSettled(promises);

      log.info(`Evento '${evento}' inviato a ${webhooks.length} webhook`);
    } catch (error) {
      log.error('Errore scatenamento evento:', error);
      throw new DatabaseError({
        message: 'Errore durante l\'invio dell\'evento webhook',
        operation: 'scatenaEvento',
        entity: 'Webhook',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  private async inviaWebhook(webhook: WebhookAttributes, payload: any): Promise<void> {
    const tempoInizio = Date.now();
    let tentativo = 0;
    const maxTentativi = webhook.retry_count_webhook + 1;

    while (tentativo < maxTentativi) {
      try {
        tentativo++;

        const firma = webhook.secret_webhook ?
          this.generaFirma(payload, webhook.secret_webhook) : '';

        const headers: any = {
          'Content-Type': 'application/json',
          'User-Agent': 'Istanta2GDOSuite-Webhook/1.0',
          'X-Webhook-Event': payload.evento,
          'X-Webhook-ID': webhook.id_webhook,
          'X-Webhook-Timestamp': payload.timestamp,
          ...webhook.headers_personalizzati_webhook
        };

        if (firma) {
          headers['X-Webhook-Signature'] = firma;
        }

        const response = await axios.post(webhook.url_webhook, payload, {
          headers,
          timeout: webhook.timeout_webhook,
          validateStatus: (status) => status < 500
        });

        // Successo (2xx)
        if (response.status >= 200 && response.status < 300) {
          await this.registraTentativo(webhook.id_webhook, payload.id, tentativo, STATO_TENTATIVO_WEBHOOK.SUCCESSO, {
            httpStatus: response.status,
            responseBody: response.data ? JSON.stringify(response.data).substring(0, 1000) : '',
            durationMs: Date.now() - tempoInizio
          });

          log.info(`Webhook inviato con successo`, { webhookId: webhook.id_webhook, url: webhook.url_webhook, evento: payload.evento, tentativo, status: response.status });
          return; // Esce dal ciclo while
        }

        // Errore client (4xx) - non fare retry
        const isUltimoTentativo = tentativo >= maxTentativi;
        await this.registraTentativo(webhook.id_webhook, payload.id, tentativo, STATO_TENTATIVO_WEBHOOK.FALLITO, {
          httpStatus: response.status,
          responseBody: response.data ? JSON.stringify(response.data).substring(0, 1000) : '',
          durationMs: Date.now() - tempoInizio
        });

        log.warn(`Webhook fallito con errore client (non ritento)`, { webhookId: webhook.id_webhook, status: response.status, tentativo });
        return; // Esce dal ciclo while

      } catch (error: any) {
        const isUltimoTentativo = tentativo >= maxTentativi;
        const shouldRetry = !isUltimoTentativo && this.dovrebbeRitentare(error);

        await this.registraTentativo(webhook.id_webhook, payload.id, tentativo,
          shouldRetry ? STATO_TENTATIVO_WEBHOOK.RETRY : STATO_TENTATIVO_WEBHOOK.FALLITO, {
          httpStatus: error.response?.status,
          errorMessage: error.message,
          responseBody: error.response?.data ?
            JSON.stringify(error.response.data).substring(0, 1000) : '',
          durationMs: Date.now() - tempoInizio
        });

        if (isUltimoTentativo || !shouldRetry) {
          log.error(`Webhook fallito definitivamente`, { webhookId: webhook.id_webhook, url: webhook.url_webhook, evento: payload.evento, tentativi: tentativo, errore: error.message });
          return; // Esce dal ciclo
        }

        // Aspetta e ritenta
        const delay = this.calcolaDelayRetry(tentativo, webhook.retry_delay_webhook);
        log.warn(`Webhook fallito, retry tra ${delay}ms`, { webhookId: webhook.id_webhook, url: webhook.url_webhook, tentativo, errore: error.message });
        await this.aspetta(delay);
      }
    }
  }

  /* ================================
   * UTILITÀ PRIVATE
   * ================================ */

  private async ottieniWebhookPerEvento(evento: EVENTI_WEBHOOK): Promise<WebhookAttributes[]> {
    try {
      const webhooks = await this.webhookRepository.findActiveByEvento(evento);
      return webhooks.map(w => w.toJSON());
    } catch (error) {
      log.error('Errore recupero webhook per evento:', error);
      return [];
    }
  }

  private async registraTentativo(
    webhookId: string,
    payloadId: string,
    numeroTentativo: number,
    stato: STATO_TENTATIVO_WEBHOOK,
    dettagli: {
      httpStatus?: number;
      responseBody?: string;
      errorMessage?: string;
      durationMs: number;
    }
  ): Promise<void> {
    try {
      await this.tentativoWebhookRepository.create({
        webhook_id_tentativo: webhookId,
        payload_id_tentativo: payloadId,
        numero_tentativo_tentativo: numeroTentativo,
        stato_tentativo: stato,
        http_status_tentativo: dettagli.httpStatus,
        response_body_tentativo: dettagli.responseBody,
        messaggio_errore_tentativo: dettagli.errorMessage,
        durata_ms_tentativo: dettagli.durationMs
      });
    } catch (error) {
      log.error('Errore registrazione tentativo webhook:', error);
    }
  }

  private async calcolaStatisticheWebhook(webhookId: string): Promise<WebhookStatistiche> {
    try {
      const tentativiInstances = await this.tentativoWebhookRepository.findByWebhookId(webhookId);
      // Sort by createdat_tentativo DESC
      const tentativi = tentativiInstances
        .map(t => t.toJSON() as TentativoWebhookAttributes)
        .sort((a, b) => {
          const dateA = a.createdat_tentativo ? new Date(a.createdat_tentativo).getTime() : 0;
          const dateB = b.createdat_tentativo ? new Date(b.createdat_tentativo).getTime() : 0;
          return dateB - dateA;
        });

      const statistiche: WebhookStatistiche = {
        chiamate_totali: tentativi.length,
        chiamate_successo: tentativi.reduce((count, t) =>
          t.stato_tentativo === STATO_TENTATIVO_WEBHOOK.SUCCESSO ? count + 1 : count, 0),
        chiamate_fallite: tentativi.reduce((count, t) =>
          (t.stato_tentativo === STATO_TENTATIVO_WEBHOOK.FALLITO ||
            t.stato_tentativo === STATO_TENTATIVO_WEBHOOK.TIMEOUT) ? count + 1 : count, 0),
        ultima_chiamata: tentativi.length > 0 ? tentativi[0].createdat_tentativo : undefined,
        ultimo_successo: tentativi.find(t => t.stato_tentativo === STATO_TENTATIVO_WEBHOOK.SUCCESSO)?.createdat_tentativo,
        ultimo_errore: tentativi.find(t =>
          t.stato_tentativo === STATO_TENTATIVO_WEBHOOK.FALLITO ||
          t.stato_tentativo === STATO_TENTATIVO_WEBHOOK.TIMEOUT
        )?.createdat_tentativo,
        ultimo_messaggio_errore: tentativi.find(t =>
          (t.stato_tentativo === STATO_TENTATIVO_WEBHOOK.FALLITO ||
            t.stato_tentativo === STATO_TENTATIVO_WEBHOOK.TIMEOUT) &&
          t.messaggio_errore_tentativo
        )?.messaggio_errore_tentativo
      };

      return statistiche;
    } catch (error) {
      log.error('Errore calcolo statistiche webhook:', error);
      return {
        chiamate_totali: 0,
        chiamate_successo: 0,
        chiamate_fallite: 0
      };
    }
  }

  private generaFirma(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }

  private generaSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private dovrebbeRitentare(error: any): boolean {
    if (error.response?.status >= 400 && error.response?.status < 500) {
      return false;
    }
    return true;
  }

  private calcolaDelayRetry(tentativo: number, baseDelay: number): number {
    const exponentialDelay = baseDelay * Math.pow(2, tentativo - 1);
    const jitter = Math.random() * 1000;
    return Math.min(exponentialDelay + jitter, 30000);
  }

  private aspetta(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* ================================
   * OPERAZIONI PUBBLICHE
   * ================================ */

  async ottieniStatisticheWebhook(idWebhook: string): Promise<{
    statistiche_base: WebhookStatistiche;
    tentativi_recenti: TentativoWebhookAttributes[];
    punteggio_salute: number;
  }> {
    try {
      const webhook = await this.webhookRepository.findById(idWebhook);
      if (!webhook) {
        throw new NotFoundError({
          message: 'Webhook non trovato',
          entityType: 'Webhook',
          entityId: idWebhook
        });
      }

      const statistiche = await this.calcolaStatisticheWebhook(idWebhook);

      // Usa paginazione per ottenere gli ultimi 10 tentativi
      const paginatedResult = await this.tentativoWebhookRepository.findPaginatedWithFilters({
        page: 1,
        pageSize: 10,
        filters: { webhookId: idWebhook },
        sortBy: 'createdat_tentativo',
        sortDirection: 'desc'
      });
      const tentativiRecenti = paginatedResult.data.map(t => t.toJSON() as TentativoWebhookAttributes);

      const punteggioSalute = this.calcolaPunteggioSalute(statistiche);

      return {
        statistiche_base: statistiche,
        tentativi_recenti: tentativiRecenti,
        punteggio_salute: punteggioSalute
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      log.error('Errore recupero statistiche webhook:', error);
      throw new DatabaseError({
        message: 'Errore durante il recupero delle statistiche',
        operation: 'ottieniStatisticheWebhook',
        entity: 'Webhook',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  private calcolaPunteggioSalute(statistiche: WebhookStatistiche): number {
    if (statistiche.chiamate_totali === 0) return 100;

    const tassoSuccesso = (statistiche.chiamate_successo / statistiche.chiamate_totali) * 100;
    return Math.round(tassoSuccesso);
  }

  async testaWebhook(idWebhook: string, datiTest?: any): Promise<boolean> {
    try {
      const webhook = await this.ottieniWebhook(idWebhook);
      if (!webhook) {
        throw new NotFoundError({
          message: 'Webhook non trovato',
          entityType: 'Webhook',
          entityId: idWebhook
        });
      }

      const payload = {
        id: uuidv4(),
        evento: EVENTI_WEBHOOK.SISTEMA_BACKUP_COMPLETATO,
        timestamp: new Date().toISOString(),
        environment: 'test',
        versione: '1.0.0',
        dati: datiTest || {
          messaggio: 'Test webhook',
          timestamp: new Date().toISOString()
        }
      };

      await this.inviaWebhook(webhook, payload);
      return true;
    } catch (error) {
      log.error('Errore test webhook:', error);
      return false;
    }
  }

  async validaFirmaWebhook(payload: string, firma: string, secret: string): Promise<boolean> {
    try {
      const firmaAttesa = this.generaFirma(JSON.parse(payload), secret);
      return crypto.timingSafeEqual(
        Buffer.from(firma),
        Buffer.from(firmaAttesa)
      );
    } catch (error) {
      return false;
    }
  }
}
