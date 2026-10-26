import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "./store";

export const colorSchemes = [
  "default",
  "theme-1",
  "theme-2",
  "theme-3",
  "theme-4",
  "theme-5",
  "theme-6",
  "theme-7",
  "theme-8",
  "theme-9",
  "theme-10",
  "theme-11",
  "theme-12",
  "theme-13",
  "theme-14",
  "theme-15",
  "theme-16",
  "theme-17",
] as const;

export type ColorSchemes = (typeof colorSchemes)[number];

/* -------------------------------------------------------------------------- */
/*  Utils                                                                     */
/* -------------------------------------------------------------------------- */

const isBrowser =
  typeof window !== "undefined" && typeof localStorage !== "undefined";

/** Restituisce uno schema valido (o "default") dal localStorage. */
function loadColorScheme(): ColorSchemes {
  if (!isBrowser) return "default";

  const stored = localStorage.getItem("colorScheme");
  return colorSchemes.includes(stored as ColorSchemes)
    ? (stored as ColorSchemes)
    : "default";
}

/* -------------------------------------------------------------------------- */
/*  Slice                                                                     */
/* -------------------------------------------------------------------------- */

interface ColorSchemeState {
  value: ColorSchemes;
}

const initialState: ColorSchemeState = {
  value: loadColorScheme(),
};

export const colorSchemeSlice = createSlice({
  name: "colorScheme",
  initialState,
  reducers: {
    setColorScheme: (state, action: PayloadAction<ColorSchemes>) => {
      state.value = action.payload;

      // Persiste solo sul client
      if (isBrowser) {
        localStorage.setItem("colorScheme", action.payload);
      }
    },
  },
});

export const { setColorScheme } = colorSchemeSlice.actions;

/** Selector puro, senza side-effect: niente scritture su localStorage. */
export const selectColorScheme = (state: RootState) =>
  state.colorScheme.value;

export default colorSchemeSlice.reducer;
