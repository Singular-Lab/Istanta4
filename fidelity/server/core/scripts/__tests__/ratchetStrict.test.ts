import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { confrontaConBaseline, contaErroriTsc, serializzaBaseline } from '../ratchetStrict';

// yarn type-check:strict: il baseline degli errori strict per file puo' solo scendere
describe('contaErroriTsc', () => {
  const radice = path.resolve('/progetto/fidelity');

  it('conta gli errori per file, con percorsi relativi alla radice', () => {
    const output = [
      "server/core/a.ts(10,5): error TS18048: 'x' is possibly 'undefined'.",
      "server/core/a.ts(12,1): error TS2322: Type 'string' is not assignable to type 'number'.",
      "server/ws-server.ts(3,7): error TS7006: Parameter 'p' implicitly has an 'any' type.",
      '  Continuazione del messaggio precedente, da ignorare',
    ].join('\n');

    expect(contaErroriTsc(output, radice)).toEqual({
      conteggio: { 'server/core/a.ts': 2, 'server/ws-server.ts': 1 },
      senzaFile: [],
    });
  });

  it('mette a parte gli errori che non riguardano un file', () => {
    const output = "error TS5103: Invalid value for '--ignoreDeprecations'.";

    expect(contaErroriTsc(output, radice)).toEqual({ conteggio: {}, senzaFile: [output] });
  });
});

describe('confrontaConBaseline', () => {
  it('uguale al baseline: niente da segnalare', () => {
    expect(confrontaConBaseline({ 'a.ts': 2 }, { 'a.ts': 2 })).toEqual({ peggiorati: [], migliorati: [] });
  });

  it('un file con piu\' errori del baseline e\' peggiorato', () => {
    expect(confrontaConBaseline({ 'a.ts': 2 }, { 'a.ts': 3 }).peggiorati).toEqual([{ file: 'a.ts', prima: 2, adesso: 3 }]);
  });

  it('un file nuovo con errori e\' peggiorato', () => {
    expect(confrontaConBaseline({ 'a.ts': 2 }, { 'a.ts': 2, 'b.ts': 1 }).peggiorati).toEqual([{ file: 'b.ts', prima: 0, adesso: 1 }]);
  });

  it('meno errori, o un file ripulito, chiedono di aggiornare il baseline', () => {
    expect(confrontaConBaseline({ 'a.ts': 2, 'b.ts': 1 }, { 'a.ts': 1 })).toEqual({
      peggiorati: [],
      migliorati: [{ file: 'a.ts', prima: 2, adesso: 1 }, { file: 'b.ts', prima: 1, adesso: 0 }],
    });
  });
});

describe('serializzaBaseline', () => {
  it('ordina i file e non scrive quelli senza errori', () => {
    expect(serializzaBaseline({ 'z.ts': 1, 'a.ts': 3, 'm.ts': 0 })).toBe('{\n  "a.ts": 3,\n  "z.ts": 1\n}\n');
  });
});
