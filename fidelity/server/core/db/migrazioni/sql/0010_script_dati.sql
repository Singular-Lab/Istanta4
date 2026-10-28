-- schema-dopo: de4b2d71fe8bba59e5475121a8ee183ab4a9ad0dd87b16ef284aa3faca667e52
-- Registro degli script di dati (server/core/db/migrazioni/scriptDati.ts).
--
-- Gli script di server/core/scripts che correggono i dati a mano (yarn migrate:*, accessi:migra,
-- auth:segreti) non lasciavano traccia: uno non ripetibile, come migrate:utenti-gdo, rilanciato per
-- errore toccava anche i dati creati da allora. Qui si registra ogni esecuzione reale riuscita;
-- quelli non ripetibili gia' registrati vengono rifiutati, salvo --forza.
--
-- Non e' una tabella dei modelli (come migrazioni_schema): i modelli non cambiano e schema-dopo e'
-- quello della migrazione precedente. Su un database che la ha gia' non fa nulla.
CREATE TABLE IF NOT EXISTS public.script_dati_eseguiti (
  nome VARCHAR(200) PRIMARY KEY,
  ripetibile BOOLEAN NOT NULL,
  ultima_esecuzione TIMESTAMPTZ NOT NULL,
  esecuzioni INTEGER NOT NULL DEFAULT 1,
  durata_ms INTEGER,
  esito JSONB,
  versione_app VARCHAR(50)
);
