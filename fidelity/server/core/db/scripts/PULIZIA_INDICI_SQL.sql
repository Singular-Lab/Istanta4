-- ============================================================
-- PULIZIA CONSTRAINT UNIQUE AUTO-GENERATI DA SEQUELIZE
-- Rimuove tutti i constraint UNIQUE da ogni tabella colpita,
-- così models:sync può ricrearli con nomi stabili ed espliciti.
-- ============================================================

-- 1. gdo_whatsapp_numbers (4 constraint unici duplicati)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.gdo_whatsapp_numbers'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE 'ALTER TABLE public.gdo_whatsapp_numbers DROP CONSTRAINT IF EXISTS "' || r.conname || '"';
  END LOOP;
END $$;

-- 2. gdo_whatsapp_messages (provider_msg_id)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.gdo_whatsapp_messages'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE 'ALTER TABLE public.gdo_whatsapp_messages DROP CONSTRAINT IF EXISTS "' || r.conname || '"';
  END LOOP;
END $$;

-- 3. permessi (codice)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.permessi'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE 'ALTER TABLE public.permessi DROP CONSTRAINT IF EXISTS "' || r.conname || '"';
  END LOOP;
END $$;

-- 4. ephemeral_tokens (jti)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.ephemeral_tokens'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE 'ALTER TABLE public.ephemeral_tokens DROP CONSTRAINT IF EXISTS "' || r.conname || '"';
  END LOOP;
END $$;

-- 5. ephemeral_origins_whitelist (origin)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.ephemeral_origins_whitelist'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE 'ALTER TABLE public.ephemeral_origins_whitelist DROP CONSTRAINT IF EXISTS "' || r.conname || '"';
  END LOOP;
END $$;

-- 6. ephemeral_challenges (challenge_id)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.ephemeral_challenges'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE 'ALTER TABLE public.ephemeral_challenges DROP CONSTRAINT IF EXISTS "' || r.conname || '"';
  END LOOP;
END $$;

-- 7. utenti (email - solo quelli auto-numerati con _key##)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.utenti'::regclass
      AND contype = 'u'
      AND conname ~ '_key[0-9]*$'
  LOOP
    EXECUTE 'ALTER TABLE public.utenti DROP CONSTRAINT IF EXISTS "' || r.conname || '"';
  END LOOP;
END $$;

-- 8. dispositivi_punto_vendita (secret, token_display - solo auto-numerati)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.dispositivi_punto_vendita'::regclass
      AND contype = 'u'
      AND conname ~ '_key[0-9]*$'
  LOOP
    EXECUTE 'ALTER TABLE public.dispositivi_punto_vendita DROP CONSTRAINT IF EXISTS "' || r.conname || '"';
  END LOOP;
END $$;
