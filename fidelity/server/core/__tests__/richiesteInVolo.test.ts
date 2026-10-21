import { describe, expect, it, vi } from 'vitest';
import { condividiInVolo } from '../../../lib/richiesteInVolo';

// Usata da ServerCall.post: un doppio click su un pulsante di creazione (I20-961)
describe('condividiInVolo', () => {
  it('due richieste uguali in contemporanea eseguono una sola chiamata', async () => {
    let risolvi!: (valore: string) => void;
    const esegui = vi.fn(() => new Promise<string>((r) => { risolvi = r; }));

    const primo = condividiInVolo('POST /promo {"titolo":"A"}', esegui);
    const secondo = condividiInVolo('POST /promo {"titolo":"A"}', esegui);
    risolvi('creata');

    await expect(Promise.all([primo, secondo])).resolves.toEqual(['creata', 'creata']);
    expect(esegui).toHaveBeenCalledTimes(1);
  });

  it('chiavi diverse non si condividono', async () => {
    const esegui = vi.fn(async () => 'ok');

    await Promise.all([condividiInVolo('chiave-a', esegui), condividiInVolo('chiave-b', esegui)]);

    expect(esegui).toHaveBeenCalledTimes(2);
  });

  it('finita la prima, la stessa richiesta riparte', async () => {
    const esegui = vi.fn(async () => 'ok');

    await condividiInVolo('chiave-c', esegui);
    await condividiInVolo('chiave-c', esegui);

    expect(esegui).toHaveBeenCalledTimes(2);
  });

  it('anche dopo un errore la richiesta successiva riparte', async () => {
    const esegui = vi.fn()
      .mockRejectedValueOnce(new Error('rete'))
      .mockResolvedValueOnce('ok');

    await expect(condividiInVolo('chiave-d', esegui)).rejects.toThrow('rete');
    await expect(condividiInVolo('chiave-d', esegui)).resolves.toBe('ok');
    expect(esegui).toHaveBeenCalledTimes(2);
  });
});
