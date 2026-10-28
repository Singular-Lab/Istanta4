import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATO_LAVORAZIONE_KIT_RUNTIME, STATO_ORDINI_STAMPA } from '../../../../lib/enums';
import { BusinessError } from '../../../../lib/errors';

const socket = vi.hoisted(() => ({ emitToClients: vi.fn() }));

vi.mock('../../../ws-server', () => ({ emitToClients: socket.emitToClients }));

import { sequelize } from '../../db/SequelizeConnector';
import { Area } from '../../models/aree';
import { Canale } from '../../models/canali';
import { ContrattoTipografia } from '../../models/contratto_tipografia';
import { FilesRuntime } from '../../models/files_runtime';
import { GDO } from '../../models/gdo';
import { OrdiniDiStampa } from '../../models/ordini_di_stampa';
import { OrdiniDiStampaInvii } from '../../models/ordini_di_stampa_invii';
import { Promo } from '../../models/promo';
import { RuntimeKit } from '../../models/runtime_kit';
import { ServerUtils } from '../../utils/ServerUtils';
import { RegistroLavoriInMemoria } from '../../../__tests__/registroLavoriInMemoria';
import { OrdiniStampaService } from '../OrdiniStampaService';

// I kit della promo arrivano da getAllKitRuntimeByIdPromo: guidId e' runtime_kit.id.
// Il contratto prevede solo il tipo di export 't1'.
const kit = (id: string, stato = STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO, tipi = ['t1']) => ({
  id,
  guidId: id,
  titolo: `Kit ${id}`,
  stato_lavorazione: stato,
  id_area: 'a1',
  id_canale: 'c1',
  tipi_di_export_in_kit: tipi.map(tipo_di_export_guid_id => ({ tipo_di_export_guid_id })),
});

function preparaInvio(opzioni: {
  selezionati: ReturnType<typeof kit>[];
  kitPromo: ReturnType<typeof kit>[];
  inviiPrecedenti?: string[][];
  esitoOlimpo?: Record<string, boolean>;
}) {
  const contratto = { json_contrattotipografia: { root_file_tree: [] }, tipiexport_contrattotipografia: ['t1'] };
  vi.spyOn(OrdiniDiStampa, 'findByPk').mockResolvedValue({ dataValues: { id_ordinistampa: 'o1', id_promo_ordinistampa: 'p1' } } as any);
  vi.spyOn(GDO, 'findAll').mockResolvedValue([{ id_gdo: 'g1' }] as any);
  vi.spyOn(ContrattoTipografia, 'findAll').mockResolvedValue([{ ...contratto, dataValues: contratto }] as any);
  vi.spyOn(RuntimeKit, 'findAll').mockResolvedValue(opzioni.selezionati.map(k => ({ ...k })) as any);
  vi.spyOn(FilesRuntime, 'findAll').mockResolvedValue([] as any);
  vi.spyOn(OrdiniDiStampaInvii, 'findAll').mockResolvedValue(
    (opzioni.inviiPrecedenti ?? []).map(kit_guids => ({ report_ordinistampainvii: { kit_guids } })) as any
  );
  vi.spyOn(Area, 'findAll').mockResolvedValue([{ id_aree: 'a1', codice_aree: 'A1' }] as any);
  vi.spyOn(Canale, 'findAll').mockResolvedValue([{ id_canali: 'c1', codice_canali: 'C1' }] as any);
  vi.spyOn(Promo, 'findOne').mockResolvedValue({ id_promo: 'p1', nome_promo: 'Promo' } as any);
  const olimpo = vi.spyOn(ServerUtils, 'sendToFICOApi').mockImplementation((async (_req: any, _url: any, _metodo: any, body: any) =>
    ({ data: { esito: opzioni.esitoOlimpo?.[body.kit.id] ?? true }, status: 200 })) as any);
  const aggiornaStato = vi.spyOn(OrdiniDiStampa, 'update').mockResolvedValue([1] as any);
  const creaInvio = vi.spyOn(OrdiniDiStampaInvii, 'create').mockResolvedValue({} as any);
  const creaAttivita = vi.spyOn(ServerUtils, 'CREA_ATTIVITA').mockResolvedValue(undefined as any);
  const kitRuntimeService = { getAllKitRuntimeByIdPromo: vi.fn().mockResolvedValue(opzioni.kitPromo) };
  const service = new OrdiniStampaService({} as any, kitRuntimeService as any);
  // Il blocco scritto da prenotaInvio
  const bloccoInvio = new Date(Date.now() - 1000);

  const avvia = () => service.processFTPPopOlimpo({
    req: { session: { id_utente: 'u1' } } as any,
    idOrdineDiStampa: 'o1',
    kitIds: Object.fromEntries(opzioni.selezionati.map(k => [k.id, true])),
    socketId: 's1',
    statoPrecedente: STATO_ORDINI_STAMPA.IN_REVISIONE,
    bloccoInvio,
  });
  return { avvia, olimpo, aggiornaStato, creaInvio, creaAttivita, bloccoInvio };
}

const eventoFinale = () => socket.emitToClients.mock.calls.find(([evento]) => evento === 's1_complete')?.[1];
const statoFinale = (aggiornaStato: any) => aggiornaStato.mock.calls.at(-1)?.[0].stato_ordinistampa;

beforeEach(() => {
  socket.emitToClients.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OrdiniStampaService.processFTPPopOlimpo', () => {
  it('un kit rifiutato da Olimpo non entra in kit_guids e l\'esito finale e\' negativo', async () => {
    const { avvia, aggiornaStato, creaInvio } = preparaInvio({
      selezionati: [kit('k1'), kit('k2')],
      kitPromo: [kit('k1'), kit('k2')],
      esitoOlimpo: { k2: false },
    });

    await avvia();

    const report = creaInvio.mock.calls[0][0].report_ordinistampainvii;
    expect(report.kit_guids).toEqual(['k1']);
    expect(report.kit_falliti).toEqual(['k2']);
    expect(report.total_kit).toBe(1);
    expect(eventoFinale()).toMatchObject({ esito: false, totalKit: 1 });
    expect(eventoFinale().message).toContain('Kit k2');
    // k2 resta da inviare: l'ordine torna allo stato precedente, non resta IN_INVIO
    expect(statoFinale(aggiornaStato)).toBe(STATO_ORDINI_STAMPA.IN_REVISIONE);
  });

  it('se nessun kit e\' stato inviato non registra l\'invio e lo comunica', async () => {
    const { avvia, aggiornaStato, creaInvio, creaAttivita } = preparaInvio({
      selezionati: [kit('k1')],
      kitPromo: [kit('k1')],
      esitoOlimpo: { k1: false },
    });

    await avvia();

    expect(creaInvio).not.toHaveBeenCalled();
    expect(creaAttivita).not.toHaveBeenCalled();
    expect(eventoFinale()).toMatchObject({ esito: false, totalKit: 0 });
    expect(eventoFinale().message).toContain('Nessun kit inviato');
    expect(statoFinale(aggiornaStato)).toBe(STATO_ORDINI_STAMPA.IN_REVISIONE);
  });

  it('l\'ordine e\' FINITO se i kit mancanti erano in un invio precedente; un kit non PUBBLICATO non lo impedisce', async () => {
    const { avvia, olimpo, aggiornaStato, creaInvio } = preparaInvio({
      selezionati: [kit('k1'), kit('k2')],
      kitPromo: [kit('k1'), kit('k2'), kit('k3', STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE)],
      inviiPrecedenti: [['k1']],
    });

    await avvia();

    // k1 e' gia' nel report dello stesso ordine: non viene rielaborato
    expect(olimpo).toHaveBeenCalledTimes(1);
    expect(creaInvio.mock.calls[0][0].report_ordinistampainvii.kit_guids).toEqual(['k2']);
    expect(eventoFinale()).toMatchObject({ esito: true, totalKit: 1 });
    expect(statoFinale(aggiornaStato)).toBe(STATO_ORDINI_STAMPA.FINITO);
  });

  it('un kit con un tipo nel contratto e uno no e\' da inviare: finche\' manca l\'ordine non e\' FINITO', async () => {
    const { avvia, aggiornaStato, creaInvio } = preparaInvio({
      selezionati: [kit('k1', undefined, ['t1', 't2'])],
      kitPromo: [kit('k1', undefined, ['t1', 't2']), kit('k2', undefined, ['t2', 't1'])],
    });

    await avvia();

    expect(creaInvio.mock.calls[0][0].report_ordinistampainvii.kit_guids).toEqual(['k1']);
    expect(statoFinale(aggiornaStato)).toBe(STATO_ORDINI_STAMPA.IN_REVISIONE);
  });

  it('inviati i kit con almeno un tipo nel contratto l\'ordine e\' FINITO; un kit senza tipi nel contratto non conta', async () => {
    const { avvia, aggiornaStato } = preparaInvio({
      selezionati: [kit('k1', undefined, ['t1', 't2'])],
      kitPromo: [kit('k1', undefined, ['t1', 't2']), kit('k2', undefined, ['t2'])],
    });

    await avvia();

    expect(statoFinale(aggiornaStato)).toBe(STATO_ORDINI_STAMPA.FINITO);
  });
});

describe('OrdiniStampaService.prenotaInvio', () => {
  const ordine = (stato: STATO_ORDINI_STAMPA, minutiFa: number) => ({
    stato_ordinistampa: stato,
    updatedat: new Date(Date.now() - minutiFa * 60_000),
    update: vi.fn(),
  });

  beforeEach(() => {
    vi.spyOn(sequelize, 'transaction').mockImplementation(((callback: any) => callback({ LOCK: { UPDATE: 'UPDATE' } })) as any);
  });

  it('rifiuta un ordine gia\' IN_INVIO da meno di 30 minuti', async () => {
    const inInvio = ordine(STATO_ORDINI_STAMPA.IN_INVIO, 5);
    vi.spyOn(OrdiniDiStampa, 'findByPk').mockResolvedValue(inInvio as any);

    await expect(new OrdiniStampaService({} as any, {} as any).prenotaInvio('o1')).rejects.toBeInstanceOf(BusinessError);
    expect(inInvio.update).not.toHaveBeenCalled();
  });

  it('accetta un IN_INVIO piu\' vecchio di 30 minuti e a fine invio ripristina IN_REVISIONE', async () => {
    const bloccato = ordine(STATO_ORDINI_STAMPA.IN_INVIO, 31);
    vi.spyOn(OrdiniDiStampa, 'findByPk').mockResolvedValue(bloccato as any);

    const { statoPrecedente } = await new OrdiniStampaService({} as any, {} as any).prenotaInvio('o1');

    expect(statoPrecedente).toBe(STATO_ORDINI_STAMPA.IN_REVISIONE);
    expect(bloccato.update).toHaveBeenCalledWith(
      expect.objectContaining({ stato_ordinistampa: STATO_ORDINI_STAMPA.IN_INVIO, updatedat: expect.any(Date) }),
      expect.anything()
    );
  });

  it('porta in IN_INVIO un ordine in revisione e restituisce lo stato precedente', async () => {
    const inRevisione = ordine(STATO_ORDINI_STAMPA.IN_REVISIONE, 0);
    vi.spyOn(OrdiniDiStampa, 'findByPk').mockResolvedValue(inRevisione as any);

    const prenotazione = await new OrdiniStampaService({} as any, {} as any).prenotaInvio('o1');

    expect(prenotazione).toEqual({ statoPrecedente: STATO_ORDINI_STAMPA.IN_REVISIONE, bloccoInvio: expect.any(Date) });
    // Il blocco restituito e l'updatedat scritto: l'invio lo usa per rinnovarlo e rilasciarlo
    expect(inRevisione.update).toHaveBeenCalledWith(
      expect.objectContaining({ stato_ordinistampa: STATO_ORDINI_STAMPA.IN_INVIO, updatedat: prenotazione.bloccoInvio }),
      expect.anything()
    );
  });
});

// Spec ordini-stampa-distribuzione "Un solo invio alla volta per ordine": il blocco IN_INVIO e di un invio solo
describe('OrdiniStampaService.processFTPPopOlimpo: blocco dell\'invio', () => {
  it('rinnova il blocco prima di ogni kit, cosi un invio lungo non sembra interrotto, e a fine invio rilascia solo il proprio', async () => {
    const { avvia, aggiornaStato, bloccoInvio } = preparaInvio({ selezionati: [kit('k1'), kit('k2')], kitPromo: [kit('k1'), kit('k2')] });

    await avvia();

    const [primo, secondo, rilascio] = aggiornaStato.mock.calls as any[];
    expect(aggiornaStato).toHaveBeenCalledTimes(3);
    expect(primo[0]).toEqual({ updatedat: expect.any(Date) });
    expect(primo[1].where).toEqual({ id_ordinistampa: 'o1', stato_ordinistampa: STATO_ORDINI_STAMPA.IN_INVIO, updatedat: bloccoInvio });
    // Ogni rinnovo parte dal blocco scritto dal precedente
    expect(secondo[1].where.updatedat).toBe(primo[0].updatedat);
    expect(rilascio[0]).toEqual({ stato_ordinistampa: STATO_ORDINI_STAMPA.FINITO });
    expect(rilascio[1].where).toEqual({ id_ordinistampa: 'o1', stato_ordinistampa: STATO_ORDINI_STAMPA.IN_INVIO, updatedat: secondo[0].updatedat });
  });

  it('se un invio piu recente ha preso l\'ordine si ferma: niente altri kit via FTP e lo stato del nuovo invio non si tocca', async () => {
    const { avvia, aggiornaStato, olimpo, creaInvio } = preparaInvio({ selezionati: [kit('k1'), kit('k2')], kitPromo: [kit('k1'), kit('k2')] });
    // Il rinnovo prima di k1 riesce; prima di k2 il blocco non e piu di questo invio
    aggiornaStato.mockResolvedValueOnce([1] as any).mockResolvedValueOnce([0] as any);

    await avvia();

    expect(olimpo).toHaveBeenCalledTimes(1);
    // k1 e partito davvero: resta nel report, cosi non si rimanda
    expect(creaInvio.mock.calls[0][0].report_ordinistampainvii.kit_guids).toEqual(['k1']);
    expect(aggiornaStato.mock.calls.some(([valori]: any) => 'stato_ordinistampa' in valori)).toBe(false);
    expect(eventoFinale()).toMatchObject({ esito: false, totalKit: 1 });
    expect(eventoFinale().message).toContain('Invio interrotto');
  });

  it('se il blocco e gia di un altro invio prima del primo kit non invia nulla e non sblocca l\'ordine', async () => {
    const { avvia, aggiornaStato, olimpo, creaInvio } = preparaInvio({ selezionati: [kit('k1')], kitPromo: [kit('k1')] });
    aggiornaStato.mockResolvedValueOnce([0] as any);

    await avvia();

    expect(olimpo).not.toHaveBeenCalled();
    expect(creaInvio).not.toHaveBeenCalled();
    expect(aggiornaStato).toHaveBeenCalledTimes(1);
  });
});

// Il raggruppamento gira in un worker; stato e "gia in corso" li vedono tutti tramite il registro dei lavori
describe('OrdiniStampaService: raggruppamento dei file con piu worker', () => {
  const req = { session: { id_utente: 'u1' } } as any;

  function preparaRaggruppamento() {
    const registro = new RegistroLavoriInMemoria();
    let rispondiOlimpo: (risposta: unknown) => void = () => undefined;
    vi.spyOn(OrdiniDiStampa, 'findByPk').mockResolvedValue({ dataValues: { id_ordinistampa: 'o1', id_promo_ordinistampa: 'p1' } } as any);
    vi.spyOn(ContrattoTipografia, 'findAll').mockResolvedValue([{ id_contrattotipografia: 'c1', tipiexport_contrattotipografia: ['t1'], json_contrattotipografia: {} }] as any);
    vi.spyOn(OrdiniDiStampaInvii, 'findAll').mockResolvedValue([] as any);
    vi.spyOn(FilesRuntime, 'findAll').mockResolvedValue([
      { id_olimpo_cloud: 'f1', nome: 'a.pdf', id_runtime: 'k1' },
      { id_olimpo_cloud: 'f2', nome: 'b.pdf', id_runtime: 'k1' },
    ] as any);
    const olimpo = vi.spyOn(ServerUtils, 'sendToFICOApi').mockImplementation((() => new Promise(resolve => { rispondiOlimpo = resolve; })) as any);
    const kitRuntimeService = { getAllKitRuntimeByIdPromo: vi.fn().mockResolvedValue([kit('k1')]) };
    return {
      registro,
      olimpo,
      rispondi: (risposta: unknown) => rispondiOlimpo(risposta),
      workerA: new OrdiniStampaService({} as any, kitRuntimeService as any, registro),
      workerB: new OrdiniStampaService({} as any, kitRuntimeService as any, registro),
    };
  }

  it('lo stato e il "gia in corso" sono gli stessi da un\'altra istanza del servizio', async () => {
    const { workerA, workerB, olimpo, rispondi } = preparaRaggruppamento();

    const avvio = await workerA.groupFilesByEquality({ req, idOrdineDiStampa: 'o1', socketId: 's1' });
    await vi.waitFor(() => expect(olimpo).toHaveBeenCalled());

    expect(avvio).toMatchObject({ socketId: 's1', giaInCorso: false });
    expect(await workerB.getGroupingStatus('o1')).toMatchObject({ status: 'running', socketId: 's1' });
    // Un secondo avvio su un altro worker non ne lancia un altro: si aggancia a quello in corso
    expect(await workerB.groupFilesByEquality({ req, idOrdineDiStampa: 'o1', socketId: 's2' })).toMatchObject({ socketId: 's1', giaInCorso: true });

    rispondi({ data: { esito: true, groups: [{ groupId: 'gr1', ids: ['f1', 'f2'] }], unmatchedIds: [] }, status: 200 });
    await avvio.fine;

    expect(olimpo).toHaveBeenCalledTimes(1);
    expect(await workerB.getGroupingStatus('o1')).toMatchObject({
      status: 'completed', socketId: 's1', result: { groupCount: 1, groups: [{ groupId: 'gr1', size: 2 }] },
    });
    expect(socket.emitToClients).toHaveBeenCalledWith('s1_result', expect.objectContaining({ groupCount: 1 }), 'user:u1');
  });

  it('un errore di Olimpo risulta fallito anche dall\'altra istanza, e il raggruppamento si puo rifare', async () => {
    const { workerA, workerB, rispondi, olimpo } = preparaRaggruppamento();
    const avvio = await workerA.groupFilesByEquality({ req, idOrdineDiStampa: 'o1', socketId: 's1' });
    await vi.waitFor(() => expect(olimpo).toHaveBeenCalled());

    rispondi({ data: { esito: false, error: 'PDF illeggibile' }, status: 200 });
    await avvio.fine;

    expect(await workerB.getGroupingStatus('o1')).toMatchObject({ status: 'failed', error: 'PDF illeggibile' });
    expect(await workerB.groupFilesByEquality({ req, idOrdineDiStampa: 'o1', socketId: 's2' })).toMatchObject({ socketId: 's2', giaInCorso: false });
  });

  it('un raggruppamento il cui worker si e fermato risulta fallito e non impedisce di rifarlo', async () => {
    const { registro, workerA, workerB, olimpo } = preparaRaggruppamento();
    await workerA.groupFilesByEquality({ req, idOrdineDiStampa: 'o1', socketId: 's1' });
    await vi.waitFor(() => expect(olimpo).toHaveBeenCalled());
    const [lavoro] = [...registro.righe.values()];
    registro.invecchiaBattito(lavoro.id);

    expect(await workerB.getGroupingStatus('o1')).toMatchObject({ status: 'failed', socketId: 's1' });
    expect(await workerB.groupFilesByEquality({ req, idOrdineDiStampa: 'o1', socketId: 's2' })).toMatchObject({ socketId: 's2', giaInCorso: false });
  });

  it('senza raggruppamenti per l\'ordine lo stato e assente', async () => {
    const { workerB } = preparaRaggruppamento();

    expect(await workerB.getGroupingStatus('o1')).toBeNull();
  });
});
