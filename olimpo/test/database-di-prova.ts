/**
 * Il database PostgreSQL dei test d'integrazione e della prova di avvio, senza Docker: un server
 * locale indicato da OLIMPO_TEST_DB_URL, per esempio postgres://utente:password@localhost:5433/olimpo_test.
 *
 * Il database viene cancellato e ricreato a ogni esecuzione: per questo il nome deve finire in _test
 * e non puo' essere quello di DB_NAME, il database di Olimpo.
 */

export const VARIABILE_DB_DI_PROVA = 'OLIMPO_TEST_DB_URL';

export interface DatabaseDiProva {
  host: string;
  port: number;
  utente: string;
  password: string;
  database: string;
}

/** Legge e controlla OLIMPO_TEST_DB_URL; null se non e' impostata. */
export const databaseDiProva = (ambiente: Record<string, string | undefined> = process.env): DatabaseDiProva | null => {
  const valore = ambiente[VARIABILE_DB_DI_PROVA]?.trim();
  if (!valore) return null;
  const url = new URL(valore);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/_test$/.test(database)) {
    throw new Error(`${VARIABILE_DB_DI_PROVA} deve indicare un database il cui nome finisce in _test, ora "${database}": viene cancellato e ricreato`);
  }
  if (ambiente.DB_NAME && ambiente.DB_NAME === database) {
    throw new Error(`${VARIABILE_DB_DI_PROVA} indica "${database}", lo stesso database di DB_NAME: verrebbe cancellato`);
  }
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    utente: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
};

/** Lo stato delle installazioni esistenti: auth con il tipo tipo_utenti_finale a soli cinque valori. */
export const SQL_AUTH_STORICA = `
  CREATE TYPE public.tipo_utenti_finale AS ENUM ('Superadmin', 'GDO', 'PuntoVendita', 'Agenzia', 'Guest');
  CREATE TYPE public.fico_origin AS ENUM ('FP', 'CO', 'IS', 'OL');
  CREATE TABLE public.auth (
    id UUID PRIMARY KEY,
    public_key VARCHAR(255),
    private_key VARCHAR(255),
    meta_utente JSON,
    tipo_utente public.tipo_utenti_finale,
    origine public.fico_origin,
    email VARCHAR(255),
    expires_at TIMESTAMP,
    is_valid BOOLEAN
  );
`;

/**
 * Le cartelle che Olimpo legge all'avvio da absolute_paths (OlimpoService.initialize): senza le righe
 * WEB, ARCHIVIO e VIDEO attive il processo si ferma. Per la prova puntano a cartelle temporanee.
 */
export const sqlCartelleAssolute = (cartelle: { web: string; archivio: string; video: string; materiali: string }) => `
  CREATE TABLE public.absolute_paths (id UUID PRIMARY KEY, path VARCHAR(255), tipo VARCHAR(255), active BOOLEAN);
  INSERT INTO public.absolute_paths (id, path, tipo, active) VALUES
    (gen_random_uuid(), ${letterale(cartelle.web)}, 'WEB', true),
    (gen_random_uuid(), ${letterale(cartelle.archivio)}, 'ARCHIVIO', true),
    (gen_random_uuid(), ${letterale(cartelle.video)}, 'VIDEO', true),
    (gen_random_uuid(), ${letterale(cartelle.materiali)}, 'MATERIALI', true);
`;

/** Una stringa come letterale SQL (apici raddoppiati). */
const letterale = (valore: string) => `'${valore.replace(/'/g, "''")}'`;
