import { describe, expect, it } from 'vitest';
import { STATO_PROMO } from '../../../lib/enums';
import { chiaveIndirizzo, chiaveTelefono } from './puntoVenditaNormalization';
import { type ApparizioneStoria, calcolaStoria, MINIMO_VOLANTINI_ASSENZA, ultimaApparizione } from './storiaPuntoVendita';

// La storia del PV dalle sue apparizioni nei volantini: periodi, eventi confermati da almeno due edizioni

const NOMI: Record<string, string> = { SS: 'Superstore', CC: 'Conad City', TO: 'Toscana', LI: 'Liguria' };

const piuGiorni = (data: string, giorni: number): string => {
  const giorno = new Date(`${data}T00:00:00Z`);
  giorno.setUTCDate(giorno.getUTCDate() + giorni);
  return giorno.toISOString().slice(0, 10);
};

/** Il giovedi' della settimana n a partire dal 6 gennaio 2022. */
const settimana = (n: number): string => piuGiorni('2022-01-06', 7 * n);

function apparizione(data: string, opzioni: {
  canale?: string;
  area?: string;
  indirizzo?: string;
  telefono?: string | null;
  localita?: string;
  idKit?: string;
} = {}): ApparizioneStoria {
  const canale = opzioni.canale ?? 'SS';
  const area = opzioni.area ?? 'TO';
  const indirizzo = opzioni.indirizzo ?? 'Via Murtola 12/14';
  const telefono = opzioni.telefono === undefined ? '010 6197180' : opzioni.telefono;
  return {
    idKit: opzioni.idKit ?? `kit-${data}-${canale}-${area}`,
    titoloKit: `${canale} ${area} ${data}`,
    promo: { id: `promo-${data}`, nome: `Volantino ${data}`, stato: STATO_PROMO.ARCHIVIATA, validitaDal: data, validitaAl: piuGiorni(data, 6) },
    canale: { id: canale, nome: NOMI[canale] },
    area: { id: area, nome: NOMI[area] },
    data,
    rigaStampata: `PRA - ${indirizzo}${telefono ? ` - tel. ${telefono}` : ''}`,
    localita: opzioni.localita ?? 'PRA',
    indirizzo,
    telefono,
    chiaveIndirizzo: chiaveIndirizzo(indirizzo),
    chiaveTelefono: chiaveTelefono(telefono),
    abbinamento: 'telefono',
  };
}

const PV = { id: 'pv-1', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180' };

describe('calcolaStoria', () => {
  it('senza apparizioni: storia vuota con sintesi null', () => {
    expect(calcolaStoria(PV, [])).toEqual({ idPuntoVendita: 'pv-1', sintesi: null, anni: [], insegne: [], recapiti: [], eventi: [] });
  });

  it('sempre la stessa insegna e gli stessi recapiti: un periodo per tipo e nessun evento', () => {
    const apparizioni = [settimana(0), settimana(1), settimana(52), settimana(53)].map(data => apparizione(data));

    const storia = calcolaStoria(PV, [...apparizioni].reverse());

    expect(storia.sintesi).toEqual({
      primoVolantino: '2022-01-06',
      ultimoVolantino: settimana(53),
      numeroVolantini: 4,
      insegne: [{ id: 'SS', nome: 'Superstore' }],
    });
    expect(storia.anni).toEqual([
      { anno: 2022, volantini: 2, insegne: [{ canale: { id: 'SS', nome: 'Superstore' }, area: { id: 'TO', nome: 'Toscana' }, volantini: 2 }] },
      { anno: 2023, volantini: 2, insegne: [{ canale: { id: 'SS', nome: 'Superstore' }, area: { id: 'TO', nome: 'Toscana' }, volantini: 2 }] },
    ]);
    expect(storia.insegne).toEqual([{
      canale: { id: 'SS', nome: 'Superstore' }, area: { id: 'TO', nome: 'Toscana' },
      dal: '2022-01-06', al: piuGiorni(settimana(53), 6), volantini: 4,
    }]);
    expect(storia.recapiti).toEqual([{
      localita: 'PRA', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180',
      dal: '2022-01-06', al: piuGiorni(settimana(53), 6), volantini: 4, diversoDallAttuale: false,
    }]);
    expect(storia.eventi).toEqual([]);
  });

  it('cambio d\'insegna che dura almeno due edizioni: due periodi e un evento alla prima edizione nuova', () => {
    const apparizioni = [
      ...[0, 1, 2].map(n => apparizione(settimana(n), { canale: 'SS' })),
      ...[3, 4].map(n => apparizione(settimana(n), { canale: 'CC' })),
    ];

    const storia = calcolaStoria(PV, apparizioni);

    expect(storia.insegne.map(periodo => [periodo.canale.id, periodo.dal, periodo.volantini])).toEqual([
      ['SS', settimana(0), 3],
      ['CC', settimana(3), 2],
    ]);
    expect(storia.eventi).toEqual([
      { tipo: 'cambio_insegna', data: settimana(3), da: { id: 'SS', nome: 'Superstore' }, a: { id: 'CC', nome: 'Conad City' } },
    ]);
    expect(storia.sintesi?.insegne.map(insegna => insegna.id)).toEqual(['SS', 'CC']);
  });

  it('nuova insegna in un solo volantino (l\'ultimo): periodo visibile, ma non ancora un evento', () => {
    const apparizioni = [...[0, 1, 2].map(n => apparizione(settimana(n))), apparizione(settimana(3), { canale: 'CC' })];

    const storia = calcolaStoria(PV, apparizioni);

    expect(storia.insegne.map(periodo => periodo.canale.id)).toEqual(['SS', 'CC']);
    expect(storia.eventi).toEqual([]);
  });

  it('un volantino isolato di un\'altra insegna fra due tratti uguali si riassorbe: un periodo, nessun evento', () => {
    const apparizioni = [
      apparizione(settimana(0)), apparizione(settimana(1)),
      apparizione(settimana(2), { canale: 'CC' }),
      apparizione(settimana(3)), apparizione(settimana(4)),
    ];

    const storia = calcolaStoria(PV, apparizioni);

    expect(storia.insegne).toHaveLength(1);
    expect(storia.insegne[0]).toMatchObject({ canale: { id: 'SS' }, dal: settimana(0), al: piuGiorni(settimana(4), 6), volantini: 4 });
    expect(storia.eventi).toEqual([]);
  });

  it('due volantini la stessa settimana (due insegne): non spezzano il periodo e non sono un cambio', () => {
    const apparizioni = [
      apparizione(settimana(0)), apparizione(settimana(1)),
      apparizione(settimana(2)), apparizione(settimana(2), { canale: 'CC' }),
      apparizione(settimana(3)),
    ];

    const storia = calcolaStoria(PV, apparizioni);

    expect(storia.insegne.map(periodo => [periodo.canale.id, periodo.volantini])).toEqual([['SS', 4]]);
    expect(storia.eventi).toEqual([]);
    expect(storia.sintesi?.numeroVolantini).toBe(5);
  });

  it('cambio d\'area confermato: evento cambio_area', () => {
    const apparizioni = [
      ...[0, 1].map(n => apparizione(settimana(n), { area: 'TO' })),
      ...[2, 3].map(n => apparizione(settimana(n), { area: 'LI' })),
    ];

    expect(calcolaStoria(PV, apparizioni).eventi).toEqual([
      { tipo: 'cambio_area', data: settimana(2), da: { id: 'TO', nome: 'Toscana' }, a: { id: 'LI', nome: 'Liguria' } },
    ]);
  });

  it('trasloco: due periodi di recapito, evento cambio_indirizzo, il vecchio indirizzo e\' diverso dall\'attuale', () => {
    const apparizioni = [
      ...[0, 1, 2].map(n => apparizione(settimana(n), { indirizzo: 'Via Murtola 12/14' })),
      ...[3, 4].map(n => apparizione(settimana(n), { indirizzo: 'Via Nuova 3' })),
    ];

    const storia = calcolaStoria({ ...PV, indirizzo: 'Via Nuova 3' }, apparizioni);

    expect(storia.recapiti.map(({ indirizzo, dal, volantini, diversoDallAttuale }) => ({ indirizzo, dal, volantini, diversoDallAttuale }))).toEqual([
      { indirizzo: 'Via Murtola 12/14', dal: settimana(0), volantini: 3, diversoDallAttuale: true },
      { indirizzo: 'Via Nuova 3', dal: settimana(3), volantini: 2, diversoDallAttuale: false },
    ]);
    expect(storia.eventi).toEqual([{ tipo: 'cambio_indirizzo', data: settimana(3), da: 'Via Murtola 12/14', a: 'Via Nuova 3' }]);
  });

  it('trasloco in un\'altra localita\': l\'evento dice anche la localita\'', () => {
    const apparizioni = [
      ...[0, 1].map(n => apparizione(settimana(n), { localita: 'PRA', indirizzo: 'Via Murtola 12/14' })),
      ...[2, 3].map(n => apparizione(settimana(n), { localita: 'VOLTRI', indirizzo: 'Via Camozzini 5' })),
    ];

    expect(calcolaStoria(PV, apparizioni).eventi).toEqual([
      { tipo: 'cambio_indirizzo', data: settimana(2), da: 'PRA, Via Murtola 12/14', a: 'VOLTRI, Via Camozzini 5' },
    ]);
  });

  it('telefono nuovo: evento cambio_telefono e periodo diverso dall\'attuale', () => {
    const apparizioni = [
      ...[0, 1].map(n => apparizione(settimana(n), { telefono: '010 111111' })),
      ...[2, 3].map(n => apparizione(settimana(n), { telefono: '010 6197180' })),
    ];

    const storia = calcolaStoria(PV, apparizioni);

    expect(storia.eventi).toEqual([{ tipo: 'cambio_telefono', data: settimana(2), da: '010 111111', a: '010 6197180' }]);
    expect(storia.recapiti.map(periodo => periodo.diversoDallAttuale)).toEqual([true, false]);
  });

  it('un volantino senza telefono non e\' un cambio di telefono', () => {
    const apparizioni = [
      apparizione(settimana(0)), apparizione(settimana(1), { telefono: null }), apparizione(settimana(2)),
    ];

    const storia = calcolaStoria(PV, apparizioni);

    expect(storia.recapiti).toHaveLength(1);
    expect(storia.recapiti[0]).toMatchObject({ telefono: '010 6197180', volantini: 3 });
    expect(storia.eventi).toEqual([]);
  });

  it(`assente: manca dagli ultimi ${MINIMO_VOLANTINI_ASSENZA} volantini della sua insegna e area, che continuano`, () => {
    const apparizioni = [0, 1, 2].map(n => apparizione(settimana(n)));
    const senza = [3, 4, 5].map(n => ({ idKit: `kit-senza-${n}`, data: settimana(n) }));

    const storia = calcolaStoria(PV, apparizioni, senza);

    expect(storia.eventi).toEqual([{ tipo: 'assente', dal: settimana(3), volantiniSenza: 3 }]);
  });

  it('assente solo da due volantini, o da volantini piu\' vecchi dell\'ultima apparizione: nessun evento', () => {
    const apparizioni = [0, 1, 2].map(n => apparizione(settimana(n)));

    expect(calcolaStoria(PV, apparizioni, [3, 4].map(n => ({ idKit: `k${n}`, data: settimana(n) }))).eventi).toEqual([]);
    expect(calcolaStoria(PV, apparizioni, [-3, -2, -1].map(n => ({ idKit: `k${n}`, data: settimana(n) }))).eventi).toEqual([]);
  });

  it('eventi dal piu\' recente', () => {
    const apparizioni = [
      ...[0, 1].map(n => apparizione(settimana(n), { canale: 'SS', telefono: '010 111111' })),
      ...[2, 3].map(n => apparizione(settimana(n), { canale: 'SS', telefono: '010 6197180' })),
      ...[4, 5].map(n => apparizione(settimana(n), { canale: 'CC', telefono: '010 6197180' })),
    ];
    const senza = [6, 7, 8].map(n => ({ idKit: `k${n}`, data: settimana(n) }));

    const eventi = calcolaStoria(PV, apparizioni, senza).eventi;

    expect(eventi.map(evento => evento.tipo)).toEqual(['assente', 'cambio_insegna', 'cambio_telefono']);
  });

  it('il PV due volte nella lista dello stesso volantino conta una volta', () => {
    const doppia = apparizione(settimana(0));

    expect(calcolaStoria(PV, [doppia, { ...doppia, rigaStampata: 'altra riga' }]).sintesi?.numeroVolantini).toBe(1);
  });
});

describe('ultimaApparizione', () => {
  it('la piu\' recente per data dell\'edizione, null senza apparizioni', () => {
    const vecchia = apparizione(settimana(0));
    const recente = apparizione(settimana(5), { canale: 'CC' });

    expect(ultimaApparizione([recente, vecchia])).toBe(recente);
    expect(ultimaApparizione([])).toBeNull();
  });
});
