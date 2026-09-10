// src/stores/themeSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "./store";
import Echo from "../themes/Echo";
// import Hurricane from "../themes/Hurricane"; // ecc.

// ──────────────────────────────────────────────────────────────────────────────
//  Config
// ──────────────────────────────────────────────────────────────────────────────
export const themes = [
  { name: "echo", component: Echo },
  // { name: "hurricane", component: Hurricane },
  // { name: "ravage", component: Ravage },
  // …
] as const;

export type ThemeName = (typeof themes)[number]["name"];

// ──────────────────────────────────────────────────────────────────────────────
//  Utils
// ──────────────────────────────────────────────────────────────────────────────
const isBrowser =
  typeof window !== "undefined" && typeof localStorage !== "undefined";

/** Ritorna il tema corrispondente a `search`, o il primo (fallback). */
function resolveTheme(search?: ThemeName): ThemeName {
  const candidate = search ?? (isBrowser ? localStorage.getItem("theme") : null);
  return themes.find((t) => t.name === candidate)?.name ?? themes[0].name;
}

/** Persiste il tema selezionato (solo nel browser). */
function persistTheme(name: ThemeName) {
  if (isBrowser) localStorage.setItem("theme", name);
}

// ──────────────────────────────────────────────────────────────────────────────
//  Slice
// ──────────────────────────────────────────────────────────────────────────────
interface ThemeState {
  value: ThemeName;
}

const initialState: ThemeState = {
  value: resolveTheme(),
};

export const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<ThemeName>) => {
      state.value = action.payload;
      persistTheme(action.payload);
    },
  },
});

export const getTheme = (theme: ThemeName) => {
  return themes.find((t) => t.name === theme)?.component;
};

export const { setTheme } = themeSlice.actions;

/** Selector puro (nessun side-effect). */
export const selectTheme = (state: RootState) => state.theme.value;

export default themeSlice.reducer;
