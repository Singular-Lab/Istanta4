import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATO_PROMO } from '../../../../lib/enums';
import { statoAutomaticoPromo } from '../statoAutomaticoPromo';

// Le 23:30 UTC del 10 ottobre: a Roma è già l'11
const ADESSO = new Date('2026-10-10T23:30:00Z');

const promo = (
  stato: STATO_PROMO,
  validita_dal: string | null,
  validita_al: string | null,
  data_scadenza: string | null = null,
) => ({
  stato,
  validita_dal: validita_dal ? new Date(validita_dal) : null,
  validita_al: validita_al ? new Date(validita_al) : null,
  data_scadenza: data_scadenza ? new Date(data_scadenza) : null,
});

beforeEach(() => {
  // Server in UTC come nel container
  vi.stubEnv('TZ', 'UTC');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('statoAutomaticoPromo', () => {
  it('validità tutta nel passato: ARCHIVIATA', () => {
    expect(statoAutomaticoPromo(
      promo(STATO_PROMO.PIANIFICATA, '2026-09-04T00:00:00Z', '2026-09-13T00:00:00Z', '2026-09-01T00:00:00Z'),
      ADESSO,
    )).toBe(STATO_PROMO.ARCHIVIATA);
  });

  it('giorno di Roma: valida fino al 10, alle 23:30 UTC del 10 è già archiviata, alle 21:30 UTC no', () => {
    const finitaIl10 = promo(STATO_PROMO.VALIDA, '2026-10-01T00:00:00Z', '2026-10-10T00:00:00Z');

    expect(statoAutomaticoPromo(finitaIl10, ADESSO)).toBe(STATO_PROMO.ARCHIVIATA);
    expect(statoAutomaticoPromo(finitaIl10, new Date('2026-10-10T21:30:00Z'))).toBe(STATO_PROMO.VALIDA);
  });

  it('nel periodo di validità: VALIDA, anche per una ARCHIVIATA con le date spostate in avanti', () => {
    expect(statoAutomaticoPromo(
      promo(STATO_PROMO.PIANIFICATA, '2026-10-05T00:00:00Z', '2026-10-20T00:00:00Z'),
      ADESSO,
    )).toBe(STATO_PROMO.VALIDA);
    expect(statoAutomaticoPromo(
      promo(STATO_PROMO.ARCHIVIATA, '2026-10-05T00:00:00Z', '2026-10-20T00:00:00Z'),
      ADESSO,
    )).toBe(STATO_PROMO.VALIDA);
  });

  it('una VALIDA_CON_ERRORI nel periodo di validità resta com\'è', () => {
    expect(statoAutomaticoPromo(
      promo(STATO_PROMO.VALIDA_CON_ERRORI, '2026-10-05T00:00:00Z', '2026-10-20T00:00:00Z'),
      ADESSO,
    )).toBeNull();
  });

  it('scadenza superata prima dell\'inizio della validità: IN_RITARDO', () => {
    // Scadenza il 10 a Roma: l'11 è già passata
    expect(statoAutomaticoPromo(
      promo(STATO_PROMO.PIANIFICATA, '2026-10-20T00:00:00Z', '2026-10-30T00:00:00Z', '2026-10-09T22:00:00Z'),
      ADESSO,
    )).toBe(STATO_PROMO.IN_RITARDO);
  });

  it.each([
    ['tra 4 giorni', '2026-10-15T00:00:00Z'],
    ['tra 7 giorni', '2026-10-18T00:00:00Z'],
  ])('scadenza %s: IN_SCADENZA', (_quando, scadenza) => {
    expect(statoAutomaticoPromo(
      promo(STATO_PROMO.PIANIFICATA, '2026-10-20T00:00:00Z', '2026-10-30T00:00:00Z', scadenza),
      ADESSO,
    )).toBe(STATO_PROMO.IN_SCADENZA);
  });

  it('promo futura con la scadenza oltre 7 giorni: nessuno stato imposto', () => {
    expect(statoAutomaticoPromo(
      promo(STATO_PROMO.PIANIFICATA, '2026-11-01T00:00:00Z', '2026-11-10T00:00:00Z', '2026-10-25T00:00:00Z'),
      ADESSO,
    )).toBeNull();
  });

  it('date mancanti o non valide: nessuno stato imposto', () => {
    expect(statoAutomaticoPromo(promo(STATO_PROMO.PIANIFICATA, null, null), ADESSO)).toBeNull();
    expect(statoAutomaticoPromo(
      { stato: STATO_PROMO.PIANIFICATA, validita_dal: new Date('x'), validita_al: new Date('x'), data_scadenza: new Date('x') },
      ADESSO,
    )).toBeNull();
  });

  it('lo stato può coincidere con quello attuale: è il cron a non riscriverlo', () => {
    expect(statoAutomaticoPromo(
      promo(STATO_PROMO.ARCHIVIATA, '2026-09-04T00:00:00Z', '2026-09-13T00:00:00Z'),
      ADESSO,
    )).toBe(STATO_PROMO.ARCHIVIATA);
  });

  it('senza adesso usa l\'ora corrente', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(ADESSO);
    try {
      expect(statoAutomaticoPromo(
        promo(STATO_PROMO.VALIDA, '2026-10-01T00:00:00Z', '2026-10-10T00:00:00Z'),
      )).toBe(STATO_PROMO.ARCHIVIATA);
    } finally {
      vi.useRealTimers();
    }
  });
});
