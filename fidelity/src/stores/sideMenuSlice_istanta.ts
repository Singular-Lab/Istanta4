import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { ServerCall } from "../../lib/server_call";
import { eSezioneMenu, type SezionePagina } from "../../lib/accessi/sezioni";
import type { MenuSezione } from "../../lib/types";
import { RootState } from "./store";

export interface Menu {
  icon: string;
  title: string;
  badge?: {
    variant: "info" | "danger" | "warning" | "success" | "primary";
    count: number;
  };
  pathname?: string;
  subMenu?: Menu[];
  redirect?: string;
  ignore?: boolean;
  disabled?: boolean;
  visible?: boolean;
  start_page?: boolean;
  /** Area scelta dall'amministratore per la voce, se diversa da quella della pagina (dal server). */
  area?: SezionePagina;
}

/** Una voce del menu laterale, l'intestazione di un gruppo (stringa) o di una sezione. */
export type ElementoMenu = Menu | string | MenuSezione;

export interface SideMenuState {
  menu: ElementoMenu[];
  loading: boolean; // Stato di caricamento
  startPage: string | null;
  error: string | null; // valorizzato se /menu/me fallisce, per mostrare "Riprova" nel layout
}

const initialState: SideMenuState = {
  menu: [],
  loading: true,
  startPage: null,
  error: null,
};

const findStartPagePath = (items: ElementoMenu[]): string | null => {
  let firstNavigablePath: string | null = null;

  for (const item of items) {
    if (typeof item === "string" || eSezioneMenu(item)) {
      continue;
    }

    if (!firstNavigablePath && item.pathname && !item.disabled) {
      firstNavigablePath = item.pathname;
    }

    if (item.start_page && item.pathname) {
      return item.pathname;
    }

    if (item.subMenu && item.subMenu.length) {
      const nestedStartPage = findStartPagePath(item.subMenu);
      if (nestedStartPage) {
        return nestedStartPage;
      }
    }
  }

  return firstNavigablePath;
};

// Thunk per caricare il menu
export const fetchSideMenu = createAsyncThunk("sideMenu/fetchMenu", async () => {
  const response = await ServerCall.get<ElementoMenu[]>("/menu/me");
  return response; // Presumendo che l'API restituisca il menu in formato JSON
});

export const sideMenuSlice = createSlice({
  name: "sideMenu",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSideMenu.pending, (state) => {
        state.loading = true; // Imposta il caricamento a true quando la chiamata è in attesa
        state.error = null;
      })
      .addCase(fetchSideMenu.fulfilled, (state, action) => {
        state.menu = action.payload;
        state.loading = false; // Imposta il caricamento a false una volta completato
        state.startPage = findStartPagePath(action.payload);
      })
      .addCase(fetchSideMenu.rejected, (state, action) => {
        state.loading = false; // Imposta il caricamento a false in caso di errore
        state.error = action.error.message || "Impossibile caricare il menu";
      });
  },
});

export const selectSideMenu = (state: RootState) => state.sideMenu.menu;
export const selectSideMenuLoading = (state: RootState) => state.sideMenu.loading;
export const selectSideMenuStartPage = (state: RootState) => state.sideMenu.startPage;
export const selectSideMenuError = (state: RootState) => state.sideMenu.error;

export default sideMenuSlice.reducer;
