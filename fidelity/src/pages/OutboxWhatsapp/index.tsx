import clsx from 'clsx';
import dayjs from 'dayjs';
import 'dayjs/locale/it';
import relativeTime from 'dayjs/plugin/relativeTime';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ServerCall } from '../../../lib/server_call';
import Badge from '../../components/Base/Badge';
import Button from '../../components/Base/Button';
import { Dialog } from '../../components/Base/Headless';
import LoadingIcon from '../../components/Base/LoadingIcon';
import Lucide from '../../components/Base/Lucide';
import PageHeader from '../../components/Base/PageHeader';
import Table from '../../components/Base/Table';
import EmptyState from '../../components/EmptyState';
import withSessionCheck from '../../components/SessionChecker';
import { useSocket } from '../../hooks/useSocket';

dayjs.extend(relativeTime);
dayjs.locale('it');

// ============= TYPES =============
interface BulkStatus {
    bulkId: string;
    campagnaId?: string;
    titolo?: string;
    total: number;
    success: number;
    failed: number;
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
    status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
    error?: string;
}

// ============= HELPERS =============
const getStatusConfig = (status: BulkStatus['status']) => {
    switch (status) {
        case 'COMPLETED':
            return {
                label: 'Completata',
                color: 'success',
                icon: 'CircleCheck' as const,
                bgClass: 'bg-success/10 text-success',
            };
        case 'RUNNING':
            return {
                label: 'In corso',
                color: 'primary',
                icon: 'Loader' as const,
                bgClass: 'bg-primary/10 text-primary',
            };
        case 'PENDING':
            return {
                label: 'In attesa',
                color: 'warning',
                icon: 'Clock' as const,
                bgClass: 'bg-warning/10 text-warning',
            };
        case 'FAILED':
            return {
                label: 'Fallita',
                color: 'error',
                icon: 'CircleX' as const,
                bgClass: 'bg-danger/10 text-danger',
            };
        default:
            return {
                label: 'Sconosciuto',
                color: 'secondary',
                icon: 'CircleHelp' as const,
                bgClass: 'bg-secondary/10 text-secondary',
            };
    }
};

const getJobStatusConfig = (status: JobStatus['status']) => {
    switch (status) {
        case 'SUCCESS':
            return {
                label: 'Inviato',
                color: 'success',
                icon: 'CircleCheck' as const,
            };
        case 'PROCESSING':
            return {
                label: 'In invio',
                color: 'primary',
                icon: 'Loader' as const,
            };
        case 'PENDING':
            return {
                label: 'In coda',
                color: 'warning',
                icon: 'Clock' as const,
            };
        case 'FAILED':
            return {
                label: 'Fallito',
                color: 'error',
                icon: 'CircleX' as const,
            };
        default:
            return {
                label: status,
                color: 'secondary',
                icon: 'CircleHelp' as const,
            };
    }
};

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
}> = ({ bulk, onViewDetails, onCancel, onRetry }) => {
    const statusConfig = getStatusConfig(bulk.status);
    const isActive = bulk.status === 'RUNNING' || bulk.status === 'PENDING';

    const processed = bulk.processed ?? bulk.success + bulk.failed;
    const subtitle =
        bulk.createdAt != null
            ? `Creata ${dayjs(bulk.createdAt).fromNow()} • ${processed}/${bulk.total} processati`
            : `${processed}/${bulk.total} processati`;

    const etaLabel = formatEta(bulk.etaSeconds);
    const showEta = isActive && etaLabel;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="border border-slate-300 rounded-sm border-dashed dark:border-darkmode-400 p-4 mb-3 last:mb-0"
        >
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                    <div
                        className={clsx(
                            'flex items-center justify-center w-10 h-10 rounded-lg shrink-0',
                            statusConfig.bgClass
                        )}
                    >
                        {statusConfig.icon === 'Loader' ? (
                            <LoadingIcon icon="spinning-circles" className="w-5 h-5" />
                        ) : (
                            <Lucide
                                icon={statusConfig.icon}
                                className={clsx('w-5 h-5', isActive && 'animate-spin')}
                            />
                        )}
                    </div>
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium text-base text-slate-800 dark:text-slate-100">
                                {bulk.titolo || `Campagna #${bulk.bulkId.substring(0, 8)}`}
                            </h3>
                            <Badge variant={statusConfig.color as any} size="sm">
                                {statusConfig.label}
                            </Badge>
                        </div>
                        <p className="text-xs text-slate-500">{subtitle}</p>

                        {showEta && (
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                                <Lucide icon="Timer" className="w-3 h-3" />
                                <span>Tempo stimato rimanente: ~{etaLabel}</span>
                            </p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end md:self-start">
                    <Button variant="outline-secondary" size="sm" onClick={onViewDetails}>
                        <Lucide icon="List" className="w-4 h-4 mr-1" />
                        Dettagli
                    </Button>
                    {isActive && (
                        <Button variant="outline-danger" size="sm" onClick={onCancel}>
                            <Lucide icon="CircleStop" className="w-4 h-4 mr-1" />
                            Annulla
                        </Button>
                    )}
                    {bulk.status === 'COMPLETED' && bulk.failed > 0 && (
                        <Button variant="outline-primary" size="sm" onClick={onRetry}>
                            <Lucide icon="RotateCw" className="w-4 h-4 mr-1" />
                            Riprova falliti
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats + progress */}
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5 items-center">
                <div className="text-center md:text-left">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Totali</div>
                    <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                        {bulk.total}
                    </div>
                </div>
                <div className="text-center md:text-left">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Inviati</div>
                    <div className="text-lg font-semibold text-success">{bulk.success}</div>
                </div>
                <div className="text-center md:text-left">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Falliti</div>
                    <div className="text-lg font-semibold text-danger">{bulk.failed}</div>
                </div>
                <div className="text-center md:text-left">
                    <div className="text-xs uppercase tracking-wide text-slate-400">In coda</div>
                    <div className="text-lg font-semibold text-warning">{bulk.pending}</div>
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
    const socket = useSocket();

    useEffect(() => {
        if (!isOpen || !bulkId) return;

        const fetchJobs = async () => {
            setLoading(true);
            try {
                const response: any = await ServerCall.get(`/whatsapp/campaigns/${bulkId}/jobs`);
                if (response?.success && response?.data) {
                    setJobs(response.data);
                }
            } catch (error) {
                console.error('Errore caricamento job:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchJobs();
    }, [isOpen, bulkId]);

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
                    <div className="flex items-center gap-2">
                        <Lucide icon="List" className="w-5 h-5" />
                        <h2 className="text-base font-medium">Dettagli campagna</h2>
                    </div>
                </Dialog.Title>

                <Dialog.Description>
                    <div className="mt-5">
                        {loading ? (
                            <div className="flex items-center justify-center py-10">
                                <Lucide icon="Loader" className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : jobs.length === 0 ? (
                            <EmptyState
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
                                                const statusConfig = getJobStatusConfig(job.status);
                                                return (
                                                    <Table.Tr key={job.jobId}>
                                                        <Table.Td>{job.index + 1}</Table.Td>
                                                        <Table.Td className="font-mono">{job.telefono}</Table.Td>
                                                        <Table.Td>
                                                            <div className="flex items-center gap-2">
                                                                <Lucide
                                                                    icon={statusConfig.icon}
                                                                    className={clsx(
                                                                        'w-4 h-4',
                                                                        statusConfig.color === 'success' && 'text-success',
                                                                        statusConfig.color === 'primary' &&
                                                                        'text-primary animate-spin',
                                                                        statusConfig.color === 'warning' && 'text-warning',
                                                                        statusConfig.color === 'error' && 'text-danger'
                                                                    )}
                                                                />
                                                                <span className="text-xs">{statusConfig.label}</span>
                                                            </div>
                                                        </Table.Td>
                                                        <Table.Td>{job.attempts}</Table.Td>
                                                        <Table.Td>
                                                            {job.error ? (
                                                                <span className="text-xs text-danger break-all">
                                                                    {job.error}
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-slate-400">-</span>
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
    const [selectedBulkId, setSelectedBulkId] = useState<string | null>(null);

    // Fetch initial campaigns
    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const response: any = await ServerCall.get('/whatsapp/campaigns');
            if (response?.success && response?.data) {
                setCampaigns(response.data);
            }
        } catch (error) {
            console.error('Errore caricamento campagne:', error);
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
        if (!confirm('Sei sicuro di voler annullare questa campagna?')) return;

        try {
            const response: any = await ServerCall.post(
                `/whatsapp/campaigns/${bulkId}/cancel`,
                {}
            );
            if (response?.success) {
                setCampaigns(prev =>
                    prev.map(c =>
                        c.bulkId === bulkId ? { ...c, status: 'FAILED' as const } : c
                    )
                );
            }
        } catch (error) {
            console.error('Errore annullamento campagna:', error);
            alert("Errore durante l'annullamento della campagna");
        }
    };

    const handleRetry = async (bulkId: string) => {
        if (!confirm('Vuoi riprovare ad inviare i messaggi falliti?')) return;

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
            alert('Errore durante il retry della campagna');
        }
    };

    return (
        <div className="px-5 py-8">
            <PageHeader
                title="Campagne WhatsApp"
                description="Monitora in tempo reale lo stato delle campagne WhatsApp inviate."
                actions={
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={fetchCampaigns}
                        >
                            <Lucide icon="RefreshCw" className="w-4 h-4 mr-1" />
                            Aggiorna
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate('/whatsapp/invio-campagna-whatsapp?step=1')}
                        >
                            <Lucide icon="Send" className="w-4 h-4 mr-1" />
                            Nuova campagna
                        </Button>
                    </div>
                }
            />

            {/* Overview */}
            <div className="mt-6 box box--stacked p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                        Campagne totali
                    </div>
                    <div className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                        {overview.totalCampaigns}
                    </div>
                </div>
                <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                        Messaggi totali
                    </div>
                    <div className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                        {overview.totalMessages}
                    </div>
                </div>
                <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                        In corso / in attesa
                    </div>
                    <div className="text-xl font-semibold text-primary">
                        {overview.running}
                    </div>
                </div>
                <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                        Completate
                    </div>
                    <div className="text-xl font-semibold text-success">
                        {overview.completed}
                    </div>
                </div>
                <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                        Fallite
                    </div>
                    <div className="text-xl font-semibold text-danger">
                        {overview.failed}
                    </div>
                </div>
            </div>

            {/* Campaign list */}
            <div className="mt-6">
                {loading ? (
                    <div className="box box--stacked flex items-center justify-center py-16">
                        <Lucide icon="Loader" className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : campaigns.length === 0 ? (
                    <EmptyState
                        icon="Send"
                        title="Nessuna campagna"
                        description="Non hai ancora inviato campagne WhatsApp. Inizia creando la tua prima campagna."
                        buttonText="Crea campagna"
                        onButtonClick={() => navigate('/whatsapp/invio-campagna-whatsapp?step=1')}
                    />
                ) : (
                    <div className="box box--stacked p-3">
                        <AnimatePresence initial={false}>
                            {campaigns.map(campaign => (
                                <CampaignCard
                                    key={campaign.bulkId}
                                    bulk={campaign}
                                    onViewDetails={() => setSelectedBulkId(campaign.bulkId)}
                                    onCancel={() => handleCancel(campaign.bulkId)}
                                    onRetry={() => handleRetry(campaign.bulkId)}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Job Details Modal */}
            <JobDetailsModal
                isOpen={selectedBulkId !== null}
                onClose={() => setSelectedBulkId(null)}
                bulkId={selectedBulkId || ''}
            />
        </div>
    );
};

export default withSessionCheck(OutboxWhatsapp);
