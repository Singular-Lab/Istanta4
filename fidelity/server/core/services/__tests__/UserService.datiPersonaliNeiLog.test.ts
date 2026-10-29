import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATO_UTENTI, TIPO_UTENTI } from '../../../../lib/enums';

const geocodifica = vi.hoisted(() => vi.fn());
const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

vi.mock('../../utils/geocodifica', () => ({ geocodifica }));
vi.mock('../../logger', () => ({ log }));

import { sequelize } from '../../db/SequelizeConnector';
import { ServerUtils } from '../../utils/ServerUtils';
import { UserService } from '../UserService';

/** I dati personali del nuovo utente: nessuno deve comparire in un log. */
const DATI_PERSONALI = {
  email: 'mario.rossi@esempio.it',
  nome: 'Mariolino',
  cognome: 'Rossellini',
  residenza: 'Via dei Mille 42, Pisa',
  dataDiNascita: '1981-02-03',
  telefono: '+393331234567',
};

const METODI_CONSOLE = ['log', 'info', 'warn', 'error', 'debug'] as const;
let spieConsole: Array<{ mock: { calls: unknown[][] } }> = [];

function testoScrittoNeiLog(): string {
  return JSON.stringify([
    ...Object.values(log).flatMap((spia) => spia.mock.calls),
    ...spieConsole.flatMap((spia) => spia.mock.calls),
  ]);
}

beforeEach(() => {
  spieConsole = METODI_CONSOLE.map((metodo) => vi.spyOn(console, metodo).mockImplementation(() => undefined));
});

afterEach(() => {
  geocodifica.mockReset();
  vi.restoreAllMocks();
  for (const spia of Object.values(log)) {
    spia.mockReset();
  }
});

describe('registerUserWithTransaction: dati personali nei log', () => {
  it('crea l\'utente scrivendo nei log solo tipo e identificativi, mai i dati personali o la posizione', async () => {
    geocodifica.mockResolvedValueOnce({ lat: 43.715678, lon: 10.401234 });
    vi.spyOn(sequelize, 'transaction').mockResolvedValue({ commit: vi.fn(), rollback: vi.fn() } as never);
    vi.spyOn(sequelize, 'query').mockResolvedValue([] as never);
    vi.spyOn(ServerUtils, 'CREA_ATTIVITA').mockResolvedValue(undefined as never);
    const repository = { createWithOptions: vi.fn(async () => ({ id_utenti: 'u-nuovo' })) };

    await new UserService(repository as never).registerUserWithTransaction({
      ...DATI_PERSONALI,
      password: 'Segreta!123',
      tipo: TIPO_UTENTI.SUPERADMIN,
      stato: STATO_UTENTI.ATTIVO,
    }, 'admin-1');

    // L'utente nasce con i suoi dati: e' il log a non riportarli
    expect(repository.createWithOptions).toHaveBeenCalledWith(
      expect.objectContaining({ email_utenti: DATI_PERSONALI.email.toLowerCase(), telefono_utenti: DATI_PERSONALI.telefono }),
      expect.anything(),
    );
    expect(log.debug).toHaveBeenCalledWith('registerUserWithTransaction - Start', { tipo: TIPO_UTENTI.SUPERADMIN, currentUserId: 'admin-1' });
    const scritto = testoScrittoNeiLog();
    for (const valore of [...Object.values(DATI_PERSONALI), 'Segreta!123', '43.715678', '10.401234']) {
      expect(scritto).not.toContain(valore);
    }
  });

  it('residenza non trovata: il log lo dice senza riportare l\'indirizzo', async () => {
    geocodifica.mockResolvedValueOnce({});
    vi.spyOn(sequelize, 'transaction').mockResolvedValue({ commit: vi.fn(), rollback: vi.fn() } as never);
    vi.spyOn(sequelize, 'query').mockResolvedValue([] as never);
    vi.spyOn(ServerUtils, 'CREA_ATTIVITA').mockResolvedValue(undefined as never);
    const repository = { createWithOptions: vi.fn(async () => ({ id_utenti: 'u-nuovo' })) };

    await new UserService(repository as never).registerUserWithTransaction({
      ...DATI_PERSONALI,
      tipo: TIPO_UTENTI.SUPERADMIN,
      stato: STATO_UTENTI.ATTIVO,
    }, 'admin-1');

    expect(log.debug).toHaveBeenCalledWith('registerUserWithTransaction - Posizione non trovata dalla residenza');
    expect(testoScrittoNeiLog()).not.toContain(DATI_PERSONALI.residenza);
  });
});
