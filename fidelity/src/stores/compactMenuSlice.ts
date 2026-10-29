// src/stores/compactMenuSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const isBrowser =
  typeof window !== "undefined" && typeof localStorage !== "undefined";

/** Restituisce `true | false` leggendo dal localStorage, altrimenti `true`. */
function loadCompactMenu(): boolean {
  if (!isBrowser) return true;            // default lato SSR

  const stored = localStorage.getItem("compactMenu");
  return stored === null ? true : stored === "true";
}

/* -------------------------------------------------------------------------- */
/*  Slice                                                                     */
/* -------------------------------------------------------------------------- */

interface CompactMenuState {
  value: boolean;
}

const initialState: CompactMenuState = {
  value: loadCompactMenu(),
};

export const compactMenuSlice = createSlice({
  name: "compactMenu",
  initialState,
  reducers: {
    setCompactMenu: (state, action: PayloadAction<boolean>) => {
      state.value = action.payload;

      // persiste solo nel browser
      if (isBrowser) {
        localStorage.setItem("compactMenu", action.payload.toString());
      }
    },
  },
});

export const { setCompactMenu } = compactMenuSlice.actions;

export default compactMenuSlice.reducer;
