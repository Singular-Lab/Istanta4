import type { StagedFile } from '@/components/KitOverview/types';
import React, { createContext, useCallback, useContext, useEffect, useReducer } from 'react';
import { STATO_LOG_FILE } from '../../../../lib/enums';
import { FileItemKit } from '../../../../lib/types';

/**
 * KitContext - Contesto unificato per la gestione dello stato del kit
 *
 * Gestisce:
 * - File accettati/rifiutati
 * - File staged per upload
 * - File correggo
 * - Stato di loading
 */

// Tipo per la lavorazione (unione di design e runtime)
export interface KitType {
  guidId: string;
  titolo: string;
  tipo: string;
  files?: FileItemKit[];
  stato_lavorazione?: string;
  lavorazioneStarted?: boolean;
  tipiDiExportInKit?: Array<{
    tipoDiExportGuidID: string;
    codice: string;
  }>;
  tipiExport?: Array<{
    id_tipiexport: string;
    codice_tipiexport: string;
    nome_tipiexport: string;
  }>;
  nomeArea?: string;
  nomeCanale?: string;
  codiceArea?: string;
  codiceCanale?: string;
  guidCanale?: string;
  guidArea?: string;
  quantitaCopie?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  [key: string]: any;
}

// State interface
interface KitState {
  kit: KitType;
  files: FileItemKit[];
  isLoadingFiles: boolean;
  accepted: FileItemKit[];
  rejected: FileItemKit[];
  rejectionReasons: Record<string, string>; // fileId -> reason
  staged: StagedFile[];
  correggoFile?: FileItemKit;
}

// Actions
type KitAction =
  | { type: 'SET_FILES'; payload: { files: FileItemKit[]; isLoading: boolean } }
  | { type: 'TOGGLE_ACCEPT'; payload: FileItemKit }
  | { type: 'TOGGLE_REJECT'; payload: { file: FileItemKit; reason?: string } }
  | { type: 'SET_STAGED_FILES'; payload: StagedFile[] }
  | { type: 'SET_ACCEPTED'; payload: FileItemKit[] }
  | { type: 'SET_REJECTED'; payload: FileItemKit[] }
  | { type: 'SET_REJECTION_REASONS'; payload: Record<string, string> }
  | { type: 'ACCEPT_ALL'; payload: FileItemKit[] }
  | { type: 'UNDO_ALL' }
  | { type: 'SET_CORREGGO_FILE'; payload: FileItemKit | undefined }
  | { type: 'RESET_CHANGES' };

// Reducer
const kitReducer = (state: KitState, action: KitAction): KitState => {
  switch (action.type) {
    case 'SET_FILES':
      return {
        ...state,
        files: action.payload.files,
        isLoadingFiles: action.payload.isLoading,
      };

    case 'SET_ACCEPTED':
      return { ...state, accepted: action.payload };

    case 'SET_REJECTED':
      return { ...state, rejected: action.payload };

    case 'SET_REJECTION_REASONS':
      return { ...state, rejectionReasons: action.payload };

    case 'TOGGLE_ACCEPT': {
      const file = action.payload;
      const isAccepted = state.accepted.some(f => f.id === file.id);
      const newAccepted = isAccepted
        ? state.accepted.filter(f => f.id !== file.id)
        : [...state.accepted, file];

      // Remove from rejected when accepting
      const newRejected = state.rejected.filter(f => f.id !== file.id);
      return { ...state, accepted: newAccepted, rejected: newRejected };
    }

    case 'TOGGLE_REJECT': {
      const { file, reason } = action.payload;
      const isRejected = state.rejected.some(r => r.id === file.id);

      const newRejected = isRejected
        ? state.rejected.filter(r => r.id !== file.id)
        : [...state.rejected.filter(r => r.id !== file.id), file];

      // Update rejection reasons separately
      const newReasons = { ...state.rejectionReasons };
      if (isRejected) {
        delete newReasons[file.id];
      } else if (reason) {
        newReasons[file.id] = reason;
      }

      // Remove from accepted when rejecting
      const newAccepted = state.accepted.filter(a => a.id !== file.id);
      return { ...state, accepted: newAccepted, rejected: newRejected, rejectionReasons: newReasons };
    }

    case 'SET_STAGED_FILES':
      return { ...state, staged: action.payload };

    case 'ACCEPT_ALL': {
      const filesToAccept = action.payload;
      if (!filesToAccept || filesToAccept.length === 0) {
        return state;
      }
      const filesToAcceptIds = filesToAccept.map(f => f.id);

      const newAccepted = [...state.accepted];
      filesToAccept.forEach(file => {
        if (!state.accepted.some(a => a.id === file.id)) {
          newAccepted.push(file);
        }
      });

      const newRejected = state.rejected.filter(f => !filesToAcceptIds.includes(f.id));

      return { ...state, accepted: newAccepted, rejected: newRejected };
    }

    case 'UNDO_ALL':
      return { ...state, accepted: [], rejected: [], rejectionReasons: {} };

    case 'SET_CORREGGO_FILE':
      return { ...state, correggoFile: action.payload };

    case 'RESET_CHANGES':
      return { ...state, accepted: [], rejected: [], rejectionReasons: {}, staged: [] };

    default:
      return state;
  }
};

// Context type
interface KitContextType {
  state: KitState;
  dispatch: React.Dispatch<KitAction>;
  // Helper functions
  toggleAccept: (file: FileItemKit) => void;
  toggleReject: (file: FileItemKit, reason?: string) => void;
  acceptAll: (files: FileItemKit[]) => void;
  undoAll: () => void;
  setStagedFiles: (files: StagedFile[]) => void;
  resetChanges: () => void;
  getRejectionReason: (file: FileItemKit) => string | undefined;
}

// Create context
const KitContext = createContext<KitContextType | undefined>(undefined);

// Provider props
interface KitProviderProps {
  children: React.ReactNode;
  kit: KitType;
  filesData?: FileItemKit[];
  isLoadingFiles: boolean;
  correggoFile?: FileItemKit;
  autoInitializeFromLogs?: boolean;
}

// Provider component
export const KitProvider: React.FC<KitProviderProps> = ({
  children,
  kit,
  filesData,
  isLoadingFiles,
  correggoFile,
  autoInitializeFromLogs = true
}) => {
  const initialState: KitState = {
    kit,
    files: filesData || [],
    isLoadingFiles,
    accepted: [],
    rejected: [],
    rejectionReasons: {},
    staged: [],
    correggoFile
  };

  const [state, dispatch] = useReducer(kitReducer, initialState);

  // Sync files from props
  useEffect(() => {
    dispatch({ type: 'SET_FILES', payload: { files: filesData || [], isLoading: isLoadingFiles } });
  }, [filesData, isLoadingFiles]);

  // Sync correggo file
  useEffect(() => {
    dispatch({ type: 'SET_CORREGGO_FILE', payload: correggoFile });
  }, [correggoFile]);

  // Auto-initialize accepted/rejected from file logs
  useEffect(() => {
    if (autoInitializeFromLogs && filesData && filesData.length > 0) {
      const accepted = filesData.filter(
        (f: FileItemKit) => f.log?.stato === STATO_LOG_FILE.ACCETTATO && f.id !== correggoFile?.id
      );
      const rejected = filesData.filter(
        (f: FileItemKit) => f.log?.stato === STATO_LOG_FILE.ERRORE && f.id !== correggoFile?.id
      );

      // Extract rejection reasons from logs
      const reasons: Record<string, string> = {};
      rejected.forEach(f => {
        const lastRejectionLog = f.log?.logs?.filter(l => l.azione === 'Rifiutato').pop();
        if (lastRejectionLog?.messaggio) {
          reasons[f.id] = lastRejectionLog.messaggio;
        }
      });

      dispatch({ type: 'SET_ACCEPTED', payload: accepted });
      dispatch({ type: 'SET_REJECTED', payload: rejected });
      dispatch({ type: 'SET_REJECTION_REASONS', payload: reasons });
    }
  }, [filesData, correggoFile, autoInitializeFromLogs]);

  // Helper functions
  const toggleAccept = useCallback((file: FileItemKit) => {
    dispatch({ type: 'TOGGLE_ACCEPT', payload: file });
  }, []);

  const toggleReject = useCallback((file: FileItemKit, reason?: string) => {
    dispatch({ type: 'TOGGLE_REJECT', payload: { file, reason } });
  }, []);

  const acceptAll = useCallback((files: FileItemKit[]) => {
    dispatch({ type: 'ACCEPT_ALL', payload: files });
  }, []);

  const undoAll = useCallback(() => {
    dispatch({ type: 'UNDO_ALL' });
  }, []);

  const setStagedFiles = useCallback((files: StagedFile[]) => {
    dispatch({ type: 'SET_STAGED_FILES', payload: files });
  }, []);

  const resetChanges = useCallback(() => {
    dispatch({ type: 'RESET_CHANGES' });
  }, []);

  // Get rejection reason from state or from file logs
  const getRejectionReason = useCallback((file: FileItemKit): string | undefined => {
    // First check state (for newly rejected files in this session)
    if (state.rejectionReasons[file.id]) {
      return state.rejectionReasons[file.id];
    }
    // Then check file logs (for previously rejected files)
    const lastRejectionLog = file.log?.logs?.filter(l => l.azione === 'Rifiutato').pop();
    return lastRejectionLog?.messaggio;
  }, [state.rejectionReasons]);

  const contextValue: KitContextType = {
    state,
    dispatch,
    toggleAccept,
    toggleReject,
    acceptAll,
    undoAll,
    setStagedFiles,
    resetChanges,
    getRejectionReason
  };

  return (
    <KitContext.Provider value={contextValue}>
      {children}
    </KitContext.Provider>
  );
};

// Custom hook to use the context
export const useKit = (): KitContextType => {
  const context = useContext(KitContext);
  if (context === undefined) {
    throw new Error('useKit must be used within a KitProvider');
  }
  return context;
};

export default KitContext;
