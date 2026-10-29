// src/stores/themeSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// ──────────────────────────────────────────────────────────────────────────────
//  Config
// ──────────────────────────────────────────────────────────────────────────────
// Solo i nomi: il layout del tema lo carica il router con un import dinamico. Importarlo qui
// lo porterebbe, con tutto il suo albero, nel codice comune scaricato da ogni pagina.
export const themes = [
  { name: "echo" },
  // { name: "hurricane" },
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

export const { setTheme } = themeSlice.actions;

export default themeSlice.reducer;
