import { beforeEach, describe, expect, it, vi } from 'vitest';

const modello = vi.hoisted(() => ({ findOne: vi.fn(), update: vi.fn(), create: vi.fn() }));

vi.mock('../../models/config', () => ({ Config: modello }));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ConfigService } from '../ConfigService';

beforeEach(() => {
  modello.findOne.mockReset();
  modello.update.mockReset().mockResolvedValue([1]);
  modello.create.mockReset().mockResolvedValue({});
});

describe('ConfigService.caricaStiliInConfig', () => {
  it('cambia solo css_text e conserva il resto della configurazione WebPliant', async () => {
    const webpliant = {
      css_text: '.vecchio{}',
      stili: [{ nome: 'base' }],
      logo_header: [{ url: '/olimpo/foto/getThumbNailOnDemand?guidId=l1' }],
      icona_pagina: 'g1',
      data_fields_refs: [{ expected_input: 'Referenza.Codice', expected_output: 'codice_referenza' }],
    };
    modello.findOne.mockResolvedValue({ get: (campo: string) => (campo === 'webpliant' ? webpliant : undefined) });

    await new ConfigService().caricaStiliInConfig('cfg-1', '.nuovo{}');

    expect(modello.update).toHaveBeenCalledWith(
      { webpliant: { ...webpliant, css_text: '.nuovo{}' } },
      { where: { id: 'cfg-1' } }
    );
  });
});
