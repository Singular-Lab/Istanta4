import { describe, expect, it, vi } from 'vitest';
import type { CreatePuntoVenditaDTO, EsitoRigaImportPuntoVenditaDTO, StatoImportPuntiVenditaDTO } from '../../dto';
import { DecisioneNonApplicabile, eventoImportPuntiVendita, GestoreImportPuntiVendita, type OperazioniImportPuntiVendita } from '../ImportPuntiVenditaJob';

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

/** Attende che il job arrivi in pausa sulla riga indicata. */
async function inAttesaSu(gestore: GestoreImportPuntiVendita, jobId: string, riga: number) {
  await vi.waitFor(() => expect(gestore.stato(jobId, 'u1')).toMatchObject({ stato: 'in_attesa', rigaInAttesa: { riga } }));
}

describe('GestoreImportPuntiVendita', () => {
  it('elabora le righe in background e notifica l\'avanzamento fino al riepilogo', async () => {
    const gestore = new GestoreImportPuntiVendita();
    const { op, eventi } = operazioni();

    const { stato, fine } = gestore.avvia('g1', 'u1', [crea(2), aggiorna(3), scarta(4)], op);
    expect(stato).toMatchObject({ stato: 'in_corso', totale: 3, elaborate: 0 });
    const finale = await fine;

    expect(finale).toMatchObject({ stato: 'completato', elaborate: 3, creati: 1, aggiornati: 1, scartati: 1, nonElaborate: 0, soloFp: 0 });
    expect(finale.errori).toEqual([{ row: 4, error: 'CAP non valido' }]);
    expect(eventi.filter(e => e.evento === 'progress').map(e => e.stato.elaborate)).toEqual([1, 2, 3]);
    expect(eventi.at(-1)).toMatchObject({ evento: 'complete', stato: { stato: 'completato' } });
    expect(op.alTermine).toHaveBeenCalledOnce();
  });

  it('si ferma sulla riga ambigua e, inserita a mano, riprende dalla successiva', async () => {
    const gestore = new GestoreImportPuntiVendita();
    const { op, eventi } = operazioni();
    const { stato, fine } = gestore.avvia('g1', 'u1', [crea(2), revisiona(3), crea(4)], op);

    await inAttesaSu(gestore, stato.jobId, 3);
    expect(op.scrivi).toHaveBeenCalledTimes(1);
    expect(eventi.at(-1)).toMatchObject({ evento: 'progress', stato: { stato: 'in_attesa', rigaInAttesa: { riga: 3 } } });

    const dopo = await gestore.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('Confermato') });
    const finale = await fine;

    expect(dopo).toMatchObject({ stato: 'in_corso', inseritiAMano: 1 });
    expect(dopo?.rigaInAttesa).toBeUndefined();
    expect(op.scrivi.mock.calls.map(([e]: any) => [e.riga, e.azione, e.dati.nome])).toEqual([
      [2, 'crea', 'PV 2'], [3, 'crea', 'Confermato'], [4, 'crea', 'PV 4'],
    ]);
    expect(finale).toMatchObject({ stato: 'completato', elaborate: 3, creati: 3, inseritiAMano: 1 });
  });

  it('una riga ambigua di un PV esistente, inserita a mano, lo aggiorna', async () => {
    const gestore = new GestoreImportPuntiVendita();
    const { op } = operazioni();
    const { stato, fine } = gestore.avvia('g1', 'u1', [{ ...(revisiona(2) as any), id: 'pv9' }], op);

    await inAttesaSu(gestore, stato.jobId, 2);
    await gestore.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('X') });

    expect(op.scrivi).toHaveBeenCalledWith(expect.objectContaining({ azione: 'aggiorna', id: 'pv9' }));
    expect(await fine).toMatchObject({ aggiornati: 1, inseritiAMano: 1 });
  });

  it('una riga ambigua scartata dall\'utente conta tra gli scarti e l\'import prosegue', async () => {
    const gestore = new GestoreImportPuntiVendita();
    const { op } = operazioni();
    const { stato, fine } = gestore.avvia('g1', 'u1', [revisiona(2), crea(3)], op);

    await inAttesaSu(gestore, stato.jobId, 2);
    await gestore.decidi(stato.jobId, 'u1', { azione: 'scarta' });

    expect(await fine).toMatchObject({ stato: 'completato', creati: 1, scartati: 1, errori: [{ row: 2, error: "Scartata dall'utente" }] });
  });

  it('se Istanta rifiuta l\'inserimento a mano la riga resta in attesa', async () => {
    const gestore = new GestoreImportPuntiVendita();
    const { op } = operazioni({ scrivi: vi.fn().mockRejectedValueOnce(new Error('Combinazione sconosciuta')).mockResolvedValue(undefined) });
    const { stato, fine } = gestore.avvia('g1', 'u1', [revisiona(2)], op);
    await inAttesaSu(gestore, stato.jobId, 2);

    await expect(gestore.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('X') })).rejects.toThrow('Combinazione sconosciuta');
    expect(gestore.stato(stato.jobId, 'u1')).toMatchObject({ stato: 'in_attesa', rigaInAttesa: { riga: 2 }, creati: 0 });

    await gestore.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('X') });
    expect(await fine).toMatchObject({ creati: 1, scartati: 0 });
  });

  it('annullare durante la pausa ferma subito l\'import: la riga in attesa e le successive non si elaborano', async () => {
    const gestore = new GestoreImportPuntiVendita();
    const { op, eventi } = operazioni();
    const { stato, fine } = gestore.avvia('g1', 'u1', [crea(2), revisiona(3), crea(4)], op);
    await inAttesaSu(gestore, stato.jobId, 3);

    gestore.annulla(stato.jobId, 'u1');
    const finale = await fine;

    expect(finale).toMatchObject({ stato: 'annullato', elaborate: 1, creati: 1, nonElaborate: 2 });
    expect(finale.rigaInAttesa).toBeUndefined();
    expect(op.scrivi).toHaveBeenCalledTimes(1);
    expect(eventi.at(-1)).toMatchObject({ evento: 'complete', stato: { stato: 'annullato' } });
  });

  it('una decisione senza pausa, o di un altro utente, non si applica', async () => {
    const gestore = new GestoreImportPuntiVendita();
    const { op } = operazioni({ scrivi: () => new Promise(() => undefined) });
    const { stato } = gestore.avvia('g1', 'u1', [crea(2)], op);

    await expect(gestore.decidi(stato.jobId, 'u1', { azione: 'scarta' })).rejects.toBeInstanceOf(DecisioneNonApplicabile);
    expect(await gestore.decidi(stato.jobId, 'u2', { azione: 'scarta' })).toBeUndefined();
  });

  it('un doppio invio della stessa decisione scrive una volta sola', async () => {
    const gestore = new GestoreImportPuntiVendita();
    let sblocca: () => void = () => undefined;
    const scrivi = vi.fn(() => new Promise<void>(resolve => { sblocca = resolve; }));
    const { op } = operazioni({ scrivi });
    const { stato, fine } = gestore.avvia('g1', 'u1', [revisiona(2)], op);
    await inAttesaSu(gestore, stato.jobId, 2);

    const prima = gestore.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('X') });
    await expect(gestore.decidi(stato.jobId, 'u1', { azione: 'inserisci', dati: dati('X') })).rejects.toBeInstanceOf(DecisioneNonApplicabile);
    sblocca();
    await prima;

    expect(scrivi).toHaveBeenCalledOnce();
    expect(await fine).toMatchObject({ creati: 1 });
  });

  it('conta i PV rimasti solo in FP perche Istanta non rispondeva', async () => {
    const gestore = new GestoreImportPuntiVendita();
    const { op } = operazioni({ scrivi: vi.fn().mockResolvedValueOnce({ sincronizzato: false }).mockResolvedValue({ sincronizzato: true }) });

    expect(await gestore.avvia('g1', 'u1', [crea(2), crea(3)], op).fine).toMatchObject({ creati: 2, soloFp: 1 });
  });

  it('una riga che Istanta rifiuta non ferma le altre', async () => {
    const gestore = new GestoreImportPuntiVendita();
    const { op } = operazioni({ scrivi: vi.fn().mockRejectedValueOnce(new Error('Combinazione sconosciuta')).mockResolvedValue(undefined) });

    const finale = await gestore.avvia('g1', 'u1', [crea(2), crea(3)], op).fine;

    expect(finale).toMatchObject({ creati: 1, scartati: 1, errori: [{ row: 2, error: 'Combinazione sconosciuta' }] });
  });

  it('annullato a meta: la riga in corso finisce, le successive non si scrivono', async () => {
    const gestore = new GestoreImportPuntiVendita();
    let jobId = '';
    const scrivi = vi.fn(async (esito: any) => {
      // L'utente annulla mentre e in scrittura la terza riga
      if (esito.riga === 4) gestore.annulla(jobId, 'u1');
    });
    const { op, eventi } = operazioni({ scrivi });

    const avvio = gestore.avvia('g1', 'u1', [crea(2), crea(3), crea(4), crea(5), crea(6)], op);
    jobId = avvio.stato.jobId;
    const finale = await avvio.fine;

    expect(scrivi.mock.calls.map(([e]) => e.riga)).toEqual([2, 3, 4]);
    expect(finale).toMatchObject({ stato: 'annullato', elaborate: 3, creati: 3, nonElaborate: 2 });
    expect(eventi.at(-1)).toMatchObject({ evento: 'complete', stato: { stato: 'annullato', nonElaborate: 2 } });
  });

  it('solo chi ha avviato l\'import puo vederlo e annullarlo', () => {
    const gestore = new GestoreImportPuntiVendita();
    const { op } = operazioni({ scrivi: () => new Promise(() => undefined) });
    const { stato } = gestore.avvia('g1', 'u1', [crea(2)], op);

    expect(gestore.stato(stato.jobId, 'u2')).toBeUndefined();
    expect(gestore.annulla(stato.jobId, 'u2')).toBeUndefined();
    expect(gestore.stato(stato.jobId, 'u1')).toMatchObject({ jobId: stato.jobId });
  });

  it('un import in pausa conta come in corso sulla GDO', async () => {
    const gestore = new GestoreImportPuntiVendita();
    const { op } = operazioni();
    const { stato } = gestore.avvia('g1', 'u1', [revisiona(2)], op);
    await inAttesaSu(gestore, stato.jobId, 2);

    expect(gestore.inCorso('g1')).toMatchObject({ jobId: stato.jobId, stato: 'in_attesa' });
  });

  it('ritrova l\'import in corso sulla GDO e l\'ultimo dell\'utente', async () => {
    const gestore = new GestoreImportPuntiVendita();
    const { op } = operazioni({ scrivi: () => new Promise(() => undefined) });
    const { stato } = gestore.avvia('g1', 'u1', [crea(2)], op);
    await new Promise(resolve => setImmediate(resolve));

    expect(gestore.inCorso('g1')).toMatchObject({ jobId: stato.jobId, stato: 'in_corso' });
    expect(gestore.inCorso('g2')).toBeUndefined();
    expect(gestore.ultimo('u1')).toMatchObject({ jobId: stato.jobId });
  });

  it('senza punti vendita scritti non esegue le operazioni finali', async () => {
    const gestore = new GestoreImportPuntiVendita();
    const { op } = operazioni();

    await gestore.avvia('g1', 'u1', [scarta(2)], op).fine;

    expect(op.alTermine).not.toHaveBeenCalled();
  });

  it('gli eventi socket portano il jobId', () => {
    expect(eventoImportPuntiVendita('j1', 'progress')).toBe('importPV_j1_progress');
    expect(eventoImportPuntiVendita('j1', 'complete')).toBe('importPV_j1_complete');
  });
});
