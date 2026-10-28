-- schema-dopo: 8eea939c7540ae1b1647a64678509ae6790461f9cbbedb63b14841676938be8d
-- Baseline dello schema di Fidelity: 68 tabelle, 41 tipi enum, 195 indici.
-- Generata dai modelli Sequelize con `yarn migrazioni:baseline`, tabelle in ordine di chiave esterna.
-- Su un database vuoto crea tutto; su un database esistente non si esegue: viene registrata come
-- adottata. E' congelata: le modifiche allo schema vanno in una migrazione nuova.
-- Fuori dalla baseline: tabelle ponte di belongsToMany, sessions, accessi_stato (0001), view e
-- materialized view (oggetti derivati), indici univoci con COALESCE dei permessi (0001, che
-- sostituisce con lo stesso nome l'indice univoco del modello permessi_ruolo).

-- Estensioni: di solito le crea lo script di inizializzazione del container PostgreSQL
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Estensione uuid-ossp assente e non creabile dall''utente %: %. Va creata da un superuser: CREATE EXTENSION "uuid-ossp";', current_user, SQLERRM;
    END;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS "postgis";
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Estensione postgis assente e non creabile dall''utente %: %. Va creata da un superuser: CREATE EXTENSION "postgis";', current_user, SQLERRM;
    END;
  END IF;
END $$;

-- Tipi enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_attivita_categoria_attivita' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_attivita_categoria_attivita" AS ENUM ('ACCOUNT', 'PRODUZIONE', 'PUBBLICAZIONE', 'STAMPA', 'INTEGRAZIONI');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_attivita_priorita_attivita' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_attivita_priorita_attivita" AS ENUM ('ALTA', 'MEDIA', 'BASSA');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_attivita_tipo_attivita' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_attivita_tipo_attivita" AS ENUM ('CREAZIONE_UTENTE', 'ELIMINAZIONE_UTENTE', 'CREAZIONE_RUNTIME_KIT_AUTOMATICO', 'CREAZIONE_RUNTIME_KIT_MANUALE', 'UPLOAD_FILE_MANUALE', 'MODIFICA_WORKSPACE_WEBPLIANT', 'CREAZIONE_DESIGN_KIT', 'IMPORT_TRACCIATO', 'CREAZIONE_LAVORAZIONE', 'PUBBLICAZIONE_WEBPLIANT', 'RICHIESTA_WEBPLIANT', 'CREAZIONE_ORDINE_DI_STAMPA', 'INVIO_FILES_FTP', 'INVIO_FILE_CORREGGO', 'PUBBLICAZIONE_FILE_CORREGGO');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_auth_providers_tipo' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_auth_providers_tipo" AS ENUM ('internal', 'oidc', 'saml', 'custom');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_canali_interazione_stato_canaliinterazione' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_canali_interazione_stato_canaliinterazione" AS ENUM ('ATTIVO', 'DISATTIVO', 'SOSPESO', 'ELIMINATO');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_canali_interazione_tipo_canaliinterazione' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_canali_interazione_tipo_canaliinterazione" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS', 'TELEGRAM', 'LINKEDIN', 'FACEBOOK', 'GOOGLE', 'INSTAGRAM', 'APPLE');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_combinazione_canale_area_stato_combinazione_canale_area' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_combinazione_canale_area_stato_combinazione_canale_area" AS ENUM ('ATTIVO', 'DISATTIVO');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_design_kit_tipo' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_design_kit_tipo" AS ENUM ('AUTOMATICO', 'MANUALE', 'SEMI_AUTOMATICO');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_display_context_punto_vendita_endpoint_type_display_contex' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_display_context_punto_vendita_endpoint_type_display_contex" AS ENUM ('files');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_display_context_punto_vendita_render_type_display_context' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_display_context_punto_vendita_render_type_display_context" AS ENUM ('carousel', 'grid');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_files_runtime_log_stato' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_files_runtime_log_stato" AS ENUM ('IN_ATTESA', 'IN_REVISIONE', 'ACCETTATO', 'ERRORE', 'PUBBLICATO', 'IN_ATTESA_DI_CORREGGO', 'CORREGGO_PUBBLICATO', 'CORREGGO_ERRORE');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_filter_templates_endpoint_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_filter_templates_endpoint_type" AS ENUM ('refs', 'refs-html', 'files');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_filter_templates_render_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_filter_templates_render_type" AS ENUM ('carousel', 'grid', 'list');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_gdo_whatsapp_conversations_last_direction_gdowhatsappconve' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_gdo_whatsapp_conversations_last_direction_gdowhatsappconve" AS ENUM ('in', 'out');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_gdo_whatsapp_message_queue_status_whatsapp_queue_job' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_gdo_whatsapp_message_queue_status_whatsapp_queue_job" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_gdo_whatsapp_messages_direction_gdowhatsappmessage' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_gdo_whatsapp_messages_direction_gdowhatsappmessage" AS ENUM ('in', 'out');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_gdo_whatsapp_messages_status_gdowhatsappmessage' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_gdo_whatsapp_messages_status_gdowhatsappmessage" AS ENUM ('sent', 'delivered', 'read', 'failed');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_gdo_whatsapp_messages_type_gdowhatsappmessage' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_gdo_whatsapp_messages_type_gdowhatsappmessage" AS ENUM ('text', 'template', 'image', 'doc');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_gdo_whatsapp_numbers_provider_gdowhatsappnumbers' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_gdo_whatsapp_numbers_provider_gdowhatsappnumbers" AS ENUM ('META');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_gdo_whatsapp_numbers_stato_gdowhatsappnumbers' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_gdo_whatsapp_numbers_stato_gdowhatsappnumbers" AS ENUM ('PENDING', 'VERIFIED', 'PAUSED');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_gdo_whatsapp_template_categoria_template_gdowhatsapptempla' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_gdo_whatsapp_template_categoria_template_gdowhatsapptempla" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION', 'TRANSACTIONAL', 'SERVICE');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_gdo_whatsapp_template_stato_meta_gdowhatsapptemplate' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_gdo_whatsapp_template_stato_meta_gdowhatsapptemplate" AS ENUM ('APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED', 'DELETED', 'ARCHIVED', 'PENDING_DELETION', 'IN_APPEAL', 'LIMIT_EXCEEDED', 'CREATED_BUT_NOT_SYNCED');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_hub_news_tipo' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_hub_news_tipo" AS ENUM ('info', 'warning', 'success', 'update');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_hub_services_tipo_url' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_hub_services_tipo_url" AS ENUM ('internal', 'external', 'external_fico');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_menu_items_tipo' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_menu_items_tipo" AS ENUM ('separator', 'item');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_menu_items_tipo_utente' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_menu_items_tipo_utente" AS ENUM ('Superadmin', 'Agenzia', 'Guest', 'PuntoVendita', 'GDO', 'Category', 'Marketing', 'IT');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_ordini_stampa_stato_ordinistampa' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_ordini_stampa_stato_ordinistampa" AS ENUM ('ERRORE', 'IN_REVISIONE', 'IN_INVIO', 'REVISIONATO', 'FINITO');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_permessi_categoria' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_permessi_categoria" AS ENUM ('PAGINA', 'AZIONE');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_permessi_ruolo_gdo_tipo_utente' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_permessi_ruolo_gdo_tipo_utente" AS ENUM ('Superadmin', 'Agenzia', 'Guest', 'PuntoVendita', 'GDO', 'Category', 'Marketing', 'IT');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_permessi_ruolo_tipo_utente' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_permessi_ruolo_tipo_utente" AS ENUM ('Superadmin', 'Agenzia', 'Guest', 'PuntoVendita', 'GDO', 'Category', 'Marketing', 'IT');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_promo_stato' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_promo_stato" AS ENUM ('PIANIFICATA', 'IN_LAVORAZIONE', 'IN_SCADENZA', 'IN_ATTESA_DI_VALIDITA', 'IN_RITARDO', 'VALIDA', 'VALIDA_CON_ERRORI', 'ARCHIVIATA', 'ELIMINATA');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_raccoglitore_kit_tipo' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_raccoglitore_kit_tipo" AS ENUM ('AUTOMATICO', 'MANUALE', 'SEMI_AUTOMATICO');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_runtime_kit_stato_lavorazione' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_runtime_kit_stato_lavorazione" AS ENUM ('IN_LAVORAZIONE', 'IN_LAVORAZIONE_CON_ERRORI', 'ELIMINATO', 'IN_REVISIONE', 'PUBBLICATO');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_runtime_kit_tipo' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_runtime_kit_tipo" AS ENUM ('AUTOMATICO', 'MANUALE', 'SEMI_AUTOMATICO');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_tentativi_webhook_stato_tentativo' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_tentativi_webhook_stato_tentativo" AS ENUM ('IN_ATTESA', 'SUCCESSO', 'FALLITO', 'RETRY', 'TIMEOUT');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_tipi_export_modalita_tipiexport' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_tipi_export_modalita_tipiexport" AS ENUM ('ESPORTA_TUTTO_INSIEME', 'ESPORTA_PER_PAGINA');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_tracciati_momento_confronti_tipo' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_tracciati_momento_confronti_tipo" AS ENUM ('lineare', 'non_lineare');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_utenti_sesso_utenti' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_utenti_sesso_utenti" AS ENUM ('UOMO', 'DONNA', 'ALTRO', 'NON BINARIO');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_utenti_stato_utenti' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_utenti_stato_utenti" AS ENUM ('ATTIVO', 'DISATTIVO', 'BLOCCATO', 'SOSPESO', 'ELIMINATO');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_utenti_tipo_utenti' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_utenti_tipo_utenti" AS ENUM ('Superadmin', 'Agenzia', 'Guest', 'PuntoVendita', 'GDO', 'Category', 'Marketing', 'IT');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'enum_webhooks_stato_webhook' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."enum_webhooks_stato_webhook" AS ENUM ('ATTIVO', 'DISATTIVO', 'ERRORE', 'SOSPESO', 'ELIMINATO');
  END IF;
END $$;

-- Tabelle e indici
CREATE TABLE IF NOT EXISTS "approfondimento_vino" (
  "id" UUID NOT NULL,
  "cantina" VARCHAR(255) NOT NULL,
  "nome" VARCHAR(255) NOT NULL,
  "codice" VARCHAR(255) NOT NULL,
  "anno" INTEGER,
  "vino" VARCHAR(255),
  "data_creazione" VARCHAR(255),
  "data_pubblicazione" VARCHAR(255),
  "provenienza" VARCHAR(255),
  "colore" VARCHAR(255),
  "profumo" TEXT,
  "gusto" TEXT,
  "tasso_alcolico" VARCHAR(255),
  "temperatura_di_servizio" VARCHAR(255),
  "abbinamenti" TEXT,
  "dettagli_cantina" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "approfondimento_vino_cantina" ON "approfondimento_vino" ("cantina");
CREATE INDEX IF NOT EXISTS "approfondimento_vino_nome" ON "approfondimento_vino" ("nome");
CREATE INDEX IF NOT EXISTS "approfondimento_vino_codice" ON "approfondimento_vino" ("codice");
CREATE INDEX IF NOT EXISTS "approfondimento_vino_anno" ON "approfondimento_vino" ("anno");
CREATE INDEX IF NOT EXISTS "approfondimento_vino_vino" ON "approfondimento_vino" ("vino");
CREATE INDEX IF NOT EXISTS "approfondimento_vino_created_at" ON "approfondimento_vino" ("createdAt");
CREATE INDEX IF NOT EXISTS "approfondimento_vino_updated_at" ON "approfondimento_vino" ("updatedAt");

CREATE TABLE IF NOT EXISTS "gdo" (
  "id_gdo" UUID DEFAULT uuid_generate_v4(),
  "nome_gdo" VARCHAR(255) NOT NULL,
  "idparent_gdo" UUID REFERENCES "gdo" ("id_gdo") ON DELETE SET NULL ON UPDATE CASCADE,
  "ragione_sociale_gdo" VARCHAR(255),
  "icona_gdo" BYTEA,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_gdo")
);

CREATE TABLE IF NOT EXISTS "aree" (
  "id_aree" UUID DEFAULT uuid_generate_v4(),
  "codice_aree" VARCHAR(255) NOT NULL,
  "nome_aree" VARCHAR(255) NOT NULL,
  "id_gdo_aree" UUID NOT NULL REFERENCES "gdo" ("id_gdo") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_aree")
);

CREATE TABLE IF NOT EXISTS "utenti" (
  "id_utenti" UUID DEFAULT uuid_generate_v4(),
  "outsider_utenti" BOOLEAN NOT NULL DEFAULT false,
  "nome_utenti" VARCHAR(100) NOT NULL,
  "cognome_utenti" VARCHAR(100) NOT NULL,
  "email_utenti" VARCHAR(255) NOT NULL,
  "password_utenti" VARCHAR(255),
  "datadinascita_utenti" DATE,
  "residenza_utenti" VARCHAR(255),
  "tipo_utenti" "public"."enum_utenti_tipo_utenti" NOT NULL,
  "stato_utenti" "public"."enum_utenti_stato_utenti" NOT NULL DEFAULT 'ATTIVO',
  "privatekey_utenti" VARCHAR(512),
  "telefono_utenti" VARCHAR(20),
  "meta_utenti" JSONB,
  "sesso_utenti" "public"."enum_utenti_sesso_utenti",
  "lat_utenti" DOUBLE PRECISION,
  "lon_utenti" DOUBLE PRECISION,
  "geom_utenti" GEOMETRY(POINT,4326),
  "createdat" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedat" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id_utenti")
);
CREATE UNIQUE INDEX IF NOT EXISTS "utenti_email_utenti" ON "utenti" ("email_utenti");
CREATE INDEX IF NOT EXISTS "utenti_tipo_utenti" ON "utenti" ("tipo_utenti");
CREATE INDEX IF NOT EXISTS "utenti_stato_utenti" ON "utenti" ("stato_utenti");
CREATE INDEX IF NOT EXISTS "utenti_nome_utenti_cognome_utenti" ON "utenti" ("nome_utenti", "cognome_utenti");
CREATE INDEX IF NOT EXISTS "utenti_meta_utenti" ON "utenti" ("meta_utenti");

CREATE TABLE IF NOT EXISTS "attivita" (
  "id_attivita" UUID DEFAULT uuid_generate_v4(),
  "idutente_attivita" UUID REFERENCES "utenti" ("id_utenti") ON DELETE SET NULL ON UPDATE CASCADE,
  "tipo_attivita" "public"."enum_attivita_tipo_attivita",
  "meta_attivita" JSONB,
  "categoria_attivita" "public"."enum_attivita_categoria_attivita",
  "priorita_attivita" "public"."enum_attivita_priorita_attivita" DEFAULT 'MEDIA',
  "expires_at" TIMESTAMP WITH TIME ZONE,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_attivita")
);

CREATE TABLE IF NOT EXISTS "canali" (
  "id_canali" UUID,
  "codice_canali" VARCHAR(255) NOT NULL,
  "nome_canali" VARCHAR(255) NOT NULL,
  "id_gdo_canali" UUID NOT NULL REFERENCES "gdo" ("id_gdo") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_canali")
);

CREATE TABLE IF NOT EXISTS "canali_interazione" (
  "id_canaliinterazione" UUID DEFAULT uuid_generate_v4(),
  "idutente_canaliinterazione" UUID REFERENCES "utenti" ("id_utenti") ON DELETE CASCADE ON UPDATE CASCADE,
  "tipo_canaliinterazione" "public"."enum_canali_interazione_tipo_canaliinterazione",
  "stato_canaliinterazione" "public"."enum_canali_interazione_stato_canaliinterazione",
  PRIMARY KEY ("id_canaliinterazione")
);

CREATE TABLE IF NOT EXISTS "combinazione_canale_area" (
  "id_combinazione_canale_area" UUID DEFAULT uuid_generate_v4(),
  "id_gdo_combinazione_canale_area" UUID NOT NULL REFERENCES "gdo" ("id_gdo") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_canale_combinazione_canale_area" UUID NOT NULL REFERENCES "canali" ("id_canali") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_area_combinazione_canale_area" UUID NOT NULL REFERENCES "aree" ("id_aree") ON DELETE CASCADE ON UPDATE CASCADE,
  "stato_combinazione_canale_area" "public"."enum_combinazione_canale_area_stato_combinazione_canale_area" NOT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_combinazione_canale_area")
);

CREATE TABLE IF NOT EXISTS "config" (
  "id" UUID NOT NULL,
  "webpliant" JSONB NOT NULL,
  "color" VARCHAR(255),
  "dashboard" JSONB,
  "dashboards_by_role" JSONB,
  "maintenance_alert" JSONB,
  "regole_menabo" JSONB,
  "id_gdo_config" UUID REFERENCES "gdo" ("id_gdo") ON DELETE SET NULL ON UPDATE CASCADE,
  "funzionalita" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "config_created_at" ON "config" ("createdAt");
CREATE INDEX IF NOT EXISTS "config_updated_at" ON "config" ("updatedAt");
CREATE INDEX IF NOT EXISTS "config_id_gdo_config" ON "config" ("id_gdo_config");

CREATE TABLE IF NOT EXISTS "contenuti_aggiuntivi_referenza" (
  "id" UUID NOT NULL,
  "id_referenza" VARCHAR(255) NOT NULL,
  "tipo_contenuto" VARCHAR(255) NOT NULL,
  "titolo" VARCHAR(255),
  "descrizione" TEXT,
  "contenuto" JSONB NOT NULL,
  "ordine" INTEGER,
  "attivo" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "contenuti_aggiuntivi_referenza_id_referenza" ON "contenuti_aggiuntivi_referenza" ("id_referenza");
CREATE INDEX IF NOT EXISTS "contenuti_aggiuntivi_referenza_tipo_contenuto" ON "contenuti_aggiuntivi_referenza" ("tipo_contenuto");
CREATE INDEX IF NOT EXISTS "contenuti_aggiuntivi_referenza_attivo" ON "contenuti_aggiuntivi_referenza" ("attivo");
CREATE INDEX IF NOT EXISTS "contenuti_aggiuntivi_referenza_ordine" ON "contenuti_aggiuntivi_referenza" ("ordine");
CREATE INDEX IF NOT EXISTS "contenuti_aggiuntivi_referenza_created_at" ON "contenuti_aggiuntivi_referenza" ("createdAt");
CREATE INDEX IF NOT EXISTS "contenuti_aggiuntivi_referenza_updated_at" ON "contenuti_aggiuntivi_referenza" ("updatedAt");

CREATE TABLE IF NOT EXISTS "contratto_tipografia" (
  "id_contrattotipografia" UUID DEFAULT uuid_generate_v4(),
  "tipiexport_contrattotipografia" VARCHAR(255)[] NOT NULL,
  "nome_contrattotipografia" VARCHAR(255) NOT NULL,
  "id_gdo_contrattotipografia" UUID NOT NULL,
  "user_ftp_contrattotipografia" VARCHAR(255),
  "host_ftp_contrattotipografia" VARCHAR(255),
  "pwd_ftp_contrattotipografia" VARCHAR(255),
  "port_ftp_contrattotipografia" INTEGER,
  "json_contrattotipografia" JSONB,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_contrattotipografia")
);

CREATE TABLE IF NOT EXISTS "formati" (
  "id_formati" UUID DEFAULT uuid_generate_v4(),
  "nome_formati" VARCHAR(255) NOT NULL,
  "codice_formati" VARCHAR(255) NOT NULL,
  "descrizione_formati" VARCHAR(255) NOT NULL,
  "tipo_lavorazione_formati" INTEGER NOT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_formati")
);

CREATE TABLE IF NOT EXISTS "raccoglitore_kit" (
  "id" UUID NOT NULL,
  "id_aree" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "id_canali" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "id_formato" UUID NOT NULL REFERENCES "formati" ("id_formati") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_pv" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "titolo" VARCHAR(255) NOT NULL,
  "filtro" JSONB NOT NULL DEFAULT '[]',
  "declinazioni" JSONB NOT NULL DEFAULT '[]',
  "tipi_di_export_in_kit" JSONB NOT NULL DEFAULT '[]',
  "quantita" INTEGER NOT NULL DEFAULT 1,
  "tipo" "public"."enum_raccoglitore_kit_tipo" NOT NULL,
  "files" JSONB NOT NULL DEFAULT '[]',
  "filtro_contesto" JSONB NOT NULL DEFAULT '[]',
  "tags" VARCHAR(255)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(255)[],
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "raccoglitore_kit_tipo" ON "raccoglitore_kit" ("tipo");
CREATE INDEX IF NOT EXISTS "raccoglitore_kit_created_at" ON "raccoglitore_kit" ("createdAt");
CREATE INDEX IF NOT EXISTS "raccoglitore_kit_updated_at" ON "raccoglitore_kit" ("updatedAt");

CREATE TABLE IF NOT EXISTS "design_kit" (
  "id" UUID NOT NULL,
  "id_area" UUID NOT NULL REFERENCES "aree" ("id_aree") ON DELETE CASCADE ON UPDATE CASCADE,
  "filtro" JSONB NOT NULL DEFAULT '[]',
  "id_canale" UUID NOT NULL REFERENCES "canali" ("id_canali") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_formato" UUID NOT NULL REFERENCES "formati" ("id_formati") ON DELETE CASCADE ON UPDATE CASCADE,
  "tipi_di_export_in_kit" JSONB NOT NULL DEFAULT '[]',
  "quantita_copie" INTEGER NOT NULL DEFAULT 1,
  "titolo" VARCHAR(255) NOT NULL,
  "id_raccoglitore" UUID NOT NULL REFERENCES "raccoglitore_kit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "stato" VARCHAR(255) NOT NULL,
  "declinazioni" JSONB NOT NULL DEFAULT '[]',
  "context" JSONB NOT NULL DEFAULT '[]',
  "tipo" "public"."enum_design_kit_tipo" NOT NULL,
  "filtro_contesto" JSONB NOT NULL DEFAULT '[]',
  "tags" VARCHAR(255)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(255)[],
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "design_kit_id_area" ON "design_kit" ("id_area");
CREATE INDEX IF NOT EXISTS "design_kit_id_canale" ON "design_kit" ("id_canale");
CREATE INDEX IF NOT EXISTS "design_kit_id_formato" ON "design_kit" ("id_formato");
CREATE INDEX IF NOT EXISTS "design_kit_id_raccoglitore" ON "design_kit" ("id_raccoglitore");
CREATE INDEX IF NOT EXISTS "design_kit_tipo" ON "design_kit" ("tipo");
CREATE INDEX IF NOT EXISTS "design_kit_stato" ON "design_kit" ("stato");
CREATE INDEX IF NOT EXISTS "design_kit_created_at" ON "design_kit" ("createdAt");
CREATE INDEX IF NOT EXISTS "design_kit_updated_at" ON "design_kit" ("updatedAt");

CREATE TABLE IF NOT EXISTS "promo" (
  "id_promo" VARCHAR(255) NOT NULL DEFAULT uuid_generate_v4(),
  "nome_promo" VARCHAR(255) NOT NULL,
  "data_registrazione" TIMESTAMP WITH TIME ZONE NOT NULL,
  "validita_dal" TIMESTAMP WITH TIME ZONE NOT NULL,
  "validita_al" TIMESTAMP WITH TIME ZONE NOT NULL,
  "data_scadenza" TIMESTAMP WITH TIME ZONE,
  "offset_visibilita" INTEGER NOT NULL,
  "stato" "public"."enum_promo_stato" NOT NULL,
  "context" JSONB NOT NULL DEFAULT '{}',
  "menabo_layout" JSONB DEFAULT NULL,
  "meta" JSONB NOT NULL DEFAULT '{}',
  "gdo" VARCHAR(255) NOT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_promo")
);

CREATE TABLE IF NOT EXISTS "runtime_kit" (
  "id" UUID NOT NULL,
  "id_area" UUID NOT NULL REFERENCES "aree" ("id_aree") ON DELETE CASCADE ON UPDATE CASCADE,
  "filtro" JSONB NOT NULL DEFAULT '[]',
  "filtro_contesto" JSONB NOT NULL DEFAULT '[]',
  "id_design" UUID NOT NULL REFERENCES "design_kit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_canale" UUID NOT NULL REFERENCES "canali" ("id_canali") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_formato" UUID NOT NULL REFERENCES "formati" ("id_formati") ON DELETE CASCADE ON UPDATE CASCADE,
  "tipi_di_export_in_kit" JSONB NOT NULL DEFAULT '[]',
  "quantita_copie" INTEGER NOT NULL DEFAULT 1,
  "titolo" VARCHAR(255) NOT NULL,
  "id_raccoglitore" UUID NOT NULL REFERENCES "raccoglitore_kit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "stato" VARCHAR(255) NOT NULL,
  "id_promo" VARCHAR(255) NOT NULL REFERENCES "promo" ("id_promo") ON DELETE CASCADE ON UPDATE CASCADE,
  "tipo" "public"."enum_runtime_kit_tipo" NOT NULL,
  "nome_area" VARCHAR(255),
  "nome_canale" VARCHAR(255),
  "codice_area" VARCHAR(255),
  "codice_canale" VARCHAR(255),
  "webpliant" JSONB DEFAULT '[]',
  "declinazioni" JSONB DEFAULT '[]',
  "stato_lavorazione" "public"."enum_runtime_kit_stato_lavorazione" NOT NULL,
  "files_data" JSONB NOT NULL DEFAULT '[]',
  "inizio_lavorazione" TIMESTAMP WITH TIME ZONE,
  "fine_lavorazione" TIMESTAMP WITH TIME ZONE,
  "tags" VARCHAR(255)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(255)[],
  "import_storico" JSONB DEFAULT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "runtime_kit_id_area" ON "runtime_kit" ("id_area");
CREATE INDEX IF NOT EXISTS "runtime_kit_id_canale" ON "runtime_kit" ("id_canale");
CREATE INDEX IF NOT EXISTS "runtime_kit_id_formato" ON "runtime_kit" ("id_formato");
CREATE INDEX IF NOT EXISTS "runtime_kit_id_design" ON "runtime_kit" ("id_design");
CREATE INDEX IF NOT EXISTS "runtime_kit_id_raccoglitore" ON "runtime_kit" ("id_raccoglitore");
CREATE INDEX IF NOT EXISTS "runtime_kit_id_promo" ON "runtime_kit" ("id_promo");
CREATE INDEX IF NOT EXISTS "runtime_kit_tipo" ON "runtime_kit" ("tipo");
CREATE INDEX IF NOT EXISTS "runtime_kit_stato" ON "runtime_kit" ("stato");
CREATE INDEX IF NOT EXISTS "runtime_kit_stato_lavorazione" ON "runtime_kit" ("stato_lavorazione");
CREATE INDEX IF NOT EXISTS "runtime_kit_created_at" ON "runtime_kit" ("createdAt");
CREATE INDEX IF NOT EXISTS "runtime_kit_updated_at" ON "runtime_kit" ("updatedAt");

CREATE TABLE IF NOT EXISTS "files_runtime" (
  "id" UUID NOT NULL,
  "url" TEXT,
  "id_runtime" UUID REFERENCES "runtime_kit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "direttive" TEXT,
  "nome" VARCHAR(255),
  "nome_originale" VARCHAR(255),
  "is_optional" BOOLEAN DEFAULT false,
  "id_olimpo_cloud" VARCHAR(255),
  "meta_olimpo_cloud" JSONB,
  "tipo_export" VARCHAR(255),
  "blob" TEXT,
  "mime" VARCHAR(255),
  "error" TEXT,
  "pages" INTEGER,
  "is_merged_group" BOOLEAN DEFAULT false,
  "merged_group_id" VARCHAR(255),
  "merged_file_ids" VARCHAR(255)[] DEFAULT ARRAY[]::VARCHAR(255)[],
  "virtual_dir" JSONB,
  "tipo_export_codice" VARCHAR(255),
  "id_ordine_stampa" VARCHAR(255),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "files_runtime_id_runtime" ON "files_runtime" ("id_runtime");
CREATE INDEX IF NOT EXISTS "files_runtime_nome" ON "files_runtime" ("nome");
CREATE INDEX IF NOT EXISTS "files_runtime_tipo_export" ON "files_runtime" ("tipo_export");
CREATE INDEX IF NOT EXISTS "files_runtime_is_optional" ON "files_runtime" ("is_optional");
CREATE INDEX IF NOT EXISTS "files_runtime_created_at" ON "files_runtime" ("createdAt");
CREATE INDEX IF NOT EXISTS "files_runtime_updated_at" ON "files_runtime" ("updatedAt");
CREATE INDEX IF NOT EXISTS "files_runtime_tipo_export_codice" ON "files_runtime" ("tipo_export_codice");
CREATE INDEX IF NOT EXISTS "files_runtime_id_ordine_stampa_is_merged_group" ON "files_runtime" ("id_ordine_stampa", "is_merged_group");

CREATE TABLE IF NOT EXISTS "files_runtime_log" (
  "id" UUID NOT NULL,
  "id_kit_runtime" UUID NOT NULL REFERENCES "runtime_kit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "nome_file" VARCHAR(255) NOT NULL,
  "data_registrazione" TIMESTAMP WITH TIME ZONE NOT NULL,
  "versione" INTEGER NOT NULL,
  "stato" "public"."enum_files_runtime_log_stato" NOT NULL,
  "logs" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "files_runtime_log_id_kit_runtime" ON "files_runtime_log" ("id_kit_runtime");
CREATE INDEX IF NOT EXISTS "files_runtime_log_nome_file" ON "files_runtime_log" ("nome_file");
CREATE INDEX IF NOT EXISTS "files_runtime_log_stato" ON "files_runtime_log" ("stato");
CREATE INDEX IF NOT EXISTS "files_runtime_log_data_registrazione" ON "files_runtime_log" ("data_registrazione");
CREATE INDEX IF NOT EXISTS "files_runtime_log_versione" ON "files_runtime_log" ("versione");
CREATE INDEX IF NOT EXISTS "files_runtime_log_created_at" ON "files_runtime_log" ("createdAt");
CREATE INDEX IF NOT EXISTS "files_runtime_log_updated_at" ON "files_runtime_log" ("updatedAt");

CREATE TABLE IF NOT EXISTS "naming_convention" (
  "id_naming_convention" UUID DEFAULT uuid_generate_v4(),
  "nome_naming_convention" VARCHAR(255) NOT NULL,
  "descrizione_naming_convention" VARCHAR(255) NOT NULL,
  "fields_naming_convention" VARCHAR(255)[] NOT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_naming_convention")
);

CREATE TABLE IF NOT EXISTS "ordini_stampa" (
  "id_ordinistampa" UUID DEFAULT uuid_generate_v4(),
  "idutente_ordinistampa" UUID NOT NULL REFERENCES "utenti" ("id_utenti") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_promo_ordinistampa" VARCHAR(255) NOT NULL REFERENCES "promo" ("id_promo") ON DELETE CASCADE ON UPDATE CASCADE,
  "stato_ordinistampa" "public"."enum_ordini_stampa_stato_ordinistampa" NOT NULL,
  "data_di_conferma_ordinistampa" TIMESTAMP WITH TIME ZONE NOT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_ordinistampa")
);

CREATE TABLE IF NOT EXISTS "ordini_stampa_invii" (
  "id_ordinistampainvii" UUID DEFAULT uuid_generate_v4(),
  "idutente_ordinistampainvii" UUID NOT NULL REFERENCES "utenti" ("id_utenti") ON DELETE CASCADE ON UPDATE CASCADE,
  "idordinestampa_ordinistampainvii" UUID NOT NULL REFERENCES "ordini_stampa" ("id_ordinistampa") ON DELETE CASCADE ON UPDATE CASCADE,
  "excel_ordinistampainvii" BYTEA NOT NULL,
  "report_ordinistampainvii" JSONB NOT NULL,
  "segnalazione_ordinistampainvii" VARCHAR(255) NOT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_ordinistampainvii")
);

CREATE TABLE IF NOT EXISTS "promo_scoreboard" (
  "id_promo" VARCHAR(255) NOT NULL UNIQUE,
  "report" JSONB NOT NULL,
  "computedat" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id_promo")
);

CREATE TABLE IF NOT EXISTS "punti_vendita" (
  "id_puntivendita" UUID DEFAULT uuid_generate_v4(),
  "nome_puntivendita" VARCHAR(255) NOT NULL,
  "citta_puntivendita" VARCHAR(100) NOT NULL,
  "cap_puntivendita" VARCHAR(10) NOT NULL,
  "indirizzo_puntivendita" VARCHAR(255) NOT NULL,
  "lat_puntivendita" DECIMAL(10,8),
  "lon_puntivendita" DECIMAL(11,8),
  "id_combinazione_canale_area_puntivendita" UUID NOT NULL REFERENCES "combinazione_canale_area" ("id_combinazione_canale_area") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_gdo_puntivendita" UUID NOT NULL REFERENCES "gdo" ("id_gdo") ON DELETE CASCADE ON UPDATE CASCADE,
  "ragionesociale_puntivendita" VARCHAR(255),
  "provincia_puntivendita" VARCHAR(10),
  "regione_puntivendita" VARCHAR(50),
  "telefono_puntivendita" VARCHAR(20),
  "meta_puntivendita" JSONB,
  "createdat" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedat" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id_puntivendita")
);
CREATE INDEX IF NOT EXISTS "punti_vendita_citta_puntivendita" ON "punti_vendita" ("citta_puntivendita");
CREATE INDEX IF NOT EXISTS "punti_vendita_id_gdo_puntivendita" ON "punti_vendita" ("id_gdo_puntivendita");
CREATE INDEX IF NOT EXISTS "punti_vendita_regione_puntivendita" ON "punti_vendita" ("regione_puntivendita");
CREATE INDEX IF NOT EXISTS "punti_vendita_lat_puntivendita_lon_puntivendita" ON "punti_vendita" ("lat_puntivendita", "lon_puntivendita");
CREATE INDEX IF NOT EXISTS "punti_vendita_nome_puntivendita" ON "punti_vendita" ("nome_puntivendita");

CREATE TABLE IF NOT EXISTS "display_context_punto_vendita" (
  "id_display_context" UUID DEFAULT uuid_generate_v4(),
  "nome_display_context" VARCHAR(150) NOT NULL,
  "descrizione_display_context" VARCHAR(500),
  "filters_display_context" JSONB NOT NULL DEFAULT '[]',
  "endpoint_type_display_context" "public"."enum_display_context_punto_vendita_endpoint_type_display_context" NOT NULL,
  "auto_scroll_display_context" BOOLEAN NOT NULL DEFAULT true,
  "scroll_speed_display_context" INTEGER NOT NULL DEFAULT 5000,
  "show_indicators_display_context" BOOLEAN NOT NULL DEFAULT true,
  "show_nav_buttons_display_context" BOOLEAN NOT NULL DEFAULT false,
  "render_type_display_context" "public"."enum_display_context_punto_vendita_render_type_display_context",
  "meta_options_display_context" JSONB NOT NULL DEFAULT '{}',
  "id_gdo_display_context" UUID NOT NULL REFERENCES "gdo" ("id_gdo") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_puntivendita_display_context" UUID REFERENCES "punti_vendita" ("id_puntivendita") ON DELETE SET NULL ON UPDATE CASCADE,
  "is_active_display_context" BOOLEAN NOT NULL DEFAULT true,
  "createdat" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedat" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id_display_context")
);
CREATE INDEX IF NOT EXISTS "display_context_punto_vendita_id_gdo_display_context" ON "display_context_punto_vendita" ("id_gdo_display_context");
CREATE INDEX IF NOT EXISTS "display_context_punto_vendita_id_puntivendita_display_context" ON "display_context_punto_vendita" ("id_puntivendita_display_context");
CREATE INDEX IF NOT EXISTS "display_context_punto_vendita_is_active_display_context" ON "display_context_punto_vendita" ("is_active_display_context");
CREATE INDEX IF NOT EXISTS "display_context_punto_vendita_endpoint_type_display_context" ON "display_context_punto_vendita" ("endpoint_type_display_context");
CREATE INDEX IF NOT EXISTS "display_context_pv_gdo_attivo" ON "display_context_punto_vendita" ("id_gdo_display_context", "is_active_display_context");

CREATE TABLE IF NOT EXISTS "dispositivi_punto_vendita" (
  "id_dispositivo" UUID DEFAULT uuid_generate_v4(),
  "id_puntivendita" UUID NOT NULL REFERENCES "punti_vendita" ("id_puntivendita") ON DELETE CASCADE ON UPDATE CASCADE,
  "nome_dispositivo" VARCHAR(150) NOT NULL,
  "descrizione_dispositivo" VARCHAR(255),
  "secret_dispositivo" VARCHAR(255) NOT NULL,
  "token_display_dispositivo" VARCHAR(255) NOT NULL,
  "id_display_context_dispositivo" UUID REFERENCES "display_context_punto_vendita" ("id_display_context") ON DELETE SET NULL ON UPDATE CASCADE,
  "is_active_dispositivo" BOOLEAN NOT NULL DEFAULT true,
  "last_seen_at_dispositivo" TIMESTAMP WITH TIME ZONE,
  "metadata_dispositivo" JSONB,
  "createdat" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedat" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id_dispositivo")
);
CREATE INDEX IF NOT EXISTS "dispositivi_punto_vendita_id_puntivendita" ON "dispositivi_punto_vendita" ("id_puntivendita");
CREATE UNIQUE INDEX IF NOT EXISTS "dispositivi_punto_vendita_secret_dispositivo" ON "dispositivi_punto_vendita" ("secret_dispositivo");
CREATE UNIQUE INDEX IF NOT EXISTS "dispositivi_punto_vendita_token_display_dispositivo" ON "dispositivi_punto_vendita" ("token_display_dispositivo");
CREATE INDEX IF NOT EXISTS "dispositivi_punto_vendita_id_display_context_dispositivo" ON "dispositivi_punto_vendita" ("id_display_context_dispositivo");
CREATE INDEX IF NOT EXISTS "dispositivi_punto_vendita_is_active_dispositivo" ON "dispositivi_punto_vendita" ("is_active_dispositivo");
CREATE INDEX IF NOT EXISTS "dispositivi_punto_vendita_last_seen_at_dispositivo" ON "dispositivi_punto_vendita" ("last_seen_at_dispositivo");

CREATE TABLE IF NOT EXISTS "punti_vendita_utenti" (
  "id_puntivenditautenti" UUID DEFAULT uuid_generate_v4(),
  "idutenti_puntivenditautenti" UUID NOT NULL REFERENCES "utenti" ("id_utenti") ON DELETE CASCADE ON UPDATE CASCADE,
  "idpuntivendita_puntivenditautenti" UUID NOT NULL REFERENCES "punti_vendita" ("id_puntivendita") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_puntivenditautenti")
);

CREATE TABLE IF NOT EXISTS "referenze" (
  "id" UUID NOT NULL,
  "compiled_fields" JSONB NOT NULL DEFAULT '[]',
  "deleted_fields" VARCHAR(255)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(255)[],
  "foto" VARCHAR(255)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(255)[],
  "meccanica" VARCHAR(255) NOT NULL DEFAULT '',
  "codice_box" VARCHAR(255) NOT NULL,
  "foto_extra" JSONB NOT NULL DEFAULT '[]',
  "data_fields" JSONB NOT NULL,
  "group_elements" JSONB NOT NULL DEFAULT '[]',
  "id_runtime_kit" UUID NOT NULL REFERENCES "runtime_kit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_promo" VARCHAR(255) NOT NULL REFERENCES "promo" ("id_promo") ON DELETE CASCADE ON UPDATE CASCADE,
  "pag" INTEGER,
  "x" FLOAT,
  "y" FLOAT,
  "w" FLOAT,
  "h" FLOAT,
  "w_page" FLOAT,
  "h_page" FLOAT,
  "perc_ingombro" FLOAT,
  "aspect_ratio" FLOAT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "referenze_id_runtime_kit" ON "referenze" ("id_runtime_kit");
CREATE INDEX IF NOT EXISTS "referenze_id_promo" ON "referenze" ("id_promo");
CREATE INDEX IF NOT EXISTS "referenze_codice_box" ON "referenze" ("codice_box");
CREATE INDEX IF NOT EXISTS "referenze_meccanica" ON "referenze" ("meccanica");
CREATE INDEX IF NOT EXISTS "referenze_created_at" ON "referenze" ("createdAt");
CREATE INDEX IF NOT EXISTS "referenze_updated_at" ON "referenze" ("updatedAt");

CREATE TABLE IF NOT EXISTS "referenze_gruppo" (
  "id" UUID NOT NULL,
  "guid_id_olympo" VARCHAR(255) NOT NULL,
  "codice_referenza" VARCHAR(255) NOT NULL,
  "id_area" VARCHAR(255),
  "id_canale" VARCHAR(255),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "referenze_gruppo_guid_id_olympo" ON "referenze_gruppo" ("guid_id_olympo");
CREATE INDEX IF NOT EXISTS "referenze_gruppo_codice_referenza" ON "referenze_gruppo" ("codice_referenza");
CREATE INDEX IF NOT EXISTS "referenze_gruppo_id_area" ON "referenze_gruppo" ("id_area");
CREATE INDEX IF NOT EXISTS "referenze_gruppo_id_canale" ON "referenze_gruppo" ("id_canale");
CREATE INDEX IF NOT EXISTS "referenze_gruppo_created_at" ON "referenze_gruppo" ("createdAt");
CREATE INDEX IF NOT EXISTS "referenze_gruppo_updated_at" ON "referenze_gruppo" ("updatedAt");

CREATE TABLE IF NOT EXISTS "ricette" (
  "id" UUID NOT NULL,
  "titolo" VARCHAR(255) NOT NULL,
  "ingredienti" JSONB NOT NULL DEFAULT '[]',
  "procedimento" TEXT,
  "tempo_in_secondi" VARCHAR(255),
  "costo_in_euro" VARCHAR(255),
  "tipo" VARCHAR(255) NOT NULL,
  "stato" VARCHAR(255) NOT NULL,
  "abbinamento_vino" JSONB,
  "foto_ricetta" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ricette_titolo" ON "ricette" ("titolo");
CREATE INDEX IF NOT EXISTS "ricette_tipo" ON "ricette" ("tipo");
CREATE INDEX IF NOT EXISTS "ricette_stato" ON "ricette" ("stato");
CREATE INDEX IF NOT EXISTS "ricette_created_at" ON "ricette" ("createdAt");
CREATE INDEX IF NOT EXISTS "ricette_updated_at" ON "ricette" ("updatedAt");

CREATE TABLE IF NOT EXISTS "ruolo_punto_vendita" (
  "id_ruolo_punto_vendita" UUID DEFAULT uuid_generate_v4(),
  "ruolo_ruolo_punto_vendita" VARCHAR(255) NOT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_ruolo_punto_vendita")
);

CREATE TABLE IF NOT EXISTS "statistiche_api" (
  "id_statistiche_api" SERIAL,
  "endpoint" VARCHAR(500) NOT NULL,
  "metodo" VARCHAR(10) NOT NULL,
  "codice_risposta" INTEGER NOT NULL,
  "tempo_risposta_ms" INTEGER NOT NULL,
  "dimensione_risposta_bytes" INTEGER NOT NULL DEFAULT 0,
  "ip_richiedente" VARCHAR(45) NOT NULL,
  "user_agent" TEXT,
  "ruolo_utente" VARCHAR(50),
  "api_key_utilizzata" VARCHAR(255),
  "parametri_richiesta" TEXT,
  "timestamp_richiesta" TIMESTAMP WITH TIME ZONE NOT NULL,
  "timestamp_risposta" TIMESTAMP WITH TIME ZONE NOT NULL,
  "errore" TEXT,
  "stack_trace" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id_statistiche_api")
);
COMMENT ON COLUMN "statistiche_api"."endpoint" IS 'Endpoint API chiamato';
COMMENT ON COLUMN "statistiche_api"."metodo" IS 'Metodo HTTP utilizzato (GET, POST, PUT, DELETE)';
COMMENT ON COLUMN "statistiche_api"."codice_risposta" IS 'Codice di stato HTTP della risposta';
COMMENT ON COLUMN "statistiche_api"."tempo_risposta_ms" IS 'Tempo di risposta in millisecondi';
COMMENT ON COLUMN "statistiche_api"."dimensione_risposta_bytes" IS 'Dimensione della risposta in bytes';
COMMENT ON COLUMN "statistiche_api"."ip_richiedente" IS 'Indirizzo IP del richiedente';
COMMENT ON COLUMN "statistiche_api"."user_agent" IS 'User Agent del browser/client';
COMMENT ON COLUMN "statistiche_api"."ruolo_utente" IS 'Ruolo dell''utente che ha effettuato la richiesta';
COMMENT ON COLUMN "statistiche_api"."api_key_utilizzata" IS 'Hash dell''API key utilizzata (non la chiave completa per sicurezza)';
COMMENT ON COLUMN "statistiche_api"."parametri_richiesta" IS 'Parametri della richiesta in formato JSON';
COMMENT ON COLUMN "statistiche_api"."timestamp_richiesta" IS 'Timestamp di quando è stata ricevuta la richiesta';
COMMENT ON COLUMN "statistiche_api"."timestamp_risposta" IS 'Timestamp di quando è stata inviata la risposta';
COMMENT ON COLUMN "statistiche_api"."errore" IS 'Messaggio di errore se presente';
COMMENT ON COLUMN "statistiche_api"."stack_trace" IS 'Stack trace dell''errore se presente';
CREATE INDEX IF NOT EXISTS "idx_statistiche_api_endpoint" ON "statistiche_api" ("endpoint");
CREATE INDEX IF NOT EXISTS "idx_statistiche_api_timestamp" ON "statistiche_api" ("timestamp_richiesta");
CREATE INDEX IF NOT EXISTS "idx_statistiche_api_codice_risposta" ON "statistiche_api" ("codice_risposta");
CREATE INDEX IF NOT EXISTS "idx_statistiche_api_ruolo" ON "statistiche_api" ("ruolo_utente");
CREATE INDEX IF NOT EXISTS "idx_statistiche_api_metodo" ON "statistiche_api" ("metodo");
CREATE INDEX IF NOT EXISTS "idx_statistiche_api_composite" ON "statistiche_api" ("endpoint", "metodo", "timestamp_richiesta");

CREATE TABLE IF NOT EXISTS "webhooks" (
  "id_webhook" UUID DEFAULT uuid_generate_v4(),
  "nome_webhook" VARCHAR(255) NOT NULL,
  "descrizione_webhook" TEXT,
  "url_webhook" VARCHAR(2048) NOT NULL,
  "eventi_webhook" VARCHAR(255)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(255)[],
  "stato_webhook" "public"."enum_webhooks_stato_webhook" NOT NULL DEFAULT 'ATTIVO',
  "secret_webhook" VARCHAR(512),
  "timeout_webhook" INTEGER NOT NULL DEFAULT 30000,
  "retry_count_webhook" INTEGER NOT NULL DEFAULT 3,
  "retry_delay_webhook" INTEGER NOT NULL DEFAULT 1000,
  "headers_personalizzati_webhook" JSONB,
  "createdat_webhook" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedat_webhook" TIMESTAMP WITH TIME ZONE NOT NULL,
  "createdby_webhook" VARCHAR(255) NOT NULL,
  PRIMARY KEY ("id_webhook")
);
CREATE INDEX IF NOT EXISTS "webhooks_stato_webhook" ON "webhooks" ("stato_webhook");
CREATE INDEX IF NOT EXISTS "webhooks_eventi_webhook" ON "webhooks" USING gin ("eventi_webhook");
CREATE INDEX IF NOT EXISTS "webhooks_createdby_webhook" ON "webhooks" ("createdby_webhook");

CREATE TABLE IF NOT EXISTS "tentativi_webhook" (
  "id_tentativo" UUID DEFAULT uuid_generate_v4(),
  "webhook_id_tentativo" UUID NOT NULL REFERENCES "webhooks" ("id_webhook") ON DELETE CASCADE ON UPDATE CASCADE,
  "payload_id_tentativo" UUID NOT NULL,
  "numero_tentativo_tentativo" INTEGER NOT NULL,
  "stato_tentativo" "public"."enum_tentativi_webhook_stato_tentativo" NOT NULL,
  "http_status_tentativo" INTEGER,
  "response_body_tentativo" TEXT,
  "messaggio_errore_tentativo" TEXT,
  "durata_ms_tentativo" INTEGER NOT NULL,
  "createdat_tentativo" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id_tentativo")
);
CREATE INDEX IF NOT EXISTS "tentativi_webhook_webhook_id_tentativo" ON "tentativi_webhook" ("webhook_id_tentativo");
CREATE INDEX IF NOT EXISTS "tentativi_webhook_stato_tentativo" ON "tentativi_webhook" ("stato_tentativo");
CREATE INDEX IF NOT EXISTS "tentativi_webhook_createdat_tentativo" ON "tentativi_webhook" ("createdat_tentativo");

CREATE TABLE IF NOT EXISTS "tipi_export" (
  "id_tipiexport" UUID DEFAULT uuid_generate_v4(),
  "nome_tipiexport" VARCHAR(255) NOT NULL,
  "codice_tipiexport" VARCHAR(255) NOT NULL,
  "modalita_tipiexport" "public"."enum_tipi_export_modalita_tipiexport" NOT NULL,
  "guid_namingconvention_tipiexport" UUID,
  "filtri_tipiexport" JSONB,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_tipiexport")
);

CREATE TABLE IF NOT EXISTS "tracciati" (
  "id_tracciati" UUID DEFAULT uuid_generate_v4(),
  "id_promo_tracciati" VARCHAR(255) NOT NULL REFERENCES "promo" ("id_promo") ON DELETE CASCADE ON UPDATE CASCADE,
  "context_tracciati" JSON NOT NULL,
  "filename_tracciati" VARCHAR(255) NOT NULL,
  "nome_tracciati" VARCHAR(255),
  "blobfile_tracciati" BYTEA NOT NULL,
  "stato_tracciati" VARCHAR(255),
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_tracciati")
);

CREATE TABLE IF NOT EXISTS "tracciati_momento" (
  "id" UUID DEFAULT uuid_generate_v4(),
  "id_promo" VARCHAR(255) NOT NULL,
  "nome" VARCHAR(255) NOT NULL,
  "tracciati_ids" JSONB NOT NULL DEFAULT '[]',
  "confronti_ids" JSONB NOT NULL DEFAULT '[]',
  "ordine" INTEGER NOT NULL DEFAULT 0,
  "snapshot" BOOLEAN NOT NULL DEFAULT false,
  "risultato" JSONB DEFAULT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tracciati_momento_confronti" (
  "id" UUID DEFAULT uuid_generate_v4(),
  "primario" UUID NOT NULL,
  "secondario" UUID NOT NULL,
  "tipo" "public"."enum_tracciati_momento_confronti_tipo" NOT NULL DEFAULT 'lineare',
  "risultato" JSONB DEFAULT NULL,
  "report" JSONB DEFAULT NULL,
  "terremoto_degrado_massimo" FLOAT DEFAULT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tracciati_report" (
  "id" UUID DEFAULT uuid_generate_v4(),
  "id_promo" VARCHAR(255) NOT NULL,
  "tracciati_ids" JSONB NOT NULL,
  "context" JSONB NOT NULL,
  "istanta_result" JSONB NOT NULL,
  "report" JSONB NOT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tracciati_schema" (
  "id" UUID DEFAULT uuid_generate_v4(),
  "nome" VARCHAR(255) NOT NULL,
  "tipo" VARCHAR(255)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(255)[],
  "confronti" JSONB NOT NULL DEFAULT '[]',
  "items" JSONB NOT NULL DEFAULT '[]',
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "utenti_anonimi" (
  "id_utenti_anonimi" UUID DEFAULT uuid_generate_v4(),
  "meta_utenti_anonimi" JSONB NOT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedat" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id_utenti_anonimi")
);

CREATE TABLE IF NOT EXISTS "ruolo_utente_gdo" (
  "id_ruolo_utente_gdo" UUID DEFAULT uuid_generate_v4(),
  "ruolo_ruolo_utente_gdo" VARCHAR(255) NOT NULL,
  "api_key_ruolo_utente_gdo" VARCHAR(255),
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_ruolo_utente_gdo")
);

CREATE TABLE IF NOT EXISTS "utenti_gdo" (
  "id_utentegdo" UUID DEFAULT uuid_generate_v4(),
  "id_utente_utentegdo" UUID NOT NULL REFERENCES "utenti" ("id_utenti") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_gdo_utentegdo" UUID NOT NULL REFERENCES "gdo" ("id_gdo") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_ruolo_utente_gdo" UUID REFERENCES "ruolo_utente_gdo" ("id_ruolo_utente_gdo") ON DELETE SET NULL ON UPDATE CASCADE,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_utentegdo")
);
CREATE UNIQUE INDEX IF NOT EXISTS "utenti_gdo_utente_unique" ON "utenti_gdo" ("id_utente_utentegdo");

CREATE TABLE IF NOT EXISTS "utenti_guest" (
  "id_UtentiGuest" UUID DEFAULT uuid_generate_v4(),
  "dettagliUtente_UtentiGuest" VARCHAR(255) NOT NULL,
  "origine_UtentiGuest" VARCHAR(255) NOT NULL,
  "email_UtentiGuest" VARCHAR(255) NOT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_UtentiGuest")
);

CREATE TABLE IF NOT EXISTS "gdo_whatsapp_campagne" (
  "id_whatsapp_campagna" UUID DEFAULT uuid_generate_v4(),
  "titolo_whatsapp_campagna" VARCHAR(255) NOT NULL,
  "template_id_whatsapp_campagna" UUID NOT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY ("id_whatsapp_campagna")
);
CREATE INDEX IF NOT EXISTS "idx_wa_campagne_template" ON "gdo_whatsapp_campagne" USING BTREE ("template_id_whatsapp_campagna");
CREATE INDEX IF NOT EXISTS "idx_wa_campagne_createdat" ON "gdo_whatsapp_campagne" USING BTREE ("createdat");

CREATE TABLE IF NOT EXISTS "gdo_whatsapp_conversations" (
  "id_gdowhatsappconversation" UUID DEFAULT uuid_generate_v4(),
  "id_gdo_gdowhatsappconversation" UUID NOT NULL REFERENCES "gdo" ("id_gdo") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_utente_gdowhatsappconversation" UUID NOT NULL REFERENCES "utenti" ("id_utenti") ON DELETE CASCADE ON UPDATE CASCADE,
  "finestra_aperta_gdowhatsappconversation" TIMESTAMP WITH TIME ZONE NOT NULL,
  "finestra_scadenza_gdowhatsappconversation" TIMESTAMP WITH TIME ZONE NOT NULL,
  "last_direction_gdowhatsappconversation" "public"."enum_gdo_whatsapp_conversations_last_direction_gdowhatsappconversation" NOT NULL,
  "is_open_gdowhatsappconversation" BOOLEAN NOT NULL DEFAULT true,
  "createdat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY ("id_gdowhatsappconversation")
);
CREATE INDEX IF NOT EXISTS "idx_wa_conv_scoping" ON "gdo_whatsapp_conversations" USING BTREE ("id_gdo_gdowhatsappconversation", "id_utente_gdowhatsappconversation", "is_open_gdowhatsappconversation");
CREATE INDEX IF NOT EXISTS "idx_wa_conv_updated" ON "gdo_whatsapp_conversations" USING BTREE ("updatedat");
CREATE INDEX IF NOT EXISTS "idx_wa_conv_utente" ON "gdo_whatsapp_conversations" USING BTREE ("id_utente_gdowhatsappconversation");
CREATE INDEX IF NOT EXISTS "idx_wa_conv_window" ON "gdo_whatsapp_conversations" USING BTREE ("finestra_scadenza_gdowhatsappconversation");

CREATE TABLE IF NOT EXISTS "gdo_whatsapp_message_queue" (
  "id_whatsapp_queue_job" UUID DEFAULT uuid_generate_v4(),
  "bulk_id_whatsapp_queue_job" UUID NOT NULL,
  "campagna_id_whatsapp_queue_job" UUID NOT NULL REFERENCES "gdo_whatsapp_campagne" ("id_whatsapp_campagna") ON DELETE CASCADE ON UPDATE CASCADE,
  "index_whatsapp_queue_job" INTEGER NOT NULL,
  "total_whatsapp_queue_job" INTEGER NOT NULL,
  "to_whatsapp_queue_job" VARCHAR(255) NOT NULL,
  "body_whatsapp_queue_job" JSONB NOT NULL,
  "attempts_whatsapp_queue_job" INTEGER NOT NULL DEFAULT 0,
  "max_attempts_whatsapp_queue_job" INTEGER NOT NULL DEFAULT 5,
  "status_whatsapp_queue_job" "public"."enum_gdo_whatsapp_message_queue_status_whatsapp_queue_job" NOT NULL DEFAULT 'PENDING',
  "run_at_whatsapp_queue_job" TIMESTAMP WITH TIME ZONE NOT NULL,
  "last_error_whatsapp_queue_job" TEXT,
  "wamid_whatsapp_queue_job" VARCHAR(128),
  "createdat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY ("id_whatsapp_queue_job")
);
CREATE INDEX IF NOT EXISTS "idx_wa_queue_status_runat" ON "gdo_whatsapp_message_queue" USING BTREE ("status_whatsapp_queue_job", "run_at_whatsapp_queue_job");
CREATE INDEX IF NOT EXISTS "idx_wa_queue_bulk" ON "gdo_whatsapp_message_queue" USING BTREE ("bulk_id_whatsapp_queue_job");
CREATE INDEX IF NOT EXISTS "idx_wa_queue_campagna" ON "gdo_whatsapp_message_queue" USING BTREE ("campagna_id_whatsapp_queue_job");
CREATE INDEX IF NOT EXISTS "idx_wa_queue_runat" ON "gdo_whatsapp_message_queue" USING BTREE ("run_at_whatsapp_queue_job");
CREATE INDEX IF NOT EXISTS "idx_wa_queue_status" ON "gdo_whatsapp_message_queue" USING BTREE ("status_whatsapp_queue_job");

CREATE TABLE IF NOT EXISTS "gdo_whatsapp_messages" (
  "id_gdowhatsappmessage" UUID DEFAULT uuid_generate_v4(),
  "id_conversation_gdowhatsappmessage" UUID NOT NULL REFERENCES "gdo_whatsapp_conversations" ("id_gdowhatsappconversation") ON DELETE CASCADE ON UPDATE CASCADE,
  "direction_gdowhatsappmessage" "public"."enum_gdo_whatsapp_messages_direction_gdowhatsappmessage" NOT NULL,
  "status_gdowhatsappmessage" "public"."enum_gdo_whatsapp_messages_status_gdowhatsappmessage" NOT NULL,
  "provider_msg_id_gdowhatsappmessage" VARCHAR(255),
  "from_gdowhatsappmessage" VARCHAR(255),
  "to_gdowhatsappmessage" VARCHAR(255),
  "type_gdowhatsappmessage" "public"."enum_gdo_whatsapp_messages_type_gdowhatsappmessage" NOT NULL,
  "template_name_gdowhatsappmessage" VARCHAR(255),
  "template_preset_name_gdowhatsappmessage" VARCHAR(255),
  "msg_lang_gdowhatsappmessage" VARCHAR(255),
  "msg_text_gdowhatsappmessage" TEXT,
  "media_url_gdowhatsappmessage" VARCHAR(255),
  "media_mimetype_gdowhatsappmessage" VARCHAR(255),
  "media_sha256_gdowhatsappmessage" VARCHAR(255),
  "media_filename_gdowhatsappmessage" VARCHAR(255),
  "payload_json_gdowhatsappmessage" TEXT NOT NULL,
  "tokens_gdowhatsappmessage" INTEGER,
  "error_code_gdowhatsappmessage" VARCHAR(255),
  "error_msg_gdowhatsappmessage" VARCHAR(255),
  "created_at" TIMESTAMP WITH TIME ZONE,
  "updated_at" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_gdowhatsappmessage")
);
CREATE INDEX IF NOT EXISTS "idx_gdo_msg_conv" ON "gdo_whatsapp_messages" ("id_conversation_gdowhatsappmessage");
CREATE INDEX IF NOT EXISTS "idx_gdo_msg_status" ON "gdo_whatsapp_messages" ("status_gdowhatsappmessage");
CREATE UNIQUE INDEX IF NOT EXISTS "gdo_wa_msg_provider_id_uq" ON "gdo_whatsapp_messages" ("provider_msg_id_gdowhatsappmessage");

CREATE TABLE IF NOT EXISTS "gdo_whatsapp_numbers" (
  "id_gdowhatsappnumbers" UUID DEFAULT uuid_generate_v4(),
  "id_gdo_gdowhatsappnumbers" UUID NOT NULL REFERENCES "gdo" ("id_gdo") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_numero_whatsapp_gdowhatsappnumbers" VARCHAR(255) NOT NULL,
  "display_name_gdowhatsappnumbers" VARCHAR(255) NOT NULL,
  "stato_gdowhatsappnumbers" "public"."enum_gdo_whatsapp_numbers_stato_gdowhatsappnumbers" NOT NULL,
  "whatsapp_business_account_id_gdowhatsappnumbers" VARCHAR(255),
  "provider_gdowhatsappnumbers" "public"."enum_gdo_whatsapp_numbers_provider_gdowhatsappnumbers" NOT NULL,
  "access_token_gdowhatsappnumbers" VARCHAR(255) NOT NULL,
  "verify_token_gdowhatsappnumbers" VARCHAR(255) NOT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY ("id_gdowhatsappnumbers")
);
CREATE UNIQUE INDEX IF NOT EXISTS "gdo_wa_num_phone_num_uq" ON "gdo_whatsapp_numbers" ("id_numero_whatsapp_gdowhatsappnumbers");
CREATE UNIQUE INDEX IF NOT EXISTS "gdo_wa_num_waba_id_uq" ON "gdo_whatsapp_numbers" ("whatsapp_business_account_id_gdowhatsappnumbers");
CREATE UNIQUE INDEX IF NOT EXISTS "gdo_wa_num_access_token_uq" ON "gdo_whatsapp_numbers" ("access_token_gdowhatsappnumbers");
CREATE UNIQUE INDEX IF NOT EXISTS "gdo_wa_num_verify_token_uq" ON "gdo_whatsapp_numbers" ("verify_token_gdowhatsappnumbers");

CREATE TABLE IF NOT EXISTS "gdo_whatsapp_presets" (
  "id_gdowhatsappreset" UUID DEFAULT uuid_generate_v4(),
  "id_template_gdowhatsappreset" VARCHAR(255) NOT NULL,
  "nome_preset_gdowhatsappreset" VARCHAR(255) NOT NULL,
  "is_default_gdowhatsappreset" BOOLEAN NOT NULL,
  "json_meta_gdowhatsappreset" JSON,
  "hash_gdowhatsappreset" VARCHAR(255) NOT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id_gdowhatsappreset")
);

CREATE TABLE IF NOT EXISTS "gdo_whatsapp_template" (
  "id_gdowhatsapptemplate" UUID DEFAULT uuid_generate_v4(),
  "id_gdo_gdowhatsapptemplate" UUID NOT NULL REFERENCES "gdo" ("id_gdo") ON DELETE CASCADE ON UPDATE CASCADE,
  "nome_template_gdowhatsapptemplate" VARCHAR(255) NOT NULL,
  "lingua_template_gdowhatsapptemplate" VARCHAR(255) NOT NULL,
  "stato_meta_gdowhatsapptemplate" "public"."enum_gdo_whatsapp_template_stato_meta_gdowhatsapptemplate" NOT NULL,
  "json_meta_gdowhatsapptemplate" JSONB NOT NULL,
  "categoria_template_gdowhatsapptemplate" "public"."enum_gdo_whatsapp_template_categoria_template_gdowhatsapptemplate" NOT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY ("id_gdowhatsapptemplate")
);

CREATE TABLE IF NOT EXISTS "wishlist_webpliant" (
  "id_whishlistwepliant" UUID DEFAULT uuid_generate_v4(),
  "idcanale_whishlistwepliant" UUID NOT NULL REFERENCES "canali" ("id_canali") ON DELETE CASCADE ON UPDATE CASCADE,
  "idarea_whishlistwepliant" UUID NOT NULL REFERENCES "aree" ("id_aree") ON DELETE CASCADE ON UPDATE CASCADE,
  "idpv_whishlistwepliant" UUID REFERENCES "punti_vendita" ("id_puntivendita") ON DELETE SET NULL ON UPDATE CASCADE,
  "meta_whishlistwepliant" JSONB,
  "idworkspace_whishlistwepliant" UUID,
  "idpagina_whishlistwepliant" UUID,
  PRIMARY KEY ("id_whishlistwepliant")
);

CREATE TABLE IF NOT EXISTS "workspace_webpliant" (
  "id" UUID NOT NULL,
  "id_area" VARCHAR(255),
  "id_canale" VARCHAR(255),
  "id_gdo" VARCHAR(255) NOT NULL,
  "id_pv" VARCHAR(255),
  "nome_workspace" VARCHAR(255),
  "webpliant" JSONB NOT NULL DEFAULT '[]',
  "sitemap" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "workspace_webpliant_id_area" ON "workspace_webpliant" ("id_area");
CREATE INDEX IF NOT EXISTS "workspace_webpliant_id_canale" ON "workspace_webpliant" ("id_canale");
CREATE INDEX IF NOT EXISTS "workspace_webpliant_id_gdo" ON "workspace_webpliant" ("id_gdo");
CREATE INDEX IF NOT EXISTS "workspace_webpliant_id_pv" ON "workspace_webpliant" ("id_pv");
CREATE INDEX IF NOT EXISTS "workspace_webpliant_nome_workspace" ON "workspace_webpliant" ("nome_workspace");
CREATE INDEX IF NOT EXISTS "workspace_webpliant_created_at" ON "workspace_webpliant" ("createdAt");
CREATE INDEX IF NOT EXISTS "workspace_webpliant_updated_at" ON "workspace_webpliant" ("updatedAt");

CREATE TABLE IF NOT EXISTS "ephemeral_audit_log" (
  "id_ephemeral_audit_log" UUID DEFAULT uuid_generate_v4(),
  "event_type_ephemeral_audit_log" VARCHAR(50) NOT NULL,
  "challenge_id_ephemeral_audit_log" UUID,
  "jti_ephemeral_audit_log" UUID,
  "origin_ephemeral_audit_log" VARCHAR(255) NOT NULL,
  "ip_address_ephemeral_audit_log" VARCHAR(45) NOT NULL,
  "user_agent_ephemeral_audit_log" TEXT NOT NULL,
  "fp_version_ephemeral_audit_log" VARCHAR(20),
  "success_ephemeral_audit_log" BOOLEAN NOT NULL,
  "error_message_ephemeral_audit_log" TEXT,
  "metadata_ephemeral_audit_log" JSONB,
  "createdat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY ("id_ephemeral_audit_log")
);
COMMENT ON COLUMN "ephemeral_audit_log"."event_type_ephemeral_audit_log" IS 'Tipo evento tracciato';
COMMENT ON COLUMN "ephemeral_audit_log"."challenge_id_ephemeral_audit_log" IS 'Riferimento al challenge (se applicabile)';
COMMENT ON COLUMN "ephemeral_audit_log"."jti_ephemeral_audit_log" IS 'Riferimento al token JTI (se applicabile)';
COMMENT ON COLUMN "ephemeral_audit_log"."origin_ephemeral_audit_log" IS 'Origine richiedente';
COMMENT ON COLUMN "ephemeral_audit_log"."ip_address_ephemeral_audit_log" IS 'IP richiedente (supporto IPv6)';
COMMENT ON COLUMN "ephemeral_audit_log"."user_agent_ephemeral_audit_log" IS 'User-Agent browser';
COMMENT ON COLUMN "ephemeral_audit_log"."fp_version_ephemeral_audit_log" IS 'Versione plugin FP (es: 1.0.0)';
COMMENT ON COLUMN "ephemeral_audit_log"."success_ephemeral_audit_log" IS 'Flag successo/fallimento operazione';
COMMENT ON COLUMN "ephemeral_audit_log"."error_message_ephemeral_audit_log" IS 'Messaggio errore se fallito';
COMMENT ON COLUMN "ephemeral_audit_log"."metadata_ephemeral_audit_log" IS 'Dati aggiuntivi in formato JSON';
CREATE INDEX IF NOT EXISTS "idx_ephemeral_audit_log_event_type" ON "ephemeral_audit_log" USING BTREE ("event_type_ephemeral_audit_log");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_audit_log_challenge_id" ON "ephemeral_audit_log" USING BTREE ("challenge_id_ephemeral_audit_log");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_audit_log_jti" ON "ephemeral_audit_log" USING BTREE ("jti_ephemeral_audit_log");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_audit_log_origin" ON "ephemeral_audit_log" USING BTREE ("origin_ephemeral_audit_log");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_audit_log_ip" ON "ephemeral_audit_log" USING BTREE ("ip_address_ephemeral_audit_log");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_audit_log_success" ON "ephemeral_audit_log" USING BTREE ("success_ephemeral_audit_log");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_audit_log_createdat" ON "ephemeral_audit_log" USING BTREE ("createdat");

CREATE TABLE IF NOT EXISTS "ephemeral_challenges" (
  "id_ephemeral_challenge" UUID DEFAULT uuid_generate_v4(),
  "challenge_id_ephemeral_challenge" UUID NOT NULL,
  "nonce_ephemeral_challenge" VARCHAR(64) NOT NULL,
  "origin_ephemeral_challenge" VARCHAR(255) NOT NULL,
  "signature_ephemeral_challenge" VARCHAR(64) NOT NULL,
  "ts_ephemeral_challenge" BIGINT NOT NULL,
  "ip_address_ephemeral_challenge" VARCHAR(45) NOT NULL,
  "user_agent_ephemeral_challenge" TEXT NOT NULL,
  "fp_version_ephemeral_challenge" VARCHAR(20) NOT NULL,
  "used_ephemeral_challenge" BOOLEAN NOT NULL DEFAULT false,
  "createdat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "expires_at_ephemeral_challenge" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id_ephemeral_challenge")
);
COMMENT ON COLUMN "ephemeral_challenges"."challenge_id_ephemeral_challenge" IS 'UUID v4 univoco del challenge';
COMMENT ON COLUMN "ephemeral_challenges"."nonce_ephemeral_challenge" IS 'Random 32 bytes in formato hex';
COMMENT ON COLUMN "ephemeral_challenges"."origin_ephemeral_challenge" IS 'Origine richiedente (es: https://example.com)';
COMMENT ON COLUMN "ephemeral_challenges"."signature_ephemeral_challenge" IS 'HMAC-SHA256 firma del challenge (hex)';
COMMENT ON COLUMN "ephemeral_challenges"."ts_ephemeral_challenge" IS 'Timestamp Unix millisecondi';
COMMENT ON COLUMN "ephemeral_challenges"."ip_address_ephemeral_challenge" IS 'IP richiedente (supporto IPv6)';
COMMENT ON COLUMN "ephemeral_challenges"."user_agent_ephemeral_challenge" IS 'User-Agent browser';
COMMENT ON COLUMN "ephemeral_challenges"."fp_version_ephemeral_challenge" IS 'Versione plugin FP (es: 1.0.0)';
COMMENT ON COLUMN "ephemeral_challenges"."used_ephemeral_challenge" IS 'Flag se challenge è stato completato';
COMMENT ON COLUMN "ephemeral_challenges"."expires_at_ephemeral_challenge" IS 'TTL 30 secondi per cleanup automatico';
CREATE UNIQUE INDEX IF NOT EXISTS "ephemeral_challenge_id_uq" ON "ephemeral_challenges" ("challenge_id_ephemeral_challenge");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_challenge_origin" ON "ephemeral_challenges" USING BTREE ("origin_ephemeral_challenge");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_challenge_ip" ON "ephemeral_challenges" USING BTREE ("ip_address_ephemeral_challenge");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_challenge_expires" ON "ephemeral_challenges" USING BTREE ("expires_at_ephemeral_challenge");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_challenge_used" ON "ephemeral_challenges" USING BTREE ("used_ephemeral_challenge");

CREATE TABLE IF NOT EXISTS "ephemeral_origins_whitelist" (
  "id_ephemeral_origins_whitelist" UUID DEFAULT uuid_generate_v4(),
  "origin_ephemeral_origins_whitelist" VARCHAR(255) NOT NULL,
  "description_ephemeral_origins_whitelist" TEXT,
  "active_ephemeral_origins_whitelist" BOOLEAN NOT NULL DEFAULT true,
  "rate_limit_per_minute_ephemeral_origins_whitelist" INTEGER NOT NULL DEFAULT 50,
  "allowed_scopes_ephemeral_origins_whitelist" VARCHAR(500) NOT NULL DEFAULT 'promo:read,refs:read',
  "created_by_ephemeral_origins_whitelist" UUID,
  "createdat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY ("id_ephemeral_origins_whitelist")
);
COMMENT ON COLUMN "ephemeral_origins_whitelist"."origin_ephemeral_origins_whitelist" IS 'Origine permessa (es: https://example.com) - deve includere protocollo e porta se diversa da default';
COMMENT ON COLUMN "ephemeral_origins_whitelist"."description_ephemeral_origins_whitelist" IS 'Descrizione dominio (es: "Sito Cliente XYZ")';
COMMENT ON COLUMN "ephemeral_origins_whitelist"."active_ephemeral_origins_whitelist" IS 'Flag attivo/disattivo - se false, origin viene bloccato';
COMMENT ON COLUMN "ephemeral_origins_whitelist"."rate_limit_per_minute_ephemeral_origins_whitelist" IS 'Rate limit personalizzato per questo origin (challenge/min)';
COMMENT ON COLUMN "ephemeral_origins_whitelist"."allowed_scopes_ephemeral_origins_whitelist" IS 'Scope permessi per questo origin (separati da virgola)';
COMMENT ON COLUMN "ephemeral_origins_whitelist"."created_by_ephemeral_origins_whitelist" IS 'ID utente che ha creato questa entry (FK verso users.id)';
CREATE UNIQUE INDEX IF NOT EXISTS "ephemeral_origins_origin_uq" ON "ephemeral_origins_whitelist" ("origin_ephemeral_origins_whitelist");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_origins_whitelist_active" ON "ephemeral_origins_whitelist" USING BTREE ("active_ephemeral_origins_whitelist");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_origins_whitelist_created_by" ON "ephemeral_origins_whitelist" USING BTREE ("created_by_ephemeral_origins_whitelist");

CREATE TABLE IF NOT EXISTS "ephemeral_tokens" (
  "id_ephemeral_token" UUID DEFAULT uuid_generate_v4(),
  "jti_ephemeral_token" UUID NOT NULL,
  "token_ephemeral_token" TEXT NOT NULL,
  "challenge_id_ephemeral_token" UUID NOT NULL,
  "origin_ephemeral_token" VARCHAR(255) NOT NULL,
  "browser_hash_ephemeral_token" VARCHAR(64) NOT NULL,
  "scope_ephemeral_token" VARCHAR(255) NOT NULL DEFAULT 'promo:read,refs:read',
  "ip_address_ephemeral_token" VARCHAR(45) NOT NULL,
  "user_agent_ephemeral_token" TEXT NOT NULL,
  "fp_version_ephemeral_token" VARCHAR(20) NOT NULL,
  "issued_at_ephemeral_token" BIGINT NOT NULL,
  "expires_at_utc_ephemeral_token" BIGINT NOT NULL,
  "revoked_ephemeral_token" BOOLEAN NOT NULL DEFAULT false,
  "last_used_at_ephemeral_token" TIMESTAMP WITH TIME ZONE,
  "use_count_ephemeral_token" INTEGER NOT NULL DEFAULT 0,
  "createdat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedat" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY ("id_ephemeral_token")
);
COMMENT ON COLUMN "ephemeral_tokens"."jti_ephemeral_token" IS 'JWT ID univoco per prevenzione replay attacks';
COMMENT ON COLUMN "ephemeral_tokens"."token_ephemeral_token" IS 'Token firmato HMAC-SHA256';
COMMENT ON COLUMN "ephemeral_tokens"."challenge_id_ephemeral_token" IS 'Riferimento al challenge che ha generato questo token';
COMMENT ON COLUMN "ephemeral_tokens"."origin_ephemeral_token" IS 'Origine vincolata per questo token';
COMMENT ON COLUMN "ephemeral_tokens"."browser_hash_ephemeral_token" IS 'SHA-256 fingerprint browser (base64)';
COMMENT ON COLUMN "ephemeral_tokens"."scope_ephemeral_token" IS 'Scope permessi separati da virgola';
COMMENT ON COLUMN "ephemeral_tokens"."ip_address_ephemeral_token" IS 'IP emissione token (supporto IPv6)';
COMMENT ON COLUMN "ephemeral_tokens"."user_agent_ephemeral_token" IS 'User-Agent browser al momento emissione';
COMMENT ON COLUMN "ephemeral_tokens"."fp_version_ephemeral_token" IS 'Versione plugin FP (es: 1.0.0)';
COMMENT ON COLUMN "ephemeral_tokens"."issued_at_ephemeral_token" IS 'Timestamp emissione Unix millisecondi';
COMMENT ON COLUMN "ephemeral_tokens"."expires_at_utc_ephemeral_token" IS 'Timestamp scadenza Unix millisecondi (TTL 5 minuti)';
COMMENT ON COLUMN "ephemeral_tokens"."revoked_ephemeral_token" IS 'Flag revoca manuale';
COMMENT ON COLUMN "ephemeral_tokens"."last_used_at_ephemeral_token" IS 'Timestamp ultimo utilizzo token';
COMMENT ON COLUMN "ephemeral_tokens"."use_count_ephemeral_token" IS 'Contatore utilizzi token';
CREATE UNIQUE INDEX IF NOT EXISTS "ephemeral_token_jti_uq" ON "ephemeral_tokens" ("jti_ephemeral_token");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_token_challenge_id" ON "ephemeral_tokens" USING BTREE ("challenge_id_ephemeral_token");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_token_origin" ON "ephemeral_tokens" USING BTREE ("origin_ephemeral_token");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_token_expires" ON "ephemeral_tokens" USING BTREE ("expires_at_utc_ephemeral_token");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_token_revoked" ON "ephemeral_tokens" USING BTREE ("revoked_ephemeral_token");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_token_browser_hash" ON "ephemeral_tokens" USING BTREE ("browser_hash_ephemeral_token");
CREATE INDEX IF NOT EXISTS "idx_ephemeral_token_ip" ON "ephemeral_tokens" USING BTREE ("ip_address_ephemeral_token");

CREATE TABLE IF NOT EXISTS "attivita_utente" (
  "id_attivita_utente" UUID DEFAULT uuid_generate_v4(),
  "id_utente_attivita_utente" UUID NOT NULL REFERENCES "utenti" ("id_utenti") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_attivita_attivita_utente" UUID NOT NULL REFERENCES "attivita" ("id_attivita") ON DELETE CASCADE ON UPDATE CASCADE,
  "letto_attivita_utente" BOOLEAN NOT NULL DEFAULT false,
  "data_lettura_attivita_utente" TIMESTAMP WITH TIME ZONE,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_attivita_utente")
);
CREATE UNIQUE INDEX IF NOT EXISTS "attivita_utente_utente_attivita_uq" ON "attivita_utente" ("id_utente_attivita_utente", "id_attivita_attivita_utente");
CREATE INDEX IF NOT EXISTS "attivita_utente_id_utente_attivita_utente" ON "attivita_utente" ("id_utente_attivita_utente");
CREATE INDEX IF NOT EXISTS "attivita_utente_letto_attivita_utente" ON "attivita_utente" ("letto_attivita_utente");
CREATE INDEX IF NOT EXISTS "attivita_utente_data_lettura_attivita_utente" ON "attivita_utente" ("data_lettura_attivita_utente");

CREATE TABLE IF NOT EXISTS "filter_templates" (
  "id_filter_template" UUID NOT NULL,
  "nome" VARCHAR(100) NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  "descrizione" TEXT,
  "parent_template_id" UUID,
  "template_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "export_codes" VARCHAR(255)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(255)[],
  "filters" JSONB NOT NULL DEFAULT '[]',
  "endpoint_type" "public"."enum_filter_templates_endpoint_type" NOT NULL,
  "render_type" "public"."enum_filter_templates_render_type",
  "auto_scroll" BOOLEAN NOT NULL DEFAULT true,
  "scroll_speed" INTEGER NOT NULL DEFAULT 5000,
  "show_indicators" BOOLEAN NOT NULL DEFAULT true,
  "show_nav_buttons" BOOLEAN NOT NULL DEFAULT true,
  "meta_options" JSONB NOT NULL DEFAULT '{}',
  "id_gdo" UUID NOT NULL REFERENCES "gdo" ("id_gdo") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_agenzia" UUID,
  "id_utente_creatore" UUID NOT NULL REFERENCES "utenti" ("id_utenti") ON DELETE SET NULL ON UPDATE CASCADE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_latest" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "deleted_at" TIMESTAMP WITH TIME ZONE,
  "deleted_by" UUID,
  "createdat" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedat" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id_filter_template")
);
COMMENT ON COLUMN "filter_templates"."nome" IS 'Nome visualizzato del template';
COMMENT ON COLUMN "filter_templates"."slug" IS 'Identificatore univoco per GDO';
COMMENT ON COLUMN "filter_templates"."descrizione" IS 'Descrizione opzionale del template';
COMMENT ON COLUMN "filter_templates"."parent_template_id" IS 'Identificatore della prima versione per mantenere la lineage';
COMMENT ON COLUMN "filter_templates"."template_ids" IS 'Lista di template correlati utilizzati in cascata';
COMMENT ON COLUMN "filter_templates"."export_codes" IS 'Lista di codici tipo export (per modalità files)';
COMMENT ON COLUMN "filter_templates"."filters" IS 'Array di gruppi di condizioni filtro (Array<FilterCondition[]>)';
COMMENT ON COLUMN "filter_templates"."auto_scroll" IS 'Abilita auto-scroll nel carousel';
COMMENT ON COLUMN "filter_templates"."scroll_speed" IS 'Velocità auto-scroll in millisecondi';
COMMENT ON COLUMN "filter_templates"."show_indicators" IS 'Mostra indicatori carousel';
COMMENT ON COLUMN "filter_templates"."show_nav_buttons" IS 'Mostra bottoni navigazione carousel';
COMMENT ON COLUMN "filter_templates"."meta_options" IS 'Opzioni di rendering o serializzazione extra';
COMMENT ON COLUMN "filter_templates"."id_gdo" IS 'FK alla GDO proprietaria del template';
COMMENT ON COLUMN "filter_templates"."id_agenzia" IS 'FK opzionale all''agenzia';
COMMENT ON COLUMN "filter_templates"."id_utente_creatore" IS 'FK all''utente che ha creato il template';
COMMENT ON COLUMN "filter_templates"."is_active" IS 'Se il template è attivo e utilizzabile';
COMMENT ON COLUMN "filter_templates"."is_latest" IS 'Indica se questa versione è la più recente';
COMMENT ON COLUMN "filter_templates"."version" IS 'Il template ha delle versioni per gestire meglio il cambio di modifiche in una webapp esterna';
COMMENT ON COLUMN "filter_templates"."deleted_at" IS 'Timestamp di soft delete per la versione';
COMMENT ON COLUMN "filter_templates"."deleted_by" IS 'Utente che ha eseguito il soft delete della versione';
CREATE UNIQUE INDEX IF NOT EXISTS "idx_filter_template_slug_gdo_version" ON "filter_templates" ("slug", "id_gdo", "version");
CREATE INDEX IF NOT EXISTS "idx_filter_template_latest" ON "filter_templates" ("slug", "id_gdo", "is_latest");
CREATE INDEX IF NOT EXISTS "idx_filter_template_gdo" ON "filter_templates" ("id_gdo");
CREATE INDEX IF NOT EXISTS "idx_filter_template_endpoint_type" ON "filter_templates" ("endpoint_type");
CREATE INDEX IF NOT EXISTS "idx_filter_template_is_active" ON "filter_templates" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_filter_template_creatore" ON "filter_templates" ("id_utente_creatore");
CREATE INDEX IF NOT EXISTS "idx_filter_template_deleted" ON "filter_templates" ("deleted_at");

CREATE TABLE IF NOT EXISTS "menu_items" (
  "id_menu_item" UUID DEFAULT uuid_generate_v4(),
  "tipo_utente" "public"."enum_menu_items_tipo_utente" NOT NULL,
  "ruolo_gdo" VARCHAR(100),
  "id_ruolo_utente_gdo" UUID,
  "titolo" VARCHAR(255) NOT NULL,
  "tipo" "public"."enum_menu_items_tipo" NOT NULL,
  "icona" VARCHAR(100),
  "pathname" VARCHAR(255),
  "codice_permesso" VARCHAR(100),
  "disabilitato" BOOLEAN NOT NULL DEFAULT false,
  "start_page" BOOLEAN NOT NULL DEFAULT false,
  "ordinamento" INTEGER NOT NULL DEFAULT 0,
  "id_parent" UUID REFERENCES "menu_items" ("id_menu_item") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_menu_item")
);
CREATE INDEX IF NOT EXISTS "menu_items_order" ON "menu_items" ("tipo_utente", "ruolo_gdo", "ordinamento");
CREATE INDEX IF NOT EXISTS "menu_items_ruolo_order" ON "menu_items" ("tipo_utente", "id_ruolo_utente_gdo", "ordinamento");

CREATE TABLE IF NOT EXISTS "permessi" (
  "id_permesso" UUID DEFAULT uuid_generate_v4(),
  "codice" VARCHAR(100) NOT NULL,
  "nome" VARCHAR(255) NOT NULL,
  "descrizione" TEXT,
  "categoria" "public"."enum_permessi_categoria" NOT NULL,
  "risorsa" VARCHAR(100) NOT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_permesso")
);
CREATE UNIQUE INDEX IF NOT EXISTS "permessi_codice_uq" ON "permessi" ("codice");
CREATE INDEX IF NOT EXISTS "permessi_categoria" ON "permessi" ("categoria");
CREATE INDEX IF NOT EXISTS "permessi_risorsa" ON "permessi" ("risorsa");

CREATE TABLE IF NOT EXISTS "permessi_ruolo" (
  "id_permesso_ruolo" UUID DEFAULT uuid_generate_v4(),
  "tipo_utente" "public"."enum_permessi_ruolo_tipo_utente" NOT NULL,
  "id_permesso" UUID NOT NULL REFERENCES "permessi" ("id_permesso") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_ruolo_utente_gdo" UUID REFERENCES "ruolo_utente_gdo" ("id_ruolo_utente_gdo") ON DELETE CASCADE ON UPDATE CASCADE,
  "abilitato" BOOLEAN NOT NULL DEFAULT true,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_permesso_ruolo")
);
CREATE UNIQUE INDEX IF NOT EXISTS "permessi_ruolo_tipo_utente_id_permesso_id_ruolo_utente_gdo" ON "permessi_ruolo" ("tipo_utente", "id_permesso", "id_ruolo_utente_gdo");

CREATE TABLE IF NOT EXISTS "permessi_ruolo_gdo" (
  "id_permesso_ruolo_gdo" UUID DEFAULT uuid_generate_v4(),
  "id_gdo" UUID NOT NULL REFERENCES "gdo" ("id_gdo") ON DELETE CASCADE ON UPDATE CASCADE,
  "tipo_utente" "public"."enum_permessi_ruolo_gdo_tipo_utente" NOT NULL,
  "id_permesso" UUID NOT NULL REFERENCES "permessi" ("id_permesso") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_ruolo_utente_gdo" UUID REFERENCES "ruolo_utente_gdo" ("id_ruolo_utente_gdo") ON DELETE CASCADE ON UPDATE CASCADE,
  "abilitato" BOOLEAN NOT NULL,
  "createdat" TIMESTAMP WITH TIME ZONE,
  "updatedat" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id_permesso_ruolo_gdo")
);
CREATE INDEX IF NOT EXISTS "permessi_ruolo_gdo_id_gdo" ON "permessi_ruolo_gdo" ("id_gdo");

CREATE TABLE IF NOT EXISTS "plugin_analytics_events" (
  "id_plugin_analytics_event" UUID NOT NULL,
  "event_id" VARCHAR(36) NOT NULL,
  "event_type" VARCHAR(50) NOT NULL,
  "timestamp_event" TIMESTAMP WITH TIME ZONE NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  "fp_version" VARCHAR(20),
  "page_origin" VARCHAR(255) NOT NULL,
  "page_path" VARCHAR(500),
  "session_id" VARCHAR(36) NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "viewport" JSONB,
  "ip_address" VARCHAR(45) NOT NULL,
  "user_agent" TEXT,
  "event_data" JSONB,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id_plugin_analytics_event")
);
COMMENT ON COLUMN "plugin_analytics_events"."event_id" IS 'UUID generato dal client';
COMMENT ON COLUMN "plugin_analytics_events"."event_type" IS 'Tipo di evento (PluginEventType)';
COMMENT ON COLUMN "plugin_analytics_events"."timestamp_event" IS 'Timestamp evento generato dal client';
COMMENT ON COLUMN "plugin_analytics_events"."slug" IS 'Slug configurazione plugin';
COMMENT ON COLUMN "plugin_analytics_events"."fp_version" IS 'Versione del plugin';
COMMENT ON COLUMN "plugin_analytics_events"."page_origin" IS 'Origin della pagina host (es: https://example.com)';
COMMENT ON COLUMN "plugin_analytics_events"."page_path" IS 'Path della pagina host (senza query string)';
COMMENT ON COLUMN "plugin_analytics_events"."session_id" IS 'ID sessione (random per page-load, non un cookie)';
COMMENT ON COLUMN "plugin_analytics_events"."sequence" IS 'Numero di sequenza monotonicamente crescente per sessione (replay ordering)';
COMMENT ON COLUMN "plugin_analytics_events"."viewport" IS 'Stato del viewport al momento dell''evento (viewportWidth, viewportHeight, scrollX, scrollY, documentWidth, documentHeight)';
COMMENT ON COLUMN "plugin_analytics_events"."ip_address" IS 'Indirizzo IP del client';
COMMENT ON COLUMN "plugin_analytics_events"."user_agent" IS 'User-Agent del browser';
COMMENT ON COLUMN "plugin_analytics_events"."event_data" IS 'Payload specifico per tipo di evento';
CREATE INDEX IF NOT EXISTS "idx_pae_event_type" ON "plugin_analytics_events" ("event_type");
CREATE INDEX IF NOT EXISTS "idx_pae_slug" ON "plugin_analytics_events" ("slug");
CREATE INDEX IF NOT EXISTS "idx_pae_timestamp" ON "plugin_analytics_events" ("timestamp_event");
CREATE INDEX IF NOT EXISTS "idx_pae_session" ON "plugin_analytics_events" ("session_id");
CREATE INDEX IF NOT EXISTS "idx_pae_origin" ON "plugin_analytics_events" ("page_origin");
CREATE INDEX IF NOT EXISTS "idx_pae_composite" ON "plugin_analytics_events" ("slug", "event_type", "timestamp_event");
CREATE INDEX IF NOT EXISTS "idx_pae_session_sequence" ON "plugin_analytics_events" ("session_id", "sequence");

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id_audit_log" UUID DEFAULT uuid_generate_v4(),
  "event_type" VARCHAR(80) NOT NULL,
  "severity" VARCHAR(10) NOT NULL,
  "user_id" UUID,
  "user_type" VARCHAR(30),
  "session_id" VARCHAR(255),
  "ip_address" VARCHAR(45) NOT NULL,
  "user_agent" TEXT,
  "resource" VARCHAR(120),
  "action" VARCHAR(80),
  "result" VARCHAR(10) NOT NULL DEFAULT 'SUCCESS',
  "details" JSONB,
  "request_id" VARCHAR(100),
  "target_entity_id" VARCHAR(255),
  "target_entity_type" VARCHAR(80),
  "createdat" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("id_audit_log")
);
COMMENT ON COLUMN "audit_log"."event_type" IS 'Tipo di evento audit (AuditEventType)';
COMMENT ON COLUMN "audit_log"."severity" IS 'Severità: LOW, MEDIUM, HIGH, CRITICAL';
COMMENT ON COLUMN "audit_log"."user_id" IS 'ID utente che ha generato l''evento';
COMMENT ON COLUMN "audit_log"."user_type" IS 'Tipo utente (TIPO_UTENTI)';
COMMENT ON COLUMN "audit_log"."session_id" IS 'ID sessione';
COMMENT ON COLUMN "audit_log"."ip_address" IS 'IP richiedente (supporto IPv6)';
COMMENT ON COLUMN "audit_log"."user_agent" IS 'User-Agent browser';
COMMENT ON COLUMN "audit_log"."resource" IS 'Risorsa coinvolta (es. promo, user, webhook)';
COMMENT ON COLUMN "audit_log"."action" IS 'Azione eseguita (es. create, update, delete)';
COMMENT ON COLUMN "audit_log"."result" IS 'Risultato: SUCCESS, FAILURE, PARTIAL';
COMMENT ON COLUMN "audit_log"."details" IS 'Dati aggiuntivi in formato JSON';
COMMENT ON COLUMN "audit_log"."request_id" IS 'X-Request-ID header';
COMMENT ON COLUMN "audit_log"."target_entity_id" IS 'ID dell''entità target dell''operazione';
COMMENT ON COLUMN "audit_log"."target_entity_type" IS 'Tipo dell''entità target (es. Promo, Utente)';
CREATE INDEX IF NOT EXISTS "idx_audit_log_event_type" ON "audit_log" USING BTREE ("event_type");
CREATE INDEX IF NOT EXISTS "idx_audit_log_severity" ON "audit_log" USING BTREE ("severity");
CREATE INDEX IF NOT EXISTS "idx_audit_log_user_id" ON "audit_log" USING BTREE ("user_id");
CREATE INDEX IF NOT EXISTS "idx_audit_log_createdat" ON "audit_log" USING BTREE ("createdat");
CREATE INDEX IF NOT EXISTS "idx_audit_log_result" ON "audit_log" USING BTREE ("result");
CREATE INDEX IF NOT EXISTS "idx_audit_log_target_entity" ON "audit_log" USING BTREE ("target_entity_type", "target_entity_id");
CREATE INDEX IF NOT EXISTS "idx_audit_log_sev_date" ON "audit_log" USING BTREE ("severity" ASC, "createdat" DESC);

CREATE TABLE IF NOT EXISTS "auth_providers" (
  "id" UUID NOT NULL,
  "codice" VARCHAR(50) NOT NULL,
  "nome" VARCHAR(100) NOT NULL,
  "descrizione" TEXT,
  "icona" TEXT NOT NULL DEFAULT 'Key',
  "tipo" "public"."enum_auth_providers_tipo" NOT NULL,
  "ordine" INTEGER NOT NULL DEFAULT 0,
  "attivo" BOOLEAN NOT NULL DEFAULT true,
  "config_client" JSONB,
  "config_server" JSONB,
  "ruoli_ammessi" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);
COMMENT ON COLUMN "auth_providers"."codice" IS 'Codice univoco del provider (email_password, entra_id, google, ecc.)';
COMMENT ON COLUMN "auth_providers"."nome" IS 'Nome visualizzato del provider';
COMMENT ON COLUMN "auth_providers"."descrizione" IS 'Descrizione opzionale del provider';
COMMENT ON COLUMN "auth_providers"."icona" IS 'Nome icona Lucide oppure stringa base64 (data:image/...)';
COMMENT ON COLUMN "auth_providers"."ordine" IS 'Ordine di visualizzazione';
COMMENT ON COLUMN "auth_providers"."attivo" IS 'Se il provider è abilitato';
COMMENT ON COLUMN "auth_providers"."config_client" IS 'Configurazione lato client (authorize_url, client_id, scope, redirect_uri)';
COMMENT ON COLUMN "auth_providers"."config_server" IS 'Configurazione lato server (client_secret, token_url, jwks_uri) - MAI esposto al client';
COMMENT ON COLUMN "auth_providers"."ruoli_ammessi" IS 'Array di TIPO_UTENTI che possono usare questo provider, null = tutti';
CREATE UNIQUE INDEX IF NOT EXISTS "idx_auth_provider_codice" ON "auth_providers" ("codice");
CREATE INDEX IF NOT EXISTS "idx_auth_provider_attivo" ON "auth_providers" ("attivo");
CREATE INDEX IF NOT EXISTS "idx_auth_provider_ordine" ON "auth_providers" ("ordine");

CREATE TABLE IF NOT EXISTS "hub_services" (
  "id" UUID NOT NULL,
  "codice" VARCHAR(50) NOT NULL,
  "nome" VARCHAR(100) NOT NULL,
  "descrizione" TEXT,
  "icona" TEXT NOT NULL DEFAULT 'Box',
  "colore" VARCHAR(50) NOT NULL DEFAULT 'primary',
  "url" TEXT NOT NULL,
  "tipo_url" "public"."enum_hub_services_tipo_url" NOT NULL DEFAULT 'internal',
  "attivo" BOOLEAN NOT NULL DEFAULT true,
  "in_manutenzione" BOOLEAN NOT NULL DEFAULT false,
  "in_evidenza" BOOLEAN NOT NULL DEFAULT false,
  "ordine" INTEGER NOT NULL DEFAULT 0,
  "tipo_utente" VARCHAR(30) NOT NULL,
  "ruolo_gdo" VARCHAR(50) DEFAULT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);
COMMENT ON COLUMN "hub_services"."codice" IS 'Codice del servizio (fidelity_promotion, istanta, ecc.) — unicità garantita da indice composito codice+tipo_utente+ruolo_gdo';
COMMENT ON COLUMN "hub_services"."nome" IS 'Nome visualizzato del servizio';
COMMENT ON COLUMN "hub_services"."descrizione" IS 'Descrizione del servizio per questo tipo utente';
COMMENT ON COLUMN "hub_services"."icona" IS 'Icona: nome Lucide oppure data URI base64 (data:image/...;base64,...)';
COMMENT ON COLUMN "hub_services"."colore" IS 'Colore tema (classe Tailwind o hex)';
COMMENT ON COLUMN "hub_services"."url" IS 'URL destinazione del servizio';
COMMENT ON COLUMN "hub_services"."attivo" IS 'Se il servizio è abilitato';
COMMENT ON COLUMN "hub_services"."in_manutenzione" IS 'Se il servizio è in manutenzione';
COMMENT ON COLUMN "hub_services"."in_evidenza" IS 'Se il servizio appare nella sezione in evidenza';
COMMENT ON COLUMN "hub_services"."ordine" IS 'Ordine di visualizzazione';
COMMENT ON COLUMN "hub_services"."tipo_utente" IS 'Tipo utente a cui è destinato il servizio (TIPO_UTENTI)';
COMMENT ON COLUMN "hub_services"."ruolo_gdo" IS 'Ruolo GDO specifico (solo quando tipo_utente=GDO). NULL = tutti i ruoli GDO';
COMMENT ON COLUMN "hub_services"."meta" IS 'Metadata extra (badges, tags, ecc.)';
CREATE UNIQUE INDEX IF NOT EXISTS "idx_hub_service_codice_tipo_ruolo" ON "hub_services" ("codice", "tipo_utente", "ruolo_gdo");
CREATE INDEX IF NOT EXISTS "idx_hub_service_tipo_utente" ON "hub_services" ("tipo_utente");
CREATE INDEX IF NOT EXISTS "idx_hub_service_attivo" ON "hub_services" ("attivo");
CREATE INDEX IF NOT EXISTS "idx_hub_service_ordine" ON "hub_services" ("ordine");

CREATE TABLE IF NOT EXISTS "hub_news" (
  "id" UUID NOT NULL,
  "titolo" VARCHAR(200) NOT NULL,
  "contenuto" TEXT NOT NULL,
  "tipo" "public"."enum_hub_news_tipo" NOT NULL DEFAULT 'info',
  "icona" TEXT,
  "url" TEXT,
  "in_evidenza" BOOLEAN NOT NULL DEFAULT false,
  "ruoli_destinatari" JSONB NOT NULL DEFAULT '[]',
  "attivo" BOOLEAN NOT NULL DEFAULT true,
  "data_pubblicazione" TIMESTAMP WITH TIME ZONE NOT NULL,
  "data_scadenza" TIMESTAMP WITH TIME ZONE,
  "autore_nome" VARCHAR(100),
  "meta" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);
COMMENT ON COLUMN "hub_news"."titolo" IS 'Titolo della news';
COMMENT ON COLUMN "hub_news"."contenuto" IS 'Corpo della news (supporta HTML)';
COMMENT ON COLUMN "hub_news"."icona" IS 'Icona: nome Lucide oppure data URI base64';
COMMENT ON COLUMN "hub_news"."url" IS 'Link opzionale "Leggi di più"';
COMMENT ON COLUMN "hub_news"."in_evidenza" IS 'Se la news è pinnata in alto';
COMMENT ON COLUMN "hub_news"."ruoli_destinatari" IS 'Array di TIPO_UTENTI destinatari, vuoto = tutti';
COMMENT ON COLUMN "hub_news"."attivo" IS 'Se la news è visibile';
COMMENT ON COLUMN "hub_news"."data_pubblicazione" IS 'Data da cui la news è visibile';
COMMENT ON COLUMN "hub_news"."data_scadenza" IS 'Data dopo la quale la news si nasconde automaticamente';
COMMENT ON COLUMN "hub_news"."autore_nome" IS 'Nome autore denormalizzato';
COMMENT ON COLUMN "hub_news"."meta" IS 'Metadata extra';
CREATE INDEX IF NOT EXISTS "idx_hub_news_attivo" ON "hub_news" ("attivo");
CREATE INDEX IF NOT EXISTS "idx_hub_news_data_pub" ON "hub_news" ("data_pubblicazione");
CREATE INDEX IF NOT EXISTS "idx_hub_news_evidenza" ON "hub_news" ("in_evidenza");

CREATE TABLE IF NOT EXISTS "lavori_in_background" (
  "id" UUID NOT NULL,
  "tipo" VARCHAR(64) NOT NULL,
  "chiave" VARCHAR(255) NOT NULL,
  "id_utente" VARCHAR(64),
  "id_gdo" VARCHAR(64),
  "stato" VARCHAR(32) NOT NULL DEFAULT 'IN_CORSO',
  "avanzamento" JSONB,
  "attesa" VARCHAR(255),
  "richiesta_decisione" JSONB,
  "decisione" JSONB,
  "annullamento_richiesto" BOOLEAN NOT NULL DEFAULT false,
  "risultato" JSONB,
  "errore" TEXT,
  "heartbeat_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "concluso_at" TIMESTAMP WITH TIME ZONE,
  "createdat" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedat" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_lavori_in_background_tipo_chiave_stato" ON "lavori_in_background" ("tipo", "chiave", "stato");
CREATE INDEX IF NOT EXISTS "idx_lavori_in_background_tipo_utente" ON "lavori_in_background" ("tipo", "id_utente", "createdat");
