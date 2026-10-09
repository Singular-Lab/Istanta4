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

  const avvia = () => service.processFTPPopOlimpo({
    req: { session: { id_utente: 'u1' } } as any,
    idOrdineDiStampa: 'o1',
    kitIds: Object.fromEntries(opzioni.selezionati.map(k => [k.id, true])),
    socketId: 's1',
    statoPrecedente: STATO_ORDINI_STAMPA.IN_REVISIONE,
  });
  return { avvia, olimpo, aggiornaStato, creaInvio, creaAttivita };
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

    const statoPrecedente = await new OrdiniStampaService({} as any, {} as any).prenotaInvio('o1');

    expect(statoPrecedente).toBe(STATO_ORDINI_STAMPA.IN_REVISIONE);
    expect(bloccato.update).toHaveBeenCalledWith(
      expect.objectContaining({ stato_ordinistampa: STATO_ORDINI_STAMPA.IN_INVIO, updatedat: expect.any(Date) }),
      expect.anything()
    );
  });

  it('porta in IN_INVIO un ordine in revisione e restituisce lo stato precedente', async () => {
    const inRevisione = ordine(STATO_ORDINI_STAMPA.IN_REVISIONE, 0);
    vi.spyOn(OrdiniDiStampa, 'findByPk').mockResolvedValue(inRevisione as any);

    await expect(new OrdiniStampaService({} as any, {} as any).prenotaInvio('o1')).resolves.toBe(STATO_ORDINI_STAMPA.IN_REVISIONE);
    expect(inRevisione.update).toHaveBeenCalledWith(expect.objectContaining({ stato_ordinistampa: STATO_ORDINI_STAMPA.IN_INVIO }), expect.anything());
  });
});
