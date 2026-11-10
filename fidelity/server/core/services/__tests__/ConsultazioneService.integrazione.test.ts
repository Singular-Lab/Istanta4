import { randomUUID } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { BadRequestError, NotFoundError, ServiceUnavailableError } from '../../../../lib/errors';
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
    indirizzo?: string;
    regione?: string;
    provincia?: string;
    idPuntoVendita?: string;
  }>): Promise<void> {
    for (const [indice, dati] of righe.entries()) {
      await sequelize.query(
        `INSERT INTO punti_vendita_volantino (id, id_gdo, id_kit_runtime, id_promo, posizione, riga, localita, indirizzo, regione, provincia, id_punto_vendita)
         VALUES (:id, :idGdo, :idKit, :idPromo, :posizione, :riga, :localita, :indirizzo, :regione, :provincia, :idPuntoVendita)`,
        {
          replacements: {
            id: randomUUID(), idGdo: kit.idGdo, idKit: kit.idRuntime, idPromo: kit.idPromo, posizione: indice + 1, riga: dati.riga,
            localita: dati.localita ?? null, indirizzo: dati.indirizzo ?? null, regione: dati.regione ?? null, provincia: dati.provincia ?? null,
            idPuntoVendita: dati.idPuntoVendita ?? null,
          },
        }
      );
    }
  }

  /**
   * N righe qualunque nella lista del kit, ciascuna di un punto vendita diverso da tutti gli altri:
   * per la vetrina conta solo quanti sono. Righe uguali sarebbero lo stesso punto vendita.
   */
  const righeQualunque = (numero: number) => {
    const lista = randomUUID().slice(0, 8);
    return Array.from({ length: numero }, (_, indice) => ({ riga: `PV ${lista} ${indice + 1}` }));
  };

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

    // Lo Storico non ha la vetrina: l'unica promo della GDO e' fra le schede, quella dell'altra GDO da nessuna parte
    expect(pagina.vetrina).toBeNull();
    expect(pagina.promozioni.map(p => p.promo.nome)).toEqual(['Nostra']);
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

  it('vetrina degli Attivi: la promo con piu\' punti vendita nei volantini pubblicati, a parita\' la validita\' piu\' recente', async () => {
    const ottobre = await creaKitRuntime({ nomePromo: 'Ottobre', titolo: 'SS TO 40', validitaDal: giorno('2026-10-01T00:00:00+02:00') });
    const ambito = della(ottobre);
    await creaRighePuntiVendita(ottobre, righeQualunque(3));
    // Tre punti vendita anche qui, su due volantini, e la validita' piu' recente: e' lei in vetrina
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
    expect(pagina.vetrina?.promozione).toMatchObject({ promo: { nome: 'Metà ottobre' }, numeroKit: 2, numeroPuntiVendita: 3 });
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

  it('vetrina dei Prossimi: l\'inizio di validita\' piu\' vicino; lo Storico non ha la vetrina; periodo vuoto senza vetrina', async () => {
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

    // Nello Storico nessuna vetrina, neppure senza filtri: tutte le promo concluse fra le schede
    const storico = await service.getPromozioniVolantini({ periodo: 'storico' }, ambito);
    expect(storico.vetrina).toBeNull();
    expect(storico.promozioni.map(p => p.promo.nome)).toEqual(['Settembre', 'Agosto']);
    expect(storico).toMatchObject({ totale: 2, totaleKit: 2, totaleSenzaFiltri: 2 });

    const attivi = await service.getPromozioniVolantini({ periodo: 'attivi' }, ambito);
    expect(attivi).toMatchObject({ vetrina: null, promozioni: [], totale: 0, totaleSenzaFiltri: 0 });
    expect(attivi.riepilogo).toEqual({ promozioni: 0, kit: 0, puntiVendita: 0 });
  });

  /** Una combinazione canale/area della GDO, con area e canale suoi, senza nessun volantino. */
  async function creaCombinazioneSenzaVolantini(idGdo: string): Promise<{ idArea: string; idCanale: string }> {
    const idArea = randomUUID();
    const idCanale = randomUUID();
    await sequelize.query(
      `INSERT INTO aree (id_aree, codice_aree, nome_aree, id_gdo_aree, createdat, updatedat) VALUES (:idArea, 'CE', 'Centro', :idGdo, NOW(), NOW())`,
      { replacements: { idArea, idGdo } }
    );
    await sequelize.query(
      `INSERT INTO canali (id_canali, codice_canali, nome_canali, id_gdo_canali, createdat, updatedat) VALUES (:idCanale, 'IP', 'Iper', :idGdo, NOW(), NOW())`,
      { replacements: { idCanale, idGdo } }
    );
    await sequelize.query(
      `INSERT INTO combinazione_canale_area (id_combinazione_canale_area, id_gdo_combinazione_canale_area, id_canale_combinazione_canale_area,
         id_area_combinazione_canale_area, stato_combinazione_canale_area, createdat, updatedat)
       VALUES (:id, :idGdo, :idCanale, :idArea, 'DISATTIVO', NOW(), NOW())`,
      { replacements: { id: randomUUID(), idGdo, idCanale, idArea } }
    );
    return { idArea, idCanale };
  }

  const idDi = (voci: Array<{ id: string }>) => voci.map(voce => voce.id).sort();

  it('Storico: aree e canali dei soli volantini pubblicati, mai delle combinazioni della GDO senza volantini', async () => {
    const archiviata = await creaKitRuntime({ statoPromo: 'ARCHIVIATA', nomePromo: 'Conclusa' });
    const ambito = della(archiviata);
    const senzaVolantini = await creaCombinazioneSenzaVolantini(archiviata.idGdo);
    // Un kit non pubblicato di un'altra promo conclusa: area e canale suoi non si propongono
    const inRevisione = await creaKitRuntime({ idGdo: archiviata.idGdo, statoPromo: 'ARCHIVIATA', statoLavorazione: 'IN_REVISIONE' });

    const storico = await service.getPromozioniVolantini({ periodo: 'storico' }, ambito);

    expect(idDi(storico.opzioni.aree)).toEqual([archiviata.idArea]);
    expect(idDi(storico.opzioni.canali)).toEqual([archiviata.idCanale]);
    for (const id of [senzaVolantini.idArea, senzaVolantini.idCanale, inRevisione.idArea, inRevisione.idCanale]) {
      expect(JSON.stringify(storico.opzioni)).not.toContain(id);
    }
  });

  it('filtri incrociati: aree, canali e anni dei volantini che corrispondono agli altri filtri, non al proprio', async () => {
    const del2024 = await creaKitRuntime({
      statoPromo: 'ARCHIVIATA', nomePromo: 'Settembre 2024',
      validitaDal: giorno('2024-09-01T00:00:00+02:00'), validitaAl: giorno('2024-09-14T00:00:00+02:00'),
    });
    const ambito = della(del2024);
    const del2022 = await creaKitRuntime({
      idGdo: del2024.idGdo, statoPromo: 'ARCHIVIATA', nomePromo: 'Marzo 2022',
      validitaDal: giorno('2022-03-01T00:00:00+01:00'), validitaAl: giorno('2022-03-14T00:00:00+01:00'),
    });
    const storico = (filtri: { idArea?: string; idCanale?: string; anno?: number; cerca?: string }) =>
      service.getPromozioniVolantini({ periodo: 'storico', ...filtri }, ambito);

    // Scelto il 2024: aree e canali dei soli volantini del 2024; gli anni restano tutti
    const perAnno = await storico({ anno: 2024 });
    expect(idDi(perAnno.opzioni.aree)).toEqual([del2024.idArea]);
    expect(idDi(perAnno.opzioni.canali)).toEqual([del2024.idCanale]);
    expect(perAnno.opzioni.anni).toEqual([2024, 2022]);

    // Scelta un'area: le aree restano tutte, canali e anni sono quelli dell'area
    const perArea = await storico({ idArea: del2022.idArea });
    expect(idDi(perArea.opzioni.aree)).toEqual([del2024.idArea, del2022.idArea].sort());
    expect(idDi(perArea.opzioni.canali)).toEqual([del2022.idCanale]);
    expect(perArea.opzioni.anni).toEqual([2022]);

    // Scelto un canale: i canali restano tutti, aree e anni sono quelli del canale
    const perCanale = await storico({ idCanale: del2024.idCanale });
    expect(idDi(perCanale.opzioni.canali)).toEqual([del2024.idCanale, del2022.idCanale].sort());
    expect(idDi(perCanale.opzioni.aree)).toEqual([del2024.idArea]);
    expect(perCanale.opzioni.anni).toEqual([2024]);

    // Anche la ricerca restringe le opzioni
    const cercate = await storico({ cerca: 'marzo' });
    expect(idDi(cercate.opzioni.aree)).toEqual([del2022.idArea]);
    expect(cercate.opzioni.anni).toEqual([2022]);

    // Area e canale senza volantini insieme: nessuna promo, e ogni filtro propone cio' che l'altro lascia
    const incompatibili = await storico({ idArea: del2022.idArea, idCanale: del2024.idCanale });
    expect(incompatibili).toMatchObject({ promozioni: [], totale: 0, totaleSenzaFiltri: 2 });
    expect(idDi(incompatibili.opzioni.aree)).toEqual([del2024.idArea]);
    expect(idDi(incompatibili.opzioni.canali)).toEqual([del2022.idCanale]);
    expect(incompatibili.opzioni.anni).toEqual([]);
  });

  it('filtri incrociati anche negli Attivi', async () => {
    const prima = await creaKitRuntime({ nomePromo: 'Prima' });
    const ambito = della(prima);
    const seconda = await creaKitRuntime({ idGdo: prima.idGdo, nomePromo: 'Seconda' });

    const tutte = await service.getPromozioniVolantini({ periodo: 'attivi' }, ambito);
    expect(idDi(tutte.opzioni.aree)).toEqual([prima.idArea, seconda.idArea].sort());

    const perCanale = await service.getPromozioniVolantini({ periodo: 'attivi', idCanale: seconda.idCanale }, ambito);
    expect(idDi(perCanale.opzioni.aree)).toEqual([seconda.idArea]);
    expect(idDi(perCanale.opzioni.canali)).toEqual([prima.idCanale, seconda.idCanale].sort());

    const perPromo = await service.getPromozioniVolantini({ periodo: 'attivi', idPromo: prima.idPromo }, ambito);
    expect(idDi(perPromo.opzioni.aree)).toEqual([prima.idArea]);
    expect(idDi(perPromo.opzioni.canali)).toEqual([prima.idCanale]);
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
        id: expect.any(String), idKit: [ipermercati.idRuntime], riga: 'Firenze - Viale Italia 3', localita: 'FIRENZE', indirizzo: null,
        // Ne' regione ne' provincia stampate: la regione dell'anagrafica
        regione: 'TOS', puntoVendita: { id: firenze, nome: 'Iper Firenze', coordinate: null },
      },
      {
        id: expect.any(String), idKit: [superstore.idRuntime], riga: 'GROSSETO - Via Roma 1', localita: 'GROSSETO', indirizzo: null,
        regione: 'TOS', puntoVendita: { id: grosseto, nome: 'Superstore Grosseto', coordinate: { lat: 42.76, lon: 11.11 } },
      },
      {
        id: expect.any(String), idKit: [superstore.idRuntime], riga: 'Modena - Via Emilia 2', localita: 'Modena', indirizzo: null,
        regione: 'EMR', puntoVendita: null,
      },
    ]);
    senzaDatiDiLavorazione(dettaglio);
    // Superadmin e Agenzia: tutte le GDO
    expect((await service.getPromozioneVolantini(superstore.idPromo, 'tutte')).kit).toHaveLength(2);
  });

  it('un punto vendita stampato in piu\' volantini conta una volta: nei kit, nella scheda, nella vetrina, nel riepilogo e nel dettaglio', async () => {
    // Il caso di A2623: i volantini Emilia e Liguria stampano la stessa lista, con maiuscole e spazi diversi
    const emilia = await creaKitRuntime({ nomePromo: 'Sottocosto', titolo: 'CY EM' });
    const ambito = della(emilia);
    const liguria = await creaKitRuntime({ promo: { idGdo: emilia.idGdo, idPromo: emilia.idPromo }, titolo: 'CY LI' });
    await creaRighePuntiVendita(emilia, [
      { riga: 'AREZZO - VIA CHIARINI 23/A', localita: 'AREZZO', indirizzo: 'VIA CHIARINI 23/A', regione: 'TOSCANA' },
      { riga: 'BARGA - VIA CANIPAIA', localita: 'BARGA', indirizzo: 'VIA CANIPAIA', regione: 'TOSCANA' },
    ]);
    await creaRighePuntiVendita(liguria, [
      { riga: 'Arezzo - Via Chiarini 23/A - tel. 0575 1', localita: ' Arezzo ', indirizzo: 'Via  Chiarini\t23/A', regione: 'TOSCANA' },
      { riga: 'BARGA - VIA CANIPAIA', localita: 'BARGA', indirizzo: 'VIA CANIPAIA', regione: 'TOSCANA' },
      { riga: 'LA SPEZIA - Via Roma 1', localita: 'LA SPEZIA', indirizzo: 'Via Roma 1', regione: 'LIGURIA' },
      // Senza indirizzo letto vale la riga intera: non diventa uno con Barga
      { riga: 'BARGA - Piazza Garibaldi', localita: 'BARGA' },
    ]);
    // Meno righe del Sottocosto (5 contro 6) ma piu' punti vendita diversi (5 contro 4): e' lei in vetrina
    const volantone = await creaKitRuntime({ idGdo: emilia.idGdo, nomePromo: 'Volantone', titolo: 'SS TO' });
    await creaRighePuntiVendita(volantone, righeQualunque(5));

    const pagina = await service.getPromozioniVolantini({ periodo: 'attivi' }, ambito);

    expect(pagina.vetrina?.promozione).toMatchObject({ promo: { nome: 'Volantone' }, numeroPuntiVendita: 5 });
    expect(pagina.promozioni).toEqual([expect.objectContaining({ promo: expect.objectContaining({ nome: 'Sottocosto' }), numeroPuntiVendita: 4 })]);
    expect(pagina.promozioni[0].kit.map(kit => [kit.titolo, kit.numeroPuntiVendita])).toEqual([['CY EM', 2], ['CY LI', 4]]);
    expect(pagina.riepilogo).toEqual({ promozioni: 2, kit: 3, puntiVendita: 9 });

    // Con un filtro la scheda conta solo i kit mostrati
    const soloEmilia = await service.getPromozioniVolantini({ periodo: 'attivi', idArea: emilia.idArea }, ambito);
    expect(soloEmilia.promozioni).toEqual([expect.objectContaining({ numeroKit: 2, numeroPuntiVendita: 2 })]);
    const soloLiguria = await service.getPromozioniVolantini({ periodo: 'attivi', idArea: liguria.idArea }, ambito);
    expect(soloLiguria.promozioni).toEqual([expect.objectContaining({ numeroKit: 2, numeroPuntiVendita: 4 })]);

    // Il dettaglio (regola in TypeScript) dice gli stessi numeri della scheda (regola in SQL)
    const dettaglio = await service.getPromozioneVolantini(emilia.idPromo, ambito);
    expect(dettaglio.numeri).toMatchObject({ puntiVendita: 4, localita: 3, regioni: 2 });
    expect(dettaglio.puntiVendita.map(pv => [pv.localita, pv.indirizzo, pv.idKit])).toEqual([
      ['AREZZO', 'VIA CHIARINI 23/A', [emilia.idRuntime, liguria.idRuntime]],
      ['BARGA', 'VIA CANIPAIA', [emilia.idRuntime, liguria.idRuntime]],
      ['LA SPEZIA', 'Via Roma 1', [liguria.idRuntime]],
      ['BARGA', null, [liguria.idRuntime]],
    ]);
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

  /**
   * Una promo con tre kit: A (insegna 1, area 1), B (insegna 2, area 2) e C (insegna 1, area 2).
   * A e C stampano lo stesso punto vendita di Lucca.
   */
  async function promoConTreKit() {
    const a = await creaKitRuntime({ nomePromo: 'Filtrata', titolo: 'A' });
    const promo = { idGdo: a.idGdo, idPromo: a.idPromo };
    const b = await creaKitRuntime({ promo, titolo: 'B' });
    const c = await creaKitRuntime({ promo, stessaCombinazioneDi: a, titolo: 'C' });
    await sequelize.query('UPDATE runtime_kit SET id_area = :idArea WHERE id = :idKit', { replacements: { idArea: b.idArea, idKit: c.idRuntime } });
    await creaRighePuntiVendita(a, [{ riga: 'Lucca 1', localita: 'Lucca', indirizzo: 'Via Roma 1' }, { riga: 'Pisa 2', localita: 'Pisa', indirizzo: 'Via Pia 2' }]);
    await creaRighePuntiVendita(c, [{ riga: 'LUCCA 1', localita: 'LUCCA', indirizzo: 'via roma 1' }, { riga: 'Siena 3', localita: 'Siena', indirizzo: 'Via Sena 3' }]);
    await creaRighePuntiVendita(b, [{ riga: 'Roma 4', localita: 'Roma', indirizzo: 'Via Appia 4' }]);
    return { a, b, c, ambito: della(a), idPromo: a.idPromo };
  }

  it('dettaglio della promozione: i filtri per insegna e area contano solo i loro kit; opzioni incrociate, totale e insegne della promo', async () => {
    const { a, b, c, ambito, idPromo } = await promoConTreKit();
    const kitDi = (dettaglio: { kit: Array<{ id: string }> }) => dettaglio.kit.map(k => k.id).sort();

    const tutta = await service.getPromozioneVolantini(idPromo, ambito);
    expect(kitDi(tutta)).toEqual([a.idRuntime, b.idRuntime, c.idRuntime].sort());
    expect(tutta).toMatchObject({ numeroKitTotale: 3, numeri: { kit: 3, puntiVendita: 4 } });
    expect(idDi(tutta.insegne)).toEqual([a.idCanale, b.idCanale].sort());
    expect(idDi(tutta.opzioni.insegne)).toEqual([a.idCanale, b.idCanale].sort());
    expect(idDi(tutta.opzioni.aree)).toEqual([a.idArea, b.idArea].sort());
    // La configurazione del database di prova non ha loghi
    expect(tutta.loghiInsegne).toEqual({});

    // Insegna 1: i kit A e C, il punto vendita di Lucca stampato da entrambi conta una volta
    const perInsegna = await service.getPromozioneVolantini(idPromo, ambito, { idCanale: a.idCanale });
    expect(kitDi(perInsegna)).toEqual([a.idRuntime, c.idRuntime].sort());
    expect(perInsegna).toMatchObject({ numeroKitTotale: 3, numeri: { kit: 2, puntiVendita: 3 } });
    expect(perInsegna.puntiVendita.map(pv => pv.localita?.toLowerCase()).sort()).toEqual(['lucca', 'pisa', 'siena']);
    expect(perInsegna.assortimento.meccanichePerCanale.every(voce => voce.canale.id === a.idCanale)).toBe(true);
    // Le insegne non dipendono dal filtro sull'insegna; le aree sono quelle dell'insegna 1
    expect(idDi(perInsegna.opzioni.insegne)).toEqual([a.idCanale, b.idCanale].sort());
    expect(idDi(perInsegna.opzioni.aree)).toEqual([a.idArea, b.idArea].sort());
    expect(idDi(perInsegna.insegne)).toEqual([a.idCanale, b.idCanale].sort());

    // Area 1: solo il kit A; fra le insegne solo quella che ha kit nell'area 1
    const perArea = await service.getPromozioneVolantini(idPromo, ambito, { idArea: a.idArea });
    expect(kitDi(perArea)).toEqual([a.idRuntime]);
    expect(idDi(perArea.opzioni.insegne)).toEqual([a.idCanale]);
    expect(idDi(perArea.opzioni.aree)).toEqual([a.idArea, b.idArea].sort());

    // Insegna 2 e area 1 non hanno kit insieme: la promo c'e', senza kit, e i valori scelti restano fra le opzioni
    const incompatibili = await service.getPromozioneVolantini(idPromo, ambito, { idCanale: b.idCanale, idArea: a.idArea });
    expect(incompatibili).toMatchObject({ kit: [], puntiVendita: [], numeroKitTotale: 3, numeri: { kit: 0, puntiVendita: 0, prodotti: 0 } });
    expect(idDi(incompatibili.opzioni.insegne)).toEqual([a.idCanale, b.idCanale].sort());
    expect(idDi(incompatibili.opzioni.aree)).toEqual([a.idArea, b.idArea].sort());
  });

  it('dettaglio della promozione: un filtro che non e\' un UUID e\' rifiutato; una promo di un\'altra GDO resta non trovata anche con i filtri', async () => {
    const { a, idPromo, ambito } = await promoConTreKit();
    const altra = await creaKitRuntime({ nomePromo: 'Altrui' });

    await expect(service.getPromozioneVolantini(idPromo, ambito, { idArea: 'toscana' })).rejects.toBeInstanceOf(BadRequestError);
    await expect(service.getPromozioneVolantini(altra.idPromo, ambito, { idCanale: a.idCanale })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('dettaglio della promozione: il logo di ogni insegna dalle Impostazioni GDO, prima quello della sola insegna; mai il base64', async () => {
    const { a, b, ambito, idPromo } = await promoConTreKit();
    const conLoghi = (fonte: () => Promise<unknown>) =>
      new ConsultazioneService(new MaterialiRepository(), new ConsultazioneRepository(), scrittoreZip, lettore, async () => [], undefined, undefined, undefined, fonte);

    const loghi = [
      { url: 'https://olimpo/logo-1-area', idCanale: a.idCanale, idArea: a.idArea },
      // L'id con le maiuscole: e' lo stesso canale
      { url: 'https://olimpo/logo-1', idCanale: a.idCanale.toUpperCase(), idArea: '', idPv: '' },
      { url: '', base64: 'iVBORw0KGgo=', idCanale: b.idCanale },
      { url: 'https://olimpo/logo-2-pv', idCanale: b.idCanale, idPv: randomUUID() },
      { url: 'https://olimpo/logo-altra-insegna', idCanale: randomUUID() },
      null,
      'non e un logo',
    ];
    const dettaglio = await conLoghi(async () => loghi).getPromozioneVolantini(idPromo, ambito, { idArea: a.idArea });
    // Anche l'insegna esclusa dal filtro ha il suo logo: le insegne della banda e delle tendine lo mostrano
    expect(dettaglio.loghiInsegne).toEqual({ [a.idCanale]: 'https://olimpo/logo-1', [b.idCanale]: 'https://olimpo/logo-2-pv' });

    // Una configurazione che non si legge non ferma la pagina: niente loghi
    const senza = await conLoghi(async () => { throw new Error('config illeggibile'); }).getPromozioneVolantini(idPromo, ambito);
    expect(senza.loghiInsegne).toEqual({});
    expect(senza.kit).toHaveLength(3);
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
