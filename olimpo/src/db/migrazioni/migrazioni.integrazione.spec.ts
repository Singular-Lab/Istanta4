import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { databaseDiProva, SQL_AUTH_STORICA, VARIABILE_DB_DI_PROVA } from '../../../test/database-di-prova';
import { migraAllAvvio, TABELLA_STORICO, type Registro } from './migrazioni';
import { collegamentoSequelize } from './migrazioni.service';

/*
 * Migrazioni di Olimpo su un PostgreSQL vero, senza Docker (spec olimpo/schema-database-all-avvio e
 * olimpo/passaporto-utenti). Il database e' quello di OLIMPO_TEST_DB_URL, cancellato e ricreato a ogni
 * esecuzione; senza la variabile i test si saltano. Esempio:
 *   OLIMPO_TEST_DB_URL=postgres://utente:password@localhost:5433/olimpo_test yarn test migrazioni.integrazione
 */
const prova = databaseDiProva();
if (!prova) console.warn(`${VARIABILE_DB_DI_PROVA} non impostata: i test d'integrazione delle migrazioni si saltano`);
const describeConDatabase = prova ? describe : describe.skip;

const connessione = (database: string) =>
  new Sequelize({
    dialect: 'postgres',
    host: prova!.host,
    port: prova!.port,
    username: prova!.utente,
    password: prova!.password,
    database,
    logging: false,
  });

const registroMuto = (): Registro & { righe: string[] } => {
  const righe: string[] = [];
  return { righe, log: (m) => righe.push(m), warn: (m) => righe.push(`WARN ${m}`) };
};

describeConDatabase('migrazioni di Olimpo su PostgreSQL', () => {
  let db: Sequelize;
  const aperte: Sequelize[] = [];

  /** Una connessione in piu' al database di prova, chiusa alla fine: come un altro worker. */
  const altraConnessione = () => {
    const nuova = connessione(prova!.database);
    aperte.push(nuova);
    return nuova;
  };

  const valoriTipoUtente = async () =>
    (await db.query<{ v: string }>(
      `SELECT e.enumlabel AS v FROM pg_enum e WHERE e.enumtypid = 'public.tipo_utenti_finale'::regtype ORDER BY e.enumsortorder`,
      { type: QueryTypes.SELECT }
    )).map((r) => r.v);

  const storico = async () =>
    db.query<{ nome: string }>(`SELECT nome FROM ${TABELLA_STORICO} ORDER BY nome`, { type: QueryTypes.SELECT });

  beforeAll(async () => {
    const server = connessione('postgres');
    await server.query(`DROP DATABASE IF EXISTS "${prova!.database}"`);
    await server.query(`CREATE DATABASE "${prova!.database}"`);
    await server.close();
    db = connessione(prova!.database);
  }, 30000);

  afterAll(async () => {
    await Promise.all(aperte.map((c) => c.close()));
    await db?.close();
    const server = connessione('postgres');
    await server.query(`DROP DATABASE IF EXISTS "${prova!.database}"`);
    await server.close();
  }, 30000);

  beforeEach(async () => {
    await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  });

  it('su un\'installazione esistente aggiunge Category, Marketing e IT, e dopo un utente Marketing si registra', async () => {
    await db.query(SQL_AUTH_STORICA);

    const esito = await migraAllAvvio(collegamentoSequelize(db), registroMuto(), {});

    expect(esito?.applicate).toEqual(['0001_tipi_utente_fidelity']);
    expect(await valoriTipoUtente()).toEqual(['Superadmin', 'GDO', 'PuntoVendita', 'Agenzia', 'Guest', 'Category', 'Marketing', 'IT']);
    const [utente] = await db.query<{ tipo_utente: string }>(
      `INSERT INTO auth (id, email, tipo_utente, origine, is_valid)
       VALUES (gen_random_uuid(), 'marketing@prova.test', 'Marketing', 'FP', true) RETURNING tipo_utente`,
      { type: QueryTypes.SELECT }
    );
    expect(utente.tipo_utente).toBe('Marketing');
  });

  it('due avvii insieme applicano la migrazione una volta sola, e un riavvio non applica nulla', async () => {
    await db.query(SQL_AUTH_STORICA);

    const [primo, secondo] = await Promise.all([
      migraAllAvvio(collegamentoSequelize(altraConnessione()), registroMuto(), {}),
      migraAllAvvio(collegamentoSequelize(altraConnessione()), registroMuto(), {}),
    ]);
    const riavvio = registroMuto();
    await migraAllAvvio(collegamentoSequelize(db), riavvio, {});

    expect([...primo!.applicate, ...secondo!.applicate]).toEqual(['0001_tipi_utente_fidelity']);
    expect(await storico()).toEqual([{ nome: '0001_tipi_utente_fidelity' }]);
    expect(riavvio.righe).toEqual(['Migrazioni del database: nulla da applicare']);
  });

  it('una migrazione registrata e poi modificata ferma l\'avvio e lascia il database com\'era', async () => {
    await db.query(SQL_AUTH_STORICA);
    await migraAllAvvio(collegamentoSequelize(db), registroMuto(), {});
    await db.query(`UPDATE ${TABELLA_STORICO} SET impronta = repeat('0', 64)`);

    await expect(migraAllAvvio(collegamentoSequelize(db), registroMuto(), {})).rejects.toThrow(
      "La migrazione 0001_tipi_utente_fidelity e' stata modificata dopo essere stata applicata"
    );
    expect(await storico()).toEqual([{ nome: '0001_tipi_utente_fidelity' }]);
  });

  it('su un database senza la tabella auth la migrazione non cambia nulla e resta registrata', async () => {
    const esito = await migraAllAvvio(collegamentoSequelize(db), registroMuto(), {});

    expect(esito?.applicate).toEqual(['0001_tipi_utente_fidelity']);
    const [tipo] = await db.query<{ esiste: boolean }>(`SELECT to_regtype('public.tipo_utenti_finale') IS NOT NULL AS esiste`, {
      type: QueryTypes.SELECT,
    });
    expect(tipo.esiste).toBe(false);
  });
});
