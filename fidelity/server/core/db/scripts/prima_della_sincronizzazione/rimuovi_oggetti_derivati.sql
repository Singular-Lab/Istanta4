-- Rimozione degli oggetti derivati dalle tabelle, PRIMA della sincronizzazione
-- dei modelli.
--
-- Una view o una materialized view che legge una colonna impedisce a PostgreSQL
-- di cambiarne il tipo: con le view presenti, l'ALTER di models:sync falliva per
-- GDO, Area, Utente, Attivita, Canale e CombinazioneCanaleArea ("non e'
-- possibile cambiare il tipo di una colonna usata in una vista o una regola"),
-- e le colonne aggiunte da una versione nuova non arrivavano mai nel database.
--
-- Qui si eliminano tutte, e gli script della cartella superiore le ricreano
-- dopo la sincronizzazione, con i dati presenti. Sono solo oggetti derivati:
-- nessun dato va perso.
--
-- L'elenco comprende anche gli oggetti che le versioni precedenti creavano e
-- che oggi non servono piu': sulle installazioni esistenti sono ancora li', e
-- bloccherebbero l'ALTER allo stesso modo.

-- Materialized view
DROP MATERIALIZED VIEW IF EXISTS public.mv_utenti_completi CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_aree_canali_combinazioni CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_combinazioni_ottimizzata CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_canali_ottimizzata CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_aree_ottimizzata CASCADE;

-- View
DROP VIEW IF EXISTS public.v_attivita CASCADE;
DROP VIEW IF EXISTS public.v_utenti_completi_filtered CASCADE;
DROP VIEW IF EXISTS public.v_combinazioni_canale_area_stats CASCADE;
DROP VIEW IF EXISTS public.v_dashboard_utenti_attivita CASCADE;
DROP VIEW IF EXISTS public.v_ordini_stampa_dettagli CASCADE;
DROP VIEW IF EXISTS public.v_punti_vendita_completa CASCADE;
DROP VIEW IF EXISTS public.v_tracciati_completi CASCADE;
DROP VIEW IF EXISTS public.v_webhook_statistiche CASCADE;

-- Funzioni delle versioni precedenti che nessuno chiama piu'
DROP FUNCTION IF EXISTS public.refresh_all_materialized_views();
DROP FUNCTION IF EXISTS public.refresh_mv_aree_canali_combinazioni();
DROP FUNCTION IF EXISTS public.sp_report_promozione(TEXT, TEXT, DATE, DATE, TEXT);
