BEGIN;

-- 1. Rimuove il vincolo enum legacy
ALTER TABLE promo
ALTER COLUMN stato
TYPE TEXT
USING stato::text;

-- 2. Normalizzazione stati legacy
UPDATE promo
SET stato = CASE
  WHEN stato = 'PUBBLICATA'       THEN 'VALIDA'
  WHEN stato = 'IN_REVISIONE'     THEN 'IN_ATTESA_DI_VALIDITA'
  WHEN stato = 'IN_LAVORAZIONE'   THEN 'IN_LAVORAZIONE'
  WHEN stato = 'ELIMINATA'        THEN 'ELIMINATA'
  ELSE stato
END;

-- 3. Crea ENUM temporaneo
CREATE TYPE enum_promo_stato_tmp AS ENUM (
  'PIANIFICATA',
  'IN_LAVORAZIONE',
  'IN_SCADENZA',
  'IN_ATTESA_DI_VALIDITA',
  'VALIDA',
  'ARCHIVIATA',
  'IN_RITARDO',
  'VALIDA_CON_ERRORI',
  'ELIMINATA'
);

-- 4. Migrazione TEXT → enum temporaneo
ALTER TABLE promo
ALTER COLUMN stato
TYPE enum_promo_stato_tmp
USING stato::enum_promo_stato_tmp;

-- 5. Rimuove enum legacy
DROP TYPE enum_promo_stato;

-- 6. Ricrea enum definitivo
CREATE TYPE enum_promo_stato AS ENUM (
  'PIANIFICATA',
  'IN_LAVORAZIONE',
  'IN_SCADENZA',
  'IN_ATTESA_DI_VALIDITA',
  'VALIDA',
  'ARCHIVIATA',
  'IN_RITARDO',
  'VALIDA_CON_ERRORI',
  'ELIMINATA'
);

-- 7. PASSAGGIO OBBLIGATORIO: enum_tmp → TEXT
ALTER TABLE promo
ALTER COLUMN stato
TYPE TEXT
USING stato::text;

-- 8. TEXT → enum definitivo
ALTER TABLE promo
ALTER COLUMN stato
TYPE enum_promo_stato
USING stato::enum_promo_stato;

-- 9. Pulizia enum temporaneo
DROP TYPE enum_promo_stato_tmp;

COMMIT;
