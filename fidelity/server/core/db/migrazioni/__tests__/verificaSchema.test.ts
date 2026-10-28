import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../SequelizeConnector', () => ({ sequelize: { query: mocks.query } }));
vi.mock('../../../logger', () => ({ log: mocks.log }));

import type { DescrizioneSchema } from '../schemaModelli';
import { Catalogo, confrontaSchema, leggiCatalogo, leggiSchemaAtteso, segnalaDifferenzeSchema } from '../verificaSchema';

const colonna = (tipo: string, nullable = true) => ({
  tipo, nullable, default: null, chiavePrimaria: false, autoIncremento: false, unico: false, riferimento: null,
});

const ATTESO: DescrizioneSchema = {
  formato: 1,
  tabelle: {
    gdo: {
      colonne: { id_gdo: { ...colonna('uuid', false), chiavePrimaria: true }, nome_gdo: colonna('character varying(255)', false) },
      indici: [{ nome: 'gdo_nome_gdo', colonne: ['nome_gdo'], unico: true, metodo: 'btree', condizione: null }],
      vincoliUnici: [],
    },
    promo: {
      colonne: { id_promo: colonna('character varying(255)', false), stato: colonna('enum_promo_stato') },
      indici: [],
      vincoliUnici: [],
    },
  },
  enum: { enum_promo_stato: ['BOZZA', 'ATTIVA'] },
};

/** Il catalogo di un database identico ad ATTESO. */
const catalogoConforme = (): Catalogo => ({
  tabelle: ['gdo', 'promo', 'migrazioni_schema', 'sessions'],
  colonne: [
    { tabella: 'gdo', colonna: 'id_gdo', tipo: 'uuid', nullable: false },
    { tabella: 'gdo', colonna: 'nome_gdo', tipo: 'character varying(255)', nullable: false },
    { tabella: 'promo', colonna: 'id_promo', tipo: 'character varying(255)', nullable: false },
    { tabella: 'promo', colonna: 'stato', tipo: 'enum_promo_stato', nullable: true },
  ],
  indici: [
    { tabella: 'gdo', nome: 'gdo_pkey', definizione: 'CREATE UNIQUE INDEX gdo_pkey ON public.gdo USING btree (id_gdo)' },
    { tabella: 'gdo', nome: 'gdo_nome_gdo', definizione: 'CREATE UNIQUE INDEX gdo_nome_gdo ON public.gdo USING btree (nome_gdo)' },
  ],
  enum: [{ nome: 'enum_promo_stato', valore: 'BOZZA' }, { nome: 'enum_promo_stato', valore: 'ATTIVA' }],
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockReset();
});

describe('confrontaSchema', () => {
  it('nessuna differenza su un database conforme; le tabelle di servizio non contano', () => {
    expect(confrontaSchema(ATTESO, catalogoConforme())).toEqual([]);
  });

  it('segnala come problema cio\' che manca o e\' diverso', () => {
    const catalogo = catalogoConforme();
    catalogo.tabelle = catalogo.tabelle.filter(t => t !== 'promo');
    catalogo.colonne = [
      { tabella: 'gdo', colonna: 'id_gdo', tipo: 'uuid', nullable: true },
    ];
    catalogo.indici = catalogo.indici.map(i => ({ ...i, definizione: i.definizione.replace('UNIQUE ', '') }));
    catalogo.enum = [{ nome: 'enum_promo_stato', valore: 'BOZZA' }];

    const differenze = confrontaSchema(ATTESO, catalogo).map(d => `${d.gravita} ${d.tipo} ${d.oggetto}`);

    expect(differenze).toEqual([
      "problema nullabilita' diversa gdo.id_gdo",
      'problema colonna mancante gdo.nome_gdo',
      "problema unicita' dell'indice diversa gdo.gdo_nome_gdo",
      'problema tabella mancante promo',
      'problema valore enum mancante enum_promo_stato.ATTIVA',
    ]);
  });

  it('confronta i tipi come format_type(), senza badare a maiuscole e virgolette', () => {
    const catalogo = catalogoConforme();
    catalogo.colonne[3] = { ...catalogo.colonne[3], tipo: '"enum_promo_stato"' };
    catalogo.colonne[1] = { ...catalogo.colonne[1], tipo: 'character varying(100)' };

    const differenze = confrontaSchema(ATTESO, catalogo);

    expect(differenze).toEqual([
      { gravita: 'problema', tipo: 'tipo diverso', oggetto: 'gdo.nome_gdo', atteso: 'character varying(255)', trovato: 'character varying(100)' },
    ]);
  });

  it('cio\' che c\'e\' in piu\' e\' solo informazione', () => {
    const catalogo = catalogoConforme();
    catalogo.tabelle.push('vecchia_tabella', 'tracciati_orfani_20261028', 'accessi_stato', 'oggetti_derivati_schema');
    catalogo.colonne.push({ tabella: 'gdo', colonna: 'colonna_storica', tipo: 'text', nullable: true });
    catalogo.indici.push(
      { tabella: 'gdo', nome: 'idx_storico', definizione: 'CREATE INDEX idx_storico ON public.gdo USING btree (nome_gdo)' },
      { tabella: 'gdo', nome: 'gdo_nome_gdo_key1', definizione: 'CREATE UNIQUE INDEX gdo_nome_gdo_key1 ON public.gdo USING btree (nome_gdo)' }
    );
    catalogo.enum.push({ nome: 'enum_promo_stato', valore: 'ARCHIVIATA' });

    const differenze = confrontaSchema(ATTESO, catalogo);

    expect(differenze.every(d => d.gravita === 'informazione')).toBe(true);
    expect(differenze.map(d => d.oggetto)).toEqual(['gdo.colonna_storica', 'gdo.idx_storico', 'vecchia_tabella', 'enum_promo_stato.ARCHIVIATA']);
  });

  it('un indice con espressione e lo stesso nome vale come quello del modello (COALESCE di 0001)', () => {
    const catalogo = catalogoConforme();
    catalogo.indici[1] = {
      tabella: 'gdo', nome: 'gdo_nome_gdo',
      definizione: "CREATE UNIQUE INDEX gdo_nome_gdo ON public.gdo USING btree (COALESCE(nome_gdo, ''::character varying))",
    };

    expect(confrontaSchema(ATTESO, catalogo)).toEqual([]);
  });

  it('enum mancante', () => {
    const catalogo = catalogoConforme();
    catalogo.enum = [];

    expect(confrontaSchema(ATTESO, catalogo)).toEqual([
      { gravita: 'problema', tipo: 'enum mancante', oggetto: 'enum_promo_stato', atteso: 'BOZZA, ATTIVA' },
    ]);
  });
});

describe('leggiCatalogo', () => {
  it('legge tabelle, colonne, indici ed enum dello schema public, in sola lettura', async () => {
    mocks.query
      .mockResolvedValueOnce([{ tabella: 'gdo' }])
      .mockResolvedValueOnce([{ tabella: 'gdo', colonna: 'id_gdo', tipo: 'uuid', nullable: false }])
      .mockResolvedValueOnce([{ tabella: 'gdo', nome: 'gdo_pkey', definizione: 'CREATE UNIQUE INDEX gdo_pkey ON public.gdo (id_gdo)' }])
      .mockResolvedValueOnce([{ nome: 'enum_promo_stato', valore: 'BOZZA' }]);

    const catalogo = await leggiCatalogo();

    expect(catalogo.tabelle).toEqual(['gdo']);
    expect(catalogo.colonne).toEqual([{ tabella: 'gdo', colonna: 'id_gdo', tipo: 'uuid', nullable: false }]);
    expect(catalogo.enum).toEqual([{ nome: 'enum_promo_stato', valore: 'BOZZA' }]);
    const sql = mocks.query.mock.calls.map(c => String(c[0]));
    expect(sql).toHaveLength(4);
    expect(sql.every(istruzione => /^\s*SELECT/i.test(istruzione))).toBe(true);
    expect(sql.join('\n')).toContain('pg_indexes');
    expect(sql.join('\n')).toContain('pg_enum');
  });
});

describe('segnalaDifferenzeSchema', () => {
  /** Il catalogo di un database identico a schema.json. */
  const rispondiCome = (atteso: DescrizioneSchema) => {
    const tabelle = Object.entries(atteso.tabelle);
    mocks.query
      .mockResolvedValueOnce(tabelle.map(([tabella]) => ({ tabella })))
      .mockResolvedValueOnce(tabelle.flatMap(([tabella, def]) =>
        Object.entries(def.colonne).map(([nome, c]) => ({ tabella, colonna: nome, tipo: c.tipo, nullable: c.nullable }))))
      .mockResolvedValueOnce(tabelle.flatMap(([tabella, def]) =>
        def.indici.map(i => ({ tabella, nome: i.nome, definizione: `CREATE ${i.unico ? 'UNIQUE ' : ''}INDEX ${i.nome} ON public.${tabella}` }))))
      .mockResolvedValueOnce(Object.entries(atteso.enum).flatMap(([nome, valori]) => valori.map(valore => ({ nome, valore }))));
  };

  it('su un database conforme a schema.json scrive solo un\'informazione', async () => {
    rispondiCome(leggiSchemaAtteso());

    await segnalaDifferenzeSchema();

    expect(mocks.log.warn).not.toHaveBeenCalled();
    expect(mocks.log.info).toHaveBeenCalledWith('Schema del database conforme ai modelli');
  });

  it('con differenze scrive un avviso, senza fermare niente', async () => {
    const atteso = leggiSchemaAtteso();
    const { gdo: _gdo, ...senzaGdo } = atteso.tabelle;
    rispondiCome({ ...atteso, tabelle: senzaGdo });

    await expect(segnalaDifferenzeSchema()).resolves.toBeUndefined();

    expect(mocks.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('yarn migrazioni:verifica'),
      { differenze: expect.arrayContaining(['tabella mancante: gdo']) }
    );
  });

  it('se la verifica fallisce scrive un avviso e prosegue', async () => {
    mocks.query.mockRejectedValue(new Error('permission denied for table pg_class'));

    await expect(segnalaDifferenzeSchema()).resolves.toBeUndefined();
    expect(mocks.log.warn).toHaveBeenCalledWith('Verifica dello schema non riuscita', { errore: 'permission denied for table pg_class' });
  });
});
