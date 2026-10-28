import { describe, expect, it, vi } from 'vitest';
import type { CreatePuntoVenditaDTO, EsitoRigaImportPuntoVenditaDTO, StatoImportPuntiVenditaDTO } from '../../dto';
import { RegistroLavoriInMemoria } from '../../../__tests__/registroLavoriInMemoria';
import {
  DecisioneNonApplicabile,
  eventoImportPuntiVendita,
  GestoreImportPuntiVendita,
  ImportGiaInCorso,
  MAX_ERRORI_NOMINATIM_DI_FILA,
  MESSAGGIO_IMPORT_INTERROTTO,
  type OperazioniImportPuntiVendita,
  type OpzioniGestoreImport,
} from '../ImportPuntiVenditaJob';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Spec import-punti-vendita: avanzamento, pausa sulla riga ambigua e annullamento (proposta SGP-28CFF8CE0AB3)

const dati = (nome: string): CreatePuntoVenditaDTO => ({
  nome, indirizzo: 'Via Roma 1', citta: 'Lucca', cap: '55100', id_combinazione_canale_area: 'comb1', id_gdo: 'g1',
});
const crea = (riga: number): EsitoRigaImportPuntoVenditaDTO =>
  ({ riga, azione: 'crea', letto: { nome: `PV ${riga}`, indirizzo: '', citta: '', cap: '' }, dati: dati(`PV ${riga}`), punteggio: 100, motivi: [] });
const aggiorna = (riga: number): EsitoRigaImportPuntoVenditaDTO => ({ ...(crea(riga) as any), azione: 'aggiorna', id: `pv${riga}` });
const scarta = (riga: number): EsitoRigaImportPuntoVenditaDTO => ({ riga, azione: 'scarta', errore: 'CAP non valido' });
const revisiona = (riga: number): EsitoRigaImportPuntoVenditaDTO =>
  ({ riga, azione: 'revisiona', letto: { nome: 'X', indirizzo: '', citta: '', cap: '' }, dati: dati('X'), punteggio: 40, motivi: ['dubbio'], chiave: String(riga) });

function operazioni(sovrascritte: Partial<OperazioniImportPuntiVendita> = {}) {
  const eventi: Array<{ evento: string; stato: StatoImportPuntiVenditaDTO }> = [];
  const op = {
    scrivi: vi.fn(async (): Promise<{ sincronizzato: boolean } | void> => undefined),
    notifica: vi.fn((evento: 'progress' | 'complete', stato: StatoImportPuntiVenditaDTO) => { eventi.push({ evento, stato }); }),
    alTermine: vi.fn(async () => undefined),
    ...sovrascritte,
  };
  return { op, eventi };
}

/** Gestore con il registro dei lavori in memoria; due gestori con lo stesso registro sono due worker. */
function nuovoGestore(registro = new RegistroLavoriInMemoria(), opzioni: OpzioniGestoreImport = { intervalloAttesaMs: 5 }) {
  return new GestoreImportPuntiVendita(registro, opzioni);
}

/** Attende che il job arrivi in pausa sulla riga indicata. */
async function inAttesaSu(gestore: GestoreImportPuntiVendita, jobId: string, riga: number) {
  await vi.waitFor(async () => expect(await gestore.stato(jobId, 'u1')).toMatchObject({ stato: 'in_attesa', rigaInAttesa: { riga } }));
}

describe('GestoreImportPuntiVendita', () => {
  it('elabora le righe in background e notifica l\'avanzamento fino al riepilogo', async () => {
    const gestore = nuovoGestore();
    const { op, eventi } = operazioni();

    const { stato, fine } = await gestore.avvia('g1', 'u1', [crea(2), aggiorna(3), scarta(4)], op);
    expect(stato).toMatchObject({ stato: 'in_corso', totale: 3, elaborate: 0 });
    const finale = await fine;

    expect(finale).toMatchObject({ stato: 'completato', elaborate: 3, creati: 1, aggiornati: 1, scartati: 1, nonElaborate: 0, soloFp: 0 });
    expect(finale.errori).toEqual([{ row: 4, error: 'CAP non valido' }]);
    expect(eventi.filter(e => e.evento === 'progress').map(e => e.stato.elaborate)).toEqual([1, 2, 3]);
    expect(eventi.at(-1)).toMatchObject({ evento: 'complete', stato: { stato: 'completato' } });
    expect(op.alTermine).toHaveBeenCalledOnce();
  });

  it('si ferma sulla riga ambigua e, inserita a mano, riprende dalla successiva', async () => {
    const gestore = nuovoGestore();
    const { op, eventi } = operazioni();
    const { stato, fine } = await gestore.avvia('g1', 'u1', [crea(2), revisiona(3), crea(4)], op);

    await inAttesaSu(gestore, stato.jobId, 3);
    expect(op.scrivi).toHaveBeenCalledTimes(1);
    expect(eventi.at(-1)).toMatchObject({ evento: 'progress', stato: { stato: 'in_attesa', rigaInAttesa: { riga: 3 } } });

    const dopo = await gestore.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('Confermato') });
    const finale = await fine;

    expect(dopo).toMatchObject({ stato: 'in_corso', inseritiAMano: 1 });
    expect(dopo?.rigaInAttesa).toBeUndefined();
    expect(vi.mocked(op.scrivi).mock.calls.map(([e]: any) => [e.riga, e.azione, e.dati.nome])).toEqual([
      [2, 'crea', 'PV 2'], [3, 'crea', 'Confermato'], [4, 'crea', 'PV 4'],
    ]);
    expect(finale).toMatchObject({ stato: 'completato', elaborate: 3, creati: 3, inseritiAMano: 1 });
  });

  it('una riga ambigua di un PV esistente, inserita a mano, lo aggiorna', async () => {
    const gestore = nuovoGestore();
    const { op } = operazioni();
    const { stato, fine } = await gestore.avvia('g1', 'u1', [{ ...(revisiona(2) as any), id: 'pv9' }], op);

    await inAttesaSu(gestore, stato.jobId, 2);
    await gestore.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('X') });

    expect(op.scrivi).toHaveBeenCalledWith(expect.objectContaining({ azione: 'aggiorna', id: 'pv9' }));
    expect(await fine).toMatchObject({ aggiornati: 1, inseritiAMano: 1 });
  });

  it('una riga ambigua scartata dall\'utente conta tra gli scarti e l\'import prosegue', async () => {
    const gestore = nuovoGestore();
    const { op } = operazioni();
    const { stato, fine } = await gestore.avvia('g1', 'u1', [revisiona(2), crea(3)], op);

    await inAttesaSu(gestore, stato.jobId, 2);
    await gestore.decidi(stato.jobId, 'u1', { azione: 'scarta' });

    expect(await fine).toMatchObject({ stato: 'completato', creati: 1, scartati: 1, errori: [{ row: 2, error: "Scartata dall'utente" }] });
  });

  it('se Istanta rifiuta l\'inserimento a mano la riga resta in attesa', async () => {
    const gestore = nuovoGestore();
    const { op } = operazioni({ scrivi: vi.fn().mockRejectedValueOnce(new Error('Combinazione sconosciuta')).mockResolvedValue(undefined) });
    const { stato, fine } = await gestore.avvia('g1', 'u1', [revisiona(2)], op);
    await inAttesaSu(gestore, stato.jobId, 2);

    await expect(gestore.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('X') })).rejects.toThrow('Combinazione sconosciuta');
    expect(await gestore.stato(stato.jobId, 'u1')).toMatchObject({ stato: 'in_attesa', rigaInAttesa: { riga: 2 }, creati: 0 });

    await gestore.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('X') });
    expect(await fine).toMatchObject({ creati: 1, scartati: 0 });
  });

  it('annullare durante la pausa ferma subito l\'import: la riga in attesa e le successive non si elaborano', async () => {
    const gestore = nuovoGestore();
    const { op, eventi } = operazioni();
    const { stato, fine } = await gestore.avvia('g1', 'u1', [crea(2), revisiona(3), crea(4)], op);
    await inAttesaSu(gestore, stato.jobId, 3);

    await gestore.annulla(stato.jobId, 'u1');
    const finale = await fine;

    expect(finale).toMatchObject({ stato: 'annullato', elaborate: 1, creati: 1, nonElaborate: 2 });
    expect(finale.rigaInAttesa).toBeUndefined();
    expect(op.scrivi).toHaveBeenCalledTimes(1);
    expect(eventi.at(-1)).toMatchObject({ evento: 'complete', stato: { stato: 'annullato' } });
  });

  it('una decisione senza pausa, o di un altro utente, non si applica', async () => {
    const gestore = nuovoGestore();
    const { op } = operazioni({ scrivi: () => new Promise(() => undefined) });
    const { stato } = await gestore.avvia('g1', 'u1', [crea(2)], op);

    await expect(gestore.decidi(stato.jobId, 'u1', { azione: 'scarta' })).rejects.toBeInstanceOf(DecisioneNonApplicabile);
    expect(await gestore.decidi(stato.jobId, 'u2', { azione: 'scarta' })).toBeUndefined();
  });

  it('un doppio invio della stessa decisione scrive una volta sola', async () => {
    const gestore = nuovoGestore();
    let sblocca: () => void = () => undefined;
    const scrivi = vi.fn(() => new Promise<void>(resolve => { sblocca = resolve; }));
    const { op } = operazioni({ scrivi });
    const { stato, fine } = await gestore.avvia('g1', 'u1', [revisiona(2)], op);
    await inAttesaSu(gestore, stato.jobId, 2);

    const prima = gestore.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('X') });
    await expect(gestore.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('X') })).rejects.toBeInstanceOf(DecisioneNonApplicabile);
    await vi.waitFor(() => expect(scrivi).toHaveBeenCalled());
    sblocca();
    await prima;

    expect(scrivi).toHaveBeenCalledOnce();
    expect(await fine).toMatchObject({ creati: 1 });
  });

  it('conta i PV rimasti solo in FP perche Istanta non rispondeva', async () => {
    const gestore = nuovoGestore();
    const { op } = operazioni({ scrivi: vi.fn().mockResolvedValueOnce({ sincronizzato: false }).mockResolvedValue({ sincronizzato: true }) });

    expect(await (await gestore.avvia('g1', 'u1', [crea(2), crea(3)], op)).fine).toMatchObject({ creati: 2, soloFp: 1 });
  });

  it('una riga che Istanta rifiuta non ferma le altre', async () => {
    const gestore = nuovoGestore();
    const { op } = operazioni({ scrivi: vi.fn().mockRejectedValueOnce(new Error('Combinazione sconosciuta')).mockResolvedValue(undefined) });

    const finale = await (await gestore.avvia('g1', 'u1', [crea(2), crea(3)], op)).fine;

    expect(finale).toMatchObject({ creati: 1, scartati: 1, errori: [{ row: 2, error: 'Combinazione sconosciuta' }] });
  });

  it('annullato a meta: la riga in corso finisce, le successive non si scrivono', async () => {
    const gestore = nuovoGestore();
    let jobId = '';
    const scrivi = vi.fn(async (esito: any) => {
      // L'utente annulla mentre e in scrittura la terza riga
      if (esito.riga === 4) await gestore.annulla(jobId, 'u1');
    });
    const { op, eventi } = operazioni({ scrivi });

    const avvio = await gestore.avvia('g1', 'u1', [crea(2), crea(3), crea(4), crea(5), crea(6)], op);
    jobId = avvio.stato.jobId;
    const finale = await avvio.fine;

    expect(scrivi.mock.calls.map(([e]) => e.riga)).toEqual([2, 3, 4]);
    expect(finale).toMatchObject({ stato: 'annullato', elaborate: 3, creati: 3, nonElaborate: 2 });
    expect(eventi.at(-1)).toMatchObject({ evento: 'complete', stato: { stato: 'annullato', nonElaborate: 2 } });
  });

  it('solo chi ha avviato l\'import puo vederlo e annullarlo', async () => {
    const gestore = nuovoGestore();
    const { op } = operazioni({ scrivi: () => new Promise(() => undefined) });
    const { stato } = await gestore.avvia('g1', 'u1', [crea(2)], op);

    expect(await gestore.stato(stato.jobId, 'u2')).toBeUndefined();
    expect(await gestore.annulla(stato.jobId, 'u2')).toBeUndefined();
    expect(await gestore.stato(stato.jobId, 'u1')).toMatchObject({ jobId: stato.jobId });
  });

  it('un import in pausa conta come in corso sulla GDO', async () => {
    const gestore = nuovoGestore();
    const { op } = operazioni();
    const { stato } = await gestore.avvia('g1', 'u1', [revisiona(2)], op);
    await inAttesaSu(gestore, stato.jobId, 2);

    expect(await gestore.inCorso('g1')).toMatchObject({ jobId: stato.jobId, stato: 'in_attesa' });
  });

  it('ritrova l\'import in corso sulla GDO e l\'ultimo dell\'utente', async () => {
    const gestore = nuovoGestore();
    const { op } = operazioni({ scrivi: () => new Promise(() => undefined) });
    const { stato } = await gestore.avvia('g1', 'u1', [crea(2)], op);
    await new Promise(resolve => setImmediate(resolve));

    expect(await gestore.inCorso('g1')).toMatchObject({ jobId: stato.jobId, stato: 'in_corso' });
    expect(await gestore.inCorso('g2')).toBeUndefined();
    expect(await gestore.ultimo('u1')).toMatchObject({ jobId: stato.jobId });
  });

  it('senza punti vendita scritti non esegue le operazioni finali', async () => {
    const gestore = nuovoGestore();
    const { op } = operazioni();

    await (await gestore.avvia('g1', 'u1', [scarta(2)], op)).fine;

    expect(op.alTermine).not.toHaveBeenCalled();
  });

  it('gli eventi socket portano il jobId', () => {
    expect(eventoImportPuntiVendita('j1', 'progress')).toBe('importPV_j1_progress');
    expect(eventoImportPuntiVendita('j1', 'complete')).toBe('importPV_j1_complete');
  });

  it('geolocalizza con Nominatim le righe automatiche senza coordinate prima di scriverle', async () => {
    const gestore = nuovoGestore();
    const geocodifica = vi.fn(async () => ({ lat: 43.84, lon: 10.5 }));
    const { op } = operazioni({ geocodifica });

    const finale = await (await gestore.avvia('g1', 'u1', [crea(2)], op)).fine;

    expect(geocodifica).toHaveBeenCalledWith(expect.objectContaining({ nome: 'PV 2', cap: '55100' }));
    expect(op.scrivi).toHaveBeenCalledWith(expect.objectContaining({ dati: expect.objectContaining({ lat: 43.84, lon: 10.5 }) }));
    expect(finale).toMatchObject({ creati: 1, geolocalizzati: 1, senzaCoordinate: 0 });
  });

  it('indirizzo non trovato o Nominatim in errore: il PV si importa senza coordinate e il motivo e visibile', async () => {
    const gestore = nuovoGestore();
    const geocodifica = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Nominatim non disponibile (HTTP 429)'));
    const { op, eventi } = operazioni({ geocodifica });

    const finale = await (await gestore.avvia('g1', 'u1', [crea(2), crea(3)], op)).fine;

    expect(op.scrivi).toHaveBeenCalledTimes(2);
    expect((vi.mocked(op.scrivi).mock.calls[0] as any)[0].dati.lat).toBeUndefined();
    expect(finale).toMatchObject({
      stato: 'completato', creati: 2, geolocalizzati: 0, senzaCoordinate: 2, erroriNominatim: 1,
      ultimoErroreNominatim: 'Nominatim non disponibile (HTTP 429)',
    });
    expect(finale.errori).toEqual([
      { row: 2, error: 'Indirizzo non trovato da Nominatim: importato senza coordinate' },
      { row: 3, error: 'Nominatim non disponibile (HTTP 429): importato senza coordinate' },
    ]);
    // L'errore si vede gia durante l'import, non solo alla fine
    expect(eventi.find(e => e.evento === 'progress' && e.stato.erroriNominatim === 1)).toBeDefined();
  });

  it(`dopo ${MAX_ERRORI_NOMINATIM_DI_FILA} errori di fila l'import si ferma: le righe gia scritte restano`, async () => {
    const gestore = nuovoGestore();
    const geocodifica = vi.fn()
      .mockResolvedValueOnce({ lat: 1, lon: 2 })
      .mockRejectedValue(new Error('Nominatim non raggiungibile: fetch failed'));
    const { op, eventi } = operazioni({ geocodifica });
    const righe = Array.from({ length: 8 }, (_, i) => crea(i + 2));

    const finale = await (await gestore.avvia('g1', 'u1', righe, op)).fine;

    // Riga 2 geolocalizzata, righe 3-6 senza coordinate, alla riga 7 (quinto errore) si ferma
    expect(vi.mocked(op.scrivi).mock.calls.map(([e]: any) => e.riga)).toEqual([2, 3, 4, 5, 6]);
    expect(finale).toMatchObject({ stato: 'errore', creati: 5, erroriNominatim: 5, elaborate: 5, nonElaborate: 3 });
    expect(finale.errori.at(-1)).toEqual({
      row: 7,
      error: 'Import fermato: Nominatim non risponde (5 errori di fila). Ultimo errore: Nominatim non raggiungibile: fetch failed',
    });
    expect(eventi.at(-1)).toMatchObject({ evento: 'complete', stato: { stato: 'errore' } });
  });

  it('un indirizzo trovato o non trovato azzera gli errori di fila', async () => {
    const gestore = nuovoGestore();
    const errore = new Error('Nominatim non disponibile (HTTP 503)');
    const geocodifica = vi.fn()
      .mockRejectedValueOnce(errore).mockRejectedValueOnce(errore).mockRejectedValueOnce(errore).mockRejectedValueOnce(errore)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(errore).mockRejectedValueOnce(errore);
    const { op } = operazioni({ geocodifica });

    const finale = await (await gestore.avvia('g1', 'u1', Array.from({ length: 7 }, (_, i) => crea(i + 2)), op)).fine;

    expect(finale).toMatchObject({ stato: 'completato', creati: 7, erroriNominatim: 6, senzaCoordinate: 7 });
  });

  it('le righe con coordinate valide non interrogano Nominatim, 0,0 si', async () => {
    const gestore = nuovoGestore();
    const geocodifica = vi.fn(async () => ({ lat: 1, lon: 2 }));
    const { op } = operazioni({ geocodifica });
    const conCoordinate = { ...(crea(2) as any), dati: { ...dati('A'), lat: 43.8, lon: 10.5 } };
    const aZero = { ...(crea(3) as any), dati: { ...dati('B'), lat: 0, lon: 0 } };

    await (await gestore.avvia('g1', 'u1', [conCoordinate, aZero], op)).fine;

    expect(geocodifica).toHaveBeenCalledOnce();
    expect(geocodifica).toHaveBeenCalledWith(expect.objectContaining({ nome: 'B' }));
  });

  it('la riga inserita a mano usa le coordinate confermate, senza nuova ricerca', async () => {
    const gestore = nuovoGestore();
    const geocodifica = vi.fn(async () => ({ lat: 1, lon: 2 }));
    const { op } = operazioni({ geocodifica });
    const { stato, fine } = await gestore.avvia('g1', 'u1', [revisiona(2)], op);
    await inAttesaSu(gestore, stato.jobId, 2);

    await gestore.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: { ...dati('X'), lat: 45.1, lon: 10.8 } });
    await fine;

    expect(geocodifica).not.toHaveBeenCalled();
    expect(op.scrivi).toHaveBeenCalledWith(expect.objectContaining({ dati: expect.objectContaining({ lat: 45.1 }) }));
  });
});

// Cluster con piu worker senza sticky session: le richieste dello stesso utente arrivano a processi diversi.
// Due gestori che condividono il registro dei lavori sono due worker che condividono il DB.
describe('GestoreImportPuntiVendita con piu worker', () => {
  const dueWorker = (opzioni?: OpzioniGestoreImport) => {
    const registro = new RegistroLavoriInMemoria();
    return { registro, workerA: nuovoGestore(registro, opzioni), workerB: nuovoGestore(registro, opzioni) };
  };

  it('stato e decisione dal worker che non esegue l\'import: la riga la scrive chi decide e l\'import riprende dalla successiva', async () => {
    const { workerA, workerB } = dueWorker();
    const { op, eventi } = operazioni();
    const { stato, fine } = await workerA.avvia('g1', 'u1', [crea(2), revisiona(3), crea(4)], op);
    await inAttesaSu(workerB, stato.jobId, 3);

    const scriviB = vi.fn(async () => ({ sincronizzato: true }));
    const dopo = await workerB.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('Confermato') }, scriviB);
    const finale = await fine;

    expect(dopo).toMatchObject({ stato: 'in_corso', creati: 2, inseritiAMano: 1 });
    expect(dopo?.rigaInAttesa).toBeUndefined();
    expect(scriviB).toHaveBeenCalledWith(expect.objectContaining({ riga: 3, azione: 'crea', dati: expect.objectContaining({ nome: 'Confermato' }) }));
    // Le righe automatiche le scrive il worker dell'import, quella decisa no
    expect(vi.mocked(op.scrivi).mock.calls.map(([e]: any) => e.riga)).toEqual([2, 4]);
    expect(finale).toMatchObject({ stato: 'completato', elaborate: 3, creati: 3, inseritiAMano: 1, nonElaborate: 0 });
    expect(eventi.at(-1)).toMatchObject({ evento: 'complete', stato: { stato: 'completato' } });
    expect(await workerB.stato(stato.jobId, 'u1')).toMatchObject({ stato: 'completato', creati: 3 });
  });

  it('scartare da un altro worker conta la riga tra gli scarti e l\'import prosegue', async () => {
    const { workerA, workerB } = dueWorker();
    const { op } = operazioni();
    const { stato, fine } = await workerA.avvia('g1', 'u1', [revisiona(2), crea(3)], op);
    await inAttesaSu(workerB, stato.jobId, 2);

    await workerB.decidi(stato.jobId, 'u1', { azione: 'scarta' });

    expect(await fine).toMatchObject({ stato: 'completato', creati: 1, scartati: 1, errori: [{ row: 2, error: "Scartata dall'utente" }] });
  });

  it('se Istanta rifiuta la riga decisa su un altro worker, l\'errore risale e la riga resta in attesa', async () => {
    const { workerA, workerB } = dueWorker();
    const { op } = operazioni();
    const { stato, fine } = await workerA.avvia('g1', 'u1', [revisiona(2)], op);
    await inAttesaSu(workerB, stato.jobId, 2);

    const rifiuta = vi.fn().mockRejectedValue(new Error('Combinazione sconosciuta'));
    await expect(workerB.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('X') }, rifiuta)).rejects.toThrow('Combinazione sconosciuta');
    expect(await workerA.stato(stato.jobId, 'u1')).toMatchObject({ stato: 'in_attesa', rigaInAttesa: { riga: 2 }, creati: 0 });

    // Corretta, la stessa riga si puo decidere di nuovo
    await workerB.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('X') }, vi.fn(async () => undefined));
    expect(await fine).toMatchObject({ stato: 'completato', creati: 1, inseritiAMano: 1 });
  });

  it('due decisioni sulla stessa riga da due worker: la riga si scrive una volta sola', async () => {
    const { workerA, workerB } = dueWorker();
    const { op } = operazioni();
    const { stato, fine } = await workerA.avvia('g1', 'u1', [revisiona(2)], op);
    await inAttesaSu(workerB, stato.jobId, 2);
    let sblocca: () => void = () => undefined;
    const scriviB = vi.fn(() => new Promise<void>(resolve => { sblocca = resolve; }));
    const scriviA = vi.fn(async () => undefined);

    const prima = workerB.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('X') }, scriviB);
    await vi.waitFor(() => expect(scriviB).toHaveBeenCalled());
    await expect(workerA.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('X') }, scriviA)).rejects.toBeInstanceOf(DecisioneNonApplicabile);
    await expect(workerA.decidi(stato.jobId, 'u1', { azione: 'scarta' })).rejects.toBeInstanceOf(DecisioneNonApplicabile);
    sblocca();
    await prima;

    expect(scriviA).not.toHaveBeenCalled();
    expect(await fine).toMatchObject({ creati: 1, scartati: 0, inseritiAMano: 1 });
  });

  it('annullare da un altro worker durante la pausa ferma l\'import: le righe successive non si elaborano', async () => {
    const { workerA, workerB } = dueWorker();
    const { op } = operazioni();
    const { stato, fine } = await workerA.avvia('g1', 'u1', [crea(2), revisiona(3), crea(4)], op);
    await inAttesaSu(workerB, stato.jobId, 3);

    expect(await workerB.annulla(stato.jobId, 'u1')).toMatchObject({ jobId: stato.jobId });
    const finale = await fine;

    expect(finale).toMatchObject({ stato: 'annullato', elaborate: 1, creati: 1, nonElaborate: 2 });
    expect(finale.rigaInAttesa).toBeUndefined();
    expect(op.scrivi).toHaveBeenCalledTimes(1);
  });

  it('annullare da un altro worker durante le righe automatiche ferma l\'import dopo la riga in corso', async () => {
    const { workerA, workerB } = dueWorker();
    let jobId = '';
    const scrivi = vi.fn(async (esito: any) => {
      if (esito.riga === 3) await workerB.annulla(jobId, 'u1');
    });
    const avvio = await workerA.avvia('g1', 'u1', [crea(2), crea(3), crea(4), crea(5)], operazioni({ scrivi }).op);
    jobId = avvio.stato.jobId;

    const finale = await avvio.fine;

    expect(scrivi.mock.calls.map(([e]) => e.riga)).toEqual([2, 3]);
    expect(finale).toMatchObject({ stato: 'annullato', elaborate: 2, creati: 2, nonElaborate: 2 });
  });

  it('annullare mentre un altro worker scrive la riga decisa: la riga si conta, poi l\'import si ferma', async () => {
    const { workerA, workerB } = dueWorker();
    const { op } = operazioni();
    const { stato, fine } = await workerA.avvia('g1', 'u1', [revisiona(2), crea(3)], op);
    await inAttesaSu(workerB, stato.jobId, 2);
    let sblocca: () => void = () => undefined;
    const scriviB = vi.fn(() => new Promise<void>(resolve => { sblocca = resolve; }));

    const decisione = workerB.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('X') }, scriviB);
    await vi.waitFor(() => expect(scriviB).toHaveBeenCalled());
    await workerB.annulla(stato.jobId, 'u1');
    sblocca();
    await decisione;

    expect(await fine).toMatchObject({ stato: 'annullato', elaborate: 1, creati: 1, inseritiAMano: 1, nonElaborate: 1 });
    expect(op.scrivi).not.toHaveBeenCalled();
  });

  it('un secondo import sulla stessa GDO da un altro worker e rifiutato con lo stato di quello in corso', async () => {
    const { workerA, workerB } = dueWorker();
    const { stato } = await workerA.avvia('g1', 'u1', [crea(2)], operazioni({ scrivi: () => new Promise(() => undefined) }).op);

    const errore = await workerB.avvia('g1', 'u2', [crea(2)], operazioni().op).catch(e => e);

    expect(errore).toBeInstanceOf(ImportGiaInCorso);
    expect(errore.stato).toMatchObject({ jobId: stato.jobId, stato: 'in_corso' });
    expect(await workerB.inCorso('g1')).toMatchObject({ jobId: stato.jobId });
    // Su un'altra GDO si puo importare
    await expect(workerB.avvia('g2', 'u2', [crea(2)], operazioni().op)).resolves.toMatchObject({ stato: { stato: 'in_corso' } });
  });

  it('un import il cui worker si e fermato non blocca la GDO e risulta interrotto', async () => {
    const { registro, workerA, workerB } = dueWorker();
    const { stato } = await workerA.avvia('g1', 'u1', [crea(2)], operazioni({ scrivi: () => new Promise(() => undefined) }).op);
    // Il worker A non rinnova piu il battito (riavvio, crash)
    registro.invecchiaBattito(stato.jobId);

    expect(await workerB.inCorso('g1')).toBeUndefined();
    expect(await workerB.stato(stato.jobId, 'u1')).toMatchObject({ stato: 'errore', errori: [{ row: 0, error: MESSAGGIO_IMPORT_INTERROTTO }] });

    const nuovo = await workerB.avvia('g1', 'u1', [crea(2)], operazioni().op);
    expect(nuovo.stato.jobId).not.toBe(stato.jobId);
    expect(await nuovo.fine).toMatchObject({ stato: 'completato', creati: 1 });
  });

  it('il battito tiene vivo l\'import anche durante una riga lunga', async () => {
    const { registro, workerA, workerB } = dueWorker({ intervalloAttesaMs: 5, intervalloBattitoMs: 5 });
    let sblocca: () => void = () => undefined;
    const scrivi = vi.fn(() => new Promise<void>(resolve => { sblocca = resolve; }));
    const { stato, fine } = await workerA.avvia('g1', 'u1', [crea(2)], operazioni({ scrivi }).op);
    await vi.waitFor(() => expect(scrivi).toHaveBeenCalled());

    registro.invecchiaBattito(stato.jobId);

    await vi.waitFor(async () => expect(await workerB.inCorso('g1')).toMatchObject({ jobId: stato.jobId }));
    sblocca();
    await fine;
  });

  it('senza decisione entro il tempo massimo l\'import in attesa si annulla e libera la GDO', async () => {
    const { workerA, workerB } = dueWorker({ intervalloAttesaMs: 5, attesaMassimaMs: 30 });
    const { op } = operazioni();
    const { fine } = await workerA.avvia('g1', 'u1', [crea(2), revisiona(3), crea(4)], op);

    const finale = await fine;

    expect(finale).toMatchObject({ stato: 'annullato', elaborate: 1, nonElaborate: 2 });
    expect(finale.errori.at(-1)).toMatchObject({ row: 3, error: expect.stringContaining('Nessuna decisione') });
    expect(await workerB.inCorso('g1')).toBeUndefined();
  });

  it('l\'avanzamento completo si salva al piu una volta per intervallo, l\'annullamento si controlla a ogni riga', async () => {
    const registro = new RegistroLavoriInMemoria();
    const aggiorna = vi.spyOn(registro, 'aggiorna');
    const gestore = nuovoGestore(registro, { intervalloAttesaMs: 5, intervalloSalvataggioMs: 60_000 });

    const finale = await (await gestore.avvia('g1', 'u1', [scarta(2), scarta(3), scarta(4)], operazioni().op)).fine;

    // Tre righe, tre controlli dell'annullamento, nessuna riscrittura dell'elenco errori
    expect(aggiorna).toHaveBeenCalledTimes(3);
    expect(aggiorna.mock.calls.every(([, avanzamento]) => avanzamento === undefined)).toBe(true);
    // A fine import il registro ha comunque lo stato completo
    expect(await gestore.stato(finale.jobId, 'u1')).toMatchObject({ stato: 'completato', scartati: 3, elaborate: 3 });
  });

  it('ricaricando la pagina su un altro worker si ritrova l\'ultimo import finito, non uno di oltre un\'ora fa', async () => {
    const { registro, workerA, workerB } = dueWorker();
    const { stato, fine } = await workerA.avvia('g1', 'u1', [crea(2)], operazioni().op);
    await fine;

    expect(await workerB.ultimo('u1')).toMatchObject({ jobId: stato.jobId, stato: 'completato' });
    registro.righe.get(stato.jobId)!.concluso_at = new Date(Date.now() - 61 * 60 * 1000);
    expect(await workerB.ultimo('u1')).toBeUndefined();
  });
});
