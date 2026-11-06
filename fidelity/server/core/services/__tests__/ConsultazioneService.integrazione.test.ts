import { randomUUID } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { NotFoundError, ServiceUnavailableError } from '../../../../lib/errors';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaFile, creaKitRuntime, creaTipoExport, type KitDiProva } from '../../../__tests__/integrazione/dati';
import { ErroreRispostaOlimpo } from '../../http/olimpo';
import { ConsultazioneRepository } from '../../repositories/ConsultazioneRepository';
import { MaterialiRepository } from '../../repositories/MaterialiRepository';
import { ConsultazioneService } from '../ConsultazioneService';

// Le API di consultazione su PostgreSQL: solo kit PUBBLICATI di promo non eliminate della GDO
// dell'ambito, periodi per stato della promo, nessun dato di lavorazione nella risposta, file
// scaricabili solo se pubblicati e non dell'export Correggo, contenuti digitali dei kit manuali.
describeConDatabase('ConsultazioneService', () => {
  usaDatabase();
  const lettore = vi.fn(async (_idOlimpo: string) => Buffer.from('%PDF-1.7'));
  const scrittoreZip = { scriviZipDaOlimpo: vi.fn() };
  const service = new ConsultazioneService(
    new MaterialiRepository(),
    new ConsultazioneRepository(),
    scrittoreZip,
    lettore,
    async () => ['codice_referenza']
  );
  const giorno = (iso: string) => new Date(iso);
  const della = (kit: KitDiProva) => ({ idGdo: kit.idGdo });
  /** Nessun dato di lavorazione: niente stato (di kit, file o promo), log, versioni o direttive. */
  const senzaDatiDiLavorazione = (dati: unknown) => {
    const testo = JSON.stringify(dati);
    expect(testo).not.toMatch(/"stato/);
    expect(testo).not.toMatch(/"versione/);
    expect(testo).not.toMatch(/"direttive/);
  };

  beforeEach(async () => {
    await svuotaTabelle('gdo', 'promo', 'formati', 'tipi_export');
    lettore.mockClear();
  });

  it('volantini in validità: solo i pubblicati della GDO, con la copertina e senza dati di lavorazione', async () => {
    const vol = await creaTipoExport('VOL');
    const nostro = await creaKitRuntime({ nomePromo: 'Natale', titolo: 'SS TO VOL' });
    const promo = { idGdo: nostro.idGdo, idPromo: nostro.idPromo };
    await creaKitRuntime({ promo, titolo: 'In revisione', statoLavorazione: 'IN_REVISIONE' });
    await creaKitRuntime({ promo, titolo: 'Espositore', tipoLavorazione: 2 });
    await creaKitRuntime({ promo, titolo: 'Manuale', tipo: 'MANUALE' });
    await creaKitRuntime({ nomePromo: 'Di un\'altra GDO', titolo: 'Altro VOL' });
    const copertina = await creaFile({ nome: 'volantino.pdf', idRuntime: nostro.idRuntime, tipoExport: vol, idOlimpoCloud: 'olimpo-1', mime: 'application/pdf' });
    await creaFile({ nome: 'correggo.pdf', idRuntime: nostro.idRuntime, tipoExportCodice: 'CORREGGO', idOlimpoCloud: 'olimpo-c' });

    const pagina = await service.getVolantini({ periodo: 'attivi' }, della(nostro));

    expect(pagina).toMatchObject({ totale: 1, pagina: 1, dimensione: 24 });
    expect(pagina.kit).toEqual([{
      id: nostro.idRuntime,
      titolo: 'SS TO VOL',
      promo: { id: nostro.idPromo, nome: 'Natale', validitaDal: expect.any(String), validitaAl: expect.any(String) },
      area: { id: nostro.idArea, nome: 'Toscana' },
      canale: { id: nostro.idCanale, nome: 'Superstore' },
      numeroFile: 1,
      copertina: {
        id: copertina,
        nome: 'volantino.pdf',
        tipoExport: 'VOL',
        mime: 'application/pdf',
        pagine: null,
        anteprima: '/olimpo/materiali/getThumbnailMaterialePdfs?id=olimpo-1',
      },
    }]);
    senzaDatiDiLavorazione(pagina);
  });

  it('periodi per stato della promo; le promo eliminate non compaiono mai', async () => {
    const valida = await creaKitRuntime({ nomePromo: 'Valida con errori', statoPromo: 'VALIDA_CON_ERRORI' });
    const ambito = della(valida);
    await creaKitRuntime({ idGdo: valida.idGdo, nomePromo: 'In attesa', statoPromo: 'IN_ATTESA_DI_VALIDITA' });
    await creaKitRuntime({ idGdo: valida.idGdo, nomePromo: 'In ritardo', statoPromo: 'IN_RITARDO' });
    await creaKitRuntime({ idGdo: valida.idGdo, nomePromo: 'Archiviata', statoPromo: 'ARCHIVIATA' });
    await creaKitRuntime({ idGdo: valida.idGdo, nomePromo: 'Eliminata', statoPromo: 'ELIMINATA', validitaAl: giorno('2025-01-31T00:00:00+01:00') });

    const nomi = async (periodo: 'attivi' | 'prossimi' | 'storico') =>
      (await service.getVolantini({ periodo }, ambito)).kit.map(kit => kit.promo.nome).sort();

    expect(await nomi('attivi')).toEqual(['Valida con errori']);
    expect(await nomi('prossimi')).toEqual(['In attesa', 'In ritardo']);
    expect(await nomi('storico')).toEqual(['Archiviata']);
  });

  it('ambito: tutte le GDO per chi opera per più GDO, nessuna per chi non ne ha', async () => {
    const a = await creaKitRuntime({ nomePromo: 'A' });
    await creaKitRuntime({ nomePromo: 'B' });

    expect((await service.getVolantini({ periodo: 'attivi' }, 'tutte')).totale).toBe(2);
    expect((await service.getVolantini({ periodo: 'attivi' }, 'nessuna')).totale).toBe(0);
    expect((await service.getVolantini({ periodo: 'attivi' }, della(a))).kit.map(kit => kit.promo.nome)).toEqual(['A']);
  });

  it('storico a pagine, dalla promo con la validità più recente', async () => {
    const prima = await creaKitRuntime({ statoPromo: 'ARCHIVIATA', nomePromo: 'Gennaio', validitaDal: giorno('2025-01-10T00:00:00+01:00') });
    const ambito = della(prima);
    await creaKitRuntime({ idGdo: prima.idGdo, statoPromo: 'ARCHIVIATA', nomePromo: 'Marzo', validitaDal: giorno('2025-03-10T00:00:00+01:00') });
    await creaKitRuntime({ idGdo: prima.idGdo, statoPromo: 'ARCHIVIATA', nomePromo: 'Febbraio', validitaDal: giorno('2025-02-10T00:00:00+01:00') });

    const pagina1 = await service.getVolantini({ periodo: 'storico', dimensione: 2 }, ambito);
    const pagina2 = await service.getVolantini({ periodo: 'storico', dimensione: 2, pagina: 2 }, ambito);

    expect(pagina1.kit.map(kit => kit.promo.nome)).toEqual(['Marzo', 'Febbraio']);
    expect(pagina2).toMatchObject({ totale: 3, pagina: 2, dimensione: 2 });
    expect(pagina2.kit.map(kit => kit.promo.nome)).toEqual(['Gennaio']);
  });

  it('volantini per promozione dello storico: aree e canali solo della GDO dell\'ambito', async () => {
    const nostro = await creaKitRuntime({ statoPromo: 'ARCHIVIATA', nomePromo: 'Nostra' });
    await creaKitRuntime({ statoPromo: 'ARCHIVIATA', nomePromo: 'Altrui' });

    const pagina = await service.getPromozioniVolantini({ periodo: 'storico' }, della(nostro));

    expect(pagina.promozioni.map(p => p.promo.nome)).toEqual(['Nostra']);
    expect(pagina.opzioni.aree.map(area => area.id)).toEqual([nostro.idArea]);
    expect(pagina.opzioni.canali.map(canale => canale.id)).toEqual([nostro.idCanale]);
    senzaDatiDiLavorazione(pagina);
  });

  it('dettaglio del volantino: i file senza Correggo; un kit non pubblicato o di un\'altra GDO non esiste', async () => {
    const vol = await creaTipoExport('VOL');
    const nostro = await creaKitRuntime({ nomePromo: 'Natale' });
    await creaFile({ nome: 'volantino.pdf', idRuntime: nostro.idRuntime, tipoExport: vol, idOlimpoCloud: 'olimpo-1', mime: 'application/pdf' });
    await creaFile({ nome: 'social.jpg', idRuntime: nostro.idRuntime, tipoExportCodice: 'WEB', idOlimpoCloud: 'olimpo-2', mime: 'image/jpeg' });
    await creaFile({ nome: 'correggo.pdf', idRuntime: nostro.idRuntime, tipoExportCodice: 'CORREGGO', idOlimpoCloud: 'olimpo-c' });
    const inRevisione = await creaKitRuntime({ idGdo: nostro.idGdo, statoLavorazione: 'IN_REVISIONE' });
    const altrui = await creaKitRuntime({});

    const dettaglio = await service.getVolantino(nostro.idRuntime, della(nostro));

    expect(dettaglio).toMatchObject({ id: nostro.idRuntime, promo: { nome: 'Natale' }, area: { nome: 'Toscana' } });
    expect(dettaglio.file.map(file => [file.nome, file.tipoExport])).toEqual([['volantino.pdf', 'VOL'], ['social.jpg', 'WEB']]);
    senzaDatiDiLavorazione(dettaglio);
    await expect(service.getVolantino(inRevisione.idRuntime, della(nostro))).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getVolantino(altrui.idRuntime, della(nostro))).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getVolantino('non-un-id', della(nostro))).rejects.toBeInstanceOf(NotFoundError);
  });

  it('download: solo i file pubblicati della GDO, non Correggo; Olimpo giù dà il motivo', async () => {
    const nostro = await creaKitRuntime({});
    const ambito = della(nostro);
    const pdf = await creaFile({ nome: 'volantino (Lavorazione: 3).pdf', idRuntime: nostro.idRuntime, idOlimpoCloud: 'olimpo-1', mime: 'application/pdf' });
    const correggo = await creaFile({ nome: 'correggo.pdf', idRuntime: nostro.idRuntime, tipoExportCodice: 'CORREGGO', idOlimpoCloud: 'olimpo-c' });
    const inRevisione = await creaKitRuntime({ idGdo: nostro.idGdo, statoLavorazione: 'IN_REVISIONE' });
    const nonPubblicato = await creaFile({ nome: 'bozza.pdf', idRuntime: inRevisione.idRuntime, idOlimpoCloud: 'olimpo-b' });
    const altrui = await creaKitRuntime({});
    const diAltri = await creaFile({ nome: 'altrui.pdf', idRuntime: altrui.idRuntime, idOlimpoCloud: 'olimpo-a' });

    const file = await service.scaricaFile(pdf, ambito);
    expect(file).toEqual({ nome: 'volantino (Lavorazione: 3).pdf', mime: 'application/pdf', contenuto: Buffer.from('%PDF-1.7') });
    expect(lettore).toHaveBeenCalledWith('olimpo-1');

    for (const idFile of [correggo, nonPubblicato, diAltri, randomUUID()]) {
      await expect(service.scaricaFile(idFile, ambito)).rejects.toBeInstanceOf(NotFoundError);
    }
    expect(lettore).toHaveBeenCalledTimes(1);

    lettore.mockRejectedValueOnce(new ErroreRispostaOlimpo('/materiali/getMaterialePDF', 500));
    await expect(service.scaricaFile(pdf, ambito)).rejects.toThrow(ServiceUnavailableError);
    lettore.mockRejectedValueOnce(new ErroreRispostaOlimpo('/materiali/getMaterialePDF', 500));
    await expect(service.scaricaFile(pdf, ambito)).rejects.toThrow('File non scaricato: Olimpo ha risposto con un errore.');
  });

  it('contenuti digitali: file dei kit manuali pubblicati, filtri e opzioni dai contenuti consultabili', async () => {
    const pdf = await creaTipoExport('PDF');
    const manuale = await creaKitRuntime({ tipo: 'MANUALE', titolo: 'Cartelli Toscana', nomePromo: 'Natale' });
    const ambito = della(manuale);
    const lazio = await creaKitRuntime({ promo: { idGdo: manuale.idGdo, idPromo: manuale.idPromo }, tipo: 'MANUALE', titolo: 'Cartelli Lazio' });
    const bozza = await creaKitRuntime({ idGdo: manuale.idGdo, tipo: 'MANUALE', statoLavorazione: 'IN_LAVORAZIONE' });
    const automatico = await creaKitRuntime({ idGdo: manuale.idGdo });
    await creaFile({ nome: 'cartello-1.pdf', idRuntime: manuale.idRuntime, tipoExport: pdf, idOlimpoCloud: 'o1', meta: { codice_referenza: { content: '0014823' } } });
    await creaFile({ nome: 'cartello-2.pdf', idRuntime: lazio.idRuntime, tipoExport: pdf, idOlimpoCloud: 'o2' });
    await creaFile({ nome: 'correggo.pdf', idRuntime: manuale.idRuntime, tipoExportCodice: 'CORREGGO', idOlimpoCloud: 'oc' });
    await creaFile({ nome: 'bozza.pdf', idRuntime: bozza.idRuntime, idOlimpoCloud: 'ob' });
    await creaFile({ nome: 'volantino.pdf', idRuntime: automatico.idRuntime, idOlimpoCloud: 'ov' });

    const tutti = await service.getContenutiDigitali({}, ambito);
    expect(tutti.totale).toBe(2);
    expect(tutti.file.map(file => [file.nome, file.kit.titolo, file.promo.nome])).toEqual([
      ['cartello-2.pdf', 'Cartelli Lazio', 'Natale'],
      ['cartello-1.pdf', 'Cartelli Toscana', 'Natale'],
    ]);
    senzaDatiDiLavorazione(tutti);

    expect((await service.getContenutiDigitali({ idArea: lazio.idArea }, ambito)).file.map(file => file.nome)).toEqual(['cartello-2.pdf']);
    // Per un campo dei metadati configurato, e per il titolo del kit
    expect((await service.getContenutiDigitali({ cerca: '0014823' }, ambito)).file.map(file => file.nome)).toEqual(['cartello-1.pdf']);
    expect((await service.getContenutiDigitali({ cerca: 'lazio' }, ambito)).file.map(file => file.nome)).toEqual(['cartello-2.pdf']);
    expect((await service.getContenutiDigitali({ dimensione: 1, pagina: 2 }, ambito))).toMatchObject({ totale: 2, pagina: 2, dimensione: 1 });
    expect((await service.getContenutiDigitali({}, 'nessuna')).totale).toBe(0);

    const opzioni = await service.getOpzioniContenutiDigitali(ambito);
    expect(opzioni.promozioni).toEqual([{ id: manuale.idPromo, nome: 'Natale' }]);
    expect(opzioni.tipiExport).toEqual([{ id: pdf, nome: 'PDF' }]);
    expect(opzioni.aree.map(area => area.id).sort()).toEqual([manuale.idArea, lazio.idArea].sort());
  });

  it('POP: promo e riepilogo dei soli pubblicati della GDO, file senza stato, ZIP solo della promo e del formato', async () => {
    const pop = await creaKitRuntime({ tipoLavorazione: 2, nomeFormato: 'Cartello A5', nomePromo: 'Sottocosto', titolo: 'A5 TO' });
    const ambito = della(pop);
    await creaKitRuntime({ promo: { idGdo: pop.idGdo, idPromo: pop.idPromo }, stessaCombinazioneDi: pop, titolo: 'In revisione', statoLavorazione: 'IN_REVISIONE' });
    const altraPromo = await creaKitRuntime({ idGdo: pop.idGdo, stessaCombinazioneDi: pop, nomePromo: 'Altra' });
    const file = await creaFile({ nome: 'cartello.pdf', idRuntime: pop.idRuntime, idOlimpoCloud: 'o1', meta: { codice_referenza: '0014823', reparto: 'Ortofrutta' } });
    const fileAltraPromo = await creaFile({ nome: 'altra.pdf', idRuntime: altraPromo.idRuntime, idOlimpoCloud: 'o2' });

    const elenco = await service.getPromozioniPop('attivi', ambito);
    expect(elenco.promozioni.find(p => p.id === pop.idPromo)).toMatchObject({ nome: 'Sottocosto', numeroFile: 1, numeroFormati: 1 });

    const riepilogo = await service.getRiepilogoPop(pop.idPromo, 'attivi', ambito);
    expect(riepilogo.totali).toEqual({ file: 1, formati: 1 });
    expect(riepilogo.formati[0].kit.map(kit => kit.titolo)).toEqual(['A5 TO']);
    senzaDatiDiLavorazione(riepilogo);
    await expect(service.getRiepilogoPop(pop.idPromo, 'attivi', { idGdo: randomUUID() })).rejects.toBeInstanceOf(NotFoundError);

    const pagina = await service.getFilePop(pop.idPromo, { periodo: 'attivi', idFormato: pop.idFormato }, ambito);
    expect(pagina.file).toEqual([expect.objectContaining({
      id: file, nome: 'cartello.pdf', referenza: { codice: '0014823', descrizione: null }, reparto: 'Ortofrutta',
    })]);
    senzaDatiDiLavorazione(pagina);

    const zip = await service.preparaZipPop(pop.idPromo, { periodo: 'attivi', idFormato: pop.idFormato, idFile: [file, fileAltraPromo] }, ambito);
    expect(zip.voci.map(voce => voce.file.id_olimpo_cloud)).toEqual(['o1']);
    expect(zip.nomeFile).toBe('Sottocosto - Cartello A5.zip');
  });
});
