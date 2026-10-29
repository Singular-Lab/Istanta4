import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface PageLoaderState {
  value: boolean;
}

const initialState: PageLoaderState = {
  value: false,
};

export const pageLoaderSlice = createSlice({
  name: "pageLoader",
  initialState,
  reducers: {
    setPageLoader: (state, action: PayloadAction<boolean>) => {
      state.value = action.payload;
    },
  },
});

export const { setPageLoader } = pageLoaderSlice.actions;

export default pageLoaderSlice.reducer;
