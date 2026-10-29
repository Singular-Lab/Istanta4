import { describe, expect, it } from 'vitest';
import { giornoDiRoma, visibileNelGiorno } from '../visibilitaWebpliant';

// Spec referenze-webpliant, Visibilita temporale: finestra a giorni di calendario di Roma
describe('giornoDiRoma', () => {
  it('una data senza ora resta quel giorno', () => {
    expect(giornoDiRoma('2026-10-31')).toBe('2026-10-31');
  });

  it('alle 23:30 UTC a Roma e gia il giorno dopo', () => {
    expect(giornoDiRoma(new Date('2026-10-30T23:30:00Z'))).toBe('2026-10-31');
  });

  it('la mezzanotte di Roma salvata in UTC resta lo stesso giorno', () => {
    // 31 ottobre 00:00 a Roma (ora solare, +01:00)
    expect(giornoDiRoma(new Date('2026-10-30T23:00:00Z'))).toBe('2026-10-31');
  });
});

describe('visibileNelGiorno', () => {
  // Promo dal 25 al 31 ottobre, con le date alle 00:00 di Roma come le scrive Istanta
  const promo = {
    validitaDal: new Date('2026-10-24T22:00:00Z'),
    validitaAl: new Date('2026-10-30T23:00:00Z'),
  };

  it('l\'ultimo giorno di validita e incluso per tutta la giornata', () => {
    expect(visibileNelGiorno(promo, '2026-10-31')).toBe(true);
  });

  it('il giorno dopo la fine non e visibile', () => {
    expect(visibileNelGiorno(promo, '2026-11-01')).toBe(false);
  });

  it('senza anticipo il giorno prima dell\'inizio non e visibile', () => {
    expect(visibileNelGiorno(promo, '2026-10-24')).toBe(false);
  });

  it('con un anticipo di N giorni e visibile da N giorni prima dell\'inizio', () => {
    expect(visibileNelGiorno({ ...promo, offsetGiorni: 3 }, '2026-10-22')).toBe(true);
    expect(visibileNelGiorno({ ...promo, offsetGiorni: 3 }, '2026-10-21')).toBe(false);
  });

  it('accetta le date della referenza senza ora', () => {
    expect(visibileNelGiorno({ validitaDal: '2026-10-10', validitaAl: '2026-10-12' }, '2026-10-12')).toBe(true);
  });
});
