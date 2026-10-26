// src/stores/darkModeSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "./store";

interface DarkModeState {
  value: boolean;
}

/** Utility per capire se siamo nel browser */
const isBrowser =
  typeof window !== "undefined" && typeof localStorage !== "undefined";

/** Stato iniziale: se siamo in SSR --> fallback di default (false) */
const initialState: DarkModeState = {
  value: isBrowser
    ? localStorage.getItem("darkMode") === "true"
    : false,
};

export const darkModeSlice = createSlice({
  name: "darkMode",
  initialState,
  reducers: {
    /** Imposta e persiste solo lato client */
    setDarkMode: (state, action: PayloadAction<boolean>) => {
      state.value = action.payload;

      if (isBrowser) {
        localStorage.setItem("darkMode", action.payload.toString());
      }
    },
  },
});

export const { setDarkMode } = darkModeSlice.actions;

/** Selector puro: niente side-effect */
export const selectDarkMode = (state: RootState) => state.darkMode.value;

export default darkModeSlice.reducer;
