import * as XLSX from 'xlsx';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestError, DatabaseError, NotFoundError } from '../../../../lib/errors';
import type { TracciatiAttributes } from '../../../../lib/types';
import type { ITracciatiRepository } from '../../repositories/TracciatiRepository';
import { TracciatoService } from '../TracciatoService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/**
 * Anteprima del tracciato (GET /api/tracciati/:id/parse): l'Excel si crea in memoria con
 * SheetJS, come lo carica il marketing; nessun file binario nel repository.
 */

type ValoreFoglio = string | number | Date | null | XLSX.CellObject;
type FoglioProva = { nome: string; righe: ValoreFoglio[][]; area?: string };

function creaExcel(fogli: FoglioProva[]): Uint8Array {
  const workbook = XLSX.utils.book_new();
  for (const foglio of fogli) {
    const worksheet = XLSX.utils.aoa_to_sheet(foglio.righe);
    // Area usata dichiarata dal file, come la scrive Excel (es. B3:C4 se i dati partono da B3)
    if (foglio.area) worksheet['!ref'] = foglio.area;
    XLSX.utils.book_append_sheet(workbook, worksheet, foglio.nome);
  }
  const contenuto: unknown = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  // Il modello salva il file come Uint8Array (bytea)
  return new Uint8Array(contenuto as Buffer);
}

function creaService(righe: Record<string, Partial<TracciatiAttributes>>) {
  const repository = {
    findById: vi.fn(async (id: string) => righe[id] ?? null),
    findByPromoId: vi.fn(async () => []),
  };
  const service = new TracciatoService(repository as unknown as ITracciatiRepository);
  return { service, repository };
}

// Senza blob: la riga del tracciato non ha il file
const tracciatoConFile = (blob?: Uint8Array): Partial<TracciatiAttributes> => ({
  id_tracciati: 't1',
  id_promo_tracciati: 'promo-1',
  filename_tracciati: 'ufi.xlsx',
  ...(blob && { blobfile_tracciati: blob }),
});

async function leggi(fogli: FoglioProva[]) {
  const { service } = creaService({ t1: tracciatoConFile(creaExcel(fogli)) });
  return service.parseTracciatoById('t1');
}

describe('TracciatoService.parseTracciatoById: contenuto delle celle', () => {
  it('restituisce tutti i fogli con il loro nome, nell\'ordine del file', async () => {
    const { sheets } = await leggi([
      { nome: 'Referenze', righe: [['Codice', 'Descrizione'], ['A1', 'Pasta']] },
      { nome: 'Prezzi 2026', righe: [['Codice', 'Prezzo']] },
    ]);

    expect(sheets.map((s) => s.name)).toEqual(['Referenze', 'Prezzi 2026']);
    expect(sheets[0].rows).toEqual([['Codice', 'Descrizione'], ['A1', 'Pasta']]);
    expect(sheets[1].rows).toEqual([['Codice', 'Prezzo']]);
  });

  it('una cella vuota vale sempre null, sia assente sia con testo vuoto', async () => {
    const { sheets } = await leggi([
      { nome: 'Foglio', righe: [['Codice', 'Note', 'Prezzo'], ['A1', '', null], [null, 'x', '']] },
    ]);

    expect(sheets[0].rows).toEqual([
      ['Codice', 'Note', 'Prezzo'],
      ['A1', null, null],
      [null, 'x', null],
    ]);
  });

  it('mantiene le righe vuote in mezzo con il numero di riga del file', async () => {
    const { sheets } = await leggi([
      { nome: 'Foglio', righe: [['Codice'], [], [], ['A1']] },
    ]);

    expect(sheets[0].rows).toEqual([['Codice'], [null], [null], ['A1']]);
  });

  it('un foglio con i dati da B3 mantiene righe e colonne di Excel', async () => {
    const { sheets } = await leggi([
      { nome: 'Foglio', righe: [[], [], [null, 'Codice', 'Prezzo'], [null, 'A1', 2]], area: 'B3:C4' },
    ]);

    const righe = sheets[0].rows;
    expect(righe).toHaveLength(4);
    expect(righe[0]).toEqual([null, null, null]);
    expect(righe[2]).toEqual([null, 'Codice', 'Prezzo']);
    expect(righe[3]).toEqual([null, 'A1', '2']);
  });

  it('i numeri arrivano come testo con il loro valore', async () => {
    const { sheets } = await leggi([
      { nome: 'Foglio', righe: [[1.5, 12345, -3, 0.25]] },
    ]);

    expect(sheets[0].rows).toEqual([['1.5', '12345', '-3', '0.25']]);
  });

  it('un EAN salvato come numero mostra tutte le cifre e si trova nella sua riga', async () => {
    // Solo la riga 120 contiene l'EAN 8001234567890, salvato come numero
    const righe: ValoreFoglio[][] = Array.from({ length: 119 }, (_, i) => [`R${i + 1}`, null]);
    righe.push(['R120', 8001234567890]);

    const { sheets } = await leggi([{ nome: 'Foglio', righe }]);

    const trovate = sheets[0].rows.flatMap((riga, indice) => (riga.includes('8001234567890') ? [indice + 1] : []));
    expect(trovate).toEqual([120]);
    expect(sheets[0].rows[119]).toEqual(['R120', '8001234567890']);
  });

  it('i decimali e i numeri fino a 11 cifre restano formattati come prima', async () => {
    const { sheets } = await leggi([
      { nome: 'Foglio', righe: [[1.5, 1234567.891, 12345678901, 0.1 + 0.2]] },
    ]);

    expect(sheets[0].rows).toEqual([['1.5', '1234567.891', '12345678901', '0.3']]);
  });

  it('i codici con zeri iniziali scritti come testo restano testo', async () => {
    const { sheets } = await leggi([
      { nome: 'Foglio', righe: [['00123', '0008001234567890', '0']] },
    ]);

    expect(sheets[0].rows).toEqual([['00123', '0008001234567890', '0']]);
  });

  it('le date compaiono come gg/mm/aaaa', async () => {
    const { sheets } = await leggi([
      {
        nome: 'Foglio',
        righe: [[
          new Date(2026, 9, 28),
          // Data corta di Excel: numero seriale con il formato 14 (m/d/yy)
          { t: 'n', v: 46027, z: 'm/d/yy' },
          new Date(2026, 0, 5, 14, 30),
        ]],
      },
    ]);

    expect(sheets[0].rows).toEqual([['28/10/2026', '05/01/2026', '05/01/2026']]);
  });
});

describe('TracciatoService.parseTracciatoById: errori', () => {
  it('un tracciato inesistente è NotFoundError, non un errore del database', async () => {
    const { service } = creaService({});

    const errore = await service.parseTracciatoById('inesistente').catch((e: unknown) => e);

    expect(errore).toBeInstanceOf(NotFoundError);
    expect(errore).not.toBeInstanceOf(DatabaseError);
  });

  it('un tracciato senza file è BadRequestError', async () => {
    const { service } = creaService({ t1: tracciatoConFile() });

    await expect(service.parseTracciatoById('t1')).rejects.toBeInstanceOf(BadRequestError);
  });

  it('un errore imprevisto del repository resta un DatabaseError', async () => {
    const { service, repository } = creaService({});
    repository.findById.mockRejectedValueOnce(new Error('connessione persa'));

    await expect(service.parseTracciatoById('t1')).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('TracciatoService.getAllTracciatiPerPromo', () => {
  it('senza promo è BadRequestError, non un errore del database', async () => {
    const { service, repository } = creaService({});

    await expect(service.getAllTracciatiPerPromo('')).rejects.toBeInstanceOf(BadRequestError);
    expect(repository.findByPromoId).not.toHaveBeenCalled();
  });
});
