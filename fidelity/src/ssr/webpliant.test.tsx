// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query';
import { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, useLoaderData } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerCall } from '../../lib/server_call';
import type { Config, PageLayoutItem, ReferenzeIstanta } from '../../lib/types';
import { AppProviders } from '../app/AppProviders';
import { GestioneReferenzeProvider } from '../context/GestioneReferenzeContext';
import { renderWebpliant } from '../entry-server';
import BoxRef from '../pages/WebPliant/BoxRef';
import CarouselContainer from '../pages/WebPliant/CarouselContainer';
import { carouselReducer, type CarouselState } from '../pages/WebPliant/carouselReducer';
import { GestoreParametriPresente } from '../pages/WebPliant/gestoreParametri';
import GridReferenze from '../pages/WebPliant/GridReferenze';
import { createAppStore } from '../stores/store';
import { eRichiestaWebpliantSsr, serializzaDatiSsr, type DatiWebpliantSsr } from './webpliant';

vi.mock('../../lib/server_call', () => ({ ServerCall: { get: vi.fn().mockResolvedValue({}), post: vi.fn().mockResolvedValue([]), put: vi.fn().mockResolvedValue('sessione-test') } }));
vi.mock('@/pages/WebPliant/BoxRef/ref', async importOriginal => ({
  ...await importOriginal<typeof import('../pages/WebPliant/BoxRef/ref')>(),
  generaContenutoDinamico: ({ referenza }: { referenza: ReferenzeIstanta }) =>
    <article><h2>{String(referenza.dataFields.descrizione ?? '')}</h2><p>{String(referenza.dataFields.prezzo ?? '')}</p></article>,
}));
vi.mock('@/pages/WebPliant/CarouselSwiper', () => ({
  default: ({ referenze, config }: { referenze: ReferenzeIstanta[]; config: Config }) =>
    <div>{referenze.map((referenza, indice) => <BoxRef key={indice} referenza={referenza} config={config} />)}</div>,
}));
vi.mock('../router', () => ({ default: [{
  id: 'webpliant-layout', path: '/webpliant', children: [{
    id: 'webpliant-volantino', path: 'volantino', Component: function PaginaDiTest() {
      const dati = useLoaderData() as { referenze: ReferenzeIstanta[] };
      return <main>{dati.referenze.map((ref, indice) => <p key={indice}>{String(ref.dataFields.descrizione ?? '')} {String(ref.dataFields.prezzo ?? '')}</p>)}</main>;
    },
  }],
}] }));

const URL_VOLANTINO = '/webpliant/volantino?id=w1&idArea=a1&idCanale=c1';
const referenza = { foto: ['foto-test.jpg'], fotoExtra: [], groupElements: [], dataFields: { codice_referenza: '00123', descrizione: 'Latte di test', prezzo: '1,99' } } as unknown as ReferenzeIstanta;
const config = { webpliant: { stili: [{ condizioni: 'default', struttura: {} }] } } as unknown as Config;
const griglia = { id: 'griglia', type: 'griglia_referenze', content: {} } as PageLayoutItem;
const carosello = { id: 'carosello', type: 'carousel', content: {} } as PageLayoutItem;
const dati = {
  url: URL_VOLANTINO, giorno: '2026-11-03', idPagina: 'home',
  dataWebPliant: { idWorkspace: 'w1', idArea: 'a1', idCanale: 'c1', idGDO: 'g1', nomeWorkspace: 'Test' },
  config, referenze: [referenza], css: '',
  blocchi: { griglia: { referenze: [referenza], validita: '' }, carosello: { referenze: [referenza], validita: 'Valido oggi' } },
} as unknown as DatiWebpliantSsr;

let root: Root | undefined;
let queryClient: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterEach(async () => {
  if (root) await act(async () => { root?.unmount(); });
  root = undefined;
  queryClient.clear();
  document.body.innerHTML = '';
});

function blocchi(store = createAppStore()) {
  return <AppProviders queryClient={queryClient} store={store} datiSsr={dati}>
    <MemoryRouter initialEntries={[URL_VOLANTINO]}>
      <GestioneReferenzeProvider><GestoreParametriPresente>
        <GridReferenze item={griglia} config={config} />
        <CarouselContainer item={carosello} config={config} pagine={[]} />
      </GestoreParametriPresente></GestioneReferenzeProvider>
    </MemoryRouter>
  </AppProviders>;
}

describe('rendering iniziale WebPliant', () => {
  it('raggruppa le referenze e cambia tab senza traduzioni o chiamate HTTP nel reducer', () => {
    const latticini = { ...referenza, dataFields: { ...referenza.dataFields, reparto: 'latticini' } };
    const bevande = { ...referenza, dataFields: { ...referenza.dataFields, reparto: 'bevande' } };
    const stato: CarouselState = { tabs: [], activeTab: '', referenzeGroupedBy: [[]] };
    const raggruppato = carouselReducer(stato, {
      type: 'INIT',
      payload: {
        referenze: [latticini, bevande],
        item: { ...carosello, content: { options: { carouselType: 'groupedby', carouselTypeField: 'reparto' } } },
      },
    });
    expect(raggruppato.tabs).toEqual(['latticini', 'bevande']);
    expect(raggruppato.displayNames).toEqual(['latticini', 'bevande']);
    expect(raggruppato.referenzeGroupedBy).toEqual([[latticini], [bevande]]);
    expect(raggruppato.activeTab).toBe('latticini');
    const selezionato = carouselReducer(raggruppato, { type: 'SET_ACTIVE_TAB', payload: 'bevande' });
    expect(selezionato.activeTab).toBe('bevande');
    expect(selezionato.referenzeGroupedBy).toBe(raggruppato.referenzeGroupedBy);
    expect(stato.tabs).toEqual([]);
    expect(ServerCall.get).not.toHaveBeenCalled();
    expect(ServerCall.post).not.toHaveBeenCalled();
    expect(ServerCall.put).not.toHaveBeenCalled();
  });

  it('mantiene le referenze in un solo gruppo quando non sono configurate opzioni', () => {
    const stato = carouselReducer({ tabs: [], activeTab: '', referenzeGroupedBy: [[]] }, {
      type: 'INIT', payload: { referenze: [referenza], item: griglia },
    });
    expect(stato.tabs).toEqual([]);
    expect(stato.activeTab).toBe('');
    expect(stato.referenzeGroupedBy).toEqual([[referenza]]);
    expect(ServerCall.get).not.toHaveBeenCalled();
  });

  it('griglia, carosello e schede contengono descrizione e prezzo prima degli effetti', () => {
    const html = renderToString(blocchi());
    expect(html.match(/Latte di test/g)).toHaveLength(2);
    expect(html.match(/1,99/g)).toHaveLength(2);
    expect(html).toContain('Valido oggi');
    expect(ServerCall.post).not.toHaveBeenCalled();
    expect(ServerCall.put).not.toHaveBeenCalled();
  });

  it('riusa HTML e dati durante hydration senza refetch iniziale dei blocchi', async () => {
    const store = createAppStore();
    const contenitore = document.createElement('div');
    contenitore.innerHTML = renderToString(blocchi(store));
    document.body.appendChild(contenitore);
    localStorage.setItem('darkMode', 'true');
    const errori: unknown[] = [];
    await act(async () => {
      root = hydrateRoot(contenitore, blocchi(createAppStore(store.getState())), { onRecoverableError: errore => errori.push(errore) });
    });
    expect(errori).toEqual([]);
    expect(contenitore.textContent).toContain('Latte di test');
    expect(ServerCall.post).not.toHaveBeenCalled();
  });

  it('il renderer statico fornisce il contenuto e lo stato dei loader senza fetch browser', async () => {
    const risposta = await renderWebpliant(dati);
    expect(risposta.html).toContain('Latte di test');
    expect(risposta.html).toContain('1,99');
    expect(risposta.bootstrap.dati.idPagina).toBe('home');
    expect(risposta.bootstrap.reduxState).toHaveProperty('darkMode');
    expect(ServerCall.post).not.toHaveBeenCalled();
  });

  it('serializza i dati senza sequenze capaci di chiudere un tag script', () => {
    const originale = { titolo: '</script><img src=x>&\u2028\u2029' };
    const serializzato = serializzaDatiSsr(originale);
    expect(serializzato).not.toContain('<');
    expect(JSON.parse(serializzato)).toEqual(originale);
  });

  it('limita SSR alla consultazione pubblica ordinaria', () => {
    expect(eRichiestaWebpliantSsr(new URL(URL_VOLANTINO, 'http://test'))).toBe(true);
    expect(eRichiestaWebpliantSsr(new URL(`${URL_VOLANTINO}&debug=false`, 'http://test'))).toBe(false);
    expect(eRichiestaWebpliantSsr(new URL('/gdo/dashboard', 'http://test'))).toBe(false);
  });
});
