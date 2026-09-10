import bcrypt from 'bcrypt';
import pg from 'pg';
import fs from 'fs';
const env = Object.fromEntries(
  fs.readFileSync('.env','utf8').split('\n')
    .filter(r => r.includes('=') && !r.trim().startsWith('#'))
    .map(r => [r.slice(0,r.indexOf('=')).trim(), r.slice(r.indexOf('=')+1).trim()]));
const c = new pg.Client({host:env.DB_POSTGRESQL_HOST, port:+env.DB_POSTGRESQL_PORT,
  database:env.DB_POSTGRESQL_NAME, user:env.DB_POSTGRESQL_USER, password:env.DB_POSTGRESQL_PASSWORD});
await c.connect();
const hash = await bcrypt.hash(process.argv[2], +(env.SALT_ROUNDS||10));
const r = await c.query('update utenti set password_utenti=$1 where email_utenti in ($2,$3) returning email_utenti',
  [hash,'pippo','pippo@istanta4.local']);
console.log('aggiornati:', r.rows.map(x=>x.email_utenti).join(', '));
const v = await c.query("select password_utenti from utenti where email_utenti='pippo@istanta4.local'");
console.log('verifica:', await bcrypt.compare(process.argv[2], v.rows[0].password_utenti));
await c.end();
