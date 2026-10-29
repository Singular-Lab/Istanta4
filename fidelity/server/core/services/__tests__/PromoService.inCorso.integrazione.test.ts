import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { STATO_PROMO } from '../../../../lib/enums';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaGdo, creaKitRuntime, type KitDiProva } from '../../../__tests__/integrazione/dati';
import type { IAgenziaLib } from '../../agenzia_lib/types';
import { sequelize } from '../../db/SequelizeConnector';
import type { PromoResponseDTO } from '../../dto';
import type { IConfigService } from '../../interfaces/IConfigService';
import type { IIstantaService } from '../../interfaces/IIstantaService';
import type { IWebPliantService } from '../../interfaces/IWebPliantService';
import { PromoRepository } from '../../repositories/PromoRepository';
import { PromoService } from '../PromoService';

// GET /api/promo/in-corso (T7): su PostgreSQL vero la risposta di getPromoInCorso e' quella
// attesa e quella del vecchio filtro in memoria su getAllPromo, con un numero di query che non
// cresce con le promo.

/** "Adesso" fisso: is_active, is_expired e i giorni dipendono dall'ora della richiesta. */
const ADESSO = new Date('2026-10-15T10:00:00Z');
const giorno = (data: string, ora = '00:00') => new Date(`${data}T${ora}:00Z`);

interface PromoDiProva {
  id: string;
  nome: string;
  stato: STATO_PROMO;
  registrata: Date;
  dal: Date;
  al: Date;
  scadenza: Date | null;
  offset: number;
  context: unknown;
  idGdo: string;
}

/** Promo scritta con un INSERT esplicito, compresi menabo_layout e meta che la risposta non usa. */
async function creaPromo(idGdo: string, dati: Partial<Omit<PromoDiProva, 'idGdo'>> & Pick<PromoDiProva, 'nome' | 'stato' | 'registrata'>): Promise<PromoDiProva> {
  const promo: PromoDiProva = {
    id: randomUUID(),
    dal: giorno('2026-10-05'),
    al: giorno('2026-10-20'),
    scadenza: giorno('2026-10-04'),
    offset: 0,
    context: [],
    ...dati,
    idGdo,
  };
  await sequelize.query(
    `INSERT INTO "promo" ("id_promo", "nome_promo", "data_registrazione", "validita_dal", "validita_al", "data_scadenza",
       "offset_visibilita", "stato", "context", "menabo_layout", "meta", "gdo", "createdat", "updatedat")
     VALUES (:id, :nome, :registrata, :dal, :al, :scadenza, :offset, :stato, :context, :menabo, :meta, :gdo, :registrata, :registrata)`,
    {
      replacements: {
        id: promo.id, nome: promo.nome, registrata: promo.registrata, dal: promo.dal, al: promo.al, scadenza: promo.scadenza,
        offset: promo.offset, stato: promo.stato, context: JSON.stringify(promo.context), gdo: idGdo,
        menabo: JSON.stringify({ divisioni: [{ nome: 'Pagina 1' }] }), meta: JSON.stringify({ nota: 'solo in Fidelity' }),
      },
    }
  );
  return promo;
}

/** Kit runtime della promo: il primo crea area, canale, formato e design, gli altri li riusano. */
async function aggiungiKit(promo: PromoDiProva, quanti: number): Promise<void> {
  const destinazione = { idGdo: promo.idGdo, idPromo: promo.id };
  const primo: KitDiProva = await creaKitRuntime({ promo: destinazione });
  for (let i = 1; i < quanti; i++) {
    await creaKitRuntime({ promo: destinazione, stessaCombinazioneDi: primo });
  }
}

async function creaTracciato(idPromo: string): Promise<void> {
  await sequelize.query(
    `INSERT INTO "tracciati" ("id_tracciati", "id_promo_tracciati", "context_tracciati", "filename_tracciati", "blobfile_tracciati", "createdat", "updatedat")
     VALUES (:id, :idPromo, :context, :nome, :blob, :adesso, :adesso)`,
    { replacements: { id: randomUUID(), idPromo, context: '{}', nome: 'tracciato.csv', blob: Buffer.from('codice;prezzo'), adesso: ADESSO } }
  );
}

/** La promo come la deve restituire l'elenco: campi e ordine delle chiavi della risposta. */
function attesa(
  promo: PromoDiProva,
  numeroKit: number,
  eliminabile: boolean,
  calcolati: { attiva: boolean; scaduta: boolean; giorniAllaScadenza: number; giorniDallInizio: number }
): PromoResponseDTO {
  return {
    id: promo.id,
    nome: promo.nome,
    data_registrazione: promo.registrata,
    validita_dal: promo.dal,
    validita_al: promo.al,
    data_scadenza: promo.scadenza as Date,
    offset_visibilita: promo.offset,
    stato: promo.stato,
    context: Array.isArray(promo.context) ? promo.context : [],
    gdo: promo.idGdo,
    is_active: calcolati.attiva,
    is_expired: calcolati.scaduta,
    days_until_expiry: calcolati.giorniAllaScadenza,
    days_since_start: calcolati.giorniDallInizio,
    is_deletable: eliminabile,
    numero_kit_collegati: numeroKit,
  };
}

/** Il vecchio GET /api/promo/in-corso: getAllPromo filtrato e ordinato in memoria nel controller. */
async function rispostaDiPrima(service: PromoService): Promise<PromoResponseDTO[]> {
  const promo = await service.getAllPromo();
  return promo
    .filter(p => p.stato !== STATO_PROMO.VALIDA && p.stato !== STATO_PROMO.VALIDA_CON_ERRORI && p.stato !== STATO_PROMO.ARCHIVIATA)
    .sort((a, b) => new Date(b.data_registrazione).getTime() - new Date(a.data_registrazione).getTime());
}

/** Le query SQL eseguite da `esegui`, nell'ordine in cui finiscono. */
async function conQuery<T>(esegui: () => Promise<T>): Promise<{ risultato: T; query: string[] }> {
  const query: string[] = [];
  const nome = `conta-query-${randomUUID()}`;
  sequelize.addHook('afterQuery', nome, (_opzioni, eseguita) => {
    query.push(String((eseguita as unknown as { sql?: string }).sql));
  });
  try {
    return { risultato: await esegui(), query };
  } finally {
    sequelize.removeHook('afterQuery', nome);
  }
}

describeConDatabase('PromoService.getPromoInCorso su PostgreSQL', () => {
  usaDatabase();
  const service = new PromoService(
    {} as IWebPliantService,
    {} as IIstantaService,
    new PromoRepository(),
    {} as IAgenziaLib,
    {} as IConfigService
  );

  beforeEach(async () => {
    await svuotaTabelle('gdo', 'promo', 'formati');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(ADESSO);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('restituisce le promo in corso, dalla piu recente, con kit, eliminabilita e campi calcolati', async () => {
    const idGdo = await creaGdo();
    const eliminata = await creaPromo(idGdo, {
      nome: 'Eliminata', stato: STATO_PROMO.ELIMINATA, registrata: giorno('2026-10-14', '08:00'),
      dal: giorno('2026-10-20'), al: giorno('2026-10-30'), scadenza: giorno('2026-10-19'),
    });
    const conTracciato = await creaPromo(idGdo, {
      nome: 'Pianificata con tracciato', stato: STATO_PROMO.PIANIFICATA, registrata: giorno('2026-10-12', '08:00'),
      dal: giorno('2026-10-17'), al: giorno('2026-10-23'), scadenza: giorno('2026-10-14'), offset: 2,
    });
    const conKit = await creaPromo(idGdo, {
      nome: 'In lavorazione con kit', stato: STATO_PROMO.IN_LAVORAZIONE, registrata: giorno('2026-10-10', '08:00'),
      context: [{ nome_field: 'canale', titolo_field: 'Canale', valore: 'SS' }],
    });
    const vuota = await creaPromo(idGdo, {
      nome: 'In ritardo senza kit', stato: STATO_PROMO.IN_RITARDO, registrata: giorno('2026-10-01', '08:00'),
      dal: giorno('2026-10-02'), al: giorno('2026-10-12'), scadenza: null, context: { non: 'un elenco' },
    });
    // Escluse dalla vista anche se piu' recenti di tutte
    const valida = await creaPromo(idGdo, { nome: 'Valida', stato: STATO_PROMO.VALIDA, registrata: giorno('2026-10-15', '09:00') });
    await creaPromo(idGdo, { nome: 'Valida con errori', stato: STATO_PROMO.VALIDA_CON_ERRORI, registrata: giorno('2026-10-15', '09:00') });
    await creaPromo(idGdo, { nome: 'Archiviata', stato: STATO_PROMO.ARCHIVIATA, registrata: giorno('2026-10-15', '09:00') });
    await creaTracciato(conTracciato.id);
    await aggiungiKit(conKit, 2);
    await aggiungiKit(valida, 1);

    const risposta = await service.getPromoInCorso();

    expect(risposta).toEqual([
      attesa(eliminata, 0, true, { attiva: false, scaduta: false, giorniAllaScadenza: 3, giorniDallInizio: -4 }),
      attesa(conTracciato, 0, false, { attiva: false, scaduta: false, giorniAllaScadenza: -1, giorniDallInizio: -1 }),
      attesa(conKit, 2, false, { attiva: true, scaduta: false, giorniAllaScadenza: -11, giorniDallInizio: 10 }),
      attesa(vuota, 0, true, { attiva: false, scaduta: true, giorniAllaScadenza: Number.NaN, giorniDallInizio: 13 }),
    ]);
    // Come la vecchia risposta, byte per byte: stessi campi, stesso ordine delle chiavi e delle promo
    expect(JSON.stringify(risposta)).toBe(JSON.stringify(await rispostaDiPrima(service)));
  });

  it('a parita di data di registrazione ordina per id della promo', async () => {
    const idGdo = await creaGdo();
    const stessaData = giorno('2026-10-10', '08:00');
    await creaPromo(idGdo, { id: 'promo-b', nome: 'B', stato: STATO_PROMO.IN_LAVORAZIONE, registrata: stessaData });
    await creaPromo(idGdo, { id: 'promo-a', nome: 'A', stato: STATO_PROMO.IN_SCADENZA, registrata: stessaData });
    await creaPromo(idGdo, { id: 'promo-c', nome: 'C', stato: STATO_PROMO.IN_ATTESA_DI_VALIDITA, registrata: giorno('2026-10-11', '08:00') });

    const risposta = await service.getPromoInCorso();

    expect(risposta.map(p => p.id)).toEqual(['promo-c', 'promo-a', 'promo-b']);
  });

  it('senza promo in corso risponde [] con una sola query', async () => {
    const idGdo = await creaGdo();
    await creaPromo(idGdo, { nome: 'Valida', stato: STATO_PROMO.VALIDA, registrata: giorno('2026-10-10') });

    const { risultato, query } = await conQuery(() => service.getPromoInCorso());

    expect(risultato).toEqual([]);
    expect(query).toHaveLength(1);
  });

  it('esegue sempre 3 query, qualunque sia il numero di promo; prima erano 1 + N + promo senza kit', async () => {
    const idGdo = await creaGdo();
    const prima = await creaPromo(idGdo, { nome: 'Promo 0', stato: STATO_PROMO.IN_LAVORAZIONE, registrata: giorno('2026-10-01', '08:00') });
    await aggiungiKit(prima, 1);
    await creaPromo(idGdo, { nome: 'Valida', stato: STATO_PROMO.VALIDA, registrata: giorno('2026-09-01', '08:00') });

    const conPoche = await conQuery(() => service.getPromoInCorso());

    for (let i = 1; i <= 6; i++) {
      const promo = await creaPromo(idGdo, { nome: `Promo ${i}`, stato: STATO_PROMO.IN_LAVORAZIONE, registrata: giorno(`2026-10-0${i + 1}`, '08:00') });
      if (i % 2 === 0) await aggiungiKit(promo, 2);
      else await creaTracciato(promo.id);
    }
    const conTante = await conQuery(() => service.getPromoInCorso());
    const diPrima = await conQuery(() => rispostaDiPrima(service));

    expect(conPoche.risultato).toHaveLength(1);
    expect(conTante.risultato).toHaveLength(7);
    expect(conPoche.query).toHaveLength(3);
    expect(conTante.query).toHaveLength(3);
    // Le promo filtrate e ordinate in SQL, senza le colonne che la risposta non usa
    const [promo, ...conteggi] = conTante.query;
    expect(promo).toMatch(/FROM "promo"/);
    expect(promo).toMatch(/NOT IN/);
    expect(promo).toMatch(/ORDER BY/);
    expect(promo).not.toMatch(/menabo_layout|"meta"/);
    // Kit e tracciati contati per promo, in parallelo: l'ordine di arrivo non conta
    expect(conteggi.map(q => (/FROM "(\w+)"/.exec(q) ?? [])[1]).sort()).toEqual(['runtime_kit', 'tracciati']);
    expect(conteggi.every(q => /count\(/i.test(q) && /GROUP BY/.test(q))).toBe(true);
    // Prima: tutte le 8 promo, i kit di ognuna, i tracciati delle 4 senza kit (la valida e le 3 con il solo tracciato)
    expect(diPrima.query).toHaveLength(1 + 8 + 4);
    expect(JSON.stringify(conTante.risultato)).toBe(JSON.stringify(diPrima.risultato));
  });
});
