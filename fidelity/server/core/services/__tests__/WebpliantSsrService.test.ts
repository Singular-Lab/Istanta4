import { afterEach, describe, expect, it, vi } from 'vitest';
import { TIPO_PAGINA } from '../../../../lib/enums';
import type { Config, DataWebPliant, ReferenzeIstanta } from '../../../../lib/types';
import type { IConfigService } from '../../interfaces/IConfigService';
import type { IReferenzeService } from '../../interfaces/IReferenzeService';
import type { IWebPliantService } from '../../interfaces/IWebPliantService';
import { WebpliantSsrService } from '../WebpliantSsrService';

function creaServizio() {
  const workspace = {
    nomeWorkspace: 'Volantino di test', idWorkspace: 'w1', idArea: 'a1', idCanale: 'c1', idGDO: 'g1',
    webpliant: [{ id: 'home', tipo: TIPO_PAGINA.HOMEPAGE, struttura: [
      { id: 'griglia', type: 'griglia_referenze', content: {} },
      { id: 'carosello', type: 'carousel', content: {} },
    ] }],
  } as unknown as DataWebPliant;
  const workspaceService = {
    prendiWorkspaceDaID: vi.fn().mockResolvedValue(workspace),
    getDataValiditaPerCarosello: vi.fn().mockResolvedValue('Valido oggi'),
  };
  const referenzeService = {
    getFilteredReferenze: vi.fn<IReferenzeService['getFilteredReferenze']>().mockImplementation(async (_workspace, _giorno, area) => [
      { id: 'ref1', dataFields: { descrizione: `Latte ${area}`, prezzo: '1,99' } } as unknown as ReferenzeIstanta,
    ]),
  };
  const configService = {
    get_config: vi.fn().mockResolvedValue({ webpliant: { stili: [] }, color: 'test', dashboard: { interno: true } } as unknown as Config),
    getStiliToText: vi.fn().mockResolvedValue('.volantino { color: red; }'),
  };
  const servizio = new WebpliantSsrService(
    workspaceService as unknown as IWebPliantService,
    referenzeService as unknown as IReferenzeService,
    configService as unknown as IConfigService,
  );
  return { servizio, workspaceService, referenzeService, configService };
}

afterEach(() => { vi.useRealTimers(); });

describe('dati del volantino SSR pubblico', () => {
  it('carica homepage e blocchi con i servizi pubblici, senza configurazione privata', async () => {
    const { servizio, workspaceService, referenzeService } = creaServizio();
    const dati = await servizio.carica(new URL('http://test/webpliant/volantino?id=w1&idArea=a1&idCanale=c1'));
    expect(workspaceService.prendiWorkspaceDaID).toHaveBeenCalledWith('w1', false);
    expect(dati.idPagina).toBe('home');
    expect(Object.keys(dati.blocchi)).toEqual(['griglia', 'carosello']);
    expect(dati.blocchi.carosello.validita).toBe('Valido oggi');
    expect(dati.config).not.toHaveProperty('dashboard');
    for (const chiamata of referenzeService.getFilteredReferenze.mock.calls) {
      expect(chiamata[2]).toBe('a1');
      expect(chiamata[3]).toBe('c1');
      expect(chiamata[6]).toBe(false);
    }
  });

  it.each(['id=w1&idCanale=c1', 'id=w1&idArea=a1', 'idArea=a1&idCanale=c1'])('rifiuta parametri mancanti: %s', async query => {
    const { servizio, workspaceService } = creaServizio();
    await expect(servizio.carica(new URL(`http://test/webpliant/volantino?${query}`))).rejects.toMatchObject({ httpStatus: 400 });
    expect(workspaceService.prendiWorkspaceDaID).not.toHaveBeenCalled();
  });

  it('rifiuta una pagina inesistente e propaga gli errori di caricamento', async () => {
    const { servizio, referenzeService } = creaServizio();
    await expect(servizio.carica(new URL('http://test/webpliant/volantino?id=w1&idArea=a1&idCanale=c1&idPagina=assente'))).rejects.toMatchObject({ httpStatus: 404 });
    referenzeService.getFilteredReferenze.mockRejectedValue(new Error('Errore isolato di test'));
    await expect(servizio.carica(new URL('http://test/webpliant/volantino?id=w1&idArea=a1&idCanale=c1'))).rejects.toThrow('Errore isolato di test');
  });

  it('usa il giorno corrente di Roma anche se viene passata una data futura', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-03T23:30:00Z'));
    const { servizio, referenzeService } = creaServizio();
    const dati = await servizio.carica(new URL('http://test/webpliant/volantino?id=w1&idArea=a1&idCanale=c1&date=2099-01-01'));
    expect(dati.giorno).toBe('2026-11-04');
    expect(referenzeService.getFilteredReferenze.mock.calls[0][1]).toBe('2026-11-04');
  });

  it('mantiene separati i dati di richieste contemporanee', async () => {
    const { servizio } = creaServizio();
    const [prima, seconda] = await Promise.all(['a1', 'a2'].map(area =>
      servizio.carica(new URL(`http://test/webpliant/volantino?id=w1&idArea=${area}&idCanale=c1`))));
    expect(prima.blocchi.griglia.referenze[0].dataFields.descrizione).toBe('Latte a1');
    expect(seconda.blocchi.griglia.referenze[0].dataFields.descrizione).toBe('Latte a2');
    expect(prima.blocchi).not.toBe(seconda.blocchi);
  });
});
