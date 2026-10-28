-- schema-dopo: 8eea939c7540ae1b1647a64678509ae6790461f9cbbedb63b14841676938be8d
-- Tracciati orfani: una volta sola, con una copia di sicurezza.
--
-- Fino a questa versione sistema_schema_esistente.sql eliminava a ogni avvio,
-- senza copia, i tracciati che puntano a una promo che non esiste piu': con la
-- chiave esterna (ON DELETE CASCADE) sarebbero spariti insieme alla promo, e
-- ne impediscono la creazione. Stessa condizione di allora.
--
-- Qui le righe si copiano prima in public.tracciati_orfani_20261028 (data di
-- scrittura della migrazione, fissa) e poi si eliminano solo quelle copiate.
-- Se quel nome e' gia' occupato si usa il primo libero fra
-- tracciati_orfani_20261028_2, _3, ...: una copia esistente non si tocca mai.
-- Senza le tabelle o senza orfani non fa nulla.
DO $$
DECLARE
  copia TEXT := 'tracciati_orfani_20261028';
  progressivo INTEGER := 1;
  copiate BIGINT;
  eliminate BIGINT;
BEGIN
  IF to_regclass('public.tracciati') IS NULL OR to_regclass('public.promo') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tracciati t
    WHERE NOT EXISTS (
      SELECT 1 FROM public.promo p WHERE p.id_promo = t.id_promo_tracciati::text
    )
  ) THEN
    RAISE NOTICE 'Tracciati orfani: nessuno';
    RETURN;
  END IF;

  WHILE to_regclass('public.' || quote_ident(copia)) IS NOT NULL LOOP
    progressivo := progressivo + 1;
    copia := 'tracciati_orfani_20261028_' || progressivo;
  END LOOP;

  EXECUTE format(
    'CREATE TABLE public.%I AS
       SELECT t.* FROM public.tracciati t
       WHERE NOT EXISTS (
         SELECT 1 FROM public.promo p WHERE p.id_promo = t.id_promo_tracciati::text
       )',
    copia
  );
  EXECUTE format('SELECT count(*) FROM public.%I', copia) INTO copiate;

  -- Solo le righe copiate, e solo se sono ancora orfane.
  EXECUTE format(
    'DELETE FROM public.tracciati t
       USING public.%I c
       WHERE t.id_tracciati = c.id_tracciati
         AND NOT EXISTS (
           SELECT 1 FROM public.promo p WHERE p.id_promo = t.id_promo_tracciati::text
         )',
    copia
  );
  GET DIAGNOSTICS eliminate = ROW_COUNT;

  RAISE NOTICE 'Tracciati orfani: % righe copiate in public.%, % eliminate', copiate, copia, eliminate;
END $$;
