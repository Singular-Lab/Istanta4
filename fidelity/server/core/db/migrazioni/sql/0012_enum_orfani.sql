-- schema-dopo: de4b2d71fe8bba59e5475121a8ee183ab4a9ad0dd87b16ef284aa3faca667e52
-- Enum che nessuno usa piu': una volta sola.
--
-- Sulle installazioni vecchie restano tipi enum senza colonne: quelli delle
-- colonne eliminate o convertite (per esempio "enum_utenti_sesso_Utenti" dopo
-- 0009, o i tipi delle versioni precedenti che 0004 non ha eliminato perche'
-- allora ancora usati) e quelli lasciati dagli ALTER falliti di Sequelize. Non
-- servono e yarn migrazioni:verifica li elenca.
--
-- Un enum dello schema public si elimina solo se:
-- 1. non e' un enum dei modelli: l'elenco qui sotto e' quello di schema.json
--    quando questa migrazione e' stata scritta (gli stessi della baseline);
--    quelli dei modelli si tengono anche se nessuna colonna li usa;
-- 2. nessuna colonna lo usa, ne' direttamente ne' come array (di qualunque
--    tabella, vista o tipo composto, in qualunque schema);
-- 3. nient'altro dipende da lui o dal suo tipo array (pg_depend: domini,
--    funzioni, tipi range o composti) e non appartiene a un'estensione.
-- DROP TYPE senza CASCADE: se qualcosa lo usa comunque, resta con un avviso.
-- Sui database creati dalla baseline ci sono solo gli enum dei modelli: non fa nulla.
DO $$
DECLARE
  r RECORD;
  modelli TEXT[] := ARRAY[
    'enum_attivita_categoria_attivita',
    'enum_attivita_priorita_attivita',
    'enum_attivita_tipo_attivita',
    'enum_auth_providers_tipo',
    'enum_canali_interazione_stato_canaliinterazione',
    'enum_canali_interazione_tipo_canaliinterazione',
    'enum_combinazione_canale_area_stato_combinazione_canale_area',
    'enum_design_kit_tipo',
    'enum_display_context_punto_vendita_endpoint_type_display_contex',
    'enum_display_context_punto_vendita_render_type_display_context',
    'enum_files_runtime_log_stato',
    'enum_filter_templates_endpoint_type',
    'enum_filter_templates_render_type',
    'enum_gdo_whatsapp_conversations_last_direction_gdowhatsappconve',
    'enum_gdo_whatsapp_message_queue_status_whatsapp_queue_job',
    'enum_gdo_whatsapp_messages_direction_gdowhatsappmessage',
    'enum_gdo_whatsapp_messages_status_gdowhatsappmessage',
    'enum_gdo_whatsapp_messages_type_gdowhatsappmessage',
    'enum_gdo_whatsapp_numbers_provider_gdowhatsappnumbers',
    'enum_gdo_whatsapp_numbers_stato_gdowhatsappnumbers',
    'enum_gdo_whatsapp_template_categoria_template_gdowhatsapptempla',
    'enum_gdo_whatsapp_template_stato_meta_gdowhatsapptemplate',
    'enum_hub_news_tipo',
    'enum_hub_services_tipo_url',
    'enum_menu_items_tipo',
    'enum_menu_items_tipo_utente',
    'enum_ordini_stampa_stato_ordinistampa',
    'enum_permessi_categoria',
    'enum_permessi_ruolo_gdo_tipo_utente',
    'enum_permessi_ruolo_tipo_utente',
    'enum_promo_stato',
    'enum_raccoglitore_kit_tipo',
    'enum_runtime_kit_stato_lavorazione',
    'enum_runtime_kit_tipo',
    'enum_tentativi_webhook_stato_tentativo',
    'enum_tipi_export_modalita_tipiexport',
    'enum_tracciati_momento_confronti_tipo',
    'enum_utenti_sesso_utenti',
    'enum_utenti_stato_utenti',
    'enum_utenti_tipo_utenti',
    'enum_webhooks_stato_webhook'
  ];
BEGIN
  FOR r IN
    SELECT t.oid, t.typname, t.typarray
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
      AND NOT (t.typname = ANY (modelli))
    ORDER BY t.typname
  LOOP
    -- 2. Colonne che lo usano, anche come array
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.atttypid IN (r.oid, r.typarray) AND a.attnum > 0 AND NOT a.attisdropped
    ) THEN
      RAISE NOTICE 'Enum %: usato da una colonna, si tiene', quote_ident(r.typname);
      CONTINUE;
    END IF;

    -- 3. Altri oggetti che dipendono dal tipo o dal suo array (il tipo array,
    -- che dipende dal suo elemento, non conta) ed estensioni
    IF EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.refclassid = 'pg_type'::regclass AND d.refobjid IN (r.oid, r.typarray)
        AND NOT (d.classid = 'pg_type'::regclass AND d.objid = r.typarray)
    ) OR EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_type'::regclass AND d.objid = r.oid AND d.deptype = 'e'
    ) THEN
      RAISE NOTICE 'Enum %: usato da altri oggetti, si tiene', quote_ident(r.typname);
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format('DROP TYPE public.%I', r.typname);
      RAISE NOTICE 'Enum %: non usato, eliminato', quote_ident(r.typname);
    EXCEPTION WHEN dependent_objects_still_exist THEN
      RAISE NOTICE 'Enum %: usato da altri oggetti, si tiene', quote_ident(r.typname);
    END;
  END LOOP;
END $$;
