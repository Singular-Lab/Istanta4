import { QueryTypes, Transaction } from 'sequelize';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { describeConDatabase, usaDatabase } from '../../../../__tests__/integrazione/database';
import { GDOWhatsappPreset } from '../../../models/whatsapp/gdo_whatsapp_preset';
import { sequelize } from '../../SequelizeConnector';
import { leggiMigrazioni, Migrazione } from '../fileMigrazioni';
import { Differenza, leggiSchemaAtteso, verificaSchema } from '../verificaSchema';

/**
 * Migrazioni 0011-0013 su un'installazione vecchia. Il database di test nasce dalle migrazioni come
 * un'installazione nuova: ogni test, in una transazione annullata alla fine, lo riporta com'erano le
 * installazioni vecchie (tabelle senza chiave primaria, enum rimasti senza colonne, date doppie dei
 * preset WhatsApp), riesegue l'SQL della migrazione e controlla il risultato. Il database resta com'era
 * per gli altri file, compreso "lo schema ottenuto coincide con quello dei modelli".
 */

const migrazione = (nome: string): Migrazione => {
  const trovata = leggiMigrazioni().find(m => m.nome === nome);
  if (!trovata) throw new Error(`Migrazione ${nome} non trovata`);
  return trovata;
};

const CHIAVI = migrazione('0011_chiavi_primarie');
const ENUM_ORFANI = migrazione('0012_enum_orfani');
const DATE_PRESET = migrazione('0013_timestamp_preset_whatsapp');

const ID_PRESET = ['00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a3'];
const ID_GUEST = '00000000-0000-4000-8000-0000000000b1';

/** La connessione pg della transazione: i RAISE NOTICE arrivano come eventi "notice". */
interface ConnessioneConAvvisi {
  on(evento: 'notice', ascolta: (avviso: { message?: string }) => void): unknown;
  removeListener(evento: 'notice', ascolta: (avviso: { message?: string }) => void): unknown;
}

type Sostituzioni = Record<string, string | number | boolean | null>;

const descrivi = (differenze: Differenza[]): string[] => differenze.map(d => `${d.gravita} ${d.tipo} ${d.oggetto}`);

describeConDatabase('migrazioni 0011-0013 su un\'installazione vecchia', () => {
  usaDatabase();

  let transazione: Transaction;
  let avvisi: string[] = [];
  const ascolta = (avviso: { message?: string }) => {
    avvisi.push(String(avviso.message));
  };
  const connessione = () => (transazione as unknown as { connection: ConnessioneConAvvisi }).connection;

  const esegui = async (sql: string, replacements?: Sostituzioni): Promise<void> => {
    await sequelize.query(sql, { transaction: transazione, replacements });
  };
  const leggi = <T extends object>(sql: string, replacements?: Sostituzioni): Promise<T[]> =>
    sequelize.query<T>(sql, { type: QueryTypes.SELECT, transaction: transazione, replacements });
  // Come il runner: il file intero in una query, nella transazione
  const applica = async (m: Migrazione): Promise<void> => {
    await sequelize.query(m.sql, { transaction: transazione });
  };
  const verifica = () => verificaSchema(leggiSchemaAtteso(), transazione);

  const chiavePrimaria = async (tabella: string): Promise<{ nome: string; colonne: string[] } | null> => {
    const righe = await leggi<{ nome: string; colonna: string }>(
      `SELECT k.conname AS nome, a.attname AS colonna
       FROM pg_constraint k
       JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey)
       WHERE k.conrelid = to_regclass(:tabella) AND k.contype = 'p'`,
      { tabella: `public.${tabella}` }
    );
    return righe.length === 0 ? null : { nome: righe[0].nome, colonne: righe.map(r => r.colonna) };
  };
  /** Com'erano le installazioni vecchie dopo 0005: niente chiave primaria, solo il NOT NULL. */
  const togliChiave = async (tabella: string, colonna: string): Promise<void> => {
    const chiave = await chiavePrimaria(tabella);
    if (chiave) await esegui(`ALTER TABLE public."${tabella}" DROP CONSTRAINT "${chiave.nome}"`);
    await esegui(`ALTER TABLE public."${tabella}" ALTER COLUMN "${colonna}" SET NOT NULL`);
  };
  const colonne = async (tabella: string): Promise<string[]> =>
    (await leggi<{ nome: string }>(
      `SELECT column_name AS nome FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = :tabella ORDER BY ordinal_position`,
      { tabella }
    )).map(r => r.nome);
  const enumEsiste = async (nome: string): Promise<boolean> => {
    const [riga] = await leggi<{ esiste: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public' AND t.typname = :nome AND t.typtype = 'e'
       ) AS esiste`,
      { nome }
    );
    return Boolean(riga?.esiste);
  };
  const righeGuest = () => leggi<Record<string, unknown>>(
    `SELECT * FROM public.utenti_guest WHERE "id_UtentiGuest" = :id OR "id_UtentiGuest" IS NULL ORDER BY "dettagliUtente_UtentiGuest"`,
    { id: ID_GUEST }
  );
  const datePreset = async (): Promise<Record<string, { createdat: string | null; updatedat: string | null }>> => {
    const righe = await leggi<{ id: string; createdat: Date | null; updatedat: Date | null }>(
      'SELECT id_gdowhatsappreset AS id, createdat, updatedat FROM public.gdo_whatsapp_presets'
    );
    return Object.fromEntries(righe.map(r => [r.id, {
      createdat: r.createdat ? new Date(r.createdat).toISOString() : null,
      updatedat: r.updatedat ? new Date(r.updatedat).toISOString() : null,
    }]));
  };

  beforeEach(async () => {
    avvisi = [];
    transazione = await sequelize.transaction();
    connessione().on('notice', ascolta);
    // Sequelize apre le sessioni con client_min_messages = warning: i NOTICE non arriverebbero
    await esegui('SET LOCAL client_min_messages TO notice');
  });

  afterEach(async () => {
    connessione().removeListener('notice', ascolta);
    await transazione.rollback();
  });

  it('0011 aggiunge la chiave primaria dove manca e salta, con un avviso e senza toccarla, la tabella con doppioni', async () => {
    await togliChiave('gdo_whatsapp_presets', 'id_gdowhatsappreset');
    await togliChiave('utenti_guest', 'id_UtentiGuest');
    await esegui(
      `INSERT INTO public.gdo_whatsapp_presets
         (id_gdowhatsappreset, id_template_gdowhatsappreset, nome_preset_gdowhatsappreset, is_default_gdowhatsappreset, hash_gdowhatsappreset)
       VALUES (:uno, 'template', 'Uno', true, 'h1'), (:due, 'template', 'Due', false, 'h2')`,
      { uno: ID_PRESET[0], due: ID_PRESET[1] }
    );
    await esegui(
      `INSERT INTO public.utenti_guest ("id_UtentiGuest", "dettagliUtente_UtentiGuest", "origine_UtentiGuest", "email_UtentiGuest")
       VALUES (:id, 'primo', 'FICO', 'primo@example.test'), (:id, 'secondo', 'FICO', 'secondo@example.test')`,
      { id: ID_GUEST }
    );
    const guestPrima = await righeGuest();
    expect(descrivi(await verifica())).toEqual(expect.arrayContaining([
      'problema chiave primaria mancante gdo_whatsapp_presets',
      'problema chiave primaria mancante utenti_guest',
    ]));

    await applica(CHIAVI);

    expect(await chiavePrimaria('gdo_whatsapp_presets')).toEqual({ nome: 'gdo_whatsapp_presets_pkey', colonne: ['id_gdowhatsappreset'] });
    expect(await chiavePrimaria('utenti_guest')).toBeNull();
    expect(avvisi).toEqual([
      'Tabella gdo_whatsapp_presets: chiave primaria id_gdowhatsappreset aggiunta',
      'Tabella utenti_guest: 0 NULL e 1 doppioni in "id_UtentiGuest", chiave primaria non creata (righe da sistemare a mano)',
    ]);
    expect(await righeGuest()).toEqual(guestPrima);
    expect(descrivi((await verifica()).filter(d => d.tipo.startsWith('chiave primaria')))).toEqual([
      'problema chiave primaria mancante utenti_guest',
    ]);

    // Rieseguita: la chiave c'e' gia', i doppioni anche
    avvisi = [];
    await applica(CHIAVI);
    expect(await chiavePrimaria('gdo_whatsapp_presets')).toEqual({ nome: 'gdo_whatsapp_presets_pkey', colonne: ['id_gdowhatsappreset'] });
    expect(avvisi).toEqual([
      'Tabella utenti_guest: 0 NULL e 1 doppioni in "id_UtentiGuest", chiave primaria non creata (righe da sistemare a mano)',
    ]);
  });

  it('0011 con id NULL non crea la chiave e lascia la riga com\'e\'', async () => {
    await togliChiave('utenti_guest', 'id_UtentiGuest');
    await esegui('ALTER TABLE public.utenti_guest ALTER COLUMN "id_UtentiGuest" DROP NOT NULL');
    await esegui(
      `INSERT INTO public.utenti_guest ("id_UtentiGuest", "dettagliUtente_UtentiGuest", "origine_UtentiGuest", "email_UtentiGuest")
       VALUES (NULL, 'senza id', 'FICO', 'senza-id@example.test')`
    );
    const prima = await righeGuest();

    await applica(CHIAVI);

    expect(await chiavePrimaria('utenti_guest')).toBeNull();
    expect(avvisi).toContain('Tabella utenti_guest: 1 NULL e 0 doppioni in "id_UtentiGuest", chiave primaria non creata (righe da sistemare a mano)');
    expect(await righeGuest()).toEqual(prima);
  });

  it('0012 elimina gli enum che nessuno usa; tiene quelli usati da una colonna, anche come array, o da altri oggetti, e quelli dei modelli', async () => {
    // Avanzo della colonna "sesso_Utenti" eliminata da 0009
    await esegui('CREATE TYPE public."enum_utenti_sesso_Utenti" AS ENUM (\'M\', \'F\')');
    await esegui('CREATE TYPE public.t8_usato AS ENUM (\'A\')');
    await esegui('CREATE TYPE public.t8_array AS ENUM (\'A\')');
    await esegui('CREATE TYPE public.t8_dominio AS ENUM (\'A\')');
    await esegui('CREATE TABLE public.t8_tabella_vecchia (stato public.t8_usato, stati public.t8_array[])');
    await esegui('CREATE DOMAIN public.t8_dominio_vecchio AS public.t8_dominio');
    // Un enum dei modelli che nessuna colonna usa (la colonna ora usa il tipo rinominato): si tiene
    await esegui('ALTER TYPE public.enum_auth_providers_tipo RENAME TO t8_auth_providers_tipo');
    await esegui('CREATE TYPE public.enum_auth_providers_tipo AS ENUM (\'A\')');
    const nonUsati = async () => (await verifica()).filter(d => d.tipo === 'enum in piu\' non usato').map(d => d.oggetto);
    expect(await nonUsati()).toEqual(['enum_utenti_sesso_Utenti', 't8_dominio']);

    await applica(ENUM_ORFANI);

    expect(await enumEsiste('enum_utenti_sesso_Utenti')).toBe(false);
    for (const nome of ['t8_usato', 't8_array', 't8_dominio', 't8_auth_providers_tipo', 'enum_auth_providers_tipo'])
      expect(await enumEsiste(nome), nome).toBe(true);
    for (const nome of Object.keys(leggiSchemaAtteso().enum)) expect(await enumEsiste(nome), nome).toBe(true);
    expect([...avvisi].sort()).toEqual([
      'Enum "enum_utenti_sesso_Utenti": non usato, eliminato',
      'Enum t8_array: usato da una colonna, si tiene',
      'Enum t8_auth_providers_tipo: usato da una colonna, si tiene',
      'Enum t8_dominio: usato da altri oggetti, si tiene',
      'Enum t8_usato: usato da una colonna, si tiene',
    ]);
    // t8_dominio resta un'informazione: lo usa un dominio, non una colonna
    expect(await nonUsati()).toEqual(['t8_dominio']);

    avvisi = [];
    await applica(ENUM_ORFANI);
    expect(avvisi.some(a => a.includes('eliminato'))).toBe(false);
  });

  it('0013 unisce le date doppie dei preset senza perderne, toglie createdAt/updatedAt e il modello continua a funzionare', async () => {
    // Come le installazioni con il modello di prima: due coppie di date, quella con la maiuscola NOT NULL
    await esegui('DELETE FROM public.gdo_whatsapp_presets');
    await esegui(
      `ALTER TABLE public.gdo_whatsapp_presets
         ADD COLUMN "createdAt" TIMESTAMP WITH TIME ZONE, ADD COLUMN "updatedAt" TIMESTAMP WITH TIME ZONE`
    );
    // 1: modificato dopo la creazione, Sequelize aggiornava solo updatedAt
    // 2: date minuscole NULL
    // 3: createdat messa dopo (data dell'ALTER) e quella vera in createdAt; updatedat gia' la piu' recente
    await esegui(
      `INSERT INTO public.gdo_whatsapp_presets
         (id_gdowhatsappreset, id_template_gdowhatsappreset, nome_preset_gdowhatsappreset, is_default_gdowhatsappreset,
          hash_gdowhatsappreset, createdat, updatedat, "createdAt", "updatedAt")
       VALUES
         (:uno, 'template', 'Modificato', true, 'h1',
          '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z', '2026-06-15T12:00:00Z'),
         (:due, 'template', 'Senza date', false, 'h2',
          NULL, NULL, '2026-01-10T08:00:00Z', '2026-01-10T08:00:00Z'),
         (:tre, 'template', 'Aggiunta dopo', false, 'h3',
          '2026-02-01T00:00:00Z', '2026-05-01T00:00:00Z', '2025-12-01T00:00:00Z', '2026-04-01T00:00:00Z')`,
      { uno: ID_PRESET[0], due: ID_PRESET[1], tre: ID_PRESET[2] }
    );
    await esegui('ALTER TABLE public.gdo_whatsapp_presets ALTER COLUMN "createdAt" SET NOT NULL, ALTER COLUMN "updatedAt" SET NOT NULL');
    expect(descrivi(await verifica())).toEqual(expect.arrayContaining([
      'informazione colonna in piu\' gdo_whatsapp_presets.createdAt',
      'informazione colonna in piu\' gdo_whatsapp_presets.updatedAt',
    ]));

    await applica(DATE_PRESET);

    const presenti = await colonne('gdo_whatsapp_presets');
    expect(presenti).toEqual(expect.arrayContaining(['createdat', 'updatedat']));
    expect(presenti).not.toEqual(expect.arrayContaining(['createdAt']));
    expect(presenti).not.toEqual(expect.arrayContaining(['updatedAt']));
    expect(await datePreset()).toEqual({
      [ID_PRESET[0]]: { createdat: '2026-03-01T10:00:00.000Z', updatedat: '2026-06-15T12:00:00.000Z' },
      [ID_PRESET[1]]: { createdat: '2026-01-10T08:00:00.000Z', updatedat: '2026-01-10T08:00:00.000Z' },
      [ID_PRESET[2]]: { createdat: '2025-12-01T00:00:00.000Z', updatedat: '2026-05-01T00:00:00.000Z' },
    });
    expect(avvisi).toEqual([
      'gdo_whatsapp_presets.createdat: 2 righe aggiornate con i valori di "createdAt"',
      'gdo_whatsapp_presets."createdAt": eliminata, i valori sono in createdat',
      'gdo_whatsapp_presets.updatedat: 2 righe aggiornate con i valori di "updatedAt"',
      'gdo_whatsapp_presets."updatedAt": eliminata, i valori sono in updatedat',
    ]);
    expect((await verifica()).filter(d => d.oggetto.startsWith('gdo_whatsapp_presets'))).toEqual([]);

    // Il modello scrive e legge la tabella senza le colonne doppie; la risposta JSON non cambia forma
    const nuovo = await GDOWhatsappPreset.create({
      id_template_gdowhatsappreset: 'template',
      nome_preset_gdowhatsappreset: 'Nuovo',
      is_default_gdowhatsappreset: false,
      hash_gdowhatsappreset: 'h4',
      json_meta_gdowhatsappreset: {},
    }, { transaction: transazione });
    await nuovo.update({ nome_preset_gdowhatsappreset: 'Nuovo rinominato' }, { transaction: transazione });
    const letti = await GDOWhatsappPreset.findAll({ where: { id_template_gdowhatsappreset: 'template' }, transaction: transazione });
    const json = JSON.parse(JSON.stringify(letti)) as Array<Record<string, unknown>>;
    expect(json).toHaveLength(4);
    for (const preset of json) {
      expect(Object.keys(preset).sort()).toEqual([
        'createdAt', 'createdat', 'hash_gdowhatsappreset', 'id_gdowhatsappreset', 'id_template_gdowhatsappreset',
        'is_default_gdowhatsappreset', 'json_meta_gdowhatsappreset', 'nome_preset_gdowhatsappreset', 'updatedAt', 'updatedat',
      ]);
      expect(preset.createdAt).toBe(preset.createdat);
      expect(preset.updatedAt).toBe(preset.updatedat);
    }
    const rinominato = json.find(p => p.nome_preset_gdowhatsappreset === 'Nuovo rinominato');
    expect(rinominato?.createdat).toEqual(expect.any(String));
    expect(rinominato?.updatedat).toEqual(expect.any(String));

    avvisi = [];
    await applica(DATE_PRESET);
    expect(avvisi).toEqual([]);
  });

  it('0013 aggiunge createdat/updatedat dove mancano, con i valori di createdAt/updatedAt e il default del modello', async () => {
    await esegui('DELETE FROM public.gdo_whatsapp_presets');
    await esegui(
      `ALTER TABLE public.gdo_whatsapp_presets
         DROP COLUMN createdat, DROP COLUMN updatedat,
         ADD COLUMN "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, ADD COLUMN "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL`
    );
    await esegui(
      `INSERT INTO public.gdo_whatsapp_presets
         (id_gdowhatsappreset, id_template_gdowhatsappreset, nome_preset_gdowhatsappreset, is_default_gdowhatsappreset,
          hash_gdowhatsappreset, "createdAt", "updatedAt")
       VALUES (:uno, 'template', 'Solo maiuscole', true, 'h1', '2026-01-10T08:00:00Z', '2026-02-20T09:00:00Z')`,
      { uno: ID_PRESET[0] }
    );

    await applica(DATE_PRESET);

    expect(await datePreset()).toEqual({
      [ID_PRESET[0]]: { createdat: '2026-01-10T08:00:00.000Z', updatedat: '2026-02-20T09:00:00.000Z' },
    });
    const definizioni = await leggi<{ nome: string; predefinito: string | null; nullable: string }>(
      `SELECT column_name AS nome, column_default AS predefinito, is_nullable AS nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'gdo_whatsapp_presets' AND column_name IN ('createdat', 'updatedat', 'createdAt', 'updatedAt')
       ORDER BY column_name`
    );
    expect(definizioni).toEqual([
      { nome: 'createdat', predefinito: 'now()', nullable: 'YES' },
      { nome: 'updatedat', predefinito: 'now()', nullable: 'YES' },
    ]);
    expect(avvisi).toEqual(expect.arrayContaining(['gdo_whatsapp_presets.createdat: aggiunta', 'gdo_whatsapp_presets.updatedat: aggiunta']));
  });

  it('su un\'installazione vecchia senza doppioni, dopo 0011-0013 lo schema coincide con schema.json', async () => {
    await togliChiave('gdo_whatsapp_presets', 'id_gdowhatsappreset');
    await togliChiave('utenti_guest', 'id_UtentiGuest');
    await esegui(
      `ALTER TABLE public.gdo_whatsapp_presets
         ADD COLUMN "createdAt" TIMESTAMP WITH TIME ZONE, ADD COLUMN "updatedAt" TIMESTAMP WITH TIME ZONE`
    );
    await esegui('CREATE TYPE public."enum_utenti_sesso_Utenti" AS ENUM (\'M\', \'F\')');
    const prima = descrivi(await verifica());
    expect(prima).toEqual(expect.arrayContaining([
      'problema chiave primaria mancante gdo_whatsapp_presets',
      'problema chiave primaria mancante utenti_guest',
      'informazione colonna in piu\' gdo_whatsapp_presets.createdAt',
      'informazione enum in piu\' non usato enum_utenti_sesso_Utenti',
    ]));

    for (const m of [CHIAVI, ENUM_ORFANI, DATE_PRESET]) await applica(m);

    const dopo = await verifica();
    expect(dopo.filter(d => d.gravita === 'problema')).toEqual([]);
    expect(descrivi(dopo).filter(d => d.includes('gdo_whatsapp_presets') || d.includes('utenti_guest') || d.includes('enum in piu\' non usato')))
      .toEqual([]);
  });
});
