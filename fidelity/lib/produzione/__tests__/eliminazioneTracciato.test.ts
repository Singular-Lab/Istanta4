import { describe, expect, it } from 'vitest';
import { motivoTracciatoNonEliminabile, tracciatoNonImportato } from '../eliminazioneTracciato';

// Spec ciclo-promozione-importazione, "Eliminazione di un tracciato non importato"
describe('tracciatoNonImportato', () => {
  it('in attesa o non accettato da Istanta', () => {
    expect(tracciatoNonImportato({ inAttesaIstanta: true })).toBe(true);
  });

  it("scartato, salvato in FP o letto dallo stato dell'importazione", () => {
    expect(tracciatoNonImportato({ inAttesaIstanta: false, statoTracciato: 'Scartato' })).toBe(true);
    expect(tracciatoNonImportato({ inAttesaIstanta: false, statoTracciato: null, statoImportazione: 'Scartata' })).toBe(true);
  });

  it("importato o con l'importazione ancora aperta", () => {
    expect(tracciatoNonImportato({ inAttesaIstanta: false, statoTracciato: 'Terminata', statoImportazione: 'Terminata' })).toBe(false);
    expect(tracciatoNonImportato({ inAttesaIstanta: false, statoImportazione: 'TerminataConErrori' })).toBe(false);
    expect(tracciatoNonImportato({ inAttesaIstanta: false, statoImportazione: 'InCoda' })).toBe(false);
    expect(tracciatoNonImportato({ inAttesaIstanta: false })).toBe(false);
  });
});

describe('motivoTracciatoNonEliminabile', () => {
  it('importato', () => {
    expect(motivoTracciatoNonEliminabile('Terminata')).toBe('Il tracciato è già importato in Istanta: non si può eliminare.');
    expect(motivoTracciatoNonEliminabile('Esaminata')).toMatch(/già importato/);
  });

  it('ancora in corso o senza stato', () => {
    expect(motivoTracciatoNonEliminabile('ElaborazioneDati')).toMatch(/non è conclusa/);
    expect(motivoTracciatoNonEliminabile(null)).toMatch(/non è conclusa/);
  });
});
