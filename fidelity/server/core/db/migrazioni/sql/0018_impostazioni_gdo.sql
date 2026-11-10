-- schema-dopo: 6fedde479b5aa1f033b6a47a11ca35d04fe84629a14a9c97a54542efa04af857
-- Le impostazioni proprie di ogni GDO (spec impostazioni-gdo) che non stanno nella riga config letta
-- da WebPliant: i reparti come li nomina il marketing e la configurazione degli insight del volantino.
--
-- reparti: { codice, nomeDati, nomeMarketing, colore } per reparto, applicati a ogni lettura dei
-- reparti (insight, dettaglio della promozione, report PDF, pagine dei punti vendita).
-- insight_volantino: la configurazione degli insight della GDO; null vuol dire quella del file
-- dell'installazione (config/flyerInsightsConfig.json), come prima. insight_aggiornato_il e
-- insight_aggiornato_da dicono quando e da chi e' stata salvata.
--
-- 1. La tabella, solo se manca.
-- 2. La chiave esterna verso gdo (eliminata la GDO se ne vanno le sue impostazioni), con il nome che
--    darebbe PostgreSQL, solo se gdo.id_gdo e' chiave primaria o univoca: su un'installazione vecchia
--    senza la chiave primaria non si crea (avviso) e la tabella funziona lo stesso.
-- Rieseguibile: ogni oggetto si crea solo se manca. Nessun indice oltre la chiave primaria.
CREATE TABLE IF NOT EXISTS public.impostazioni_gdo (
  id_gdo UUID NOT NULL,
  reparti JSONB NOT NULL DEFAULT '[]',
  insight_volantino JSONB,
  insight_aggiornato_il TIMESTAMP WITH TIME ZONE,
  insight_aggiornato_da TEXT,
  aggiornato_il TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id_gdo)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.impostazioni_gdo'::regclass AND conname = 'impostazioni_gdo_id_gdo_fkey'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint k
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
    WHERE k.conrelid = to_regclass('public.gdo')
      AND k.contype IN ('p', 'u') AND array_length(k.conkey, 1) = 1 AND a.attname = 'id_gdo'
  ) THEN
    RAISE NOTICE 'impostazioni_gdo.id_gdo: gdo.id_gdo non e'' chiave primaria ne'' univoca, chiave esterna non creata';
    RETURN;
  END IF;

  ALTER TABLE public.impostazioni_gdo
    ADD CONSTRAINT impostazioni_gdo_id_gdo_fkey FOREIGN KEY (id_gdo)
    REFERENCES public.gdo (id_gdo) ON DELETE CASCADE ON UPDATE CASCADE;
END $$;
