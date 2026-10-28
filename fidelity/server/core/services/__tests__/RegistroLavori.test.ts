import { Op } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { sequelize } from '../../db/SequelizeConnector';
import { LavoroInBackground, STATO_LAVORO } from '../../models/lavori_in_background';
import {
  decisionePresa,
  mantieniVivo,
  prenotazioneValida,
  RegistroLavoriDb,
  SCADENZA_BATTITO_MS,
  SCADENZA_PRENOTAZIONE_MS,
} from '../RegistroLavori';

// Registro dei lavori in background su DB (tabella lavori_in_background): nessuna connessione,
// si verificano le condizioni delle query che rendono atomici avvio, decisione e annullamento.

const t = { id: 'transazione' };
const ID = '0b9f2c4e-6a1d-4f3b-9c2e-1a2b3c4d5e6f';

const riga = (valori: Record<string, unknown> = {}) => ({
  id: ID,
  tipo: 'import_punti_vendita',
  chiave: 'g1',
  id_utente: 'u1',
  id_gdo: 'g1',
  stato: STATO_LAVORO.IN_CORSO,
  avanzamento: { elaborate: 0 },
  attesa: null,
  richiesta_decisione: null,
  decisione: null,
  annullamento_richiesto: false,
  risultato: null,
  errore: null,
  heartbeat_at: new Date(),
  concluso_at: null,
  createdat: new Date(),
  updatedat: new Date(),
  ...valori,
});
const fermoDa = (ms: number) => new Date(Date.now() - ms);

let query: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.spyOn(sequelize, 'transaction').mockImplementation(((callback: any) => callback(t)) as any);
  query = vi.spyOn(sequelize, 'query').mockResolvedValue([] as any) as any;
  vi.spyOn(LavoroInBackground, 'destroy').mockResolvedValue(0 as any);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RegistroLavoriDb.avvia: un solo lavoro attivo per tipo e chiave', () => {
  it('prende il lock di tipo e chiave nella transazione e crea il lavoro se non ce n\'e uno attivo', async () => {
    vi.spyOn(LavoroInBackground, 'findAll').mockResolvedValue([] as any);
    const crea = vi.spyOn(LavoroInBackground, 'create').mockImplementation((async (valori: any) => ({ get: () => riga(valori) })) as any);

    const avvio = await new RegistroLavoriDb().avvia({ id: ID, tipo: 'import_punti_vendita', chiave: 'g1', idUtente: 'u1', idGdo: 'g1', avanzamento: { elaborate: 0 } });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.objectContaining({ replacements: { chiave: 'lavori:import_punti_vendita:g1' }, transaction: t })
    );
    expect(crea).toHaveBeenCalledWith(
      expect.objectContaining({ id: ID, tipo: 'import_punti_vendita', chiave: 'g1', id_utente: 'u1', stato: STATO_LAVORO.IN_CORSO, annullamento_richiesto: false }),
      { transaction: t }
    );
    expect(avvio).toMatchObject({ avviato: true, lavoro: { id: ID, attivo: true, interrotto: false, avanzamento: { elaborate: 0 } } });
  });

  it('un lavoro attivo con battito recente blocca il secondo avvio e viene restituito', async () => {
    vi.spyOn(LavoroInBackground, 'findAll').mockResolvedValue([riga({ avanzamento: { elaborate: 7 } })] as any);
    const crea = vi.spyOn(LavoroInBackground, 'create');

    const avvio = await new RegistroLavoriDb().avvia({ tipo: 'import_punti_vendita', chiave: 'g1', idUtente: 'u2' });

    expect(avvio).toMatchObject({ avviato: false, lavoro: { id: ID, attivo: true, avanzamento: { elaborate: 7 } } });
    expect(crea).not.toHaveBeenCalled();
  });

  it('un lavoro senza battito da oltre la scadenza non blocca: diventa INTERROTTO e se ne avvia uno nuovo', async () => {
    vi.spyOn(LavoroInBackground, 'findAll').mockResolvedValue([riga({ heartbeat_at: fermoDa(SCADENZA_BATTITO_MS + 1000) })] as any);
    const aggiorna = vi.spyOn(LavoroInBackground, 'update').mockResolvedValue([1] as any);
    const crea = vi.spyOn(LavoroInBackground, 'create').mockImplementation((async (valori: any) => ({ get: () => riga({ ...valori, id: 'nuovo' }) })) as any);

    const avvio = await new RegistroLavoriDb().avvia({ tipo: 'import_punti_vendita', chiave: 'g1' });

    expect(aggiorna).toHaveBeenCalledWith(
      expect.objectContaining({ stato: STATO_LAVORO.INTERROTTO, concluso_at: expect.any(Date) }),
      expect.objectContaining({ where: expect.objectContaining({ id: { [Op.in]: [ID] } }), transaction: t })
    );
    expect(crea).toHaveBeenCalled();
    expect(avvio).toMatchObject({ avviato: true, lavoro: { id: 'nuovo' } });
  });
});

describe('RegistroLavoriDb: lettura', () => {
  it('un lavoro in corso senza battito recente risulta interrotto e non attivo', async () => {
    vi.spyOn(LavoroInBackground, 'findByPk').mockResolvedValue(riga({ heartbeat_at: fermoDa(SCADENZA_BATTITO_MS + 1000) }) as any);

    expect(await new RegistroLavoriDb().leggi(ID)).toMatchObject({ attivo: false, interrotto: true, stato: STATO_LAVORO.IN_CORSO });
  });

  it('un id che non e un UUID non interroga il DB', async () => {
    const trova = vi.spyOn(LavoroInBackground, 'findByPk');

    expect(await new RegistroLavoriDb().leggi('inesistente')).toBeUndefined();
    expect(trova).not.toHaveBeenCalled();
  });

  it('il lavoro attivo si cerca solo tra quelli con battito recente', async () => {
    const trova = vi.spyOn(LavoroInBackground, 'findOne').mockResolvedValue(null);

    await new RegistroLavoriDb().attivo('import_punti_vendita', 'g1');

    const where = (trova.mock.calls[0][0] as any).where;
    expect(where).toMatchObject({ tipo: 'import_punti_vendita', chiave: 'g1' });
    expect(where.stato[Op.in]).toEqual([STATO_LAVORO.IN_CORSO, STATO_LAVORO.IN_ATTESA_DECISIONE]);
    expect(where.heartbeat_at[Op.gte].getTime()).toBeGreaterThanOrEqual(Date.now() - SCADENZA_BATTITO_MS - 1000);
  });
});

describe('RegistroLavoriDb: avanzamento e annullamento', () => {
  it('aggiorna salva l\'avanzamento, rinnova il battito e riporta l\'annullamento chiesto da un altro worker', async () => {
    const aggiorna = vi.spyOn(LavoroInBackground, 'update').mockResolvedValue([1, [{ annullamento_richiesto: true }]] as any);

    const esito = await new RegistroLavoriDb().aggiorna(ID, { elaborate: 3 });

    expect(esito).toEqual({ annullamentoRichiesto: true });
    expect(aggiorna).toHaveBeenCalledWith(
      { avanzamento: { elaborate: 3 }, heartbeat_at: expect.any(Date) },
      { where: { id: ID }, returning: ['annullamento_richiesto'] }
    );
  });

  it('senza avanzamento rinnova solo il battito: il controllo dell\'annullamento a ogni passo resta leggero', async () => {
    const aggiorna = vi.spyOn(LavoroInBackground, 'update').mockResolvedValue([1, [{ annullamento_richiesto: false }]] as any);

    expect(await new RegistroLavoriDb().aggiorna(ID)).toEqual({ annullamentoRichiesto: false });
    expect(aggiorna).toHaveBeenCalledWith({ heartbeat_at: expect.any(Date) }, { where: { id: ID }, returning: ['annullamento_richiesto'] });
  });

  it('l\'annullamento si registra solo su un lavoro ancora attivo', async () => {
    const aggiorna = vi.spyOn(LavoroInBackground, 'update').mockResolvedValueOnce([1] as any).mockResolvedValueOnce([0] as any);
    const registro = new RegistroLavoriDb();

    expect(await registro.richiediAnnullamento(ID)).toBe(true);
    expect(await registro.richiediAnnullamento(ID)).toBe(false);
    expect(aggiorna).toHaveBeenCalledWith(
      { annullamento_richiesto: true },
      { where: { id: ID, stato: { [Op.in]: [STATO_LAVORO.IN_CORSO, STATO_LAVORO.IN_ATTESA_DECISIONE] } } }
    );
  });
});

describe('RegistroLavoriDb: decisione sulla richiesta in attesa', () => {
  it('la decisione si registra solo se il lavoro aspetta ancora quella richiesta e nessuno l\'ha gia presa: accettata una volta', async () => {
    const aggiorna = vi.spyOn(LavoroInBackground, 'update').mockResolvedValueOnce([1] as any).mockResolvedValueOnce([0] as any);
    const registro = new RegistroLavoriDb();

    expect(await registro.registraDecisione(ID, '3', { azione: 'scarta' }, { scartati: 1 })).toBe(true);
    expect(await registro.registraDecisione(ID, '3', { azione: 'scarta' }, { scartati: 1 })).toBe(false);
    expect(aggiorna).toHaveBeenCalledWith(
      expect.objectContaining({ stato: STATO_LAVORO.IN_CORSO, decisione: { azione: 'scarta' }, avanzamento: { scartati: 1 } }),
      { where: { id: ID, stato: STATO_LAVORO.IN_ATTESA_DECISIONE, attesa: '3', decisione: null } }
    );
  });

  it('chi ha prenotato la decisione la registra solo se la prenotazione e ancora sua', async () => {
    const aggiorna = vi.spyOn(LavoroInBackground, 'update').mockResolvedValue([1] as any);

    await new RegistroLavoriDb().registraDecisione(ID, '3', { azione: 'inserisci' }, {}, 'p1');

    expect(aggiorna).toHaveBeenCalledWith(
      expect.anything(),
      { where: { id: ID, stato: STATO_LAVORO.IN_ATTESA_DECISIONE, attesa: '3', decisione: { prenotazione: 'p1' } } }
    );
  });

  it('prenota una richiesta libera con un compare-and-set sulla decisione vuota', async () => {
    vi.spyOn(LavoroInBackground, 'findByPk').mockResolvedValue(riga({ stato: STATO_LAVORO.IN_ATTESA_DECISIONE, attesa: '3' }) as any);
    const aggiorna = vi.spyOn(LavoroInBackground, 'update').mockResolvedValue([1] as any);

    const prenotazione = await new RegistroLavoriDb().prenotaDecisione(ID, '3');

    expect(prenotazione).toEqual(expect.any(String));
    expect(aggiorna).toHaveBeenCalledWith(
      { decisione: { prenotazione, il: expect.any(String) } },
      { where: { id: ID, stato: STATO_LAVORO.IN_ATTESA_DECISIONE, attesa: '3', decisione: null } }
    );
  });

  it('una richiesta gia prenotata da poco, o in attesa su un\'altra riga, non si prenota', async () => {
    const trova = vi.spyOn(LavoroInBackground, 'findByPk')
      .mockResolvedValueOnce(riga({ stato: STATO_LAVORO.IN_ATTESA_DECISIONE, attesa: '3', decisione: { prenotazione: 'p1', il: new Date().toISOString() } }) as any)
      .mockResolvedValueOnce(riga({ stato: STATO_LAVORO.IN_ATTESA_DECISIONE, attesa: '4' }) as any);
    const aggiorna = vi.spyOn(LavoroInBackground, 'update');
    const registro = new RegistroLavoriDb();

    expect(await registro.prenotaDecisione(ID, '3')).toBeUndefined();
    expect(await registro.prenotaDecisione(ID, '3')).toBeUndefined();
    expect(trova).toHaveBeenCalledTimes(2);
    expect(aggiorna).not.toHaveBeenCalled();
  });

  it('una prenotazione scaduta (worker fermo a meta) si riprende, solo se e ancora quella letta', async () => {
    const scaduta = { prenotazione: 'vecchia', il: fermoDa(SCADENZA_PRENOTAZIONE_MS + 1000).toISOString() };
    vi.spyOn(LavoroInBackground, 'findByPk').mockResolvedValue(riga({ stato: STATO_LAVORO.IN_ATTESA_DECISIONE, attesa: '3', decisione: scaduta }) as any);
    const aggiorna = vi.spyOn(LavoroInBackground, 'update').mockResolvedValue([1] as any);

    expect(await new RegistroLavoriDb().prenotaDecisione(ID, '3')).toEqual(expect.any(String));
    expect(aggiorna).toHaveBeenCalledWith(
      expect.anything(),
      { where: { id: ID, stato: STATO_LAVORO.IN_ATTESA_DECISIONE, attesa: '3', decisione: { prenotazione: 'vecchia' } } }
    );
  });

  it('distingue una decisione presa da una prenotazione in corso', () => {
    expect(decisionePresa({ azione: 'scarta' })).toBe(true);
    expect(decisionePresa(null)).toBe(false);
    expect(decisionePresa({ prenotazione: 'p1', il: new Date().toISOString() })).toBe(false);
    expect(prenotazioneValida({ prenotazione: 'p1', il: new Date().toISOString() })).toBe(true);
    expect(prenotazioneValida({ prenotazione: 'p1', il: fermoDa(SCADENZA_PRENOTAZIONE_MS + 1000).toISOString() })).toBe(false);
  });
});

describe('mantieniVivo', () => {
  it('rinnova il battito a intervalli finche non viene fermato', async () => {
    vi.useFakeTimers();
    const registro = { battito: vi.fn(async () => undefined) };

    const ferma = mantieniVivo(registro as any, ID, 1000);
    await vi.advanceTimersByTimeAsync(3000);
    ferma();
    await vi.advanceTimersByTimeAsync(3000);

    expect(registro.battito).toHaveBeenCalledTimes(3);
    expect(registro.battito).toHaveBeenCalledWith(ID);
  });
});
