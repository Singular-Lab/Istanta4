import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestError, NotFoundError } from '../../../../lib/errors';
import type { IAgenziaLib } from '../../agenzia_lib/types';
import type { LogoDelCatalogo } from '../../interfaces/ICatalogoLoghiService';
import type { IConfigWebpliantGdoRepository, RigaConfigWebpliant } from '../../repositories/ConfigWebpliantGdoRepository';
import type { IImpostazioniGdoRepository, ImpostazioniGdoSalvate } from '../../repositories/ImpostazioniGdoRepository';
import { campiReferenzeDaSalvare, configurazioneInsight, ImpostazioniGdoService } from '../ImpostazioniGdoService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Spec impostazioni-gdo: le impostazioni di una GDO in una pagina sola; ogni salvataggio cambia solo
// la sua sezione (mai la riga config intera) e risponde con le impostazioni aggiornate.

const ID_GDO = '11111111-1111-4111-8111-111111111111';

const CONFIG_FILE = {
  dataMapping: {
    referenzaFields: { reparto: 'data_fields.reparto', descrizioneReparto: 'data_fields.descrizione_reparto' },
    reparti: [{ codice: '01', descrizione: 'DROGHERIA ALIMENTARE' }, { codice: '09', descrizione: 'PROFUMERIA' }],
  },
  reparti: { groupBy: { field: 'reparto', descriptionField: 'descrizioneReparto' } },
};

const CONFIG_GDO = {
  dataMapping: {
    referenzaFields: { codiceReparto: ['data_fields.Referenza.Reparto'], nomeReparto: 'data_fields.Descrizioni.Reparto' },
    reparti: [{ codice: '31', descrizione: 'PESCE' }],
  },
  reparti: { groupBy: { field: 'codiceReparto', descriptionField: 'nomeReparto' } },
};

function crea(opzioni: {
  salvate?: ImpostazioniGdoSalvate | null;
  riga?: RigaConfigWebpliant | null;
  file?: Record<string, unknown> | null;
  agenzia?: Pick<IAgenziaLib, 'insightVolantino'>;
  catalogo?: Map<string, LogoDelCatalogo>;
} = {}) {
  const repository = {
    trova: vi.fn(async (_idGdo: string) => opzioni.salvate ?? null),
    repartiSalvati: vi.fn(async (_idGdo: string) => opzioni.salvate?.reparti ?? []),
    gdo: vi.fn(async (idGdo: string) => (idGdo === ID_GDO ? { id: ID_GDO, nome: 'CONAD CNO', haIcona: true } : null)),
    salvaReparti: vi.fn(async () => undefined),
    salvaInsightVolantino: vi.fn(async () => undefined),
    eliminaInsightVolantino: vi.fn(async () => undefined),
    repartiNelleReferenze: vi.fn(async () => [{ codice: '1', descrizione: null, referenze: 12 }, { codice: '09', descrizione: 'PROFUMERIA', referenze: 3 }]),
  } satisfies IImpostazioniGdoRepository;
  const righeConfig = {
    leggi: vi.fn(async (_idGdo: string) => (opzioni.riga === undefined ? {
      id: 'cfg-1',
      colore: '#9e1b22',
      webpliant: {
        css_text: '.a{color:red}',
        icona_pagina: 'guid-icona',
        logo_header: [{ url: '/olimpo/logo', base64: '' }],
        stili: [{ id: 1 }],
        data_fields_refs: [{ expected_input: 'reparto', expected_output: 'Reparto', core: true }],
        meta_volantino: { title: 'Volantino', description: 'Offerte' },
        altro: 'resta',
      },
    } : opzioni.riga)),
    aggiornaWebpliant: vi.fn(async () => undefined),
    aggiornaColore: vi.fn(async () => undefined),
  } satisfies IConfigWebpliantGdoRepository;
  const configInsight = {
    getFlyerInsightsConfig: vi.fn(async (_idGdo?: string | null) => {
      if (opzioni.file === null) throw new NotFoundError({ message: 'File flyerInsightsConfig.json non trovato', entityType: 'FlyerInsightsConfig' });
      return opzioni.file ?? CONFIG_FILE;
    }),
  };
  const catalogo = { catalogo: vi.fn(async () => opzioni.catalogo ?? new Map<string, LogoDelCatalogo>()) };
  const caricaSuOlimpo = vi.fn(async (_file: Blob, nomeFile: string, _chiave: string | undefined) => (nomeFile.endsWith('.ico') ? 'guid-icona-nuova' : 'guid-logo-nuovo'));
  const dimentica = vi.fn(async (_idGdo: string | null) => undefined);
  const nomeUtente = vi.fn(async (_idUtente: string) => 'Mario Rossi');
  const servizio = new ImpostazioniGdoService(repository, righeConfig, configInsight, opzioni.agenzia ?? {}, catalogo, {
    dizionario: async () => ({ PROFUMERIA: 'Bellezza e igiene' }),
    caricaSuOlimpo,
    dimenticaConfigInsight: dimentica,
    nomeUtente,
  });
  return { servizio, repository, righeConfig, configInsight, catalogo, caricaSuOlimpo, dimentica, nomeUtente };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('leggi', () => {
  it('GDO, identita\', reparti, campi delle referenze, sito web e configurazione degli insight del file', async () => {
    const { servizio, repository } = crea();

    const impostazioni = await servizio.leggi(ID_GDO);

    expect(impostazioni.gdo).toEqual({ id: ID_GDO, nome: 'CONAD CNO', haIcona: true });
    expect(impostazioni.identita).toEqual({ colore: '#9e1b22' });
    expect(impostazioni.campiReferenze).toEqual([{ expected_input: 'reparto', expected_output: 'Reparto', core: true }]);
    // L'icona salvata (GUID) torna come URL del proxy, come in get_config; le chiavi d'altro non ci sono
    expect(impostazioni.sitoWeb).toEqual({
      css_text: '.a{color:red}',
      icona_pagina: '/olimpo/foto/getThumbNailOnDemand?guidId=guid-icona',
      logo_header: [{ url: '/olimpo/logo', base64: '' }],
      stili: [{ id: 1 }],
      meta_volantino: { title: 'Volantino', description: 'Offerte' },
    });
    expect(impostazioni.insightVolantino).toEqual({ configurazione: CONFIG_FILE, origine: 'file', aggiornatoIl: null, aggiornatoDa: null });
    // I reparti delle referenze si leggono con i campi del reparto della configurazione in uso
    expect(repository.repartiNelleReferenze).toHaveBeenCalledWith(ID_GDO, { codice: 'data_fields.reparto', descrizione: 'data_fields.descrizione_reparto' });
    expect(impostazioni.reparti).toEqual([
      { codice: '01', nomeDati: 'DROGHERIA ALIMENTARE', nomeMarketing: null, colore: null, referenze: 12, daNominare: true, suggerimento: null },
      { codice: '09', nomeDati: 'PROFUMERIA', nomeMarketing: null, colore: null, referenze: 3, daNominare: true, suggerimento: 'Bellezza e igiene' },
    ]);
    expect(impostazioni.lineeDistributore).toBeNull();
  });

  it('con la configurazione della GDO: origine "gdo", chi e quando; anagrafica e campi del reparto sono i suoi', async () => {
    const { servizio, repository } = crea({
      salvate: {
        idGdo: ID_GDO,
        reparti: [{ codice: '31', nomeDati: 'PESCE', nomeMarketing: 'Pescheria', colore: '#0e7490' }],
        insightVolantino: CONFIG_GDO,
        insightAggiornatoIl: new Date('2026-11-10T09:00:00Z'),
        insightAggiornatoDa: 'Mario Rossi',
        aggiornatoIl: new Date('2026-11-10T09:00:00Z'),
      },
    });

    const impostazioni = await servizio.leggi(ID_GDO);

    expect(impostazioni.insightVolantino).toEqual({
      configurazione: CONFIG_GDO, origine: 'gdo', aggiornatoIl: '2026-11-10T09:00:00.000Z', aggiornatoDa: 'Mario Rossi',
    });
    expect(repository.repartiNelleReferenze).toHaveBeenCalledWith(ID_GDO, { codice: ['data_fields.Referenza.Reparto'], descrizione: 'data_fields.Descrizioni.Reparto' });
    expect(impostazioni.reparti.find(reparto => reparto.codice === '31'))
      .toEqual({ codice: '31', nomeDati: 'PESCE', nomeMarketing: 'Pescheria', colore: '#0e7490', referenze: 0, daNominare: false, suggerimento: null });
  });

  it('senza file ne\' configurazione della GDO: origine "assente"; senza riga config: sezioni vuote', async () => {
    const { servizio } = crea({ file: null, riga: null });

    const impostazioni = await servizio.leggi(ID_GDO);

    expect(impostazioni.insightVolantino).toEqual({ configurazione: null, origine: 'assente', aggiornatoIl: null, aggiornatoDa: null });
    expect(impostazioni.identita).toEqual({ colore: null });
    expect(impostazioni.campiReferenze).toEqual([]);
    expect(impostazioni.sitoWeb).toEqual({ css_text: '', icona_pagina: '', logo_header: [], stili: [] });
  });

  it('linee e bolli della libreria agenzia, con i loghi del catalogo di Istanta', async () => {
    const { servizio, catalogo } = crea({
      agenzia: { insightVolantino: { lineeDistributore: { linee: [{ sigla: 'conad_11p', nome: '11 Paralleli', colore: '#4e342e' }, { sigla: 'conad_bio', nome: 'Il Biologico' }], bolli: [{ sigla: 'dop', nome: 'DOP' }] } } },
      catalogo: new Map([['conad_11p', { sigla: 'conad_11P', guidId: 'guid-11p', tipo: 3 }]]),
    });
    const richiesta = { session: { id_utente: 'u1' } } as never;

    const { lineeDistributore } = await servizio.leggi(ID_GDO, richiesta);

    expect(catalogo.catalogo).toHaveBeenCalledWith(richiesta);
    expect(lineeDistributore).toEqual({
      linee: [
        { sigla: 'conad_11p', nome: '11 Paralleli', colore: '#4e342e', logo: '/olimpo/foto/getThumbNailOnDemand?guidId=guid-11p&width=96&height=0' },
        { sigla: 'conad_bio', nome: 'Il Biologico', colore: null, logo: null },
      ],
      bolli: [{ sigla: 'dop', nome: 'DOP', logo: null }],
    });
  });

  it('una GDO che non esiste e\' 404', async () => {
    const { servizio } = crea();

    await expect(servizio.leggi('22222222-2222-4222-8222-222222222222')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('identita\', campi delle referenze e sito web: solo le proprie chiavi', () => {
  it('il colore #rrggbb o null va nella colonna color della riga della GDO', async () => {
    const { servizio, righeConfig } = crea();

    await servizio.salvaIdentita(ID_GDO, { colore: '#123abc' });
    await servizio.salvaIdentita(ID_GDO, { colore: null });

    expect(righeConfig.aggiornaColore.mock.calls).toEqual([[ID_GDO, '#123abc'], [ID_GDO, null]]);
    expect(righeConfig.aggiornaWebpliant).not.toHaveBeenCalled();
    await expect(servizio.salvaIdentita(ID_GDO, { colore: 'rosso' })).rejects.toBeInstanceOf(BadRequestError);
    await expect(servizio.salvaIdentita(ID_GDO, {})).rejects.toBeInstanceOf(BadRequestError);
  });

  it('i campi delle referenze: solo data_fields_refs, con input e output come testo', async () => {
    const { servizio, righeConfig } = crea();

    await servizio.salvaCampiReferenze(ID_GDO, { campiReferenze: [{ expected_input: 'prezzo', expected_output: 12, core: false }] });

    expect(righeConfig.aggiornaWebpliant).toHaveBeenCalledWith(ID_GDO, { data_fields_refs: [{ expected_input: 'prezzo', expected_output: '12', core: false }] });
    expect(() => campiReferenzeDaSalvare({ campiReferenze: 'no' })).toThrow(BadRequestError);
    expect(() => campiReferenzeDaSalvare({ campiReferenze: [{ expected_input: 'x' }] })).toThrow(BadRequestError);
    expect(() => campiReferenzeDaSalvare({ campiReferenze: [{ expected_input: 'x', expected_output: 'y', core: 'si' }] })).toThrow(BadRequestError);
  });

  it('il sito web: solo le chiavi presenti, CSS minificato, logo e icona in base64 caricati su Olimpo', async () => {
    const { servizio, righeConfig, caricaSuOlimpo } = crea();

    await servizio.salvaSitoWeb(ID_GDO, {
      css_text: '.a {  color : red ; }',
      logo_header: [{ base64: 'iVBORw0KGgo=', url: '', idCanale: 'c1' }, { base64: '', url: '/olimpo/gia-caricato' }],
      icona_pagina: 'iVBORw0KGgo=',
      chiave_estranea: 'non si salva',
    }, 'chiave-privata');

    expect(caricaSuOlimpo).toHaveBeenCalledTimes(2);
    expect(caricaSuOlimpo.mock.calls.map(chiamata => chiamata[2])).toEqual(['chiave-privata', 'chiave-privata']);
    expect(righeConfig.aggiornaWebpliant).toHaveBeenCalledWith(ID_GDO, {
      css_text: '.a{color:red}',
      logo_header: [
        { base64: 'iVBORw0KGgo=', url: '/olimpo/foto/getThumbNailOnDemand?guidId=guid-logo-nuovo', idCanale: 'c1' },
        { base64: '', url: '/olimpo/gia-caricato' },
      ],
      icona_pagina: 'guid-icona-nuova',
    });
  });

  it('l\'icona rimandata come URL di Olimpo torna al GUID; senza chiavi non si scrive niente', async () => {
    const { servizio, righeConfig, caricaSuOlimpo } = crea();

    await servizio.salvaSitoWeb(ID_GDO, { icona_pagina: '/olimpo/foto/getThumbNailOnDemand?guidId=guid-icona' }, undefined);
    await servizio.salvaSitoWeb(ID_GDO, {}, undefined);

    expect(caricaSuOlimpo).not.toHaveBeenCalled();
    expect(righeConfig.aggiornaWebpliant.mock.calls).toEqual([[ID_GDO, { icona_pagina: 'guid-icona' }]]);
  });

  it('tipi sbagliati: richiesta non valida, niente salvato', async () => {
    const { servizio, righeConfig } = crea();

    for (const sito of [null, { css_text: 3 }, { stili: {} }, { meta_volantino: 'x' }, { logo_header: ['x'] }, { icona_pagina: 5 }]) {
      await expect(servizio.salvaSitoWeb(ID_GDO, sito, undefined), JSON.stringify(sito)).rejects.toBeInstanceOf(BadRequestError);
    }
    expect(righeConfig.aggiornaWebpliant).not.toHaveBeenCalled();
  });
});

describe('reparti', () => {
  it('si salvano le voci controllate; i reparti non validi sono una richiesta non valida', async () => {
    const { servizio, repository } = crea();

    await servizio.salvaReparti(ID_GDO, { reparti: [{ codice: '09', nomeDati: 'PROFUMERIA', nomeMarketing: ' Bellezza ', colore: '#ec4899' }] });

    expect(repository.salvaReparti).toHaveBeenCalledWith(ID_GDO, [{ codice: '09', nomeDati: 'PROFUMERIA', nomeMarketing: 'Bellezza', colore: '#ec4899' }]);
    await expect(servizio.salvaReparti(ID_GDO, { reparti: [{ codice: '' }] })).rejects.toBeInstanceOf(BadRequestError);
    expect(repository.salvaReparti).toHaveBeenCalledTimes(1);
  });
});

describe('configurazione degli insight', () => {
  it('valida: si salva per la GDO con il nome di chi la salva e la cache della GDO si dimentica', async () => {
    const { servizio, repository, dimentica, nomeUtente } = crea();

    await servizio.salvaInsightVolantino(ID_GDO, CONFIG_GDO, 'u1');

    expect(nomeUtente).toHaveBeenCalledWith('u1');
    expect(repository.salvaInsightVolantino).toHaveBeenCalledWith(ID_GDO, CONFIG_GDO, 'Mario Rossi');
    expect(dimentica).toHaveBeenCalledWith(ID_GDO);
  });

  it('non valida: BadRequestError con l\'esito della verifica nei dettagli, niente salvato', async () => {
    const { servizio, repository, dimentica } = crea();

    const errore = await servizio.salvaInsightVolantino(ID_GDO, { reparti: {} }, 'u1').catch((e: unknown) => e);

    expect(errore).toBeInstanceOf(BadRequestError);
    expect((errore as BadRequestError).details).toEqual({
      valida: false,
      errori: [{ percorso: 'dataMapping', messaggio: "manca: e' obbligatorio" }],
      sezioni: [],
    });
    expect(repository.salvaInsightVolantino).not.toHaveBeenCalled();
    expect(dimentica).not.toHaveBeenCalled();
  });

  it('togliendola si torna al file dell\'installazione; la cache della GDO si dimentica', async () => {
    const { servizio, repository, dimentica } = crea();

    const impostazioni = await servizio.eliminaInsightVolantino(ID_GDO);

    expect(repository.eliminaInsightVolantino).toHaveBeenCalledWith(ID_GDO);
    expect(dimentica).toHaveBeenCalledWith(ID_GDO);
    expect(impostazioni.insightVolantino.origine).toBe('file');
  });

  it('la verifica da sola non salva niente', () => {
    const { servizio, repository } = crea();

    expect(servizio.verificaInsightVolantino(CONFIG_FILE)).toEqual({ valida: true, errori: [], sezioni: ['dataMapping', 'reparti'] });
    expect(repository.salvaInsightVolantino).not.toHaveBeenCalled();
  });
});

describe('configurazioneInsight', () => {
  it('prima quella della GDO, poi il file, poi nessuna', () => {
    const salvate = { idGdo: ID_GDO, reparti: [], insightVolantino: CONFIG_GDO, insightAggiornatoIl: null, insightAggiornatoDa: null, aggiornatoIl: new Date(0) };

    expect(configurazioneInsight(salvate, CONFIG_FILE).origine).toBe('gdo');
    expect(configurazioneInsight({ ...salvate, insightVolantino: null }, CONFIG_FILE).origine).toBe('file');
    expect(configurazioneInsight(null, null)).toEqual({ configurazione: null, origine: 'assente', aggiornatoIl: null, aggiornatoDa: null });
  });
});
