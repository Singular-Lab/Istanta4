import { describe, expect, it, vi } from 'vitest';
import type { StatoRicercaPosizioni } from '../../../../lib/puntiVendita/analisi';
import { RegistroLavoriInMemoria } from '../../../__tests__/registroLavoriInMemoria';
import type { EsitoRicercaPosizione } from '../../repositories/PosizioniRigheRepository';
import type { PosizioneTrovata } from '../../utils/geocodifica';
import {
  eventoPosizioniRighe,
  GestorePosizioniRighe,
  type IndirizzoDaCercare,
  MAX_ERRORI_DI_FILA,
  MESSAGGIO_RICERCA_INTERROTTA,
  type OperazioniPosizioni,
  RicercaPosizioniGiaInCorso,
} from '../PosizioniRigheJob';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Ricerca in background della posizione delle righe dei volantini (proposta SGP-1DCD75CEF9B6)

const indirizzo = (numero: number): IndirizzoDaCercare => ({
  chiave: `ind:PRA|VIA ${numero}`, indirizzo: `Via ${numero}`, localita: 'PRA', provincia: 'GE',
});

function operazioni(cerca: OperazioniPosizioni['cerca']) {
  const eventi: Array<{ evento: string; stato: StatoRicercaPosizioni }> = [];
  const salvate = new Map<string, EsitoRicercaPosizione>();
  const op = {
    cerca: vi.fn(cerca),
    salva: vi.fn(async (chiave: string, esito: EsitoRicercaPosizione) => { salvate.set(chiave, esito); }),
    notifica: vi.fn((evento: 'progress' | 'complete', stato: StatoRicercaPosizioni) => { eventi.push({ evento, stato }); }),
  };
  return { op, eventi, salvate };
}

const trovata = (precisione: PosizioneTrovata['precisione']): PosizioneTrovata => ({ lat: 44.43, lon: 8.78, precisione, ricerca: 'Via, PRA' });

describe('GestorePosizioniRighe', () => {
  it('cerca un indirizzo alla volta, salva subito ogni esito e notifica l\'avanzamento fino al riepilogo', async () => {
    const gestore = new GestorePosizioniRighe(new RegistroLavoriInMemoria());
    const esiti = [trovata('civico'), trovata('via'), undefined];
    const { op, eventi, salvate } = operazioni(async () => esiti.shift());

    const { stato, fine } = await gestore.avvia('g1', 'u1', [indirizzo(1), indirizzo(2), indirizzo(3)], op);
    expect(stato).toMatchObject({ stato: 'in_corso', totale: 3, esaminate: 0 });
    const finale = await fine;

    expect(finale).toMatchObject({ stato: 'completato', totale: 3, esaminate: 3, trovate: 2, approssimate: 1, nonTrovate: 1, errori: 0 });
    expect(eventi.filter(evento => evento.evento === 'progress').map(evento => evento.stato.esaminate)).toEqual([1, 2, 3]);
    expect(eventi.at(-1)).toMatchObject({ evento: 'complete', stato: { stato: 'completato' } });
    expect(salvate.get('ind:PRA|VIA 1')).toEqual({ ricerca: 'Via, PRA', lat: 44.43, lon: 8.78, precisione: 'civico', errore: null });
    expect(salvate.get('ind:PRA|VIA 3')).toEqual({ ricerca: null, lat: null, lon: null, precisione: 'non_trovata', errore: null });
    expect(await gestore.ultima('g1')).toMatchObject({ jobId: stato.jobId, stato: 'completato' });
  });

  it('un errore di Nominatim si salva con il motivo; dopo cinque di fila la ricerca si ferma, quanto trovato resta', async () => {
    const gestore = new GestorePosizioniRighe(new RegistroLavoriInMemoria());
    let chiamate = 0;
    const { op, salvate } = operazioni(async () => {
      chiamate++;
      if (chiamate === 1) return trovata('civico');
      throw new Error('Nominatim non disponibile (HTTP 429)');
    });

    const { fine } = await gestore.avvia('g1', 'u1', Array.from({ length: 10 }, (_, indice) => indirizzo(indice + 1)), op);
    const finale = await fine;

    expect(finale).toMatchObject({ stato: 'errore', esaminate: 1 + MAX_ERRORI_DI_FILA, trovate: 1, errori: MAX_ERRORI_DI_FILA });
    expect(finale.ultimoErrore).toContain('Nominatim non risponde (5 errori di fila)');
    expect(finale.ultimoErrore).toContain('HTTP 429');
    expect(op.cerca).toHaveBeenCalledTimes(1 + MAX_ERRORI_DI_FILA);
    expect(salvate.get('ind:PRA|VIA 1')?.precisione).toBe('civico');
    expect(salvate.get('ind:PRA|VIA 2')).toMatchObject({ precisione: 'non_trovata', errore: 'Nominatim non disponibile (HTTP 429)' });
  });

  it('una sola ricerca attiva per GDO, anche da un altro worker: la seconda vede lo stato della prima', async () => {
    const registro = new RegistroLavoriInMemoria();
    const primo = new GestorePosizioniRighe(registro);
    const secondo = new GestorePosizioniRighe(registro);
    let sblocca: () => void = () => undefined;
    const { op } = operazioni(() => new Promise(resolve => { sblocca = () => resolve(undefined); }));

    const { stato, fine } = await primo.avvia('g1', 'u1', [indirizzo(1)], op);
    await vi.waitFor(() => expect(op.cerca).toHaveBeenCalled());

    const errore = await secondo.avvia('g1', 'u2', [indirizzo(2)], operazioni(async () => undefined).op).catch((e: unknown) => e);
    expect(errore).toBeInstanceOf(RicercaPosizioniGiaInCorso);
    expect((errore as RicercaPosizioniGiaInCorso).stato.jobId).toBe(stato.jobId);
    // Un'altra GDO puo' partire
    await expect(secondo.avvia('g2', 'u2', [], operazioni(async () => undefined).op)).resolves.toBeDefined();

    sblocca();
    await fine;
  });

  it('annullata da un altro worker: si ferma dopo l\'indirizzo in corso, le posizioni trovate restano', async () => {
    const registro = new RegistroLavoriInMemoria();
    const esecutore = new GestorePosizioniRighe(registro, { intervalloSalvataggioMs: 0 });
    const altro = new GestorePosizioniRighe(registro);
    let jobId = '';
    const { op, salvate } = operazioni(async () => {
      if (op.cerca.mock.calls.length === 1) await altro.annulla(jobId, 'g1');
      return trovata('via');
    });

    const avvio = await esecutore.avvia('g1', 'u1', [indirizzo(1), indirizzo(2), indirizzo(3)], op);
    jobId = avvio.stato.jobId;
    const finale = await avvio.fine;

    expect(finale).toMatchObject({ stato: 'annullato', esaminate: 1 });
    expect([...salvate.keys()]).toEqual(['ind:PRA|VIA 1']);
  });

  it('stato e annullamento solo nella GDO della ricerca', async () => {
    const gestore = new GestorePosizioniRighe(new RegistroLavoriInMemoria());
    const { op } = operazioni(async () => undefined);
    const { stato, fine } = await gestore.avvia('g1', 'u1', [indirizzo(1)], op);
    await fine;

    await expect(gestore.stato(stato.jobId, 'g1')).resolves.toMatchObject({ jobId: stato.jobId });
    await expect(gestore.stato(stato.jobId, 'g2')).resolves.toBeUndefined();
    await expect(gestore.annulla(stato.jobId, 'g2')).resolves.toBeUndefined();
  });

  it('una ricerca il cui worker si e\' fermato risulta interrotta e non blocca la GDO', async () => {
    const registro = new RegistroLavoriInMemoria();
    const gestore = new GestorePosizioniRighe(registro);
    const { op } = operazioni(() => new Promise(() => undefined));
    const { stato } = await gestore.avvia('g1', 'u1', [indirizzo(1)], op);
    await vi.waitFor(() => expect(op.cerca).toHaveBeenCalled());

    registro.invecchiaBattito(stato.jobId);

    await expect(gestore.stato(stato.jobId, 'g1')).resolves.toMatchObject({ stato: 'errore', ultimoErrore: MESSAGGIO_RICERCA_INTERROTTA });
    await expect(new GestorePosizioniRighe(registro).avvia('g1', 'u1', [], operazioni(async () => undefined).op)).resolves.toBeDefined();
  });

  it('gli eventi socket portano il jobId', () => {
    expect(eventoPosizioniRighe('j1', 'progress')).toBe('posizioniRighe_j1_progress');
    expect(eventoPosizioniRighe('j1', 'complete')).toBe('posizioniRighe_j1_complete');
  });
});
