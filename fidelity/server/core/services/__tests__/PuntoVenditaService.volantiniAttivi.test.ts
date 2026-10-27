import { Op } from 'sequelize';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_LAVORAZIONE_KIT_RUNTIME, STATO_PROMO } from '../../../../lib/enums';
import { NotFoundError } from '../../../../lib/errors';
import { CombinazioneCanaleArea, FilesRuntime, RuntimeKit, TipiDiExport } from '../../models';
import { Promo } from '../../models/promo';
import { nomePdfScaricato, PuntoVenditaService } from '../PuntoVenditaService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Proposta anagrafica-punti-vendita: il dettaglio del PV mostra i volantini attivi della sua
// combinazione canale/area, cioe' di promo VALIDA o VALIDA_CON_ERRORI e di kit runtime PUBBLICATI

const pv = { id_puntivendita: 'pv1', id_combinazione_canale_area_puntivendita: 'comb1' };
const service = (trovato: unknown = pv) => new PuntoVenditaService({ findById: vi.fn().mockResolvedValue(trovato) } as any);

const promoValida = {
  id_promo: 'p1',
  nome_promo: 'Sottocosto ottobre',
  validita_dal: new Date('2026-10-10'),
  validita_al: new Date('2026-10-20'),
};

const preparaDb = (kits: unknown[], files: unknown[]) => {
  vi.spyOn(CombinazioneCanaleArea, 'findByPk').mockResolvedValue(
    { id_canale_combinazione_canale_area: 'cc', id_area_combinazione_canale_area: 'to' } as any,
  );
  vi.spyOn(Promo, 'findAll').mockResolvedValue([promoValida] as any);
  vi.spyOn(RuntimeKit, 'findAll').mockResolvedValue(kits as any);
  vi.spyOn(TipiDiExport, 'findAll').mockResolvedValue([{ id_tipiexport: 'vol' }] as any);
  vi.spyOn(FilesRuntime, 'findAll').mockResolvedValue(files as any);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PuntoVenditaService.getVolantiniAttivi', () => {
  it('restituisce una volta il kit pubblicato della promo valida, con i suoi PDF', async () => {
    preparaDb(
      [{ id: 'k1', id_promo: 'p1', titolo: 'CC TO' }],
      [
        { id: 'f1', id_runtime: 'k1', nome: 'volantino-1.pdf', id_olimpo_cloud: 'o1' },
        { id: 'f2', id_runtime: 'k1', nome: 'volantino-2.pdf', id_olimpo_cloud: 'o2' },
      ],
    );

    const volantini = await service().getVolantiniAttivi('pv1');

    expect(volantini).toHaveLength(1);
    expect(volantini[0]).toMatchObject({
      id_kit: 'k1',
      promo: { id: 'p1', nome: 'Sottocosto ottobre' },
    });
    expect(volantini[0].files.map(f => f.nome)).toEqual(['volantino-1.pdf', 'volantino-2.pdf']);
    expect(volantini[0].files[0].url_download).toContain('/materiali/getMaterialePDF');
    expect(volantini[0].files.map(f => f.nome_download)).toEqual(['volantino-1.pdf', 'volantino-2.pdf']);
  });

  it('il PDF si scarica col nome del file, o della promo se il file non ha nome', async () => {
    preparaDb(
      [{ id: 'k1', id_promo: 'p1' }],
      [
        { id: 'f1', id_runtime: 'k1', nome: 'volantino-cc-toscana', id_olimpo_cloud: 'o1' },
        { id: 'f2', id_runtime: 'k1', nome: null, id_olimpo_cloud: 'o2' },
      ],
    );

    const [volantino] = await service().getVolantiniAttivi('pv1');

    expect(volantino.files.map(f => f.nome_download)).toEqual(['volantino-cc-toscana.pdf', 'Sottocosto ottobre.pdf']);
  });

  it('cerca solo promo valide e kit pubblicati della stessa area e canale del PV', async () => {
    preparaDb([], []);

    await service().getVolantiniAttivi('pv1');

    const promoWhere = vi.mocked(Promo.findAll).mock.calls[0][0]!.where as any;
    expect(promoWhere.stato[Op.in]).toEqual([STATO_PROMO.VALIDA, STATO_PROMO.VALIDA_CON_ERRORI]);
    expect(vi.mocked(RuntimeKit.findAll).mock.calls[0][0]!.where).toMatchObject({
      id_area: 'to',
      id_canale: 'cc',
      stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO,
    });
  });

  it('un kit senza PDF del volantino non compare', async () => {
    preparaDb([{ id: 'k1', id_promo: 'p1' }], []);

    expect(await service().getVolantiniAttivi('pv1')).toEqual([]);
  });

  it('senza promo attive non cerca i kit', async () => {
    preparaDb([], []);
    vi.mocked(Promo.findAll).mockResolvedValue([]);

    expect(await service().getVolantiniAttivi('pv1')).toEqual([]);
    expect(RuntimeKit.findAll).not.toHaveBeenCalled();
  });

  it('punto vendita inesistente: non trovato', async () => {
    await expect(service(null).getVolantiniAttivi('nessuno')).rejects.toThrow(NotFoundError);
  });
});

describe('nomePdfScaricato', () => {
  it('lascia il nome che finisce gia in .pdf, senza distinguere maiuscole', () => {
    expect(nomePdfScaricato('Volantino.PDF', 'Promo')).toBe('Volantino.PDF');
  });

  it('toglie i caratteri non ammessi nei nomi di file', () => {
    expect(nomePdfScaricato('cartella/volantino:"1"?.pdf', 'Promo')).toBe('cartellavolantino1.pdf');
  });

  it('senza nome del file ne della promo usa volantino.pdf', () => {
    expect(nomePdfScaricato('  ', '')).toBe('volantino.pdf');
  });
});
