import React, { useState, useMemo } from 'react';
import { FileItemKit } from '../../../../lib/types';
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import Badge from '@/components/Base/Badge';
import clsx from 'clsx';
import FormLabel from '@/components/Base/Form/FormLabel';
import FormTextarea from '@/components/Base/Form/FormTextarea';
import { PreviewImmaginePdf } from '@/components/PreviewImmaginePdf';
import { useLavorazione } from '../context/LavorazioneContext';

interface LavorazioneInRevisioneProps {
    managedFiles: FileItemKit[];
    setSelectedFile: (file: FileItemKit | null) => void;
    selectedFile: FileItemKit | null;
    onFileRework: (file: FileItemKit) => void;
}

const StatCard = ({ icon, iconBg, iconColor, value, label }: {
    icon: string; iconBg: string; iconColor: string; value: string | number; label: string;
}) => (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white">
        <div className={clsx("flex h-12 w-12 items-center justify-center rounded-xl shrink-0", iconBg)}>
            <Lucide icon={icon as any} className={clsx("h-6 w-6", iconColor)} />
        </div>
        <div className="min-w-0">
            <p className="text-2xl font-bold text-slate-800 truncate">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
        </div>
    </div>
);

const TimelineItem = ({ icon, iconBg, iconColor, title, description, timestamp, isLast }: {
    icon: string; iconBg: string; iconColor: string; title: string; description?: string; timestamp?: string; isLast?: boolean;
}) => (
    <div className="flex gap-3">
        <div className="flex flex-col items-center">
            <div className={clsx("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", iconBg)}>
                <Lucide icon={icon as any} className={clsx("h-4 w-4", iconColor)} />
            </div>
            {!isLast && <div className="w-px h-full bg-slate-200 my-1" />}
        </div>
        <div className={clsx("pb-4", isLast && "pb-0")}>
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            {description && <p className="text-xs text-slate-600 mt-0.5">{description}</p>}
            {timestamp && <p className="text-[10px] text-slate-400 mt-1">{timestamp}</p>}
        </div>
    </div>
);

const LavorazioneInRevisione = ({
    managedFiles,
    setSelectedFile,
    selectedFile,
    onFileRework,
}: LavorazioneInRevisioneProps) => {
    const { state, dispatch } = useLavorazione();
    const { accepted, rejected } = state;

    const [rejectionReasons, setRejectionReasons] = useState<{ [key: string]: string }>({});
    const [showRejectionInput, setShowRejectionInput] = useState<{ [key: string]: boolean }>({});

    const isAccepted = (f: FileItemKit) => accepted.some(a => a.id === f.id);
    const isRejected = (f: FileItemKit) => rejected.some(r => r.id === f.id);

    const stats = useMemo(() => {
        const total = managedFiles.length;
        const acceptedCount = managedFiles.filter(f => isAccepted(f)).length;
        const rejectedCount = managedFiles.filter(f => isRejected(f)).length;
        const pendingCount = total - acceptedCount - rejectedCount;
        return { total, acceptedCount, rejectedCount, pendingCount };
    }, [managedFiles, accepted, rejected]);

    const onToggleAccept = (file: FileItemKit) => {
        dispatch({ type: 'TOGGLE_ACCEPT', payload: file });
    };

    const onToggleReject = (file: FileItemKit, reason?: string) => {
        dispatch({ type: 'TOGGLE_REJECT', payload: { file, reason } });
    };

    const acceptAll = () => {
        managedFiles.forEach(file => {
            if (!isAccepted(file) && !isRejected(file)) {
                onToggleAccept(file);
            }
        });
    };

    const handleRejectionReasonChange = (fileId: string, reason: string) => {
        setRejectionReasons(prev => ({ ...prev, [fileId]: reason }));
    };

    const toggleRejectionInput = (fileId: string) => {
        setShowRejectionInput(prev => ({ ...prev, [fileId]: !prev[fileId] }));
    };

    const handleConfirmRejection = (file: FileItemKit) => {
        const reason = rejectionReasons[file.id];
        if (reason) {
            onToggleReject(file, reason);
            toggleRejectionInput(file.id);
        }
    };

    const handleUndo = (file: FileItemKit) => {
        if (isAccepted(file)) {
            onToggleAccept(file);
        } else if (isRejected(file)) {
            onToggleReject(file, '');
            setRejectionReasons(prev => ({ ...prev, [file.id]: '' }));
        }
    };

    const renderFileCard = (file: FileItemKit) => {
        const isAcc = isAccepted(file);
        const isRej = isRejected(file);
        const showRejection = showRejectionInput[file.id];

        return (
            <div key={file.id} className={clsx(
                "rounded-xl border transition-all overflow-hidden",
                {
                    'border-success/30 bg-success/5': isAcc,
                    'border-danger/30 bg-danger/5': isRej,
                    'border-slate-200 bg-white': !isAcc && !isRej
                }
            )}>
                {/* File Header */}
                <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center flex-1">
                        <div className={clsx(
                            "flex h-12 w-12 items-center justify-center rounded-xl shrink-0 mr-4",
                            isAcc && "bg-success/10",
                            isRej && "bg-danger/10",
                            !isAcc && !isRej && "bg-slate-100"
                        )}>
                            <Lucide icon="FileText" className={clsx(
                                "w-6 h-6",
                                isAcc && "text-success",
                                isRej && "text-danger",
                                !isAcc && !isRej && "text-slate-500"
                            )} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-800">{file.nome}</div>
                            {file.direttive && <div className="text-xs text-slate-500 mt-0.5">{file.direttive}</div>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-center">
                        <span className={clsx(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                            file.isOptional
                                ? "bg-warning/10 text-warning border border-warning/20"
                                : "bg-theme-1/5 text-theme-1 border border-theme-1/20"
                        )}>
                            {file.isOptional ? "Opzionale" : "Obbligatorio"}
                        </span>
                        {isAcc && (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success rounded-full text-xs font-medium border border-success/20">
                                <Lucide icon="Check" className="w-3 h-3" /> Accettato
                            </span>
                        )}
                        {isRej && (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-danger/10 text-danger rounded-full text-xs font-medium border border-danger/20">
                                <Lucide icon="X" className="w-3 h-3" /> Rifiutato
                            </span>
                        )}
                    </div>
                    <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
                        {file.url && <Button variant="outline-secondary" size="sm" onClick={() => setSelectedFile(file)}><Lucide icon="Eye" className="w-4 h-4" /></Button>}
                        {!isAcc && !isRej && (
                            <>
                                <Button variant="outline-success" size="sm" onClick={() => onToggleAccept(file)}>Accetta</Button>
                                <Button variant="outline-danger" size="sm" onClick={() => toggleRejectionInput(file.id)}>Rifiuta</Button>
                            </>
                        )}
                        {(isAcc || isRej) && (
                            <Button variant="outline-secondary" size="sm" onClick={() => handleUndo(file)}>
                                <Lucide icon="RotateCcw" className="w-4 h-4 mr-1" /> Annulla
                            </Button>
                        )}
                        {isRej && (
                            <Button variant="outline-dark" size="sm" onClick={() => onFileRework(file)}>
                                <Lucide icon="RefreshCw" className="w-4 h-4 mr-1" /> Riporta in Lavorazione
                            </Button>
                        )}
                    </div>
                </div>

                {/* Rejection Form */}
                {showRejection && !isAcc && !isRej && (
                    <div className="px-5 pb-5 border-t border-slate-200 pt-4">
                        <FormLabel htmlFor={`rejection-reason-${file.id}`} className="font-semibold text-slate-800">Motivo del rifiuto</FormLabel>
                        <FormTextarea
                            id={`rejection-reason-${file.id}`}
                            rows={3}
                            value={rejectionReasons[file.id] || ''}
                            onChange={(e) => handleRejectionReasonChange(file.id, e.target.value)}
                            placeholder="Es. L'immagine non è in alta risoluzione..."
                            className="w-full mt-2"
                        />
                        <div className="flex justify-end mt-3 gap-2">
                            <Button type="button" variant="outline-secondary" onClick={() => toggleRejectionInput(file.id)}>Annulla</Button>
                            <Button type="button" variant="danger" onClick={() => handleConfirmRejection(file)} disabled={!rejectionReasons[file.id]}>Conferma Rifiuto</Button>
                        </div>
                    </div>
                )}

                {/* Logs - Timeline style */}
                {file.log?.logs && file.log.logs.length > 0 && (
                    <div className="px-5 pb-5 border-t border-slate-100 pt-4 bg-slate-50/50">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3">Storico Modifiche</h4>
                        <div className="space-y-0">
                            {file.log.logs.map((log: any, index: number) => {
                                const isLast = index === file.log!.logs!.length - 1;
                                const getLogIcon = (azione: string) => {
                                    switch (azione) {
                                        case 'Upload': return { icon: 'FileUp', bg: 'bg-info/10', color: 'text-info' };
                                        case 'Accettato': return { icon: 'CircleCheck', bg: 'bg-success/10', color: 'text-success' };
                                        case 'Rifiutato': return { icon: 'CircleX', bg: 'bg-danger/10', color: 'text-danger' };
                                        case 'Download': return { icon: 'FileDown', bg: 'bg-slate-100', color: 'text-slate-500' };
                                        default: return { icon: 'FileText', bg: 'bg-slate-100', color: 'text-slate-500' };
                                    }
                                };
                                const logStyle = getLogIcon(log.azione);
                                return (
                                    <TimelineItem
                                        key={index}
                                        icon={logStyle.icon}
                                        iconBg={logStyle.bg}
                                        iconColor={logStyle.color}
                                        title={`${log.utente_notifica || 'Utente'} — ${log.azione}`}
                                        description={log.messaggio ? `"${log.messaggio}"` : undefined}
                                        timestamp={new Date(log.data_notifica).toLocaleString()}
                                        isLast={isLast}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        )
    };

    return (
        <div className="space-y-6">
            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-warning via-warning/90 to-warning/80 p-8">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnYtMmgtNHY2aDR2MmgtNHY0aDJ2LTJoNHYtMmgtMnYtMnptMC0xNmgtMnYtNGgydi0yaC00djZoNHYyaC00djRoMnYtMmg0di0yaC0ydi0yem0tMTYgMGgtMnYtNGgyVjBoLTR2Nmg0djJoLTR2NGgyVjhoNFY2aC0yVjR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-40" />
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                            <Lucide icon="ClipboardCheck" className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Revisione in Corso</h2>
                            <p className="text-sm text-white/80 mt-1">
                                {stats.total} file da revisionare — {stats.pendingCount} in attesa
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="primary"
                        className="bg-white/20 border-white/30 text-white hover:bg-white/30 backdrop-blur-sm"
                        onClick={acceptAll}
                        disabled={managedFiles.every(f => isAccepted(f) || isRejected(f))}
                    >
                        <Lucide icon="CircleCheck" className="w-4 h-4 mr-2" />
                        Accetta Tutti i Restanti
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon="Files" iconBg="bg-info/10" iconColor="text-info" value={stats.total} label="File totali" />
                <StatCard icon="CircleCheck" iconBg="bg-success/10" iconColor="text-success" value={stats.acceptedCount} label="Accettati" />
                <StatCard icon="CircleX" iconBg="bg-danger/10" iconColor="text-danger" value={stats.rejectedCount} label="Rifiutati" />
                <StatCard icon="Clock" iconBg="bg-warning/10" iconColor="text-warning" value={stats.pendingCount} label="In attesa" />
            </div>

            {/* File List */}
            <div className="box box--stacked p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2.5 bg-gradient-to-br from-warning/10 to-warning/5 rounded-xl">
                        <Lucide icon="FileStack" className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-slate-800">File da Revisionare</h3>
                        <p className="text-xs text-slate-500">Accetta o rifiuta ogni file</p>
                    </div>
                </div>

                {managedFiles.length === 0 ? (
                    <div className="text-center py-16 rounded-xl bg-slate-50 border border-dashed border-slate-200">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 mx-auto mb-4">
                            <Lucide icon="Inbox" className="w-10 h-10 text-slate-400" />
                        </div>
                        <h3 className="text-base font-semibold text-slate-700">Nessun file da revisionare</h3>
                        <p className="text-sm text-slate-500 mt-1">Tutti i documenti sono stati processati.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {managedFiles.map(renderFileCard)}
                    </div>
                )}
            </div>

            {selectedFile && (
                <PreviewImmaginePdf
                    imageUrl={selectedFile.url || ''}
                    onClose={() => setSelectedFile(null)}
                    totalPages={selectedFile.pages || 1}
                />
            )}
        </div>
    );
};

export default LavorazioneInRevisione;
