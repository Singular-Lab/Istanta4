import { randomUUID } from 'node:crypto';
import { beforeEach, expect, it } from 'vitest';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaGdo, creaKitRuntime } from '../../../__tests__/integrazione/dati';
import { sequelize } from '../../db/SequelizeConnector';
import { idPezzo } from '../../../../lib/areeCanali/proxy';
import { anagraficaAreeCanali, caricaProxy, combinazioneConProxy, contestoPezzi, kitDellaPromo, NESSUN_PEZZO, trovaPezzo } from '../areeCanaliProxy';

/** Canale o area, con i membri se e' un proxy (migrazione 0022). */
async function voce(tabella: 'canali' | 'aree', idGdo: string, codice: string, nome: string, membri: string[] = []): Promise<string> {
  const id = randomUUID();
  const s = tabella === 'canali' ? 'canali' : 'aree';
  await sequelize.query(
    `INSERT INTO ${tabella} (id_${s}, codice_${s}, nome_${s}, id_gdo_${s}, membri_${s}, createdat, updatedat)
     VALUES (:id, :codice, :nome, :idGdo, CAST(:membri AS uuid[]), now(), now())`,
    { replacements: { id, codice, nome, idGdo, membri: `{${membri.join(',')}}` } }
  );
  return id;
}

async function combinazione(idGdo: string, idCanale: string, idArea: string, stato = 'ATTIVO'): Promise<string> {
  const id = randomUUID();
  await sequelize.query(
    `INSERT INTO combinazione_canale_area (id_combinazione_canale_area, id_gdo_combinazione_canale_area,
       id_canale_combinazione_canale_area, id_area_combinazione_canale_area, stato_combinazione_canale_area, createdat, updatedat)
     VALUES (:id, :idGdo, :idCanale, :idArea, :stato, now(), now())`,
    { replacements: { id, idGdo, idCanale, idArea, stato } }
  );
  return id;
}

// Canali e aree proxy su PostgreSQL: la pagina Aree e canali legge solo la propria GDO, i proxy si
// riconoscono dai membri e Istanta non vede le combinazioni che li usano.
describeConDatabase('areeCanaliProxy: anagrafica della GDO e proxy', () => {
  usaDatabase();

  beforeEach(async () => {
    await svuotaTabelle('gdo', 'canali', 'aree', 'combinazione_canale_area', 'promo', 'formati', 'design_kit', 'runtime_kit');
  });

  it("l'anagrafica ha solo aree, canali e combinazioni della GDO, con membri e combinazioni proxy segnate", async () => {
    const idGdo = await creaGdo('Conad');
    const altra = await creaGdo('Altra');
    const ss = await voce('canali', idGdo, 'SS', 'Superstore');
    const cn = await voce('canali', idGdo, 'CN', 'Conad');
    const sscn = await voce('canali', idGdo, 'SSCN', 'Superstore + Conad', [ss, cn]);
    const la = await voce('aree', idGdo, 'LA', 'Lazio');
    await voce('canali', altra, 'XX', 'Di un altro cliente');
    const normale = await combinazione(idGdo, ss, la);
    const proxy = await combinazione(idGdo, sscn, la, 'DISATTIVO');

    const anagrafica = await anagraficaAreeCanali({ idGdo });

    expect(anagrafica.canali.map(c => [c.codice, c.membri])).toEqual([
      ['CN', []],
      ['SS', []],
      ['SSCN', [ss, cn]],
    ]);
    expect(anagrafica.aree.map(a => a.codice)).toEqual(['LA']);
    expect(anagrafica.combinazioni.map(c => [c.id, c.sigla, c.canale_nome, c.area_nome, c.stato, c.proxy])).toEqual(
      expect.arrayContaining([
        [normale, 'SS_LA', 'Superstore', 'Lazio', 'ATTIVO', false],
        [proxy, 'SSCN_LA', 'Superstore + Conad', 'Lazio', 'DISATTIVO', true],
      ])
    );
    expect(await anagraficaAreeCanali('nessuna')).toEqual({ aree: [], canali: [], combinazioni: [] });
    expect((await anagraficaAreeCanali('tutte')).canali).toHaveLength(4);
  });

  it('i proxy si riconoscono dai membri, anche dentro una combinazione', async () => {
    const idGdo = await creaGdo();
    const to = await voce('aree', idGdo, 'TO', 'Toscana');
    const li = await voce('aree', idGdo, 'LI', 'Liguria');
    const toli = await voce('aree', idGdo, 'TOLI', 'Toscana + Liguria', [to, li]);
    const ss = await voce('canali', idGdo, 'SS', 'Superstore');

    expect(await caricaProxy()).toEqual({ canali: new Map(), aree: new Map([[toli, [to, li]]]) });
    expect(await combinazioneConProxy(await combinazione(idGdo, ss, toli))).toBe(true);
    expect(await combinazioneConProxy(await combinazione(idGdo, ss, to))).toBe(false);
    expect(await combinazioneConProxy(randomUUID())).toBe(false);
  });

  it('i kit della promo per il confronto con Istanta escludono quelli eliminati', async () => {
    const vivo = await creaKitRuntime({ titolo: 'VOL SS LA', statoLavorazione: 'IN_LAVORAZIONE' });
    await creaKitRuntime({ promo: vivo, stessaCombinazioneDi: vivo, statoLavorazione: 'ELIMINATO' });

    const kit = await kitDellaPromo(vivo.idPromo);

    expect(kit).toEqual([{
      guidId: vivo.idRuntime, guidIdDesign: vivo.idDesign, titolo: 'VOL SS LA', guidIdRaccoglitore: vivo.idRaccoglitore,
      guidFormato: vivo.idFormato, guidCanale: vivo.idCanale, guidArea: vivo.idArea, pezzo: false,
    }]);
  });

  it('un design su un canale proxy ha i suoi pezzi: si ritrovano dall\'id, e i loro runtime sono segnati', async () => {
    expect(await contestoPezzi()).toBe(NESSUN_PEZZO);
    // Il design del kit sta sul canale SS, che qui diventa il proxy di Conad e City
    const kit = await creaKitRuntime({ titolo: 'RIL', statoLavorazione: 'IN_LAVORAZIONE' });
    const cn = await voce('canali', kit.idGdo, 'CN', 'Conad');
    const cy = await voce('canali', kit.idGdo, 'CY', 'City');
    await sequelize.query('UPDATE canali SET membri_canali = CAST(:membri AS uuid[]) WHERE id_canali = :id', {
      replacements: { id: kit.idCanale, membri: `{${cn},${cy}}` },
    });
    await combinazione(kit.idGdo, cn, kit.idArea);
    await combinazione(kit.idGdo, cy, kit.idArea, 'DISATTIVO');

    const contesto = await contestoPezzi();
    expect([...contesto.proxy.canali]).toEqual([[kit.idCanale, [cn, cy]]]);
    expect(contesto.attive.has(`${cn}|${kit.idArea}`)).toBe(true);
    expect(contesto.attive.has(`${cy}|${kit.idArea}`)).toBe(false);
    expect(contesto.canali.get(cn)).toEqual({ codice: 'CN', nome: 'Conad' });
    expect(contesto.aree.get(kit.idArea)).toEqual({ codice: 'TO', nome: 'Toscana' });

    // Anche il pezzo di una combinazione disattivata si ritrova: Istanta puo' averlo gia' ricevuto
    expect(await trovaPezzo(idPezzo(kit.idDesign, cy, kit.idArea))).toEqual({ idDesign: kit.idDesign, idCanale: cy, idArea: kit.idArea });
    expect(await trovaPezzo(idPezzo(kit.idDesign, cn, kit.idArea))).toEqual({ idDesign: kit.idDesign, idCanale: cn, idArea: kit.idArea });
    expect(await trovaPezzo(randomUUID())).toBeNull();
    expect(await trovaPezzo(kit.idDesign)).toBeNull();

    expect((await kitDellaPromo(kit.idPromo)).map(k => k.pezzo)).toEqual([true]);
  });
});
