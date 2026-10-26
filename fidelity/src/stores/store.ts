import { configureStore, ThunkAction, Action } from "@reduxjs/toolkit";
import darkModeReducer from "./darkModeSlice";
import colorSchemeReducer from "./colorSchemeSlice";
import sideMenuReducerIstanta from "./sideMenuSlice_istanta";
import themeReducer from "./themeSlice";
import compactMenuReducer from "./compactMenuSlice";
import pageLoaderReducer from "./pageLoaderSlice";
import developerConsoleReducer from './errorSlice';


export const store = configureStore({
  reducer: {
    developerConsoleReducer:developerConsoleReducer,
    darkMode: darkModeReducer,
    colorScheme: colorSchemeReducer,
    sideMenu: sideMenuReducerIstanta,
    theme: themeReducer,
    compactMenu: compactMenuReducer,
    pageLoader: pageLoaderReducer,
  },
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
