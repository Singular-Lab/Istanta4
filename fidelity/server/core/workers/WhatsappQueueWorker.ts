import { Worker as BullMQWorker } from 'bullmq';
import { Op, Transaction } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';
import { GDOWhatsappQueueJob } from '../models/whatsapp/gdo_whatsapp_message_queue';
import { GDOWhatsappQueueJobStatus } from '../../../lib/enums';
import { BusinessError, ExternalApiError, NotFoundError, ValidationError } from '../../../lib/errors';
import { ErrorCodes } from '../../../lib/errors/ErrorCodes';
import { log } from '../logger';
import { emitToClients } from '../../ws-server';
import { QUEUE_NAMES } from '../../src/shared/queue/queues.js';
import { getRedisConnectionOptions } from '../../src/shared/cache/redis.client.js';

interface BulkProgress {
    bulkId: string;
    total: number;
    success: number;
    failed: number;
    pending: number;
    startedAt?: Date; // Timestamp di quando è iniziato il primo job
}

interface WorkerOptions {
    /**
     * Numero massimo di job da processare in parallelo
     * Default: 1 (per rispettare 10 msg/min con cron ogni 6 secondi)
     */
    concurrency?: number;
    /**
     * Backoff base in millisecondi per i retry
     * Default: 60000 (1 minuto)
     */
    baseBackoffMs?: number;
    /**
     * Intervallo di polling in millisecondi
     * Default: 6000 (6 secondi = 10 messaggi al minuto)
     */
    pollIntervalMs?: number;
    /**
     * Funzione personalizzata per inviare messaggi WhatsApp
     */
    sendMessageFn?: (to: string, body: string) => Promise<void>;
    /**
     * Modalità simulazione: non invia realmente i messaggi, simula successo/fallimento
     * Default: false
     */
    simulationMode?: boolean;
    /**
     * Percentuale di errori simulati (solo in simulationMode)
     * Default: 0.1 (10% di errori)
     */
    simulationErrorRate?: number;
}

/**
 * Worker per processare la coda di messaggi WhatsApp
 * - Processa i job PENDING dalla queue
 * - Gestisce retry con exponential backoff
 * - Emette eventi WebSocket per il monitoraggio real-time
 * - Continua fino a quando tutti i job sono SUCCESS o FAILED
 */
export class WhatsappQueueWorker {
    private active = 0;
    private readonly concurrency: number;
    private readonly baseBackoffMs: number;
    private readonly pollIntervalMs: number;
    private readonly sendMessageFn: (to: string, body: string) => Promise<void>;
    private readonly simulationMode: boolean;
    private readonly simulationErrorRate: number;
    private bulkState: Map<string, BulkProgress> = new Map();
    private timer?: NodeJS.Timeout;
    private bullmqWorker?: BullMQWorker;
    private isRunning = false;

    constructor(options?: WorkerOptions) {
        this.concurrency = options?.concurrency ?? 1;
        this.baseBackoffMs = options?.baseBackoffMs ?? 60000; // 1 minuto
        this.pollIntervalMs = options?.pollIntervalMs ?? 6000; // 6 secondi
        this.simulationMode = options?.simulationMode ?? false;
        this.simulationErrorRate = options?.simulationErrorRate ?? 0.1; // 10% errori di default
        this.sendMessageFn = options?.sendMessageFn ?? this.defaultSendMessage;
    }

    /**
     * Avvia il worker
     */
    start() {
        if (this.timer) {
            log.warn('WhatsappQueueWorker già in esecuzione');
            return;
        }

        this.isRunning = true;

        const mode = this.simulationMode ? '🎭 SIMULATION MODE' : '📡 LIVE MODE';

        if (this.simulationMode) {
            log.warn(`⚠️  MODALITÀ SIMULAZIONE ATTIVA - Errori simulati: ${(this.simulationErrorRate * 100).toFixed(0)}%`);
        }

        const redisConnection = getRedisConnectionOptions();

        if (redisConnection) {
            // BullMQ Worker: elaborazione immediata al trigger da WhatsappQueueService
            this.bullmqWorker = new BullMQWorker(
                QUEUE_NAMES.WHATSAPP,
                async (job) => {
                    const bulkId = job.data?.bulk_id as string | undefined;
                    await this.tick(bulkId);
                },
                { connection: redisConnection, concurrency: this.concurrency }
            );

            let bullmqErrorLogged = false;
            this.bullmqWorker.on('error', (error) => {
                if (!bullmqErrorLogged) {
                    log.warn('BullMQ WhatsApp non disponibile, continuo con polling DB', {
                        context: 'Redis',
                        message: error instanceof Error ? error.message : String(error),
                    });
                    bullmqErrorLogged = true;
                }

                this.bullmqWorker?.close().catch(() => undefined);
                this.bullmqWorker = undefined;
            });

            // Polling fallback a bassa frequenza: recupera job non triggerati via BullMQ
            const fallbackMs = 30_000;
            this.timer = setInterval(() => {
                this.tick().catch(err => log.error('Errore nel tick del WhatsappQueueWorker:', err));
            }, fallbackMs);

            log.info(`🚀 WhatsappQueueWorker avviato con BullMQ (${mode}, concurrency: ${this.concurrency}, fallback poll: ${fallbackMs / 1000}s)`);
        } else {
            // Nessun Redis: polling classico
            this.timer = setInterval(() => {
                this.tick().catch(err => log.error('Errore nel tick del WhatsappQueueWorker:', err));
            }, this.pollIntervalMs);

            log.info(`🚀 WhatsappQueueWorker avviato con polling (${mode}, poll: ${this.pollIntervalMs}ms)`);
        }
    }

    /**
     * Ferma il worker
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
        if (this.bullmqWorker) {
            this.bullmqWorker.close().catch(err => log.error('Errore chiusura BullMQ Worker:', err));
            this.bullmqWorker = undefined;
        }
        this.isRunning = false;
        log.info('⏸️  WhatsappQueueWorker fermato');
    }

    /**
     * Verifica se il worker è in esecuzione
     */
    isActive(): boolean {
        return this.isRunning;
    }

    /**
     * Ottiene lo stato di progresso di un bulk
     */
    getBulkProgress(bulkId: string): BulkProgress | undefined {
        return this.bulkState.get(bulkId);
    }

    /**
     * Ottiene tutti gli stati dei bulk in memoria
     */
    getAllBulkProgress(): BulkProgress[] {
        return Array.from(this.bulkState.values());
    }

    /**
     * Inizializza lo stato del bulk se non esiste
     */
    private async ensureBulkState(job: typeof GDOWhatsappQueueJob.prototype) {
        const bulkId = job.bulk_id_whatsapp_queue_job;

        if (!this.bulkState.has(bulkId)) {
            // Conta i job per stato per questo bulk
            const stats = await this.getBulkStats(bulkId);

            // Trova il timestamp del primo job creato (startedAt)
            const firstJob = await GDOWhatsappQueueJob.findOne({
                where: { bulk_id_whatsapp_queue_job: bulkId },
                order: [['createdat', 'ASC']],
                attributes: ['createdat']
            });

            this.bulkState.set(bulkId, {
                bulkId,
                total: job.total_whatsapp_queue_job,
                success: stats.success,
                failed: stats.failed,
                pending: stats.pending,
                startedAt: firstJob?.createdat ? new Date(firstJob.createdat) : new Date()
            });

            log.debug(`Bulk ${bulkId} inizializzato: ${stats.success}/${stats.total} success, ${stats.failed} failed, ${stats.pending} pending`);
        }
    }

    /**
     * Ottiene le statistiche di un bulk dal database
     */
    private async getBulkStats(bulkId: string): Promise<{total: number; success: number; failed: number; pending: number}> {
        const [successCount, failedCount, pendingCount, totalCount] = await Promise.all([
            GDOWhatsappQueueJob.count({
                where: {
                    bulk_id_whatsapp_queue_job: bulkId,
                    status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.SUCCESS
                }
            }),
            GDOWhatsappQueueJob.count({
                where: {
                    bulk_id_whatsapp_queue_job: bulkId,
                    status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.FAILED
                }
            }),
            GDOWhatsappQueueJob.count({
                where: {
                    bulk_id_whatsapp_queue_job: bulkId,
                    status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.PENDING
                }
            }),
            GDOWhatsappQueueJob.count({
                where: { bulk_id_whatsapp_queue_job: bulkId }
            })
        ]);

        return {
            total: totalCount,
            success: successCount,
            failed: failedCount,
            pending: pendingCount
        };
    }

    /**
     * Emette evento WebSocket per lo stato del bulk
     * IMPORTANTE: Rilegge sempre i contatori dal database per evitare sfasamenti
     */
    private async emitBulkStatus(bulkId: string) {
        const state = this.bulkState.get(bulkId);
        if (!state) return;

        // Rileggi i contatori reali dal database invece di usare quelli in memoria
        const stats = await this.getBulkStats(bulkId);

        const { startedAt } = state;
        const { total, success, failed, pending } = stats;
        const processed = success + failed;
        const status = processed >= total ? 'COMPLETED' : 'RUNNING';

        // Calcola ETA in tempo reale
        let etaSeconds: number | null = null;
        let etaCompletion: string | null = null;

        if (status === 'RUNNING' && startedAt && processed > 0) {
            const now = new Date();
            const elapsedMs = now.getTime() - startedAt.getTime();

            if (elapsedMs > 0) {
                const elapsedSeconds = elapsedMs / 1000;
                const throughput = processed / elapsedSeconds; // job/secondo

                if (throughput > 0) {
                    const remaining = total - processed;
                    const remainingSeconds = remaining / throughput;

                    etaSeconds = Math.round(remainingSeconds);
                    etaCompletion = new Date(now.getTime() + remainingSeconds * 1000).toISOString();
                }
            }
        } else if (status === 'COMPLETED') {
            etaSeconds = 0;
            etaCompletion = new Date().toISOString();
        }

        // Emetti via WebSocket
        emitToClients('whatsapp:bulk-status', {
            bulkId,
            total,
            success,
            failed,
            pending,
            processed,
            percentuale: Math.round((processed / total) * 100),
            status,
            etaSeconds,
            etaCompletion,
        });

        log.debug(`Bulk ${bulkId}: ${success}/${total} success, ${failed} failed, ${pending} pending - ${status} (ETA: ${etaSeconds}s)`);
    }

    /**
     * Emette evento WebSocket per lo stato di un job
     */
    private emitJobStatus(
        job: typeof GDOWhatsappQueueJob.prototype,
        status: GDOWhatsappQueueJobStatus,
        error?: string
    ) {
        // Emetti via WebSocket
        emitToClients('whatsapp:job-status', {
            jobId: job.id_whatsapp_queue_job,
            bulkId: job.bulk_id_whatsapp_queue_job,
            index: job.index_whatsapp_queue_job,
            total: job.total_whatsapp_queue_job,
            telefono: job.to_whatsapp_queue_job,
            attempts: job.attempts_whatsapp_queue_job,
            status,
            error,
        });

        if (status === GDOWhatsappQueueJobStatus.SUCCESS) {
            log.debug(`✅ Job ${job.index_whatsapp_queue_job}/${job.total_whatsapp_queue_job} inviato a ${job.to_whatsapp_queue_job}`);
        } else if (status === GDOWhatsappQueueJobStatus.FAILED) {
            log.warn(`❌ Job ${job.index_whatsapp_queue_job}/${job.total_whatsapp_queue_job} fallito: ${error}`);
        }
    }

    /**
     * Tick del worker - cerca e processa job disponibili
     */
    private async tick(bulkId?: string) {
        if (this.active >= this.concurrency) {
            return;
        }

        const availableSlots = this.concurrency - this.active;
        if (availableSlots <= 0) return;

        const now = new Date();

        try {
            await sequelize.transaction(
                { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
                async (t) => {
                    const where: Record<string, any> = {
                        status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.PENDING,
                        run_at_whatsapp_queue_job: { [Op.lte]: now },
                    };
                    if (bulkId) where.bulk_id_whatsapp_queue_job = bulkId;

                    // Trova job PENDING che sono pronti per essere processati
                    const jobs = await GDOWhatsappQueueJob.findAll({
                        where,
                        limit: availableSlots,
                        order: [['run_at_whatsapp_queue_job', 'ASC'], ['createdat', 'ASC']],
                        lock: true,
                        skipLocked: true,
                        transaction: t,
                    });

                    if (!jobs.length) {
                        return;
                    }

                    log.debug(`📤 Trovati ${jobs.length} job da processare`);

                    // Marca i job come PROCESSING
                    for (const job of jobs) {
                        job.status_whatsapp_queue_job = GDOWhatsappQueueJobStatus.PROCESSING;
                        await job.save({ transaction: t });

                        await this.ensureBulkState(job);
                        this.emitJobStatus(job, GDOWhatsappQueueJobStatus.PROCESSING);

                        // Processa il job in background (non blocca la transaction)
                        this.processJob(job).catch(err =>
                            log.error(`Errore processJob ${job.id_whatsapp_queue_job}:`, err)
                        );
                    }
                }
            );
        } catch (error) {
            log.error('Errore durante il tick:', error);
        }
    }

    /**
     * Processa un singolo job
     */
    private async processJob(job: typeof GDOWhatsappQueueJob.prototype) {
        this.active++;

        try {
            // Incrementa il contatore dei tentativi
            job.attempts_whatsapp_queue_job += 1;
            await job.save();

            // Modalità simulazione o invio reale
            if (this.simulationMode) {
                await this.simulateSendMessage(job.to_whatsapp_queue_job, job.body_whatsapp_queue_job);
            } else {
                // Invio reale: recupera credenziali dal database e invia
                await this.sendWhatsAppMessage(job);
            }

            // Successo!
            job.status_whatsapp_queue_job = GDOWhatsappQueueJobStatus.SUCCESS;
            job.last_error_whatsapp_queue_job = null;
            await job.save();

            // Emetti gli aggiornamenti (i contatori vengono letti dal DB in emitBulkStatus)
            this.emitJobStatus(job, GDOWhatsappQueueJobStatus.SUCCESS);
            await this.emitBulkStatus(job.bulk_id_whatsapp_queue_job);

        } catch (err: any) {
            const msg = err?.message ?? String(err);
            log.error(`❌ Errore job ${job.id_whatsapp_queue_job} (tentativo ${job.attempts_whatsapp_queue_job}/${job.max_attempts_whatsapp_queue_job}):`, msg);

            // Retry con exponential backoff
            if (job.attempts_whatsapp_queue_job < job.max_attempts_whatsapp_queue_job) {
                const delayMs = this.baseBackoffMs * Math.pow(2, job.attempts_whatsapp_queue_job - 1);

                job.status_whatsapp_queue_job = GDOWhatsappQueueJobStatus.PENDING;
                job.run_at_whatsapp_queue_job = new Date(Date.now() + delayMs);
                job.last_error_whatsapp_queue_job = msg;
                await job.save();

                // NON modificare i contatori: rimane PENDING
                this.emitJobStatus(job, GDOWhatsappQueueJobStatus.FAILED, `retry in ${Math.floor(delayMs / 1000)}s: ${msg}`);

                log.info(`🔄 Job ${job.id_whatsapp_queue_job} riprogrammato tra ${Math.floor(delayMs / 1000)}s`);
            } else {
                // Fallimento definitivo
                job.status_whatsapp_queue_job = GDOWhatsappQueueJobStatus.FAILED;
                job.last_error_whatsapp_queue_job = msg;
                await job.save();

                // Emetti gli aggiornamenti (i contatori vengono letti dal DB in emitBulkStatus)
                this.emitJobStatus(job, GDOWhatsappQueueJobStatus.FAILED, msg);
                await this.emitBulkStatus(job.bulk_id_whatsapp_queue_job);
            }
        } finally {
            this.active--;
        }
    }

    /**
     * Simula l'invio di un messaggio WhatsApp (per testing)
     */
    private async simulateSendMessage(to: string, body: string): Promise<void> {
        

        // Simula un delay realistico (100-500ms)
        const delay = 100 + Math.random() * 400;
        await new Promise(resolve => setTimeout(resolve, delay));

        // Simula errori casuali basati su simulationErrorRate
        if (Math.random() < this.simulationErrorRate) {
            const errori = [
                'Rate limit exceeded',
                'Invalid phone number',
                'Template not found',
                'Network timeout',
                'WhatsApp API error 500'
            ];
            const errore = errori[Math.floor(Math.random() * errori.length)];
            throw new BusinessError({ message: `[SIMULATO] ${errore}`, rule: 'simulation_error' });
        }

        log.debug(`✅ [SIMULAZIONE] Messaggio "inviato" con successo a ${to}`);
    }

    /**
     * Implementazione default per l'invio di messaggi WhatsApp REALI
     * Questo metodo viene chiamato quando simulationMode = false
     *
     * @param to - Numero di telefono destinatario
     * @param body - JSON string del payload Meta API
     */
    private async defaultSendMessage(to: string, body: string): Promise<void> {
        // NOTA: Questo metodo verrà sovrascritto dal processJob che passa anche il job completo
        throw new BusinessError({ message: 'defaultSendMessage non dovrebbe essere chiamato direttamente', rule: 'internal_method_guard' });
    }

    /**
     * Invia un messaggio WhatsApp REALE recuperando le credenziali dal database
     *
     * @param job - Il job completo con campagna_id per recuperare le credenziali
     */
    private async sendWhatsAppMessage(job: typeof GDOWhatsappQueueJob.prototype): Promise<void> {
        const to = job.to_whatsapp_queue_job;
        log.info(`📡 Invio messaggio WhatsApp REALE a ${to}`);

        try {
            // 1. Recupera le credenziali dal database tramite campagna_id
            const { GDOWhatsappCampagne } = await import('../models/whatsapp/gdo_whatsapp_campagne');
            const { GDOWhatsappNumbers } = await import('../models/whatsapp/gdo_whatsapp_numbers');
            const { GDOWhatsappTemplate } = await import('../models/whatsapp/gdo_whatsapp_template');

            const campagna = await GDOWhatsappCampagne.findByPk(job.campagna_id_whatsapp_queue_job);
            if (!campagna) {
                throw new NotFoundError({ message: `Campagna ${job.campagna_id_whatsapp_queue_job} non trovata`, entityType: 'whatsapp_campagna', entityId: job.campagna_id_whatsapp_queue_job });
            }

            const template = await GDOWhatsappTemplate.findByPk(campagna.template_id_whatsapp_campagna);
            if (!template) {
                throw new NotFoundError({ message: `Template ${campagna.template_id_whatsapp_campagna} non trovato`, entityType: 'whatsapp_template', entityId: campagna.template_id_whatsapp_campagna });
            }

            const idGdo = template.id_gdo_gdowhatsapptemplate;
            const credenziali = await GDOWhatsappNumbers.findOne({
                where: { id_gdo_gdowhatsappnumbers: idGdo }
            });

            if (!credenziali) {
                throw new NotFoundError({ message: `Credenziali WhatsApp non trovate per GDO ${idGdo}`, entityType: 'whatsapp_credentials', entityId: idGdo, details: { code: ErrorCodes.WA_CREDENTIALS_MISSING } });
            }

            const phoneNumberId = credenziali.id_numero_whatsapp_gdowhatsappnumbers;
            const accessToken = credenziali.access_token_gdowhatsappnumbers;

            if (!phoneNumberId || !accessToken) {
                throw new ValidationError({ message: 'phone_number_id o access_token mancanti', field: 'whatsapp_credentials', details: { code: ErrorCodes.WA_CREDENTIALS_MISSING } });
            }

            // 2. Parse del payload Meta
            const payload = typeof job.body_whatsapp_queue_job === 'string'
                ? JSON.parse(job.body_whatsapp_queue_job)
                : job.body_whatsapp_queue_job;

            // 3. Chiamata all'API Meta Cloud
            const response = await fetch(
                `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => null) as any;
                const errorMessage = errorData?.error?.message ||
                                   errorData?.error?.error_user_msg ||
                                   response.statusText ||
                                   'Unknown error';

                log.error(`❌ Meta API Error ${response.status}:`, errorData);
                throw new ExternalApiError({ message: `WhatsApp API Error (${response.status}): ${errorMessage}`, service: 'Meta WhatsApp', endpoint: `/${phoneNumberId}/messages`, statusCode: response.status });
            }

            const data = await response.json() as any;

            if (data.messages && data.messages[0]?.id) {
                log.info(`✅ Messaggio inviato con successo a ${to}, ID: ${data.messages[0].id}`);
            } else {
                log.info(`✅ Messaggio inviato a ${to}`);
            }

        } catch (error: any) {
            // Se è un errore di parsing JSON, è un problema di formato
            if (error instanceof SyntaxError) {
                throw new ValidationError({ message: `Formato body non valido: ${error.message}`, field: 'body', details: { code: ErrorCodes.WA_BROADCAST_FAILED } });
            }

            // Se è un errore di fetch/network
            const networkError = error as { code?: string; message?: string };
            if (networkError.code === 'ECONNREFUSED' || networkError.code === 'ENOTFOUND') {
                throw new ExternalApiError({ message: `Errore di connessione all'API Meta: ${error.message}`, service: 'Meta WhatsApp', endpoint: 'graph.facebook.com', details: { code: ErrorCodes.WA_BROADCAST_FAILED } });
            }

            // Rilancia l'errore originale
            throw error;
        }
    }
}

// Singleton worker
let workerInstance: WhatsappQueueWorker | null = null;

/**
 * Ottiene l'istanza singleton del worker
 */
export function getWhatsappQueueWorker(options?: WorkerOptions): WhatsappQueueWorker {
    if (!workerInstance) {
        workerInstance = new WhatsappQueueWorker(options);
    }
    return workerInstance;
}

/**
 * Resetta l'istanza singleton (utile per i test)
 */
export function resetWhatsappQueueWorker(): void {
    if (workerInstance) {
        workerInstance.stop();
        workerInstance = null;
    }
}
