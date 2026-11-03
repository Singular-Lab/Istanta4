import { describe, expect, it } from 'vitest';
import type { ImportStorico } from '../../../lib/types';
import { origineStoricoPerReport } from './origineStorico';

// Il report dell'import da storico, condiviso dal dettaglio produttivo del kit e dagli insight

const IMPORT: ImportStorico = {
  importatoIl: '2026-10-30T10:00:00.000Z',
  nomeFile: 'volantino-ottobre.json',
  nonImpaginate: [{ CODICE: '100', DESCRIZIONE: 'Mozzarella' }],
  lasciapassareNonImpaginate: true,
  fuoriListino: [{ codiceBox: 'g7', pag: 3, codice: '200', descrizione: 'Pasta' }],
  fuoriListinoIgnorati: 1,
  boxNelVolantino: 40,
  referenzeDaListino: 38,
};

describe('origineStoricoPerReport', () => {
  it('senza import da storico non produce un report', () => {
    expect(origineStoricoPerReport(null)).toBeUndefined();
    expect(origineStoricoPerReport(undefined)).toBeUndefined();
  });

  it('usa il report finale del plugin senza interpretare i dati del listino', () => {
    const finale = {
      importatoIl: IMPORT.importatoIl, nomeFile: IMPORT.nomeFile,
      boxNelVolantino: 40, referenzeDaListino: 38,
      nonImpaginate: [{ codice: '100', descrizione: 'Mozzarella', campi: [] }],
      lasciapassareNonImpaginate: true, totaleFuoriListino: 1, fuoriListinoIgnorati: 1,
      boxFuoriListino: [],
    };
    const report = origineStoricoPerReport({ ...IMPORT, report: finale });
    expect(report).toBe(finale);

    expect(report).toMatchObject({
      importatoIl: '2026-10-30T10:00:00.000Z',
      nomeFile: 'volantino-ottobre.json',
      boxNelVolantino: 40,
      referenzeDaListino: 38,
      lasciapassareNonImpaginate: true,
      totaleFuoriListino: 1,
      fuoriListinoIgnorati: 1,
    });
    expect(report?.nonImpaginate).toEqual([{ codice: '100', descrizione: 'Mozzarella', campi: [] }]);
  });

  it("senza agenzia lib il record si mostra campo per campo", () => {
    const report = origineStoricoPerReport(IMPORT);

    expect(report?.nonImpaginate).toEqual([
      { codice: '', descrizione: '', campi: [{ label: 'CODICE', valore: '100' }, { label: 'DESCRIZIONE', valore: 'Mozzarella' }] },
    ]);
  });

  it('sugli import precedenti ricostruisce i box dalla lista dei compilati', () => {
    const report = origineStoricoPerReport(IMPORT);

    expect(report?.boxFuoriListino).toEqual([
      { codiceBox: 'g7', pag: 3, ignorato: false, testoBox: [], referenze: [{ codice: '200', descrizione: 'Pasta', campi: [] }] },
    ]);
  });

  it('con i box salvati usa quelli, compresi testo e box ignorati', () => {
    const report = origineStoricoPerReport({
      ...IMPORT,
      boxFuoriListino: [
        { groupId: 7, pag: 3, ignorato: false, testoBox: ['PASTA 500 G'], referenze: [{ CODICE: '200', DESCRIZIONE: 'Pasta' }] },
        { groupId: 8, pag: 4, ignorato: true, testoBox: ['VOCE'], referenze: [] },
      ],
    });

    expect(report?.boxFuoriListino).toEqual([
      { codiceBox: '7', pag: 3, ignorato: false, testoBox: ['PASTA 500 G'], referenze: [{ codice: '', descrizione: '', campi: [{ label: 'CODICE', valore: '200' }, { label: 'DESCRIZIONE', valore: 'Pasta' }] }] },
      { codiceBox: '8', pag: 4, ignorato: true, testoBox: ['VOCE'], referenze: [] },
    ]);
  });
});
