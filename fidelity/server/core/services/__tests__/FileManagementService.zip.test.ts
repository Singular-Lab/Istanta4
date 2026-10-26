import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../../../../lib/errors';
import { FileManagementService } from '../FileManagementService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

async function creaZip(voci: { nome: string; contenuto: Buffer | string }[]): Promise<Buffer> {
  const archivio = archiver('zip');
  const uscita = new PassThrough();
  const parti: Buffer[] = [];
  uscita.on('data', (parte: Buffer) => parti.push(parte));
  const fine = new Promise<void>((resolve, reject) => {
    uscita.on('end', resolve);
    archivio.on('error', reject);
  });
  archivio.pipe(uscita);
  for (const voce of voci) {
    archivio.append(voce.contenuto, { name: voce.nome });
  }
  await archivio.finalize();
  await fine;
  return Buffer.concat(parti);
}

const scartato = (nome: string) => ({ nome } as any);
const service = new FileManagementService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);

describe('FileManagementService.processRejectedZip', () => {
  it('restituisce i file scartati presenti nello ZIP, una sola volta per nome', async () => {
    const zip = await creaZip([
      { nome: 'a.pdf', contenuto: 'primo' },
      { nome: 'cartella/a.pdf', contenuto: 'secondo' },
      { nome: 'estraneo.pdf', contenuto: 'ignorato' },
    ]);

    const risultato = await service.processRejectedZip(zip, [scartato('a.pdf'), scartato('mancante.pdf')]);

    expect(risultato).toHaveLength(1);
    expect(risultato[0].newFile.name).toBe('a.pdf');
    expect(Buffer.from(risultato[0].newFile.content, 'base64').toString()).toBe('primo');
  });

  it('oltre 500 file nello ZIP: errore e nessuna elaborazione', async () => {
    const zip = await creaZip(Array.from({ length: 501 }, (_, i) => ({ nome: `f${i}.pdf`, contenuto: 'x' })));

    await expect(service.processRejectedZip(zip, [])).rejects.toThrow(BadRequestError);
    await expect(service.processRejectedZip(zip, [])).rejects.toThrow(/500 file/);
  });

  it('un file oltre 50 MB decompressi: errore', async () => {
    const zip = await creaZip([{ nome: 'grande.pdf', contenuto: Buffer.alloc(50 * 1024 * 1024 + 1) }]);

    await expect(service.processRejectedZip(zip, [scartato('grande.pdf')])).rejects.toThrow(/50 MB/);
  });
});
