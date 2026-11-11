import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { ApplicationError, BadRequestError, NotFoundError } from '../../../../lib/errors';
import type { IAnalisiPuntoVenditaService } from '../../interfaces/IAnalisiPuntoVenditaService';
import type { IConsultazionePuntiVenditaService } from '../../interfaces/IConsultazionePuntiVenditaService';
import type { CollegamentiPuntiVenditaVolantino, IStoriaPuntoVenditaService } from '../../interfaces/IStoriaPuntoVenditaService';
import type { PosizioneRiga, StatoRicercaPosizioni } from '../../../../lib/puntiVendita/analisi';
import type { EsitoRicercaPosizione } from '../../repositories/PosizioniRigheRepository';
import type { FiltriVerifica } from '../../services/AnalisiPuntoVenditaService';
import { type IndirizzoDaCercare, type OperazioniPosizioni, RicercaPosizioniGiaInCorso } from '../../services/PosizioniRigheJob';

// Le pagine del PV sulla timeline dei volantini: permessi, GDO della sessione e ordine delle route
// sullo stesso percorso base della consultazione e della storia.

const permessi = vi.hoisted(() => ({ concessi: new Set<string>() }));
const anagrafica = vi.hoisted(() => ({ idGdo: 'gdo-sessione' as string | null }));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: (codice: string) => (_req: Request, res: Response, next: NextFunction) => {
    if (permessi.concessi.has(codice)) {
      next();
      return;
    }
    res.status(403).json({ codice });
  },
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../ws-server', () => ({ emitToClients: vi.fn() }));

vi.mock('../../models', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  UtentiGDO: { findOne: vi.fn(async () => (anagrafica.idGdo ? { id_gdo_utentegdo: anagrafica.idGdo, id_ruolo_utente_gdo: null } : null)) },
}));

import { AnalisiPuntoVenditaController } from '../AnalisiPuntoVenditaController';
import { ConsultazionePuntiVenditaController } from '../ConsultazionePuntiVenditaController';
import { StoriaPuntoVenditaController } from '../StoriaPuntoVenditaController';

const ID_PV = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ID_KIT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function servizioFinto() {
  return {
    analisi: vi.fn(async (idPuntoVendita: string, _idGdo: string | null) => ({ idPuntoVendita } as never)),
    volantino: vi.fn(async (_id: string, idKit: string, _idGdo: string | null) => ({ kit: { id: idKit, titolo: 'SS LI 45' } } as never)),
    referenza: vi.fn(async (_id: string, chiave: string, _idGdo: string | null) => ({ chiave } as never)),
    reteInsegne: vi.fn(async (_idGdo: string) => ({ anni: [], insegne: [] })),
    qualita: vi.fn(async (_idGdo: string) => ({ totale: 1, senzaCoordinate: 0, senzaCodice: 0, righeDaRevisionare: 0, conStoria: 1, dispositiviOffline: 0 })),
    righeNonAbbinate: vi.fn(async (_idGdo: string, pagina?: number, dimensione?: number) => ({ righe: [], totale: 0, pagina: pagina ?? 1, dimensione: dimensione ?? 10 })),
    volantiniRigaNonAbbinata: vi.fn(async (_idGdo: string, chiave: unknown) => ({ chiave: String(chiave), volantini: [] })),
    verificaCollegamenti: vi.fn(async (_idGdo: string, filtri?: FiltriVerifica) => ({
      gruppi: [], totale: 0, pagina: filtri?.pagina ?? 1, dimensione: filtri?.dimensione ?? 10,
      conteggi: { coerente: 0, da_verificare: 0, incongruente: 0 }, posizioniDaCercare: 0, posizioniNonTrovate: 0,
    })),
    indirizziDaCercare: vi.fn(async (_idGdo: string, _ancheNonTrovate?: boolean): Promise<IndirizzoDaCercare[]> => [
      { chiave: 'ind:PRA|VIA MURTOLA 12 14', indirizzo: 'Via Murtola 12/14', localita: 'PRA', provincia: 'GE' },
    ]),
    salvaRicercaPosizione: vi.fn(async (_idGdo: string, _chiave: string, _esito: EsitoRicercaPosizione, _idUtente: string | null) => undefined),
    correggiPosizione: vi.fn(async (_idGdo: string, richiesta: unknown, _idUtente: string | null): Promise<PosizioneRiga> => ({
      chiave: String((richiesta as { chiave?: unknown }).chiave), lat: 44.4, lon: 8.79, precisione: 'civico', fonte: 'manuale', errore: null, aggiornataIl: '2026-11-11T10:00:00.000Z',
    })),
  } satisfies IAnalisiPuntoVenditaService;
}

const STATO_RICERCA: StatoRicercaPosizioni = {
  jobId: 'job-1', stato: 'in_corso', totale: 1, esaminate: 0, trovate: 0, approssimate: 0, nonTrovate: 0, errori: 0, avviatoIl: '2026-11-11T10:00:00.000Z',
};

/** Il gestore delle ricerche: esegue subito le operazioni del primo indirizzo, per vedere cosa gli passa il controller. */
function posizioniFinte(opzioni: { giaInCorso?: boolean } = {}) {
  return {
    avvia: vi.fn(async (_idGdo: string, _idUtente: string, indirizzi: readonly IndirizzoDaCercare[], operazioni: OperazioniPosizioni) => {
      if (opzioni.giaInCorso) throw new RicercaPosizioniGiaInCorso(STATO_RICERCA);
      await operazioni.salva(indirizzi[0].chiave, { ricerca: 'x', lat: 1, lon: 2, precisione: 'via', errore: null });
      operazioni.notifica('progress', STATO_RICERCA);
      return { stato: STATO_RICERCA, fine: Promise.resolve(STATO_RICERCA) };
    }),
    stato: vi.fn(async (jobId: string, _idGdo: string) => (jobId === 'job-1' ? STATO_RICERCA : undefined)),
    ultima: vi.fn(async (_idGdo: string) => STATO_RICERCA),
    annulla: vi.fn(async (jobId: string, _idGdo: string) => (jobId === 'job-1' ? { ...STATO_RICERCA, stato: 'annullato' as const } : undefined)),
  };
}

function creaApp(opzioni: { tipo?: TIPO_UTENTI; consultazionePrima?: boolean; ricercaGiaInCorso?: boolean } = {}) {
  const analisi = servizioFinto();
  const consultazione = {
    elenca: vi.fn(async () => []),
    dettaglio: vi.fn(async () => { throw new NotFoundError({ message: 'Punto vendita non trovato', entityType: 'PuntoVendita' }); }),
    volantiniAttivi: vi.fn(async () => []),
  } satisfies IConsultazionePuntiVenditaService;
  const collegamenti = {
    collega: vi.fn(async (_idGdo: string, _richiesta: unknown, _idUtente: string | null) => ({ idCollegamento: 'c1', righe: 40 })),
    collegamenti: vi.fn(async (_idGdo: string, pagina?: number, dimensione?: number) => ({ collegamenti: [], totale: 0, pagina: pagina ?? 1, dimensione: dimensione ?? 10 })),
    scollega: vi.fn(async (_idGdo: string, _idCollegamento: string) => ({ righe: 40 })),
    cambiaCollegamento: vi.fn(async (_idGdo: string, _richiesta: unknown, _idUtente: string | null) => ({ idCollegamento: 'c2', righe: 12 })),
  } satisfies CollegamentiPuntiVenditaVolantino;
  const posizioni = posizioniFinte({ giaInCorso: opzioni.ricercaGiaInCorso });
  const emetti = vi.fn();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { id_utente: 'u1', tipo_utente: opzioni.tipo ?? TIPO_UTENTI.GDO } as Request['session'];
    next();
  });
  const controllerAnalisi = new AnalisiPuntoVenditaController(analisi, collegamenti, posizioni, async () => undefined, emetti);
  const controllerConsultazione = new ConsultazionePuntiVenditaController(consultazione);
  // Come in routes.ts: analisi, consultazione, storia; a richiesta la consultazione prima
  const ordine = opzioni.consultazionePrima ? [controllerConsultazione, controllerAnalisi] : [controllerAnalisi, controllerConsultazione];
  for (const controller of ordine) controller.registerRoutes(app);
  new StoriaPuntoVenditaController({} as IStoriaPuntoVenditaService).registerRoutes(app);
  return { app, analisi, consultazione, collegamenti, posizioni, emetti };
}

beforeEach(() => {
  vi.clearAllMocks();
  permessi.concessi = new Set(['gdo.visualizza']);
  anagrafica.idGdo = 'gdo-sessione';
});

describe('GET /api/punti-vendita/:id/analisi', () => {
  it('con "gdo.visualizza" restituisce l\'analisi del PV cercato nella GDO dell\'utente', async () => {
    const { app, analisi } = creaApp();

    const res = await request(app).get(`/api/punti-vendita/${ID_PV}/analisi`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ idPuntoVendita: ID_PV });
    expect(analisi.analisi).toHaveBeenCalledWith(ID_PV, 'gdo-sessione');
  });

  it('senza "gdo.visualizza" 403', async () => {
    permessi.concessi = new Set(['gdo.gestisci_punti_vendita']);

    const res = await request(creaApp().app).get(`/api/punti-vendita/${ID_PV}/analisi`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ codice: 'gdo.visualizza' });
  });

  it('PV inesistente o di un\'altra GDO: 404', async () => {
    const { app, analisi } = creaApp();
    analisi.analisi.mockRejectedValueOnce(new NotFoundError({ message: 'Punto vendita non trovato', entityType: 'PuntoVendita', entityId: ID_PV }));

    expect((await request(app).get(`/api/punti-vendita/${ID_PV}/analisi`)).status).toBe(404);
  });

  it('Superadmin senza GDO cerca fra tutte; un utente senza GDO che non lavora per piu\' GDO non vede nessun PV', async () => {
    anagrafica.idGdo = null;
    const superadmin = creaApp({ tipo: TIPO_UTENTI.SUPERADMIN });
    expect((await request(superadmin.app).get(`/api/punti-vendita/${ID_PV}/analisi`)).status).toBe(200);
    expect(superadmin.analisi.analisi).toHaveBeenCalledWith(ID_PV, null);

    const marketing = creaApp({ tipo: TIPO_UTENTI.MARKETING });
    expect((await request(marketing.app).get(`/api/punti-vendita/${ID_PV}/analisi`)).status).toBe(404);
    expect(marketing.analisi.analisi).not.toHaveBeenCalled();
  });
});

describe('GET /api/punti-vendita/:id/volantini/:idKit e /:id/referenze/:chiave', () => {
  it('passano PV, kit o chiave e la GDO della sessione, con "gdo.visualizza"', async () => {
    const { app, analisi } = creaApp();

    const volantino = await request(app).get(`/api/punti-vendita/${ID_PV}/volantini/${ID_KIT}`);
    const referenza = await request(app).get(`/api/punti-vendita/${ID_PV}/referenze/c-4969665`);

    expect(volantino.status).toBe(200);
    expect(volantino.body).toEqual({ kit: { id: ID_KIT, titolo: 'SS LI 45' } });
    expect(analisi.volantino).toHaveBeenCalledWith(ID_PV, ID_KIT, 'gdo-sessione');
    expect(referenza.status).toBe(200);
    expect(analisi.referenza).toHaveBeenCalledWith(ID_PV, 'c-4969665', 'gdo-sessione');
  });

  it('un kit che non e\' nella storia del PV: 404', async () => {
    const { app, analisi } = creaApp();
    analisi.volantino.mockRejectedValueOnce(new NotFoundError({ message: 'Volantino non trovato nella storia del punto vendita', entityType: 'RuntimeKit', entityId: ID_KIT }));

    expect((await request(app).get(`/api/punti-vendita/${ID_PV}/volantini/${ID_KIT}`)).status).toBe(404);
  });

  it('senza "gdo.visualizza" 403', async () => {
    permessi.concessi = new Set();
    const { app } = creaApp();

    expect((await request(app).get(`/api/punti-vendita/${ID_PV}/volantini/${ID_KIT}`)).status).toBe(403);
    expect((await request(app).get(`/api/punti-vendita/${ID_PV}/referenze/c-1`)).status).toBe(403);
  });
});

describe('GET /api/punti-vendita/rete/insegne', () => {
  it('"gdo.visualizza", sempre nella GDO della sessione', async () => {
    const { app, analisi } = creaApp({ tipo: TIPO_UTENTI.AGENZIA });

    const res = await request(app).get('/api/punti-vendita/rete/insegne').query({ idGdo: 'altra-gdo' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ anni: [], insegne: [] });
    expect(analisi.reteInsegne).toHaveBeenCalledWith('gdo-sessione');
  });

  it('senza GDO 400', async () => {
    anagrafica.idGdo = null;
    const { app, analisi } = creaApp({ tipo: TIPO_UTENTI.SUPERADMIN });

    expect((await request(app).get('/api/punti-vendita/rete/insegne')).status).toBe(400);
    expect(analisi.reteInsegne).not.toHaveBeenCalled();
  });
});

describe('GET /api/punti-vendita/gestione/...', () => {
  it('qualita\' e righe non abbinate vogliono "gdo.gestisci_punti_vendita": con la sola visualizzazione 403', async () => {
    const { app, analisi } = creaApp();

    const qualita = await request(app).get('/api/punti-vendita/gestione/qualita');
    const righe = await request(app).get('/api/punti-vendita/gestione/righe-non-abbinate');

    expect(qualita.status).toBe(403);
    expect(qualita.body).toEqual({ codice: 'gdo.gestisci_punti_vendita' });
    expect(righe.status).toBe(403);
    expect(analisi.qualita).not.toHaveBeenCalled();
    expect(analisi.righeNonAbbinate).not.toHaveBeenCalled();
  });

  it('con "gdo.gestisci_punti_vendita": qualita\' della GDO e righe con pagina e dimensione', async () => {
    permessi.concessi = new Set(['gdo.gestisci_punti_vendita']);
    const { app, analisi } = creaApp();

    expect((await request(app).get('/api/punti-vendita/gestione/qualita')).body).toMatchObject({ totale: 1, conStoria: 1 });
    expect(analisi.qualita).toHaveBeenCalledWith('gdo-sessione');

    const righe = await request(app).get('/api/punti-vendita/gestione/righe-non-abbinate').query({ pagina: '2', dimensione: '25' });
    expect(righe.body).toEqual({ righe: [], totale: 0, pagina: 2, dimensione: 25 });
    expect(analisi.righeNonAbbinate).toHaveBeenCalledWith('gdo-sessione', 2, 25);

    await request(app).get('/api/punti-vendita/gestione/righe-non-abbinate').query({ pagina: 'abc' });
    expect(analisi.righeNonAbbinate).toHaveBeenLastCalledWith('gdo-sessione', undefined, undefined);
  });
});

describe('collegamenti fatti a mano: /api/punti-vendita/gestione/...', () => {
  const ID_COLLEGAMENTO = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

  it('con la sola visualizzazione: 403 per collegare, elencare e scollegare, niente chiamato', async () => {
    const { app, collegamenti } = creaApp();

    const collega = await request(app).post('/api/punti-vendita/gestione/righe-non-abbinate/collega').send({ chiave: 'tel:0106197180', idPuntoVendita: ID_PV });
    const elenco = await request(app).get('/api/punti-vendita/gestione/collegamenti-manuali');
    const scollega = await request(app).delete(`/api/punti-vendita/gestione/collegamenti-manuali/${ID_COLLEGAMENTO}`);

    expect([collega.status, elenco.status, scollega.status]).toEqual([403, 403, 403]);
    expect(collega.body).toEqual({ codice: 'gdo.gestisci_punti_vendita' });
    expect(collegamenti.collega).not.toHaveBeenCalled();
    expect(collegamenti.collegamenti).not.toHaveBeenCalled();
    expect(collegamenti.scollega).not.toHaveBeenCalled();
  });

  it('con "gdo.gestisci_punti_vendita": collega nella GDO della sessione, a nome dell\'utente', async () => {
    permessi.concessi = new Set(['gdo.gestisci_punti_vendita']);
    const { app, collegamenti } = creaApp({ tipo: TIPO_UTENTI.AGENZIA });
    const corpo = { chiave: 'tel:0106197180', idPuntoVendita: ID_PV };

    const res = await request(app).post('/api/punti-vendita/gestione/righe-non-abbinate/collega').query({ idGdo: 'altra-gdo' }).send(corpo);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ idCollegamento: 'c1', righe: 40 });
    expect(collegamenti.collega).toHaveBeenCalledWith('gdo-sessione', corpo, 'u1');
  });

  it('richiesta non valida 400, PV di un\'altra GDO 404, riga gia\' abbinata 409', async () => {
    permessi.concessi = new Set(['gdo.gestisci_punti_vendita']);
    const { app, collegamenti } = creaApp();
    collegamenti.collega
      .mockRejectedValueOnce(new BadRequestError({ message: 'Riga da collegare non indicata (chiave)' }))
      .mockRejectedValueOnce(new NotFoundError({ message: 'Punto vendita non trovato', entityType: 'PuntoVendita', entityId: ID_PV }))
      .mockRejectedValueOnce(new ApplicationError({ name: 'RigaGiaAbbinataError', code: 'RIGA_VOLANTINO_GIA_ABBINATA', message: 'gia\' abbinata', httpStatus: 409 }));
    const invia = () => request(app).post('/api/punti-vendita/gestione/righe-non-abbinate/collega').send({ chiave: 'x', idPuntoVendita: ID_PV });

    expect((await invia()).status).toBe(400);
    expect((await invia()).status).toBe(404);
    expect((await invia()).status).toBe(409);
  });

  it('volantini di una riga: con la sola visualizzazione 403; con la gestione, la chiave nella GDO della sessione', async () => {
    const vietato = creaApp();
    expect((await request(vietato.app).get('/api/punti-vendita/gestione/righe-non-abbinate/volantini').query({ chiave: 'tel:0106197180' })).status).toBe(403);
    expect(vietato.analisi.volantiniRigaNonAbbinata).not.toHaveBeenCalled();

    permessi.concessi = new Set(['gdo.gestisci_punti_vendita']);
    const { app, analisi, consultazione } = creaApp();
    const res = await request(app).get('/api/punti-vendita/gestione/righe-non-abbinate/volantini').query({ chiave: 'tel:0106197180', idGdo: 'altra-gdo' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ chiave: 'tel:0106197180', volantini: [] });
    expect(analisi.volantiniRigaNonAbbinata).toHaveBeenCalledWith('gdo-sessione', 'tel:0106197180');
    // Non finisce nel "/:id" della consultazione
    expect(consultazione.dettaglio).not.toHaveBeenCalled();

    analisi.volantiniRigaNonAbbinata.mockRejectedValueOnce(new NotFoundError({ message: "La riga non e' piu' fra quelle non abbinate", entityType: 'RigaNonAbbinata' }));
    expect((await request(app).get('/api/punti-vendita/gestione/righe-non-abbinate/volantini').query({ chiave: 'x' })).status).toBe(404);
  });

  it('elenco con pagina e dimensione, scollegamento per id, sempre nella GDO della sessione', async () => {
    permessi.concessi = new Set(['gdo.gestisci_punti_vendita']);
    const { app, collegamenti } = creaApp();

    const elenco = await request(app).get('/api/punti-vendita/gestione/collegamenti-manuali').query({ pagina: '2', dimensione: '25' });
    expect(elenco.body).toEqual({ collegamenti: [], totale: 0, pagina: 2, dimensione: 25 });
    expect(collegamenti.collegamenti).toHaveBeenCalledWith('gdo-sessione', 2, 25);

    const scollega = await request(app).delete(`/api/punti-vendita/gestione/collegamenti-manuali/${ID_COLLEGAMENTO}`);
    expect(scollega.body).toEqual({ righe: 40 });
    expect(collegamenti.scollega).toHaveBeenCalledWith('gdo-sessione', ID_COLLEGAMENTO);

    collegamenti.scollega.mockRejectedValueOnce(new NotFoundError({ message: 'Collegamento non trovato', entityType: 'CollegamentoPuntoVendita' }));
    expect((await request(app).delete(`/api/punti-vendita/gestione/collegamenti-manuali/${ID_COLLEGAMENTO}`)).status).toBe(404);
  });
});

describe('ordine delle route sul percorso base /api/punti-vendita', () => {
  it.each([false, true])('"/rete/..." e "/gestione/..." non finiscono nel "/:id" della consultazione (consultazione prima: %s)', async (consultazionePrima) => {
    permessi.concessi = new Set(['gdo.visualizza', 'gdo.gestisci_punti_vendita']);
    const { app, analisi, consultazione } = creaApp({ consultazionePrima });

    expect((await request(app).get('/api/punti-vendita/rete/insegne')).status).toBe(200);
    expect((await request(app).get('/api/punti-vendita/gestione/qualita')).status).toBe(200);
    expect((await request(app).get('/api/punti-vendita/gestione/righe-non-abbinate')).status).toBe(200);
    expect(analisi.reteInsegne).toHaveBeenCalledTimes(1);
    expect(analisi.qualita).toHaveBeenCalledTimes(1);
    expect(analisi.righeNonAbbinate).toHaveBeenCalledTimes(1);
    expect(consultazione.dettaglio).not.toHaveBeenCalled();
  });

  it('la consultazione resta raggiungibile: "/:id" e "/:id/volantini-attivi" non finiscono nell\'analisi', async () => {
    const { app, analisi, consultazione } = creaApp();

    expect((await request(app).get(`/api/punti-vendita/${ID_PV}`)).status).toBe(404);
    expect((await request(app).get(`/api/punti-vendita/${ID_PV}/volantini-attivi`)).status).toBe(200);
    expect(consultazione.dettaglio).toHaveBeenCalledWith('gdo-sessione', ID_PV);
    expect(consultazione.volantiniAttivi).toHaveBeenCalledWith('gdo-sessione', ID_PV);
    expect(analisi.volantino).not.toHaveBeenCalled();
  });
});

describe('verifica dei collegamenti e posizioni delle righe: /api/punti-vendita/gestione/...', () => {
  it('con la sola visualizzazione: 403 per verifica, cambio, ricerca e correzione, niente chiamato', async () => {
    const { app, analisi, collegamenti, posizioni } = creaApp();

    const risposte = await Promise.all([
      request(app).get('/api/punti-vendita/gestione/verifica-collegamenti'),
      request(app).put('/api/punti-vendita/gestione/collegamenti/cambia').send({ chiave: 'tel:1', idPuntoVenditaAttuale: ID_PV, idPuntoVendita: ID_PV }),
      request(app).post('/api/punti-vendita/gestione/posizioni-righe').send({}),
      request(app).get('/api/punti-vendita/gestione/posizioni-righe/stato'),
      request(app).post('/api/punti-vendita/gestione/posizioni-righe/job-1/annulla'),
      request(app).put('/api/punti-vendita/gestione/posizioni-righe').send({ chiave: 'loc:PRA', lat: 44, lon: 8 }),
    ]);

    expect(risposte.map(risposta => risposta.status)).toEqual([403, 403, 403, 403, 403, 403]);
    expect(analisi.verificaCollegamenti).not.toHaveBeenCalled();
    expect(collegamenti.cambiaCollegamento).not.toHaveBeenCalled();
    expect(posizioni.avvia).not.toHaveBeenCalled();
    expect(analisi.correggiPosizione).not.toHaveBeenCalled();
  });

  it('verifica: nella GDO della sessione, con esito, tipo e pagina', async () => {
    permessi.concessi = new Set(['gdo.gestisci_punti_vendita']);
    const { app, analisi } = creaApp();

    const res = await request(app).get('/api/punti-vendita/gestione/verifica-collegamenti').query({ esito: 'incongruente', tipo: 'manuale', pagina: '2', dimensione: '25' });

    expect(res.status).toBe(200);
    expect(analisi.verificaCollegamenti).toHaveBeenCalledWith('gdo-sessione', { esito: 'incongruente', tipo: 'manuale', pagina: 2, dimensione: 25 });
  });

  it('cambio del collegamento: nella GDO della sessione, a nome dell\'utente', async () => {
    permessi.concessi = new Set(['gdo.gestisci_punti_vendita']);
    const { app, collegamenti } = creaApp();
    const corpo = { chiave: 'tel:0106197180', idPuntoVenditaAttuale: ID_PV, idPuntoVendita: ID_KIT };

    const res = await request(app).put('/api/punti-vendita/gestione/collegamenti/cambia').send(corpo);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ idCollegamento: 'c2', righe: 12 });
    expect(collegamenti.cambiaCollegamento).toHaveBeenCalledWith('gdo-sessione', corpo, 'u1');
  });

  it('cambio verso un PV di un\'altra combinazione: l\'errore 422 del servizio arriva al client', async () => {
    permessi.concessi = new Set(['gdo.gestisci_punti_vendita']);
    const { app, collegamenti } = creaApp();
    collegamenti.cambiaCollegamento.mockRejectedValueOnce(new ApplicationError({
      name: 'CombinazioneDiversaError', code: 'COMBINAZIONE_DIVERSA', message: 'Il punto vendita è di Conad City · Liguria', httpStatus: 422,
    }));

    const res = await request(app).put('/api/punti-vendita/gestione/collegamenti/cambia').send({ chiave: 'tel:1', idPuntoVenditaAttuale: ID_PV, idPuntoVendita: ID_KIT });

    expect(res.status).toBe(422);
  });

  it('ricerca delle posizioni: 202 subito, salva nella GDO della sessione e manda l\'avanzamento all\'utente che l\'ha avviata', async () => {
    permessi.concessi = new Set(['gdo.gestisci_punti_vendita']);
    const { app, analisi, posizioni, emetti } = creaApp();

    const res = await request(app).post('/api/punti-vendita/gestione/posizioni-righe').send({ nonTrovate: true });

    expect(res.status).toBe(202);
    expect(res.body).toEqual(STATO_RICERCA);
    expect(analisi.indirizziDaCercare).toHaveBeenCalledWith('gdo-sessione', true);
    expect(posizioni.avvia).toHaveBeenCalledWith('gdo-sessione', 'u1', expect.any(Array), expect.any(Object));
    expect(analisi.salvaRicercaPosizione).toHaveBeenCalledWith('gdo-sessione', 'ind:PRA|VIA MURTOLA 12 14', expect.objectContaining({ precisione: 'via' }), 'u1');
    expect(emetti).toHaveBeenCalledWith('posizioniRighe_job-1_progress', STATO_RICERCA, 'user:u1');
  });

  it('ricerca gia\' in corso sulla GDO: 409 con lo stato di quella in corso', async () => {
    permessi.concessi = new Set(['gdo.gestisci_punti_vendita']);
    const { app } = creaApp({ ricercaGiaInCorso: true });

    const res = await request(app).post('/api/punti-vendita/gestione/posizioni-righe').send({});

    expect(res.status).toBe(409);
    expect(res.body.stato).toEqual(STATO_RICERCA);
  });

  it('stato e annullamento della ricerca, nella GDO della sessione; ricerca sconosciuta: 404', async () => {
    permessi.concessi = new Set(['gdo.gestisci_punti_vendita']);
    const { app, posizioni } = creaApp();

    const ultima = await request(app).get('/api/punti-vendita/gestione/posizioni-righe/stato');
    const perId = await request(app).get('/api/punti-vendita/gestione/posizioni-righe/stato').query({ jobId: 'job-1' });
    const annullata = await request(app).post('/api/punti-vendita/gestione/posizioni-righe/job-1/annulla');
    const sconosciuta = await request(app).post('/api/punti-vendita/gestione/posizioni-righe/job-9/annulla');

    expect([ultima.status, perId.status, annullata.status, sconosciuta.status]).toEqual([200, 200, 200, 404]);
    expect(ultima.body).toEqual({ stato: STATO_RICERCA });
    expect(annullata.body.stato.stato).toBe('annullato');
    expect(posizioni.ultima).toHaveBeenCalledWith('gdo-sessione');
    expect(posizioni.stato).toHaveBeenCalledWith('job-1', 'gdo-sessione');
    expect(posizioni.annulla).toHaveBeenCalledWith('job-1', 'gdo-sessione');
  });

  it('correzione della posizione: nella GDO della sessione, a nome dell\'utente', async () => {
    permessi.concessi = new Set(['gdo.gestisci_punti_vendita']);
    const { app, analisi } = creaApp();
    const corpo = { chiave: 'ind:PRA|VIA MURTOLA 12 14', lat: 44.428, lon: 8.79 };

    const res = await request(app).put('/api/punti-vendita/gestione/posizioni-righe').send(corpo);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ chiave: corpo.chiave, fonte: 'manuale' });
    expect(analisi.correggiPosizione).toHaveBeenCalledWith('gdo-sessione', corpo, 'u1');
  });
});
