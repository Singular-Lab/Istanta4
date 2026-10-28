import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DURATA_PASSAPORTO_MS,
  invalidaPassaporto,
  MASSIMO_PASSAPORTI,
  passaportoInCache,
  svuotaCachePassaporti,
  type Passaporto,
} from '../cachePassaporti';

const PASSAPORTO: Passaporto = { outsider: false, publicKey: 'pk-1' };

/** Richiesta a Olimpo finta che si chiude solo quando il test lo decide. */
function richiestaSospesa() {
  let rilascia!: (p: Passaporto | null) => void;
  const richiedi = vi.fn(() => new Promise<Passaporto | null>(resolve => { rilascia = resolve; }));
  return { richiedi, rilascia: (p: Passaporto | null) => rilascia(p) };
}

afterEach(() => {
  svuotaCachePassaporti();
});

describe('passaportoInCache', () => {
  it('richieste contemporanee dello stesso utente: una sola richiesta a Olimpo', async () => {
    const { richiedi, rilascia } = richiestaSospesa();

    const attese = Array.from({ length: 5 }, () => passaportoInCache('u1', 'chiave', richiedi));
    await Promise.resolve();
    rilascia(PASSAPORTO);

    expect(await Promise.all(attese)).toEqual(Array(5).fill(PASSAPORTO));
    expect(richiedi).toHaveBeenCalledTimes(1);
  });

  it('entro la durata riusa il passaporto, dopo lo richiede', async () => {
    const adesso = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const richiedi = vi.fn(async () => PASSAPORTO);

    await passaportoInCache('u1', 'chiave', richiedi);
    adesso.mockReturnValue(1_000_000 + DURATA_PASSAPORTO_MS - 1);
    await passaportoInCache('u1', 'chiave', richiedi);
    expect(richiedi).toHaveBeenCalledTimes(1);

    adesso.mockReturnValue(1_000_000 + DURATA_PASSAPORTO_MS + 1);
    await passaportoInCache('u1', 'chiave', richiedi);
    expect(richiedi).toHaveBeenCalledTimes(2);
  });

  it('un errore non resta in cache: la richiesta successiva riprova', async () => {
    const richiedi = vi.fn()
      .mockRejectedValueOnce(new Error('Olimpo non raggiungibile'))
      .mockResolvedValueOnce(PASSAPORTO);

    await expect(passaportoInCache('u1', 'chiave', richiedi)).rejects.toThrow('Olimpo non raggiungibile');
    await expect(passaportoInCache('u1', 'chiave', richiedi)).resolves.toEqual(PASSAPORTO);
    expect(richiedi).toHaveBeenCalledTimes(2);
  });

  it('un utente inesistente (null) non resta in cache', async () => {
    const richiedi = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(PASSAPORTO);

    expect(await passaportoInCache('u1', 'chiave', richiedi)).toBeNull();
    expect(await passaportoInCache('u1', 'chiave', richiedi)).toEqual(PASSAPORTO);
  });

  it('una chiave privata diversa in sessione richiede un passaporto nuovo', async () => {
    const richiedi = vi.fn(async () => PASSAPORTO);

    await passaportoInCache('u1', 'chiave-vecchia', richiedi);
    await passaportoInCache('u1', 'chiave-nuova', richiedi);

    expect(richiedi).toHaveBeenCalledTimes(2);
  });

  it('a chi serve la chiave pubblica non basta la voce di un outsider senza chiave', async () => {
    const richiedi = vi.fn()
      .mockResolvedValueOnce({ outsider: true, publicKey: null })
      .mockResolvedValueOnce({ outsider: true, publicKey: 'pk-outsider' });

    await passaportoInCache('u1', 'chiave', richiedi);
    const conChiave = await passaportoInCache('u1', 'chiave', richiedi, true);
    const senzaChiave = await passaportoInCache('u1', 'chiave', richiedi);

    expect(conChiave).toEqual({ outsider: true, publicKey: 'pk-outsider' });
    expect(senzaChiave).toEqual({ outsider: true, publicKey: 'pk-outsider' });
    expect(richiedi).toHaveBeenCalledTimes(2);
  });

  it('oltre il numero massimo di utenti si scarta il meno recente', async () => {
    const richiedi = vi.fn(async () => PASSAPORTO);

    for (let i = 0; i <= MASSIMO_PASSAPORTI; i++) {
      await passaportoInCache(`u${i}`, 'chiave', richiedi);
    }
    await passaportoInCache(`u${MASSIMO_PASSAPORTI}`, 'chiave', richiedi);
    expect(richiedi).toHaveBeenCalledTimes(MASSIMO_PASSAPORTI + 1);

    await passaportoInCache('u0', 'chiave', richiedi);
    expect(richiedi).toHaveBeenCalledTimes(MASSIMO_PASSAPORTI + 2);
  });
});

describe('invalidaPassaporto', () => {
  it('scarta il passaporto: la richiesta successiva va a Olimpo', async () => {
    const richiedi = vi.fn(async () => PASSAPORTO);

    await passaportoInCache('u1', 'chiave', richiedi);
    invalidaPassaporto('u1');
    await passaportoInCache('u1', 'chiave', richiedi);

    expect(richiedi).toHaveBeenCalledTimes(2);
  });

  it('una richiesta gia partita non rimette in cache il passaporto scartato', async () => {
    const { richiedi, rilascia } = richiestaSospesa();

    const inCorso = passaportoInCache('u1', 'chiave', richiedi);
    await Promise.resolve();
    invalidaPassaporto('u1');
    rilascia(PASSAPORTO);
    // Chi aspettava riceve comunque il risultato
    expect(await inCorso).toEqual(PASSAPORTO);

    const dopo = vi.fn(async () => ({ outsider: false, publicKey: 'pk-2' }));
    expect(await passaportoInCache('u1', 'chiave', dopo)).toEqual({ outsider: false, publicKey: 'pk-2' });
    expect(dopo).toHaveBeenCalledTimes(1);
  });

  it('non tocca gli altri utenti', async () => {
    const richiedi = vi.fn(async () => PASSAPORTO);

    await passaportoInCache('u1', 'chiave', richiedi);
    await passaportoInCache('u10', 'chiave', richiedi);
    invalidaPassaporto('u1');
    await passaportoInCache('u10', 'chiave', richiedi);

    expect(richiedi).toHaveBeenCalledTimes(2);
  });
});
