-- schema-dopo: de4b2d71fe8bba59e5475121a8ee183ab4a9ad0dd87b16ef284aa3faca667e52
-- Date con fuso orario (TIMESTAMP WITH TIME ZONE, come DataTypes.DATE dei
-- modelli) sulle installazioni dove sono ancora TIMESTAMP senza fuso: una volta sola.
--
-- Un TIMESTAMP senza fuso contiene un'ora "da orologio": per convertirlo bisogna
-- sapere in quale fuso l'ha scritta chi l'ha scritta (USING col AT TIME ZONE).
-- Qui scrive sempre l'applicazione, con una connessione di Sequelize, e:
-- - Sequelize apre ogni connessione con SET TIME ZONE INTERVAL '+00:00'
--   (opzione timezone di default, keepDefaultTimezone non impostata:
--   sequelize/lib/dialects/postgres/connection-manager.js). In quelle sessioni
--   anche CURRENT_TIMESTAMP dei default delle colonne e NOW() del trigger
--   update_timestamp_trigger (NEW.updatedAt = NOW()) diventano, in una colonna
--   senza fuso, l'ora UTC, non quella di Europe/Rome del server;
-- - le date JavaScript Sequelize le scrive come '... +00:00', e in una colonna
--   senza fuso PostgreSQL ignora lo scostamento: di nuovo l'ora UTC.
-- Il fuso del server (Europe/Rome) vale solo per le sessioni aperte a mano
-- (psql), che queste colonne non le scrivono. Quindi UTC per tutte:
-- - attivita.createdat: data JS di ServerUtils.CREA_ATTIVITA (createdat: new Date()).
-- - attivita.updatedat: nessuno la assegna; default CURRENT_TIMESTAMP
--   all'INSERT, nella sessione di Sequelize.
-- - attivita.expires_at: data JS dell'hook beforeCreate (calcolaExpiresAt).
-- - combinazione_canale_area.createdat/updatedat: date JS di
--   CombinazioneAreeCanaliService; updatedat anche dal trigger, nella sessione
--   di Sequelize.
-- - ordini_stampa.createdat: creaOrdineStampa/creaOrdineDiStampa non la
--   assegnavano, quindi default CURRENT_TIMESTAMP nella sessione di Sequelize.
-- - ordini_stampa.updatedat: default all'INSERT come sopra, poi date JS del
--   blocco dell'invio FTP (prenotaInvio, rinnovaBloccoInvio).
-- - utenti.createdat/updatedat: timestamps del modello Utente (date JS) e
--   trigger update_timestamp_trigger, nella sessione di Sequelize.
-- Controllo sui dati: createdat (default) e data_di_conferma_ordinistampa (data
-- JS, con fuso) di ordini_stampa nascono nello stesso INSERT, come createdat
-- (data JS) e updatedat (default) di attivita: una differenza vicina a zero
-- conferma UTC, una di 1-2 ore vorrebbe dire Europe/Rome.
--
-- Fino a qui node-pg leggeva queste colonne come ora locale del processo
-- (Europe/Rome), cioe' 1-2 ore indietro: per esempio il blocco IN_INVIO degli
-- ordini di stampa sembrava piu' vecchio di quanto fosse. Dopo la conversione
-- si legge l'istante esatto.
--
-- I default CURRENT_TIMESTAMP restano: PostgreSQL toglie il cast implicito e li
-- riporta al tipo nuovo. Una sola ALTER per tabella: una sola riscrittura.
-- Solo le colonne ancora senza fuso: sui database della baseline non fa nulla.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT v.tabella,
      string_agg(
        format('ALTER COLUMN %1$I TYPE TIMESTAMP WITH TIME ZONE USING %1$I AT TIME ZONE %2$L', v.colonna, v.fuso),
        ', ' ORDER BY v.ordine) AS modifiche,
      string_agg(format('%s (%s)', v.colonna, v.fuso), ', ' ORDER BY v.ordine) AS colonne
    FROM (VALUES
      (1, 'attivita', 'createdat', 'UTC'),
      (2, 'attivita', 'updatedat', 'UTC'),
      (3, 'attivita', 'expires_at', 'UTC'),
      (4, 'combinazione_canale_area', 'createdat', 'UTC'),
      (5, 'combinazione_canale_area', 'updatedat', 'UTC'),
      (6, 'ordini_stampa', 'createdat', 'UTC'),
      (7, 'ordini_stampa', 'updatedat', 'UTC'),
      (8, 'utenti', 'createdat', 'UTC'),
      (9, 'utenti', 'updatedat', 'UTC')
    ) AS v(ordine, tabella, colonna, fuso)
    JOIN information_schema.columns c
      ON c.table_schema = 'public' AND c.table_name = v.tabella AND c.column_name = v.colonna
    WHERE c.data_type = 'timestamp without time zone'
    GROUP BY v.tabella
  LOOP
    EXECUTE format('ALTER TABLE public.%I %s', r.tabella, r.modifiche);
    RAISE NOTICE 'Tabella %: % convertite in TIMESTAMP WITH TIME ZONE', r.tabella, r.colonne;
  END LOOP;
END $$;
