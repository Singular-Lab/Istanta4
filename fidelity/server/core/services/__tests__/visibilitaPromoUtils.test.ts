import { describe, expect, it } from 'vitest';
import { confrontaConVisibilita, filtraPerVisibilita, normalizzaMeta, normalizzaVisibilita } from '../visibilitaPromoUtils';

// La lista soci arriva con tutti i canali e tutte le aree (I20-958).
const A_MENO = 'c-a-meno';
const A = 'c-a';
const B = 'c-b';
const B1 = 'c-b1';
const UFI = 'a-ufi';
const TDM = 'a-tdm';

const listaSoci = [A_MENO, A, B, B1].flatMap(guidCanale =>
  [UFI, TDM].map(guidArea => ({ guidCanale, guidArea, context: '[]', records: [] })),
);
const combinazioni = (tracciati: Array<{ guidCanale: string; guidArea: string }>) =>
  tracciati.map(t => `${t.guidCanale}/${t.guidArea}`);

describe('filtraPerVisibilita', () => {
  it('con soli canali tiene quei canali su tutte le aree', () => {
    const risultato = filtraPerVisibilita(listaSoci, { canali: [B, B1], aree: [] });
    expect(combinazioni(risultato)).toEqual([`${B}/${UFI}`, `${B}/${TDM}`, `${B1}/${UFI}`, `${B1}/${TDM}`]);
  });

  it('con canale e area tiene solo la combinazione', () => {
    const risultato = filtraPerVisibilita(listaSoci, { canali: [A], aree: [UFI] });
    expect(combinazioni(risultato)).toEqual([`${A}/${UFI}`]);
  });

  it('con sole aree tiene quelle aree su tutti i canali', () => {
    expect(filtraPerVisibilita(listaSoci, { canali: [], aree: [TDM] })).toHaveLength(4);
  });

  it('senza scelta non filtra', () => {
    expect(filtraPerVisibilita(listaSoci, null)).toBe(listaSoci);
  });

  it('confronta i GUID senza badare a maiuscole e spazi', () => {
    const risultato = filtraPerVisibilita([{ guidCanale: ' C-A ', guidArea: UFI }], { canali: [A], aree: [] });
    expect(risultato).toHaveLength(1);
  });
});

describe('normalizzaVisibilita', () => {
  it('tiene solo le dimensioni abilitate per il cliente', () => {
    expect(normalizzaVisibilita({ canali: [B], aree: [UFI] }, ['canale'])).toEqual({ canali: [B], aree: [] });
  });

  it('senza dimensioni abilitate non c\'e scelta', () => {
    expect(normalizzaVisibilita({ canali: [B], aree: [UFI] })).toBeNull();
  });

  it('liste vuote o input non valido diventano null', () => {
    expect(normalizzaVisibilita({ canali: [], aree: [] }, ['canale', 'area'])).toBeNull();
    expect(normalizzaVisibilita('B', ['canale', 'area'])).toBeNull();
    expect(normalizzaVisibilita(null, ['canale', 'area'])).toBeNull();
  });

  it('scarta valori vuoti e duplicati', () => {
    expect(normalizzaVisibilita({ canali: [B, ' ', 'C-B', null] }, ['canale'])).toEqual({ canali: [B], aree: [] });
  });
});

describe('normalizzaMeta', () => {
  const dimensioni = ['canale', 'area'] as const;
  const attuale = { visibilita: { canali: [A], aree: [] }, altro: 1 } as never;

  it('aggiorna la visibilita e lascia le altre chiavi gia salvate', () => {
    const meta = normalizzaMeta({ visibilita: { canali: [B] } }, attuale, [...dimensioni]);
    expect(meta).toEqual({ visibilita: { canali: [B], aree: [] }, altro: 1 });
  });

  it('visibilita null la rimuove', () => {
    expect(normalizzaMeta({ visibilita: null }, attuale, [...dimensioni])).toEqual({ altro: 1 });
  });

  it('senza la chiave visibilita la lascia invariata', () => {
    expect(normalizzaMeta({}, attuale, [...dimensioni])).toEqual(attuale);
  });

  it('scarta le chiavi sconosciute in ingresso', () => {
    expect(normalizzaMeta({ sconosciuta: 'x' }, {}, [...dimensioni])).toEqual({});
  });

  it('input non valido lascia il meta com\'era', () => {
    expect(normalizzaMeta('x', null, [...dimensioni])).toEqual({});
  });
});

describe('confrontaConVisibilita', () => {
  it('nessun avviso se il risultato corrisponde alla scelta', () => {
    const visibilita = { canali: [B, B1], aree: [] };
    expect(confrontaConVisibilita(filtraPerVisibilita(listaSoci, visibilita), visibilita)).toBeNull();
  });

  it('segnala canali non visibili in un momento calcolato prima della scelta', () => {
    const avviso = confrontaConVisibilita(listaSoci, { canali: [B, B1], aree: [] });
    expect(avviso).toEqual({ canaliFuori: [A_MENO, A], areeFuori: [], canaliMancanti: [], areeMancanti: [] });
  });

  it('segnala canali e aree scelti ma assenti dal momento', () => {
    const momento = listaSoci.filter(t => t.guidCanale === A && t.guidArea === UFI);
    const avviso = confrontaConVisibilita(momento, { canali: [A, B], aree: [UFI, TDM] });
    expect(avviso).toEqual({ canaliFuori: [], areeFuori: [], canaliMancanti: [B], areeMancanti: [TDM] });
  });

  it('nessun avviso senza scelta o senza risultato', () => {
    expect(confrontaConVisibilita(listaSoci, null)).toBeNull();
    expect(confrontaConVisibilita(null, { canali: [B], aree: [] })).toBeNull();
  });
});
