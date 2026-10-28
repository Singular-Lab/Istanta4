-- schema-dopo: de4b2d71fe8bba59e5475121a8ee183ab4a9ad0dd87b16ef284aa3faca667e52
-- Colonne obbligatorie come nei modelli: una volta sola.
--
-- 1. Facoltative nel modello ma NOT NULL sulle installazioni vecchie, dove il
--    codice scrive NULL: attivita.idutente_attivita (attivita' di sistema,
--    per esempio CorreggoController e ServerUtils.CREA_ATTIVITA con utente
--    null) e attivita.meta_attivita. Li' l'INSERT fallisce: si toglie il vincolo.
-- 2. Obbligatorie nel modello: il vincolo si mette solo se non ci sono righe
--    NULL; altrimenti un avviso e la colonna resta com'e' (yarn
--    migrazioni:verifica la segnala), senza inventare valori.
--    - attivita.tipo_attivita, ordini_stampa.createdat/updatedat: gia' NOT NULL
--      sulle installazioni vecchie, ora obbligatorie anche nel modello (le date
--      degli ordini le valorizza l'applicazione); qui servono ai database creati
--      dalla baseline, dove erano facoltative;
--    - gdo_whatsapp_presets.id_gdowhatsappreset e utenti_guest."id_UtentiGuest"
--      (chiavi primarie nel modello), tipi_export.modalita_tipiexport,
--      utenti.tipo_utenti, utenti.createdat/updatedat: facoltative sulle
--      installazioni vecchie.
-- Dopo 0004: tipi_export e utenti hanno gia' i tipi del modello.
DO $$
DECLARE
  r RECORD;
  nulli BIGINT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('attivita', 'idutente_attivita'),
      ('attivita', 'meta_attivita')
    ) AS v(tabella, colonna)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tabella
        AND column_name = r.colonna AND is_nullable = 'NO'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', r.tabella, r.colonna);
      RAISE NOTICE 'Colonna %.%: ora facoltativa', r.tabella, r.colonna;
    END IF;
  END LOOP;

  FOR r IN
    SELECT * FROM (VALUES
      ('attivita', 'tipo_attivita'),
      ('ordini_stampa', 'createdat'),
      ('ordini_stampa', 'updatedat'),
      ('gdo_whatsapp_presets', 'id_gdowhatsappreset'),
      ('utenti_guest', 'id_UtentiGuest'),
      ('tipi_export', 'modalita_tipiexport'),
      ('utenti', 'tipo_utenti'),
      ('utenti', 'createdat'),
      ('utenti', 'updatedat')
    ) AS v(tabella, colonna)
  LOOP
    -- Solo dove la colonna c'e' ed e' ancora facoltativa
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tabella
        AND column_name = r.colonna AND is_nullable = 'YES'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IS NULL', r.tabella, r.colonna) INTO nulli;
    IF nulli > 0 THEN
      RAISE NOTICE 'Colonna %.%: % righe NULL, resta facoltativa (da correggere a mano)', r.tabella, r.colonna, nulli;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET NOT NULL', r.tabella, r.colonna);
    RAISE NOTICE 'Colonna %.%: ora obbligatoria', r.tabella, r.colonna;
  END LOOP;
END $$;
