// features/developerConsole/errorSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LoghiReferenza, ReferenzeIstanta } from '../../lib/types';

// Riutilizzo dei tipi già definiti

export enum GRAVITA_PROBLEMA {
  CRITICA = 'CRITICA',
  MEDIA = 'MEDIA',
  BASSA = 'BASSA',
}

export enum Events {
  NUMERO_PROBLEMI_ANTICAMERA = 'NUMERO_PROBLEMI_ANTICAMERA',
  MANCATA_CARICAMENTO_CAROSELLO = 'MANCATA_CARICAMENTO_CAROSELLO',
  MANCATA_IMMAGINE_REFERENZA = 'MANCATA_IMMAGINE_REFERENZA',
  MANCATO_LOGO_REFERENZA = 'MANCATO_LOGO_REFERENZA',
  MANCATA_IMMAGINE_BANNER = 'MANCATA_IMMAGINE_BANNER',
  MANCATA_STRUTTURA_REFERENZA = 'MANCATA_STRUTTURA_REFERENZA',
  MANCATO_CAMPO_REFERENZA = 'MANCATO_CAMPO_REFERENZA',
  MANCATA_STRUTTURA_DEFAULT = 'MANCATA_STRUTTURA_DEFAULT',
  MANCATA_STRUTTURA_REFERENZA_ANTICAMERA = 'MANCATA_STRUTTURA_REFERENZA_ANTICAMERA',
  NUMERO_REFERENZE_MANCANTI = 'NUMERO_REFERENZE_MANCANTI',
  CAMPO_ERRATO_FILTRO_CAROSELLO = 'CAMPO_ERRATO_FILTRO_CAROSELLO',
  ERRORE_SALVATAGGIO_REFERENZA = 'ERRORE_SALVATAGGIO_REFERENZA',
}

export interface Errore {
  id: string;
  type: string;
  event: Events;
  message: React.ReactNode;
  gravita: GRAVITA_PROBLEMA;
  ref?: () => void;
  referenza?:ReferenzeIstanta;
  logo?: LoghiReferenza;
  foto?: string[];
  data?: any;
}

// Definiamo lo state per la developer console
interface DeveloperConsoleState {
  errori: Record<Events, Errore[]>;
}

// Stato iniziale: per ogni evento, un array vuoto
const initialState: DeveloperConsoleState = {
  errori: Object.values(Events).reduce(
    (acc, event) => ({ ...acc, [event]: [] }),
    {} as Record<Events, Errore[]>
  ),
};

const developerConsoleSlice = createSlice({
  name: 'developerConsole',
  initialState,
  reducers: {
    // Aggiunge un errore se non è duplicato
    addErrore: (state, action: PayloadAction<Errore>) => {
      const errore = action.payload;
      const eventErrors = state.errori[errore.event];
      const isDuplicate = eventErrors.some(
        (e) => e.id === errore.id && JSON.stringify(e.data) === JSON.stringify(errore.data)
      );
      if (!isDuplicate) {
        state.errori[errore.event].push(errore);
      }
    },
    // Rimuove un errore specifico in base all'evento e all'id
    removeErrore: (
      state,
      action: PayloadAction<{ event: Events; id: string }>
    ) => {
      const { event, id } = action.payload;
      state.errori[event] = state.errori[event].filter((err) => err.id !== id);
    },
    // Aggiorna un errore esistente con nuovi dati
    updateErrore: (
      state,
      action: PayloadAction<{ event: Events; id: string; newData: Partial<Errore> }>
    ) => {
      const { event, id, newData } = action.payload;
      state.errori[event] = state.errori[event].map((err) =>
        err.id === id ? { ...err, ...newData } : err
      );
    },
    // Pulisce gli errori di un evento specifico
    clearEventErrori: (state, action: PayloadAction<Events>) => {
      state.errori[action.payload] = [];
    },
    // Pulisce tutti gli errori
    clearAllErrori: (state) => {
      Object.keys(state.errori).forEach((key) => {
        state.errori[key as Events] = [];
      });
    },
  },
});

export const {
  addErrore,
  removeErrore,
  updateErrore,
  clearEventErrori,
  clearAllErrori,
} = developerConsoleSlice.actions;

export default developerConsoleSlice.reducer;
