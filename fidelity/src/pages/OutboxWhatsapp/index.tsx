import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ServerCall } from '../../../lib/server_call';
import Button from '../../components/Base/Button';
import { Dialog } from '../../components/Base/Headless';
import Lucide from '../../components/Base/Lucide';
import PageError from '../../components/Base/PageError';
import Pagina from '../../components/Base/Pagina';
import Sezione from '../../components/Base/Sezione';
import Spinner from '../../components/Base/Spinner';
import StatCard, { StatCardGrid } from '../../components/Base/StatCard';
import StatusBadge from '../../components/Base/StatusBadge';
import Table from '../../components/Base/Table';
import ConfirmDialog from '../../components/ConfirmDialog';
import EmptyState from '../../components/EmptyState';
import { useNotification } from '../../context/NotificationContext';
import withSessionCheck from '../../components/SessionChecker';
import { useSocket } from '../../hooks/useSocket';
import { formatDataOra, formatNumero, formatRelativo, VALORE_ASSENTE } from '../../utils/format';


// ============= TYPES =============
interface BulkStatus {
    bulkId: string;
    campagnaId?: string;
    titolo?: string;
    total: number;
    success: number;
    failed: number;
    cancelled?: number;
    pending: number;
    processed: number;
    percentuale: number;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    createdAt?: string;

    // ⬇️ nuovi campi arrivano dal backend
    etaSeconds?: number | null;
    etaCompletion?: string | null;
}

interface JobStatus {
    jobId: string;
    bulkId: string;
    index: number;
    total: number;
    telefono: string;
    attempts: number;
    status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
    error?: string;
}

// ============= HELPERS =============
// Etichetta e tono vengono dal catalogo degli stati; qui solo l'icona del riquadro
type IconaCampagna = { icon: 'CircleCheck' | 'Clock' | 'CircleX' | 'CircleHelp'; bgClass: string };
const ICONA_STATO_SCONOSCIUTO: IconaCampagna = { icon: 'CircleHelp', bgClass: 'bg-slate-100 text-slate-500' };
// null = in corso, mostra lo spinner
const ICONE_CAMPAGNA: Record<BulkStatus['status'], IconaCampagna | null> = {
    COMPLETED: { icon: 'CircleCheck', bgClass: 'bg-success/10 text-success' },
    RUNNING: null,
    PENDING: { icon: 'Clock', bgClass: 'bg-warning/10 text-warning' },
    FAILED: { icon: 'CircleX', bgClass: 'bg-danger/10 text-danger' },
};

const messaggioErrore = (errore: unknown, predefinito: string) =>
    errore instanceof Error && errore.message ? errore.message : predefinito;

const parseSocketPayload = (data: any) => {
    if (data instanceof ArrayBuffer) {
        const stringData = new TextDecoder().decode(new Uint8Array(data));
        return JSON.parse(stringData);
    }
    if (typeof data === 'string') {
        return JSON.parse(data);
    }
    return data;
};

// Format ETA seconds into something human readable in Italian
const formatEta = (etaSeconds?: number | null): string | null => {
    if (etaSeconds == null || !Number.isFinite(etaSeconds) || etaSeconds <= 0) {
        return null;
    }

    const total = Math.round(etaSeconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    const parts: string[] = [];

    if (hours > 0) {
        parts.push(`${hours}h`);
    }
    if (minutes > 0) {
        parts.push(`${minutes}m`);
    }
    if (hours === 0 && minutes === 0 && seconds > 0) {
        parts.push(`${seconds}s`);
    }

    if (parts.length === 0) {
        return '< 1s';
    }

    return parts.join(' ');
};

// ============= COMPONENTS =============

const ProgressBar: React.FC<{ value: number; status: BulkStatus['status'] }> = ({
    value,
    status,
}) => {
    const colorClass =
        status === 'COMPLETED'
            ? 'bg-success'
            : status === 'RUNNING'
                ? 'bg-primary'
                : status === 'FAILED'
                    ? 'bg-danger'
                    : 'bg-slate-400';

    const safeValue =
        status === 'COMPLETED'
            ? 100
            : Number.isFinite(value)
                ? Math.max(0, Math.min(100, value))
                : 0;

    return (
        <div className="w-full">
            <div className="flex justify-between mb-1 text-xs text-slate-500">
                <span>Avanzamento</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {Math.round(safeValue)}%
                </span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-darkmode-400 rounded-full overflow-hidden">
                <motion.div
                    className={clsx('h-full rounded-full', colorClass)}
                    initial={{ width: 0 }}
                    animate={{ width: `${safeValue}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                />
            </div>
        </div>
    );
};

const CampaignCard: React.FC<{
    bulk: BulkStatus;
    onViewDetails: () => void;
    onCancel: () => void;
    onRetry: () => void;
    /** Un'altra azione su una campagna è in corso. */
    disabilitato?: boolean;
}> = ({ bulk, onViewDetails, onCancel, onRetry, disabilitato = false }) => {
    const icona = bulk.status in ICONE_CAMPAGNA ? ICONE_CAMPAGNA[bulk.status] : ICONA_STATO_SCONOSCIUTO;
    const isActive = bulk.status === 'RUNNING' || bulk.status === 'PENDING';

    const cancelled = bulk.cancelled ?? 0;
    const processed = bulk.processed ?? bulk.success + bulk.failed + cancelled;
    const processati = `${processed}/${bulk.total} processati`;

    const etaLabel = formatEta(bulk.etaSeconds);
    const showEta = isActive && etaLabel;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-card border border-slate-200 bg-white p-4"
        >
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                    <div
                        className={clsx(
                            'flex items-center justify-center w-10 h-10 rounded-control shrink-0',
                            icona ? icona.bgClass : 'bg-sky-100 text-sky-800'
                        )}
                    >
                        {icona ? (
                            <Lucide icon={icona.icon} aria-hidden="true" className="w-5 h-5" />
                        ) : (
                            <Spinner decorativo size="sm" className="h-5 w-5 text-current" />
                        )}
                    </div>
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="title-card">
                                {bulk.titolo || `Campagna #${bulk.bulkId.substring(0, 8)}`}
                            </h3>
                            <StatusBadge dominio="waCampagna" stato={bulk.status} />
                        </div>
                        <p className="text-xs text-slate-500">
                            {bulk.createdAt != null && (
                                <>
                                    Creata <span title={formatDataOra(bulk.createdAt)}>{formatRelativo(bulk.createdAt)}</span> •{' '}
                                </>
                            )}
                            {processati}
                        </p>

                        {showEta && (
                            <p className="flex items-center gap-1 text-xs text-slate-500">
                                <Lucide icon="Timer" aria-hidden="true" className="h-3 w-3" />
                                <span>Tempo stimato rimanente: ~{etaLabel}</span>
                            </p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end md:self-start">
                    <Button variant="outline-secondary" size="sm" onClick={onViewDetails}>
                        <Lucide icon="List" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                        Dettagli
                    </Button>
                    {isActive && (
                        <Button variant="outline-danger" size="sm" onClick={onCancel} disabled={disabilitato}>
                            <Lucide icon="CircleStop" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                            Annulla
                        </Button>
                    )}
                    {bulk.status === 'COMPLETED' && bulk.failed > 0 && (
                        <Button variant="outline-secondary" size="sm" onClick={onRetry} disabled={disabilitato}>
                            <Lucide icon="RotateCw" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                            Riprova falliti
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats + progress */}
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-6 items-center">
                <div className="text-center md:text-left">
                    <div className="title-eyebrow">Totali</div>
                    <div className="text-lg font-semibold tabular-nums text-slate-800">
                        {bulk.total}
                    </div>
                </div>
                <div className="text-center md:text-left">
                    <div className="title-eyebrow">Inviati</div>
                    <div className="text-lg font-semibold tabular-nums text-success">{bulk.success}</div>
                </div>
                <div className="text-center md:text-left">
                    <div className="title-eyebrow">Falliti</div>
                    <div className="text-lg font-semibold tabular-nums text-danger">{bulk.failed}</div>
                </div>
                <div className="text-center md:text-left">
                    <div className="title-eyebrow">Annullati</div>
                    <div className="text-lg font-semibold tabular-nums text-slate-500">{cancelled}</div>
                </div>
                <div className="text-center md:text-left">
                    <div className="title-eyebrow">In coda</div>
                    <div className="text-lg font-semibold tabular-nums text-warning">{bulk.pending}</div>
                </div>
                <div className="col-span-2 md:col-span-1">
                    <ProgressBar value={bulk.percentuale} status={bulk.status} />
                </div>
            </div>
        </motion.div>
    );
};

const JobDetailsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    bulkId: string;
}> = ({ isOpen, onClose, bulkId }) => {
    const [jobs, setJobs] = useState<JobStatus[]>([]);
    const [loading, setLoading] = useState(false);
    const [errore, setErrore] = useState<string | null>(null);
    // Incrementato da "Riprova" per ricaricare i messaggi
    const [tentativo, setTentativo] = useState(0);
    const socket = useSocket();

    useEffect(() => {
        if (!isOpen || !bulkId) return;

        const fetchJobs = async () => {
            setLoading(true);
            setErrore(null);
            try {
                const response: any = await ServerCall.get(`/whatsapp/campaigns/${bulkId}/jobs`);
                if (!response?.success) {
                    throw new Error(response?.message || 'Risposta non valida dal server');
                }
                setJobs(response.data ?? []);
            } catch (error) {
                console.error('Errore caricamento job:', error);
                setErrore(messaggioErrore(error, 'Impossibile caricare i messaggi della campagna'));
            } finally {
                setLoading(false);
            }
        };

        fetchJobs();
    }, [isOpen, bulkId, tentativo]);

    useEffect(() => {
        if (!socket || !isOpen || !bulkId) return;

        const handleJobUpdate = (raw: any) => {
            const parsed = parseSocketPayload(raw);

            if (!parsed || parsed.bulkId !== bulkId) return;

            setJobs(prev => {
                const index = prev.findIndex(j => j.jobId === parsed.jobId);
                if (index >= 0) {
                    const updated = [...prev];
                    updated[index] = parsed;
                    return updated;
                }
                return [...prev, parsed];
            });
        };

        socket.on('whatsapp:job-status', handleJobUpdate);

        return () => {
            socket.off('whatsapp:job-status', handleJobUpdate);
        };
    }, [socket, isOpen, bulkId]);

    return (
        <Dialog open={isOpen} onClose={onClose} size="xl">
            <Dialog.Panel>
                <Dialog.Title>
                    <Lucide icon="List" aria-hidden="true" className="h-5 w-5" />
                    Dettagli campagna
                </Dialog.Title>

                <Dialog.Description>
                    <div>
                        {loading ? (
                            <div className="flex items-center justify-center py-10">
                                <Spinner size="lg" etichetta="Caricamento dei messaggi…" />
                            </div>
                        ) : errore ? (
                            <PageError
                                compatta
                                titolo="Messaggi non caricati"
                                motivo={errore}
                                onRiprova={() => setTentativo((t) => t + 1)}
                            />
                        ) : jobs.length === 0 ? (
                            <EmptyState
                                compatta
                                icon="Inbox"
                                title="Nessun messaggio"
                                description="Non ci sono messaggi per questa campagna."
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th>#</Table.Th>
                                            <Table.Th>Telefono</Table.Th>
                                            <Table.Th>Stato</Table.Th>
                                            <Table.Th>Tentativi</Table.Th>
                                            <Table.Th>Errore</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {jobs
                                            .slice()
                                            .sort((a, b) => a.index - b.index)
                                            .map(job => {
                                                return (
                                                    <Table.Tr key={job.jobId}>
                                                        <Table.Td className="tabular-nums">{job.index + 1}</Table.Td>
                                                        <Table.Td className="font-mono">{job.telefono}</Table.Td>
                                                        <Table.Td>
                                                            <StatusBadge dominio="waMessaggio" stato={job.status} />
                                                        </Table.Td>
                                                        <Table.Td className="tabular-nums">{job.attempts}</Table.Td>
                                                        <Table.Td>
                                                            {job.error ? (
                                                                <span className="text-xs text-danger break-all">
                                                                    {job.error}
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-slate-400">{VALORE_ASSENTE}</span>
                                                            )}
                                                        </Table.Td>
                                                    </Table.Tr>
                                                );
                                            })}
                                    </Table.Tbody>
                                </Table>
                            </div>
                        )}
                    </div>
                </Dialog.Description>

                <Dialog.Footer>
                    <Button variant="outline-secondary" onClick={onClose}>
                        Chiudi
                    </Button>
                </Dialog.Footer>
            </Dialog.Panel>
        </Dialog>
    );
};

// ============= MAIN PAGE =============
const OutboxWhatsapp: React.FC = () => {
    const navigate = useNavigate();
    const socket = useSocket();
    const [campaigns, setCampaigns] = useState<BulkStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [errore, setErrore] = useState<string | null>(null);
    const [selectedBulkId, setSelectedBulkId] = useState<string | null>(null);
    const { showNotification } = useNotification();
    // Campagna in attesa di conferma per annullamento o reinvio
    const [azioneCampagna, setAzioneCampagna] = useState<{ tipo: 'cancel' | 'retry'; bulk: BulkStatus } | null>(null);
    const [azioneInCorso, setAzioneInCorso] = useState(false);

    // Fetch initial campaigns
    // Un errore non va confuso con "nessuna campagna": si mostra con il suo motivo
    const fetchCampaigns = async () => {
        setLoading(true);
        setErrore(null);
        try {
            const response: any = await ServerCall.get('/whatsapp/campaigns');
            if (!response?.success) {
                throw new Error(response?.message || 'Risposta non valida dal server');
            }
            setCampaigns(response.data ?? []);
        } catch (error) {
            console.error('Errore caricamento campagne:', error);
            setErrore(messaggioErrore(error, 'Impossibile caricare le campagne'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCampaigns();
    }, []);

    // Aggregated stats
    const overview = useMemo(() => {
        if (!campaigns.length) {
            return {
                totalCampaigns: 0,
                totalMessages: 0,
                running: 0,
                completed: 0,
                failed: 0,
            };
        }

        let totalMessages = 0;
        let running = 0;
        let completed = 0;
        let failed = 0;

        campaigns.forEach(c => {
            totalMessages += c.total;
            if (c.status === 'RUNNING' || c.status === 'PENDING') running += 1;
            if (c.status === 'COMPLETED') completed += 1;
            if (c.status === 'FAILED') failed += 1;
        });

        return {
            totalCampaigns: campaigns.length,
            totalMessages,
            running,
            completed,
            failed,
        };
    }, [campaigns]);

    // Real-time updates via WebSocket
    useEffect(() => {
        if (!socket) return;

        const handleBulkUpdate = (raw: any) => {
            const parsed = parseSocketPayload(raw);
            if (!parsed || !parsed.bulkId) return;

            setCampaigns(prev => {
                const index = prev.findIndex(c => c.bulkId === parsed.bulkId);
                if (index >= 0) {
                    const updated = [...prev];
                    updated[index] = { ...updated[index], ...parsed };
                    return updated;
                }
                // Nuova campagna in testa
                return [parsed, ...prev];
            });
        };

        socket.on('whatsapp:bulk-status', handleBulkUpdate);

        return () => {
            socket.off('whatsapp:bulk-status', handleBulkUpdate);
        };
    }, [socket]);

    const handleCancel = async (bulkId: string) => {
        try {
            const response: any = await ServerCall.post(
                `/whatsapp/campaigns/${bulkId}/cancel`,
                {}
            );
            // Ricarica: i messaggi annullati e lo stato reale della campagna arrivano dal server
            if (response?.success) {
                fetchCampaigns();
            }
        } catch (error) {
            console.error('Errore annullamento campagna:', error);
            showNotification("Errore durante l'annullamento della campagna", { variant: 'error' });
        }
    };

    const handleRetry = async (bulkId: string) => {
        try {
            const response: any = await ServerCall.post(
                `/whatsapp/campaigns/${bulkId}/retry`,
                {}
            );
            if (response?.success) {
                fetchCampaigns();
            }
        } catch (error) {
            console.error('Errore retry campagna:', error);
            showNotification('Errore durante il reinvio dei messaggi falliti', { variant: 'error' });
        }
    };

    const eseguiAzioneCampagna = async () => {
        if (!azioneCampagna) return;
        setAzioneInCorso(true);
        const { tipo, bulk } = azioneCampagna;
        await (tipo === 'cancel' ? handleCancel(bulk.bulkId) : handleRetry(bulk.bulkId));
        setAzioneInCorso(false);
        setAzioneCampagna(null);
    };

    return (
        <Pagina
            titolo="Campagne WhatsApp"
            descrizione="Monitora in tempo reale lo stato delle campagne WhatsApp inviate."
            azioni={
                <>
                    <Button
                        variant="outline-secondary"
                        loading={loading}
                        onClick={fetchCampaigns}
                    >
                        {!loading && <Lucide icon="RefreshCw" aria-hidden="true" className="mr-2 h-4 w-4" />}
                        Aggiorna
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => navigate('/whatsapp/invio-campagna-whatsapp?step=1')}
                    >
                        <Lucide icon="Plus" aria-hidden="true" className="mr-2 h-4 w-4" />
                        Nuova campagna
                    </Button>
                </>
            }
        >
            {/* Riepilogo */}
            <StatCardGrid className="lg:grid-cols-5">
                <StatCard densita="compatta" etichetta="Campagne totali" valore={formatNumero(overview.totalCampaigns)} icona="Megaphone" />
                <StatCard densita="compatta" etichetta="Messaggi totali" valore={formatNumero(overview.totalMessages)} icona="MessageSquare" />
                <StatCard densita="compatta" etichetta="In corso / in attesa" valore={formatNumero(overview.running)} icona="Loader" tono="info" />
                <StatCard densita="compatta" etichetta="Completate" valore={formatNumero(overview.completed)} icona="CircleCheck" tono="success" />
                <StatCard densita="compatta" etichetta="Fallite" valore={formatNumero(overview.failed)} icona="CircleX" tono="danger" />
            </StatCardGrid>

            {/* Elenco campagne */}
            {errore && !loading ? (
                <PageError titolo="Campagne non caricate" motivo={errore} onRiprova={fetchCampaigns} />
            ) : (
                <Sezione titolo="Campagne">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Spinner size="lg" etichetta="Caricamento delle campagne…" />
                        </div>
                    ) : campaigns.length === 0 ? (
                        <EmptyState
                            compatta
                            icon="Send"
                            title="Nessuna campagna"
                            description="Non hai ancora inviato campagne WhatsApp. Inizia creando la tua prima campagna."
                            buttonText="Crea campagna"
                            buttonIcon="Plus"
                            onButtonClick={() => navigate('/whatsapp/invio-campagna-whatsapp?step=1')}
                        />
                    ) : (
                        <div className="flex flex-col gap-3">
                            <AnimatePresence initial={false}>
                                {campaigns.map(campaign => (
                                    <CampaignCard
                                        key={campaign.bulkId}
                                        bulk={campaign}
                                        onViewDetails={() => setSelectedBulkId(campaign.bulkId)}
                                        onCancel={() => setAzioneCampagna({ tipo: 'cancel', bulk: campaign })}
                                        onRetry={() => setAzioneCampagna({ tipo: 'retry', bulk: campaign })}
                                        disabilitato={azioneInCorso}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </Sezione>
            )}

            {/* Job Details Modal */}
            <JobDetailsModal
                isOpen={selectedBulkId !== null}
                onClose={() => setSelectedBulkId(null)}
                bulkId={selectedBulkId || ''}
            />

            <ConfirmDialog
                open={!!azioneCampagna}
                title={azioneCampagna?.tipo === 'retry' ? 'Reinviare i messaggi falliti?' : 'Annullare la campagna?'}
                subtitle={azioneCampagna?.tipo === 'retry' ? 'I messaggi tornano in coda' : undefined}
                description={azioneCampagna?.tipo === 'retry'
                    ? `I ${azioneCampagna.bulk.failed} messaggi falliti della campagna "${azioneCampagna.bulk.titolo || azioneCampagna.bulk.bulkId}" verranno rimessi in coda per un nuovo invio.`
                    : `I ${azioneCampagna?.bulk.pending ?? 0} messaggi ancora in coda della campagna "${azioneCampagna?.bulk.titolo || azioneCampagna?.bulk.bulkId || ''}" non verranno inviati. I messaggi già inviati non vengono toccati.`}
                confirmLabel={azioneCampagna?.tipo === 'retry' ? 'Reinvia' : 'Annulla campagna'}
                confirmVariant={azioneCampagna?.tipo === 'retry' ? 'primary' : 'danger'}
                loading={azioneInCorso}
                onClose={() => !azioneInCorso && setAzioneCampagna(null)}
                onConfirm={eseguiAzioneCampagna}
            />
        </Pagina>
    );
};

export default withSessionCheck(OutboxWhatsapp);
