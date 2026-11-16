import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../models/utenti', () => ({ Utente: { findAll: vi.fn() } }));

import { Utente } from '../../models/utenti';
import { nomeAutore, nomiAutori } from '../autoriTracciati';

// Spec ciclo-promozione-importazione, "Autore e date del tracciato" (TASK-f4e1fc7c)
const MARIO = '11111111-2222-4333-8444-555555555555';
const ANNA = '22222222-3333-4444-8555-666666666666';

afterEach(() => vi.mocked(Utente.findAll).mockReset());

describe('nomeAutore', () => {
  it('nome e cognome, altrimenti l email', () => {
    expect(nomeAutore({ id_utenti: MARIO, nome_utenti: 'Mario', cognome_utenti: 'Rossi' })).toBe('Mario Rossi');
    expect(nomeAutore({ id_utenti: MARIO, nome_utenti: ' Mario ', cognome_utenti: null })).toBe('Mario');
    expect(nomeAutore({ id_utenti: MARIO, nome_utenti: '', cognome_utenti: null, email_utenti: 'm.rossi@example.test' })).toBe('m.rossi@example.test');
    expect(nomeAutore({ id_utenti: MARIO, nome_utenti: null, cognome_utenti: null })).toBeNull();
  });
});

describe('nomiAutori', () => {
  it('una sola query per tutti gli autori, senza ripetere gli id', async () => {
    vi.mocked(Utente.findAll).mockResolvedValue([
      { id_utenti: MARIO, nome_utenti: 'Mario', cognome_utenti: 'Rossi' },
      { id_utenti: ANNA, nome_utenti: 'Anna', cognome_utenti: 'Bianchi' },
    ] as never);

    const nomi = await nomiAutori([MARIO, ANNA, MARIO, null, undefined]);

    expect(Utente.findAll).toHaveBeenCalledTimes(1);
    expect(nomi.get(MARIO)).toBe('Mario Rossi');
    expect(nomi.get(ANNA)).toBe('Anna Bianchi');
  });

  it('senza autori non interroga il database', async () => {
    expect((await nomiAutori([null, undefined, 'non-un-id'])).size).toBe(0);
    expect(Utente.findAll).not.toHaveBeenCalled();
  });

  it('se la lettura non riesce i tracciati restano senza nome', async () => {
    vi.mocked(Utente.findAll).mockRejectedValue(new Error('connessione persa'));

    expect((await nomiAutori([MARIO])).size).toBe(0);
  });
});
