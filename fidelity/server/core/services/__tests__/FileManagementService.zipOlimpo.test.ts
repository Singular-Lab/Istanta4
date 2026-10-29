import { PassThrough } from 'node:stream';
import unzipper from 'unzipper';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErroreHttp } from '../../http/clienteHttp';
import { ErroreRispostaOlimpo, scaricaMaterialePdf } from '../../http/olimpo';
import { DOWNLOAD_ZIP_IN_PARALLELO, FILE_MANCANTI_ZIP, FileManagementService } from '../FileManagementService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Olimpo finto: si decide per ogni id cosa restituisce lo scaricamento del PDF
vi.mock('../../http/olimpo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../http/olimpo')>()),
  scaricaMaterialePdf: vi.fn(),
}));

const scarica = vi.mocked(scaricaMaterialePdf);
const service = new FileManagementService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
const file = (nome: string, idOlimpo?: string, nomeKit?: string) =>
  ({ id: nome, nome, id_olimpo_cloud: idOlimpo, nome_kit: nomeKit }) as any;

async function contenutoZip(zip: Buffer): Promise<Record<string, string>> {
  const archivio = await unzipper.Open.buffer(zip);
  const voci: Record<string, string> = {};
  for (const voce of archivio.files) {
    voci[voce.path] = (await voce.buffer()).toString();
  }
  return voci;
}

afterEach(() => {
  scarica.mockReset();
});

describe('ZIP dei PDF di Olimpo', () => {
  it(`scarica al massimo ${DOWNLOAD_ZIP_IN_PARALLELO} file alla volta e li mette tutti nell'archivio`, async () => {
    let inCorso = 0;
    let massimo = 0;
    scarica.mockImplementation(async (id: string) => {
      inCorso++;
      massimo = Math.max(massimo, inCorso);
      await new Promise(resolve => setTimeout(resolve, 5));
      inCorso--;
      return Buffer.from(`pdf ${id}`);
    });
    const files = Array.from({ length: 12 }, (_, i) => file(`volantino_${i}.pdf`, `id-${i}`));

    const voci = await contenutoZip(await service.downloadFilesAsZip(files));

    expect(massimo).toBe(DOWNLOAD_ZIP_IN_PARALLELO);
    expect(scarica).toHaveBeenCalledTimes(12);
    expect(Object.keys(voci).sort()).toEqual(files.map(f => f.nome).sort());
    expect(voci['volantino_3.pdf']).toBe('pdf id-3');
    expect(voci[FILE_MANCANTI_ZIP]).toBeUndefined();
  });

  it(`i file che non arrivano non spariscono: ${FILE_MANCANTI_ZIP} li elenca con il motivo, senza dettagli tecnici`, async () => {
    scarica.mockImplementation(async (id: string) => {
      if (id === 'id-lento') throw new ErroreHttp('timeout', 'http://10.0.0.5:3000/materiali/getMaterialePDF', false);
      if (id === 'id-assente') throw new ErroreRispostaOlimpo('/materiali/getMaterialePDF', 404);
      return Buffer.from('pdf');
    });
    const files = [
      file('ok.pdf (Lavorazione: L1)', 'id-ok', 'Kit A'),
      file('lento.pdf', 'id-lento', 'Kit A'),
      file('assente.pdf', 'id-assente', 'Kit B'),
      file('senza-id.pdf', undefined, 'Kit B'),
    ];

    const voci = await contenutoZip(await service.downloadPromoFilesAsZip(files, 'Promo'));

    expect(Object.keys(voci).sort()).toEqual([FILE_MANCANTI_ZIP, 'Kit A/ok.pdf']);
    const mancanti = voci[FILE_MANCANTI_ZIP];
    expect(mancanti).toContain('Kit A/lento.pdf: Olimpo non ha risposto in tempo');
    expect(mancanti).toContain('Kit B/assente.pdf: file non trovato su Olimpo');
    expect(mancanti).toContain('Kit B/senza-id.pdf: file non presente su Olimpo');
    expect(mancanti).not.toContain('10.0.0.5');
    // Il file senza id non viene neanche chiesto a Olimpo
    expect(scarica).toHaveBeenCalledTimes(3);
  });
});

describe('ZIP dei PDF di Olimpo scritto in uno stream', () => {
  it('lo stesso archivio, senza tenerlo in memoria: si risolve quando la destinazione ha ricevuto tutto', async () => {
    scarica.mockImplementation(async (id: string) => {
      if (id === 'id-assente') throw new ErroreRispostaOlimpo('/materiali/getMaterialePDF', 404);
      return Buffer.from(`pdf ${id}`);
    });
    const destinazione = new PassThrough();
    const parti: Buffer[] = [];
    destinazione.on('data', (parte: Buffer) => parti.push(parte));
    const letto = new Promise<void>(resolve => destinazione.on('end', () => resolve()));

    const esito = await service.scriviZipDaOlimpo(
      [{ file: { id_olimpo_cloud: 'id-1' }, nome: 'Kit A/a.pdf' }, { file: { id_olimpo_cloud: 'id-assente' }, nome: 'Kit A/b.pdf' }],
      destinazione
    );
    await letto;

    expect(esito).toEqual({ file: 1, mancanti: 1 });
    const voci = await contenutoZip(Buffer.concat(parti));
    expect(Object.keys(voci).sort()).toEqual([FILE_MANCANTI_ZIP, 'Kit A/a.pdf']);
    expect(voci['Kit A/a.pdf']).toBe('pdf id-1');
  });

  it('destinazione chiusa a meta\' (il browser interrompe il download): i download che restano non partono e la promessa e\' rifiutata', async () => {
    const destinazione = new PassThrough();
    destinazione.resume();
    scarica.mockImplementation(async (id: string) => {
      if (id === 'id-0') destinazione.destroy();
      await new Promise(resolve => setTimeout(resolve, 5));
      return Buffer.from(`pdf ${id}`);
    });
    const files = Array.from({ length: 12 }, (_, i) => ({ file: { id_olimpo_cloud: `id-${i}` }, nome: `volantino_${i}.pdf` }));

    await expect(service.scriviZipDaOlimpo(files, destinazione)).rejects.toBeInstanceOf(Error);
    expect(scarica.mock.calls.length).toBeLessThanOrEqual(DOWNLOAD_ZIP_IN_PARALLELO);
  });
});
