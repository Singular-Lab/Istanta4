import { createContext, useContext } from 'react';
import { UNSAFE_LocationContext } from 'react-router-dom';
import type { Config, DataWebPliant, ReferenzeIstanta } from '../../lib/types';
import type { RootState } from '../stores/store';

export const ID_LAYOUT_WEBPLIANT = 'webpliant-layout';
export const ID_VOLANTINO_WEBPLIANT = 'webpliant-volantino';
export const ID_DATI_SSR = 'fidelity-ssr';

export interface BloccoWebpliantSsr {
  referenze: ReferenzeIstanta[];
  validita: string;
}

export interface DatiWebpliantSsr {
  url: string;
  giorno: string;
  idPagina: string;
  dataWebPliant: DataWebPliant;
  config: Config;
  referenze: ReferenzeIstanta[];
  blocchi: Record<string, BloccoWebpliantSsr>;
  css: string;
}

export const WebpliantSsrContext = createContext<DatiWebpliantSsr | null>(null);
export const useWebpliantSsr = () => useContext(WebpliantSsrContext);

export interface BootstrapWebpliantSsr {
  dati: DatiWebpliantSsr;
  reduxState: RootState;
}

export function usePosizioneWebpliant() {
  const context = useContext(UNSAFE_LocationContext);
  if (context) return { pathname: context.location.pathname, search: context.location.search };
  return typeof window !== 'undefined'
    ? { pathname: window.location.pathname, search: window.location.search }
    : { pathname: '/', search: '' };
}

export function useDatiWebpliantPagina() {
  const dati = useWebpliantSsr();
  const location = usePosizioneWebpliant();
  return dati?.url === location.pathname + location.search ? dati : null;
}

export function serializzaDatiSsr(dati: unknown): string {
  return JSON.stringify(dati).replace(/[<>&\u2028\u2029]/g, carattere =>
    `\\u${carattere.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export function eRichiestaWebpliantSsr(url: URL): boolean {
  return url.pathname === '/webpliant/volantino'
    && !['debug', 'isEditor', 'date', 'dataSelezionata', 'sessionWishlistId', 'c']
      .some(parametro => url.searchParams.has(parametro));
}

export function datiLoaderWebpliant(dati: DatiWebpliantSsr) {
  return {
    [ID_LAYOUT_WEBPLIANT]: { dataWebPliant: dati.dataWebPliant, config: dati.config },
    [ID_VOLANTINO_WEBPLIANT]: {
      dataWebPliant: dati.dataWebPliant,
      config: dati.config,
      referenze: dati.referenze,
    },
  };
}
