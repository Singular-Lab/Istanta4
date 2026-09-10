import Button from '@/components/Base/Button';
import { FormCheck, FormInput } from '@/components/Base/Form';
import { Dialog } from '@/components/Base/Headless';
import LoadingIcon from '@/components/Base/LoadingIcon';
import Lucide from '@/components/Base/Lucide';
import EmptyState from '@/components/EmptyState';
import { LoadingState } from '@/components/MultiStepLoader';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLoaderData, useNavigate, useRevalidator } from 'react-router-dom';
import { STATO_LAVORAZIONE_KIT_RUNTIME, STATO_ORDINI_STAMPA } from '../../../lib/enums';
import { ServerCall } from '../../../lib/server_call';
import { FileItemKit, MergedGroupFile, OrdiniDiStampaAttributes, OrdiniDiStampaInviiAttributes, RUNTIME_KIT_MONGO, VirtualDirectory } from '../../../lib/types';
// Importa il client Socket.IO
import docThumbnailFallback from '@/assets/images/icons/icon_doc_locandinaA4.png';
import PageHeader from '@/components/Base/PageHeader';
import Progress from '@/components/Base/Progress';
import dayjs from 'dayjs';
import type { Socket } from 'socket.io-client';
import io from 'socket.io-client';
import type { PromoResponseDTO } from '../../../server/core/dto';
import DirectoryPicker from '../../components/DirectoryPicker';
import { PreviewImmaginePdf } from '../../components/PreviewImmaginePdf';

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

const buildGroupingThumbnailUrl = (id: string): string => {
  const olympusBaseRaw =
    toText(import.meta.env.VITE_OLYMPUS_IP_ADDRESS)
    || toText(import.meta.env.VITE_OLYMPUS_IP_ADDRESS_CORS);

  if (!olympusBaseRaw) {
    return docThumbnailFallback;
  }

  const olympusBase = olympusBaseRaw.replace(/\/+$/, '');
  return `${olympusBase}/materiali/getThumbnailMaterialePdfs?&id=${encodeURIComponent(id)}&page=1`;
};

const buildGroupingPreviewBaseUrl = (id: string): string => {
  const olympusBaseRaw =
    toText(import.meta.env.VITE_OLYMPUS_IP_ADDRESS)
    || toText(import.meta.env.VITE_OLYMPUS_IP_ADDRESS_CORS);

  if (!olympusBaseRaw) return '';

  const olympusBase = olympusBaseRaw.replace(/\/+$/, '');
  return `${olympusBase}/materiali/getThumbnailMaterialePdfs?&id=${encodeURIComponent(id)}`;
};

const buildGroupingFilesLookup = (
  kits: RUNTIME_KIT_MONGO[],
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
  kits: RUNTIME_KIT_MONGO[],
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
    dettagli: RUNTIME_KIT_MONGO[];
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
  const [oggettiMultiStep] = useState<LoadingState[]>([
    { text: 'In attesa per il download' },
    { text: 'Download in corso' },
    { text: 'Download completato' },
  ]);

  const [currentStep, setCurrentStep] = useState<number>(0);
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

  const [socketExpress, setSocketExpress] = useState<typeof Socket>();
  const [socketNest, setSocketNest] = useState<typeof Socket>();

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
    const nestSocket = io(import.meta.env.VITE_OLYMPUS_IP_ADDRESS_CORS, { transports: ['websocket', 'polling'] });
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

  const getAllKitsSelection = () => {
    const allKitsSelection: Record<string, boolean> = {};
    filteredKitDisponibili?.forEach(kit => {
      allKitsSelection[kit.guidId] = !!selectedKits[kit.guidId];
    });
    return allKitsSelection;
  };

  const selectedKitsCount = Object.values(selectedKits).filter(Boolean).length;

  const handleDownloadSelectedZips = async () => {
    const selectedKitIds = Object.entries(selectedKits)
      .filter(([_, isSelected]) => isSelected)
      .map(([kitId]) => kitId);
    if (selectedKitIds.length === 0) return;
    setIsDownloading(true);
    try {
      if (selectedKitIds.length === 1) {
        await handleDownloadZip(selectedKitIds[0]);
        return;
      }
      alert("Funzionalità di download multiplo in sviluppo");
      setIsDownloading(false);
    } catch (error) {
      console.error('Errore durante il download dei file ZIP:', error);
      setIsDownloading(false);
    }
  };

  const handleDownloadZip = async (idKit: string) => {
    try {
      const url = ServerCall.getUrl();
      setCurrentStep(1);
      const response = await axios.get(`${url}/getFileZipDownload?id=${idKit}`, {
        responseType: 'arraybuffer',
        withCredentials: true,
      });
      if (response.status !== 200) {
        console.error('Errore durante il download del file ZIP');
        return;
      }
      const blob = new Blob([response.data]);
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'files.zip';
      document.body.appendChild(link);
      setCurrentStep(2);
      link.click();
      setIsDownloading(false);
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 1000);
    } catch (error) {
      console.error('Errore durante il download del file ZIP:', error);
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
      setFtpErrorMessage("Errore durante l'invio dei file alla tipografia.");
      setIsTransferring(false);
    },
    onSuccess: (data: any) => {
      const { socketId } = data;

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
        setFtpErrorMessage(toText(err.error) || 'Errore durante il trasferimento');
        const kit = toText(err.kit);
        if (kit) setFtpTransferDetail(prev => ({ ...prev, kit }));
        setIsTransferring(false);
      });
      socketExpress?.on(`${socketId}_complete`, (raw: unknown) => {
        const decoded = decodeSocketPayload(raw);
        const msg = isObjectRecord(decoded) ? decoded : {};
        const message = toText(msg.message);
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
        setTransferComplete(true);
        setIsTransferring(false);
        setTimeout(() => {
          socketExpress.disconnect();
          r.revalidate();
        }, 500);
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
      socketNest?.on(`${socketId}_error`, (raw: unknown) => {
        const decoded = decodeSocketPayload(raw);
        const err = isObjectRecord(decoded) ? decoded : {};
        setFtpErrorMessage(toText(err.error) || 'Errore durante il trasferimento');
        setIsTransferring(false);
      });
      socketNest?.on(`${socketId}_complete`, (raw: unknown) => {
        const decoded = decodeSocketPayload(raw);
        const msg = isObjectRecord(decoded) ? decoded : {};
        const message = toText(msg.message);
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
        setTransferComplete(true);
        setIsTransferring(false);
        socketNest.disconnect();
        setTimeout(() => {
          r.revalidate();
        }, 2000);
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
  const renderGruppiInvii = (gruppi: { invio: OrdiniDiStampaInviiAttributes; kit: RUNTIME_KIT_MONGO[]; kitTotali: number; }[]) => {
    return gruppi.map((gruppo, index) => (
      <div key={gruppo.invio.id_ordinistampainvii || index} className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        {/* Header del gruppo */}
        <div className="p-4 border-b bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between">
            <div className="flex items-center gap-x-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full text-success bg-success/20">
                <Lucide icon="SendHorizontal" className="w-4 h-4 stroke-[2]" />
              </div>
              <div>
                <div className="font-medium text-success">
                  Ordine di invio #{gruppo.invio.id_ordinistampainvii?.slice(0, 8)}
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 border border-green-200">
                    Inviato
                  </span>
                </div>
                <div className="text-xs text-slate-700 mt-1">
                  <Lucide icon="Calendar" className="w-3 h-3 inline-block mr-1" />
                  Inviato il {dayjs(gruppo.invio?.createdat).format("DD/MM/YYYY")} alle {dayjs(gruppo.invio?.createdat).format("HH:mm:ss")}
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
              variant="dark"
              className="text-sm mt-2 sm:mt-0"
            >
              <Lucide icon="FileSpreadsheet" className="w-4 h-4 mr-1 stroke-[1.5]" />
              Scarica report di invio
            </Button>
          </div>
        </div>

        {/* Lista dei kit del gruppo */}
        <div className="divide-y divide-gray-100">
          {gruppo.kit.map((kit) => (
            <div key={kit.guidId} className="p-4 bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-x-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700">
                  <Lucide icon="Check" className="w-4 h-4 stroke-[2]" />
                </div>
                <div className="flex-1">
                  <div className="text-base font-medium text-slate-700">{kit.titolo}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                    <div>Area: {kit.nomeArea || kit.guidArea}</div>
                    <div>Canale: {kit.nomeCanale || kit.guidCanale}</div>
                    <div>Copie: {kit.quantitaCopie}</div>
                  </div>
                </div>
                <div className="flex items-center gap-x-2">
                  {kit.files && kit.files.length > 0 && (
                    <Button
                      onClick={() => navigate(`/ods-in-corso/kit-dettagli?id=${kit.guidId}&idOrdine=${id}`)}
                      variant="outline-secondary"
                      size="sm"
                      className="text-xs"
                    >
                      <Lucide icon="ExternalLink" className="w-3 h-3 mr-1" />
                      {kit.files.length} file
                    </Button>
                  )}
                  <div className="text-xs text-slate-500 whitespace-nowrap">
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
      <div className="grid grid-cols-12 gap-y-10 gap-x-6">
        <div className="col-span-12">
          <div className="flex flex-col md:h-10 gap-y-3 md:items-center md:flex-row">
            <PageHeader
              title="Dettaglio ordine completato"
              description={`Promo: ${promo.nome}`}
            />
            <div className="flex gap-2 md:ml-auto">
              <Button onClick={() => navigate(-1)} variant="outline-secondary">
                <Lucide icon="ArrowLeft" className="w-4 h-4 mr-2" />
                Torna indietro
              </Button>
            </div>
          </div>

          <div className="mt-5">
            {/* Info Card */}
            <div className="box box--stacked p-5 mb-5">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-success/10">
                  <Lucide icon="CircleCheck" className="w-5 h-5 text-success" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Ordine completato</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Questo ordine è stato completato e inviato alla tipografia. Di seguito puoi visualizzare i report degli invii effettuati.
                  </p>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="box box--stacked p-5 mb-5">
              <FormInput
                type="text"
                placeholder="Cerca nei kit inviati..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Report Invii */}
            {gruppInvii && gruppInvii.length > 0 ? (
              <div className="box box--stacked">
                <div className="flex items-center gap-3 p-5 border-b border-slate-200/60">
                  <Lucide icon="Package" className="w-5 h-5 text-slate-600" />
                  <h2 className="text-base font-semibold text-slate-800">
                    Invii effettuati ({gruppInvii.length})
                  </h2>
                </div>
                <div className="p-5 space-y-4">
                  {renderGruppiInvii(gruppInvii)}
                </div>
              </div>
            ) : (
              <div className="box box--stacked">
                <EmptyState
                  title="Nessun invio trovato"
                  description={searchTerm ? `Nessun kit trovato per "${searchTerm}"` : "Non sono stati trovati invii per questo ordine."}
                  icon="Search"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }


  const renderDettagli = (dettagli: RUNTIME_KIT_MONGO[]) => {
    return dettagli.map((kit) => {
      // Ora questa funzione gestisce solo i kit disponibili (non ancora inviati)
      return (
        <div key={kit.guidId} className="group border border-slate-200/80 rounded-lg overflow-hidden shadow-sm bg-white transition-all duration-200 hover:shadow-lg hover:border-slate-300">
          <div className="flex flex-col sm:flex-row sm:items-center p-4">
            <div className="flex items-center gap-x-3 flex-1">
              <FormCheck className='flex items-center'>
                <FormCheck.Input
                  type="checkbox"
                  className='!rounded-md'
                  checked={!!selectedKits[kit.guidId]}
                  onChange={(e) => e.stopPropagation()}
                  onClick={(e) => toggleKitSelection(e, kit.guidId)}
                />
              </FormCheck>
              <div className="flex items-center gap-x-4 cursor-pointer flex-1" onClick={() => toggleKitExpansion(kit.guidId)}>
                <div className="flex items-center justify-center w-11 h-11 rounded-full bg-primary/10 text-primary">
                  <Lucide icon="Package" className="w-6 h-6 stroke-[1.5]" />
                </div>
                <div className="flex-1">
                  <div className="text-base font-semibold text-slate-800">{kit.titolo}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                    <span>Area: <span className="font-medium text-slate-600">{kit.nomeArea || kit.guidArea}</span></span>
                    <span>Canale: <span className="font-medium text-slate-600">{kit.nomeCanale || kit.guidCanale}</span></span>
                    <span>Copie: <span className="font-medium text-slate-600">{kit.quantitaCopie}</span></span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-x-4 mt-4 sm:mt-0 sm:ml-auto">
              <div
                className={`px-3 py-1 text-xs rounded-full border font-medium ${kit.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE
                  ? 'bg-red-100/80 text-red-800 border-red-200/80'
                  : kit.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE
                    ? 'bg-yellow-100/80 text-yellow-800 border-yellow-200/80'
                    : kit.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO
                      ? 'bg-green-100/80 text-green-800 border-green-200/80'
                      : 'bg-gray-100/80 text-gray-800 border-gray-200/80'
                  }`}
              >
                {kit.stato_lavorazione?.replace(/_/g, ' ')}
              </div>
              <div className="cursor-pointer p-1.5 rounded-md hover:bg-slate-100" onClick={() => toggleKitExpansion(kit.guidId)}>
                <Lucide icon={expandedKits[kit.guidId] ? 'ChevronUp' : 'ChevronDown'} className="w-5 h-5 stroke-[1.5] text-slate-500" />
              </div>
            </div>
          </div>
          <AnimatePresence>
            {expandedKits[kit.guidId] && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-slate-50/70"
              >
                <div className="p-4 border-t border-slate-200/80">
                  <div className='flex justify-between items-center'>
                    <h3 className="text-sm font-medium text-slate-700 mb-1">Dettaglio files</h3>
                    <div className="text-xs text-slate-500">
                      {kit.files?.length || 0} file totali
                      {kit.files && numeroFileProblematici > 0 && numeroFileProblematici < 50 && (
                        <span className="text-amber-600 ml-2">{numeroFileProblematiciTesto}</span>
                      )}
                    </div>
                  </div>

                  {(!kit.files || kit.files.length === 0) ? (
                    <div className="p-4 mt-2 bg-slate-100 rounded text-sm text-slate-500 text-center border border-slate-200/80">
                      Nessun file disponibile per questo kit.
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-end">
                      <Button onClick={() => navigate(`/ods-in-corso/kit-dettagli?id=${kit.guidId}&idOrdine=${id}`)} variant="outline-secondary" className="text-sm bg-white">
                        <Lucide icon="ExternalLink" className="w-4 h-4 mr-2 stroke-[1.5]" />
                        Mostra tutti i file ({kit.files.length})
                      </Button>
                      <Button disabled={kit.files?.length === 0} onClick={() => { handleDownloadZip(kit.guidId); setIsDownloading(true); }} variant="outline-primary" className="text-sm">
                        <Lucide icon="Download" className="w-4 h-4 mr-2 stroke-[1.5]" />
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

  return (
    <>
      <Dialog centered size='md' open={showDialogInvioFTP} onClose={() => setShowDialogInvioFTP(false)}>
        <Dialog.Panel className="p-2">
          <Dialog.Title>
            <h2 className="text-lg font-semibold">Conferma invio alla tipografia</h2>
          </Dialog.Title>
          <Dialog.Description className="p-4">
            <div className="text-sm text-slate-600 space-y-3">
              <div className="flex items-start p-3.5 rounded-lg bg-amber-50/80 border border-amber-200/60">
                <Lucide icon="TriangleAlert" className="w-5 h-5 mr-3 text-amber-500 flex-shrink-0 mt-0.5" />
                <span>Stai per inviare <strong>{selectedKitsCount}</strong> kit selezionati alla tipografia. Questa operazione è irreversibile e modificherà lo stato dell'ordine.</span>
              </div>
              {numeroFileProblematici > 0 && (
                <div className="bg-red-50 p-3.5 rounded-lg border border-red-200/60 text-red-700/90 text-xs">
                  <div className='flex items-start'>
                    <Lucide icon="OctagonAlert" className="w-4 h-4 mr-2.5 inline-block" />
                    <div className='flex-1'>
                      <strong>Attenzione:</strong> Sono stati rilevati {numeroFileProblematici} file duplicati che potrebbero causare problemi durante l'elaborazione.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Dialog.Description>
          <Dialog.Footer className="flex justify-end gap-x-2 p-4 bg-slate-50/50 border-t border-slate-200/60">
            <Button
              onClick={() => setShowDialogInvioFTP(false)}
              variant="outline-secondary"
            >
              Annulla
            </Button>
            <Button
              onClick={() => {
                setShowDialogInvioFTP(false);
                mutationInvioFileFTP.mutate(getAllKitsSelection());
              }}
              variant="primary"
            >
              <Lucide icon="Send" className="w-4 h-4 mr-2" />
              Conferma invio
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <div className="flex flex-col md:h-10 gap-y-3 md:items-center md:flex-row mb-6">
        <PageHeader title="Revisione ordine di stampa" description={`Promo: ${promo.nome}`} />
        <div className="flex gap-2 md:ml-auto">
          <Button
            variant="secondary"
            onClick={() => navigate('/ods-in-corso')}
          >
            <Lucide icon="ArrowLeft" className="w-4 h-4 mr-2" />
            Torna agli ordini
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-y-6 gap-x-6">

        <div className="col-span-12">

          {/* Info Card */}
          <div className="box box--stacked p-6 mb-6">
            <div className="flex items-center gap-x-3 mb-5">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100">
                <Lucide icon="FileText" className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Dettagli ordine</h3>
                <p className="text-sm text-slate-500">Informazioni generali sull'ordine di stampa</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-x-2">
                <Lucide icon="Hash" className="w-4 h-4 text-slate-400" />
                <div>
                  <div className="text-xs text-slate-500">ID Ordine</div>
                  <div className="font-medium">#{ordine.id_ordinistampa?.slice(0, 8)}</div>
                </div>
              </div>
              <div className="flex items-center gap-x-2">
                <Lucide icon="Calendar" className="w-4 h-4 text-slate-400" />
                <div>
                  <div className="text-xs text-slate-500">Data Conferma</div>
                  <div className="font-medium">
                    {ordine.data_di_conferma_ordinistampa
                      ? dayjs(ordine.data_di_conferma_ordinistampa).format('DD/MM/YYYY HH:mm')
                      : 'Non disponibile'
                    }
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-x-2">
                <Lucide icon="Package" className="w-4 h-4 text-slate-400" />
                <div>
                  <div className="text-xs text-slate-500">Totale Kit</div>
                  <div className="font-medium">{dettagli?.length || 0} kit</div>
                </div>
              </div>
            </div>

            {/* Statistiche invii */}
            <div className="mt-5 pt-5 border-t border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-x-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-success/10">
                    <Lucide icon="SendHorizontal" className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Kit già inviati</div>
                    <div className="font-medium text-success">{kitInviati.length} kit</div>
                  </div>
                </div>
                <div className="flex items-center gap-x-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100">
                    <Lucide icon="PackageCheck" className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Kit disponibili</div>
                    <div className="font-medium text-blue-600">{kitDisponibili.length} kit</div>
                  </div>
                </div>
              </div>
              {ordiniInvii && ordiniInvii.length > 0 && (
                <div className="mt-3 text-xs text-slate-500 flex items-center gap-x-1">
                  <Lucide icon="FileSpreadsheet" className="w-3 h-3" />
                  <span>{ordiniInvii.length} report Excel disponibili per gli invii precedenti</span>
                </div>
              )}
            </div>
          </div>

          {/* Sezione raggruppamento file uguali */}
          <div className="box box--stacked p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-x-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-100">
                  <Lucide icon="Copy" className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Raggruppamento file uguali</h3>
                  <p className="text-sm text-slate-500">Identifica file PDF con contenuto identico tra i kit disponibili</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {groupingStatus !== 'idle' && groupingStatus !== 'running' && (
                  <Button variant="outline-secondary" size="sm" onClick={resetGroupingState}>
                    <Lucide icon="RotateCcw" className="w-4 h-4 mr-1" />
                    Reset
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={() => mutationGrouping.mutate()}
                  disabled={groupingStatus === 'running' || mutationGrouping.isPending || kitDisponibili.length === 0}
                >
                  {groupingStatus === 'running' || mutationGrouping.isPending ? (
                    <>
                      <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                      Analisi in corso...
                    </>
                  ) : (
                    <>
                      <Lucide icon="ScanSearch" className="w-4 h-4 mr-2" />
                      Avvia raggruppamento
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="text-xs text-slate-500">Kit disponibili</div>
                <div className="text-lg font-semibold text-slate-800">{kitDisponibili.length}</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="text-xs text-slate-500">File totali</div>
                <div className="text-lg font-semibold text-slate-800">
                  {kitDisponibili.reduce((acc, kit) => acc + (kit.files?.length || 0), 0)}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="text-xs text-slate-500">Stato</div>
                <div className={`text-sm font-medium ${groupingStatus === 'idle' ? 'text-slate-600' :
                  groupingStatus === 'running' ? 'text-primary' :
                    groupingStatus === 'completed' ? 'text-success' :
                      'text-danger'
                  }`}>
                  {groupingStatus === 'idle' ? 'In attesa' :
                    groupingStatus === 'running' ? 'In corso' :
                      groupingStatus === 'completed' ? 'Completato' :
                        'Errore'}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="text-xs text-slate-500">Gruppi trovati</div>
                <div className="text-lg font-semibold text-slate-800">
                  {groupingResult?.groupCount ?? '-'}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            {groupingStatus === 'running' && (
              <div className="space-y-2 mb-4">
                <Progress className="h-2.5" progress={groupingProgress} classNameProgress="bg-primary" />
                {groupingMessage && (
                  <div
                    className="text-xs text-slate-600 text-center truncate"
                    dangerouslySetInnerHTML={{ __html: groupingMessage }}
                  />
                )}
              </div>
            )}

            {/* Error message */}
            {groupingError && (
              <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 mb-4">
                <div className="flex items-start gap-2">
                  <Lucide icon="CircleAlert" className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-danger">{groupingError}</p>
                </div>
              </div>
            )}

            {/* Results */}
            {groupingStatus === 'completed' && groupingResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-success mb-2">
                  <Lucide icon="CircleCheck" className="w-4 h-4" />
                  <span>Analisi completata: {groupingResult.groupCount} gruppi trovati su {groupingResult.analyzedFiles} file analizzati</span>
                </div>

                {groupingResult?.groups?.length > 0 ? (
                  <div className="space-y-3">
                    {groupingResult.groups.map((group) => (
                      <div key={group.groupId} className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-2.5 bg-indigo-50/50 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Lucide icon="Copy" className="w-4 h-4 text-indigo-600" />
                            <span className="text-sm font-medium text-slate-700">
                              Gruppo {group.groupId}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500">{group.size} file identici</span>
                        </div>
                        <div className="max-h-[32rem] overflow-y-auto p-3 bg-slate-50/30">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
                            {group.files.map((file, i) => {
                              const thumbSrc = file.id_olimpo_cloud ? buildGroupingThumbnailUrl(file.id_olimpo_cloud) : docThumbnailFallback;
                              return (
                                <div
                                  key={`${file.id_olimpo_cloud}-${i}`}
                                  className="rounded-md border border-slate-200 bg-white overflow-hidden shadow-sm text-xs"
                                >
                                  <div
                                    className="relative w-full aspect-square border-b border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center cursor-pointer group/thumb"
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
                                      className="w-full h-full object-contain p-1 transition-transform duration-200 group-hover/thumb:scale-110"
                                      loading="lazy"
                                      onError={(event) => {
                                        const target = event.currentTarget;
                                        if (target.src !== docThumbnailFallback) {
                                          target.src = docThumbnailFallback;
                                        }
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/10 transition-colors flex items-center justify-center">
                                      <Lucide icon="ZoomIn" className="w-5 h-5 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity drop-shadow-md" />
                                    </div>
                                  </div>
                                  <div className="p-1.5">
                                    <div className="font-medium text-slate-700 truncate" title={file.nome}>{file.nome}</div>
                                    <div className="text-[10px] text-slate-500 truncate">
                                      {file.nome_kit || file.id_runtime}
                                      {file.pages ? ` \u2022 ${file.pages}p` : ''}
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
                            <div className="px-4 py-3 border-t border-slate-200 bg-white">
                              {isMerged ? (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 text-sm text-success min-w-0">
                                    <Lucide icon="CircleCheck" className="w-4 h-4 flex-shrink-0" />
                                    <span className="truncate">
                                      Gruppo unificato: <strong>{mergeState?.nome}</strong>
                                      {mergeState?.virtualDir && (
                                        <span className="text-slate-500 font-normal ml-1.5">
                                          in {mergeState.virtualDir}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <Button
                                    variant="outline-danger"
                                    size="sm"
                                    className="text-xs whitespace-nowrap flex-shrink-0"
                                    disabled={isMerging}
                                    onClick={() => handleDeleteMerge(group.groupId)}
                                  >
                                    {isMerging ? (
                                      <LoadingIcon icon="oval" color="red" className="w-3.5 h-3.5 mr-1" />
                                    ) : (
                                      <Lucide icon="Undo2" className="w-3.5 h-3.5 mr-1" />
                                    )}
                                    Annulla unione
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex flex-col sm:flex-row gap-3 items-end">
                                  <div className="flex-1 min-w-0">
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Nome file unificato</label>
                                    <FormInput
                                      type="text"
                                      placeholder="Nome file..."
                                      value={mergeState?.nome || ''}
                                      onChange={(e) => updateGroupMerge(group.groupId, { nome: e.target.value })}
                                      disabled={isMerging}
                                      className={`text-sm ${nameCollision ? 'border-danger focus:border-danger focus:ring-danger/20' : ''}`}
                                    />
                                    {nameCollision && (
                                      <p className="text-xs text-danger mt-1 flex items-center gap-1">
                                        <Lucide icon="CircleAlert" className="w-3 h-3 flex-shrink-0" />
                                        Il nome coincide con uno dei file del gruppo
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Directory di destinazione</label>
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
                                    variant="primary"
                                    size="sm"
                                    className="whitespace-nowrap"
                                    disabled={isMerging || nameCollision}
                                    onClick={() => handleMergeGroup(group)}
                                  >
                                    {isMerging ? (
                                      <>
                                        <LoadingIcon icon="oval" color="white" className="w-4 h-4 mr-1.5" />
                                        Unione...
                                      </>
                                    ) : (
                                      <>
                                        <Lucide icon="Merge" className="w-4 h-4 mr-1.5" />
                                        Unisci gruppo
                                      </>
                                    )}
                                  </Button>
                                </div>
                              )}
                              {mergeState?.error && (
                                <div className="mt-2 text-xs text-danger flex items-center gap-1.5">
                                  <Lucide icon="CircleAlert" className="w-3.5 h-3.5 flex-shrink-0" />
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
                  <div className="text-sm text-slate-500 text-center py-4">
                    Nessun file duplicato trovato. Tutti i file sono unici.
                  </div>
                )}
              </div>
            )}

            {kitDisponibili.length === 0 && groupingStatus === 'idle' && (
              <div className="text-sm text-slate-500 text-center py-4">
                Nessun kit disponibile per il raggruppamento.
              </div>
            )}
          </div>

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
                <div className="box box--stacked p-6 mb-6">
                  <div className="flex items-center justify-between gap-x-3 mb-4">
                    <div className="flex items-center gap-x-3">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${transferComplete ? 'bg-success/10' : ftpErrorMessage && !isTransferring ? 'bg-danger/10' : 'bg-primary/10'
                        }`}>
                        {isTransferring ? (
                          <Lucide icon="Upload" className="w-5 h-5 text-primary animate-pulse" />
                        ) : transferComplete ? (
                          <Lucide icon="CircleCheck" className="w-5 h-5 text-success" />
                        ) : (
                          <Lucide icon="CircleAlert" className="w-5 h-5 text-danger" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">
                          {transferComplete ? 'Trasferimento completato' : ftpErrorMessage && !isTransferring ? 'Errore di trasferimento' : 'Trasferimento in corso'}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {transferComplete
                            ? `${ftpTransferDetail.totalFiles > 0 ? `${ftpTransferDetail.totalFiles} file` : 'File'} inviati con successo${ftpTransferDetail.totalKits > 0 ? ` da ${ftpTransferDetail.totalKits} kit` : ''}`
                            : ftpErrorMessage && !isTransferring
                              ? 'Si è verificato un problema durante il trasferimento'
                              : ftpTransferDetail.kit
                                ? `Kit in elaborazione: ${ftpTransferDetail.kit}`
                                : 'Invio dei file selezionati alla tipografia'
                          }
                        </p>
                      </div>
                    </div>
                    {(transferComplete || (ftpErrorMessage && !isTransferring)) && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
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
                        <Lucide icon="X" className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* Dettagli fase e contatori - visibili durante il trasferimento */}
                  {isTransferring && (ftpTransferDetail.fase || ftpTransferDetail.totalFiles > 0) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      {ftpTransferDetail.fase && (
                        <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Fase</div>
                          <div className="text-sm font-medium text-slate-700 truncate">
                            {ftpTransferDetail.fase === 'caricamento_dati' ? 'Caricamento dati'
                              : ftpTransferDetail.fase === 'creazione_cartelle' ? 'Creazione cartelle'
                                : ftpTransferDetail.fase === 'creazione_excel' ? 'Report Excel'
                                  : ftpTransferDetail.fase.replace(/_/g, ' ')}
                          </div>
                        </div>
                      )}
                      {ftpTransferDetail.kit && (
                        <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Kit</div>
                          <div className="text-sm font-medium text-slate-700 truncate" title={ftpTransferDetail.kit}>
                            {ftpTransferDetail.kit}
                          </div>
                        </div>
                      )}
                      {ftpTransferDetail.totalFiles > 0 && (
                        <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">File</div>
                          <div className="text-sm font-medium text-slate-700">
                            {ftpTransferDetail.currentFile > 0 ? `${ftpTransferDetail.currentFile} / ${ftpTransferDetail.totalFiles}` : `${ftpTransferDetail.totalFiles} totali`}
                          </div>
                        </div>
                      )}
                      {ftpTransferDetail.totalKits > 0 && (
                        <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Kit totali</div>
                          <div className="text-sm font-medium text-slate-700">{ftpTransferDetail.totalKits}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Progress bar - visibile durante il trasferimento */}
                  {(isTransferring || ((progress > 0 || globalProgress > 0) && !transferComplete && !ftpErrorMessage)) && (
                    <div className="space-y-3 mb-4">
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span>Avanzamento globale</span>
                          <span>{Math.round(globalProgress * 100)}%</span>
                        </div>
                        <Progress
                          className="h-2.5"
                          progress={globalProgress * 100}
                          classNameProgress="bg-primary"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span>Avanzamento kit corrente</span>
                          <span>{Math.round(progress * 100)}%</span>
                        </div>
                        <Progress
                          className="h-3"
                          progress={progress * 100}
                          classNameProgress="bg-success"
                        />
                      </div>
                      {ftpTransferDetail.fileName && (
                        <div className="text-xs text-slate-600 text-center pt-1 truncate" title={ftpTransferDetail.fileName}>
                          {ftpTransferDetail.fileName}
                        </div>
                      )}
                      {!ftpTransferDetail.fileName && ftpTransferDetail.message && (
                        <div className="text-xs text-slate-600 text-center pt-1 truncate">
                          {ftpTransferDetail.message}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Messaggio di successo */}
                  {transferComplete && (
                    <div className="flex items-start p-3 rounded-lg bg-success/5 border border-success/20">
                      <Lucide icon="CircleCheck" className="w-4 h-4 mr-2.5 text-success flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-success">
                        <span>{ftpProgressMessage || 'Processo completato con successo'}</span>
                        {(ftpTransferDetail.totalFiles > 0 || ftpTransferDetail.totalKits > 0) && (
                          <span className="text-success/70 ml-1.5">
                            ({ftpTransferDetail.totalFiles > 0 && `${ftpTransferDetail.totalFiles} file`}
                            {ftpTransferDetail.totalFiles > 0 && ftpTransferDetail.totalKits > 0 && ', '}
                            {ftpTransferDetail.totalKits > 0 && `${ftpTransferDetail.totalKits} kit`})
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Messaggio di errore */}
                  {ftpErrorMessage && (
                    <div className="flex items-start p-3 rounded-lg bg-danger/5 border border-danger/20">
                      <Lucide icon="CircleAlert" className="w-4 h-4 mr-2.5 text-danger flex-shrink-0 mt-0.5" />
                      <div className="space-y-1 flex-1">
                        <p className="text-sm font-medium text-danger">Si è verificato un errore</p>
                        <p className="text-xs text-danger/80 break-words">{ftpErrorMessage}</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <div className="flex flex-col box box--stacked rounded-xl shadow-sm border border-slate-200/80">
              <div className="flex flex-col p-6 gap-y-4 rounded-t-xl border-b border-slate-200/80">
                <div className="flex items-center gap-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50">
                    <Lucide icon="Package" className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Kit dell'ordine</h3>
                    <p className="text-sm text-slate-500">{kitInviati.length} inviati, {kitDisponibili.length} disponibili</p>
                  </div>
                </div>
                <div className="relative">
                  <Lucide icon="Search" className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3] text-slate-500" />
                  <FormInput
                    type="text"
                    placeholder="Cerca per titolo, area, canale..."
                    className="pl-9 sm:w-72 rounded-lg"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-6">
                {(!filteredKitDisponibili || filteredKitDisponibili.length === 0) &&
                  (!gruppInvii || gruppInvii.length === 0) ? (
                  <div className="flex flex-col items-center justify-center h-64 text-lg bg-slate-50 border border-dashed border-slate-300 rounded-lg p-6">
                    <Lucide icon="SearchX" className="w-12 h-12 mb-4 stroke-[1] text-slate-400" />
                    {searchTerm ? (
                      <>
                        <p className="font-medium text-slate-600">Nessuna lavorazione trovata</p>
                        <p className="text-sm mt-1 text-slate-500">Prova a modificare i criteri di ricerca.</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-slate-600">Nessun kit da revisionare</p>
                        <p className="text-sm mt-1 text-slate-500">Non ci sono kit disponibili per questo ordine di stampa.</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Sezione kit già inviati */}
                    {gruppInvii && gruppInvii.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-x-3 pb-2 border-b border-slate-200/60">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600">
                            <Lucide icon="CheckCheck" className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-slate-700">Kit già inviati alla tipografia</h3>
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
                        <div className="flex items-center gap-x-3 pb-2 border-b border-slate-200/60">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
                            <Lucide icon="Package" className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-slate-700">Kit disponibili per l'invio</h3>
                            <p className="text-xs text-slate-500">{filteredKitDisponibili.length} kit pronti</p>
                          </div>
                        </div>
                        <div className="flex items-center text-sm p-3 bg-slate-50/80 rounded-lg border border-slate-200/80">
                          <FormCheck className='flex items-center'>
                            <FormCheck.Input
                              id="selectAll"
                              type="checkbox"
                              className='!rounded-md'
                              checked={selectAll}
                              onChange={handleSelectAll}
                            />
                            <FormCheck.Label htmlFor="selectAll" className="select-none font-medium ml-2">
                              Seleziona tutti ({filteredKitDisponibili.length})
                            </FormCheck.Label>
                          </FormCheck>
                          {selectedKitsCount > 0 && (
                            <div className="ml-auto text-slate-600 font-medium">{selectedKitsCount} kit selezionati</div>
                          )}
                        </div>
                        <div className="space-y-3">
                          {renderDettagli(filteredKitDisponibili)}
                        </div>
                      </div>
                    )}

                    {/* Messaggio quando tutti i kit sono stati inviati */}

                  </div>
                )}
              </div>

              {filteredKitDisponibili && filteredKitDisponibili.length > 0 && (
                <div className="p-6 border-t border-slate-200/80 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    {numeroFileProblematici > 0 && (
                      <div className="flex items-center gap-x-2 text-amber-600">
                        <Lucide icon="TriangleAlert" className="w-4 h-4" />
                        <span>
                          {numeroFileProblematiciTesto}
                        </span>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => setShowDialogInvioFTP(true)}
                    disabled={!(Object.values(selectedKits).filter(Boolean).length > 0) || isTransferring}
                    variant="primary"
                    className="text-sm min-w-48"
                  >
                    {isTransferring ? (
                      <>
                        <LoadingIcon icon="oval" color="white" className="w-4 h-4 mr-2" />
                        Trasferimento in corso...
                      </>
                    ) : (
                      <>
                        Manda file alla tipografia
                        <Lucide icon="Send" className="w-4 h-4 ml-2 stroke-[1.5]" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
