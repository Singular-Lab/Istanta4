import { Op } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPORT_DI_SISTEMA, STATO_LAVORAZIONE_KIT_RUNTIME, STATO_PROMO } from '../../../../lib/enums';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { log } from '../../logger';
import { Area } from '../../models/aree';
import { Canale } from '../../models/canali';
import { FilesRuntime } from '../../models/files_runtime';
import { Promo } from '../../models/promo';
import { RuntimeKit } from '../../models/runtime_kit';
import { TipiDiExport } from '../../models/tipi_di_export';
import { FileManagementService } from '../FileManagementService';

const { PUBBLICATO, IN_LAVORAZIONE } = STATO_LAVORAZIONE_KIT_RUNTIME;

type Riga = Record<string, unknown>;

const kit = (id: string, id_promo = 'p-valida', opzioni: { stato?: string; canale?: string; tipi?: string[] } = {}) => ({
  id,
  id_promo,
  id_area: 'a1',
  id_canale: opzioni.canale ?? 'c1',
  id_design: `d-${id}`,
  stato_lavorazione: opzioni.stato ?? PUBBLICATO,
  tipi_di_export_in_kit: (opzioni.tipi ?? ['tipo-vol']).map((tipo) => ({ tipo_di_export_guid_id: tipo })),
});
const file = (id_runtime: string, nome: string, tipo_export = 'tipo-vol', id_olimpo_cloud: string | null = `olimpo-${nome}`) =>
  ({ id: `f-${nome}`, id_runtime, nome, tipo_export, id_olimpo_cloud });

const TIPI = [
  { id_tipiexport: 'tipo-vol', codice_tipiexport: EXPORT_DI_SISTEMA.VOL },
  { id_tipiexport: 'tipo-dig', codice_tipiexport: 'DIG' },
];
// p-cancellata non esiste piu': promo eliminata definitivamente
const PROMO = [
  { id_promo: 'p-valida', stato: STATO_PROMO.VALIDA },
  { id_promo: 'p-eliminata', stato: STATO_PROMO.ELIMINATA },
];
const AREE = [{ id_aree: 'a1', nome_aree: 'Nord' }];
const CANALI = [{ id_canali: 'c1', nome_canali: 'Volantino cartaceo' }];

// Applica le condizioni usate dal servizio (uguaglianza, Op.in, Op.ne), come farebbe il DB
const soddisfa = (riga: Riga, where: Record<string, any> = {}) =>
  Object.entries(where).every(([campo, condizione]) => {
    const valore = riga[campo];
    if (condizione !== null && typeof condizione === 'object') {
      if (Op.in in condizione) return condizione[Op.in].includes(valore);
      if (Op.ne in condizione) return valore !== condizione[Op.ne];
    }
    return valore === condizione;
  });
const tabella = (righe: Riga[]) => async (opzioni: any) => righe.filter((riga) => soddisfa(riga, opzioni?.where)) as any;

const preparaDb = (kits: Riga[], files: Riga[]) => ({
  kit: vi.spyOn(RuntimeKit, 'findAll').mockImplementation(tabella(kits)),
  tipi: vi.spyOn(TipiDiExport, 'findAll').mockImplementation(tabella(TIPI)),
  promo: vi.spyOn(Promo, 'findAll').mockImplementation(tabella(PROMO)),
  files: vi.spyOn(FilesRuntime, 'findAll').mockImplementation(tabella(files)),
  aree: vi.spyOn(Area, 'findAll').mockImplementation(tabella(AREE)),
  canali: vi.spyOn(Canale, 'findAll').mockImplementation(tabella(CANALI)),
});

const creaService = () => {
  const tipoExportService = { getTipoExportById: vi.fn() };
  const service = new FileManagementService(
    {} as any, tipoExportService as any, {} as any, {} as any, {} as any, {} as any, {} as any
  );
  return { service, tipoExportService };
};

const idKit = (volantini: Array<{ idKit: string }>) => volantini.map((v) => v.idKit);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FileManagementService.getAllCombinazioniRuntimePDF: pagina Volantini', () => {
  it('mostra solo i kit pubblicati di promo non eliminate', async () => {
    preparaDb(
      [kit('k-ok'), kit('k-lavorazione', 'p-valida', { stato: IN_LAVORAZIONE }), kit('k-promo-eliminata', 'p-eliminata'), kit('k-promo-cancellata', 'p-cancellata')],
      [file('k-ok', 'A.pdf'), file('k-lavorazione', 'B.pdf'), file('k-promo-eliminata', 'C.pdf'), file('k-promo-cancellata', 'D.pdf')]
    );
    const { service } = creaService();

    expect(idKit(await service.getAllCombinazioniRuntimePDF())).toEqual(['k-ok']);
  });

  it('restituisce un solo elemento per kit, con tutti i suoi file del tipo richiesto', async () => {
    preparaDb([kit('k1')], [file('k1', 'A.pdf'), file('k1', 'B.pdf'), file('k1', 'C.pdf', 'tipo-dig')]);
    const { service } = creaService();

    const volantino = (nome: string) => ({
      nome_file: nome,
      id_olimpo_cloud: `olimpo-${nome}`,
      tipo_export: 'tipo-vol',
      codice_tipiexport: EXPORT_DI_SISTEMA.VOL,
      idPromo: 'p-valida',
      url: `/olimpo/materiali/getThumbnailMaterialePdfs?id=olimpo-${nome}`,
      url_download: `/olimpo/materiali/getMaterialePDF?id=olimpo-${nome}`,
    });
    expect(await service.getAllCombinazioniRuntimePDF()).toEqual([{
      idKit: 'k1',
      idArea: 'a1',
      idCanale: 'c1',
      nomeArea: 'Nord',
      nomeCanale: 'Volantino cartaceo',
      files_field: [volantino('A.pdf'), volantino('B.pdf')],
    }]);
  });

  it('omette i kit senza file, anche quando i file non sono ancora su Olimpo', async () => {
    preparaDb(
      [kit('k-con-file'), kit('k-senza-file'), kit('k-non-caricato')],
      [file('k-con-file', 'A.pdf'), file('k-non-caricato', 'B.pdf', 'tipo-vol', null)]
    );
    const { service } = creaService();

    expect(idKit(await service.getAllCombinazioniRuntimePDF())).toEqual(['k-con-file']);
  });

  it('un canale mancante esclude solo il suo kit, senza far fallire l elenco', async () => {
    preparaDb([kit('k1'), kit('k2', 'p-valida', { canale: 'c-cancellato' })], [file('k1', 'A.pdf'), file('k2', 'B.pdf')]);
    const { service } = creaService();

    expect(idKit(await service.getAllCombinazioniRuntimePDF())).toEqual(['k1']);
    expect(log.warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ idKit: 'k2', idCanale: 'c-cancellato' }));
  });

  it('legge tipi di export, promo, file, aree e canali una volta sola, non per kit o per file', async () => {
    const db = preparaDb(
      [kit('k1'), kit('k2'), kit('k3')],
      [file('k1', 'A.pdf'), file('k1', 'B.pdf'), file('k2', 'C.pdf'), file('k3', 'D.pdf')]
    );
    const { service, tipoExportService } = creaService();

    expect(await service.getAllCombinazioniRuntimePDF()).toHaveLength(3);
    expect(db.tipi).toHaveBeenCalledTimes(1);
    expect(db.tipi.mock.calls[0][0]).toMatchObject({ where: { codice_tipiexport: EXPORT_DI_SISTEMA.VOL } });
    expect(tipoExportService.getTipoExportById).not.toHaveBeenCalled();
    for (const spia of [db.kit, db.promo, db.files, db.aree, db.canali]) {
      expect(spia).toHaveBeenCalledTimes(1);
    }
  });
});

describe('FileManagementService.getAllCombinazioniRuntimePDFWebPliant', () => {
  it('mostra un elemento per kit pubblicato che prevede i tipi richiesti, con i soli file di quei tipi', async () => {
    preparaDb(
      [kit('k-ok'), kit('k-lavorazione', 'p-valida', { stato: IN_LAVORAZIONE }), kit('k-altro-tipo', 'p-valida', { tipi: ['tipo-dig'] })],
      [file('k-ok', 'A.pdf'), file('k-ok', 'B.pdf'), file('k-ok', 'C.pdf', 'tipo-dig'), file('k-lavorazione', 'D.pdf'), file('k-altro-tipo', 'E.pdf', 'tipo-dig')]
    );
    const { service } = creaService();

    const volantini = await service.getAllCombinazioniRuntimePDFWebPliant('a1', 'c1', [], ['tipo-vol']);

    expect(idKit(volantini)).toEqual(['k-ok']);
    expect(volantini[0].files_field.map((f) => [f.nome_file, f.codice_tipiexport])).toEqual([
      ['A.pdf', EXPORT_DI_SISTEMA.VOL],
      ['B.pdf', EXPORT_DI_SISTEMA.VOL],
    ]);
  });

  it('senza tipi di export richiesti restituisce un elenco vuoto senza interrogare il DB', async () => {
    const db = preparaDb([kit('k1')], [file('k1', 'A.pdf')]);
    const { service } = creaService();

    expect(await service.getAllCombinazioniRuntimePDFWebPliant('a1', 'c1', [], [])).toEqual([]);
    expect(db.kit).not.toHaveBeenCalled();
  });
});
