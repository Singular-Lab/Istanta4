-- schema-dopo: 587d3c1e8be647af6de0a5e399b72f00c4a20020ab0d52668acd071bcc394944
-- I punti vendita stampati nelle liste dei volantini: la storia del punto vendita.
--
-- Una riga per ogni voce della lista dei punti vendita di un kit runtime, come la manda il
-- Plugin InDesign (/external/sync_json_plugin) o come arriva da un suo export JSON importato
-- dalla gestione dei punti vendita. La riga si collega al PV dell'anagrafica (id_punto_vendita,
-- abbinamento) quando lo si riconosce; l'anagrafica non si tocca.
--
-- 1. La tabella, solo se manca. id_promo e' testo come runtime_kit.id_promo e promo.id_promo.
-- 2. Le chiavi esterne, con i nomi che darebbe PostgreSQL: verso runtime_kit (eliminato il kit
--    se ne vanno le sue righe) e verso punti_vendita (eliminato il PV la riga resta, senza
--    abbinamento). Solo se la colonna puntata e' chiave primaria o univoca: su un'installazione
--    vecchia senza chiave primaria la chiave esterna non si crea (avviso) e la tabella funziona
--    lo stesso.
-- 3. Gli indici del modello: storia di un PV, righe di un kit, ricerca per telefono e indirizzo
--    nella GDO, righe ancora da abbinare di una GDO (parziale).
-- Rieseguibile: ogni oggetto si crea solo se manca. Niente CONCURRENTLY: la tabella e' nuova.
CREATE TABLE IF NOT EXISTS public.punti_vendita_volantino (
  id UUID NOT NULL,
  id_gdo UUID NOT NULL,
  id_kit_runtime UUID NOT NULL,
  id_promo VARCHAR(255) NOT NULL,
  id_canale UUID,
  id_area UUID,
  nome_file TEXT,
  posizione INTEGER NOT NULL,
  riga TEXT NOT NULL,
  regione TEXT,
  provincia TEXT,
  gruppo TEXT,
  localita TEXT,
  indirizzo TEXT,
  telefono TEXT,
  chiave_indirizzo TEXT,
  chiave_telefono TEXT,
  id_punto_vendita UUID,
  abbinamento TEXT,
  createdat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('punti_vendita_volantino_id_kit_runtime_fkey', 'id_kit_runtime', 'runtime_kit', 'id', 'CASCADE'),
      ('punti_vendita_volantino_id_punto_vendita_fkey', 'id_punto_vendita', 'punti_vendita', 'id_puntivendita', 'SET NULL')
    ) AS v(nome, colonna, tabella, puntata, alla_cancellazione)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.punti_vendita_volantino'::regclass AND conname = r.nome
    ) THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint k
      JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
      WHERE k.conrelid = to_regclass(format('public.%I', r.tabella))
        AND k.contype IN ('p', 'u') AND array_length(k.conkey, 1) = 1 AND a.attname = r.puntata
    ) THEN
      RAISE NOTICE 'punti_vendita_volantino.%: %.% non e'' chiave primaria ne'' univoca, chiave esterna non creata',
        r.colonna, r.tabella, r.puntata;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.punti_vendita_volantino ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I (%I) ON DELETE %s ON UPDATE CASCADE',
      r.nome, r.colonna, r.tabella, r.puntata, r.alla_cancellazione);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_punti_vendita_volantino_id_punto_vendita ON public.punti_vendita_volantino (id_punto_vendita);
CREATE INDEX IF NOT EXISTS idx_punti_vendita_volantino_id_kit_runtime ON public.punti_vendita_volantino (id_kit_runtime);
CREATE INDEX IF NOT EXISTS idx_punti_vendita_volantino_gdo_telefono ON public.punti_vendita_volantino (id_gdo, chiave_telefono);
CREATE INDEX IF NOT EXISTS idx_punti_vendita_volantino_gdo_indirizzo ON public.punti_vendita_volantino (id_gdo, chiave_indirizzo);
CREATE INDEX IF NOT EXISTS idx_punti_vendita_volantino_gdo_non_abbinate ON public.punti_vendita_volantino (id_gdo) WHERE id_punto_vendita IS NULL;
