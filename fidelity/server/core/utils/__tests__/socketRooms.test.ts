import { describe, expect, it } from 'vitest';
import { stanzeClient } from '../socketRooms';

describe('room del canale in tempo reale', () => {
  it('un client senza sessione non entra in nessuna room e va disconnesso', () => {
    expect(stanzeClient(undefined)).toBeNull();
    expect(stanzeClient({})).toBeNull();
  });

  it('un utente autenticato entra negli autenticati, nella propria room e in quella della GDO', () => {
    expect(stanzeClient({ id_utente: 'u1', id_gdo: 'g1' })).toEqual(['auth', 'user:u1', 'gdo:g1']);
  });

  it('senza GDO in sessione resta fuori dalle room delle GDO', () => {
    expect(stanzeClient({ id_utente: 'u1' })).toEqual(['auth', 'user:u1']);
  });
});
