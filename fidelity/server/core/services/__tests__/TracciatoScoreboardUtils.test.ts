import { describe, expect, it, vi } from 'vitest';
import type { DataFields } from '../../../../lib/types';
import type { CellaConfronto, IAgenziaLib, PromoScoreboardInput } from '../../agenzia_lib/types';
import { normalizeCode, removeSinglesIncludedInGroups, resolveGroupMembersFromScattoCodice } from '../TracciatoScoreboardUtils';
import { TracciatoService } from '../TracciatoService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

type RecordCodici = { codice_referenza?: unknown; scatto_codice?: unknown; tipo?: unknown };

describe('normalizeCode', () => {
  it('toglie gli spazi ai bordi del codice testuale', () => {
    expect(normalizeCode('  A123 ')).toBe('A123');
  });

  it('un codice numerico diventa la sua forma testuale senza perdere cifre', () => {
    expect(normalizeCode(12345)).toBe('12345');
    expect(normalizeCode(8001234567890)).toBe('8001234567890');
  });

  it('null, undefined e valori non validi valgono stringa vuota', () => {
    expect(normalizeCode(null)).toBe('');
    expect(normalizeCode(undefined)).toBe('');
    expect(normalizeCode(Number.NaN)).toBe('');
  });
});

describe('resolveGroupMembersFromScattoCodice', () => {
  it('separa i membri del gruppo togliendo spazi, vuoti e doppioni', () => {
    expect(resolveGroupMembersFromScattoCodice(' A1, B2 ,A1,, ', 'X9')).toEqual(['A1', 'B2']);
  });

  it('uno scatto vuoto o uguale al codice non è un gruppo', () => {
    expect(resolveGroupMembersFromScattoCodice('', 'A1')).toEqual([]);
    expect(resolveGroupMembersFromScattoCodice(' A1 ', 'A1')).toEqual([]);
  });

  it('uno scatto numerico resta nel gruppo e si confronta col codice come testo', () => {
    expect(resolveGroupMembersFromScattoCodice(67890, 'A1')).toEqual(['67890']);
    expect(resolveGroupMembersFromScattoCodice(12345, '12345')).toEqual([]);
  });
});

describe('removeSinglesIncludedInGroups', () => {
  it('pota i singoli già inclusi in un gruppo e lascia gruppo e singoli non inclusi', () => {
    const primario = new Map<string, RecordCodici>([
      ['A1,B2', { scatto_codice: 'A1,B2', codice_referenza: 'A1' }],
      ['A1', { codice_referenza: 'A1' }],
      ['C3', { codice_referenza: 'C3' }],
    ]);
    const secondario = new Map<string, RecordCodici>([
      ['B2', { codice_referenza: 'B2' }],
    ]);

    removeSinglesIncludedInGroups(primario, secondario);

    expect([...primario.keys()]).toEqual(['A1,B2', 'C3']);
    expect([...secondario.keys()]).toEqual([]);
  });

  it('usa i codici raggruppati indicati da fuori e senza gruppi non pota nulla', () => {
    const primario = new Map<string, RecordCodici>([['A1', { codice_referenza: 'A1' }], ['C3', { codice_referenza: 'C3' }]]);
    const secondario = new Map<string, RecordCodici>([['C3', { codice_referenza: 'C3' }]]);

    removeSinglesIncludedInGroups(primario, secondario);
    expect([...primario.keys()]).toEqual(['A1', 'C3']);

    removeSinglesIncludedInGroups(primario, secondario, new Set(['A1']));
    expect([...primario.keys()]).toEqual(['C3']);
    expect([...secondario.keys()]).toEqual(['C3']);
  });
});

describe('TracciatoService: codici numerici nello scoreboard', () => {
  // Il tipo dichiara codice_referenza stringa, ma da Istanta può arrivare un numero
  const record = (valori: Record<string, unknown>): DataFields => valori as unknown as DataFields;

  const confronto = (primari: DataFields[], secondari: DataFields[]): PromoScoreboardInput[number] => ({
    primarioNome: 'Momento 1',
    secondarioNome: 'Momento 2',
    risultato: {
      primario: { guidId: 'm1', nomeMomento: 'Momento 1', tracciati: [{ guidCanale: 'c1', guidArea: 'a1', context: '[]', records: primari }] },
      secondario: { guidId: 'm2', nomeMomento: 'Momento 2', tracciati: [{ guidCanale: 'c1', guidArea: 'a1', context: '[]', records: secondari }] },
    },
  });

  const agenziaLib = {
    getChangedFields: vi.fn(() => []),
    computeContributo: vi.fn(() => ({ contributoRaw: 0, hasTerremoto: false })),
  } as unknown as IAgenziaLib;

  it('un codice numerico e lo stesso codice testuale sono la stessa referenza, non escono dal confronto', () => {
    const matrice = TracciatoService._buildMatricePromo([
      confronto(
        [record({ codiceKey: 'K1', codice_referenza: 12345, reparto: 'Ortofrutta' })],
        [record({ codiceKey: 'K1', codice_referenza: '12345', reparto: 'Ortofrutta' })],
      ),
    ], agenziaLib);

    const celle = matrice[0].celle;
    expect(celle).toHaveLength(1);
    expect(celle[0]).toMatchObject({ outerKey: 'K1', stato: 'inalterata', totaleReferenzeNelGruppo: 1 });
  });

  it('buildRows conta per reparto la referenza con codice numerico', () => {
    const matrice = TracciatoService._buildMatricePromo([
      confronto(
        [record({ codiceKey: 'K1', codice_referenza: 12345, reparto: 'Ortofrutta' })],
        [],
      ),
    ], agenziaLib);

    const righe = TracciatoService.buildRows(matrice[0].celle);

    expect(righe).toHaveLength(1);
    expect(righe[0]).toMatchObject({ reparto: 'Ortofrutta', uscenti: 1, totale: 1 });
  });

  it('buildRows ignora le celle di un codice non presente nel confronto', () => {
    const cella = (stato: CellaConfronto['stato']): CellaConfronto => ({
      outerKey: 'K1', canaleArea: 'c1::a1', repartoNome: 'Ortofrutta', confrontoIndex: 0,
      labelPrimario: 'Momento 1', labelSecondario: 'Momento 2', stato,
      campiModificatiCumulativi: [], campiDettaglio: {}, campiStoria: {},
      piPrimaDellEvento: 100, contributo: 0, piDopoEvento: 100, hasTerremoto: false,
      totaleReferenzeNelGruppo: 1, scattoCodice: '', codiceReferenza: '12345',
    });

    expect(TracciatoService.buildRows([cella('non_esistente')])).toEqual([]);
    expect(TracciatoService.buildRows([cella('inalterata')])[0]).toMatchObject({ reparto: 'Ortofrutta', inalterati: 1 });
  });
});
