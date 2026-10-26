import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_UTENTI, TIPO_UTENTI } from '../../../../lib/enums';
import { ForbiddenError } from '../../../../lib/errors';

const mocks = vi.hoisted(() => ({ compare: vi.fn(async () => true) }));
vi.mock('bcrypt', () => ({ default: { compare: mocks.compare } }));

import { sequelize } from '../../db/SequelizeConnector';
import { PuntoVenditaUtenti } from '../../models/punto_vendita/punti_vendita_utenti';
import { UtentiGDO } from '../../models/utenti_gdo';
import { puoEntrareComeGdoOPuntoVendita, UserService } from '../UserService';

const utenteRegistrato = (tipo: TIPO_UTENTI) => ({
  id_utenti: 'u1',
  email_utenti: 'mario@esempio.it',
  password_utenti: 'hash',
  tipo_utenti: tipo,
  stato_utenti: STATO_UTENTI.ATTIVO,
  meta_utenti: { need_ad: false },
});

describe('tipo con cui si apre la sessione', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    [TIPO_UTENTI.GDO, true],
    [TIPO_UTENTI.PUNTOVENDITA, true],
    [TIPO_UTENTI.IT, true],
    [TIPO_UTENTI.CATEGORY, true],
    [TIPO_UTENTI.GUEST, false],
    [TIPO_UTENTI.MARKETING, false],
    [TIPO_UTENTI.AGENZIA, false],
  ])('un utente registrato come %s può entrare come GDO: %s', (tipo, atteso) => {
    expect(puoEntrareComeGdoOPuntoVendita(tipo)).toBe(atteso);
  });

  const accedi = async (tipo: TIPO_UTENTI, scelto?: TIPO_UTENTI) => {
    vi.spyOn(UtentiGDO, 'findOne').mockResolvedValue({ id_gdo_utentegdo: 'coop-firenze' } as any);
    vi.spyOn(PuntoVenditaUtenti, 'findOne').mockResolvedValue(null);
    const repository = { findByEmail: vi.fn(async () => utenteRegistrato(tipo)) };
    return new UserService(repository as any).login('mario@esempio.it', 'segreta', scelto);
  };

  it('un Guest associato a una GDO non può scegliere il tipo GDO', async () => {
    const esito = await accedi(TIPO_UTENTI.GUEST, TIPO_UTENTI.GDO);
    expect(esito.success).toBe(false);
  });

  it('un utente IT senza punto vendita entra come GDO', async () => {
    const esito = await accedi(TIPO_UTENTI.IT);
    expect(esito).toMatchObject({ success: true, user: { tipo: TIPO_UTENTI.GDO, id_gdo: 'coop-firenze' } });
  });

  it('un utente GDO può scegliere il tipo GDO', async () => {
    const esito = await accedi(TIPO_UTENTI.GDO, TIPO_UTENTI.GDO);
    expect(esito).toMatchObject({ success: true, user: { tipo: TIPO_UTENTI.GDO } });
  });
});

describe('eliminazione di un utente', () => {
  afterEach(() => vi.restoreAllMocks());

  const servizio = () => {
    const repository = { destroyWhere: vi.fn(async () => 1) };
    vi.spyOn(sequelize, 'query').mockResolvedValue([] as any);
    return { service: new UserService(repository as any), repository };
  };

  it('un utente GDO non può eliminare un utente di un\'altra GDO', async () => {
    vi.spyOn(UtentiGDO, 'findOne').mockResolvedValue({ id_gdo_utentegdo: 'altra-gdo' } as any);
    const { service, repository } = servizio();
    await expect(service.deleteUser('u2', { tipo: TIPO_UTENTI.GDO, idGdo: 'coop-firenze' }))
      .rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.destroyWhere).not.toHaveBeenCalled();
  });

  it('un utente GDO elimina un utente della propria GDO', async () => {
    vi.spyOn(UtentiGDO, 'findOne').mockResolvedValue({ id_gdo_utentegdo: 'coop-firenze' } as any);
    const { service, repository } = servizio();
    await expect(service.deleteUser('u2', { tipo: TIPO_UTENTI.GDO, idGdo: 'coop-firenze' })).resolves.toBe(true);
    expect(repository.destroyWhere).toHaveBeenCalled();
  });

  it('un utente Agenzia opera su più GDO', async () => {
    const trova = vi.spyOn(UtentiGDO, 'findOne');
    const { service } = servizio();
    await expect(service.deleteUser('u2', { tipo: TIPO_UTENTI.AGENZIA, idGdo: null })).resolves.toBe(true);
    expect(trova).not.toHaveBeenCalled();
  });
});
