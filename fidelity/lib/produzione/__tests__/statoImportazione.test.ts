import { describe, expect, it } from 'vitest';
import {
  DURATA_CONCLUSA_MS,
  INTERVALLO_IN_ATTESA_MS,
  INTERVALLO_IN_CORSO_MS,
  durataStatoInCache,
  faseImportazione,
  intervalloAggiornamentoStato,
  statoGiaRegistrato,
} from '../statoImportazione';

// Spec ciclo-promozione-importazione, "Stato dell'importazione senza richieste superflue" (TASK-f4e1fc7c)
describe('faseImportazione', () => {
  it('in corso mentre Istanta importa', () => {
    for (const stato of ['InAttesaDiAssegnazione', 'InCoda', 'ElaborazioneDati', 'AttesaIO', 'IO']) {
      expect(faseImportazione(stato), stato).toBe('in_corso');
    }
  });

  it('in attesa mentre aspetta un operatore di Istanta, o se lo stato non si sa', () => {
    for (const stato of ['InAttesaDiConfermaUtente', 'Esaminata', 'Cancellata', 'StatoNuovo', null, undefined]) {
      expect(faseImportazione(stato), String(stato)).toBe('in_attesa');
    }
  });

  it('conclusa con un esito finale', () => {
    for (const stato of ['Terminata', 'TerminataConErrori', 'Scartata']) {
      expect(faseImportazione(stato), stato).toBe('conclusa');
    }
  });
});

describe('intervalloAggiornamentoStato', () => {
  it('5 secondi mentre importa, un minuto mentre aspetta, mai dopo un esito finale', () => {
    expect(intervalloAggiornamentoStato('ElaborazioneDati')).toBe(5_000);
    expect(intervalloAggiornamentoStato('InAttesaDiConfermaUtente')).toBe(60_000);
    // Esaminata non e' finale: l'operatore di Istanta puo' ancora confermarla
    expect(intervalloAggiornamentoStato('Esaminata')).toBe(60_000);
    expect(intervalloAggiornamentoStato('Terminata')).toBe(false);
    expect(intervalloAggiornamentoStato('TerminataConErrori')).toBe(false);
    expect(intervalloAggiornamentoStato('Scartata')).toBe(false);
  });
});

describe('durataStatoInCache', () => {
  it('il server riusa la risposta per lo stesso periodo della scheda, 10 minuti per un esito finale', () => {
    expect(durataStatoInCache('InCoda')).toBe(INTERVALLO_IN_CORSO_MS);
    expect(durataStatoInCache('InAttesaDiConfermaUtente')).toBe(INTERVALLO_IN_ATTESA_MS);
    expect(durataStatoInCache('TerminataConErrori')).toBe(DURATA_CONCLUSA_MS);
  });
});

describe('statoGiaRegistrato', () => {
  it('importato o scartato in FP non si chiede a Istanta', () => {
    expect(statoGiaRegistrato('Terminata')).toBe('Terminata');
    expect(statoGiaRegistrato('Scartato')).toBe('Scartata');
  });

  it('altrimenti si chiede', () => {
    expect(statoGiaRegistrato(null)).toBeNull();
    expect(statoGiaRegistrato(undefined)).toBeNull();
    expect(statoGiaRegistrato('')).toBeNull();
  });
});
