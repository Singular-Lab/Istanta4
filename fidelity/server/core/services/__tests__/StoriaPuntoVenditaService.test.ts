import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_LAVORAZIONE_KIT_RUNTIME, STATO_PROMO } from '../../../../lib/enums';
import { ApplicationError, BadRequestError, NotFoundError } from '../../../../lib/errors';
import type { TipoAbbinamento } from '../../../../lib/puntiVendita/storia';
import type { FileExportPlugin } from '../../interfaces/IStoriaPuntoVenditaService';
import type {
  CambioAbbinamento,
  CambioCollegamento,
  CollegamentoSalvato,
  IPuntiVenditaVolantinoRepository,
  KitVolantino,
  NuovaRigaVolantino,
  NuovoCollegamento,
  PuntoVenditaDellaStoria,
} from '../../repositories/PuntiVenditaVolantinoRepository';
import { chiaviRigaVolantino } from '../../utils/chiaviRigheVolantino';
import { chiaveCombinazione } from '../../utils/confrontoPuntiVendita';
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
  const collegamenti: CollegamentoSalvato[] = [];
  const kitPerId = new Map((opzioni.kit ?? [kitDiProva()]).map(kit => [kit.id, kit]));
  let progressivo = 0;
  let orologio = Date.parse('2026-11-06T10:00:00Z');
  const puntoVendita = (id: string) => (opzioni.puntiVendita ?? []).find(pv => pv.id === id);
  const combinazioneDi = (id: string) => {
    const trovato = puntoVendita(id);
    return chiaveCombinazione(trovato?.idCanale, trovato?.idArea);
  };
  const collegataDa = (riga: RigaInMemoria) => ({
    id: riga.id, idPuntoVendita: riga.id_punto_vendita as string, riga: riga.riga, localita: riga.localita ?? null,
    chiaveIndirizzo: riga.chiave_indirizzo ?? null, chiaveTelefono: riga.chiave_telefono ?? null,
    combinazione: chiaveCombinazione(riga.id_canale, riga.id_area),
  });
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
        id: riga.id, riga: riga.riga, localita: riga.localita, chiave_indirizzo: riga.chiave_indirizzo, chiave_telefono: riga.chiave_telefono,
        id_punto_vendita: riga.id_punto_vendita, abbinamento: riga.abbinamento, id_canale: riga.id_canale, id_area: riga.id_area,
      }))),
    aggiornaAbbinamenti: vi.fn(async (cambi: readonly CambioAbbinamento[]) => {
      for (const cambio of cambi) {
        const riga = righe.find(esistente => esistente.id === cambio.id);
        if (riga) Object.assign(riga, { id_punto_vendita: cambio.idPuntoVendita, abbinamento: cambio.abbinamento });
      }
    }),
    regoleCollegamento: vi.fn(async (idGdo: string) => collegamenti.filter(collegamento => collegamento.idGdo === idGdo)),
    creaCollegamento: vi.fn(async (nuovo: NuovoCollegamento) => {
      const id = `00000000-0000-4000-8000-${String(++progressivo).padStart(12, '0')}`;
      const scelto = puntoVendita(nuovo.idPuntoVendita);
      orologio += 60_000;
      collegamenti.push({
        id,
        idGdo: nuovo.idGdo,
        idPuntoVendita: nuovo.idPuntoVendita,
        chiavi: [...nuovo.chiavi],
        combinazione: combinazioneDi(nuovo.idPuntoVendita),
        riga: nuovo.riga,
        puntoVendita: { id: nuovo.idPuntoVendita, nome: `PV ${scelto?.citta ?? ''}`, indirizzo: scelto?.indirizzo ?? null, citta: scelto?.citta ?? null },
        creatoIl: new Date(orologio).toISOString(),
      });
      return id;
    }),
    paginaCollegamenti: vi.fn(async (idGdo: string, limite: number, scarto: number) => {
      const dellaGdo = collegamenti.filter(collegamento => collegamento.idGdo === idGdo).reverse();
      return { collegamenti: dellaGdo.slice(scarto, scarto + limite), totale: dellaGdo.length };
    }),
    trovaCollegamento: vi.fn(async (id: string) => collegamenti.find(collegamento => collegamento.id === id) ?? null),
    eliminaCollegamento: vi.fn(async (id: string) => {
      const indice = collegamenti.findIndex(collegamento => collegamento.id === id);
      if (indice >= 0) collegamenti.splice(indice, 1);
    }),
    aggiungiChiaviCollegamento: vi.fn(async (id: string, chiavi: readonly string[]) => {
      const collegamento = collegamenti.find(esistente => esistente.id === id);
      if (collegamento) collegamento.chiavi = [...new Set([...collegamento.chiavi, ...chiavi])].sort();
    }),
    righeCollegateAMano: vi.fn(async (idGdo: string, idPuntoVendita?: string) => righe
      .filter(riga => riga.id_gdo === idGdo && riga.abbinamento === 'manuale' && riga.id_punto_vendita !== null
        && (!idPuntoVendita || riga.id_punto_vendita === idPuntoVendita))
      .map(collegataDa)),
    righeDelPuntoVendita: vi.fn(async (idGdo: string, idPuntoVendita: string) => righe
      .filter(riga => riga.id_gdo === idGdo && riga.id_punto_vendita === idPuntoVendita)
      .map(riga => ({ ...collegataDa(riga), idCanale: riga.id_canale, idArea: riga.id_area, abbinamento: riga.abbinamento }))),
    // Come la transazione vera: il collegamento aggiornato o creato, quelli assorbiti tolti, le righe spostate
    cambiaCollegamento: vi.fn(async (cambio: CambioCollegamento) => {
      orologio += 60_000;
      let id = cambio.idCollegamento;
      const esistente = collegamenti.find(collegamento => collegamento.id === id);
      if (esistente) {
        Object.assign(esistente, {
          idPuntoVendita: cambio.idPuntoVendita, chiavi: [...cambio.chiavi], combinazione: combinazioneDi(cambio.idPuntoVendita), creatoIl: new Date(orologio).toISOString(),
        });
      } else {
        id = `00000000-0000-4000-8000-${String(++progressivo).padStart(12, '0')}`;
        collegamenti.push({
          id, idGdo: cambio.idGdo, idPuntoVendita: cambio.idPuntoVendita, chiavi: [...cambio.chiavi], combinazione: combinazioneDi(cambio.idPuntoVendita),
          riga: cambio.riga, puntoVendita: { id: cambio.idPuntoVendita, nome: 'PV', indirizzo: null, citta: null }, creatoIl: new Date(orologio).toISOString(),
        });
      }
      for (const daEliminare of cambio.daEliminare) collegamenti.splice(collegamenti.findIndex(collegamento => collegamento.id === daEliminare), 1);
      for (const singolo of cambio.cambi) {
        const riga = righe.find(esistenteRiga => esistenteRiga.id === singolo.id);
        if (riga) Object.assign(riga, { id_punto_vendita: singolo.idPuntoVendita, abbinamento: singolo.abbinamento });
      }
      return id as string;
    }),
    nomiCanaliAree: vi.fn(async (_idGdo: string) => ({
      canali: new Map([['canale-ss', 'Superstore'], ['canale-cy', 'Conad City']]),
      aree: new Map([['area-li', 'Liguria'], ['area-to', 'Toscana']]),
    })),
    trovaPuntoVendita: vi.fn(async (id: string) => (opzioni.puntiVendita ?? []).find(pv => pv.id === id) ?? null),
    apparizioni: vi.fn(async (_id: string): Promise<ApparizioneStoria[]> => []),
    volantiniSenzaPuntoVendita: vi.fn(async (_criteri: Parameters<IPuntiVenditaVolantinoRepository['volantiniSenzaPuntoVendita']>[0]) => [] as Array<{ idKit: string; data: string }>),
    paginaVolantini: vi.fn(async (_id: string, _limite: number, _scarto: number) => ({ volantini: [], totale: 0 })),
  } satisfies IPuntiVenditaVolantinoRepository;
  return { repository, righe, anagrafica, collegamenti };
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

describe('StoriaPuntoVenditaService: collegamenti fatti a mano', () => {
  // Il Conad di Pra si e' trasferito: in anagrafica e' in Via Novella 3 con un altro telefono,
  // nei volantini resta stampato in Via Murtola. L'abbinamento automatico non lo riconosce.
  const PRA_TRASFERITO: PuntoVenditaDellaStoria = {
    id: PV_PRA, idGdo: GDO, citta: 'Genova', indirizzo: 'Via Novella 3', telefono: '010 0000001',
    idCanale: 'canale-ss', nomeCanale: 'Superstore', idArea: 'area-li', nomeArea: 'Liguria',
  };
  const SANREMO_ALTRA_GDO: PuntoVenditaDellaStoria = { id: PV_SANREMO, idGdo: ALTRA_GDO, citta: 'Sanremo', indirizzo: 'Corso Nazario Sauro 44', telefono: null };
  const RIGA_PRA = 'PRA - Via Murtola 12/14 - tel. 010 6197180';

  const preparato = async () => {
    const memoria = repositoryInMemoria({
      kit: [kitDiProva(), kitDiProva({ id: KIT_DUE, titolo: 'SS LI 46' })],
      anagrafica: [{ id: PV_PRA, citta: 'Genova', indirizzo: 'Via Novella 3', telefono: '010 0000001' }],
      puntiVendita: [PRA_TRASFERITO, SANREMO_ALTRA_GDO],
    });
    const storia = servizio(memoria.repository);
    await storia.registraListaVolantino({ idKit: KIT, pv: LISTA });
    await storia.registraListaVolantino({ idKit: KIT_DUE, pv: RIGA_PRA });
    const chiavePra = chiaviRigaVolantino({ riga: RIGA_PRA, localita: 'PRA', chiaveIndirizzo: chiaveIndirizzo('Via Murtola 12/14'), chiaveTelefono: chiaveTelefono('010 6197180') })[0];
    return { ...memoria, storia, chiavePra };
  };

  it('collega al PV tutte le righe del gruppo, in ogni volantino, come "manuale", senza toccare l\'anagrafica', async () => {
    const { storia, righe, chiavePra, repository } = await preparato();
    expect(righe.filter(riga => riga.riga === RIGA_PRA).every(riga => riga.id_punto_vendita === null)).toBe(true);

    const esito = await storia.collega(GDO, { chiave: chiavePra, idPuntoVendita: PV_PRA }, 'utente-1');

    expect(esito.righe).toBe(2);
    expect(righe.filter(riga => riga.riga === RIGA_PRA).map(riga => [riga.id_punto_vendita, riga.abbinamento])).toEqual([
      [PV_PRA, 'manuale'],
      [PV_PRA, 'manuale'],
    ]);
    // Le altre righe del volantino non cambiano
    expect(righe.filter(riga => riga.riga !== RIGA_PRA).every(riga => riga.id_punto_vendita === null)).toBe(true);
    expect(repository.creaCollegamento).toHaveBeenCalledWith(expect.objectContaining({
      idGdo: GDO, idPuntoVendita: PV_PRA, riga: RIGA_PRA, creatoDa: 'utente-1',
      chiavi: expect.arrayContaining([`tel:${chiaveTelefono('010 6197180')}`]),
    }));
    expect(repository.sostituisciRigheKit).toHaveBeenCalledTimes(2);
  });

  it('una nuova sincronizzazione del kit riscrive le righe ma il collegamento resta', async () => {
    const { storia, righe, chiavePra } = await preparato();
    await storia.collega(GDO, { chiave: chiavePra, idPuntoVendita: PV_PRA }, null);

    const esito = await storia.registraListaVolantino({ idKit: KIT, pv: LISTA });

    expect(esito).toEqual({ registrata: true, righe: 3, abbinate: 1, nonAbbinate: 2 });
    expect(righe.filter(riga => riga.id_kit_runtime === KIT && riga.riga === RIGA_PRA).map(riga => [riga.id_punto_vendita, riga.abbinamento]))
      .toEqual([[PV_PRA, 'manuale']]);
  });

  it('il collegamento fatto a mano vince sulle regole automatiche per le righe ancora senza PV', async () => {
    const { storia, righe, chiavePra, anagrafica } = await preparato();
    await storia.collega(GDO, { chiave: chiavePra, idPuntoVendita: PV_PRA }, null);
    // Entra in anagrafica un PV con lo stesso telefono stampato: le righe restano al PV scelto a mano
    anagrafica.push({ id: 'pv-murtola', citta: 'Genova', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180' });

    await storia.registraListaVolantino({ idKit: KIT_DUE, pv: RIGA_PRA });

    expect(righe.filter(riga => riga.riga === RIGA_PRA).map(riga => riga.id_punto_vendita)).toEqual([PV_PRA, PV_PRA]);
  });

  it('il collegamento impara le chiavi nuove: il negozio che cambia indirizzo tenendo il telefono resta collegato anche senza telefono', async () => {
    const { storia, righe, chiavePra, collegamenti, repository } = await preparato();
    await storia.collega(GDO, { chiave: chiavePra, idPuntoVendita: PV_PRA }, null);

    // Nello stesso volantino: prima la riga col solo indirizzo nuovo, poi quella col vecchio telefono e l'indirizzo nuovo
    await storia.registraListaVolantino({ idKit: KIT_DUE, pv: ['PRA - Via Novella 3', 'PRA - Via Novella 3 - tel. 010 6197180'].join('\r') });

    expect(righe.filter(riga => riga.id_kit_runtime === KIT_DUE).map(riga => [riga.riga, riga.id_punto_vendita, riga.abbinamento])).toEqual([
      ['PRA - Via Novella 3', PV_PRA, 'manuale'],
      ['PRA - Via Novella 3 - tel. 010 6197180', PV_PRA, 'manuale'],
    ]);
    expect(collegamenti[0].chiavi).toContain(`ind:PRA|${chiaveIndirizzo('Via Novella 3')}`);
    expect(repository.aggiungiChiaviCollegamento).toHaveBeenCalledWith(collegamenti[0].id, [`ind:PRA|${chiaveIndirizzo('Via Novella 3')}`]);
  });

  it('richiesta non valida: BadRequestError, niente salvato', async () => {
    const { storia, repository, chiavePra } = await preparato();

    await expect(storia.collega(GDO, { chiave: '', idPuntoVendita: PV_PRA }, null)).rejects.toBeInstanceOf(BadRequestError);
    await expect(storia.collega(GDO, { chiave: chiavePra, idPuntoVendita: 'non-un-uuid' }, null)).rejects.toBeInstanceOf(BadRequestError);
    await expect(storia.collega(GDO, null, null)).rejects.toBeInstanceOf(BadRequestError);
    expect(repository.creaCollegamento).not.toHaveBeenCalled();
  });

  it('PV di un\'altra GDO: inesistente, nessuna riga cambia', async () => {
    const { storia, repository, righe, chiavePra } = await preparato();

    await expect(storia.collega(GDO, { chiave: chiavePra, idPuntoVendita: PV_SANREMO }, null)).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.creaCollegamento).not.toHaveBeenCalled();
    expect(righe.every(riga => riga.id_punto_vendita === null)).toBe(true);
  });

  it('riga non piu\' fra le non abbinate: 409, niente salvato', async () => {
    const { storia, repository, chiavePra } = await preparato();
    await storia.collega(GDO, { chiave: chiavePra, idPuntoVendita: PV_PRA }, null);
    repository.creaCollegamento.mockClear();

    const errore = await storia.collega(GDO, { chiave: chiavePra, idPuntoVendita: PV_PRA }, null).catch((e: unknown) => e);

    expect(errore).toBeInstanceOf(ApplicationError);
    expect((errore as ApplicationError).httpStatus).toBe(409);
    expect(repository.creaCollegamento).not.toHaveBeenCalled();
  });

  it('elenco: dal piu\' recente, con le righe che ogni collegamento collega oggi', async () => {
    const { storia, chiavePra } = await preparato();
    await storia.collega(GDO, { chiave: chiavePra, idPuntoVendita: PV_PRA }, null);

    const pagina = await storia.collegamenti(GDO, 1, 10);

    expect(pagina).toMatchObject({ totale: 1, pagina: 1, dimensione: 10 });
    expect(pagina.collegamenti).toEqual([expect.objectContaining({ riga: RIGA_PRA, righe: 2, puntoVendita: expect.objectContaining({ id: PV_PRA }) })]);
    expect(await storia.collegamenti(ALTRA_GDO)).toMatchObject({ collegamenti: [], totale: 0 });
  });

  it('scollega: toglie il collegamento e le sue righe tornano senza PV (o all\'abbinamento automatico)', async () => {
    const { storia, righe, chiavePra, collegamenti } = await preparato();
    const { idCollegamento } = await storia.collega(GDO, { chiave: chiavePra, idPuntoVendita: PV_PRA }, null);

    const esito = await storia.scollega(GDO, idCollegamento);

    expect(esito).toEqual({ righe: 2 });
    expect(collegamenti).toHaveLength(0);
    expect(righe.filter(riga => riga.riga === RIGA_PRA).map(riga => [riga.id_punto_vendita, riga.abbinamento])).toEqual([[null, null], [null, null]]);
  });

  it('scollega un collegamento di un\'altra GDO o inesistente: NotFoundError, nulla cambia', async () => {
    const { storia, righe, chiavePra, collegamenti } = await preparato();
    const { idCollegamento } = await storia.collega(GDO, { chiave: chiavePra, idPuntoVendita: PV_PRA }, null);

    await expect(storia.scollega(ALTRA_GDO, idCollegamento)).rejects.toBeInstanceOf(NotFoundError);
    await expect(storia.scollega(GDO, 'non-un-uuid')).rejects.toBeInstanceOf(NotFoundError);
    expect(collegamenti).toHaveLength(1);
    expect(righe.filter(riga => riga.riga === RIGA_PRA).every(riga => riga.id_punto_vendita === PV_PRA)).toBe(true);
  });
});

describe('StoriaPuntoVenditaService: canale e area nei collegamenti fatti a mano', () => {
  // Il kit KIT e' Superstore · Liguria; KIT_CITY e' Conad City · Liguria
  const KIT_CITY = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const PV_CITY = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const PV_ALTRO = '99999999-9999-4999-8999-999999999999';
  const RIGA_PRA = 'PRA - Via Murtola 12/14 - tel. 010 6197180';
  const pv = (id: string, idCanale: string, nomeCanale: string, sovrascritti: Partial<PuntoVenditaDellaStoria> = {}): PuntoVenditaDellaStoria => ({
    id, idGdo: GDO, citta: 'Genova', indirizzo: 'Via Novella 3', telefono: null, idCanale, nomeCanale, idArea: 'area-li', nomeArea: 'Liguria', ...sovrascritti,
  });
  const SUPERSTORE = pv(PV_PRA, 'canale-ss', 'Superstore');
  const CITY = pv(PV_CITY, 'canale-cy', 'Conad City');
  const ALTRO_SUPERSTORE = pv(PV_ALTRO, 'canale-ss', 'Superstore', { indirizzo: 'Via Pra 1' });

  const preparato = async (anagrafica: PuntoVenditaAnagrafica[] = []) => {
    const memoria = repositoryInMemoria({
      kit: [kitDiProva(), kitDiProva({ id: KIT_DUE, titolo: 'SS LI 46' }), kitDiProva({ id: KIT_CITY, titolo: 'CY LI 46', idCanale: 'canale-cy' })],
      anagrafica,
      puntiVendita: [SUPERSTORE, CITY, ALTRO_SUPERSTORE],
    });
    const storia = servizio(memoria.repository);
    await storia.registraListaVolantino({ idKit: KIT, pv: RIGA_PRA });
    await storia.registraListaVolantino({ idKit: KIT_CITY, pv: RIGA_PRA });
    const chiavePra = chiaviRigaVolantino({ riga: RIGA_PRA, localita: 'PRA', chiaveIndirizzo: chiaveIndirizzo('Via Murtola 12/14'), chiaveTelefono: chiaveTelefono('010 6197180') })[0];
    return { ...memoria, storia, chiavePra };
  };
  const stato = (righe: RigaInMemoria[]) => righe.map(riga => [riga.id_kit_runtime, riga.id_punto_vendita, riga.abbinamento]);

  it('collega solo le righe dei volantini della combinazione del PV: le altre restano non abbinate', async () => {
    const { storia, righe, chiavePra } = await preparato();

    const esito = await storia.collega(GDO, { chiave: chiavePra, idPuntoVendita: PV_PRA }, null);

    expect(esito.righe).toBe(1);
    expect(stato(righe)).toEqual([[KIT, PV_PRA, 'manuale'], [KIT_CITY, null, null]]);
  });

  it('PV di una combinazione che nessun volantino della riga ha: 422 con le combinazioni, nessuna riga cambia', async () => {
    const memoria = repositoryInMemoria({
      kit: [kitDiProva()],
      puntiVendita: [CITY],
    });
    const storia = servizio(memoria.repository);
    await storia.registraListaVolantino({ idKit: KIT, pv: RIGA_PRA });
    const chiave = chiaviRigaVolantino({ riga: RIGA_PRA, localita: 'PRA', chiaveIndirizzo: chiaveIndirizzo('Via Murtola 12/14'), chiaveTelefono: chiaveTelefono('010 6197180') })[0];

    const errore = await storia.collega(GDO, { chiave, idPuntoVendita: PV_CITY }, null).catch((e: unknown) => e);

    expect(errore).toBeInstanceOf(ApplicationError);
    expect((errore as ApplicationError).httpStatus).toBe(422);
    expect((errore as ApplicationError).code).toBe('COMBINAZIONE_DIVERSA');
    expect((errore as ApplicationError).message).toContain('Conad City · Liguria');
    expect((errore as ApplicationError).message).toContain('Superstore · Liguria');
    expect(memoria.repository.creaCollegamento).not.toHaveBeenCalled();
    expect(memoria.righe.every(riga => riga.id_punto_vendita === null)).toBe(true);
  });

  it('un volantino nuovo di un\'altra combinazione con la stessa riga non viene collegato dal collegamento', async () => {
    const { storia, righe, chiavePra } = await preparato();
    await storia.collega(GDO, { chiave: chiavePra, idPuntoVendita: PV_PRA }, null);

    await storia.registraListaVolantino({ idKit: KIT_CITY, pv: RIGA_PRA });
    await storia.registraListaVolantino({ idKit: KIT_DUE, pv: RIGA_PRA });

    expect(stato(righe)).toEqual([[KIT, PV_PRA, 'manuale'], [KIT_CITY, null, null], [KIT_DUE, PV_PRA, 'manuale']]);
  });

  it('scollega anche le righe collegate prima del vincolo, di un\'altra combinazione', async () => {
    const { storia, righe, collegamenti, chiavePra } = await preparato();
    const { idCollegamento } = await storia.collega(GDO, { chiave: chiavePra, idPuntoVendita: PV_PRA }, null);
    // Una riga Conad City collegata a mano allo stesso PV, come prima del vincolo su canale e area
    Object.assign(righe[1], { id_punto_vendita: PV_PRA, abbinamento: 'manuale' });
    expect((await storia.collegamenti(GDO)).collegamenti[0].righe).toBe(2);

    const esito = await storia.scollega(GDO, idCollegamento);

    expect(esito).toEqual({ righe: 2 });
    expect(collegamenti).toHaveLength(0);
    expect(stato(righe)).toEqual([[KIT, null, null], [KIT_CITY, null, null]]);
  });

  describe('cambiaCollegamento', () => {
    it('collegamento fatto a mano: lo stesso collegamento passa al nuovo PV, con tutte le righe', async () => {
      const { storia, righe, collegamenti, chiavePra, repository } = await preparato();
      await storia.registraListaVolantino({ idKit: KIT_DUE, pv: RIGA_PRA });
      const { idCollegamento } = await storia.collega(GDO, { chiave: chiavePra, idPuntoVendita: PV_PRA }, null);

      const esito = await storia.cambiaCollegamento(GDO, { chiave: chiavePra, idPuntoVenditaAttuale: PV_PRA, idPuntoVendita: PV_ALTRO }, 'utente-2');

      expect(esito).toEqual({ idCollegamento, righe: 2 });
      expect(collegamenti).toHaveLength(1);
      expect(collegamenti[0]).toMatchObject({ id: idCollegamento, idPuntoVendita: PV_ALTRO });
      expect(stato(righe)).toEqual([[KIT, PV_ALTRO, 'manuale'], [KIT_CITY, null, null], [KIT_DUE, PV_ALTRO, 'manuale']]);
      expect(repository.cambiaCollegamento).toHaveBeenCalledWith(expect.objectContaining({ idCollegamento, daEliminare: [], creatoDa: 'utente-2' }));
    });

    it('abbinamento automatico per telefono: diventa un collegamento fatto a mano, che resta a una nuova sincronizzazione', async () => {
      // Lo stesso telefono di un PV dell'anagrafica: l'abbinamento automatico lo collega a PV_PRA
      const { storia, righe, collegamenti, chiavePra } = await preparato([{ id: PV_PRA, citta: 'Genova', indirizzo: 'Via Novella 3', telefono: '010 6197180' }]);
      expect(stato(righe)).toEqual([[KIT, PV_PRA, 'telefono'], [KIT_CITY, PV_PRA, 'telefono']]);

      const esito = await storia.cambiaCollegamento(GDO, { chiave: chiavePra, idPuntoVenditaAttuale: PV_PRA, idPuntoVendita: PV_ALTRO }, null);

      expect(esito.righe).toBe(1);
      expect(collegamenti).toHaveLength(1);
      // La riga Conad City torna all'abbinamento automatico: di nuovo per telefono a PV_PRA
      expect(stato(righe)).toEqual([[KIT, PV_ALTRO, 'manuale'], [KIT_CITY, PV_PRA, 'telefono']]);

      await storia.registraListaVolantino({ idKit: KIT, pv: RIGA_PRA });
      expect(righe.filter(riga => riga.id_kit_runtime === KIT).map(riga => [riga.id_punto_vendita, riga.abbinamento])).toEqual([[PV_ALTRO, 'manuale']]);
    });

    it('verso un PV di un\'altra combinazione: 422, le righe restano al PV di prima', async () => {
      const { storia, righe, chiavePra, repository } = await preparato();
      await storia.collega(GDO, { chiave: chiavePra, idPuntoVendita: PV_PRA }, null);

      const errore = await storia.cambiaCollegamento(GDO, { chiave: chiavePra, idPuntoVenditaAttuale: PV_PRA, idPuntoVendita: PV_CITY }, null).catch((e: unknown) => e);

      // La riga collegata a PV_PRA e' solo quella Superstore: Conad City non e' fra le sue combinazioni
      expect((errore as ApplicationError).httpStatus).toBe(422);
      expect(repository.cambiaCollegamento).not.toHaveBeenCalled();
      expect(stato(righe)).toEqual([[KIT, PV_PRA, 'manuale'], [KIT_CITY, null, null]]);
    });

    it('PV di un\'altra GDO o gruppo non piu\' collegato a quel PV: 404 e 409, nulla cambia', async () => {
      const { storia, chiavePra, repository } = await preparato();
      await storia.collega(GDO, { chiave: chiavePra, idPuntoVendita: PV_PRA }, null);

      await expect(storia.cambiaCollegamento(GDO, { chiave: chiavePra, idPuntoVenditaAttuale: PV_PRA, idPuntoVendita: PV_SANREMO }, null)).rejects.toBeInstanceOf(NotFoundError);
      const errore = await storia.cambiaCollegamento(GDO, { chiave: chiavePra, idPuntoVenditaAttuale: PV_ALTRO, idPuntoVendita: PV_PRA }, null).catch((e: unknown) => e);
      expect((errore as ApplicationError).httpStatus).toBe(409);
      expect(repository.cambiaCollegamento).not.toHaveBeenCalled();
    });

    it('richiesta non valida o stesso PV: BadRequestError', async () => {
      const { storia, chiavePra } = await preparato();

      await expect(storia.cambiaCollegamento(GDO, { chiave: '', idPuntoVenditaAttuale: PV_PRA, idPuntoVendita: PV_ALTRO }, null)).rejects.toBeInstanceOf(BadRequestError);
      await expect(storia.cambiaCollegamento(GDO, { chiave: chiavePra, idPuntoVenditaAttuale: 'x', idPuntoVendita: PV_ALTRO }, null)).rejects.toBeInstanceOf(BadRequestError);
      await expect(storia.cambiaCollegamento(GDO, { chiave: chiavePra, idPuntoVenditaAttuale: PV_PRA, idPuntoVendita: PV_PRA }, null)).rejects.toBeInstanceOf(BadRequestError);
    });
  });
});
