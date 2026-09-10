import bcrypt from 'bcrypt';
import pg from 'pg';
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n')
    .filter(r => r.includes('=') && !r.trim().startsWith('#'))
    .map(r => [r.slice(0, r.indexOf('=')).trim(), r.slice(r.indexOf('=') + 1).trim()])
);

const c = new pg.Client({
  host: env.DB_POSTGRESQL_HOST, port: +env.DB_POSTGRESQL_PORT,
  database: env.DB_POSTGRESQL_NAME, user: env.DB_POSTGRESQL_USER,
  password: env.DB_POSTGRESQL_PASSWORD,
});
await c.connect();

const tipi = (await c.query(
  `select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid
   where t.typname='enum_utenti_tipo_utenti' order by enumsortorder`)).rows.map(r => r.enumlabel);
const superadmin = tipi.find(t => t.toUpperCase() === 'SUPERADMIN') || tipi[0];
console.log('tipo scelto:', superadmin, '| disponibili:', tipi.join(', '));

const hash = await bcrypt.hash('pippo', +(env.SALT_ROUNDS || 10));

for (const email of ['pippo', 'pippo@istanta4.local']) {
  await c.query(`delete from utenti where email_utenti=$1`, [email]);
  const r = await c.query(
    `insert into utenti (nome_utenti, cognome_utenti, email_utenti, password_utenti,
                         tipo_utenti, stato_utenti, outsider_utenti, createdat, updatedat)
     values ($1,$2,$3,$4,$5::enum_utenti_tipo_utenti,'ATTIVO',false,now(),now())
     returning id_utenti`,
    ['Pippo', 'Test', email, hash, superadmin]);
  console.log('creato:', email, '->', r.rows[0].id_utenti);
}

const v = await c.query(`select email_utenti, password_utenti from utenti where email_utenti='pippo'`);
console.log('verifica bcrypt "pippo":', await bcrypt.compare('pippo', v.rows[0].password_utenti));
await c.end();
