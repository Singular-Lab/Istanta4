import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_COMBINAZIONI } from '../../../../lib/enums';
import { DatabaseError, NotFoundError } from '../../../../lib/errors';
import { log } from '../../logger';
import { Area } from '../../models/aree';
import { Canale } from '../../models/canali';
import { DesignKit } from '../../models/design_kit';
import { RaccoglitoreKit } from '../../models/raccoglitore_kit';
import { RuntimeKit } from '../../models/runtime_kit';
import { KitRuntimeService } from '../KitRuntimeService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// I passaggi di getKitByPromo dentro il service devono lasciare traccia nei log

const traccia = { context: 'getKitByPromo', richiesta: 'ab12cd34' };
const service = () => new KitRuntimeService({} as any, {} as any);
const rigaDiLog = (messaggio: string) => vi.mocked(log.info).mock.calls.find(([m]) => m === messaggio)?.[1];

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('getAllKitByAreaCanalePV', () => {
  it('scrive in una riga quante combinazioni escono dalla query, quali sono escluse e perche', async () => {
    vi.spyOn(DesignKit, 'findAll').mockResolvedValue([
      { id: 'a', titolo: 'SS TO', stato: STATO_COMBINAZIONI.ATTIVO, filtro_contesto: [] },
      { id: 'b', titolo: 'SS LA', stato: STATO_COMBINAZIONI.ATTIVO, filtro_contesto: [{ condizioni: [{ colonna: 'ap_name', valore: 'LA SPEZIA', operatore: '=' }] }] },
      { id: 'c', titolo: 'SS SA', stato: STATO_COMBINAZIONI.DISATTIVO, filtro_contesto: [] },
    ] as any);
    vi.spyOn(Area, 'findByPk').mockResolvedValue(null);
    vi.spyOn(Canale, 'findByPk').mockResolvedValue(null);
    vi.spyOn(RaccoglitoreKit, 'findOne').mockResolvedValue(null);

    const combinazioni = await service().getAllKitByAreaCanalePV({ idCanale: 'ss' }, traccia);

    expect(combinazioni.map((c: any) => c.id)).toEqual(['a']);
    expect(rigaDiLog('Combinazioni design selezionate')).toMatchObject({
      ...traccia,
      filtri: { idCanale: 'ss' },
      dallaQuery: 3,
      esclusePerContesto: ['SS LA (b)'],
      escluseNonAttive: ['SS SA (c) stato=DISATTIVO'],
      selezionate: ['SS TO (a)'],
    });
  });
});

describe('bulkCreateRuntime', () => {
  const design = (id: string) => ({ guidId: id, titolo: `Design ${id}`, idPromo: 'p1', guidIdRaccoglitore: 'r1' }) as any;

  it('per ogni design dice se il runtime e stato creato o esisteva gia, poi il riepilogo', async () => {
    vi.spyOn(RuntimeKit, 'findAll').mockImplementation((async ({ where }: any) =>
      where.id_design === 'd1' ? [{ id: 'rt-esistente', stato_lavorazione: 'IN_LAVORAZIONE' }] : []) as any);
    vi.spyOn(RaccoglitoreKit, 'findOne').mockResolvedValue({ id: 'r1', files: [] } as any);
    vi.spyOn(RuntimeKit, 'create').mockResolvedValue({} as any);
    vi.spyOn(RuntimeKit, 'findByPk').mockImplementation((async (id: string) => ({ id })) as any);

    const runtime = await service().bulkCreateRuntime([design('d1'), design('d2')], traccia);

    expect(runtime).toHaveLength(2);
    expect(rigaDiLog('Runtime gia esistente per design e promo: restituito quello'))
      .toMatchObject({ ...traccia, idDesign: 'd1', idRuntime: 'rt-esistente', idPromo: 'p1' });
    expect(rigaDiLog('Runtime creato')).toMatchObject({ ...traccia, idDesign: 'd2', idPromo: 'p1', file: 0 });
    expect(rigaDiLog('Runtime della promo pronti')).toMatchObject({ ...traccia, design: 2, creati: 1, esistenti: 1 });
  });

  it('raccoglitore mancante: lo scrive e la causa resta nell\'errore', async () => {
    vi.spyOn(RuntimeKit, 'findAll').mockResolvedValue([]);
    vi.spyOn(RaccoglitoreKit, 'findOne').mockResolvedValue(null);

    const errore = await service().bulkCreateRuntime([design('d1')], traccia).catch(e => e);

    expect(vi.mocked(log.warn)).toHaveBeenCalledWith(
      'Raccoglitore del design non trovato: runtime non creato',
      expect.objectContaining({ ...traccia, idDesign: 'd1', idRaccoglitore: 'r1' }),
    );
    expect(errore).toBeInstanceOf(DatabaseError);
    expect(errore.cause).toBeInstanceOf(NotFoundError);
  });
});

describe('createKitRunTime', () => {
  it('l\'errore del database resta come causa, non solo il messaggio generico', async () => {
    vi.spyOn(RuntimeKit, 'findOne').mockRejectedValue(new Error('connessione persa'));

    const errore = await service().createKitRunTime({ guidIdDesign: 'd1', idPromo: 'p1' } as any).catch(e => e);

    expect(errore).toBeInstanceOf(DatabaseError);
    expect(errore.message).toBe('Errore durante la creazione del runtime kit');
    expect(errore.cause.message).toBe('connessione persa');
  });
});
