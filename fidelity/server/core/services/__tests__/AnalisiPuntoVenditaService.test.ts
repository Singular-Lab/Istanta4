import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STATO_PROMO } from '../../../../lib/enums';
import { MECCANICHE } from '../../../../lib/puntiVendita/analisi';
import { NotFoundError } from '../../../../lib/errors';
import type {
  EdizionePerStatistiche,
  IAnalisiPuntiVenditaRepository,
  KitDelVolantino,
  LimitiStatistiche,
  RiepilogoDaSalvare,
  RigaReferenzaKit,
} from '../../repositories/AnalisiPuntiVenditaRepository';
import type { PuntoVenditaDellaStoria } from '../../repositories/PuntiVenditaVolantinoRepository';
import {
  AGGREGATI_VUOTI,
  aggregatiDi,
  descrizioneDaCompatta,
  prodottoDaCompatto,
  type RiepilogoKit,
  VERSIONE_ANALISI_KIT,
} from '../../utils/analisiKit';
import { chiaveDescrizione, type ProdottoFrequente, type RigaListaVolantino, type StatisticheProdotti } from '../../utils/analisiPuntoVendita';
import { MINUTI_DISPOSITIVO_OFFLINE, type RigaSenzaPuntoVendita } from '../../utils/gestionePuntiVendita';
import type { ApparizioneStoria } from '../../utils/storiaPuntoVendita';
import { AnalisiPuntoVenditaService, KIT_PER_LETTURA, oggiARoma } from '../AnalisiPuntoVenditaService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Le pagine del PV sulla timeline dei volantini: GDO del PV, kit della sua storia, riepiloghi dei
// kit salvati o calcolati, volantino, referenza e gestione. I repository sono finti: analisi_kit e'
// in memoria e le aggregazioni dell'SQL sono rifatte qui in JavaScript; qui conta il servizio.

const GDO = '11111111-1111-4111-8111-111111111111';
const PV = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const K1 = 'a0000000-0000-4000-8000-000000000001';
const K2 = 'a0000000-0000-4000-8000-000000000002';
const K3 = 'a0000000-0000-4000-8000-000000000003';
const ESTRANEO = 'a0000000-0000-4000-8000-000000000099';

const PUNTO_VENDITA: PuntoVenditaDellaStoria = { id: PV, idGdo: GDO, citta: 'Sanremo', indirizzo: 'C.so Nazario Sauro 44', telefono: '0184 555 0143' };

const piuGiorni = (data: string, giorni: number): string => {
  const giorno = new Date(`${data}T00:00:00Z`);
  giorno.setUTCDate(giorno.getUTCDate() + giorni);
  return giorno.toISOString().slice(0, 10);
};

const apparizione = (idKit: string, data: string): ApparizioneStoria => ({
  idKit,
  titoloKit: `VOL ${data}`,
  promo: { id: `p-${data}`, nome: `Promo ${data}`, stato: STATO_PROMO.ARCHIVIATA, validitaDal: data, validitaAl: piuGiorni(data, 6) },
  canale: { id: 'SS', nome: 'Conad Superstore' },
  area: { id: 'LI', nome: 'Liguria' },
  data,
  rigaStampata: 'SANREMO - C.so Nazario Sauro 44',
  localita: 'SANREMO',
  indirizzo: 'C.so Nazario Sauro 44',
  telefono: null,
  chiaveIndirizzo: 'CORSO NAZARIO SAURO 44',
  chiaveTelefono: null,
  abbinamento: 'indirizzo',
});

const APPARIZIONI = [apparizione(K3, '2022-01-20'), apparizione(K1, '2022-01-06'), apparizione(K2, '2022-01-13'), apparizione(K2, '2022-01-13')];

const referenza = (idKit: string, id: string, dati: Partial<RigaReferenzaKit> = {}): RigaReferenzaKit => ({
  id,
  id_runtime_kit: idKit,
  compiled_fields: [],
  data_fields: {},
  foto: [],
  meccanica: '',
  codice_box: id,
  group_elements: [],
  pag: 1,
  x: 10,
  y: 10,
  w: 50,
  h: 50,
  w_page: 210,
  h_page: 287,
  perc_ingombro: null,
  aggiornata_il: new Date('2026-10-01T10:00:00Z'),
  storico: false,
  ...dati,
});

const REFERENZE: RigaReferenzaKit[] = [
  referenza(K2, 'k2-a', { data_fields: { codice_referenza: 'A', descrizione_uno: 'Mozzarella', prezzo: 1.2, prezzo_anziche: 2 }, storico: true }),
  referenza(K2, 'k2-c', { pag: 2, data_fields: { codice_referenza: 'C', descrizione_uno: 'Pane', prezzo: 3 }, storico: true, aggiornata_il: new Date('2026-10-02T10:00:00Z') }),
  referenza(K2, 'k2-d', { pag: 2, x: 100, meccanica: 'TP_FID', data_fields: { codice_referenza: 'D', descrizione_uno: 'Olio', prezzo: 2, prezzo_anziche: 4 }, storico: true }),
  referenza(K3, 'k3-a', { data_fields: { codice_referenza: 'A', descrizione_uno: 'Mozzarella di bufala', prezzo: 1.5 }, foto: ['foto-k3'] }),
];

/** Il riepilogo di K1 e' gia' salvato. */
const RIEPILOGO_K1: RiepilogoKit = {
  dati: {
    ...AGGREGATI_VUOTI,
    referenze: 2,
    sconto: { somma: 50, referenze: 2 },
    marche: [['granarolo', 'Granarolo', 2]],
    prodotti: [['c-A', 1.1, 2, 1, MECCANICHE.indexOf('sconto'), 3, 10, 0]],
  },
  descrizioni: { 'c-A': ['Mozzarella', 'Granarolo', null, null] },
};

const RIEPILOGO_SENZA_REFERENZE: RiepilogoKit = { dati: { ...AGGREGATI_VUOTI, marche: [], prodotti: [] }, descrizioni: {} };

/** Le aggregazioni dell'SQL di statisticheProdotti, sui riepiloghi in memoria. */
function statisticheInMemoria(salvati: ReadonlyMap<string, RiepilogoKit>, edizioni: readonly EdizionePerStatistiche[], limiti: LimitiStatistiche): StatisticheProdotti {
  const prodotti = new Map<string, ProdottoFrequente & { ultimaData: string; prezzi: number[] }>();
  const marche = new Map<string, Map<string, number>>();
  for (const { idKit, data } of [...edizioni].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))) {
    const riepilogo = salvati.get(idKit);
    if (!riepilogo) continue;
    for (const tupla of riepilogo.dati.prodotti) {
      const voce = prodotti.get(tupla[0]) ?? {
        chiave: tupla[0], volantini: 0, perAnno: {}, prezzoMinimo: null, prezzoMassimo: null, ultimoKit: idKit, ultimoKitConFoto: null, ultimaData: data, prezzi: [],
      };
      voce.volantini += 1;
      voce.perAnno[data.slice(0, 4)] = (voce.perAnno[data.slice(0, 4)] ?? 0) + 1;
      if (tupla[1] !== null) voce.prezzi.push(tupla[1]);
      voce.ultimoKit = idKit;
      voce.ultimaData = data;
      if (tupla[7] === 1) voce.ultimoKitConFoto = idKit;
      prodotti.set(tupla[0], voce);
    }
    for (const [chiave, marca, referenze] of riepilogo.dati.marche) {
      const nomi = marche.get(chiave) ?? new Map<string, number>();
      nomi.set(marca, (nomi.get(marca) ?? 0) + referenze);
      marche.set(chiave, nomi);
    }
  }
  const perMarca = [...marche.entries()].map(([chiave, nomi]) => ({
    chiave,
    marca: [...nomi.entries()].sort((a, b) => b[1] - a[1])[0][0],
    referenze: [...nomi.values()].reduce((somma, valore) => somma + valore, 0),
  })).sort((a, b) => b.referenze - a.referenze || (a.chiave < b.chiave ? -1 : 1));
  return {
    prodotti: prodotti.size,
    frequenti: [...prodotti.values()].filter(voce => voce.volantini > limiti.soglia).length,
    ricorrenti: [...prodotti.values()]
      .sort((a, b) => b.volantini - a.volantini || (a.ultimaData < b.ultimaData ? 1 : a.ultimaData > b.ultimaData ? -1 : 0) || (a.chiave < b.chiave ? -1 : 1))
      .slice(0, limiti.ricorrenti)
      .map(({ ultimaData: _data, prezzi, ...voce }) => ({
        ...voce,
        prezzoMinimo: prezzi.length > 0 ? Math.min(...prezzi) : null,
        prezzoMassimo: prezzi.length > 0 ? Math.max(...prezzi) : null,
      })),
    marche: perMarca.slice(0, limiti.marche).map(({ marca, referenze }) => ({ marca, referenze })),
    referenzeConMarca: perMarca.reduce((somma, voce) => somma + voce.referenze, 0),
  };
}

const KIT_K2: KitDelVolantino = {
  id: K2,
  titolo: 'SS LI 2',
  storico: true,
  daListino: null,
  manuali: 1,
  pdf: { idFile: 'f-1', idOlimpoCloud: 'o-1', nome: 'VOL.pdf', pagine: 8 },
};

const LISTA: RigaListaVolantino[] = [
  { posizione: 1, riga: 'IMPERIA - P.zza Dante 3', regione: 'LIGURIA', provincia: 'IMPERIA', idPuntoVendita: 'pv-x', abbinamento: 'telefono' },
  { posizione: 2, riga: 'SANREMO - C.so Nazario Sauro 44', regione: 'LIGURIA', provincia: 'IMPERIA', idPuntoVendita: PV, abbinamento: 'indirizzo' },
  { posizione: 3, riga: 'TAGGIA - Via Lungomare 21', regione: 'LIGURIA', provincia: 'IMPERIA', idPuntoVendita: null, abbinamento: null },
];

function creaServizio(opzioni: { salvati?: Map<string, RiepilogoKit>; puntoVendita?: PuntoVenditaDellaStoria | null; chiaveMeta?: string | null } = {}) {
  /** analisi_kit in memoria. */
  const salvati = new Map(opzioni.salvati ?? [[K1, RIEPILOGO_K1]]);
  const repository = {
    aggregatiKit: vi.fn(async (idKit: readonly string[], _versione: number) =>
      new Map([...salvati].filter(([id]) => idKit.includes(id)).map(([id, riepilogo]) => [id, aggregatiDi(riepilogo.dati)]))),
    referenzeDeiKit: vi.fn(async (idKit: readonly string[]) => REFERENZE.filter(riga => idKit.includes(riga.id_runtime_kit))),
    salvaRiepiloghi: vi.fn(async (voci: readonly RiepilogoDaSalvare[]) => {
      for (const voce of voci) salvati.set(voce.idKit, voce.riepilogo);
    }),
    statisticheProdotti: vi.fn(async (edizioni: readonly EdizionePerStatistiche[], limiti: LimitiStatistiche) => statisticheInMemoria(salvati, edizioni, limiti)),
    descrizioniProdotti: vi.fn(async (coppie: ReadonlyArray<{ idKit: string; chiave: string }>) => new Map(coppie.flatMap(({ idKit, chiave }) => {
      const descrizione = salvati.get(idKit)?.descrizioni[chiave];
      return descrizione ? [[chiaveDescrizione(idKit, chiave), descrizioneDaCompatta(descrizione)] as const] : [];
    }))),
    presenzeProdotto: vi.fn(async (idKit: readonly string[], chiave: string) => new Map(idKit.flatMap((id) => {
      const tupla = salvati.get(id)?.dati.prodotti.find(prodotto => prodotto[0] === chiave);
      return tupla ? [[id, prodottoDaCompatto(tupla)] as const] : [];
    }))),
    kitDelVolantino: vi.fn(async (idKit: string): Promise<KitDelVolantino | null> => (idKit === K2 ? KIT_K2 : { ...KIT_K2, id: idKit, storico: false, manuali: null, pdf: null })),
    listaDelVolantino: vi.fn(async () => LISTA),
    canaliConPuntiVendita: vi.fn(async () => [{ id: 'SS', nome: 'Conad Superstore', puntiVendita: 3 }]),
    puntiVenditaNelleListe: vi.fn(async () => [{ idCanale: 'SS', nomeCanale: 'Conad Superstore', anno: 2022, puntiVendita: 4 }]),
    qualita: vi.fn(async () => ({
      totale: 10, senzaCoordinate: 2, senzaCodice: 1, conStoria: 7, dispositiviOffline: 3,
      ultimoImport: { errori: [{ row: 4, error: 'CAP' }, { row: 0, error: 'Interrotto' }], rigaInAttesa: { riga: 6 } },
    })),
    righeSenzaPuntoVendita: vi.fn(async (): Promise<RigaSenzaPuntoVendita[]> => Array.from({ length: 30 }, (_, indice) => ({
      idKit: `kit-${indice}`, data: piuGiorni('2022-01-06', indice), idCanale: 'SS', nomeCanale: 'Conad Superstore', idArea: 'LI', posizione: 1,
      riga: `LOCALITA ${indice} - Via ${indice}`, localita: `LOCALITA ${indice}`, indirizzo: `Via ${indice}`, telefono: null,
      chiaveIndirizzo: `VIA ${indice}`, chiaveTelefono: null,
    }))),
    edizioniConLista: vi.fn(async () => []),
    puntiVenditaConTelefono: vi.fn(async () => []),
  } satisfies IAnalisiPuntiVenditaRepository;
  const storia = {
    trovaPuntoVendita: vi.fn(async (id: string) => (opzioni.puntoVendita === undefined ? (id === PV ? PUNTO_VENDITA : null) : opzioni.puntoVendita)),
    apparizioni: vi.fn(async () => APPARIZIONI),
  };
  const servizio = new AnalisiPuntoVenditaService(repository, storia, { chiaveMetaPuntoVendita: opzioni.chiaveMeta, oggi: () => '2022-01-15' });
  return { servizio, repository, storia, salvati };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('il PV e la sua GDO', () => {
  it('un PV di un\'altra GDO, inesistente o con un id che non e\' un UUID risponde come inesistente', async () => {
    const { servizio, storia } = creaServizio();

    await expect(servizio.analisi(PV, '22222222-2222-4222-8222-222222222222')).rejects.toBeInstanceOf(NotFoundError);
    await expect(servizio.analisi('dddddddd-dddd-4ddd-8ddd-dddddddddddd', GDO)).rejects.toBeInstanceOf(NotFoundError);
    storia.trovaPuntoVendita.mockClear();
    await expect(servizio.analisi('42', GDO)).rejects.toBeInstanceOf(NotFoundError);
    expect(storia.trovaPuntoVendita).not.toHaveBeenCalled();
  });

  it('senza GDO (chi lavora per piu\' GDO) il PV si cerca fra tutte', async () => {
    const { servizio } = creaServizio();
    await expect(servizio.analisi(PV, null)).resolves.toMatchObject({ idPuntoVendita: PV });
  });
});

describe('riepiloghi dei kit e scheda del PV', () => {
  it('usa quelli salvati, calcola gli altri dalle referenze e li salva con la versione e l\'ultima modifica', async () => {
    const { servizio, repository, salvati } = creaServizio();

    const analisi = await servizio.analisi(PV, GDO);

    expect(repository.aggregatiKit).toHaveBeenCalledWith([K1, K2, K3], VERSIONE_ANALISI_KIT);
    expect(repository.referenzeDeiKit).toHaveBeenCalledTimes(1);
    expect(repository.referenzeDeiKit).toHaveBeenCalledWith([K2, K3]);
    expect(repository.salvaRiepiloghi).toHaveBeenCalledWith([
      expect.objectContaining({ idKit: K2, versione: VERSIONE_ANALISI_KIT, referenzeAl: new Date('2026-10-02T10:00:00Z'), riepilogo: expect.objectContaining({ dati: expect.objectContaining({ referenze: 3, fidelity: 1 }) }) }),
      expect.objectContaining({ idKit: K3, versione: VERSIONE_ANALISI_KIT, referenzeAl: new Date('2026-10-01T10:00:00Z'), riepilogo: expect.objectContaining({ dati: expect.objectContaining({ referenze: 1 }) }) }),
    ]);
    expect(salvati.get(K3)?.descrizioni['c-A']).toEqual(['Mozzarella di bufala', null, null, 'foto-k3']);
    // Una volta per kit anche se il PV e' stampato due volte nella lista di K2
    expect(analisi.timeline.map(edizione => [edizione.idKit, edizione.numeroReferenze, edizione.attivo])).toEqual([
      [K1, 2, false],
      [K2, 3, true],
      [K3, 1, false],
    ]);
    expect(analisi.numeri).toMatchObject({ volantini: 3, volantiniAttivi: 1, referenze: 6, prodotti: 3, prodottiFrequenti: 0 });
  });

  it('prodotti e marche dall\'aggregazione dei riepiloghi salvati; descrizioni solo dei ricorrenti', async () => {
    const { servizio, repository } = creaServizio();

    const analisi = await servizio.analisi(PV, GDO);

    // Dopo il salvataggio dei riepiloghi mancanti, con i giorni delle edizioni
    expect(repository.salvaRiepiloghi.mock.invocationCallOrder[0]).toBeLessThan(repository.statisticheProdotti.mock.invocationCallOrder[0]);
    expect(repository.statisticheProdotti).toHaveBeenCalledWith(
      [{ idKit: K1, data: '2022-01-06' }, { idKit: K2, data: '2022-01-13' }, { idKit: K3, data: '2022-01-20' }],
      { soglia: 10, ricorrenti: 10, marche: 8 },
    );
    expect(repository.descrizioniProdotti).toHaveBeenCalledWith([
      { idKit: K3, chiave: 'c-A' },
      { idKit: K2, chiave: 'c-C' },
      { idKit: K2, chiave: 'c-D' },
    ]);
    expect(analisi.prodottiRicorrenti.map(prodotto => prodotto.chiave)).toEqual(['c-A', 'c-C', 'c-D']);
    expect(analisi.prodottiRicorrenti[0]).toEqual({
      chiave: 'c-A', nome: 'Mozzarella di bufala', marca: null, formato: null, foto: 'foto-k3', volantini: 3,
      perAnno: [{ anno: 2022, volantini: 3 }], prezzoMinimo: 1.1, prezzoMassimo: 1.5,
    });
    expect(analisi.marche).toEqual([{ marca: 'Granarolo', quota: 100 }]);
  });

  it('un kit senza referenze ha un riepilogo vuoto, salvato anche lui', async () => {
    const { servizio, repository } = creaServizio({ salvati: new Map([[K1, RIEPILOGO_K1], [K2, RIEPILOGO_SENZA_REFERENZE]]) });
    repository.referenzeDeiKit.mockResolvedValueOnce([]);

    await servizio.analisi(PV, GDO);

    expect(repository.salvaRiepiloghi).toHaveBeenCalledWith([expect.objectContaining({
      idKit: K3, referenzeAl: null, riepilogo: { dati: expect.objectContaining({ referenze: 0, prodotti: [] }), descrizioni: {} },
    })]);
  });

  it('se il salvataggio non riesce la richiesta fallisce: le statistiche dei prodotti sarebbero incomplete', async () => {
    const { servizio, repository } = creaServizio();
    repository.salvaRiepiloghi.mockRejectedValueOnce(new Error('database in sola lettura'));

    await expect(servizio.analisi(PV, GDO)).rejects.toThrow('database in sola lettura');
    expect(repository.statisticheProdotti).not.toHaveBeenCalled();
  });

  it('i kit mancanti si leggono a blocchi', async () => {
    const molti = Array.from({ length: KIT_PER_LETTURA + 3 }, (_, indice) => `b0000000-0000-4000-8000-${String(indice).padStart(12, '0')}`);
    const { servizio, repository, storia } = creaServizio({ salvati: new Map() });
    storia.apparizioni.mockResolvedValueOnce(molti.map((idKit, indice) => apparizione(idKit, piuGiorni('2022-01-06', indice * 7))));

    await servizio.analisi(PV, GDO);

    expect(repository.referenzeDeiKit.mock.calls.map(([idKit]) => idKit.length)).toEqual([KIT_PER_LETTURA, 3]);
    expect(repository.salvaRiepiloghi).toHaveBeenCalledTimes(2);
  });

  it('con tutti i riepiloghi salvati non legge referenze ne\' salva nulla', async () => {
    const { servizio, repository } = creaServizio();
    await servizio.analisi(PV, GDO);
    vi.clearAllMocks();

    await servizio.analisi(PV, GDO);

    expect(repository.referenzeDeiKit).not.toHaveBeenCalled();
    expect(repository.salvaRiepiloghi).not.toHaveBeenCalled();
    expect(repository.statisticheProdotti).toHaveBeenCalledTimes(1);
  });
});

describe('volantino', () => {
  it('un kit che non e\' nella storia del PV, o un id che non e\' un UUID, e\' 404 senza leggerne nulla', async () => {
    const { servizio, repository, storia } = creaServizio();

    await expect(servizio.volantino(PV, ESTRANEO, GDO)).rejects.toBeInstanceOf(NotFoundError);
    await expect(servizio.volantino(PV, 'non-un-uuid', GDO)).rejects.toBeInstanceOf(NotFoundError);
    expect(storia.apparizioni).toHaveBeenCalledTimes(1);
    expect(repository.referenzeDeiKit).not.toHaveBeenCalled();
    expect(repository.kitDelVolantino).not.toHaveBeenCalled();
  });

  it('pagine, numeri, riga del PV, volantino precedente e successivo', async () => {
    const { servizio, repository } = creaServizio();

    const volantino = await servizio.volantino(PV, K2.toUpperCase(), GDO);

    expect(volantino.kit).toEqual({ id: K2, titolo: 'SS LI 2' });
    expect(volantino.promo).toMatchObject({ id: 'p-2022-01-13', validitaDal: '2022-01-13' });
    expect(volantino.pdf).toEqual(KIT_K2.pdf);
    expect(volantino.numeri).toEqual({
      pagine: 8,
      referenze: 3,
      // Import senza il conteggio del listino: le referenze meno quelle compilate a mano
      daListino: 2,
      manuali: 1,
      scontoMedio: 45,
      scontoMedioPrecedente: 25,
      fidelity: 1,
      puntiVenditaInLista: 3,
      puntiVenditaAbbinati: 2,
    });
    expect(volantino.pagine).toHaveLength(8);
    expect(volantino.pagine[1].boxes.map(box => box.id)).toEqual(['k2-c', 'k2-d']);
    expect(volantino.rigaPuntoVendita).toMatchObject({ riga: 'SANREMO - C.so Nazario Sauro 44', abbinamento: 'indirizzo', provincia: 'IMPERIA' });
    expect(volantino.rigaPuntoVendita?.vicine).toHaveLength(3);
    expect(volantino.precedente).toEqual({ idKit: K1, dal: '2022-01-06' });
    expect(volantino.successivo).toEqual({ idKit: K3, dal: '2022-01-20' });
    expect(volantino.copertura).toEqual({ conCodice: 100, conReparto: 0, conPrezzo: 100, conMarca: 0 });
    // Il precedente dai suoi aggregati salvati, il volantino dalle sue referenze
    expect(repository.aggregatiKit).toHaveBeenCalledWith([K1], VERSIONE_ANALISI_KIT);
    expect(repository.referenzeDeiKit).toHaveBeenCalledWith([K2]);
  });

  it('un volantino che non viene dallo storico non ha conteggi del listino; il primo non ha precedente', async () => {
    const { servizio } = creaServizio();

    const volantino = await servizio.volantino(PV, K1, GDO);

    expect(volantino.numeri).toMatchObject({ daListino: null, manuali: null, scontoMedioPrecedente: null, referenze: 0 });
    expect(volantino.precedente).toBeNull();
    expect(volantino.successivo).toEqual({ idKit: K2, dal: '2022-01-13' });
  });
});

describe('referenza', () => {
  it('una chiave non valida, o di un prodotto che non e\' nei volantini del PV, e\' 404', async () => {
    const { servizio, repository } = creaServizio();

    await expect(servizio.referenza(PV, 'x/../y', GDO)).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.aggregatiKit).not.toHaveBeenCalled();
    await expect(servizio.referenza(PV, 'c-ZZZ', GDO)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('presenze in tutti i volantini, intestazione e posizione dall\'ultimo, riletto per intero', async () => {
    const { servizio, repository } = creaServizio();

    const dettaglio = await servizio.referenza(PV, 'c-A', GDO);

    expect(dettaglio.presenze.map(presenza => presenza.idKit)).toEqual([K3, K2, K1]);
    // Ogni presenza dice insegna e area del suo volantino: le varianti per area della stessa promo si distinguono
    expect(dettaglio.presenze[0]).toMatchObject({ canale: { id: 'SS', nome: 'Conad Superstore' }, area: { id: 'LI', nome: 'Liguria' } });
    expect(dettaglio).toMatchObject({ nome: 'Mozzarella di bufala', prezzo: 1.5, foto: ['foto-k3'], dati: { codice: 'A', fonte: 'istanta' } });
    expect(dettaglio.numeri).toMatchObject({ volantini: 3, prezzoMinimo: { prezzo: 1.1, dal: '2022-01-06', sottocosto: true }, prezzoAttuale: 1.5, giorniFraPresenze: 7 });
    expect(dettaglio.posizione).toMatchObject({ idKit: K3, pagina: 1, pagine: 1, referenzeNelBox: 1 });
    expect(repository.referenzeDeiKit).toHaveBeenLastCalledWith([K3]);
    // Solo il prodotto cercato, in tutti i volantini del PV; le descrizioni dell'ultimo e di quelli con la foto
    expect(repository.presenzeProdotto).toHaveBeenCalledWith([K1, K2, K3], 'c-A');
    expect(repository.descrizioniProdotti).toHaveBeenCalledWith([{ idKit: K3, chiave: 'c-A' }]);
    expect(repository.statisticheProdotti).not.toHaveBeenCalled();
  });

  it('senza i box dell\'ultimo volantino l\'intestazione viene dalla sua descrizione', async () => {
    const { servizio, repository } = creaServizio({ salvati: new Map([[K1, RIEPILOGO_K1], [K2, RIEPILOGO_SENZA_REFERENZE], [K3, RIEPILOGO_SENZA_REFERENZE]]) });
    repository.aggregatiKit.mockImplementationOnce(async () => new Map([[K1, aggregatiDi(RIEPILOGO_K1.dati)], [K2, AGGREGATI_VUOTI], [K3, AGGREGATI_VUOTI]]));

    const dettaglio = await servizio.referenza(PV, 'c-A', GDO);

    expect(dettaglio.presenze.map(presenza => presenza.idKit)).toEqual([K1]);
    expect(dettaglio).toMatchObject({ nome: 'Mozzarella', marca: 'Granarolo', prezzo: 1.1, barrato: 2, meccanica: 'sconto', posizione: null, foto: [] });
  });
});

describe('rete e gestione', () => {
  it('rete per insegna dai canali della GDO e dalle liste', async () => {
    const { servizio, repository } = creaServizio();

    await expect(servizio.reteInsegne(GDO)).resolves.toEqual({
      anni: [2022],
      insegne: [{ canale: { id: 'SS', nome: 'Conad Superstore' }, puntiVendita: 3, nelleListe: [{ anno: 2022, puntiVendita: 4 }] }],
    });
    expect(repository.canaliConPuntiVendita).toHaveBeenCalledWith(GDO);
  });

  it('qualita\': la chiave dei meta della GDO, la soglia offline della gestione e le righe dell\'ultimo import', async () => {
    const { servizio, repository } = creaServizio({ chiaveMeta: ' id_anacan ' });

    await expect(servizio.qualita(GDO)).resolves.toEqual({
      totale: 10, senzaCoordinate: 2, senzaCodice: 1, righeDaRevisionare: 2, conStoria: 7, dispositiviOffline: 3,
    });
    expect(repository.qualita).toHaveBeenCalledWith(GDO, 'id_anacan', MINUTI_DISPOSITIVO_OFFLINE);
  });

  it('qualita\' senza una chiave dei meta dichiarata: si contano i meta vuoti', async () => {
    const { servizio, repository } = creaServizio({ chiaveMeta: null });
    await servizio.qualita(GDO);
    expect(repository.qualita).toHaveBeenCalledWith(GDO, null, MINUTI_DISPOSITIVO_OFFLINE);
  });

  it('righe non abbinate a pagine di 10, 25 o 50; una dimensione diversa diventa 10, una pagina non valida la prima', async () => {
    const { servizio } = creaServizio();

    const seconda = await servizio.righeNonAbbinate(GDO, 2, 25);
    expect(seconda).toMatchObject({ totale: 30, pagina: 2, dimensione: 25 });
    expect(seconda.righe).toHaveLength(5);
    // Dalla piu' recente
    expect(seconda.righe[0].ultimoVolantino).toBe(piuGiorni('2022-01-06', 4));

    const fuoriMisura = await servizio.righeNonAbbinate(GDO, 0, 7);
    expect(fuoriMisura).toMatchObject({ pagina: 1, dimensione: 10 });
    expect(fuoriMisura.righe).toHaveLength(10);
  });
});

describe('oggiARoma', () => {
  it('il giorno del calendario di Roma, anche quando in UTC e\' ancora ieri', () => {
    expect(oggiARoma(new Date('2026-10-30T23:30:00Z'))).toBe('2026-10-31');
    expect(oggiARoma(new Date('2026-07-01T10:00:00Z'))).toBe('2026-07-01');
  });
});
