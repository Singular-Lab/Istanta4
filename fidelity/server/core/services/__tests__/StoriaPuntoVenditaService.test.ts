import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_LAVORAZIONE_KIT_RUNTIME, STATO_PROMO } from '../../../../lib/enums';
import { BadRequestError, NotFoundError } from '../../../../lib/errors';
import type { TipoAbbinamento } from '../../../../lib/puntiVendita/storia';
import type { FileExportPlugin } from '../../interfaces/IStoriaPuntoVenditaService';
import type {
  CambioAbbinamento,
  IPuntiVenditaVolantinoRepository,
  KitVolantino,
  NuovaRigaVolantino,
  PuntoVenditaDellaStoria,
} from '../../repositories/PuntiVenditaVolantinoRepository';
import type { PuntoVenditaAnagrafica } from '../../utils/abbinamentoPuntiVendita';
import { chiaveIndirizzo, chiaveTelefono } from '../../utils/puntoVenditaNormalization';
import type { ApparizioneStoria } from '../../utils/storiaPuntoVendita';
import { MOTIVI_SCARTO_EXPORT, StoriaPuntoVenditaService } from '../StoriaPuntoVenditaService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Storia del punto vendita: liste dei volantini registrate, abbinate all'anagrafica (mai modificata)
// e lette per la scheda del PV. Il repository e' in memoria: qui conta cosa fa il servizio.

const GDO = '11111111-1111-4111-8111-111111111111';
const ALTRA_GDO = '22222222-2222-4222-8222-222222222222';
const KIT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const KIT_DUE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PV_PRA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PV_SANREMO = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const LISTA = [
  'LIGURIA',
  'Provincia di GENOVA',
  'PRA - Via Murtola 12/14 - tel. 010 6197180',
  'Provincia di IMPERIA',
  'SANREMO - C.so Nazario Sauro 44 - tel. 0184 591201',
  'BORDIGHERA - Via Pasteur 70/e - tel. 0184 251143',
].join('\r');

const kitDiProva = (sovrascritti: Partial<KitVolantino> = {}): KitVolantino => ({
  id: KIT,
  titolo: 'SS LI 45',
  statoLavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO,
  idPromo: 'promo-45',
  nomePromo: 'Volantino 45',
  idCanale: 'canale-ss',
  idArea: 'area-li',
  idGdo: GDO,
  ...sovrascritti,
});

type RigaInMemoria = NuovaRigaVolantino & { id: string; id_punto_vendita: string | null; abbinamento: TipoAbbinamento | null };

/** Repository in memoria, con le stesse regole di quello vero sulle righe da riabbinare. */
function repositoryInMemoria(opzioni: { kit?: KitVolantino[]; anagrafica?: PuntoVenditaAnagrafica[]; puntiVendita?: PuntoVenditaDellaStoria[] } = {}) {
  const righe: RigaInMemoria[] = [];
  const anagrafica = opzioni.anagrafica ?? [];
  const kitPerId = new Map((opzioni.kit ?? [kitDiProva()]).map(kit => [kit.id, kit]));
  let progressivo = 0;
  const repository = {
    trovaKit: vi.fn(async (idKit: string) => kitPerId.get(idKit.toLowerCase()) ?? null),
    sostituisciRigheKit: vi.fn(async (idKit: string, nuove: readonly NuovaRigaVolantino[]) => {
      for (let indice = righe.length - 1; indice >= 0; indice--) if (righe[indice].id_kit_runtime === idKit) righe.splice(indice, 1);
      righe.push(...nuove.map(riga => ({ ...riga, id: `riga-${++progressivo}`, id_punto_vendita: null, abbinamento: null })));
    }),
    contaRigheKit: vi.fn(async (idKit: string) => {
      const delKit = righe.filter(riga => riga.id_kit_runtime === idKit);
      return { righe: delKit.length, abbinate: delKit.filter(riga => riga.id_punto_vendita !== null).length };
    }),
    puntiVenditaGdo: vi.fn(async (_idGdo: string) => anagrafica),
    // Come la query vera: solo le righe senza PV, eventualmente dei kit indicati
    righeDaRiabbinare: vi.fn(async (idGdo: string, soloKit?: readonly string[]) => righe
      .filter(riga => riga.id_gdo === idGdo && riga.id_punto_vendita === null && (!soloKit || soloKit.includes(riga.id_kit_runtime)))
      .map(riga => ({
        id: riga.id, localita: riga.localita, chiave_indirizzo: riga.chiave_indirizzo, chiave_telefono: riga.chiave_telefono,
        id_punto_vendita: riga.id_punto_vendita, abbinamento: riga.abbinamento,
      }))),
    aggiornaAbbinamenti: vi.fn(async (cambi: readonly CambioAbbinamento[]) => {
      for (const cambio of cambi) {
        const riga = righe.find(esistente => esistente.id === cambio.id);
        if (riga) Object.assign(riga, { id_punto_vendita: cambio.idPuntoVendita, abbinamento: cambio.abbinamento });
      }
    }),
    trovaPuntoVendita: vi.fn(async (id: string) => (opzioni.puntiVendita ?? []).find(pv => pv.id === id) ?? null),
    apparizioni: vi.fn(async (_id: string): Promise<ApparizioneStoria[]> => []),
    volantiniSenzaPuntoVendita: vi.fn(async (_criteri: Parameters<IPuntiVenditaVolantinoRepository['volantiniSenzaPuntoVendita']>[0]) => [] as Array<{ idKit: string; data: string }>),
    paginaVolantini: vi.fn(async (_id: string, _limite: number, _scarto: number) => ({ volantini: [], totale: 0 })),
  } satisfies IPuntiVenditaVolantinoRepository;
  return { repository, righe, anagrafica };
}

const ANAGRAFICA: PuntoVenditaAnagrafica[] = [
  { id: PV_PRA, citta: 'Genova', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180' },
  { id: PV_SANREMO, citta: 'Sanremo', indirizzo: 'Corso Nazario Sauro 44', telefono: null },
];

const servizio = (repository: IPuntiVenditaVolantinoRepository, rinvia: (idGdo: string) => boolean = () => false) =>
  new StoriaPuntoVenditaService(repository, { attesaRiabbinamentoMs: 50, rinvia });

afterEach(() => {
  vi.useRealTimers();
});

describe('StoriaPuntoVenditaService.registraListaVolantino', () => {
  it('scrive una riga per voce con le chiavi e i dati del kit, poi la abbina all\'anagrafica della GDO', async () => {
    const { repository, righe } = repositoryInMemoria({ anagrafica: ANAGRAFICA });

    const esito = await servizio(repository).registraListaVolantino({ idKit: KIT, pv: LISTA, nomeFile: 'VOL 45.pdf' });

    expect(esito).toEqual({ registrata: true, righe: 3, abbinate: 2, nonAbbinate: 1 });
    expect(righe.map(({ posizione, localita, id_punto_vendita, abbinamento }) => ({ posizione, localita, id_punto_vendita, abbinamento }))).toEqual([
      { posizione: 1, localita: 'PRA', id_punto_vendita: PV_PRA, abbinamento: 'telefono' },
      { posizione: 2, localita: 'SANREMO', id_punto_vendita: PV_SANREMO, abbinamento: 'indirizzo' },
      { posizione: 3, localita: 'BORDIGHERA', id_punto_vendita: null, abbinamento: null },
    ]);
    expect(righe[0]).toMatchObject({
      id_gdo: GDO, id_kit_runtime: KIT, id_promo: 'promo-45', id_canale: 'canale-ss', id_area: 'area-li', nome_file: 'VOL 45.pdf',
      riga: 'PRA - Via Murtola 12/14 - tel. 010 6197180', regione: 'LIGURIA', provincia: 'GENOVA',
      indirizzo: 'Via Murtola 12/14', telefono: '010 6197180',
      chiave_indirizzo: chiaveIndirizzo('Via Murtola 12/14'), chiave_telefono: chiaveTelefono('010 6197180'),
    });
  });

  it('dopo la registrazione abbina solo le righe del kit; il riabbinamento pianificato della GDO parte lo stesso', async () => {
    vi.useFakeTimers();
    const { repository } = repositoryInMemoria({ anagrafica: ANAGRAFICA });
    const storia = servizio(repository);
    storia.pianificaRiabbinamento(GDO);

    await storia.registraListaVolantino({ idKit: KIT, pv: LISTA });
    expect(repository.righeDaRiabbinare).toHaveBeenLastCalledWith(GDO, [KIT]);

    await vi.advanceTimersByTimeAsync(60);
    expect(repository.righeDaRiabbinare).toHaveBeenLastCalledWith(GDO, undefined);
  });

  it('un nuovo invio dello stesso kit sostituisce le sue righe, non le accoda', async () => {
    const { repository, righe } = repositoryInMemoria({ anagrafica: ANAGRAFICA });
    const storia = servizio(repository);

    await storia.registraListaVolantino({ idKit: KIT, pv: LISTA });
    const esito = await storia.registraListaVolantino({ idKit: KIT, pv: 'PRA - Via Murtola 12/14 - tel. 010 6197180' });

    expect(esito).toEqual({ registrata: true, righe: 1, abbinate: 1, nonAbbinate: 0 });
    expect(righe).toHaveLength(1);
  });

  it.each([
    ['assente', undefined],
    ['vuota', ''],
    ['senza voci riconosciute', 'PUNTI VENDITA ADERENTI\rLIGURIA'],
  ])('lista %s: le righe gia\' registrate del kit restano', async (_nome, pv) => {
    const { repository, righe } = repositoryInMemoria({ anagrafica: ANAGRAFICA });
    const storia = servizio(repository);
    await storia.registraListaVolantino({ idKit: KIT, pv: LISTA });
    repository.sostituisciRigheKit.mockClear();

    const esito = await storia.registraListaVolantino({ idKit: KIT, pv });

    expect(esito).toEqual({ registrata: false, righe: 0, abbinate: 0, nonAbbinate: 0 });
    expect(repository.sostituisciRigheKit).not.toHaveBeenCalled();
    expect(righe).toHaveLength(3);
  });

  it('kit inesistente: NotFoundError e niente scritto', async () => {
    const { repository } = repositoryInMemoria({ kit: [] });

    await expect(servizio(repository).registraListaVolantino({ idKit: KIT, pv: LISTA })).rejects.toBeInstanceOf(NotFoundError);
    await expect(servizio(repository).registraListaVolantino({ idKit: 'non-un-uuid', pv: LISTA })).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.sostituisciRigheKit).not.toHaveBeenCalled();
  });

  it('kit senza GDO: vale quella della sessione; senza nemmeno quella, BadRequestError', async () => {
    const { repository, righe } = repositoryInMemoria({ kit: [kitDiProva({ idGdo: null })] });

    await expect(servizio(repository).registraListaVolantino({ idKit: KIT, pv: LISTA })).rejects.toBeInstanceOf(BadRequestError);
    await servizio(repository).registraListaVolantino({ idKit: KIT, pv: LISTA, idGdoRiserva: ALTRA_GDO });

    expect(righe.every(riga => riga.id_gdo === ALTRA_GDO)).toBe(true);
  });

  it('il riabbinamento che fallisce non fa fallire la registrazione: righe scritte e non abbinate', async () => {
    const { repository } = repositoryInMemoria({ anagrafica: ANAGRAFICA });
    repository.puntiVenditaGdo.mockRejectedValueOnce(new Error('database giu'));

    const esito = await servizio(repository).registraListaVolantino({ idKit: KIT, pv: LISTA });

    expect(esito).toEqual({ registrata: true, righe: 3, abbinate: 0, nonAbbinate: 3 });
  });
});

describe('StoriaPuntoVenditaService.riabbina', () => {
  it('abbina le righe rimaste senza PV quando il PV entra in anagrafica, e aggiorna solo quelle cambiate', async () => {
    const { repository, righe, anagrafica } = repositoryInMemoria({ anagrafica: [...ANAGRAFICA] });
    const storia = servizio(repository);
    await storia.registraListaVolantino({ idKit: KIT, pv: LISTA });
    repository.aggiornaAbbinamenti.mockClear();

    anagrafica.push({ id: 'pv-bordighera', citta: 'Bordighera', indirizzo: 'Via Pasteur 70/E', telefono: null });
    const esito = await storia.riabbina(GDO);

    expect(esito).toEqual({ esaminate: 1, cambiate: 1 });
    expect(repository.aggiornaAbbinamenti).toHaveBeenCalledWith([{ id: righe[2].id, idPuntoVendita: 'pv-bordighera', abbinamento: 'indirizzo' }]);
  });

  it('un PV con righe collegate cambia indirizzo e telefono: le righe restano sue, la sua storia non si perde', async () => {
    const { repository, righe, anagrafica } = repositoryInMemoria({ anagrafica: ANAGRAFICA.map(pv => ({ ...pv })) });
    const storia = servizio(repository);
    await storia.registraListaVolantino({ idKit: KIT, pv: LISTA });
    expect(righe[0]).toMatchObject({ id_punto_vendita: PV_PRA, abbinamento: 'telefono' });
    expect(righe[1]).toMatchObject({ id_punto_vendita: PV_SANREMO, abbinamento: 'indirizzo' });
    repository.aggiornaAbbinamenti.mockClear();

    // Il PV di Pra trasloca e cambia numero; un PV nuovo prende il vecchio indirizzo e il vecchio telefono
    Object.assign(anagrafica[0], { indirizzo: 'Via Nuova 3', telefono: '010 0000000' });
    Object.assign(anagrafica[1], { indirizzo: 'Corso Garibaldi 2' });
    anagrafica.push({ id: 'pv-subentrato', citta: 'Genova', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180' });
    const esito = await storia.riabbina(GDO);

    // Esaminata solo la riga senza PV (Bordighera), che resta tale
    expect(esito).toEqual({ esaminate: 1, cambiate: 0 });
    expect(repository.aggiornaAbbinamenti).toHaveBeenCalledWith([]);
    expect(righe[0]).toMatchObject({ id_punto_vendita: PV_PRA, abbinamento: 'telefono' });
    expect(righe[1]).toMatchObject({ id_punto_vendita: PV_SANREMO, abbinamento: 'indirizzo' });
  });

  it('PV eliminato: le sue righe, rimaste senza PV, si possono collegare a un altro', async () => {
    const { repository, righe, anagrafica } = repositoryInMemoria({ anagrafica: ANAGRAFICA.map(pv => ({ ...pv })) });
    const storia = servizio(repository);
    await storia.registraListaVolantino({ idKit: KIT, pv: LISTA });

    // Come fa la chiave esterna (ON DELETE SET NULL)
    anagrafica.splice(0, 1);
    for (const riga of righe.filter(esistente => esistente.id_punto_vendita === PV_PRA)) {
      Object.assign(riga, { id_punto_vendita: null, abbinamento: null });
    }
    anagrafica.push({ id: 'pv-subentrato', citta: 'Genova', indirizzo: 'Via Murtola 12/14', telefono: null });
    await storia.riabbina(GDO);

    expect(righe[0]).toMatchObject({ id_punto_vendita: 'pv-subentrato', abbinamento: 'probabile' });
  });

  it('le richieste per la stessa GDO si eseguono una alla volta', async () => {
    const { repository } = repositoryInMemoria({ anagrafica: ANAGRAFICA });
    let inCorso = 0;
    let massimo = 0;
    repository.righeDaRiabbinare.mockImplementation(async () => {
      massimo = Math.max(massimo, ++inCorso);
      await new Promise(resolve => setTimeout(resolve, 5));
      inCorso--;
      return [];
    });
    const storia = servizio(repository);

    await Promise.all([storia.riabbina(GDO), storia.riabbina(GDO), storia.riabbina(GDO)]);

    expect(repository.righeDaRiabbinare).toHaveBeenCalledTimes(3);
    expect(massimo).toBe(1);
  });
});

describe('StoriaPuntoVenditaService.pianificaRiabbinamento', () => {
  it('le richieste ravvicinate della stessa GDO diventano un solo riabbinamento', async () => {
    vi.useFakeTimers();
    const { repository } = repositoryInMemoria();
    const storia = servizio(repository);

    storia.pianificaRiabbinamento(GDO);
    storia.pianificaRiabbinamento(GDO);
    storia.pianificaRiabbinamento(GDO);
    expect(repository.righeDaRiabbinare).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60);

    expect(repository.righeDaRiabbinare).toHaveBeenCalledTimes(1);
    expect(repository.righeDaRiabbinare).toHaveBeenCalledWith(GDO, undefined);
  });

  it('con un import Excel della GDO in corso aspetta: riabbina una volta sola, a fine import', async () => {
    vi.useFakeTimers();
    const { repository } = repositoryInMemoria();
    let importInCorso = true;
    const storia = servizio(repository, () => importInCorso);

    storia.pianificaRiabbinamento(GDO);
    storia.pianificaRiabbinamento(GDO);
    await vi.advanceTimersByTimeAsync(500);
    expect(repository.righeDaRiabbinare).not.toHaveBeenCalled();

    importInCorso = false;
    await storia.riabbina(GDO);
    await vi.advanceTimersByTimeAsync(500);

    expect(repository.righeDaRiabbinare).toHaveBeenCalledOnce();
    expect(repository.righeDaRiabbinare).toHaveBeenCalledWith(GDO, undefined);
  });

  it('un riabbinamento pianificato che fallisce non lancia', async () => {
    vi.useFakeTimers();
    const { repository } = repositoryInMemoria();
    repository.righeDaRiabbinare.mockRejectedValue(new Error('database giu'));
    const storia = servizio(repository);

    expect(() => storia.pianificaRiabbinamento(GDO)).not.toThrow();
    await vi.advanceTimersByTimeAsync(60);

    expect(repository.righeDaRiabbinare).toHaveBeenCalledOnce();
  });
});

describe('StoriaPuntoVenditaService: letture', () => {
  const puntoVendita: PuntoVenditaDellaStoria = { id: PV_PRA, idGdo: GDO, citta: 'Genova', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180' };
  const apparizione = (data: string): ApparizioneStoria => ({
    idKit: `kit-${data}`,
    titoloKit: `SS LI ${data}`,
    promo: { id: `promo-${data}`, nome: `Volantino ${data}`, stato: STATO_PROMO.ARCHIVIATA, validitaDal: data, validitaAl: data },
    canale: { id: 'canale-ss', nome: 'Superstore' },
    area: { id: 'area-li', nome: 'Liguria' },
    data,
    rigaStampata: 'PRA - Via Murtola 12/14',
    localita: 'PRA',
    indirizzo: 'Via Murtola 12/14',
    telefono: null,
    chiaveIndirizzo: chiaveIndirizzo('Via Murtola 12/14'),
    chiaveTelefono: null,
    abbinamento: 'probabile',
  });

  it.each([
    ['inesistente', PV_SANREMO, GDO],
    ['di un\'altra GDO', PV_PRA, ALTRA_GDO],
    ['con un id che non e\' un UUID', 'pv-1', GDO],
  ])('PV %s: NotFoundError', async (_nome, id, idGdo) => {
    const { repository } = repositoryInMemoria({ puntiVendita: [puntoVendita] });

    await expect(servizio(repository).getStoria(id, idGdo)).rejects.toBeInstanceOf(NotFoundError);
    await expect(servizio(repository).getVolantini(id, idGdo)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('storia: cerca i volantini successivi senza il PV nell\'insegna e nell\'area dell\'ultima apparizione', async () => {
    const { repository } = repositoryInMemoria({ puntiVendita: [puntoVendita] });
    repository.apparizioni.mockResolvedValue([apparizione('2024-03-07'), apparizione('2022-01-06')]);
    repository.volantiniSenzaPuntoVendita.mockResolvedValue(['2024-03-14', '2024-03-21', '2024-03-28'].map(data => ({ idKit: `k-${data}`, data })));

    const storia = await servizio(repository).getStoria(PV_PRA, null);

    expect(repository.volantiniSenzaPuntoVendita).toHaveBeenCalledWith({
      idPuntoVendita: PV_PRA, idGdo: GDO, idCanale: 'canale-ss', idArea: 'area-li', dopo: '2024-03-07',
    });
    expect(storia.sintesi).toMatchObject({ primoVolantino: '2022-01-06', ultimoVolantino: '2024-03-07', numeroVolantini: 2 });
    expect(storia.eventi).toEqual([{ tipo: 'assente', dal: '2024-03-14', volantiniSenza: 3 }]);
  });

  it('storia di un PV mai stampato: vuota, senza cercare volantini successivi', async () => {
    const { repository } = repositoryInMemoria({ puntiVendita: [puntoVendita] });

    const storia = await servizio(repository).getStoria(PV_PRA, GDO);

    expect(storia).toEqual({ idPuntoVendita: PV_PRA, sintesi: null, anni: [], insegne: [], recapiti: [], eventi: [] });
    expect(repository.volantiniSenzaPuntoVendita).not.toHaveBeenCalled();
  });

  it('volantini: pagina e dimensione ammesse, altrimenti la prima pagina da 10', async () => {
    const { repository } = repositoryInMemoria({ puntiVendita: [puntoVendita] });
    repository.paginaVolantini.mockResolvedValue({ volantini: [], totale: 61 });
    const storia = servizio(repository);

    expect(await storia.getVolantini(PV_PRA, GDO, 3, 25)).toEqual({ volantini: [], totale: 61, pagina: 3, dimensione: 25 });
    expect(repository.paginaVolantini).toHaveBeenLastCalledWith(PV_PRA, 25, 50);
    expect(await storia.getVolantini(PV_PRA, GDO, 0, 7)).toMatchObject({ pagina: 1, dimensione: 10 });
    expect(repository.paginaVolantini).toHaveBeenLastCalledWith(PV_PRA, 10, 0);
    expect(await storia.getVolantini(PV_PRA, GDO)).toMatchObject({ pagina: 1, dimensione: 10 });
  });
});

describe('StoriaPuntoVenditaService.importaExport', () => {
  /** Un export come lo salva il Plugin in <promo>/EXPORT. */
  const exportPlugin = (sovrascritti: Record<string, unknown> = {}) => JSON.stringify({
    promo: 'Volantino 45',
    promoId: 'promo-45',
    canale: 'SS',
    canaleId: 'canale-ss',
    area: 'LI',
    areaId: 'area-li',
    kitGuidId: KIT,
    fileName: 'SS_LI_45.pdf',
    scannedAt: '2021-11-04T08:00:00.000Z',
    refs: [{ groupId: 1 }],
    pv: LISTA,
    pageCount: 8,
    ...sovrascritti,
  });
  const file = (nomeFile: string, contenuto: string) => ({ nomeFile, leggi: vi.fn(async () => contenuto) }) satisfies FileExportPlugin;

  it('registra la lista dell\'export, la abbina e riepiloga per file', async () => {
    const { repository, righe } = repositoryInMemoria({ anagrafica: ANAGRAFICA });

    const esito = await servizio(repository).importaExport([file('SS_LI_45.json', exportPlugin())], GDO);

    expect(esito).toEqual({
      file: [{
        nomeFile: 'SS_LI_45.json', esito: 'registrato',
        promo: { id: 'promo-45', nome: 'Volantino 45' }, kit: { id: KIT, nome: 'SS LI 45' },
        righe: 3, abbinate: 2,
      }],
      registrati: 1, scartati: 0, righe: 3, abbinate: 2,
    });
    expect(righe.every(riga => riga.nome_file === 'SS_LI_45.pdf')).toBe(true);
  });

  it.each([
    ['un file che non e\' .json', 'lista.txt', exportPlugin(), MOTIVI_SCARTO_EXPORT.NON_JSON],
    ['un JSON non valido', 'rotto.json', '{"kitGuidId": ', MOTIVI_SCARTO_EXPORT.JSON_NON_VALIDO],
    ['un JSON che non e\' un oggetto', 'elenco.json', '[1, 2]', MOTIVI_SCARTO_EXPORT.NON_EXPORT],
    ['un export senza kit', 'senza-kit.json', exportPlugin({ kitGuidId: undefined }), MOTIVI_SCARTO_EXPORT.SENZA_KIT],
    ['un export senza area', 'senza-area.json', exportPlugin({ areaId: '' }), MOTIVI_SCARTO_EXPORT.SENZA_AREA],
    ['un kit inesistente', 'inesistente.json', exportPlugin({ kitGuidId: KIT_DUE }), MOTIVI_SCARTO_EXPORT.KIT_NON_TROVATO],
  ])('%s si scarta col motivo, senza scrivere', async (_nome, nomeFile, contenuto, motivo) => {
    const { repository } = repositoryInMemoria({ anagrafica: ANAGRAFICA });

    const esito = await servizio(repository).importaExport([file(nomeFile, contenuto)], GDO);

    expect(esito).toMatchObject({ registrati: 0, scartati: 1, righe: 0, abbinate: 0 });
    expect(esito.file[0]).toMatchObject({ nomeFile, esito: 'scartato', motivo, righe: 0, abbinate: 0 });
    expect(repository.sostituisciRigheKit).not.toHaveBeenCalled();
  });

  it('un file che non e\' .json non si legge nemmeno', async () => {
    const { repository } = repositoryInMemoria();
    const testo = file('lista.txt', exportPlugin());

    await servizio(repository).importaExport([testo], GDO);

    expect(testo.leggi).not.toHaveBeenCalled();
  });

  it('il kit di un\'altra GDO risponde come inesistente', async () => {
    const { repository } = repositoryInMemoria({ kit: [kitDiProva({ idGdo: ALTRA_GDO })] });

    const esito = await servizio(repository).importaExport([file('altra.json', exportPlugin())], GDO);

    expect(esito.file[0]).toEqual({ nomeFile: 'altra.json', esito: 'scartato', motivo: MOTIVI_SCARTO_EXPORT.KIT_NON_TROVATO, righe: 0, abbinate: 0 });
    expect(repository.sostituisciRigheKit).not.toHaveBeenCalled();
  });

  it.each([
    ['area', { areaId: 'area-to' }],
    ['canale', { canaleId: 'canale-cc' }],
  ])('%s dell\'export diversa da quella del kit: scartato', async (_nome, sovrascritti) => {
    const { repository } = repositoryInMemoria();

    const esito = await servizio(repository).importaExport([file('diverso.json', exportPlugin(sovrascritti))], GDO);

    expect(esito.file[0]).toMatchObject({ esito: 'scartato', kit: { id: KIT, nome: 'SS LI 45' } });
    expect(esito.file[0].motivo).toMatch(/^Il kit appartiene ad area\/canale area-li\/canale-ss/);
    expect(repository.sostituisciRigheKit).not.toHaveBeenCalled();
  });

  it('promo dell\'export diversa da quella del kit, o kit eliminato: scartato', async () => {
    const { repository } = repositoryInMemoria({ kit: [kitDiProva(), kitDiProva({ id: KIT_DUE, statoLavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO })] });

    const esito = await servizio(repository).importaExport([
      file('promo.json', exportPlugin({ promoId: 'promo-46' })),
      file('eliminato.json', exportPlugin({ kitGuidId: KIT_DUE })),
    ], GDO);

    expect(esito.file.map(singolo => singolo.motivo)).toEqual([MOTIVI_SCARTO_EXPORT.PROMO_DIVERSA, MOTIVI_SCARTO_EXPORT.KIT_ELIMINATO]);
    expect(repository.sostituisciRigheKit).not.toHaveBeenCalled();
  });

  it('lista vuota: scartato e le righe gia\' registrate del kit restano', async () => {
    const { repository, righe } = repositoryInMemoria();
    const storia = servizio(repository);
    await storia.registraListaVolantino({ idKit: KIT, pv: LISTA });

    const esito = await storia.importaExport([file('vuoto.json', exportPlugin({ pv: '' }))], GDO);

    expect(esito.file[0]).toMatchObject({ esito: 'scartato', motivo: MOTIVI_SCARTO_EXPORT.LISTA_VUOTA });
    expect(righe).toHaveLength(3);
  });

  it('un file che non si riesce a scrivere si scarta, gli altri proseguono; un solo riabbinamento per tutti', async () => {
    const { repository } = repositoryInMemoria({
      kit: [kitDiProva(), kitDiProva({ id: KIT_DUE, titolo: 'SS LI 46' })],
      anagrafica: ANAGRAFICA,
    });
    repository.sostituisciRigheKit.mockRejectedValueOnce(new Error('database giu'));

    const esito = await servizio(repository).importaExport([
      file('primo.json', exportPlugin()),
      file('secondo.json', exportPlugin({ kitGuidId: KIT_DUE })),
    ], GDO);

    expect(esito.file.map(({ nomeFile, esito: risultato, motivo }) => ({ nomeFile, risultato, motivo }))).toEqual([
      { nomeFile: 'primo.json', risultato: 'scartato', motivo: MOTIVI_SCARTO_EXPORT.ERRORE },
      { nomeFile: 'secondo.json', risultato: 'registrato', motivo: undefined },
    ]);
    expect(esito).toMatchObject({ registrati: 1, scartati: 1, righe: 3, abbinate: 2 });
    expect(repository.puntiVenditaGdo).toHaveBeenCalledOnce();
  });
});
