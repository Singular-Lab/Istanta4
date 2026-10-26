import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseError } from '../../../../lib/errors';
import { log } from '../../logger';
import { OrdiniDiStampa } from '../../models/ordini_di_stampa';
import { OrdiniStampaService } from '../OrdiniStampaService';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OrdiniStampaService.getAllOrdiniDiStampaInCorso', () => {
  it('se la query fallisce registra l\'errore originale e lo rilancia come DatabaseError', async () => {
    const erroreDb = new Error('relation "ordini_stampa" does not exist');
    vi.spyOn(OrdiniDiStampa, 'findAll').mockRejectedValue(erroreDb);
    const logError = vi.spyOn(log, 'error').mockImplementation(() => {});
    const service = new OrdiniStampaService({} as any, {} as any);

    await expect(service.getAllOrdiniDiStampaInCorso()).rejects.toBeInstanceOf(DatabaseError);
    expect(logError).toHaveBeenCalledWith('Errore durante il recupero degli ordini in corso:', erroreDb);
  });
});
