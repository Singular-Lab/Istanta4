import { describe, expect, it } from 'vitest';
import {
  applicaAnagraficaReparti,
  leggiAnagraficaReparti,
  repartoInAnagrafica,
  valoreCampo,
  type RepartoAnagrafica,
} from './campiInsights';

const ANAGRAFICA: RepartoAnagrafica[] = [
  { codice: '01', descrizione: 'DROGHERIA ALIMENTARE' },
  { codice: '05', descrizione: 'DROGHERIA CHIMICA' },
  { codice: '24', descrizione: 'DEPERIBILI LIBERO SERVIZIO' },
];

describe('valoreCampo', () => {
  const istanta = { meccanica: 'TP_FID_KgL', data_fields: { reparto: '01', prezzo: '2,69' }, foto: ['guid-1'] };
  const storico = { meccanica: '', data_fields: { reparto: '1', meccanica: 'TP_MM' }, foto: [] };

  it('un percorso: il valore come testo, \'\' se manca, array e oggetti come sono', () => {
    expect(valoreCampo(istanta, 'data_fields.reparto')).toBe('01');
    expect(valoreCampo(istanta, 'data_fields.descrizione_reparto')).toBe('');
    expect(valoreCampo(istanta, 'foto')).toEqual(['guid-1']);
    expect(valoreCampo({ data_fields: { pezzi: 3 } }, 'data_fields.pezzi')).toBe('3');
  });

  it('piu\' percorsi: vale il primo non vuoto (meccanica di Istanta nella colonna, dello storico nei dati)', () => {
    const percorsi = ['meccanica', 'data_fields.meccanica'];
    expect(valoreCampo(istanta, percorsi)).toBe('TP_FID_KgL');
    expect(valoreCampo(storico, percorsi)).toBe('TP_MM');
  });

  it('piu\' percorsi tutti vuoti: il valore del primo, cosi\' le foto restano un elenco', () => {
    expect(valoreCampo(storico, ['foto', 'data_fields.foto'])).toEqual([]);
    expect(valoreCampo({}, ['meccanica', 'data_fields.meccanica'])).toBe('');
    expect(valoreCampo(istanta, [])).toBe('');
  });

  it('una chiave che contiene il punto si legge per intero', () => {
    const febbraio = { data_fields: { 'Referenza.Codice': '123456', 'Descrizioni.Descrizione1': 'Pasta' } };
    expect(valoreCampo(febbraio, 'data_fields.Referenza.Codice')).toBe('123456');
    expect(valoreCampo(febbraio, ['data_fields.descrizione_uno', 'data_fields.Descrizioni.Descrizione1'])).toBe('Pasta');
  });
});

describe('leggiAnagraficaReparti', () => {
  it('tiene solo le voci con codice e descrizione', () => {
    expect(leggiAnagraficaReparti([
      { codice: ' 01 ', descrizione: 'DROGHERIA ALIMENTARE' },
      { codice: '02' },
      { codice: '', descrizione: 'VUOTO' },
      'BEVANDE',
      null,
    ])).toEqual([{ codice: '01', descrizione: 'DROGHERIA ALIMENTARE' }]);
  });

  it('senza anagrafica nella config: nessun reparto', () => {
    expect(leggiAnagraficaReparti(undefined)).toEqual([]);
    expect(leggiAnagraficaReparti({ '01': 'DROGHERIA ALIMENTARE' })).toEqual([]);
  });
});

describe('repartoInAnagrafica', () => {
  it('stesso reparto dal codice con o senza zero iniziale', () => {
    expect(repartoInAnagrafica(ANAGRAFICA, '1', '')?.codice).toBe('01');
    expect(repartoInAnagrafica(ANAGRAFICA, '01', '')?.codice).toBe('01');
    expect(repartoInAnagrafica(ANAGRAFICA, ' 24 ', undefined)?.descrizione).toBe('DEPERIBILI LIBERO SERVIZIO');
  });

  it('senza codice, o con un codice che non c\'e\', dalla descrizione senza badare a maiuscole e spazi', () => {
    expect(repartoInAnagrafica(ANAGRAFICA, '', 'drogheria  chimica ')?.codice).toBe('05');
    expect(repartoInAnagrafica(ANAGRAFICA, 'PC', 'DROGHERIA CHIMICA')?.codice).toBe('05');
  });

  it('reparto fuori anagrafica: nessuno', () => {
    expect(repartoInAnagrafica(ANAGRAFICA, '99', '')).toBeUndefined();
    expect(repartoInAnagrafica(ANAGRAFICA, '', '')).toBeUndefined();
    expect(repartoInAnagrafica(ANAGRAFICA, undefined, 'PROFUMERIA')).toBeUndefined();
  });
});

describe('applicaAnagraficaReparti', () => {
  it('storico: il codice "1" senza descrizione diventa il reparto 01 dell\'anagrafica', () => {
    const referenza: Record<string, unknown> = { reparto: '1', descrizioneReparto: '' };
    applicaAnagraficaReparti(referenza, ANAGRAFICA, 'reparto', 'descrizioneReparto');
    expect(referenza).toEqual({ reparto: '01', descrizioneReparto: 'DROGHERIA ALIMENTARE' });
  });

  it('reparto fuori anagrafica, o anagrafica vuota: la referenza resta com\'e\'', () => {
    const fuori: Record<string, unknown> = { reparto: '99', descrizioneReparto: '' };
    applicaAnagraficaReparti(fuori, ANAGRAFICA, 'reparto', 'descrizioneReparto');
    expect(fuori).toEqual({ reparto: '99', descrizioneReparto: '' });

    const senzaAnagrafica: Record<string, unknown> = { reparto: '1' };
    applicaAnagraficaReparti(senzaAnagrafica, [], 'reparto', 'descrizioneReparto');
    expect(senzaAnagrafica).toEqual({ reparto: '1' });
  });

  it('senza campo descrizione nella config: cambia solo il codice', () => {
    const referenza: Record<string, unknown> = { reparto: '5' };
    applicaAnagraficaReparti(referenza, ANAGRAFICA, 'reparto');
    expect(referenza).toEqual({ reparto: '05' });
  });
});
