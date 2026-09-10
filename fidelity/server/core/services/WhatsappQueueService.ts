import { v4 as uuidv4 } from 'uuid';
import { Colorize } from '../../../lib/Colorize';
import { GDOWhatsappQueueJobStatus } from '../../../lib/enums';
import { BadRequestError, DatabaseError, ValidationError } from '../../../lib/errors';
import { log } from '../logger';
import { GDOWhatsappQueueJob } from '../models/whatsapp/gdo_whatsapp_message_queue';
import { GDOWhatsappCampagne } from '../models/whatsapp/gdo_whatsapp_campagne';
import { createQueue } from '../../src/shared/queue/bullmq.client.js';
import { QUEUE_NAMES } from '../../src/shared/queue/queues.js';

export interface CreateBulkJobsParams {
    /**
     * Titolo della campagna
     */
    titoloCampagna: string;

    /**
     * ID del template utilizzato
     */
    templateId: string;

    /**
     * Array di numeri di telefono destinatari
     */
    telefoni: string[];

    /**
     * Corpo del messaggio da inviare (può contenere placeholder)
     * Se è una stringa, verrà usata per tutti i destinatari
     * Se è un array, ogni elemento corrisponde al destinatario all'indice corrispondente
     */
    body: any[];

    /**
     * Numero massimo di tentativi per ogni job
     * Default: 3
     */
    maxAttempts?: number;
}

export interface BulkJobResult {
    /**
     * ID univoco del bulk
     */
    bulkId: string;

    /**
     * ID della campagna
     */
    campagnaId: string;

    /**
     * Numero totale di job creati
     */
    totalJobs: number;

    /**
     * Timestamp di creazione
     */
    createdAt: Date;
}

/**
 * Service per gestire la coda di messaggi WhatsApp
 */
export class WhatsappQueueService {
    // Istanza lazy: creata al primo createBulkJobs, null se Redis non disponibile
    private waQueue = createQueue(QUEUE_NAMES.WHATSAPP);

    /**
     * Crea un batch di job nella queue per l'invio di messaggi WhatsApp
     *
     * @param params - Parametri per la creazione dei job
     * @returns Risultato con bulkId e numero di job creati
     */
    async createBulkJobs(params: CreateBulkJobsParams): Promise<BulkJobResult> {
        const { titoloCampagna, templateId, telefoni, body, maxAttempts = 3 } = params;

        if (telefoni.length === 0) {
            throw new ValidationError({
                message: 'Nessun telefono fornito per la creazione dei job',
                field: 'telefoni',
                constraint: 'non-empty',
            });
        }

        if (!titoloCampagna || titoloCampagna.trim() === '') {
            throw new ValidationError({
                message: 'Il titolo della campagna è obbligatorio',
                field: 'titoloCampagna',
                constraint: 'required',
            });
        }

        // Valida che se body è array, abbia la stessa lunghezza di telefoni
        if (Array.isArray(body) && body.length !== telefoni.length) {
            throw new ValidationError({
                message: `Il numero di body (${body.length}) deve corrispondere al numero di telefoni (${telefoni.length})`,
                field: 'body',
                constraint: 'length-match',
                details: { bodyLength: body.length, telefoniLength: telefoni.length },
            });
        }

        const bulkId = uuidv4();
        const campagnaId = uuidv4();
        const total = telefoni.length;
        const createdAt = new Date();

        log.info(Colorize.bgBlue(`📦 Creazione campagna "${titoloCampagna}" (${campagnaId}) con ${total} job...`));

        try {
            // Crea il record della campagna
            await GDOWhatsappCampagne.create({
                id_whatsapp_campagna: campagnaId,
                titolo_whatsapp_campagna: titoloCampagna,
                template_id_whatsapp_campagna: templateId,
            });

            log.debug(`✅ Campagna "${titoloCampagna}" creata con ID ${campagnaId}`);

            // Crea tutti i job in un'unica operazione batch
            const jobs = telefoni.map((telefono, index) => ({
                id_whatsapp_queue_job: uuidv4(),
                bulk_id_whatsapp_queue_job: bulkId,
                campagna_id_whatsapp_queue_job: campagnaId,
                index_whatsapp_queue_job: index + 1,
                total_whatsapp_queue_job: total,
                to_whatsapp_queue_job: telefono,
                body_whatsapp_queue_job: body[index],
                attempts_whatsapp_queue_job: 0,
                max_attempts_whatsapp_queue_job: maxAttempts,
                status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.PENDING,
                run_at_whatsapp_queue_job: new Date(),
                last_error_whatsapp_queue_job: null,
            }));

            // Batch insert per performance
            const BATCH_SIZE = 1000;
            let created = 0;

            for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
                const batch = jobs.slice(i, i + BATCH_SIZE);
                await GDOWhatsappQueueJob.bulkCreate(batch);
                created += batch.length;

                log.debug(`📤 Creati ${created}/${total} job per bulk ${bulkId}`);
            }

            log.info(Colorize.green(`✅ Bulk ${bulkId} creato con successo: ${created} job pronti per l'invio`));

            // Trigger immediato via BullMQ — il Worker processa senza aspettare il polling
            if (this.waQueue) {
                await this.waQueue.add('process-bulk', { bulk_id: bulkId }, {
                    attempts: 1,
                    removeOnComplete: true,
                    removeOnFail: true,
                });
                log.debug(`⚡ Bulk ${bulkId} accodato in BullMQ per elaborazione immediata`);
            }

            return {
                bulkId,
                campagnaId,
                totalJobs: created,
                createdAt,
            };
        } catch (error) {
            log.error(Colorize.bgRed(`❌ Errore creazione bulk ${bulkId}:`), error);
            throw new DatabaseError({
                message: `Errore durante la creazione dei job nella queue: ${error instanceof Error ? error.message : String(error)}`,
                operation: 'bulkCreate',
                entity: 'GDOWhatsappQueueJob',
                cause: error instanceof Error ? error : undefined,
            });
        }
    }

    /**
     * Ottiene lo stato di un bulk
     */
    async getBulkStatus(bulkId: string): Promise<{
        bulkId: string;
        total: number;
        pending: number;
        processing: number;
        success: number;
        failed: number;
        status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    }> {
        try {
            const [
                total,
                pending,
                processing,
                success,
                failed,
            ] = await Promise.all([
                GDOWhatsappQueueJob.count({
                    where: { bulk_id_whatsapp_queue_job: bulkId }
                }),
                GDOWhatsappQueueJob.count({
                    where: {
                        bulk_id_whatsapp_queue_job: bulkId,
                        status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.PENDING
                    }
                }),
                GDOWhatsappQueueJob.count({
                    where: {
                        bulk_id_whatsapp_queue_job: bulkId,
                        status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.PROCESSING
                    }
                }),
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
            ]);

            // Determina lo stato complessivo
            let status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
            const completed = success + failed;

            if (completed >= total) {
                status = failed === total ? 'FAILED' : 'COMPLETED';
            } else if (processing > 0 || success > 0) {
                status = 'RUNNING';
            } else {
                status = 'PENDING';
            }

            return {
                bulkId,
                total,
                pending,
                processing,
                success,
                failed,
                status,
            };
        } catch (error) {
            log.error(Colorize.bgRed(`Errore recupero stato bulk ${bulkId}:`), error);
            throw error;
        }
    }

    /**
     * Ottiene tutti i job di un bulk con paginazione
     */
    async getBulkJobs(bulkId: string, options?: {
        limit?: number;
        offset?: number;
        status?: GDOWhatsappQueueJobStatus;
    }) {
        const { limit = 100, offset = 0, status } = options || {};

        const where: any = {
            bulk_id_whatsapp_queue_job: bulkId,
        };

        if (status) {
            where.status_whatsapp_queue_job = status;
        }

        const jobs = await GDOWhatsappQueueJob.findAll({
            where,
            limit,
            offset,
            order: [['index_whatsapp_queue_job', 'ASC']],
        });

        return jobs;
    }

    /**
     * Cancella tutti i job PENDING di un bulk
     * (utile per annullare una campagna in corso)
     */
    async cancelBulk(bulkId: string): Promise<number> {
        try {
            const result = await GDOWhatsappQueueJob.update(
                {
                    status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.FAILED,
                    last_error_whatsapp_queue_job: 'Campagna annullata dall\'utente',
                },
                {
                    where: {
                        bulk_id_whatsapp_queue_job: bulkId,
                        status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.PENDING,
                    },
                }
            );

            const cancelled = result[0];
            log.info(Colorize.yellow(`🚫 Bulk ${bulkId} annullato: ${cancelled} job pendenti cancellati`));

            return cancelled;
        } catch (error) {
            log.error(Colorize.bgRed(`Errore annullamento bulk ${bulkId}:`), error);
            throw error;
        }
    }

    /**
     * Riprova tutti i job FAILED di un bulk
     */
    async retryFailedJobs(bulkId: string): Promise<number> {
        try {
            const result = await GDOWhatsappQueueJob.update(
                {
                    status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.PENDING,
                    run_at_whatsapp_queue_job: new Date(),
                    attempts_whatsapp_queue_job: 0,
                    last_error_whatsapp_queue_job: null,
                },
                {
                    where: {
                        bulk_id_whatsapp_queue_job: bulkId,
                        status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.FAILED,
                    },
                }
            );

            const retried = result[0];
            log.info(Colorize.blue(`🔄 Bulk ${bulkId}: ${retried} job falliti rimessi in coda`));

            return retried;
        } catch (error) {
            log.error(Colorize.bgRed(`Errore retry bulk ${bulkId}:`), error);
            throw error;
        }
    }
}
