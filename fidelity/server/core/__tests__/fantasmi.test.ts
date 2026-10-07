import { describe, expect, it } from 'vitest';
import { fantasmiIncompleti, reportFuoriListino } from '../utils/fantasmi';

// Un fantasma e un box del volantino che in lista non esiste: nessuno lo ha
// validato, quindi di ognuno serve una decisione prima di poter salvare.
const box = (groupId: number, pag: number) => ({ groupId, pag, dna: `$dna{${groupId}}` });
// I campi obbligatori li dichiara l'agenzia lib: qui quelli di un listino qualsiasi.
const CAMPI = [
  { campo: 'codice', etichetta: 'Codice referenza' },
  { campo: 'descrizione1', etichetta: 'Descrizione 1' },
];

describe('fantasmiIncompleti', () => {
  it('accetta un fantasma compilato con i campi obbligatori', () => {
    const problemi = fantasmiIncompleti(
      [box(101, 4)],
      [{ groupId: 101, pag: 4, ignorato: false, referenze: [{ codice: '1714999', descrizione1: 'Olive' }] }],
      CAMPI,
    );
    expect(problemi).toEqual([]);
  });

  it('accetta un fantasma ignorato di proposito, senza pretendere referenze', () => {
    const problemi = fantasmiIncompleti([box(101, 4)], [{ groupId: 101, pag: 4, ignorato: true, referenze: [] }], CAMPI);
    expect(problemi).toEqual([]);
  });

  it('segnala il box a cui non ha risposto nessuno', () => {
    const problemi = fantasmiIncompleti([box(101, 4), box(102, 7)], [
      { groupId: 101, pag: 4, ignorato: true, referenze: [] },
    ], CAMPI);
    expect(problemi).toHaveLength(1);
    expect(problemi[0]).toMatchObject({ groupId: 102, pag: 7, campi: [] });
    expect(problemi[0].motivo).toContain('senza decisione');
  });

  it('dice quale referenza e quale campo manca, non un generico dati incompleti', () => {
    const problemi = fantasmiIncompleti([box(101, 4)], [{
      groupId: 101, pag: 4, ignorato: false,
      referenze: [
        { codice: '1714999', descrizione1: 'Olive' },
        { codice: '', descrizione1: 'Capperi' },
        { codice: '999', descrizione1: '   ' },
      ],
    }], CAMPI);
    expect(problemi.map((problema) => [problema.referenza, problema.campi])).toEqual([
      [2, ['Codice referenza']],
      [3, ['Descrizione 1']],
    ]);
    expect(problemi[0].motivo).toBe('Referenza 2: manca Codice referenza');
  });

  it('non lascia passare un box accettato ma lasciato vuoto', () => {
    const problemi = fantasmiIncompleti([box(101, 4)], [{ groupId: 101, pag: 4, ignorato: false, referenze: [] }], CAMPI);
    expect(problemi).toHaveLength(1);
    expect(problemi[0].motivo).toContain('senza nessuna referenza');
  });

  it('riaggancia il box col DNA quando il groupId non c\'e', () => {
    const problemi = fantasmiIncompleti(
      [{ dna: '$dna{2699847}', pag: 9 }],
      [{ dna: '$dna{2699847}', pag: 9, ignorato: true, referenze: [] }],
      CAMPI,
    );
    expect(problemi).toEqual([]);
  });
});

describe('reportFuoriListino', () => {
  it('tiene ogni box deciso, ignorati compresi, col testo letto nel volantino', () => {
    const report = reportFuoriListino(
      [
        { ...box(101, 4), compiledFields: [{ content: 'OLIVE VERDI' }, { content: ' 1,99 ' }, { content: '' }] },
        { ...box(102, 7), compiledFields: [{ content: { non: 'testo' } }, { content: 3 }] },
      ],
      [
        { groupId: 101, ignorato: false, referenze: [{ codice: '1714999', descrizione1: 'Olive' }] },
        { groupId: 102, pag: 7, ignorato: true, referenze: [{ codice: 'scartata' }] },
      ],
    );
    expect(report).toEqual([
      { groupId: 101, dna: '$dna{101}', pag: 4, ignorato: false, testoBox: ['OLIVE VERDI', '1,99'], referenze: [{ codice: '1714999', descrizione1: 'Olive' }] },
      { groupId: 102, dna: '$dna{102}', pag: 7, ignorato: true, testoBox: ['3'], referenze: [] },
    ]);
  });

  it('non perde il box se DB1 non lo ha segnalato: resta la decisione, senza testo', () => {
    const report = reportFuoriListino([], [{ dna: '$dna{9}', pag: 2, ignorato: true, referenze: [] }]);
    expect(report).toEqual([{ groupId: undefined, dna: '$dna{9}', pag: 2, ignorato: true, testoBox: [], referenze: [] }]);
  });
});
