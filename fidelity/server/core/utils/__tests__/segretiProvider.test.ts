import { describe, expect, it } from 'vitest';
import { cifraSegreto, decifraSegreto, eSegretoCifrato } from '../segretiProvider';

const CHIAVE = 'segreto-di-prova-non-reale';

describe('segreti dei metodi di accesso', () => {
  it('cifra e decifra con la stessa chiave', () => {
    const cifrato = cifraSegreto('client-secret-123', CHIAVE);

    expect(eSegretoCifrato(cifrato)).toBe(true);
    expect(cifrato).not.toContain('client-secret-123');
    expect(decifraSegreto(cifrato, CHIAVE)).toBe('client-secret-123');
  });

  it('produce un valore diverso a ogni cifratura dello stesso segreto', () => {
    expect(cifraSegreto('uguale', CHIAVE)).not.toBe(cifraSegreto('uguale', CHIAVE));
  });

  it('legge com\'e\' un segreto ancora in chiaro, salvato prima della cifratura', () => {
    expect(eSegretoCifrato('valore-in-chiaro')).toBe(false);
    expect(decifraSegreto('valore-in-chiaro', CHIAVE)).toBe('valore-in-chiaro');
  });

  it('non cifra due volte un segreto gia\' cifrato', () => {
    const cifrato = cifraSegreto('abc', CHIAVE);

    expect(cifraSegreto(cifrato, CHIAVE)).toBe(cifrato);
  });

  it('rifiuta la decifratura con una chiave diversa', () => {
    const cifrato = cifraSegreto('abc', CHIAVE);

    expect(() => decifraSegreto(cifrato, 'altra-chiave')).toThrow(/FICO_SECRET diverso/);
  });

  it('rifiuta un valore cifrato alterato', () => {
    const cifrato = cifraSegreto('abc', CHIAVE);
    const parti = cifrato.split(':');
    parti[4] = Buffer.from('manomesso').toString('base64url');

    expect(() => decifraSegreto(parti.join(':'), CHIAVE)).toThrow();
  });

  it('usa FICO_SECRET della configurazione quando la chiave non e\' indicata', () => {
    expect(decifraSegreto(cifraSegreto('predefinita'))).toBe('predefinita');
  });
});
