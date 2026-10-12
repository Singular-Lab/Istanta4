import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { TraduzioneService } from '../TraduzioneService';

let radice: string;
let build: string;
let sorgente: string;

const scrivi = (cartella: string, lingua: string, contenuto: object) => {
  fs.mkdirSync(path.join(cartella, lingua), { recursive: true });
  fs.writeFileSync(path.join(cartella, lingua, 'translation.json'), JSON.stringify(contenuto));
};

beforeEach(() => {
  radice = fs.mkdtempSync(path.join(os.tmpdir(), 'fidelity-locales-'));
  build = path.join(radice, 'dist', 'client', 'locales');
  sorgente = path.join(radice, 'public', 'locales');
});

afterEach(() => {
  fs.rmSync(radice, { recursive: true, force: true });
});

describe('TraduzioneService', () => {
  it('nell immagine Docker, senza public/, legge le traduzioni dalla build del client', async () => {
    scrivi(build, 'it-IT', { saluto: 'ciao' });

    const service = new TraduzioneService([build, sorgente]);

    expect(await service.getTraduzioni('it-IT', 'translation')).toEqual({ saluto: 'ciao' });
    expect(await service.getTraduzioni('it', 'translation')).toEqual({ saluto: 'ciao' });
  });

  it('in sviluppo, senza build, usa public/locales', async () => {
    scrivi(sorgente, 'it-IT', { saluto: 'sorgente' });

    const service = new TraduzioneService([build, sorgente]);

    expect(await service.getTraduzioni('it', 'translation')).toEqual({ saluto: 'sorgente' });
  });

  it('una lingua che non esiste restituisce un oggetto vuoto', async () => {
    scrivi(sorgente, 'it-IT', { saluto: 'ciao' });

    const service = new TraduzioneService([build, sorgente]);

    expect(await service.getTraduzioni('en', 'translation')).toEqual({});
  });
});
