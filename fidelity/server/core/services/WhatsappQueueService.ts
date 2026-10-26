import { v4 as uuidv4, validate as isUuid } from 'uuid';
import { Colorize } from '../../../lib/Colorize';
import { GDOWhatsappQueueJobStatus } from '../../../lib/enums';
import { DatabaseError, NotFoundError, ValidationError } from '../../../lib/errors';
import { sequelize } from '../db/SequelizeConnector';
import { log } from '../logger';
import { GDOWhatsappQueueJob } from '../models/whatsapp/gdo_whatsapp_message_queue';
import { GDOWhatsappCampagne } from '../models/whatsapp/gdo_whatsapp_campagne';
import { GDOWhatsappTemplate } from '../models/whatsapp/gdo_whatsapp_template';
import { createQueue } from '../../src/shared/queue/bullmq.client.js';
import { QUEUE_NAMES } from '../../src/shared/queue/queues.js';

// Una sola Queue BullMQ (e una sola connessione Redis) per processo; null se Redis non e' configurato
let waQueue: ReturnType<typeof createQueue> | undefined;
function getWaQueue() {
    if (waQueue === undefined) waQueue = createQueue(QUEUE_NAMES.WHATSAPP);
    return waQueue;
}

/**
 * GDO proprietaria di una campagna: e' quella del suo template (nessuna colonna GDO sulla campagna).
 */
export async function gdoDellaCampagna(campagnaId: string): Promise<string | null> {
    const campagna = await GDOWhatsappCampagne.findByPk(campagnaId, {
        attributes: ['template_id_whatsapp_campagna']
    });
    const template = campagna
        ? await GDOWhatsappTemplate.findByPk(campagna.template_id_whatsapp_campagna, { attributes: ['id_gdo_gdowhatsapptemplate'] })
        : null;
    return template?.id_gdo_gdowhatsapptemplate ?? null;
}

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

        let created = 0;
        try {
            // Campagna e job in una sola transazione: un errore a meta' non lascia campagne parziali
            await sequelize.transaction(async (transaction) => {
                await GDOWhatsappCampagne.create({
                    id_whatsapp_campagna: campagnaId,
                    titolo_whatsapp_campagna: titoloCampagna,
                    template_id_whatsapp_campagna: templateId,
                }, { transaction });

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

                for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
                    const batch = jobs.slice(i, i + BATCH_SIZE);
                    await GDOWhatsappQueueJob.bulkCreate(batch, { transaction });
                    created += batch.length;

                    log.debug(`📤 Creati ${created}/${total} job per bulk ${bulkId}`);
                }
            });
        } catch (error) {
            log.error(Colorize.bgRed(`❌ Errore creazione bulk ${bulkId}:`), error);
            throw new DatabaseError({
                message: `Errore durante la creazione dei job nella queue: ${error instanceof Error ? error.message : String(error)}`,
                operation: 'bulkCreate',
                entity: 'GDOWhatsappQueueJob',
                cause: error instanceof Error ? error : undefined,
            });
        }

        log.info(Colorize.green(`✅ Bulk ${bulkId} creato con successo: ${created} job pronti per l'invio`));

        // Trigger dopo il commit: prima il worker non vedrebbe i job. Se fallisce li recupera il polling
        const waQueue = getWaQueue();
        if (waQueue) {
            await waQueue.add('process-bulk', { bulk_id: bulkId }, {
                attempts: 1,
                removeOnComplete: true,
                removeOnFail: true,
            }).then(
                () => log.debug(`⚡ Bulk ${bulkId} accodato in BullMQ per elaborazione immediata`),
                (error) => log.warn(`Bulk ${bulkId} non accodato in BullMQ, lo elabora il polling`, {
                    message: error instanceof Error ? error.message : String(error),
                })
            );
        }

        return {
            bulkId,
            campagnaId,
            totalJobs: created,
            createdAt,
        };
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
        cancelled: number;
        status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    }> {
        try {
            const [
                total,
                pending,
                processing,
                success,
                failed,
                cancelled,
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
                GDOWhatsappQueueJob.count({
                    where: {
                        bulk_id_whatsapp_queue_job: bulkId,
                        status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.CANCELLED
                    }
                }),
            ]);

            // Determina lo stato complessivo: gli annullati contano come processati
            let status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
            const completed = success + failed + cancelled;

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
                cancelled,
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
     * Verifica che il bulk appartenga alla GDO: altrimenti risponde come se non esistesse
     */
    async verificaBulkDellaGdo(bulkId: string, idGdo: string | undefined): Promise<void> {
        const job = idGdo && isUuid(bulkId)
            ? await GDOWhatsappQueueJob.findOne({
                where: { bulk_id_whatsapp_queue_job: bulkId },
                attributes: ['campagna_id_whatsapp_queue_job'],
            })
            : null;
        if (!job || (await gdoDellaCampagna(job.campagna_id_whatsapp_queue_job)) !== idGdo) {
            throw new NotFoundError({ message: 'Campagna non trovata', entityType: 'whatsapp_campagna', entityId: bulkId });
        }
    }

    /**
     * Annulla tutti i job PENDING di un bulk (CANCELLED: "riprova" non li ripropone)
     */
    async cancelBulk(bulkId: string): Promise<number> {
        try {
            const result = await GDOWhatsappQueueJob.update(
                {
                    status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.CANCELLED,
                    last_error_whatsapp_queue_job: 'Campagna annullata dall\'utente',
                    // timestamps: false. Il worker confronta l'annullamento con la presa in carico dei job in invio
                    updatedat: new Date(),
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
