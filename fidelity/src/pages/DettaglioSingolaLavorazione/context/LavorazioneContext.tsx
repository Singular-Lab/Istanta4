import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { FileItemKit } from '../../../../lib/types';
import { LavorazioneType, StagedFile } from '../types';

// 1. Definisce la forma dello stato del contesto
interface LavorazioneState {
    lavorazione: LavorazioneType;
    files: FileItemKit[];
    isLoadingFiles: boolean;
    accepted: FileItemKit[];
    rejected: FileItemKit[];
    rejectionReasons: Record<string, string>; // fileId -> reason
    staged: StagedFile[];
    correggoFile: FileItemKit | undefined;
}

// 2. Definisce le azioni che possono modificare lo stato
type Action =
    | { type: 'SET_FILES'; payload: { files: FileItemKit[], isLoading: boolean } }
    | { type: 'TOGGLE_ACCEPT'; payload: FileItemKit }
    | { type: 'TOGGLE_REJECT'; payload: { file: FileItemKit; reason?: string } }
    | { type: 'SET_STAGED_FILES'; payload: StagedFile[] }
    | { type: 'SET_ACCEPTED'; payload: FileItemKit[] }
    | { type: 'SET_REJECTED'; payload: FileItemKit[] }
    | { type: 'SET_REJECTION_REASONS'; payload: Record<string, string> }
    | { type: 'ACCEPT_MULTIPLE'; payload: FileItemKit[] }
    | { type: 'SET_CORREGGO_FILE'; payload: FileItemKit }
    | { type: 'RESET_CHANGES' };

// 3. Crea il reducer per gestire le transizioni di stato
const lavorazioneReducer = (state: LavorazioneState, action: Action): LavorazioneState => {
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
            
            // Quando si accetta un file, lo si rimuove dai rifiutati
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

            // Quando si rifiuta un file, lo si rimuove dagli accettati
            const newAccepted = state.accepted.filter(a => a.id !== file.id);
            return { ...state, accepted: newAccepted, rejected: newRejected, rejectionReasons: newReasons };
        }
        
        case 'SET_STAGED_FILES':
            return { ...state, staged: action.payload };

        case 'ACCEPT_MULTIPLE': {
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

        case 'SET_CORREGGO_FILE':
            return { ...state, correggoFile: action.payload };

        case 'RESET_CHANGES':
            return { ...state, accepted: [], rejected: [], rejectionReasons: {} };

        default:
            return state;
    }
};

// 4. Crea il Contesto React
const LavorazioneContext = createContext<{
    state: LavorazioneState;
    dispatch: React.Dispatch<Action>;
} | undefined>(undefined);

// 5. Crea il componente Provider
interface LavorazioneProviderProps {
    children: React.ReactNode;
    lavorazione: LavorazioneType;
    filesData: FileItemKit[] | undefined;
    isLoading: boolean;
    correggoFile: FileItemKit | undefined;
}

export const LavorazioneProvider: React.FC<LavorazioneProviderProps> = ({ children, lavorazione, filesData, isLoading, correggoFile }) => {
    const initialState: LavorazioneState = {
        lavorazione,
        files: filesData || [],
        isLoadingFiles: isLoading,
        accepted: [],
        rejected: [],
        rejectionReasons: {},
        staged: [],
        correggoFile
    };

    const [state, dispatch] = useReducer(lavorazioneReducer, initialState);

    // Mantiene lo stato sincronizzato con le props che arrivano dall'esterno
    useEffect(() => {
        dispatch({ type: 'SET_FILES', payload: { files: filesData || [], isLoading } });
    }, [filesData, isLoading]);

    useEffect(() => {
        if (correggoFile) {
            dispatch({ type: 'SET_CORREGGO_FILE', payload: correggoFile });
        }
    }, [correggoFile]);

    return (
        <LavorazioneContext.Provider value={{ state, dispatch }}>
            {children}
        </LavorazioneContext.Provider>
    );
};

// 6. Crea l'hook per consumare il contesto facilmente
export const useLavorazione = () => {
    const context = useContext(LavorazioneContext);
    if (context === undefined) {
        throw new Error('useLavorazione deve essere usato all\'interno di un LavorazioneProvider');
    }
    return context;
}; 