import type { Request } from 'express';
import { beforeEach, expect, it, vi } from 'vitest';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaFile, creaKitRuntime, creaTipoExport } from '../../../__tests__/integrazione/dati';
import { MaterialiRepository } from '../../repositories/MaterialiRepository';
import { type FonteKitNonAvviati, MaterialiService } from '../MaterialiService';

// Le regole delle viste Volantini e POP scritte in SQL, su PostgreSQL: volantino o POP lo decide
// il formato, i kit manuali e quelli eliminati non compaiono, in Attivi e Storico solo i kit
// pubblicati, i file dell'export CORREGGO non si contano.
describeConDatabase('MaterialiService: kit delle viste Volantini e POP', () => {
  usaDatabase();
  const req = {} as Request;
  // Nessun kit non avviato da Istanta: qui contano i kit del database
  const istanta = {
    getAllKitPerGestioneLavorazione: vi.fn<FonteKitNonAvviati['getAllKitPerGestioneLavorazione']>(async () => ({ lavorazioni: [], volantini: [] })),
  };
  const service = new MaterialiService(new MaterialiRepository(), istanta, { scriviZipDaOlimpo: vi.fn() });

  beforeEach(async () => {
    await svuotaTabelle('gdo', 'promo', 'formati', 'tipi_export');
    istanta.getAllKitPerGestioneLavorazione.mockClear();
  });

  it('Volantini attivi: solo i kit pubblicati dei formati volantino, senza manuali; i file di Correggo non si contano', async () => {
    const volantino = await creaKitRuntime({ titolo: 'Volantino pubblicato' });
    const promo = { idGdo: volantino.idGdo, idPromo: volantino.idPromo };
    await creaKitRuntime({ promo, titolo: 'Espositore pubblicato', tipoLavorazione: 2 });
    await creaKitRuntime({ promo, titolo: 'Volantino manuale', tipo: 'MANUALE' });
    await creaKitRuntime({ promo, titolo: 'Volantino in revisione', statoLavorazione: 'IN_REVISIONE' });
    await creaKitRuntime({ promo, titolo: 'Formato senza tipo', tipoLavorazione: 0 });
    const vol = await creaTipoExport('VOL');
    const correggo = await creaTipoExport('CORREGGO');
    await creaFile({ nome: 'pagina-2.pdf', idRuntime: volantino.idRuntime, tipoExport: vol, idOlimpoCloud: 'olimpo-2', mime: 'application/pdf' });
    await creaFile({ nome: 'pagina-1.pdf', idRuntime: volantino.idRuntime, tipoExport: vol, idOlimpoCloud: 'olimpo-1', mime: 'application/pdf' });
    await creaFile({ nome: 'correggo.pdf', idRuntime: volantino.idRuntime, tipoExport: correggo, idOlimpoCloud: 'olimpo-c' });

    const pagina = await service.getVolantini({ periodo: 'attivi' }, req);

    expect(pagina.kit.map(k => k.titolo)).toEqual(['Volantino pubblicato']);
    expect(pagina.kit[0]).toMatchObject({
      id: volantino.idRuntime,
      stato: 'PUBBLICATO',
      numeroFile: 2,
      formato: { id: volantino.idFormato, nome: 'Volantino' },
      copertina: { idOlimpoCloud: 'olimpo-1', nome: 'pagina-1.pdf', mime: 'application/pdf' },
    });
    expect(pagina).toMatchObject({ totale: 1, totaleSenzaFiltri: 1, avvisi: [] });
    expect(pagina.opzioni.promozioni).toEqual([{ id: volantino.idPromo, nome: 'Promo di prova' }]);
    expect(istanta.getAllKitPerGestioneLavorazione).not.toHaveBeenCalled();
  });

  it('Volantini attivi: cerca nel titolo del kit e nel nome della promo, a pagine', async () => {
    const primo = await creaKitRuntime({ titolo: 'Superstore Toscana', nomePromo: 'Sottocosto ottobre' });
    await creaKitRuntime({ promo: { idGdo: primo.idGdo, idPromo: primo.idPromo }, titolo: 'Ipermercati Lazio' });
    await creaKitRuntime({ titolo: 'Superstore Umbria', nomePromo: 'Natale' });

    const perTitolo = await service.getVolantini({ periodo: 'attivi', cerca: 'superstore', dimensione: 1, pagina: 2 }, req);
    const perPromo = await service.getVolantini({ periodo: 'attivi', cerca: 'SOTTOCOSTO' }, req);

    expect(perTitolo).toMatchObject({ totale: 2, totaleSenzaFiltri: 3, dimensione: 1, pagina: 2 });
    expect(perTitolo.kit).toHaveLength(1);
    expect(perPromo.kit.map(k => k.titolo).sort()).toEqual(['Ipermercati Lazio', 'Superstore Toscana']);
  });

  it('Volantini in corso: ogni kit non eliminato, in qualunque stato di lavorazione', async () => {
    const primo = await creaKitRuntime({ statoPromo: 'IN_LAVORAZIONE', titolo: 'In lavorazione', statoLavorazione: 'IN_LAVORAZIONE' });
    const promo = { idGdo: primo.idGdo, idPromo: primo.idPromo };
    await creaKitRuntime({ promo, titolo: 'Con errori', statoLavorazione: 'IN_LAVORAZIONE_CON_ERRORI' });
    await creaKitRuntime({ promo, titolo: 'Eliminato', statoLavorazione: 'ELIMINATO' });
    // Promo valida: sta in Attivi, non In corso
    await creaKitRuntime({ titolo: 'Di una promo valida' });

    const pagina = await service.getVolantini({ periodo: 'in-corso' }, req);

    expect(pagina.kit.map(k => k.titolo)).toEqual(['Con errori', 'In lavorazione']);
    expect(pagina.kit.map(k => k.stato)).toEqual(['IN_LAVORAZIONE_CON_ERRORI', 'IN_LAVORAZIONE']);
    expect(istanta.getAllKitPerGestioneLavorazione).toHaveBeenCalledTimes(1);
    expect(istanta.getAllKitPerGestioneLavorazione).toHaveBeenCalledWith(primo.idPromo, req);
  });

  it('POP attivi: le promo con kit POP pubblicati, con i loro file e formati; le altre no', async () => {
    const pop = await creaKitRuntime({ tipoLavorazione: 2, nomePromo: 'Con POP', nomeFormato: 'Espositori' });
    const promo = { idGdo: pop.idGdo, idPromo: pop.idPromo };
    await creaKitRuntime({ promo, tipoLavorazione: 2, nomeFormato: 'Locandine' });
    const inRevisione = await creaKitRuntime({ promo, tipoLavorazione: 2, statoLavorazione: 'IN_REVISIONE' });
    await creaFile({ nome: 'a.pdf', idRuntime: pop.idRuntime });
    await creaFile({ nome: 'b.pdf', idRuntime: pop.idRuntime });
    await creaFile({ nome: 'c.pdf', idRuntime: pop.idRuntime, tipoExportCodice: 'CORREGGO' });
    await creaFile({ nome: 'd.pdf', idRuntime: inRevisione.idRuntime });
    await creaKitRuntime({ nomePromo: 'Solo volantini' });
    await creaKitRuntime({ nomePromo: 'POP manuale', tipoLavorazione: 2, tipo: 'MANUALE' });

    const elenco = await service.getPromozioniPop('attivi');

    expect(elenco.promozioni).toEqual([expect.objectContaining({ id: pop.idPromo, nome: 'Con POP', numeroFile: 2, numeroFormati: 2 })]);
  });

  it('POP in corso: ogni promo del periodo, anche senza kit avviati', async () => {
    const pop = await creaKitRuntime({ statoPromo: 'IN_LAVORAZIONE', tipoLavorazione: 2, nomePromo: 'Con POP', statoLavorazione: 'IN_REVISIONE' });
    await creaFile({ nome: 'a.pdf', idRuntime: pop.idRuntime });
    await creaKitRuntime({ statoPromo: 'PIANIFICATA', nomePromo: 'Ancora da avviare', statoLavorazione: 'ELIMINATO', tipoLavorazione: 2 });

    const elenco = await service.getPromozioniPop('in-corso');

    expect(elenco.promozioni.map(p => [p.nome, p.numeroFile, p.numeroFormati]).sort()).toEqual([
      ['Ancora da avviare', 0, 0],
      ['Con POP', 1, 1],
    ]);
  });

  it('riepilogo POP: kit per formato con i file per stato del kit', async () => {
    const pop = await creaKitRuntime({ statoPromo: 'IN_RITARDO', tipoLavorazione: 2, nomeFormato: 'Espositori', statoLavorazione: 'IN_REVISIONE' });
    await creaFile({ nome: 'a.pdf', idRuntime: pop.idRuntime });
    await creaFile({ nome: 'b.pdf', idRuntime: pop.idRuntime });
    const conErrori = await creaKitRuntime({
      promo: { idGdo: pop.idGdo, idPromo: pop.idPromo }, tipoLavorazione: 2, nomeFormato: 'Locandine', statoLavorazione: 'IN_LAVORAZIONE_CON_ERRORI',
    });
    await creaFile({ nome: 'c.pdf', idRuntime: conErrori.idRuntime });

    const riepilogo = await service.getRiepilogoPop(pop.idPromo, 'in-corso', req);

    expect(riepilogo.formati.map(f => [f.nome, f.numeroFile, f.kit.length])).toEqual([['Espositori', 2, 1], ['Locandine', 1, 1]]);
    expect(riepilogo.totali).toEqual({ file: 3, formati: 2, pubblicati: 0, inRevisione: 2, conErrori: 1 });
  });
});
