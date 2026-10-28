import crypto from 'node:crypto';
import { Transaction } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { EVENTI_WEBHOOK, STATO_TENTATIVO_WEBHOOK, STATO_WEBHOOK } from '../../../lib/enums';
import { DatabaseError, NotFoundError, ValidationError } from '../../../lib/errors';
import { WebhookAttributes, WebhookStatistiche } from '../../../lib/types';
import config from '../config';
import { sequelize } from '../db/SequelizeConnector';
import { chiamaHttp } from '../http/clienteHttp';
import { IndirizzoNonSicuroError, leggiCorpoLimitato, verificaUrlSicuro } from '../http/indirizziSicuri';
import { IWebhookService, PayloadWebhookData } from '../interfaces/IWebhookService';
import { log } from '../logger';
import { TentativoWebhookAttributes } from '../models/TentativoWebhook';
import type { ITentativoWebhookRepository } from '../repositories/TentativoWebhookRepository';
import { TentativoWebhookRepository } from '../repositories/TentativoWebhookRepository';
import type { IWebhookRepository } from '../repositories/WebhookRepository';
import { WebhookRepository } from '../repositories/WebhookRepository';

const nascondiSecret = (webhook: WebhookAttributes): WebhookAttributes => {
  const { secret_webhook, ...rest } = webhook;
  return rest;
}

/** Tetto di un singolo tentativo: un ricevente lento non tiene occupato l'invio per minuti. */
export const TIMEOUT_MASSIMO_TENTATIVO_MS = 30_000;
// La UI salva timeout_webhook in secondi (1-300), il default del modello e' in ms (30000)
const MASSIMO_SECONDI_UI = 300;
const RITARDO_RETRY_PREDEFINITO_MS = 1000;
// Del corpo della risposta si registrano solo i primi 1000 caratteri: non serve scaricarne di piu'
const MASSIMO_CORPO_RISPOSTA_BYTE = 4096;

/** Tempo massimo di un tentativo in ms, fra 1 s e TIMEOUT_MASSIMO_TENTATIVO_MS. */
export function timeoutTentativoMs(timeoutWebhook: number | null | undefined): number {
  const valore = Number(timeoutWebhook);
  if (!Number.isFinite(valore) || valore <= 0) return TIMEOUT_MASSIMO_TENTATIVO_MS;
  const ms = valore <= MASSIMO_SECONDI_UI ? valore * 1000 : valore;
  return Math.min(Math.max(ms, 1000), TIMEOUT_MASSIMO_TENTATIVO_MS);
}

/** L'URL di un webhook non deve portare il server verso se stesso o i metadati del cloud. */
async function verificaUrlWebhook(url: string): Promise<void> {
  try {
    await verificaUrlSicuro(url);
  } catch (error) {
    if (!(error instanceof IndirizzoNonSicuroError)) throw error;
    throw new ValidationError({
      message: error.motivo === 'protocollo' ? 'URL non valido: sono ammessi solo indirizzi http o https' : `URL non valido: ${error.message}`,
      field: 'url_Webhook'
    });
  }
}

type EsitoTentativo = {
  stato: STATO_TENTATIVO_WEBHOOK.SUCCESSO | STATO_TENTATIVO_WEBHOOK.FALLITO;
  /** Solo i fallimenti temporanei (rete, timeout, 5xx, DNS) si ritentano. */
  ritentabile: boolean;
  httpStatus?: number;
  responseBody?: string;
  errorMessage?: string;
};

export class WebhookService implements IWebhookService {

  constructor(
    private readonly webhookRepository: IWebhookRepository = new WebhookRepository(),
    private readonly tentativoWebhookRepository: ITentativoWebhookRepository = new TentativoWebhookRepository()
  ) {}

  /* ================================
   * OPERAZIONI CRUD
   * ================================ */

  async creaWebhook(datiWebhook: Partial<WebhookAttributes>, creatoBy: string): Promise<WebhookAttributes> {
    // Validazioni prima della transazione: il controllo dell'URL interroga il DNS
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

    await verificaUrlWebhook(datiWebhook.url_webhook);

    const transaction: Transaction = await sequelize.transaction();

    try {
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
    // Validazione dell'URL prima della transazione: interroga il DNS
    if (datiAggiornamento.url_webhook) {
      await verificaUrlWebhook(datiAggiornamento.url_webhook);
    }

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

      // Impedisce l'aggiornamento del secret
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

  /**
   * Programma l'invio e torna subito: chi pubblica non aspetta i tentativi dei webhook
   * (spec revisione-pubblicazione-runtime: un webhook fallito non invalida la pubblicazione).
   * L'esito di ogni tentativo resta nei tentativi del webhook.
   */
  async scatenaEvento(payloadData: PayloadWebhookData): Promise<void> {
    this.consegnaEvento(payloadData).catch(error => {
      log.error('Errore scatenamento evento webhook', error instanceof Error ? error : new Error(String(error)), { evento: payloadData?.evento });
    });
  }

  private async consegnaEvento(payloadData: PayloadWebhookData): Promise<void> {
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
    await Promise.allSettled(webhooks.map(webhook => this.inviaWebhook(webhook, payload)));

    log.info(`Evento '${evento}' inviato a ${webhooks.length} webhook`);
  }

  /** Vero se un tentativo e' andato a buon fine. maxTentativi limita i retry configurati (il test ne fa uno). */
  private async inviaWebhook(webhook: WebhookAttributes, payload: any, maxTentativi = Math.max(1, (Number(webhook.retry_count_webhook) || 0) + 1)): Promise<boolean> {
    const tempoInizio = Date.now();
    const timeoutMs = timeoutTentativoMs(webhook.timeout_webhook);
    const corpo = JSON.stringify(payload);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Istanta2GDOSuite-Webhook/1.0',
      'X-Webhook-Event': payload.evento,
      'X-Webhook-ID': webhook.id_webhook,
      'X-Webhook-Timestamp': payload.timestamp,
      ...webhook.headers_personalizzati_webhook,
      // Stesso id a ogni tentativo: il ricevente scarta i duplicati di un retry. Dopo gli header
      // personalizzati, perche' non si possa sovrascrivere
      'X-Webhook-Delivery-Id': payload.id
    };

    if (webhook.secret_webhook) {
      headers['X-Webhook-Signature'] = this.generaFirma(payload, webhook.secret_webhook);
    }

    for (let tentativo = 1; tentativo <= maxTentativi; tentativo++) {
      const esito = await this.eseguiTentativo(webhook.url_webhook, headers, corpo, timeoutMs);
      const ultimo = tentativo >= maxTentativi;
      const ritenta = esito.ritentabile && !ultimo;

      await this.registraTentativo(webhook.id_webhook, payload.id, tentativo,
        ritenta ? STATO_TENTATIVO_WEBHOOK.RETRY : esito.stato, {
        httpStatus: esito.httpStatus,
        responseBody: esito.responseBody,
        errorMessage: esito.errorMessage,
        durationMs: Date.now() - tempoInizio
      });

      if (esito.stato === STATO_TENTATIVO_WEBHOOK.SUCCESSO) {
        log.info(`Webhook inviato con successo`, { webhookId: webhook.id_webhook, url: webhook.url_webhook, evento: payload.evento, tentativo, status: esito.httpStatus });
        return true;
      }

      if (!ritenta) {
        log.error(`Webhook fallito definitivamente`, { webhookId: webhook.id_webhook, url: webhook.url_webhook, evento: payload.evento, tentativi: tentativo, status: esito.httpStatus, errore: esito.errorMessage });
        return false;
      }

      const delay = this.calcolaDelayRetry(tentativo, Number(webhook.retry_delay_webhook) > 0 ? Number(webhook.retry_delay_webhook) : RITARDO_RETRY_PREDEFINITO_MS);
      log.warn(`Webhook fallito, retry tra ${delay}ms`, { webhookId: webhook.id_webhook, url: webhook.url_webhook, tentativo, status: esito.httpStatus, errore: esito.errorMessage });
      await this.aspetta(delay);
    }
    return false;
  }

  /** Un POST al ricevente: 2xx successo; 3xx e 4xx falliti senza retry; rete, timeout e 5xx da ritentare. */
  private async eseguiTentativo(url: string, headers: Record<string, string>, corpo: string, timeoutMs: number): Promise<EsitoTentativo> {
    try {
      // Ricontrollato a ogni tentativo: il nome puo' risolvere altrove rispetto al salvataggio
      await verificaUrlSicuro(url);
      // I retry li governa la configurazione del webhook, non il client
      const risposta = await chiamaHttp(url, { method: 'POST', headers, body: corpo, timeoutMs, idempotente: false, redirect: 'manual' });
      const responseBody = (await leggiCorpoLimitato(risposta, MASSIMO_CORPO_RISPOSTA_BYTE, { tronca: true }).catch(() => '')).substring(0, 1000);

      if (risposta.status >= 200 && risposta.status < 300) {
        return { stato: STATO_TENTATIVO_WEBHOOK.SUCCESSO, ritentabile: false, httpStatus: risposta.status, responseBody };
      }
      if (risposta.status >= 300 && risposta.status < 400) {
        // I redirect non si seguono: potrebbero portare verso la rete interna, e un POST ripetuto altrove non e' atteso
        return {
          stato: STATO_TENTATIVO_WEBHOOK.FALLITO, ritentabile: false, httpStatus: risposta.status, responseBody,
          errorMessage: `Redirect verso ${risposta.headers.get('location') ?? '?'} non seguito: aggiornare l'URL del webhook`
        };
      }
      return { stato: STATO_TENTATIVO_WEBHOOK.FALLITO, ritentabile: risposta.status >= 500, httpStatus: risposta.status, responseBody };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Un indirizzo vietato resta tale: ritentare non serve. Il DNS che non risponde invece si'
      if (error instanceof IndirizzoNonSicuroError) {
        return { stato: STATO_TENTATIVO_WEBHOOK.FALLITO, ritentabile: error.motivo === 'dns', errorMessage };
      }
      // Rete, timeout (ErroreHttp) o errore inatteso: si ritenta come prima
      return { stato: STATO_TENTATIVO_WEBHOOK.FALLITO, ritentabile: true, errorMessage };
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

  /** Prova dalla UI: aspetta l'esito di un solo tentativo, firmato come gli eventi veri. */
  async testaWebhook(idWebhook: string, datiTest?: any): Promise<boolean> {
    try {
      // Con il secret: la prova deve passare la verifica della firma del ricevente
      const webhook = (await this.webhookRepository.findById(idWebhook))?.toJSON() as WebhookAttributes | undefined;
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

      // Un tentativo solo: chi prova dalla UI non aspetta i retry configurati
      return await this.inviaWebhook(webhook, payload, 1);
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
