import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseError, ExternalApiError } from '../../../../lib/errors';
import { Referenze } from '../../models/referenze';
import { ReferenzeGruppo } from '../../models/referenze_gruppo';
import { ServerUtils } from '../../utils/ServerUtils';
import { FileManagementService } from '../FileManagementService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const immagine = { buffer: Buffer.from('png'), originalname: 'logo.png', mimetype: 'image/png' } as Express.Multer.File;
const req = { session: { id_utente: 'u1' }, headers: {} } as any;
const service = new FileManagementService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);

function mockOlimpo(risposta: unknown) {
  return vi.spyOn(ServerUtils, 'sendToFicoApiAxiosUpload').mockResolvedValue({ data: risposta, status: 200 } as any);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('credenziali Olympus nei metodi immagine', () => {
  // Il body puo contenere una private_key: non deve essere usata, vale solo la sessione
  it.each([
    ['uploadForzatoImmaginiOlimpo', () => service.uploadForzatoImmaginiOlimpo(immagine, 'guid-1', req)],
    ['updateImmagineReferenza', () => service.updateImmagineReferenza(immagine, { guidId: 'guid-1', guidIdReferenza: 'r1', private_key: 'chiave-dal-body' }, req)],
    ['updateImmagineGruppoReferenza', () => service.updateImmagineGruppoReferenza(immagine, { guidId: 'r1', idArea: 'a1', idCanale: 'c1', private_key: 'chiave-dal-body' }, req)],
  ])('%s: passa dal passaporto della sessione e con esito false segnala errore', async (_metodo, chiama) => {
    const upload = mockOlimpo({ esito: false, error: 'immagine non valida' });
    const postDiretta = vi.spyOn(axios, 'post').mockRejectedValue(new Error('chiamata diretta non attesa'));

    await expect(chiama()).rejects.toBeInstanceOf(ExternalApiError);

    expect(upload).toHaveBeenCalledOnce();
    // Nessun header personalizzato: l'Authorization la mette ServerUtils dal passaporto dell'utente in sessione
    expect(upload.mock.calls[0]).toEqual([req, expect.stringMatching(/\/foto\/updateFotoPathWeb$/), expect.any(FormData)]);
    expect(postDiretta).not.toHaveBeenCalled();
  });

  it('Olimpo non raggiungibile (risposta senza dati): errore esterno', async () => {
    vi.spyOn(ServerUtils, 'sendToFicoApiAxiosUpload').mockResolvedValue({ data: null, status: 0 } as any);

    await expect(service.uploadForzatoImmaginiOlimpo(immagine, 'guid-1', req)).rejects.toBeInstanceOf(ExternalApiError);
  });
});

describe('FileManagementService.updateImmagineGruppoReferenza', () => {
  function prepara(righeAggiornate: number) {
    const upload = mockOlimpo({ esito: true, guidId: 'foto-nuova' });
    // getReferenzaById restituisce la riga PG grezza, con i campi in data_fields
    vi.spyOn(Referenze, 'findOne').mockResolvedValue({ id: 'r1', data_fields: { codice_referenza: 'C123' } } as any);
    const cercaGruppo = vi.spyOn(ReferenzeGruppo, 'findOne').mockResolvedValue(
      { id: 'gruppo-7', codice_referenza: 'C123', id_area: 'a1', id_canale: 'c1' } as any
    );
    const aggiornaGruppo = vi.spyOn(ReferenzeGruppo, 'update').mockResolvedValue([righeAggiornate] as any);
    const aggiornaReferenza = vi.spyOn(Referenze, 'update').mockResolvedValue([1] as any);
    return { upload, cercaGruppo, aggiornaGruppo, aggiornaReferenza };
  }

  it('aggiorna solo la riga del gruppo trovata, per id', async () => {
    const { upload, cercaGruppo, aggiornaGruppo, aggiornaReferenza } = prepara(1);

    await service.updateImmagineGruppoReferenza(immagine, { guidId: 'r1', idArea: 'a1', idCanale: 'c1' }, req);

    expect(upload.mock.calls[0][0]).toBe(req);
    expect(cercaGruppo).toHaveBeenCalledWith(expect.objectContaining({
      where: { codice_referenza: 'C123', id_area: 'a1', id_canale: 'c1' }
    }));
    expect(aggiornaGruppo).toHaveBeenCalledWith(
      { guid_id_olympo: 'foto-nuova', id_area: 'a1', id_canale: 'c1' },
      { where: { id: 'gruppo-7' } }
    );
    expect(aggiornaReferenza).toHaveBeenCalledOnce();
  });

  it('nessuna riga aggiornata: errore di database e la referenza non viene toccata', async () => {
    const { aggiornaReferenza } = prepara(0);

    await expect(
      service.updateImmagineGruppoReferenza(immagine, { guidId: 'r1', idArea: 'a1', idCanale: 'c1' }, req)
    ).rejects.toBeInstanceOf(DatabaseError);

    expect(aggiornaReferenza).not.toHaveBeenCalled();
  });
});
