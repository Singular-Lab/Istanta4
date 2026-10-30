import { randomUUID } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { TIPO_LAVORAZIONE } from '../../../../lib/enums';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaFile, creaGdo, creaKitRuntime, creaTipoExport } from '../../../__tests__/integrazione/dati';
import { sequelize } from '../../db/SequelizeConnector';
import { MaterialiRepository } from '../../repositories/MaterialiRepository';
import { criteriDelPeriodo, MaterialiService } from '../MaterialiService';

// Volantini Attivi e Storico per promozione, su PostgreSQL: la pagina si taglia sulle promo, nella
// scheda restano i soli kit pubblicati che corrispondono ai filtri, l'anno e' quello del calendario
// italiano, e nello Storico aree e canali arrivano anche dalle combinazioni della GDO.
describeConDatabase('MaterialiService: volantini per promozione', () => {
  usaDatabase();
  const repository = new MaterialiRepository();
  const service = new MaterialiService(repository, { getAllKitPerGestioneLavorazione: vi.fn() }, { scriviZipDaOlimpo: vi.fn() });
  const giorno = (iso: string) => new Date(iso);

  beforeEach(async () => {
    await svuotaTabelle('gdo', 'promo', 'formati', 'tipi_export');
  });

  /** Area o canale con codice e nome, e la combinazione canale/area della GDO nello stato indicato. */
  async function creaCombinazione(idGdo: string, area: { codice: string; nome: string }, canale: { codice: string; nome: string }, stato: 'ATTIVO' | 'DISATTIVO') {
    const adesso = new Date();
    const idArea = randomUUID();
    const idCanale = randomUUID();
    await sequelize.query(
      `INSERT INTO aree (id_aree, codice_aree, nome_aree, id_gdo_aree, createdat, updatedat)
       VALUES (:idArea, :codiceArea, :nomeArea, :idGdo, :adesso, :adesso)`,
      { replacements: { idArea, codiceArea: area.codice, nomeArea: area.nome, idGdo, adesso } }
    );
    await sequelize.query(
      `INSERT INTO canali (id_canali, codice_canali, nome_canali, id_gdo_canali, createdat, updatedat)
       VALUES (:idCanale, :codiceCanale, :nomeCanale, :idGdo, :adesso, :adesso)`,
      { replacements: { idCanale, codiceCanale: canale.codice, nomeCanale: canale.nome, idGdo, adesso } }
    );
    await sequelize.query(
      `INSERT INTO combinazione_canale_area (id_combinazione_canale_area, id_gdo_combinazione_canale_area,
         id_canale_combinazione_canale_area, id_area_combinazione_canale_area, stato_combinazione_canale_area, createdat, updatedat)
       VALUES (:id, :idGdo, :idCanale, :idArea, :stato, :adesso, :adesso)`,
      { replacements: { id: randomUUID(), idGdo, idCanale, idArea, stato, adesso } }
    );
  }

  it('una scheda per promo, dalla validita piu recente, con i soli kit pubblicati dei formati volantino', async () => {
    const natale = await creaKitRuntime({ nomePromo: 'Natale', titolo: 'SS TO VOL', validitaDal: giorno('2025-12-01T00:00:00+01:00') });
    const promoNatale = { idGdo: natale.idGdo, idPromo: natale.idPromo };
    await creaKitRuntime({ promo: promoNatale, titolo: 'In revisione', statoLavorazione: 'IN_REVISIONE' });
    await creaKitRuntime({ promo: promoNatale, titolo: 'Espositore', tipoLavorazione: 2 });
    await creaKitRuntime({ promo: promoNatale, titolo: 'Manuale', tipo: 'MANUALE' });
    const sottocosto = await creaKitRuntime({ nomePromo: 'Sottocosto', validitaDal: giorno('2026-01-10T00:00:00+01:00') });
    const vol = await creaTipoExport('VOL');
    await creaFile({ nome: 'pagina-1.pdf', idRuntime: natale.idRuntime, tipoExport: vol, idOlimpoCloud: 'olimpo-1', mime: 'application/pdf' });
    await creaFile({ nome: 'pagina-2.pdf', idRuntime: natale.idRuntime, tipoExport: vol, idOlimpoCloud: 'olimpo-2', mime: 'application/pdf' });
    await creaFile({ nome: 'correggo.pdf', idRuntime: natale.idRuntime, tipoExportCodice: 'CORREGGO', idOlimpoCloud: 'olimpo-c' });
    // La lista dei punti vendita stampata nel volantino di Natale: due righe
    for (const [posizione, riga] of ['Firenze, via Roma 1', 'Prato, viale Italia 2'].entries()) {
      await sequelize.query(
        `INSERT INTO punti_vendita_volantino (id, id_gdo, id_kit_runtime, id_promo, posizione, riga)
         VALUES (:id, :idGdo, :idKit, :idPromo, :posizione, :riga)`,
        { replacements: { id: randomUUID(), idGdo: natale.idGdo, idKit: natale.idRuntime, idPromo: natale.idPromo, posizione, riga } }
      );
    }

    const pagina = await service.getPromozioniVolantini({ periodo: 'attivi' });

    expect(pagina.promozioni.map(p => p.promo.nome)).toEqual(['Sottocosto', 'Natale']);
    expect(pagina).toMatchObject({ totale: 2, totaleKit: 2, totaleSenzaFiltri: 2, pagina: 1, dimensione: 12 });
    const schedaNatale = pagina.promozioni[1];
    expect(schedaNatale).toMatchObject({
      promo: { id: natale.idPromo, stato: 'VALIDA', validitaDal: '2025-12-01' },
      numeroKit: 1,
      copertina: { idOlimpoCloud: 'olimpo-1', nome: 'pagina-1.pdf', mime: 'application/pdf' },
    });
    expect(schedaNatale.kit).toEqual([expect.objectContaining({
      id: natale.idRuntime,
      titolo: 'SS TO VOL',
      area: { id: natale.idArea, nome: 'Toscana' },
      canale: { id: natale.idCanale, nome: 'Superstore' },
      numeroFile: 2,
      numeroPuntiVendita: 2,
    })]);
    expect(pagina.promozioni[0].promo.id).toBe(sottocosto.idPromo);
    // Nessuna lista dei punti vendita arrivata per il volantino del Sottocosto
    expect(pagina.promozioni[0].kit[0].numeroPuntiVendita).toBe(0);
    expect(pagina.opzioni.promozioni.map(p => p.nome)).toEqual(['Sottocosto', 'Natale']);
  });

  it('la pagina si taglia sulle promo, non sui kit', async () => {
    const vecchia = await creaKitRuntime({ nomePromo: 'Vecchia', validitaDal: giorno('2025-03-01T00:00:00+01:00') });
    for (const titolo of ['Secondo', 'Terzo']) {
      await creaKitRuntime({ promo: { idGdo: vecchia.idGdo, idPromo: vecchia.idPromo }, titolo });
    }
    await creaKitRuntime({ nomePromo: 'Recente', validitaDal: giorno('2025-04-01T00:00:00+02:00') });
    const criteri = criteriDelPeriodo('attivi', TIPO_LAVORAZIONE.VOLANTINO);

    const prima = await repository.elencaPromoVolantini(criteri, {}, { limite: 1, scarto: 0 });
    const seconda = await repository.elencaPromoVolantini(criteri, {}, { limite: 1, scarto: 1 });
    const kitDellaSeconda = await repository.elencaVariantiVolantini(criteri, seconda.map(p => p.id_promo));

    expect(prima.map(p => p.nome_promo)).toEqual(['Recente']);
    expect(seconda.map(p => p.nome_promo)).toEqual(['Vecchia']);
    expect(kitDellaSeconda).toHaveLength(3);
    expect(await repository.contaPromoVolantini(criteri)).toEqual({ promozioni: 2, kit: 4 });
  });

  it('cerca: il nome della promo mostra tutti i suoi kit, il titolo solo i kit che lo contengono', async () => {
    const sottocosto = await creaKitRuntime({ nomePromo: 'Sottocosto ottobre', titolo: 'Superstore Toscana' });
    await creaKitRuntime({ promo: { idGdo: sottocosto.idGdo, idPromo: sottocosto.idPromo }, titolo: 'Ipermercati Lazio' });
    await creaKitRuntime({ nomePromo: 'Natale', titolo: 'Superstore Umbria' });

    const perTitolo = await service.getPromozioniVolantini({ periodo: 'attivi', cerca: 'superstore' });
    const perPromo = await service.getPromozioniVolantini({ periodo: 'attivi', cerca: 'SOTTOCOSTO' });

    expect(perTitolo).toMatchObject({ totale: 2, totaleKit: 2, totaleSenzaFiltri: 2 });
    const schedaSottocosto = perTitolo.promozioni.find(p => p.promo.id === sottocosto.idPromo);
    expect(schedaSottocosto?.kit.map(k => k.titolo)).toEqual(['Superstore Toscana']);
    expect(schedaSottocosto?.numeroKit).toBe(2);
    expect(perPromo).toMatchObject({ totale: 1, totaleKit: 2 });
    expect(perPromo.promozioni[0].kit.map(k => k.titolo).sort()).toEqual(['Ipermercati Lazio', 'Superstore Toscana']);
  });

  it('area e canale: compaiono le promo con un kit della combinazione, e nella scheda solo quei kit', async () => {
    const toscana = await creaKitRuntime({ nomePromo: 'Due aree', titolo: 'SS TO VOL' });
    await creaKitRuntime({ promo: { idGdo: toscana.idGdo, idPromo: toscana.idPromo }, titolo: 'SS LA VOL' });
    await creaKitRuntime({ nomePromo: 'Altra promo', titolo: 'SS UM VOL' });

    const perArea = await service.getPromozioniVolantini({ periodo: 'attivi', idArea: toscana.idArea });
    const perCanale = await service.getPromozioniVolantini({ periodo: 'attivi', idCanale: toscana.idCanale, idArea: toscana.idArea });

    expect(perArea.promozioni.map(p => [p.promo.nome, p.numeroKit, p.kit.map(k => k.titolo)])).toEqual([['Due aree', 2, ['SS TO VOL']]]);
    expect(perArea).toMatchObject({ totale: 1, totaleKit: 1, totaleSenzaFiltri: 2 });
    expect(perCanale.promozioni.map(p => p.kit.map(k => k.id))).toEqual([[toscana.idRuntime]]);
  });

  it('anno: l inizio di validita nel calendario italiano, e gli anni proposti sono quelli del periodo', async () => {
    // 31 dicembre alle 23:30 UTC: in Italia e' gia' il primo gennaio
    const capodanno = await creaKitRuntime({ statoPromo: 'ARCHIVIATA', nomePromo: 'Capodanno', validitaDal: giorno('2024-12-31T23:30:00Z') });
    const estate = await creaKitRuntime({ statoPromo: 'ARCHIVIATA', nomePromo: 'Estate', validitaDal: giorno('2024-06-01T00:00:00+02:00') });
    // Una promo valida non e' nello Storico: il suo anno non si propone
    await creaKitRuntime({ nomePromo: 'Valida', validitaDal: giorno('2022-05-01T00:00:00+02:00') });

    const del2025 = await service.getPromozioniVolantini({ periodo: 'storico', anno: 2025 });
    const del2024 = await service.getPromozioniVolantini({ periodo: 'storico', anno: 2024 });

    expect(del2025.promozioni.map(p => p.promo.id)).toEqual([capodanno.idPromo]);
    expect(del2024.promozioni.map(p => p.promo.id)).toEqual([estate.idPromo]);
    expect(del2024.opzioni.anni).toEqual([2025, 2024]);
    expect(del2024).toMatchObject({ totale: 1, totaleSenzaFiltri: 2 });
  });

  it('Storico: aree e canali anche dalle combinazioni della GDO, disattivate comprese, con il codice se manca il nome', async () => {
    const archiviata = await creaKitRuntime({ statoPromo: 'ARCHIVIATA' });
    await creaCombinazione(archiviata.idGdo, { codice: 'CE', nome: 'Centro' }, { codice: 'IP', nome: 'Iper' }, 'DISATTIVO');
    await creaCombinazione(archiviata.idGdo, { codice: 'SUD', nome: '' }, { codice: 'MK', nome: 'Market' }, 'ATTIVO');
    // Una GDO senza promo nello Storico: le sue combinazioni non si propongono
    await creaCombinazione(await creaGdo('Altra GDO'), { codice: 'ES', nome: 'Estero' }, { codice: 'EX', nome: 'Export' }, 'ATTIVO');
    // In Attivi bastano le aree e i canali dei kit
    await creaKitRuntime({ nomePromo: 'Valida' });

    const storico = await service.getPromozioniVolantini({ periodo: 'storico' });
    const attivi = await service.getPromozioniVolantini({ periodo: 'attivi' });

    expect(storico.opzioni.aree.map(a => a.nome)).toEqual(['Centro', 'SUD', 'Toscana']);
    expect(storico.opzioni.canali.map(c => c.nome)).toEqual(['Iper', 'Market', 'Superstore']);
    expect(storico.opzioni.promozioni).toEqual([]);
    expect(attivi.opzioni.aree.map(a => a.nome)).toEqual(['Toscana']);
    expect(attivi.opzioni.canali.map(c => c.nome)).toEqual(['Superstore']);
  });
});
