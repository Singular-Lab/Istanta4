import type { Request } from 'express';
import { beforeEach, expect, it, vi } from 'vitest';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaFile, creaGdo, creaKitRuntime, creaLogFile, creaTipoExport } from '../../../__tests__/integrazione/dati';
import { AvanzamentoProduzioneRepository } from '../../repositories/AvanzamentoProduzioneRepository';
import { AvanzamentoProduzioneService, DURATA_CACHE_NON_AVVIATI_MS } from '../AvanzamentoProduzioneService';
import type { FonteKitNonAvviati } from '../MaterialiService';

const GIORNO_MS = 24 * 60 * 60 * 1000;

/** Una voce di getAllKitPerGestioneLavorazione per un kit previsto e non avviato. */
const daAvviare = (guidId: string, titolo: string, kit: { idArea: string; idCanale: string; idFormato: string }) => ({
  isDesignKit: true,
  lavorazioneStarted: false,
  guidId,
  titolo,
  tipo: 'AUTOMATICO',
  guidArea: kit.idArea,
  nomeArea: 'Toscana',
  guidCanale: kit.idCanale,
  nomeCanale: 'Superstore',
  guidFormato: kit.idFormato,
});

// La pagina Avanzamento produzione su PostgreSQL: promo in corso della GDO per scadenza della
// lavorazione, kit volantino e POP con i file per stato, kit non avviati da Istanta.
describeConDatabase('AvanzamentoProduzioneService: promo in corso e kit della GDO', () => {
  usaDatabase();
  const req = {} as Request;
  const istanta = {
    getAllKitPerGestioneLavorazione: vi.fn<FonteKitNonAvviati['getAllKitPerGestioneLavorazione']>(),
  };
  let adesso: number;
  const servizio = () => new AvanzamentoProduzioneService(new AvanzamentoProduzioneRepository(), istanta, { ora: () => adesso });

  beforeEach(async () => {
    await svuotaTabelle('gdo', 'promo', 'formati', 'tipi_export');
    istanta.getAllKitPerGestioneLavorazione.mockReset();
    istanta.getAllKitPerGestioneLavorazione.mockResolvedValue({ lavorazioni: [], volantini: [] });
    adesso = Date.now();
  });

  it('solo le promo in corso della GDO, dalla scadenza della lavorazione più vicina, con i giorni che mancano', async () => {
    const idGdo = await creaGdo();
    await creaKitRuntime({ idGdo, nomePromo: 'Fra nove giorni', statoPromo: 'IN_LAVORAZIONE', dataScadenza: new Date(adesso + 9 * GIORNO_MS) });
    await creaKitRuntime({ idGdo, nomePromo: 'Senza scadenza', statoPromo: 'PIANIFICATA' });
    await creaKitRuntime({ idGdo, nomePromo: 'In ritardo', statoPromo: 'IN_RITARDO', dataScadenza: new Date(adesso - 2 * GIORNO_MS) });
    await creaKitRuntime({ idGdo, nomePromo: 'Già valida', statoPromo: 'VALIDA', dataScadenza: new Date(adesso - 5 * GIORNO_MS) });
    await creaKitRuntime({ nomePromo: 'Di un\'altra GDO', statoPromo: 'IN_LAVORAZIONE', dataScadenza: new Date(adesso) });

    const { promozioni } = await servizio().getAvanzamento(idGdo, req);

    expect(promozioni.map(p => [p.nome, p.stato, p.giorniAllaScadenza])).toEqual([
      ['In ritardo', 'IN_RITARDO', -2],
      ['Fra nove giorni', 'IN_LAVORAZIONE', 9],
      ['Senza scadenza', 'PIANIFICATA', null],
    ]);
    expect(promozioni[0].scadenzaLavorazione).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(istanta.getAllKitPerGestioneLavorazione).toHaveBeenCalledTimes(3);
    // Senza GDO (Superadmin o Agenzia senza GDO): tutte le promo in corso
    expect((await servizio().getAvanzamento(null, req)).promozioni).toHaveLength(4);
  });

  it('kit volantino e POP, avviati e non avviati, con i file per stato dell\'ultima versione', async () => {
    const volantino = await creaKitRuntime({ statoPromo: 'IN_LAVORAZIONE', titolo: 'VOL TO SS', statoLavorazione: 'IN_REVISIONE' });
    const promo = { idGdo: volantino.idGdo, idPromo: volantino.idPromo };
    const pop = await creaKitRuntime({ promo, titolo: 'POP TO SS', tipoLavorazione: 2, statoLavorazione: 'IN_LAVORAZIONE_CON_ERRORI' });
    await creaKitRuntime({ promo, titolo: 'Manuale', tipo: 'MANUALE', statoLavorazione: 'IN_LAVORAZIONE' });
    await creaKitRuntime({ promo, titolo: 'Eliminato', statoLavorazione: 'ELIMINATO' });
    await creaKitRuntime({ promo, titolo: 'Formato senza tipo', tipoLavorazione: 0, statoLavorazione: 'IN_LAVORAZIONE' });
    const correggo = await creaTipoExport('CORREGGO');
    await creaFile({ nome: 'p1.pdf', idRuntime: volantino.idRuntime });
    await creaFile({ nome: 'p2.pdf', idRuntime: volantino.idRuntime });
    await creaFile({ nome: 'bozza.pdf', idRuntime: volantino.idRuntime, tipoExport: correggo });
    for (const nome of ['a.pdf', 'b.pdf', 'c.pdf']) await creaFile({ nome, idRuntime: pop.idRuntime });
    await creaLogFile({ idKitRuntime: pop.idRuntime, nomeFile: 'a.pdf', versione: 1, stato: 'ERRORE' });
    await creaLogFile({ idKitRuntime: pop.idRuntime, nomeFile: 'a.pdf', versione: 2, stato: 'ACCETTATO' });
    await creaLogFile({ idKitRuntime: pop.idRuntime, nomeFile: 'b.pdf', versione: 1, stato: 'ERRORE' });
    istanta.getAllKitPerGestioneLavorazione.mockResolvedValue({
      lavorazioni: [
        daAvviare('d0000000-0000-4000-8000-000000000001', 'POP TO CY', pop),
        // Il kit design del volantino è già avviato: non si ripete
        daAvviare(volantino.idDesign, 'VOL TO SS', volantino),
      ],
      volantini: [],
    });

    const [promozione] = (await servizio().getAvanzamento(volantino.idGdo, req)).promozioni;

    expect(promozione.nonAvviatiDisponibili).toBe(true);
    expect(promozione.kit.map(k => [k.titolo, k.tipo, k.stato, k.numeroFile, k.fileAccettati, k.fileInErrore])).toEqual([
      ['POP TO SS', 'POP', 'IN_LAVORAZIONE_CON_ERRORI', 3, 1, 1],
      ['VOL TO SS', 'VOL', 'IN_REVISIONE', 2, 0, 0],
      ['POP TO CY', 'POP', 'NON_AVVIATO', 0, 0, 0],
    ]);
    expect(promozione.kit[0]).toMatchObject({ id: pop.idRuntime, area: { id: pop.idArea, nome: 'Toscana' }, canale: { nome: 'Superstore' } });
    expect(promozione.kit[0].avviatoIl).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(promozione.kit[2]).toMatchObject({ id: null, idDesign: 'd0000000-0000-4000-8000-000000000001', avviatoIl: null });
  });

  it('se Istanta non risponde la promo mostra i kit avviati e dice che i non avviati mancano', async () => {
    const volantino = await creaKitRuntime({ statoPromo: 'IN_SCADENZA', statoLavorazione: 'IN_LAVORAZIONE' });
    istanta.getAllKitPerGestioneLavorazione.mockRejectedValue(new Error('Istanta non raggiungibile'));

    const [promozione] = (await servizio().getAvanzamento(volantino.idGdo, req)).promozioni;

    expect(promozione.nonAvviatiDisponibili).toBe(false);
    expect(promozione.kit.map(k => k.stato)).toEqual(['IN_LAVORAZIONE']);
  });

  it('i kit non avviati si riusano per un minuto; una risposta fallita non si tiene', async () => {
    const volantino = await creaKitRuntime({ statoPromo: 'IN_LAVORAZIONE', statoLavorazione: 'IN_LAVORAZIONE' });
    const avanzamento = servizio();
    istanta.getAllKitPerGestioneLavorazione.mockRejectedValueOnce(new Error('Istanta non raggiungibile'));

    expect((await avanzamento.getAvanzamento(volantino.idGdo, req)).promozioni[0].nonAvviatiDisponibili).toBe(false);
    expect((await avanzamento.getAvanzamento(volantino.idGdo, req)).promozioni[0].nonAvviatiDisponibili).toBe(true);
    await avanzamento.getAvanzamento(volantino.idGdo, req);
    expect(istanta.getAllKitPerGestioneLavorazione).toHaveBeenCalledTimes(2);

    adesso += DURATA_CACHE_NON_AVVIATI_MS + 1;
    await avanzamento.getAvanzamento(volantino.idGdo, req);
    expect(istanta.getAllKitPerGestioneLavorazione).toHaveBeenCalledTimes(3);
  });
});
