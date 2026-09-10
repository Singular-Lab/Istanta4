import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { ServerCall } from "../../lib/server_call";
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
}

export interface SideMenuState {
  menu: Array<Menu | string>;
  loading: boolean; // Stato di caricamento
  startPage: string | null;
}

const initialState: SideMenuState = {
  menu: [],
  loading: true,
  startPage: null,
};

const findStartPagePath = (items: Array<Menu | string>): string | null => {
  let firstNavigablePath: string | null = null;

  for (const item of items) {
    if (typeof item === "string") {
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
  const response = await ServerCall.get<Array<Menu | string>>("/menu/me");
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
      })
      .addCase(fetchSideMenu.fulfilled, (state, action) => {
        state.menu = action.payload;
        state.loading = false; // Imposta il caricamento a false una volta completato
        state.startPage = findStartPagePath(action.payload);
      })
      .addCase(fetchSideMenu.rejected, (state) => {
        state.loading = false; // Imposta il caricamento a false in caso di errore
      });
  },
});

export const selectSideMenu = (state: RootState) => state.sideMenu.menu;
export const selectSideMenuLoading = (state: RootState) => state.sideMenu.loading;
export const selectSideMenuStartPage = (state: RootState) => state.sideMenu.startPage;

export default sideMenuSlice.reducer;
