-- I tipi di utente di Fidelity Category, Marketing e IT (enum TIPO_UTENTE_FICO_FINALE) nel tipo della
-- colonna auth.tipo_utente (spec olimpo/passaporto-utenti).
--
-- Sulle installazioni esistenti quel tipo e' tipo_utenti_finale, creato a mano da
-- sql/alterazione_tipo_utente.sql con soli cinque valori: synchronize di Sequelize non aggiunge valori
-- a un tipo che esiste gia', e la registrazione di un utente Marketing falliva con 22P02 ("la sintassi
-- per l'enumerazione tipo_utenti_finale non e' valida"), lasciandolo senza passaporto.
--
-- Si cerca il tipo che la colonna usa davvero, qualunque sia il suo nome. Se la tabella o la colonna
-- non ci sono, o la colonna non e' un enum, non fa nulla. ADD VALUE IF NOT EXISTS: rieseguibile.
-- I valori nuovi si possono usare solo dopo il commit della transazione delle migrazioni, cioe' da
-- quando Olimpo accetta richieste.
DO $$
DECLARE
  tipo regtype;
  valore text;
BEGIN
  SELECT a.atttypid::regtype INTO tipo
    FROM pg_attribute a
    JOIN pg_type t ON t.oid = a.atttypid
   WHERE a.attrelid = to_regclass('public.auth')
     AND a.attname = 'tipo_utente'
     AND NOT a.attisdropped
     AND t.typtype = 'e';

  IF tipo IS NULL THEN
    RETURN;
  END IF;

  FOREACH valore IN ARRAY ARRAY['Category', 'Marketing', 'IT'] LOOP
    EXECUTE format('ALTER TYPE %s ADD VALUE IF NOT EXISTS %L', tipo, valore);
  END LOOP;
END $$;
