import Alert from '@/components/Base/Alert';
import BarraFiltri from '@/components/Base/BarraFiltri';
import Button from '@/components/Base/Button';
import CampoRicerca from '@/components/Base/CampoRicerca';
import { FormCheck, FormField, FormInput } from '@/components/Base/Form';
import Lucide from '@/components/Base/Lucide';
import Pagina from '@/components/Base/Pagina';
import Sezione from '@/components/Base/Sezione';
import StatCard, { StatCardGrid } from '@/components/Base/StatCard';
import StatusBadge from '@/components/Base/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import type { TonoStato } from '@/constants/stati';
import { useNotification } from '@/context/NotificationContext';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLoaderData, useNavigate, useRevalidator } from 'react-router-dom';
import { STATO_ORDINI_STAMPA } from '../../../lib/enums';
import { ServerCall } from '../../../lib/server_call';
import { FileItemKit, MergedGroupFile, OrdiniDiStampaAttributes, OrdiniDiStampaInviiAttributes, RUNTIME_KIT, VirtualDirectory } from '../../../lib/types';
// Importa il client Socket.IO
import docThumbnailFallback from '@/assets/images/icons/icon_doc_locandinaA4.png';
import Progress from '@/components/Base/Progress';
import { formatDataOra, formatDataOraEstesa } from '@/utils/format';
import dayjs from 'dayjs';
import type { Socket } from 'socket.io-client';
import io from 'socket.io-client';
import type { PromoResponseDTO } from '../../../server/core/dto';
import DirectoryPicker from '../../components/DirectoryPicker';
import { PreviewImmaginePdf } from '../../components/PreviewImmaginePdf';
import { contaSelezionati, selezioneDaInviare } from './selezioneKit';

type GroupingResultFile = {
  id_olimpo_cloud: string;
  nome: string;
  id_runtime: string;
  nome_kit: string;
  tipo_export: string;
  pages?: number;
  meta_olimpo_cloud?: any;
};

type GroupingResult = {
  totalFiles: number;
  analyzedFiles: number;
  groupCount: number;
  groups: Array<{
    groupId: string;
    size: number;
    files: GroupingResultFile[];
  }>;
  unmatchedIds: string[];
};

type GroupingStatusResponse = {
  socketId?: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  startedAt?: number;
};

type GroupingRawGroup = {
  groupId?: unknown;
  size?: unknown;
  files?: unknown;
  ids?: unknown;
  originalNames?: unknown;
};

type GroupingRawPayload = {
  totalFiles?: unknown;
  analyzedFiles?: unknown;
  groupCount?: unknown;
  totalGroups?: unknown;
  unmatchedIds?: unknown;
  unmatchedCount?: unknown;
  nonPdfCount?: unknown;
  groups?: unknown;
  message?: unknown;
};

const STATO_RAGGRUPPAMENTO: Record<GroupingStatusResponse['status'], { tono: TonoStato; etichetta: string }> = {
  idle: { tono: 'neutral', etichetta: 'In attesa' },
  running: { tono: 'info', etichetta: 'In corso' },
  completed: { tono: 'success', etichetta: 'Completato' },
  failed: { tono: 'danger', etichetta: 'Errore' },
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toText = (value: unknown): string => (typeof value === 'string' ? value : '');

const toFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const normalizeProgressValue = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  const normalized = value > 1 ? value / 100 : value;
  return Math.min(Math.max(normalized, 0), 1);
};

const parseKitProgressFromMessage = (
  message: string
): { currentKit: number; totalKits: number } | null => {
  const match = message.match(/kit\s+(\d+)\s*\/\s*(\d+)/i);
  if (!match) return null;

  const currentKit = Number.parseInt(match[1], 10);
  const totalKits = Number.parseInt(match[2], 10);

  if (!Number.isFinite(currentKit) || !Number.isFinite(totalKits) || totalKits <= 0) {
    return null;
  }

  return {
    currentKit: Math.min(Math.max(currentKit, 1), totalKits),
    totalKits
  };
};

const computeGlobalProgressValue = (
  currentKitProgress: number,
  currentKitIndex: number,
  totalKits: number
): number => {
  if (totalKits <= 0) return currentKitProgress;

  const boundedKitIndex = Math.min(Math.max(currentKitIndex, 1), totalKits);
  const boundedKitProgress = Math.min(Math.max(currentKitProgress, 0), 1);
  return Math.min(Math.max(((boundedKitIndex - 1) + boundedKitProgress) / totalKits, 0), 1);
};

const tryParseJsonString = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const decodeSocketPayload = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return tryParseJsonString(value);
  }

  if (value instanceof ArrayBuffer) {
    const asText = new TextDecoder().decode(new Uint8Array(value));
    return tryParseJsonString(asText);
  }

  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    const asText = new TextDecoder().decode(
      new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
    );
    return tryParseJsonString(asText);
  }

  if (isObjectRecord(value) && value.type === 'Buffer' && Array.isArray(value.data)) {
    const raw = value.data.filter((item): item is number => typeof item === 'number');
    const asText = new TextDecoder().decode(new Uint8Array(raw));
    return tryParseJsonString(asText);
  }

  return value;
};

const unwrapGroupingPayload = (value: unknown): GroupingRawPayload | null => {
  const decodedValue = decodeSocketPayload(value);

  if (Array.isArray(decodedValue)) {
    if (decodedValue.length > 1 && isObjectRecord(decodedValue[1])) {
      return decodedValue[1] as GroupingRawPayload;
    }
    if (decodedValue.length > 0 && isObjectRecord(decodedValue[0])) {
      return decodedValue[0] as GroupingRawPayload;
    }
    return null;
  }
  if (!isObjectRecord(decodedValue)) {
    return null;
  }
  return decodedValue as GroupingRawPayload;
};

const extractGroupingMessage = (value: unknown): string => {
  const payload = unwrapGroupingPayload(value);
  return payload ? toText(payload.message) : '';
};

// Olimpo si raggiunge dal proxy di Fidelity sulla stessa origine (server/core/middleware/olimpoProxy.ts)
const buildGroupingThumbnailUrl = (id: string): string =>
  `/olimpo/materiali/getThumbnailMaterialePdfs?id=${encodeURIComponent(id)}&page=1`;

const buildGroupingPreviewBaseUrl = (id: string): string =>
  `/olimpo/materiali/getThumbnailMaterialePdfs?id=${encodeURIComponent(id)}`;

const buildGroupingFilesLookup = (
  kits: RUNTIME_KIT[],
  alreadySentKitIds: Set<string>
) => {
  const byId = new Map<string, GroupingResultFile>();
  const byName = new Map<string, GroupingResultFile[]>();

  kits
    .filter((kit) => !alreadySentKitIds.has(kit.guidId))
    .forEach((kit) => {
      kit.files?.forEach((file) => {
        const fileName = file.nome || file.nome_originale || '';
        const mappedFile: GroupingResultFile = {
          id_olimpo_cloud: file.id_olimpo_cloud || '',
          nome: fileName,
          id_runtime: file.id_runtime || kit.guidId,
          nome_kit: kit.titolo || file.nome_kit || '',
          tipo_export: file.tipo_export_codice || file.tipo_export || '',
          pages: file.pages,
          meta_olimpo_cloud: file.meta_olimpo_cloud
        };

        if (file.id_olimpo_cloud && !byId.has(file.id_olimpo_cloud)) {
          byId.set(file.id_olimpo_cloud, mappedFile);
        }

        if (fileName) {
          const current = byName.get(fileName) || [];
          current.push(mappedFile);
          byName.set(fileName, current);
        }
      });
    });

  return { byId, byName };
};

const normalizeGroupingResultPayload = (
  input: unknown,
  kits: RUNTIME_KIT[],
  alreadySentKitIds: Set<string>
): GroupingResult | null => {
  const payload = unwrapGroupingPayload(input);
  if (!payload) return null;

  const hasGroupingData = Array.isArray(payload.groups)
    || toFiniteNumber(payload.groupCount) !== null
    || toFiniteNumber(payload.totalGroups) !== null
    || toFiniteNumber(payload.totalFiles) !== null
    || toFiniteNumber(payload.analyzedFiles) !== null
    || Array.isArray(payload.unmatchedIds)
    || toFiniteNumber(payload.unmatchedCount) !== null
    || toFiniteNumber(payload.nonPdfCount) !== null;

  if (!hasGroupingData) return null;

  const filesLookup = buildGroupingFilesLookup(kits, alreadySentKitIds);
  const rawGroups = Array.isArray(payload.groups)
    ? payload.groups.filter((group): group is GroupingRawGroup => isObjectRecord(group))
    : [];

  const groups = rawGroups
    .map((rawGroup, groupIndex) => {
      const groupId = toText(rawGroup.groupId) || `group-${groupIndex + 1}`;
      const sizeFromPayload = toFiniteNumber(rawGroup.size);

      const filesFromPayload = Array.isArray(rawGroup.files)
        ? rawGroup.files
          .filter((file): file is Record<string, unknown> => isObjectRecord(file))
          .map((file, fileIndex) => ({
            id_olimpo_cloud: toText(file.id_olimpo_cloud) || toText(file.id) || `${groupId}-${fileIndex + 1}`,
            nome: toText(file.nome) || `File ${fileIndex + 1}`,
            id_runtime: toText(file.id_runtime),
            nome_kit: toText(file.nome_kit),
            tipo_export: toText(file.tipo_export),
            pages: toFiniteNumber(file.pages) ?? undefined
          }))
        : [];

      if (filesFromPayload.length > 0) {
        return {
          groupId,
          size: sizeFromPayload ?? filesFromPayload.length,
          files: filesFromPayload
        };
      }

      const ids = Array.isArray(rawGroup.ids)
        ? rawGroup.ids.map((id) => toText(id)).filter((id) => id.length > 0)
        : [];
      const originalNames = Array.isArray(rawGroup.originalNames)
        ? rawGroup.originalNames.map((name) => toText(name))
        : [];

      const filesFromIds = ids.map((id, index) => {
        const mappedById = filesLookup.byId.get(id);
        if (mappedById) {
          return mappedById;
        }

        const name = originalNames[index];
        if (name) {
          const mappedByName = filesLookup.byName.get(name);
          if (mappedByName && mappedByName.length > 0) {
            return mappedByName[0];
          }
        }

        return {
          id_olimpo_cloud: id,
          nome: name || `File ${index + 1}`,
          id_runtime: '',
          nome_kit: '',
          tipo_export: ''
        };
      });

      if (filesFromIds.length > 0) {
        return {
          groupId,
          size: sizeFromPayload ?? filesFromIds.length,
          files: filesFromIds
        };
      }

      const filesFromNames = originalNames
        .filter((name) => name.length > 0)
        .map((name, index) => {
          const mappedByName = filesLookup.byName.get(name);
          if (mappedByName && mappedByName.length > 0) {
            return mappedByName[0];
          }

          return {
            id_olimpo_cloud: `${groupId}-${index + 1}`,
            nome: name,
            id_runtime: '',
            nome_kit: '',
            tipo_export: ''
          };
        });

      return {
        groupId,
        size: sizeFromPayload ?? filesFromNames.length,
        files: filesFromNames
      };
    })
    .filter((group) => group.files.length > 0);

  const unmatchedIds = Array.isArray(payload.unmatchedIds)
    ? payload.unmatchedIds.map((id) => toText(id)).filter((id) => id.length > 0)
    : [];
  const unmatchedCount = toFiniteNumber(payload.unmatchedCount) ?? unmatchedIds.length;
  const nonPdfCount = toFiniteNumber(payload.nonPdfCount) ?? 0;
  const groupedFiles = groups.reduce((total, group) => total + group.files.length, 0);
  const inferredAnalyzedFiles = groupedFiles + unmatchedCount + nonPdfCount;

  return {
    totalFiles: toFiniteNumber(payload.totalFiles) ?? toFiniteNumber(payload.analyzedFiles) ?? inferredAnalyzedFiles,
    analyzedFiles: toFiniteNumber(payload.analyzedFiles) ?? toFiniteNumber(payload.totalFiles) ?? inferredAnalyzedFiles,
    groupCount: toFiniteNumber(payload.groupCount) ?? toFiniteNumber(payload.totalGroups) ?? groups.length,
    groups,
    unmatchedIds
  };
};

const RevisioneOrdiniDiStampa: React.FC = () => {
  const { dettagli, ordine, promo, ordiniInvii } = useLoaderData() as {
    dettagli: RUNTIME_KIT[];
    ordine: OrdiniDiStampaAttributes;
    promo: PromoResponseDTO;
    ordiniInvii: OrdiniDiStampaInviiAttributes[]
  };
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get('id');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedKits, setExpandedKits] = useState<Record<string, boolean>>({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDialogInvioFTP, setShowDialogInvioFTP] = useState(false);
  const navigate = useNavigate();
  const r = useRevalidator();
  const { showNotification } = useNotification();
  const [statoSbagliato, setStatoSbagliato] = useState<boolean>(false);

  // State per la selezione dei kit
  const [selectedKits, setSelectedKits] = useState<Record<string, boolean>>({});

  const [selectAll, setSelectAll] = useState<boolean>(false);
  // State per messaggi FTP dai due backend
  const [ftpProgressMessage, setFtpProgressMessage] = useState<string>('');
  const [ftpErrorMessage, setFtpErrorMessage] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [globalProgress, setGlobalProgress] = useState<number>(0);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [transferComplete, setTransferComplete] = useState<boolean>(false);
  const ftpProgressTrackerRef = useRef<{ activeKitIndex: number; totalKits: number }>({
    activeKitIndex: 1,
    totalKits: 0
  });
  const [ftpTransferDetail, setFtpTransferDetail] = useState<{
    fase: string;
    kit: string;
    fileName: string;
    currentFile: number;
    totalFiles: number;
    totalKits: number;
    message: string;
  }>({ fase: '', kit: '', fileName: '', currentFile: 0, totalFiles: 0, totalKits: 0, message: '' });
  // Connessioni socket per i due backend
  // Aggiorna gli URL con quelli effettivi dei tuoi server

  const [socketExpress, setSocketExpress] = useState<Socket>();
  const [socketNest, setSocketNest] = useState<Socket>();

  // Grouping state
  const [groupingStatus, setGroupingStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [groupingProgress, setGroupingProgress] = useState<number>(0);
  const [groupingMessage, setGroupingMessage] = useState('');
  const [groupingError, setGroupingError] = useState('');
  const [groupingResult, setGroupingResult] = useState<GroupingResult | null>(null);
  const [groupingJobId, setGroupingJobId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ imageUrl: string; pages: number } | null>(null);

  // Merge group state
  const [virtualDirs, setVirtualDirs] = useState<VirtualDirectory[]>([]);
  const [virtualDirsLoading, setVirtualDirsLoading] = useState(false);
  const [groupMergeState, setGroupMergeState] = useState<Record<string, {
    nome: string;
    virtualDir: string;
    merging: boolean;
    merged: boolean;
    error: string;
    mergedFileId?: string;
    mergedFileIds?: string[];
  }>>({});

  const normalizeCurrentGroupingResult = useCallback((input: unknown): GroupingResult | null => {
    const alreadySentKitIds = new Set<string>(
      ordiniInvii
        .map((invio) => invio.report_ordinistampainvii?.kit_guids || [])
        .flat()
    );
    return normalizeGroupingResultPayload(input, dettagli, alreadySentKitIds);
  }, [dettagli, ordiniInvii]);

  const detachGroupingListeners = useCallback((socketId: string | null) => {
    if (!socketId) return;
    socketNest?.off(`${socketId}_info`);
    socketNest?.off(`${socketId}_progress`);
    socketNest?.off(`${socketId}_error`);
    socketNest?.off(`${socketId}_complete`);
    socketExpress?.off(`${socketId}_result`);
    socketExpress?.off(`${socketId}_error`);
  }, [socketExpress, socketNest]);

  const attachGroupingListeners = useCallback((socketId: string) => {
    detachGroupingListeners(socketId);

    socketNest?.on(`${socketId}_info`, (msg: any) => {
      setGroupingMessage(`${msg.totalPdfs} PDF da analizzare`);
    });
    socketNest?.on(`${socketId}_progress`, (msg: any) => {
      if (msg.phase === 'deep_comparison') {
        setGroupingProgress(msg.percentage || 0);
        setGroupingMessage(`Confronto ${msg.current}/${msg.total}: ${msg.fileName}`);
      } else if (msg.phase === 'pair_comparison') {
        setGroupingMessage(msg.message);
        setGroupingProgress(msg.percentage);
      } else if (msg.phase === 'md5_grouping') {
        setGroupingProgress(msg.percentage || 0);
        setGroupingMessage(msg.message);
      }
    });
    socketNest?.on(`${socketId}_error`, (msg: unknown) => {
      const decodedMsg = decodeSocketPayload(msg);
      const errorMessage = isObjectRecord(decodedMsg)
        ? toText(decodedMsg.error) || toText(decodedMsg.message)
        : '';
      setGroupingError(errorMessage || 'Errore durante il raggruppamento');
      setGroupingStatus('failed');
      setGroupingJobId(null);
      detachGroupingListeners(socketId);
    });
    socketNest?.on(`${socketId}_complete`, (msg: unknown) => {
      setGroupingProgress(100);
      setGroupingMessage(extractGroupingMessage(msg) || 'Analisi completata');

      const normalized = normalizeCurrentGroupingResult(msg);
      if (normalized) {
        setGroupingResult(normalized);
        setGroupingStatus('completed');
        setGroupingError('');
        setGroupingJobId(null);
        detachGroupingListeners(socketId);
      }
    });

    socketExpress?.on(`${socketId}_result`, (data: unknown) => {
      const normalized = normalizeCurrentGroupingResult(data);
      if (normalized) {
        setGroupingResult(normalized);
      }
      setGroupingStatus('completed');
      setGroupingError('');
      setGroupingProgress(100);
      setGroupingMessage((previousMessage) =>
        previousMessage || extractGroupingMessage(data) || 'Analisi completata'
      );
      setGroupingJobId(null);
      detachGroupingListeners(socketId);
    });
    socketExpress?.on(`${socketId}_error`, (err: unknown) => {
      const decodedErr = decodeSocketPayload(err);
      const errorMessage = isObjectRecord(decodedErr)
        ? toText(decodedErr.error) || toText(decodedErr.message)
        : '';
      setGroupingError(errorMessage || 'Errore durante il raggruppamento');
      setGroupingStatus('failed');
      setGroupingJobId(null);
      detachGroupingListeners(socketId);
    });
  }, [detachGroupingListeners, normalizeCurrentGroupingResult, socketExpress, socketNest]);

  // Helper function per identificare kit già inviati
  const isKitAlreadySent = (kitId: string): boolean => {
    return ordiniInvii.some((invio) =>
      invio.report_ordinistampainvii.kit_guids.includes(kitId)
    );
  }

  // Separazione dei kit in base al loro stato di invio
  const kitInviati = React.useMemo(() => {
    return Array.isArray(dettagli)
      ? dettagli.filter(kit => isKitAlreadySent(kit.guidId))
      : [];
  }, [dettagli, ordiniInvii]);

  const kitDisponibili = React.useMemo(() => {
    return Array.isArray(dettagli)
      ? dettagli.filter(kit => !isKitAlreadySent(kit.guidId))
      : [];
  }, [dettagli, ordiniInvii]);

  // Filtro solo sui kit disponibili (non ancora inviati)
  const filteredKitDisponibili = kitDisponibili.filter(item =>
    item.titolo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.guidId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.nomeCanale?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.nomeArea?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filtro sui kit già inviati (per la visualizzazione)
  const filteredKitInviati = kitInviati.filter(item =>
    item.titolo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.guidId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.nomeCanale?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.nomeArea?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Raggruppo i kit per invio
  const gruppInvii = React.useMemo(() => {
    return ordiniInvii.map(invio => {
      const kitDelGruppo = dettagli.filter(kit =>
        invio.report_ordinistampainvii.kit_guids.includes(kit.guidId)
      );

      // Applico il filtro di ricerca ai kit del gruppo
      const kitDelGruppoFiltrati = kitDelGruppo.filter(kit =>
        kit.titolo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kit.guidId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kit.nomeCanale?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kit.nomeArea?.toLowerCase().includes(searchTerm.toLowerCase())
      );

      return {
        invio,
        kit: kitDelGruppoFiltrati,
        kitTotali: kitDelGruppo.length // Per mostrare il numero totale anche quando filtrati
      };
    }).filter(gruppo => gruppo.kit.length > 0 || !searchTerm); // Mostra gruppi solo se hanno kit che matchano il filtro
  }, [ordiniInvii, dettagli, searchTerm]);


  useEffect(() => {
    const expressSocket = io((import.meta.env.VITE_WS_URL as string).replace('/api', ''), { withCredentials: true, transports: ['websocket', 'polling'] });
    // Socket di Olimpo attraverso il proxy /olimpo: solo polling, il proxy non inoltra il websocket
    const nestSocket = io({ path: '/olimpo/socket.io', transports: ['polling'] });
    setSocketExpress(expressSocket);
    setSocketNest(nestSocket);

    return () => {
      expressSocket.disconnect();
      nestSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!groupingJobId || !socketExpress || !socketNest) return;

    attachGroupingListeners(groupingJobId);
    return () => {
      detachGroupingListeners(groupingJobId);
    };
  }, [attachGroupingListeners, detachGroupingListeners, groupingJobId, socketExpress, socketNest]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    const recoverGroupingState = async () => {
      try {
        const job = await ServerCall.get<GroupingStatusResponse>(
          `/ordini-stampa/group-files-status?idOrdineDiStampa=${encodeURIComponent(id)}`
        );

        if (cancelled || !job || job.status === 'idle') return;

        if (job.status === 'running' && job.socketId) {
          setGroupingStatus('running');
          setGroupingProgress(0);
          setGroupingResult(null);
          setGroupingError('');
          setGroupingMessage('Ripristino monitoraggio raggruppamento...');
          setGroupingJobId(job.socketId);
          return;
        }

        if (job.status === 'completed') {
          setGroupingStatus('completed');
          setGroupingProgress(100);
          setGroupingMessage('Analisi completata');
          setGroupingError('');
          setGroupingResult(normalizeCurrentGroupingResult(job.result));
          setGroupingJobId(null);
          return;
        }

        if (job.status === 'failed') {
          setGroupingStatus('failed');
          setGroupingError(job.error || 'Errore durante il raggruppamento');
          setGroupingJobId(null);
        }
      } catch (error) {
        console.error('[grouping] Errore durante il recupero stato job:', error);
      }
    };

    void recoverGroupingState();

    return () => {
      cancelled = true;
    };
  }, [id, normalizeCurrentGroupingResult]);


  // useEffect(()=>{
  //   localStorage.setItem("SOCKET", socketExpress?.id || 'ciaooooooo');
  // },[socketExpress])


  // Hydrate merge state: fetch existing merged groups from DB and cross-reference with grouping results
  useEffect(() => {
    if (!groupingResult?.groups?.length || !id) return;

    let cancelled = false;

    const matchGroupToMergedDoc = (
      group: GroupingResult['groups'][number],
      mergedDocs: MergedGroupFile[]
    ): MergedGroupFile | null => {
      // First: exact match by groupId
      const byGroupId = mergedDocs.find(d => d.merged_group_id === group.groupId);
      if (byGroupId) return byGroupId;
      // Fallback: match by set of file IDs (handles groupId instability across runs)
      const groupOlimpoIds = new Set(group.files.map(f => f.id_olimpo_cloud));
      return mergedDocs.find(d =>
        d.merged_file_ids?.length === groupOlimpoIds.size &&
        d.merged_file_ids.every(fid => groupOlimpoIds.has(fid))
      ) || null;
    };

    const hydrateMergeState = async () => {
      let mergedDocs: MergedGroupFile[] = [];
      try {
        const res = await ServerCall.get<{ esito: boolean; mergedGroups: MergedGroupFile[] }>(
          `/ordini-stampa/merged-groups?idOrdineDiStampa=${encodeURIComponent(id)}`
        );
        if (res?.mergedGroups) mergedDocs = res.mergedGroups;
      } catch (err) {
        console.error('[merged-groups] Errore durante il recupero:', err);
      }

      if (cancelled) return;

      setGroupMergeState(prev => {
        const next = { ...prev };
        for (const group of groupingResult.groups) {
          // Don't overwrite a group merged in this session
          if (next[group.groupId]?.merged) continue;

          const match = matchGroupToMergedDoc(group, mergedDocs);
          if (match) {
            next[group.groupId] = {
              nome: match.nome,
              virtualDir: match.virtual_dir || '',
              merging: false,
              merged: true,
              error: '',
              mergedFileId: match.id,
              mergedFileIds: match.merged_file_ids
            };
          } else if (!next[group.groupId]) {
            next[group.groupId] = {
              nome: group.files[0]?.nome || '',
              virtualDir: '',
              merging: false,
              merged: false,
              error: ''
            };
          }
        }
        return next;
      });
    };

    void hydrateMergeState();
    return () => { cancelled = true; };
  }, [groupingResult, id]);

  // Fetch virtual directories when grouping completes
  useEffect(() => {
    if (groupingStatus !== 'completed' || !id || virtualDirs.length > 0) return;
    let cancelled = false;
    const fetchDirs = async () => {
      setVirtualDirsLoading(true);
      try {
        const res = await ServerCall.get<{ esito: boolean; directories: VirtualDirectory[] }>(
          `/ordini-stampa/virtual-directories?idOrdineDiStampa=${encodeURIComponent(id)}`
        );
        if (!cancelled && res?.directories) {
          setVirtualDirs(res.directories);
        }
      } catch (err) {
        console.error('[virtual-directories] Errore:', err);
      } finally {
        if (!cancelled) setVirtualDirsLoading(false);
      }
    };
    void fetchDirs();
    return () => { cancelled = true; };
  }, [groupingStatus, id, virtualDirs.length]);

  // Update merge state for a single group
  const updateGroupMerge = useCallback((groupId: string, update: Partial<typeof groupMergeState[string]>) => {
    setGroupMergeState(prev => {
      const defaults = { nome: '', virtualDir: '', merging: false, merged: false, error: '' };
      const current = prev[groupId] ?? defaults;
      return { ...prev, [groupId]: { ...current, ...update } };
    });
  }, []);

  // Handle merge submission for a group
  const handleMergeGroup = useCallback(async (group: GroupingResult['groups'][number]) => {
    const state = groupMergeState[group.groupId];
    const nome = state?.nome?.trim() || group.files[0]?.nome || `merged-${group.groupId}`;

    updateGroupMerge(group.groupId, { merging: true, error: '' });

    try {
      const result = await ServerCall.post<{ esito: boolean; mergedFile: MergedGroupFile }>('/ordini-stampa/merge-group', {
        idOrdineDiStampa: id,
        groupId: group.groupId,
        nome,
        virtualDir: state?.virtualDir || '',
        files: group.files.map(f => ({
          id_olimpo_cloud: f.id_olimpo_cloud,
          nome: f.nome,
          id_runtime: f.id_runtime,
          nome_kit: f.nome_kit,
          tipo_export: f.tipo_export,
          pages: f.pages,
          meta_olimpo_cloud: f.meta_olimpo_cloud
        }))
      });
      updateGroupMerge(group.groupId, {
        merging: false,
        merged: true,
        mergedFileId: result.mergedFile?.id
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore durante il merge';
      updateGroupMerge(group.groupId, { merging: false, error: message });
    }
  }, [groupMergeState, id, updateGroupMerge]);

  // Handle delete/undo of a merged group
  const handleDeleteMerge = useCallback(async (groupId: string) => {
    const state = groupMergeState[groupId];
    if (!state?.mergedFileId || !id) return;

    updateGroupMerge(groupId, { merging: true, error: '' });

    try {
      await ServerCall.delete(
        `/ordini-stampa/merged-groups/${encodeURIComponent(state.mergedFileId)}?idOrdineDiStampa=${encodeURIComponent(id)}`
      );
      updateGroupMerge(groupId, {
        merging: false,
        merged: false,
        mergedFileId: undefined,
        mergedFileIds: undefined,
        error: ''
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore durante l'annullamento del merge";
      updateGroupMerge(groupId, { merging: false, error: message });
    }
  }, [groupMergeState, id, updateGroupMerge]);

  // Toggle per espandere il dettaglio di un kit
  const toggleKitExpansion = (guidId: string) => {
    setExpandedKits(prev => ({ ...prev, [guidId]: !prev[guidId] }));
  };

  useEffect(() => {
    if (ordine && ordine.stato_ordinistampa === STATO_ORDINI_STAMPA.FINITO) {
      setStatoSbagliato(true);
    }
  }, [ordine]);

  // Gestione della selezione dei kit
  const toggleKitSelection = (e: React.MouseEvent, guidId: string) => {
    e.stopPropagation();
    setSelectedKits(prev => ({ ...prev, [guidId]: !prev[guidId] }));
  };

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    const newSelectedKits: Record<string, boolean> = {};
    filteredKitDisponibili?.forEach(kit => {
      newSelectedKits[kit.guidId] = newSelectAll;
    });
    setSelectedKits(newSelectedKits);
  };

  const selezioneInvio = selezioneDaInviare(kitDisponibili, selectedKits);
  const selectedKitsCount = contaSelezionati(selezioneInvio);

  const handleDownloadZip = async (idKit: string) => {
    setIsDownloading(true);
    try {
      const url = ServerCall.getUrl();
      const response = await axios.get(`${url}/getFileZipDownload?id=${idKit}`, {
        responseType: 'arraybuffer',
        withCredentials: true,
      });
      if (response.status !== 200) {
        showNotification('Download del file ZIP non riuscito.', { variant: 'error' });
        return;
      }
      const blob = new Blob([response.data]);
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'files.zip';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 1000);
    } catch (error) {
      console.error('Errore durante il download del file ZIP:', error);
      showNotification('Download del file ZIP non riuscito.', { variant: 'error' });
    } finally {
      setIsDownloading(false);
    }
  };
  // Mutation per l'invio dei file alla tipografia (chiamata a /iniziaFTPPopOlimpo)
  const mutationInvioFileFTP = useMutation({
    mutationFn: async (data: Record<string, boolean>) => {
      const result = await ServerCall.put('/iniziaFTPPopOlimpo', { idOrdineDiStampa: id, kitIds: data });
      return result;
    },
    onMutate: () => {
      setIsTransferring(true);
      setTransferComplete(false);
      setFtpProgressMessage('Avvio trasferimento...');
      setFtpErrorMessage('');
      setProgress(0);
      setGlobalProgress(0);
      ftpProgressTrackerRef.current = { activeKitIndex: 1, totalKits: 0 };
      setFtpTransferDetail({ fase: '', kit: '', fileName: '', currentFile: 0, totalFiles: 0, totalKits: 0, message: '' });
    },
    onError: error => {
      console.error('Errore durante l\'invio dei file:', error);
      // Il server spiega il rifiuto, es. "Invio già in corso per questo ordine"
      const messaggio = error?.message || "Errore durante l'invio dei file alla tipografia.";
      setFtpErrorMessage(messaggio);
      showNotification(messaggio, { variant: 'error' });
      setIsTransferring(false);
    },
    onSuccess: (data: any) => {
      const { socketId } = data;
      // A fine invio si smette di ascoltare; i socket restano aperti per gli invii successivi
      const smettiDiAscoltare = () => ['progress', 'error', 'complete'].forEach(evento => {
        socketExpress?.off(`${socketId}_${evento}`);
        socketNest?.off(`${socketId}_${evento}`);
      });

      // Ascolta gli eventi dal backend Express
      socketExpress?.on(`${socketId}_progress`, (raw: unknown) => {
        const decoded = decodeSocketPayload(raw);
        const msg = isObjectRecord(decoded) ? decoded : {};
        const fase = toText(msg.fase);
        const kit = toText(msg.kit);
        const message = toText(msg.message);
        const totalKits = toFiniteNumber(msg.totalKits);
        const progressVal = toFiniteNumber(msg.progress);

        const parsedFromMessage = parseKitProgressFromMessage(message);
        if (parsedFromMessage) {
          ftpProgressTrackerRef.current = {
            activeKitIndex: parsedFromMessage.currentKit,
            totalKits: parsedFromMessage.totalKits
          };
        } else {
          const trackedTotalKits = totalKits !== null && totalKits > 0
            ? totalKits
            : ftpProgressTrackerRef.current.totalKits;
          let trackedKitIndex = ftpProgressTrackerRef.current.activeKitIndex;

          if (trackedTotalKits > 0 && progressVal !== null) {
            trackedKitIndex = Math.min(
              Math.max(Math.round(normalizeProgressValue(progressVal) * trackedTotalKits), 1),
              trackedTotalKits
            );
          }

          ftpProgressTrackerRef.current = {
            activeKitIndex: trackedKitIndex,
            totalKits: trackedTotalKits
          };
        }

        const { activeKitIndex, totalKits: trackedTotalKits } = ftpProgressTrackerRef.current;
        if (trackedTotalKits > 0) {
          const startingPoint = (Math.max(activeKitIndex, 1) - 1) / trackedTotalKits;
          setGlobalProgress((prev) => Math.max(prev, startingPoint));
        }

        setFtpProgressMessage(message);
        setFtpTransferDetail(prev => ({
          ...prev,
          fase: fase || prev.fase,
          kit: kit || prev.kit,
          totalKits: totalKits ?? prev.totalKits,
          message: message || prev.message,
        }));
      });
      socketExpress?.on(`${socketId}_error`, (raw: unknown) => {
        const decoded = decodeSocketPayload(raw);
        const err = isObjectRecord(decoded) ? decoded : {};
        const messaggio = toText(err.error) || 'Errore durante il trasferimento';
        setFtpErrorMessage(messaggio);
        const kit = toText(err.kit);
        // Errore di un singolo kit: il server prosegue con gli altri e chiude con _complete
        if (kit) {
          setFtpTransferDetail(prev => ({ ...prev, kit }));
          return;
        }
        // Errore generale: l'invio è terminato
        setIsTransferring(false);
        showNotification(messaggio, { variant: 'error' });
        smettiDiAscoltare();
      });
      socketExpress?.on(`${socketId}_complete`, (raw: unknown) => {
        const decoded = decodeSocketPayload(raw);
        const msg = isObjectRecord(decoded) ? decoded : {};
        const message = toText(msg.message);
        // esito false: alcuni kit non inviati, elencati nel messaggio del server
        const esito = msg.esito !== false;
        const totalFiles = toFiniteNumber(msg.totalFiles);
        const totalKit = toFiniteNumber(msg.totalKit);
        if (totalKit !== null && totalKit > 0) {
          ftpProgressTrackerRef.current = { activeKitIndex: totalKit, totalKits: totalKit };
        }
        setProgress(1);
        setGlobalProgress(1);
        setFtpProgressMessage(message || 'Processo completato');
        setFtpTransferDetail(prev => ({
          ...prev,
          fase: 'completato',
          totalFiles: totalFiles ?? prev.totalFiles,
          totalKits: totalKit ?? prev.totalKits,
          message: message || '',
        }));
        if (esito) {
          setTransferComplete(true);
        } else {
          setFtpErrorMessage(message || 'Alcuni kit non sono stati inviati');
        }
        setIsTransferring(false);
        // I kit inviati escono da kitDisponibili alla revalidate, e con loro dal conteggio
        setSelectAll(false);
        showNotification(message || 'Processo completato', { variant: esito ? 'success' : 'warning' });
        smettiDiAscoltare();
        setTimeout(() => r.revalidate(), 500);
      });
      // Ascolta gli eventi dal backend NestJS
      socketNest?.on(`${socketId}_progress`, (raw: unknown) => {
        const decoded = decodeSocketPayload(raw);
        const msg = isObjectRecord(decoded) ? decoded : {};
        const progressVal = toFiniteNumber(msg.progress);
        const fase = toText(msg.fase);
        const fileName = toText(msg.fileName);
        const message = toText(msg.message);
        const file = toFiniteNumber(msg.file);
        const totalFiles = toFiniteNumber(msg.totalFiles);
        const totalKits = toFiniteNumber(msg.totalKits);
        const parsedFromMessage = parseKitProgressFromMessage(message);

        if (parsedFromMessage) {
          ftpProgressTrackerRef.current = {
            activeKitIndex: parsedFromMessage.currentKit,
            totalKits: parsedFromMessage.totalKits
          };
        }

        if (totalKits !== null && totalKits > 0) {
          ftpProgressTrackerRef.current = {
            ...ftpProgressTrackerRef.current,
            totalKits
          };
        }

        if (progressVal !== null) {
          const normalizedProgress = normalizeProgressValue(progressVal);
          setProgress(normalizedProgress);
          const { activeKitIndex, totalKits: trackedTotalKits } = ftpProgressTrackerRef.current;
          if (trackedTotalKits > 0) {
            const computedGlobal = computeGlobalProgressValue(normalizedProgress, activeKitIndex, trackedTotalKits);
            setGlobalProgress((prev) => Math.max(prev, computedGlobal));
          } else {
            setGlobalProgress((prev) => Math.max(prev, normalizedProgress));
          }
        }
        setFtpProgressMessage(fileName || message);
        setFtpTransferDetail(prev => ({
          ...prev,
          fase: fase || prev.fase,
          fileName: fileName || prev.fileName,
          currentFile: file ?? prev.currentFile,
          totalFiles: totalFiles ?? prev.totalFiles,
          message: message || prev.message,
        }));
      });
      // Olimpo segnala errori di singoli file/kit; l'esito finale arriva dal backend Express con _complete
      socketNest?.on(`${socketId}_error`, (raw: unknown) => {
        const decoded = decodeSocketPayload(raw);
        const err = isObjectRecord(decoded) ? decoded : {};
        const file = toText(err.file);
        const messaggio = toText(err.error) || 'Errore durante il trasferimento';
        setFtpErrorMessage(file ? `${file}: ${messaggio}` : messaggio);
      });
    },
  });

  // Mutation per il raggruppamento file uguali
  const mutationGrouping = useMutation({
    mutationFn: async () => {
      return await ServerCall.post<{ esito: boolean; socketId: string; message: string }>(
        '/ordini-stampa/group-files-by-equality',
        { idOrdineDiStampa: id }
      );
    },
    onSuccess: (data) => {
      const { socketId } = data;
      setGroupingStatus('running');
      setGroupingProgress(0);
      setGroupingMessage('Avvio raggruppamento...');
      setGroupingResult(null);
      setGroupingError('');
      setGroupingJobId(socketId);
    },
    onError: (error) => {
      setGroupingError(error.message || 'Errore durante l\'avvio del raggruppamento');
      setGroupingStatus('failed');
      setGroupingJobId(null);
    }
  });

  const resetGroupingState = () => {
    detachGroupingListeners(groupingJobId);
    setGroupingJobId(null);
    setGroupingStatus('idle');
    setGroupingProgress(0);
    setGroupingMessage('');
    setGroupingError('');
    setGroupingResult(null);
  };

  const numeroFileProblematiciTesto = React.useMemo(() => {
    const fileMap = new Map<string, FileItemKit[]>();
    // Considera solo i kit disponibili (non ancora inviati) per i file problematici
    filteredKitDisponibili?.forEach(kit => {
      kit.files?.forEach(file => {
        if (!fileMap.has(file.nome)) {
          fileMap.set(file.nome, []);
        }
        fileMap.get(file.nome)?.push(file);
      });
    });
    const problematicFiles = Array.from(fileMap.values()).filter(files => files.length > 1);
    if (problematicFiles.length === 0) return '';
    const maxShow = 20;
    const names = problematicFiles.map(files => files[0].nome);
    const shown = names.slice(0, maxShow).join(', ');
    const extra = names.length > maxShow ? `, ... (+${names.length - maxShow})` : '';
    return `${problematicFiles.length} file problematici: ${shown}${extra}`;
  }, [filteredKitDisponibili]);

  const numeroFileProblematici = React.useMemo(() => {
    const fileMap = new Map<string, FileItemKit[]>();
    // Considera solo i kit disponibili (non ancora inviati) per i file problematici
    filteredKitDisponibili?.forEach(kit => {
      kit.files?.forEach(file => {
        if (!fileMap.has(file.nome)) {
          fileMap.set(file.nome, []);
        }
        fileMap.get(file.nome)?.push(file);
      });
    });
    const problematicFiles = Array.from(fileMap.values()).filter(files => files.length > 1);
    return problematicFiles.length;
  }, [filteredKitDisponibili]);
  // Funzione per renderizzare gruppi di kit inviati
  const renderGruppiInvii = (gruppi: { invio: OrdiniDiStampaInviiAttributes; kit: RUNTIME_KIT[]; kitTotali: number; }[]) => {
    return gruppi.map((gruppo, index) => (
      <div key={gruppo.invio.id_ordinistampainvii || index} className="overflow-hidden rounded-card border border-slate-200 bg-white">
        {/* Intestazione del gruppo */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-success/10 text-success">
              <Lucide icon="SendHorizontal" aria-hidden="true" className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="title-card flex flex-wrap items-center gap-2">
                Ordine di invio #{gruppo.invio.id_ordinistampainvii?.slice(0, 8)}
                <StatusBadge tono="success" etichetta="Inviato" />
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <Lucide icon="Calendar" aria-hidden="true" className="h-3.5 w-3.5" />
                Inviato il {formatDataOraEstesa(gruppo.invio?.createdat)}
              </div>
            </div>
          </div>
          <Button
            onClick={async () => {
              if (gruppo.invio?.id_ordinistampainvii) {
                try {
                  const response = await axios.get(
                    `${ServerCall.getUrl()}/downloadReportExcel?id=${gruppo.invio.id_ordinistampainvii}`,
                    {
                      responseType: 'arraybuffer',
                      withCredentials: true,
                    }
                  );

                  if (response.status === 200) {
                    const blob = new Blob([response.data], {
                      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    });
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `report_invio_${gruppo.invio.id_ordinistampainvii}_${dayjs(gruppo.invio.createdat).format('YYYY-MM-DD')}.xlsx`;
                    document.body.appendChild(link);
                    link.click();
                    setTimeout(() => {
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                    }, 100);
                  }
                } catch (error) {
                  console.error('Errore durante il download del report:', error);
                  setFtpErrorMessage('Errore durante il download del report Excel.');
                }
              }
            }}
            variant="outline-secondary"
            size="sm"
            className="flex-none"
          >
            <Lucide icon="FileSpreadsheet" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Scarica report di invio
          </Button>
        </div>

        {/* Lista dei kit del gruppo */}
        <div className="divide-y divide-slate-100">
          {gruppo.kit.map((kit) => (
            <div key={kit.guidId} className="p-4 transition-colors hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-success/10 text-success">
                  <Lucide icon="Check" aria-hidden="true" className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800">{kit.titolo}</div>
                  <div className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-slate-500 sm:grid-cols-3">
                    <div>Area: {kit.nomeArea || kit.guidArea}</div>
                    <div>Canale: {kit.nomeCanale || kit.guidCanale}</div>
                    <div>Copie: {kit.quantitaCopie}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {kit.files && kit.files.length > 0 && (
                    <Button
                      onClick={() => navigate(`/ods-in-corso/kit-dettagli?id=${kit.guidId}&idOrdine=${id}`)}
                      variant="outline-secondary"
                      size="sm"
                    >
                      <Lucide icon="ExternalLink" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                      {kit.files.length} file
                    </Button>
                  )}
                  <div className="whitespace-nowrap text-xs text-slate-500">
                    ID: {kit.guidId.substring(0, 8)}...
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ));
  };

  // Vista di sola lettura per ordini completati
  if (statoSbagliato) {
    return (
      <Pagina
        titolo="Dettaglio ordine completato"
        descrizione={`Promo: ${promo.nome}`}
        indietro={{ onClick: () => navigate(-1), etichetta: 'Torna indietro' }}
        badges={<StatusBadge dominio="ordineStampa" stato={ordine.stato_ordinistampa} />}
      >
        <Sezione>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-control bg-success/10 text-success">
              <Lucide icon="CircleCheck" aria-hidden="true" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="title-section">Ordine completato</h2>
              <p className="mt-1 text-sm text-slate-500">
                Questo ordine è stato completato e inviato alla tipografia. Di seguito puoi visualizzare i report degli invii effettuati.
              </p>
            </div>
          </div>
        </Sezione>

        {/* Report invii, con la ricerca dentro la sezione che filtra */}
        <Sezione
          senzaPadding
          icona="Package"
          titolo={`Invii effettuati (${gruppInvii?.length ?? 0})`}
        >
          <BarraFiltri>
            <CampoRicerca
              etichetta="Cerca nei kit inviati"
              placeholder="Cerca nei kit inviati…"
              value={searchTerm}
              onChange={setSearchTerm}
            />
          </BarraFiltri>
          {gruppInvii && gruppInvii.length > 0 ? (
            <div className="space-y-4 p-5">
              {renderGruppiInvii(gruppInvii)}
            </div>
          ) : (
            <EmptyState
              compatta
              title="Nessun invio trovato"
              description={searchTerm ? `Nessun kit trovato per "${searchTerm}"` : "Non sono stati trovati invii per questo ordine."}
              icon="Search"
            />
          )}
        </Sezione>
      </Pagina>
    );
  }


  const renderDettagli = (dettagli: RUNTIME_KIT[]) => {
    return dettagli.map((kit) => {
      // Ora questa funzione gestisce solo i kit disponibili (non ancora inviati)
      return (
        <div key={kit.guidId} className="overflow-hidden rounded-card border border-slate-200 bg-white transition-colors hover:border-slate-300">
          <div className="flex flex-col p-4 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-3">
              <FormCheck className='flex items-center'>
                <FormCheck.Input
                  type="checkbox"
                  aria-label={`Seleziona ${kit.titolo}`}
                  checked={!!selectedKits[kit.guidId]}
                  onChange={(e) => e.stopPropagation()}
                  onClick={(e) => toggleKitSelection(e, kit.guidId)}
                />
              </FormCheck>
              {/* La checkbox resta fuori dal pulsante: selezionare un kit non lo espande */}
              <button
                type="button"
                aria-expanded={!!expandedKits[kit.guidId]}
                onClick={() => toggleKitExpansion(kit.guidId)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Lucide icon="Package" aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="block min-w-0 flex-1">
                  <span className="block font-medium text-slate-800">{kit.titolo}</span>
                  <span className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-slate-500 sm:grid-cols-3">
                    <span>Area: <span className="font-medium text-slate-600">{kit.nomeArea || kit.guidArea}</span></span>
                    <span>Canale: <span className="font-medium text-slate-600">{kit.nomeCanale || kit.guidCanale}</span></span>
                    <span>Copie: <span className="font-medium text-slate-600">{kit.quantitaCopie}</span></span>
                  </span>
                </span>
              </button>
            </div>
            <div className="mt-4 flex items-center gap-4 sm:ml-auto sm:mt-0">
              <StatusBadge dominio="kitRuntime" stato={kit.stato_lavorazione} />
              <button
                type="button"
                aria-label={expandedKits[kit.guidId] ? 'Comprimi kit' : 'Espandi kit'}
                aria-expanded={!!expandedKits[kit.guidId]}
                onClick={() => toggleKitExpansion(kit.guidId)}
                className="cursor-pointer rounded-control p-1.5 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40"
              >
                <Lucide icon={expandedKits[kit.guidId] ? 'ChevronUp' : 'ChevronDown'} aria-hidden="true" className="h-5 w-5 text-slate-500" />
              </button>
            </div>
          </div>
          <AnimatePresence>
            {expandedKits[kit.guidId] && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-slate-50"
              >
                <div className="border-t border-slate-200 p-4">
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <h4 className="title-card">Dettaglio files</h4>
                    <div className="text-xs text-slate-500">
                      {kit.files?.length || 0} file totali
                      {kit.files && numeroFileProblematici > 0 && numeroFileProblematici < 50 && (
                        <span className="ml-2 text-warning">{numeroFileProblematiciTesto}</span>
                      )}
                    </div>
                  </div>

                  {(!kit.files || kit.files.length === 0) ? (
                    <EmptyState
                      compatta
                      icon="FileX"
                      title="Nessun file disponibile per questo kit"
                      description=""
                      className="mt-3 border border-dashed border-slate-200"
                    />
                  ) : (
                    <div className="mt-4 flex flex-col justify-end gap-2 sm:flex-row">
                      <Button onClick={() => navigate(`/ods-in-corso/kit-dettagli?id=${kit.guidId}&idOrdine=${id}`)} variant="outline-secondary" size="sm">
                        <Lucide icon="ExternalLink" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                        Mostra tutti i file ({kit.files.length})
                      </Button>
                      <Button disabled={kit.files?.length === 0 || isDownloading} onClick={() => handleDownloadZip(kit.guidId)} variant="outline-secondary" size="sm">
                        <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                        Scarica ZIP
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    });
  };

  const descrizioneFase = (fase: string) =>
    fase === 'caricamento_dati' ? 'Caricamento dati'
      : fase === 'creazione_cartelle' ? 'Creazione cartelle'
        : fase === 'creazione_excel' ? 'Report Excel'
          : fase.replace(/_/g, ' ');

  const erroreTrasferimento = Boolean(ftpErrorMessage) && !isTransferring;

  return (
    <>
      <ConfirmDialog
        open={showDialogInvioFTP}
        title="Conferma invio alla tipografia"
        confirmLabel="Conferma invio"
        confirmVariant="primary"
        onClose={() => setShowDialogInvioFTP(false)}
        onConfirm={() => {
          setShowDialogInvioFTP(false);
          mutationInvioFileFTP.mutate(selezioneInvio);
        }}
        description={
          <div className="space-y-3">
            <p>
              Stai per inviare <strong>{selectedKitsCount}</strong> kit selezionati alla tipografia. Questa operazione è irreversibile e modificherà lo stato dell'ordine.
            </p>
            {numeroFileProblematici > 0 && (
              <Alert variant="soft-danger" icona="OctagonAlert">
                <div>
                  <strong>Attenzione:</strong> Sono stati rilevati {numeroFileProblematici} file duplicati che potrebbero causare problemi durante l'elaborazione.
                </div>
              </Alert>
            )}
          </div>
        }
      />
      <Pagina
        titolo="Revisione ordine di stampa"
        descrizione={`Promo: ${promo.nome}`}
        indietro={{ to: '/ods-in-corso', etichetta: 'Torna agli ordini' }}
        badges={<StatusBadge dominio="ordineStampa" stato={ordine.stato_ordinistampa} />}
      >
        {/* KPI dell'ordine */}
        <StatCardGrid className="lg:grid-cols-3">
          <StatCard densita="compatta" tono="neutral" icona="Package" etichetta="Kit totali" valore={dettagli?.length || 0} />
          <StatCard
            densita="compatta"
            tono="success"
            icona="SendHorizontal"
            etichetta="Kit già inviati"
            valore={kitInviati.length}
            sottotitolo={ordiniInvii && ordiniInvii.length > 0 ? `${ordiniInvii.length} report Excel disponibili per gli invii precedenti` : undefined}
          />
          <StatCard densita="compatta" tono="info" icona="PackageCheck" etichetta="Kit disponibili" valore={kitDisponibili.length} />
        </StatCardGrid>

        <Sezione titolo="Dettagli ordine" descrizione="Informazioni generali sull'ordine di stampa" icona="FileText">
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <Lucide icon="Hash" aria-hidden="true" className="h-4 w-4 text-slate-400" />
              <div>
                <dt className="text-xs text-slate-500">ID Ordine</dt>
                <dd className="font-medium text-slate-800">#{ordine.id_ordinistampa?.slice(0, 8)}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Lucide icon="Calendar" aria-hidden="true" className="h-4 w-4 text-slate-400" />
              <div>
                <dt className="text-xs text-slate-500">Data Conferma</dt>
                <dd className="font-medium text-slate-800">
                  {formatDataOra(ordine.data_di_conferma_ordinistampa)}
                </dd>
              </div>
            </div>
          </dl>
        </Sezione>

        {/* Sezione raggruppamento file uguali */}
        <Sezione
          titolo="Raggruppamento file uguali"
          descrizione="Identifica file PDF con contenuto identico tra i kit disponibili"
          icona="Copy"
          azioni={
            <>
              {groupingStatus !== 'idle' && groupingStatus !== 'running' && (
                <Button type="button" variant="outline-secondary" size="sm" onClick={resetGroupingState}>
                  <Lucide icon="RotateCcw" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => mutationGrouping.mutate()}
                disabled={groupingStatus === 'running' || mutationGrouping.isPending || kitDisponibili.length === 0}
                loading={groupingStatus === 'running' || mutationGrouping.isPending}
              >
                {groupingStatus !== 'running' && !mutationGrouping.isPending && (
                  <Lucide icon="ScanSearch" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                )}
                Avvia raggruppamento
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <StatCardGrid>
              <StatCard densita="compatta" tono="neutral" etichetta="Kit disponibili" valore={kitDisponibili.length} />
              <StatCard
                densita="compatta"
                tono="neutral"
                etichetta="File totali"
                valore={kitDisponibili.reduce((acc, kit) => acc + (kit.files?.length || 0), 0)}
              />
              <StatCard
                densita="compatta"
                tono="neutral"
                etichetta="Stato"
                valore={
                  <StatusBadge
                    tono={STATO_RAGGRUPPAMENTO[groupingStatus].tono}
                    etichetta={STATO_RAGGRUPPAMENTO[groupingStatus].etichetta}
                  />
                }
              />
              <StatCard densita="compatta" tono="neutral" etichetta="Gruppi trovati" valore={groupingResult?.groupCount} />
            </StatCardGrid>

            {/* Progress bar */}
            {groupingStatus === 'running' && (
              <div className="space-y-2">
                <Progress className="h-2.5" progress={groupingProgress} classNameProgress="bg-primary" />
                {groupingMessage && (
                  <div
                    className="truncate text-center text-xs text-slate-600"
                    dangerouslySetInnerHTML={{ __html: groupingMessage }}
                  />
                )}
              </div>
            )}

            {/* Error message */}
            {groupingError && (
              <Alert variant="soft-danger" icona="CircleAlert">
                {groupingError}
              </Alert>
            )}

            {/* Results */}
            {groupingStatus === 'completed' && groupingResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-success">
                  <Lucide icon="CircleCheck" aria-hidden="true" className="h-4 w-4" />
                  <span>Analisi completata: {groupingResult.groupCount} gruppi trovati su {groupingResult.analyzedFiles} file analizzati</span>
                </div>

                {groupingResult?.groups?.length > 0 ? (
                  <div className="space-y-3">
                    {groupingResult.groups.map((group) => (
                      <div key={group.groupId} className="overflow-hidden rounded-card border border-slate-200 bg-white">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Lucide icon="Copy" aria-hidden="true" className="h-4 w-4 text-primary" />
                            <h3 className="title-card">
                              Gruppo {group.groupId}
                            </h3>
                          </div>
                          <span className="text-xs text-slate-500">{group.size} file identici</span>
                        </div>
                        <div className="max-h-96 overflow-y-auto bg-slate-50 p-3">
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                            {group.files.map((file, i) => {
                              const thumbSrc = file.id_olimpo_cloud ? buildGroupingThumbnailUrl(file.id_olimpo_cloud) : docThumbnailFallback;
                              return (
                                <div
                                  key={`${file.id_olimpo_cloud}-${i}`}
                                  className="overflow-hidden rounded-control border border-slate-200 bg-white text-xs shadow-sm"
                                >
                                  <button
                                    type="button"
                                    aria-label={`Anteprima ${file.nome}`}
                                    className="group/thumb relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden border-b border-slate-200 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-1/40"
                                    onClick={() => {
                                      const baseUrl = file.id_olimpo_cloud ? buildGroupingPreviewBaseUrl(file.id_olimpo_cloud) : '';
                                      if (baseUrl) {
                                        setPreviewFile({ imageUrl: baseUrl, pages: file.pages || 1 });
                                      }
                                    }}
                                  >
                                    <img
                                      src={thumbSrc}
                                      alt={`Anteprima ${file.nome}`}
                                      className="h-full w-full object-contain p-1 transition-transform duration-200 group-hover/thumb:scale-110"
                                      loading="lazy"
                                      onError={(event) => {
                                        const target = event.currentTarget;
                                        if (target.src !== docThumbnailFallback) {
                                          target.src = docThumbnailFallback;
                                        }
                                      }}
                                    />
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/thumb:bg-black/10">
                                      <Lucide icon="ZoomIn" aria-hidden="true" className="h-5 w-5 text-white opacity-0 drop-shadow-md transition-opacity group-hover/thumb:opacity-100" />
                                    </span>
                                  </button>
                                  <div className="p-1.5">
                                    <div className="truncate font-medium text-slate-700" title={file.nome}>{file.nome}</div>
                                    <div className="truncate text-3xs text-slate-500">
                                      {file.nome_kit || file.id_runtime}
                                      {file.pages ? ` • ${file.pages}p` : ''}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Merge controls */}
                        {(() => {
                          const mergeState = groupMergeState[group.groupId];
                          const isMerged = mergeState?.merged;
                          const isMerging = mergeState?.merging;
                          const currentName = (mergeState?.nome || '').trim();
                          const groupFileNames = new Set(group.files.map(f => f.nome));
                          const nameCollision = currentName.length > 0 && groupFileNames.has(currentName);
                          return (
                            <div className="border-t border-slate-200 bg-white px-4 py-3">
                              {isMerged ? (
                                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                                  <div className="flex min-w-0 items-center gap-2 text-sm text-success">
                                    <Lucide icon="CircleCheck" aria-hidden="true" className="h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">
                                      Gruppo unificato: <strong>{mergeState?.nome}</strong>
                                      {mergeState?.virtualDir && (
                                        <span className="ml-1.5 font-normal text-slate-500">
                                          in {mergeState.virtualDir}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline-danger"
                                    size="sm"
                                    className="flex-shrink-0 whitespace-nowrap"
                                    disabled={isMerging}
                                    loading={isMerging}
                                    onClick={() => handleDeleteMerge(group.groupId)}
                                  >
                                    {!isMerging && <Lucide icon="Undo2" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
                                    Annulla unione
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex flex-col items-end gap-3 sm:flex-row">
                                  <FormField
                                    etichetta="Nome file unificato"
                                    errore={nameCollision ? 'Il nome coincide con uno dei file del gruppo' : undefined}
                                    className="w-full min-w-0 flex-1"
                                  >
                                    <FormInput
                                      type="text"
                                      placeholder="Nome file..."
                                      value={mergeState?.nome || ''}
                                      onChange={(e) => updateGroupMerge(group.groupId, { nome: e.target.value })}
                                      disabled={isMerging}
                                      className={nameCollision ? 'border-danger focus:border-danger focus:ring-danger/20' : undefined}
                                    />
                                  </FormField>
                                  <div className="w-full min-w-0 flex-1">
                                    <span className="mb-2 inline-block">Directory di destinazione</span>
                                    <DirectoryPicker
                                      directories={virtualDirs}
                                      value={mergeState?.virtualDir || ''}
                                      onChange={(path) => updateGroupMerge(group.groupId, { virtualDir: path })}
                                      disabled={isMerging}
                                      loading={virtualDirsLoading}
                                      placeholder="Seleziona directory..."
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    className="whitespace-nowrap"
                                    disabled={isMerging || nameCollision}
                                    loading={isMerging}
                                    onClick={() => handleMergeGroup(group)}
                                  >
                                    {!isMerging && <Lucide icon="Merge" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
                                    Unisci gruppo
                                  </Button>
                                </div>
                              )}
                              {mergeState?.error && (
                                <div className="mt-2 flex items-center gap-1.5 text-xs text-danger">
                                  <Lucide icon="CircleAlert" aria-hidden="true" className="h-3.5 w-3.5 flex-shrink-0" />
                                  {mergeState.error}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    compatta
                    icon="CircleCheck"
                    title="Nessun file duplicato trovato"
                    description="Tutti i file sono unici."
                  />
                )}
              </div>
            )}

            {kitDisponibili.length === 0 && groupingStatus === 'idle' && (
              <EmptyState
                compatta
                icon="PackageX"
                title="Nessun kit disponibile per il raggruppamento"
                description=""
              />
            )}
          </div>
        </Sezione>

        {/* Sezione progress trasferimento FTP inline */}
        <AnimatePresence>
          {(isTransferring || progress > 0 || globalProgress > 0 || transferComplete || ftpErrorMessage) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <Sezione
                icona={isTransferring ? 'Upload' : transferComplete ? 'CircleCheck' : 'CircleAlert'}
                titolo={transferComplete ? 'Trasferimento completato' : erroreTrasferimento ? 'Errore di trasferimento' : 'Trasferimento in corso'}
                descrizione={
                  transferComplete
                    ? `${ftpTransferDetail.totalFiles > 0 ? `${ftpTransferDetail.totalFiles} file` : 'File'} inviati con successo${ftpTransferDetail.totalKits > 0 ? ` da ${ftpTransferDetail.totalKits} kit` : ''}`
                    : erroreTrasferimento
                      ? 'Si è verificato un problema durante il trasferimento'
                      : ftpTransferDetail.kit
                        ? `Kit in elaborazione: ${ftpTransferDetail.kit}`
                        : 'Invio dei file selezionati alla tipografia'
                }
                azioni={
                  (transferComplete || erroreTrasferimento) && (
                    <Button
                      type="button"
                      variant="outline-secondary"
                      size="sm"
                      aria-label="Chiudi riepilogo trasferimento"
                      title="Chiudi riepilogo trasferimento"
                      onClick={() => {
                        setTransferComplete(false);
                        setFtpProgressMessage('');
                        setFtpErrorMessage('');
                        setProgress(0);
                        setGlobalProgress(0);
                        ftpProgressTrackerRef.current = { activeKitIndex: 1, totalKits: 0 };
                        setFtpTransferDetail({ fase: '', kit: '', fileName: '', currentFile: 0, totalFiles: 0, totalKits: 0, message: '' });
                      }}
                    >
                      <Lucide icon="X" aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  )
                }
              >
                <div className="flex flex-col gap-4">
                  {/* Dettagli fase e contatori - visibili durante il trasferimento */}
                  {isTransferring && (ftpTransferDetail.fase || ftpTransferDetail.totalFiles > 0) && (
                    <StatCardGrid>
                      {ftpTransferDetail.fase && (
                        <StatCard densita="compatta" tono="neutral" etichetta="Fase" valore={descrizioneFase(ftpTransferDetail.fase)} />
                      )}
                      {ftpTransferDetail.kit && (
                        <StatCard
                          densita="compatta"
                          tono="neutral"
                          etichetta="Kit"
                          valore={<span title={ftpTransferDetail.kit}>{ftpTransferDetail.kit}</span>}
                        />
                      )}
                      {ftpTransferDetail.totalFiles > 0 && (
                        <StatCard
                          densita="compatta"
                          tono="neutral"
                          etichetta="File"
                          valore={ftpTransferDetail.currentFile > 0 ? `${ftpTransferDetail.currentFile} / ${ftpTransferDetail.totalFiles}` : `${ftpTransferDetail.totalFiles} totali`}
                        />
                      )}
                      {ftpTransferDetail.totalKits > 0 && (
                        <StatCard densita="compatta" tono="neutral" etichetta="Kit totali" valore={ftpTransferDetail.totalKits} />
                      )}
                    </StatCardGrid>
                  )}

                  {/* Progress bar - visibile durante il trasferimento */}
                  {(isTransferring || ((progress > 0 || globalProgress > 0) && !transferComplete && !ftpErrorMessage)) && (
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-2xs text-slate-500">
                          <span>Avanzamento globale</span>
                          <span className="tabular-nums">{Math.round(globalProgress * 100)}%</span>
                        </div>
                        <Progress
                          className="h-2.5"
                          progress={globalProgress * 100}
                          classNameProgress="bg-primary"
                        />
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-2xs text-slate-500">
                          <span>Avanzamento kit corrente</span>
                          <span className="tabular-nums">{Math.round(progress * 100)}%</span>
                        </div>
                        <Progress
                          className="h-3"
                          progress={progress * 100}
                          classNameProgress="bg-success"
                        />
                      </div>
                      {ftpTransferDetail.fileName && (
                        <div className="truncate pt-1 text-center text-xs text-slate-600" title={ftpTransferDetail.fileName}>
                          {ftpTransferDetail.fileName}
                        </div>
                      )}
                      {!ftpTransferDetail.fileName && ftpTransferDetail.message && (
                        <div className="truncate pt-1 text-center text-xs text-slate-600">
                          {ftpTransferDetail.message}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Messaggio di successo */}
                  {transferComplete && (
                    <Alert variant="soft-success" icona="CircleCheck">
                      <div className="text-sm">
                        <span>{ftpProgressMessage || 'Processo completato con successo'}</span>
                        {(ftpTransferDetail.totalFiles > 0 || ftpTransferDetail.totalKits > 0) && (
                          <span className="ml-1.5 opacity-70">
                            ({ftpTransferDetail.totalFiles > 0 && `${ftpTransferDetail.totalFiles} file`}
                            {ftpTransferDetail.totalFiles > 0 && ftpTransferDetail.totalKits > 0 && ', '}
                            {ftpTransferDetail.totalKits > 0 && `${ftpTransferDetail.totalKits} kit`})
                          </span>
                        )}
                      </div>
                    </Alert>
                  )}

                  {/* Messaggio di errore */}
                  {ftpErrorMessage && (
                    <Alert variant="soft-danger" icona="CircleAlert" titolo="Si è verificato un errore">
                      <p className="break-words text-sm">{ftpErrorMessage}</p>
                    </Alert>
                  )}
                </div>
              </Sezione>
            </motion.div>
          )}
        </AnimatePresence>

        <Sezione
          senzaPadding
          icona="Package"
          titolo="Kit dell'ordine"
          descrizione={`${kitInviati.length} inviati, ${kitDisponibili.length} disponibili`}
        >
          <BarraFiltri>
            <CampoRicerca
              etichetta="Cerca per titolo, area, canale"
              placeholder="Cerca per titolo, area, canale…"
              value={searchTerm}
              onChange={setSearchTerm}
            />
          </BarraFiltri>

          <div className="p-5">
            {(!filteredKitDisponibili || filteredKitDisponibili.length === 0) &&
              (!gruppInvii || gruppInvii.length === 0) ? (
              searchTerm ? (
                <EmptyState
                  compatta
                  icon="SearchX"
                  title="Nessuna lavorazione trovata"
                  description="Prova a modificare i criteri di ricerca."
                />
              ) : (
                <EmptyState
                  compatta
                  icon="PackageX"
                  title="Nessun kit da revisionare"
                  description="Non ci sono kit disponibili per questo ordine di stampa."
                />
              )
            ) : (
              <div className="space-y-6">
                {/* Sezione kit già inviati */}
                {gruppInvii && gruppInvii.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-success/10 text-success">
                        <Lucide icon="CheckCheck" aria-hidden="true" className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="title-card">Kit già inviati alla tipografia</h3>
                        <p className="text-xs text-slate-500">
                          {gruppInvii.length} invio{gruppInvii.length !== 1 ? 'i' : ''} completat{gruppInvii.length !== 1 ? 'i' : 'o'}
                          {searchTerm && (
                            <span className="ml-1">
                              • {gruppInvii.reduce((acc, gruppo) => acc + gruppo.kit.length, 0)} kit visualizzati
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {renderGruppiInvii(gruppInvii)}
                    </div>
                  </div>
                )}

                {/* Sezione kit disponibili per l'invio */}
                {filteredKitDisponibili && filteredKitDisponibili.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Lucide icon="Package" aria-hidden="true" className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="title-card">Kit disponibili per l'invio</h3>
                        <p className="text-xs text-slate-500">{filteredKitDisponibili.length} kit pronti</p>
                      </div>
                    </div>
                    <div className="flex items-center rounded-control border border-slate-200 bg-slate-50 p-3 text-sm">
                      <FormCheck className='flex items-center'>
                        <FormCheck.Input
                          id="selectAll"
                          type="checkbox"
                          checked={selectAll}
                          onChange={handleSelectAll}
                        />
                        <FormCheck.Label htmlFor="selectAll" className="ml-2 select-none font-medium">
                          Seleziona tutti ({filteredKitDisponibili.length})
                        </FormCheck.Label>
                      </FormCheck>
                      {selectedKitsCount > 0 && (
                        <div className="ml-auto font-medium text-slate-600">{selectedKitsCount} kit selezionati</div>
                      )}
                    </div>
                    <div className="space-y-3">
                      {renderDettagli(filteredKitDisponibili)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {filteredKitDisponibili && filteredKitDisponibili.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500">
                {numeroFileProblematici > 0 && (
                  <div className="flex items-center gap-2 text-warning">
                    <Lucide icon="TriangleAlert" aria-hidden="true" className="h-4 w-4 flex-none" />
                    <span>
                      {numeroFileProblematiciTesto}
                    </span>
                  </div>
                )}
              </div>
              <Button
                type="button"
                onClick={() => setShowDialogInvioFTP(true)}
                disabled={selectedKitsCount === 0 || isTransferring}
                loading={isTransferring}
                variant="primary"
                className="min-w-48"
              >
                Manda file alla tipografia
                {!isTransferring && <Lucide icon="Send" aria-hidden="true" className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          )}
        </Sezione>
      </Pagina>

      {/* Preview PDF */}
      {previewFile && (
        <PreviewImmaginePdf
          imageUrl={previewFile.imageUrl}
          totalPages={previewFile.pages}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </>
  );
};

export default RevisioneOrdiniDiStampa;
