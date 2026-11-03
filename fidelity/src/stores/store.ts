import { Action, configureStore, ThunkAction } from "@reduxjs/toolkit";
import colorSchemeReducer from "./colorSchemeSlice";
import compactMenuReducer from "./compactMenuSlice";
import darkModeReducer from "./darkModeSlice";
import developerConsoleReducer from './errorSlice';
import pageLoaderReducer from "./pageLoaderSlice";
import sideMenuReducerIstanta from "./sideMenuSlice_istanta";
import themeReducer from "./themeSlice";


const reducers = {
    developerConsoleReducer,
    darkMode: darkModeReducer,
    colorScheme: colorSchemeReducer,
    sideMenu: sideMenuReducerIstanta,
    theme: themeReducer,
    compactMenu: compactMenuReducer,
    pageLoader: pageLoaderReducer,
};

export const createAppStore = (preloadedState?: {
  [Key in keyof typeof reducers]: ReturnType<(typeof reducers)[Key]>
}) => configureStore({ reducer: reducers, preloadedState });

export const store = createAppStore();

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
