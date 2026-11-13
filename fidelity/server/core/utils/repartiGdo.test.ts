import { describe, expect, it } from 'vitest';
import {
  confrontaCodici,
  dizionarioNormalizzato,
  nomeRepartoLeggibile,
  RISOLUTORE_NEUTRO,
  repartiDellaGdo,
  risolutoreReparti,
  type RepartoSalvato,
  verificaRepartiDaSalvare,
} from './repartiGdo';

// Spec impostazioni-gdo: i reparti come li nomina il marketing, con il colore, valgono in ogni
// lettura dei reparti; codici con lo stesso nome per il marketing sono un reparto solo.

const ANAGRAFICA = [
  { codice: '01', descrizione: 'DROGHERIA ALIMENTARE' },
  { codice: '05', descrizione: 'DROGHERIA CHIMICA' },
  { codice: '09', descrizione: 'PROFUMERIA' },
  { codice: '24', descrizione: 'DEPERIBILI LIBERO SERVIZIO' },
];

const salvato = (codice: string, nomeMarketing: string | null, colore: string | null = null, nomeDati = ''): RepartoSalvato =>
  ({ codice, nomeDati, nomeMarketing, colore });

describe('risolutoreReparti', () => {
  it('senza voci salvate e\' neutro: i reparti restano come sono', () => {
    const risolutore = risolutoreReparti([], ANAGRAFICA);

    expect(risolutore).toBe(RISOLUTORE_NEUTRO);
    expect(risolutore.vuoto).toBe(true);
    expect(risolutore.risolvi({ codice: '01', descrizione: 'DROGHERIA ALIMENTARE' })).toEqual({ codice: '01', descrizione: 'DROGHERIA ALIMENTARE' });
    expect(risolutore.nome('Reparto 01')).toBe('Reparto 01');
    // Spec insight-volantino, "Reparti e meccaniche leggibili": la descrizione in maiuscolo come frase
    expect(risolutore.nome('DROGHERIA ALIMENTARE')).toBe('Drogheria alimentare');
  });

  it('nomeRepartoLeggibile: la descrizione in maiuscolo come frase, codici e sigle come sono', () => {
    expect(nomeRepartoLeggibile('DEPERIBILI LIBERO SERVIZIO')).toBe('Deperibili libero servizio');
    expect(nomeRepartoLeggibile('Ortofrutta')).toBe('Ortofrutta');
    expect(nomeRepartoLeggibile('99')).toBe('99');
    expect(nomeRepartoLeggibile('PC')).toBe('PC');
  });

  it('con il nome per il marketing il reparto prende quel nome, com\'e\' scritto, e il colore salvato', () => {
    const risolutore = risolutoreReparti([salvato('09', ' Bellezza e IGIENE ', '#ec4899')], ANAGRAFICA);

    expect(risolutore.risolvi({ codice: '09', descrizione: 'PROFUMERIA' }))
      .toEqual({ codice: '09', descrizione: 'Bellezza e IGIENE', colore: '#ec4899', marketing: true });
  });

  it('il codice si riconosce come negli insight: "9" e "09", anche "Reparto 09" della lettura generica', () => {
    const risolutore = risolutoreReparti([salvato('09', 'Bellezza')], ANAGRAFICA);

    expect(risolutore.risolvi({ codice: '9', descrizione: '' }).descrizione).toBe('Bellezza');
    expect(risolutore.risolvi({ codice: 'Reparto 09', descrizione: 'Reparto 09' }).descrizione).toBe('Bellezza');
  });

  it('senza codice riconosciuto vale il nome: quello nei dati salvato, o la descrizione dell\'anagrafica', () => {
    const risolutore = risolutoreReparti([salvato('09', 'Bellezza'), salvato('EN', 'Vini', null, 'ENOTECA')], ANAGRAFICA);

    expect(risolutore.risolvi({ codice: 'Profumeria', descrizione: 'Profumeria' }).descrizione).toBe('Bellezza');
    expect(risolutore.risolvi({ codice: 'Enoteca', descrizione: ' enoteca ' }).descrizione).toBe('Vini');
  });

  it('codici con lo stesso nome per il marketing (senza maiuscole e spazi doppi) sono un reparto: codice piu\' basso, primo colore', () => {
    const risolutore = risolutoreReparti([
      salvato('24', 'Spesa  di casa', '#eab308'),
      salvato('05', 'SPESA DI CASA', null),
      salvato('1', 'spesa di casa', null),
    ], ANAGRAFICA);

    const atteso = { codice: '1', descrizione: 'spesa di casa', colore: '#eab308', marketing: true };
    expect(risolutore.risolvi({ codice: '24', descrizione: 'DEPERIBILI LIBERO SERVIZIO' })).toEqual(atteso);
    expect(risolutore.risolvi({ codice: '05', descrizione: 'DROGHERIA CHIMICA' })).toEqual(atteso);
    expect(risolutore.risolvi({ codice: '01', descrizione: 'DROGHERIA ALIMENTARE' })).toEqual(atteso);
    // Gia' risolto: resta lo stesso
    expect(risolutore.risolvi(atteso)).toEqual(atteso);
  });

  it('senza nome per il marketing resta il reparto di sempre, con il colore salvato se c\'e\'', () => {
    const risolutore = risolutoreReparti([salvato('01', null, '#f97316'), salvato('05', null)], ANAGRAFICA);

    expect(risolutore.risolvi({ codice: '01', descrizione: 'DROGHERIA ALIMENTARE' })).toEqual({ codice: '01', descrizione: 'DROGHERIA ALIMENTARE', colore: '#f97316' });
    expect(risolutore.risolvi({ codice: '05', descrizione: 'DROGHERIA CHIMICA' })).toEqual({ codice: '05', descrizione: 'DROGHERIA CHIMICA' });
    expect(risolutore.risolvi({ codice: '99', descrizione: 'ALTRO' })).toEqual({ codice: '99', descrizione: 'ALTRO' });
  });

  it('nome: i reparti dei riepiloghi dei kit (descrizione, sigla o "Reparto NN") prendono il nome per il marketing', () => {
    const risolutore = risolutoreReparti([salvato('01', 'Dispensa'), salvato('05', 'Dispensa'), salvato('PC', 'Pulizia')], ANAGRAFICA);

    expect(risolutore.nome('Drogheria alimentare')).toBe('Dispensa');
    expect(risolutore.nome('Drogheria chimica')).toBe('Dispensa');
    expect(risolutore.nome('Reparto 05')).toBe('Dispensa');
    expect(risolutore.nome('PC')).toBe('Pulizia');
    expect(risolutore.nome('Profumeria')).toBe('Profumeria');
    // Senza nome per il marketing, la descrizione dell'anagrafica come frase
    expect(risolutore.nome('DEPERIBILI LIBERO SERVIZIO')).toBe('Deperibili libero servizio');
    expect(risolutore.nome('')).toBe('');
  });
});

describe('repartiDellaGdo: l\'elenco delle Impostazioni GDO', () => {
  it('anagrafica, voci salvate e reparti delle referenze insieme, per codice, con i conteggi', () => {
    const reparti = repartiDellaGdo(
      ANAGRAFICA,
      [salvato('9', 'Bellezza', '#ec4899', 'PROFUMERIA'), salvato('77', 'Fiori', null, 'FIORERIA')],
      [
        { codice: '1', descrizione: null, referenze: 40 },
        { codice: '01', descrizione: 'DROGHERIA ALIMENTARE', referenze: 12 },
        { codice: '09', descrizione: 'PROFUMERIA', referenze: 5 },
        { codice: null, descrizione: 'Deperibili libero servizio', referenze: 3 },
        { codice: '31', descrizione: 'PESCE', referenze: 7 },
        { codice: null, descrizione: null, referenze: 99 },
      ],
      dizionarioNormalizzato({ PROFUMERIA: 'Bellezza e igiene', 'DROGHERIA  ALIMENTARE': 'Alimentari', PESCE: 42 }),
    );

    expect(reparti).toEqual([
      { codice: '01', nomeDati: 'DROGHERIA ALIMENTARE', nomeMarketing: null, colore: null, referenze: 52, daNominare: true, suggerimento: 'Alimentari' },
      { codice: '05', nomeDati: 'DROGHERIA CHIMICA', nomeMarketing: null, colore: null, referenze: 0, daNominare: false, suggerimento: null },
      { codice: '09', nomeDati: 'PROFUMERIA', nomeMarketing: 'Bellezza', colore: '#ec4899', referenze: 5, daNominare: false, suggerimento: 'Bellezza e igiene' },
      { codice: '24', nomeDati: 'DEPERIBILI LIBERO SERVIZIO', nomeMarketing: null, colore: null, referenze: 3, daNominare: true, suggerimento: null },
      { codice: '31', nomeDati: 'PESCE', nomeMarketing: null, colore: null, referenze: 7, daNominare: true, suggerimento: null },
      { codice: '77', nomeDati: 'FIORERIA', nomeMarketing: 'Fiori', colore: null, referenze: 0, daNominare: false, suggerimento: null },
    ]);
  });

  it('un reparto senza codice ne\' anagrafica prende la descrizione dei dati come codice e nome', () => {
    expect(repartiDellaGdo([], [], [{ codice: null, descrizione: 'ENOTECA', referenze: 2 }])).toEqual([
      { codice: 'ENOTECA', nomeDati: 'ENOTECA', nomeMarketing: null, colore: null, referenze: 2, daNominare: true, suggerimento: null },
    ]);
  });

  it('i codici numerici in ordine di numero, poi gli altri', () => {
    expect(['21', 'PC', '3', '03b', '100'].sort(confrontaCodici)).toEqual(['3', '21', '100', '03b', 'PC']);
  });
});

describe('verificaRepartiDaSalvare', () => {
  it('codice non vuoto, colore #rrggbb o null, nome per il marketing senza spazi ai lati o null', () => {
    expect(verificaRepartiDaSalvare({
      reparti: [
        { codice: ' 01 ', nomeDati: 'DROGHERIA ALIMENTARE', nomeMarketing: '  Dispensa ', colore: '#F97316' },
        { codice: '05', nomeDati: 'DROGHERIA CHIMICA', nomeMarketing: '   ', colore: null },
        { codice: '09', nomeMarketing: null },
      ],
    })).toEqual({
      reparti: [
        { codice: '01', nomeDati: 'DROGHERIA ALIMENTARE', nomeMarketing: 'Dispensa', colore: '#F97316' },
        { codice: '05', nomeDati: 'DROGHERIA CHIMICA', nomeMarketing: null, colore: null },
        { codice: '09', nomeDati: '', nomeMarketing: null, colore: null },
      ],
      errori: [],
    });
  });

  it('gli errori dicono dove: elenco mancante, codice vuoto o doppio, colore non valido, tipi sbagliati', () => {
    expect(verificaRepartiDaSalvare({}).errori).toEqual(['reparti deve essere un elenco']);
    expect(verificaRepartiDaSalvare(null).errori).toEqual(['reparti deve essere un elenco']);
    expect(verificaRepartiDaSalvare({
      reparti: [
        'testo',
        { codice: '' },
        { codice: '1' },
        { codice: '01' },
        { codice: '02', colore: 'rosso' },
        { codice: '03', colore: '#abc' },
        { codice: '04', nomeMarketing: 5 },
      ],
    }).errori).toEqual([
      'reparti.0: deve essere un oggetto',
      'reparti.1.codice: deve essere un testo non vuoto',
      "reparti.3.codice: il reparto 01 compare piu' di una volta",
      'reparti.4.colore: deve essere un colore #rrggbb o null',
      'reparti.5.colore: deve essere un colore #rrggbb o null',
      'reparti.6.nomeMarketing: deve essere un testo o null',
    ]);
  });
});
