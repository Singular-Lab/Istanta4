import { describe, expect, it, vi } from 'vitest';

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('../logger', () => ({ log }));

import { poolSessioni } from '../session';

/**
 * Spec processi-in-produzione, "Interruzioni del database e di Redis superate senza riavvio": quando
 * PostgreSQL chiude una connessione inattiva del pool delle sessioni (riavvio, pg_terminate_backend),
 * il pool emette 'error'. Senza ascoltatore, l'evento fermerebbe il processo.
 */
describe('pool delle sessioni', () => {
  it('un errore di una connessione inattiva finisce nel log e non ferma il processo', () => {
    const errore = new Error('terminating connection due to administrator command');

    expect(() => poolSessioni.emit('error', errore, {} as never)).not.toThrow();
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('connessione inattiva al database chiusa'), { errore: errore.message });
  });
});
