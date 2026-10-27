import { describe, expect, it, vi } from 'vitest';
import { TIPO_KIT_DESIGN } from '../../../../lib/enums';
import { FileManagementService } from '../FileManagementService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
// Campi meta dei file in cui cerca anche il nome, come da configurazione dell'installazione
vi.mock('../configPerGdo', () => ({
  trovaConfigInstallazione: vi.fn().mockResolvedValue({ webpliant: { data_fields_files: ['didascalia'] } })
}));

const kit = (id: string, titolo: string) => ({ id, titolo, tipo: TIPO_KIT_DESIGN.MANUALE, id_promo: 'promo-1' });
const file = (nome: string, meta?: Record<string, unknown>) => ({
  nome,
  id_olimpo_cloud: `olimpo-${nome}`,
  tipo_export: 'tipo-stampa',
  meta_olimpo_cloud: meta,
});

const creaService = (kits: ReturnType<typeof kit>[], filePerKit: Record<string, ReturnType<typeof file>[]>) => {
  const kitRuntimeService = {
    getAllCombinazioniRuntimeFilters: vi.fn().mockResolvedValue(kits),
    getFilesRuntimeByIdKitRuntimeFilters: vi.fn(({ id_runtime }: { id_runtime: string }) => Promise.resolve(filePerKit[id_runtime] ?? [])),
  };
  const tipoExportService = { getAllTipiExport: vi.fn().mockResolvedValue([]) };
  const promoRepository = { findById: vi.fn().mockResolvedValue(null) };
  const service = new FileManagementService(
    kitRuntimeService as any, tipoExportService as any, {} as any, {} as any, {} as any, {} as any, promoRepository as any
  );
  return { service, kitRuntimeService };
};

const nomiTrovati = (risultato: any): string[] =>
  risultato.promos.flatMap((p: any) => p.kits.flatMap((k: any) => k.files.map((f: any) => f.nome)));

const cerca = (service: FileManagementService, nome: string) => service.getAllContenutiDigitali(1, 10, { nome });

describe('FileManagementService.getAllContenutiDigitali: ricerca per nome', () => {
  it('il nome non viene passato alla ricerca dei kit, che altrimenti filtrerebbe sul titolo', async () => {
    const { service, kitRuntimeService } = creaService([], {});

    await cerca(service, 'roma');

    const filtriKit = kitRuntimeService.getAllCombinazioniRuntimeFilters.mock.calls[0][0];
    expect(filtriKit).not.toHaveProperty('nome');
  });

  it('un file si trova per nome anche se il titolo del kit non contiene il termine', async () => {
    const { service } = creaService(
      [kit('k1', 'Volantino ottobre')],
      { k1: [file('Locandina ROMA.pdf'), file('Retro.pdf')] }
    );

    expect(nomiTrovati(await cerca(service, 'roma'))).toEqual(['Locandina ROMA.pdf']);
  });

  it('se il titolo del kit contiene il termine restituisce tutti i suoi file', async () => {
    const { service } = creaService(
      [kit('k1', 'Speciale Roma'), kit('k2', 'Volantino ottobre')],
      { k1: [file('A.pdf'), file('B.pdf')], k2: [file('C.pdf')] }
    );

    expect(nomiTrovati(await cerca(service, 'roma'))).toEqual(['A.pdf', 'B.pdf']);
  });

  it('cerca anche nei campi meta configurati, testo semplice o con content', async () => {
    const { service } = creaService(
      [kit('k1', 'Volantino ottobre')],
      {
        k1: [
          file('D.pdf', { didascalia: 'Offerte di Roma' }),
          file('E.pdf', { didascalia: { content: 'Speciale ROMA nord' } }),
          file('F.pdf', { altro: 'Roma' }),
        ],
      }
    );

    expect(nomiTrovati(await cerca(service, 'roma'))).toEqual(['D.pdf', 'E.pdf']);
  });

  it('senza corrispondenze non restituisce promo', async () => {
    const { service } = creaService([kit('k1', 'Volantino ottobre')], { k1: [file('Retro.pdf')] });

    const risultato = await cerca(service, 'napoli');

    expect(risultato.promos).toEqual([]);
    expect(risultato.totalItems).toBe(0);
  });
});
