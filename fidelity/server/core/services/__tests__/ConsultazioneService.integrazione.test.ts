import { randomUUID } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { NotFoundError, ServiceUnavailableError } from '../../../../lib/errors';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaFile, creaKitRuntime, creaReferenza, creaTipoExport, type KitDiProva } from '../../../__tests__/integrazione/dati';
import { sequelize } from '../../db/SequelizeConnector';
import { ErroreRispostaOlimpo } from '../../http/olimpo';
import { ConsultazioneRepository } from '../../repositories/ConsultazioneRepository';
import { MaterialiRepository } from '../../repositories/MaterialiRepository';
import { ConsultazioneService } from '../ConsultazioneService';

// Le API di consultazione su PostgreSQL: solo kit PUBBLICATI di promo non eliminate della GDO
// dell'ambito, periodi per stato della promo, nessun dato di lavorazione nella risposta, file
// scaricabili solo se pubblicati e non dell'export Correggo, contenuti digitali dei kit manuali,
// promozione in vetrina e dettaglio di consultazione della promozione (spec volantini-pop).
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
    await svuotaTabelle('gdo', 'promo', 'formati', 'tipi_export', 'punti_vendita_volantino', 'referenze');
    lettore.mockClear();
  });

  /** Le righe della lista dei punti vendita stampata nel volantino del kit, dalla posizione 1. */
  async function creaRighePuntiVendita(kit: KitDiProva, righe: Array<{
    riga: string;
    localita?: string;
    regione?: string;
    provincia?: string;
    idPuntoVendita?: string;
  }>): Promise<void> {
    for (const [indice, dati] of righe.entries()) {
      await sequelize.query(
        `INSERT INTO punti_vendita_volantino (id, id_gdo, id_kit_runtime, id_promo, posizione, riga, localita, regione, provincia, id_punto_vendita)
         VALUES (:id, :idGdo, :idKit, :idPromo, :posizione, :riga, :localita, :regione, :provincia, :idPuntoVendita)`,
        {
          replacements: {
            id: randomUUID(), idGdo: kit.idGdo, idKit: kit.idRuntime, idPromo: kit.idPromo, posizione: indice + 1, riga: dati.riga,
            localita: dati.localita ?? null, regione: dati.regione ?? null, provincia: dati.provincia ?? null,
            idPuntoVendita: dati.idPuntoVendita ?? null,
          },
        }
      );
    }
  }

  /** N righe qualunque nella lista del kit: per la vetrina conta solo quante sono. */
  const righeQualunque = (numero: number) => Array.from({ length: numero }, (_, indice) => ({ riga: `PV ${indice + 1}` }));

  /** Un punto vendita dell'anagrafica nella GDO del kit, sulla sua combinazione canale/area. */
  async function creaPuntoVendita(kit: KitDiProva, dati: { nome: string; citta: string; regione?: string; lat?: number; lon?: number }): Promise<string> {
    const idCombinazione = randomUUID();
    await sequelize.query(
      `INSERT INTO combinazione_canale_area (id_combinazione_canale_area, id_gdo_combinazione_canale_area, id_canale_combinazione_canale_area,
         id_area_combinazione_canale_area, stato_combinazione_canale_area, createdat, updatedat)
       VALUES (:idCombinazione, :idGdo, :idCanale, :idArea, 'ATTIVO', NOW(), NOW())`,
      { replacements: { idCombinazione, idGdo: kit.idGdo, idCanale: kit.idCanale, idArea: kit.idArea } }
    );
    const id = randomUUID();
    await sequelize.query(
      `INSERT INTO punti_vendita (id_puntivendita, nome_puntivendita, citta_puntivendita, cap_puntivendita, indirizzo_puntivendita,
         lat_puntivendita, lon_puntivendita, regione_puntivendita, id_combinazione_canale_area_puntivendita, id_gdo_puntivendita, createdat, updatedat)
       VALUES (:id, :nome, :citta, '58100', 'Via di prova 1', :lat, :lon, :regione, :idCombinazione, :idGdo, NOW(), NOW())`,
      {
        replacements: {
          id, nome: dati.nome, citta: dati.citta, lat: dati.lat ?? null, lon: dati.lon ?? null, regione: dati.regione ?? null,
          idCombinazione, idGdo: kit.idGdo,
        },
      }
    );
    return id;
  }

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

  it('prossimi: solo i kit già pubblicati delle promo non ancora valide; i kit in lavorazione non compaiono', async () => {
    const pubblicato = await creaKitRuntime({ statoPromo: 'IN_LAVORAZIONE', nomePromo: 'Natale', titolo: 'SS TO VOL' });
    const ambito = della(pubblicato);
    await creaKitRuntime({ promo: { idGdo: pubblicato.idGdo, idPromo: pubblicato.idPromo }, titolo: 'IPER TO VOL', statoLavorazione: 'IN_LAVORAZIONE' });
    await creaKitRuntime({ idGdo: pubblicato.idGdo, statoPromo: 'PIANIFICATA', nomePromo: 'Solo in lavorazione', statoLavorazione: 'IN_REVISIONE' });
    const pop = await creaKitRuntime({
      idGdo: pubblicato.idGdo, statoPromo: 'IN_ATTESA_DI_VALIDITA', nomePromo: 'Pasqua', tipoLavorazione: 2, nomeFormato: 'Cartello A5', titolo: 'A5 TO',
    });
    const inRevisione = await creaKitRuntime({
      promo: { idGdo: pop.idGdo, idPromo: pop.idPromo }, stessaCombinazioneDi: pop, titolo: 'A5 in revisione', statoLavorazione: 'IN_REVISIONE',
    });
    await creaFile({ nome: 'cartello.pdf', idRuntime: pop.idRuntime, idOlimpoCloud: 'o1' });
    await creaFile({ nome: 'bozza.pdf', idRuntime: inRevisione.idRuntime, idOlimpoCloud: 'o2' });

    const volantini = await service.getPromozioniVolantini({ periodo: 'prossimi' }, ambito);
    // L'unica promo con kit volantino pubblicati: senza filtri e' in vetrina, fuori dall'elenco
    const vetrina = volantini.vetrina?.promozione;
    expect([vetrina?.promo.nome, vetrina?.numeroKit, vetrina?.kit.map(kit => kit.titolo)]).toEqual(['Natale', 1, ['SS TO VOL']]);
    expect(volantini.promozioni).toEqual([]);
    const cercata = await service.getPromozioniVolantini({ periodo: 'prossimi', cerca: 'natale' }, ambito);
    expect(cercata.promozioni.map(p => [p.promo.nome, p.numeroKit, p.kit.map(kit => kit.titolo)])).toEqual([['Natale', 1, ['SS TO VOL']]]);

    const elencoPop = await service.getPromozioniPop('prossimi', ambito);
    expect(elencoPop.promozioni.map(p => [p.nome, p.numeroFile, p.numeroFormati])).toEqual([['Pasqua', 1, 1]]);
    const riepilogo = await service.getRiepilogoPop(pop.idPromo, 'prossimi', ambito);
    expect(riepilogo.formati.map(formato => [formato.nome, formato.numeroFile, formato.kit.map(kit => kit.titolo)])).toEqual([
      ['Cartello A5', 1, ['A5 TO']],
    ]);
    const file = await service.getFilePop(pop.idPromo, { periodo: 'prossimi', idFormato: pop.idFormato }, ambito);
    expect(file.file.map(voce => voce.nome)).toEqual(['cartello.pdf']);
    senzaDatiDiLavorazione([volantini, elencoPop, riepilogo, file]);
    // La promo non ancora valida non sta fra le attive
    await expect(service.getRiepilogoPop(pop.idPromo, 'attivi', ambito)).rejects.toBeInstanceOf(NotFoundError);
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

    // L'unica promo della GDO e' in vetrina; quella dell'altra GDO non c'e' da nessuna parte
    expect(pagina.vetrina?.promozione.promo.nome).toBe('Nostra');
    expect(pagina.promozioni).toEqual([]);
    expect(pagina.riepilogo).toEqual({ promozioni: 1, kit: 1, puntiVendita: 0 });
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

  it('vetrina degli Attivi: la promo con piu\' righe dei punti vendita nei volantini pubblicati, a parita\' la validita\' piu\' recente', async () => {
    const ottobre = await creaKitRuntime({ nomePromo: 'Ottobre', titolo: 'SS TO 40', validitaDal: giorno('2026-10-01T00:00:00+02:00') });
    const ambito = della(ottobre);
    await creaRighePuntiVendita(ottobre, righeQualunque(3));
    // Tre righe anche qui, su due volantini, e la validita' piu' recente: e' lei in vetrina
    const metaOttobre = await creaKitRuntime({ idGdo: ottobre.idGdo, nomePromo: 'Metà ottobre', titolo: 'SS TO 42', validitaDal: giorno('2026-10-15T00:00:00+02:00') });
    await creaRighePuntiVendita(metaOttobre, righeQualunque(2));
    const ipermercati = await creaKitRuntime({ promo: { idGdo: metaOttobre.idGdo, idPromo: metaOttobre.idPromo }, titolo: 'IPER TO 42' });
    await creaRighePuntiVendita(ipermercati, righeQualunque(1));
    // Le righe di un volantino non pubblicato non contano
    const novembre = await creaKitRuntime({ idGdo: ottobre.idGdo, nomePromo: 'Novembre', titolo: 'SS TO 44', validitaDal: giorno('2026-11-01T00:00:00+01:00') });
    await creaRighePuntiVendita(novembre, righeQualunque(1));
    const inRevisione = await creaKitRuntime({ promo: { idGdo: novembre.idGdo, idPromo: novembre.idPromo }, titolo: 'In revisione', statoLavorazione: 'IN_REVISIONE' });
    await creaRighePuntiVendita(inRevisione, righeQualunque(5));

    const pagina = await service.getPromozioniVolantini({ periodo: 'attivi' }, ambito);

    expect(pagina.vetrina?.motivo).toBe('piu_punti_vendita');
    expect(pagina.vetrina?.promozione).toMatchObject({ promo: { nome: 'Metà ottobre' }, numeroKit: 2 });
    expect(pagina.vetrina?.promozione.kit.map(kit => [kit.titolo, kit.numeroPuntiVendita]).sort()).toEqual([['IPER TO 42', 1], ['SS TO 42', 2]]);
    // Fuori dall'elenco e dai suoi totali, non dal totale senza filtri ne' dal riepilogo
    expect(pagina.promozioni.map(p => p.promo.nome)).toEqual(['Novembre', 'Ottobre']);
    expect(pagina).toMatchObject({ totale: 2, totaleKit: 2, totaleSenzaFiltri: 3 });
    expect(pagina.riepilogo).toEqual({ promozioni: 3, kit: 4, puntiVendita: 7 });
    senzaDatiDiLavorazione(pagina);
  });

  it('con un filtro niente vetrina e nessuna promo esclusa; il riepilogo resta del periodo intero', async () => {
    const ottobre = await creaKitRuntime({ nomePromo: 'Ottobre', titolo: 'SS TO 40', validitaDal: giorno('2026-10-01T00:00:00+02:00') });
    const ambito = della(ottobre);
    await creaRighePuntiVendita(ottobre, righeQualunque(4));
    const novembre = await creaKitRuntime({ idGdo: ottobre.idGdo, nomePromo: 'Novembre', validitaDal: giorno('2026-11-01T00:00:00+01:00') });

    for (const filtri of [{ cerca: 'o' }, { idArea: ottobre.idArea }, { idCanale: novembre.idCanale }, { idPromo: ottobre.idPromo }, { anno: 2026 }]) {
      const pagina = await service.getPromozioniVolantini({ periodo: 'attivi', ...filtri }, ambito);
      expect(pagina.vetrina, JSON.stringify(filtri)).toBeNull();
      expect(pagina.riepilogo, JSON.stringify(filtri)).toEqual({ promozioni: 2, kit: 2, puntiVendita: 4 });
      expect(pagina.totaleSenzaFiltri, JSON.stringify(filtri)).toBe(2);
    }
    const cercate = await service.getPromozioniVolantini({ periodo: 'attivi', cerca: 'o' }, ambito);
    expect(cercate.promozioni.map(p => p.promo.nome)).toEqual(['Novembre', 'Ottobre']);
    expect(cercate).toMatchObject({ totale: 2, totaleKit: 2 });
    const perArea = await service.getPromozioniVolantini({ periodo: 'attivi', idArea: ottobre.idArea }, ambito);
    expect(perArea.promozioni.map(p => p.promo.nome)).toEqual(['Ottobre']);
  });

  it('vetrina dei Prossimi: l\'inizio di validita\' piu\' vicino; dello Storico: la fine di validita\' piu\' recente; periodo vuoto senza vetrina', async () => {
    const dicembre = await creaKitRuntime({ statoPromo: 'IN_LAVORAZIONE', nomePromo: 'Dicembre', validitaDal: giorno('2026-12-01T00:00:00+01:00') });
    const ambito = della(dicembre);
    await creaRighePuntiVendita(dicembre, righeQualunque(10));
    await creaKitRuntime({ idGdo: dicembre.idGdo, statoPromo: 'PIANIFICATA', nomePromo: 'Fine novembre', validitaDal: giorno('2026-11-20T00:00:00+01:00') });
    await creaKitRuntime({
      idGdo: dicembre.idGdo, statoPromo: 'ARCHIVIATA', nomePromo: 'Agosto',
      validitaDal: giorno('2026-08-01T00:00:00+02:00'), validitaAl: giorno('2026-08-31T00:00:00+02:00'),
    });
    await creaKitRuntime({
      idGdo: dicembre.idGdo, statoPromo: 'ARCHIVIATA', nomePromo: 'Settembre',
      validitaDal: giorno('2026-09-01T00:00:00+02:00'), validitaAl: giorno('2026-09-30T00:00:00+02:00'),
    });

    const prossimi = await service.getPromozioniVolantini({ periodo: 'prossimi' }, ambito);
    expect([prossimi.vetrina?.motivo, prossimi.vetrina?.promozione.promo.nome]).toEqual(['prima_a_partire', 'Fine novembre']);
    expect(prossimi.promozioni.map(p => p.promo.nome)).toEqual(['Dicembre']);
    expect(prossimi.riepilogo).toEqual({ promozioni: 2, kit: 2, puntiVendita: 10 });

    const storico = await service.getPromozioniVolantini({ periodo: 'storico' }, ambito);
    expect([storico.vetrina?.motivo, storico.vetrina?.promozione.promo.nome]).toEqual(['ultima_conclusa', 'Settembre']);
    expect(storico.promozioni.map(p => p.promo.nome)).toEqual(['Agosto']);
    expect(storico).toMatchObject({ totale: 1, totaleKit: 1, totaleSenzaFiltri: 2 });

    const attivi = await service.getPromozioniVolantini({ periodo: 'attivi' }, ambito);
    expect(attivi).toMatchObject({ vetrina: null, promozioni: [], totale: 0, totaleSenzaFiltri: 0 });
    expect(attivi.riepilogo).toEqual({ promozioni: 0, kit: 0, puntiVendita: 0 });
  });

  it('dettaglio della promozione: solo i kit volantino pubblicati, per canale, area e titolo, con insight e righe dei punti vendita', async () => {
    const superstore = await creaKitRuntime({ nomePromo: 'Volantino 45', titolo: 'SS TO 45' });
    const ambito = della(superstore);
    const promo = { idGdo: superstore.idGdo, idPromo: superstore.idPromo };
    const ipermercati = await creaKitRuntime({ promo, titolo: 'IPER TO 45' });
    await sequelize.query('UPDATE canali SET nome_canali = :nome WHERE id_canali = :id', { replacements: { nome: 'Ipermercati', id: ipermercati.idCanale } });
    // Non sono volantini pubblicati: non compaiono, ne' le loro righe
    const inRevisione = await creaKitRuntime({ promo, titolo: 'In revisione', statoLavorazione: 'IN_REVISIONE' });
    await creaRighePuntiVendita(inRevisione, righeQualunque(3));
    await creaKitRuntime({ promo, titolo: 'Espositore', tipoLavorazione: 2 });
    await creaKitRuntime({ promo, titolo: 'Manuale', tipo: 'MANUALE' });

    const grosseto = await creaPuntoVendita(superstore, { nome: 'Superstore Grosseto', citta: 'Grosseto', lat: 42.76, lon: 11.11 });
    const firenze = await creaPuntoVendita(ipermercati, { nome: 'Iper Firenze', citta: 'Firenze', regione: 'Toscana' });
    await creaRighePuntiVendita(superstore, [
      { riga: 'GROSSETO - Via Roma 1', localita: 'GROSSETO', provincia: 'GR', idPuntoVendita: grosseto },
      { riga: 'Modena - Via Emilia 2', localita: 'Modena', regione: 'EMILIA ROMAGNA' },
    ]);
    await creaRighePuntiVendita(ipermercati, [{ riga: 'Firenze - Viale Italia 3', localita: 'FIRENZE', idPuntoVendita: firenze }]);
    // Lo stesso prodotto nei due volantini, un altro solo negli Ipermercati
    await creaReferenza(superstore, { codice: '0014823' });
    await creaReferenza(ipermercati, { codice: '0014823' });
    await creaReferenza(ipermercati, { codice: '0099999' });

    const dettaglio = await service.getPromozioneVolantini(superstore.idPromo, ambito);

    expect(dettaglio).toMatchObject({ promo: { id: superstore.idPromo, nome: 'Volantino 45' }, periodo: 'attivi' });
    expect(dettaglio.kit.map(kit => [kit.titolo, kit.canale.nome, kit.numeroPuntiVendita, kit.referenze, kit.box])).toEqual([
      ['IPER TO 45', 'Ipermercati', 1, 2, 2],
      ['SS TO 45', 'Superstore', 2, 1, 1],
    ]);
    expect(dettaglio.numeri).toMatchObject({
      kit: 2, puntiVendita: 3, localita: 3, regioni: 2, prodotti: 2, referenze: 3, scontoMedio: null, sottocosto: 0,
    });
    expect(dettaglio.assortimento.prodotti).toEqual({ inTutti: 1, inAlcuni: 0, inUnoSolo: 1 });
    expect(dettaglio.assortimento.meccanichePerCanale.map(voce => [voce.canale.nome, voce.box])).toEqual([['Ipermercati', 2], ['Superstore', 1]]);
    expect(dettaglio.puntiVendita).toEqual([
      {
        id: expect.any(String), idKit: ipermercati.idRuntime, riga: 'Firenze - Viale Italia 3', localita: 'FIRENZE', indirizzo: null,
        // Ne' regione ne' provincia stampate: la regione dell'anagrafica
        regione: 'TOS', puntoVendita: { id: firenze, nome: 'Iper Firenze', coordinate: null },
      },
      {
        id: expect.any(String), idKit: superstore.idRuntime, riga: 'GROSSETO - Via Roma 1', localita: 'GROSSETO', indirizzo: null,
        regione: 'TOS', puntoVendita: { id: grosseto, nome: 'Superstore Grosseto', coordinate: { lat: 42.76, lon: 11.11 } },
      },
      {
        id: expect.any(String), idKit: superstore.idRuntime, riga: 'Modena - Via Emilia 2', localita: 'Modena', indirizzo: null,
        regione: 'EMR', puntoVendita: null,
      },
    ]);
    senzaDatiDiLavorazione(dettaglio);
    // Superadmin e Agenzia: tutte le GDO
    expect((await service.getPromozioneVolantini(superstore.idPromo, 'tutte')).kit).toHaveLength(2);
  });

  it('dettaglio della promozione: l\'id e\' testo, non sempre un UUID; il periodo viene dallo stato della promo', async () => {
    const gdo = await creaKitRuntime({ nomePromo: 'Altra promo' });
    const ambito = della(gdo);
    await sequelize.query(
      `INSERT INTO promo (id_promo, nome_promo, data_registrazione, validita_dal, validita_al, offset_visibilita, stato, gdo, createdat, updatedat)
       VALUES ('VOL-2026/45', 'Volantino 45 archiviato', NOW(), NOW() - INTERVAL '30 days', NOW() - INTERVAL '20 days', 0, 'ARCHIVIATA', :idGdo, NOW(), NOW())`,
      { replacements: { idGdo: gdo.idGdo } }
    );
    await creaKitRuntime({ promo: { idGdo: gdo.idGdo, idPromo: 'VOL-2026/45' }, titolo: 'SS TO 45' });

    const dettaglio = await service.getPromozioneVolantini('VOL-2026/45', ambito);

    expect(dettaglio).toMatchObject({ promo: { id: 'VOL-2026/45', nome: 'Volantino 45 archiviato' }, periodo: 'storico' });
    // Un kit senza referenze: zero box, nessun errore
    expect(dettaglio.kit).toEqual([expect.objectContaining({ titolo: 'SS TO 45', referenze: 0, box: 0, scontoMedio: null })]);
    expect(dettaglio.numeri).toMatchObject({ kit: 1, prodotti: 0, puntiVendita: 0 });
  });

  it('dettaglio della promozione: 404 per un\'altra GDO, una promo eliminata o senza kit volantino pubblicati', async () => {
    const nostra = await creaKitRuntime({ nomePromo: 'Nostra' });
    const ambito = della(nostra);
    const eliminata = await creaKitRuntime({ idGdo: nostra.idGdo, nomePromo: 'Eliminata', statoPromo: 'ELIMINATA' });
    const nonPubblicata = await creaKitRuntime({ idGdo: nostra.idGdo, nomePromo: 'In revisione', statoLavorazione: 'IN_REVISIONE' });
    const soloPop = await creaKitRuntime({ idGdo: nostra.idGdo, nomePromo: 'Solo POP', tipoLavorazione: 2 });
    const soloManuali = await creaKitRuntime({ idGdo: nostra.idGdo, nomePromo: 'Solo manuali', tipo: 'MANUALE' });
    const altrui = await creaKitRuntime({ nomePromo: 'Altrui' });

    expect((await service.getPromozioneVolantini(nostra.idPromo, ambito)).promo.nome).toBe('Nostra');
    for (const [idPromo, ambitoRichiesta] of [
      [nostra.idPromo, { idGdo: altrui.idGdo }],
      [nostra.idPromo, 'nessuna'],
      [altrui.idPromo, ambito],
      [eliminata.idPromo, ambito],
      [nonPubblicata.idPromo, ambito],
      [soloPop.idPromo, ambito],
      [soloManuali.idPromo, ambito],
      [randomUUID(), ambito],
      ['PROMO-CHE-NON-ESISTE', ambito],
      ['', ambito],
      ['   ', ambito],
      ['x'.repeat(300), ambito],
    ] as const) {
      await expect(service.getPromozioneVolantini(idPromo, ambitoRichiesta), `${idPromo.slice(0, 40)} ${JSON.stringify(ambitoRichiesta)}`)
        .rejects.toBeInstanceOf(NotFoundError);
    }
  });
});
