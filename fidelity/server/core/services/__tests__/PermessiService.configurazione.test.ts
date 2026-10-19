import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { BadRequestError } from '../../../../lib/errors';
import { PERMESSI } from '../../../../lib/accessi/catalogo';

vi.mock('../../db/SequelizeConnector', () => ({
  sequelize: { transaction: vi.fn(async (fn: any) => fn('tx')) },
}));
vi.mock('../../accessi/versionePermessi', () => ({
  incrementaVersionePermessi: vi.fn(async () => 2),
  leggiVersionePermessi: vi.fn(async () => 1),
}));
vi.mock('../../models', () => ({ GDO: { findByPk: vi.fn(async () => ({ id_gdo: 'g1' })), findAll: vi.fn(async () => []) } }));
vi.mock('../../models/ruolo_gdo', () => ({ RuoloUtenteGDO: { findByPk: vi.fn(async () => ({ id_ruolo_utente_gdo: 'r1' })), findAll: vi.fn(async () => []) } }));
vi.mock('../../repositories/PermessiRepository', () => ({ PermessiRepository: class { } }));
vi.mock('../../logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { incrementaVersionePermessi } from '../../accessi/versionePermessi';
import { PermessiService, statoPermessi } from '../PermessiService';

const mappa = (valori: Record<string, boolean>) => new Map(Object.entries(valori));
const vuoto = () => new Map<string, boolean>();

const repositoryFinto = () => ({
  findAllPermessi: vi.fn(async () => [PERMESSI.PROMO.VISUALIZZA, PERMESSI.PROMO.ELIMINA, PERMESSI.SISTEMA.LOG].map(codice => ({
    getDataValue: (k: string) => (k === 'codice' ? codice : `id-${codice}`),
  }))),
  scriviLivello: vi.fn(async () => undefined),
  svuotaOverride: vi.fn(async () => 3),
});

const risolutoreFinto = (livelli: any) => ({
  leggiLivelli: vi.fn(async () => livelli),
  permessiDelRuolo: vi.fn(async () => new Set()),
  permessiDi: vi.fn(async () => new Set()),
});

describe('statoPermessi', () => {
  it('per un override di GDO indica ereditati e personalizzati', () => {
    const stati = statoPermessi(
      { tipo: TIPO_UTENTI.GDO, idGdo: 'coop-firenze' },
      {
        tipo: mappa({ [PERMESSI.PROMO.VISUALIZZA]: true, [PERMESSI.PROMO.ELIMINA]: true }),
        sottoRuolo: vuoto(),
        gdo: mappa({ [PERMESSI.PROMO.ELIMINA]: false }),
        gdoSottoRuolo: vuoto(),
      }
    );
    const elimina = stati.find(s => s.codice === PERMESSI.PROMO.ELIMINA)!;
    const visualizza = stati.find(s => s.codice === PERMESSI.PROMO.VISUALIZZA)!;
    expect(elimina).toMatchObject({ abilitato: false, impostato: true, ereditato: true, efficace: false });
    expect(visualizza).toMatchObject({ abilitato: true, impostato: false, ereditato: true, efficace: true });
  });

  it('i permessi di sistema risultano sempre disattivati e non impostati', () => {
    const stati = statoPermessi(
      { tipo: TIPO_UTENTI.AGENZIA },
      { tipo: mappa({ [PERMESSI.SISTEMA.LOG]: true }), sottoRuolo: vuoto(), gdo: vuoto(), gdoSottoRuolo: vuoto() }
    );
    expect(stati.find(s => s.codice === PERMESSI.SISTEMA.LOG)).toMatchObject({ abilitato: false, impostato: false, efficace: false });
  });

  it('per un sotto-ruolo eredita dal tipo', () => {
    const stati = statoPermessi(
      { tipo: TIPO_UTENTI.GDO, idRuoloGdo: 'admin' },
      { tipo: mappa({ [PERMESSI.PROMO.VISUALIZZA]: true }), sottoRuolo: vuoto(), gdo: vuoto(), gdoSottoRuolo: vuoto() }
    );
    expect(stati.find(s => s.codice === PERMESSI.PROMO.VISUALIZZA)).toMatchObject({ abilitato: true, impostato: false, ereditato: true });
  });
});

describe('PermessiService.salvaConfigurazione', () => {
  const livelli = { tipo: vuoto(), sottoRuolo: vuoto(), gdo: vuoto(), gdoSottoRuolo: vuoto() };
  beforeEach(() => vi.mocked(incrementaVersionePermessi).mockClear());

  it('rifiuta i permessi di sistema e non scrive nulla', async () => {
    const repository = repositoryFinto();
    const service = new PermessiService(repository as any, risolutoreFinto(livelli) as any);
    await expect(service.salvaConfigurazione(
      { tipo: TIPO_UTENTI.AGENZIA },
      [{ codice: PERMESSI.SISTEMA.LOG, abilitato: true }]
    )).rejects.toBeInstanceOf(BadRequestError);
    expect(repository.scriviLivello).not.toHaveBeenCalled();
  });

  it('rifiuta codici sconosciuti', async () => {
    const service = new PermessiService(repositoryFinto() as any, risolutoreFinto(livelli) as any);
    await expect(service.salvaConfigurazione({ tipo: TIPO_UTENTI.GDO }, [{ codice: 'pagina.dashboard', abilitato: true }]))
      .rejects.toBeInstanceOf(BadRequestError);
  });

  it('rifiuta il Superadmin come ruolo da configurare', async () => {
    const service = new PermessiService(repositoryFinto() as any, risolutoreFinto(livelli) as any);
    await expect(service.salvaConfigurazione({ tipo: TIPO_UTENTI.SUPERADMIN }, []))
      .rejects.toBeInstanceOf(BadRequestError);
  });

  it('scrive le modifiche e aggiorna la versione nella stessa transazione', async () => {
    const repository = repositoryFinto();
    const service = new PermessiService(repository as any, risolutoreFinto(livelli) as any);
    await service.salvaConfigurazione(
      { tipo: TIPO_UTENTI.GDO, idGdo: 'g1' },
      [{ codice: PERMESSI.PROMO.ELIMINA, abilitato: false }, { codice: PERMESSI.PROMO.VISUALIZZA, abilitato: null }]
    );
    const [ambito, valori, transazione] = repository.scriviLivello.mock.calls[0] as any[];
    expect(ambito).toMatchObject({ tipo: TIPO_UTENTI.GDO, idGdo: 'g1' });
    expect(valori.get(`id-${PERMESSI.PROMO.ELIMINA}`)).toBe(false);
    expect(valori.get(`id-${PERMESSI.PROMO.VISUALIZZA}`)).toBeNull();
    expect(transazione).toBe('tx');
    expect(incrementaVersionePermessi).toHaveBeenCalledWith('tx');
  });

  it('sul livello del tipo "torna a ereditare" significa disabilitare', async () => {
    const repository = repositoryFinto();
    const service = new PermessiService(repository as any, risolutoreFinto(livelli) as any);
    await service.salvaConfigurazione({ tipo: TIPO_UTENTI.GDO }, [{ codice: PERMESSI.PROMO.ELIMINA, abilitato: null }]);
    const valori = (repository.scriviLivello.mock.calls[0] as any[])[1];
    expect(valori.get(`id-${PERMESSI.PROMO.ELIMINA}`)).toBe(false);
  });

  it('ripristinare gli override aggiorna la versione', async () => {
    const repository = repositoryFinto();
    const service = new PermessiService(repository as any, risolutoreFinto(livelli) as any);
    expect(await service.ripristinaOverride({ tipo: TIPO_UTENTI.GDO, idGdo: 'g1' })).toBe(3);
    expect(incrementaVersionePermessi).toHaveBeenCalled();
  });
});
