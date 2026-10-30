-- schema-dopo: 332b052a3b200e66d07b839328671ad08d7bd240a61554fc5f88dc02e1f2add8
-- Il riepilogo di ogni kit runtime per le pagine dei punti vendita (timeline dei volantini).
--
-- Conteggi, sconti, meccaniche, reparti, marche e prodotti di un volantino, calcolati dalle sue
-- referenze alla prima lettura e salvati qui nella forma di VERSIONE_ANALISI_KIT: le pagine del
-- punto vendita combinano i riepiloghi dei suoi volantini senza rileggere tutte le referenze.
-- dati ha gli aggregati e, compatti, marche e prodotti (aggregati in SQL); descrizioni ha nome,
-- marca, formato e foto dei prodotti, letti solo per i pochi da mostrare. E' una cache: la riga si
-- elimina quando le referenze del kit vengono sostituite e si ricalcola quando la versione cambia
-- o una referenza e' modificata dopo referenze_al.
--
-- 1. La tabella, solo se manca.
-- 2. La chiave esterna verso runtime_kit (eliminato il kit se ne va il riepilogo), con il nome che
--    darebbe PostgreSQL, solo se runtime_kit.id e' chiave primaria o univoca: su un'installazione
--    vecchia senza la chiave primaria non si crea (avviso) e la tabella funziona lo stesso.
-- Rieseguibile: ogni oggetto si crea solo se manca. Nessun indice oltre la chiave primaria.
CREATE TABLE IF NOT EXISTS public.analisi_kit (
  id_kit_runtime UUID NOT NULL,
  versione INTEGER NOT NULL,
  dati JSONB NOT NULL,
  descrizioni JSONB NOT NULL,
  aggiornato_il TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  referenze_al TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id_kit_runtime)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.analisi_kit'::regclass AND conname = 'analisi_kit_id_kit_runtime_fkey'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint k
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
    WHERE k.conrelid = to_regclass('public.runtime_kit')
      AND k.contype IN ('p', 'u') AND array_length(k.conkey, 1) = 1 AND a.attname = 'id'
  ) THEN
    RAISE NOTICE 'analisi_kit.id_kit_runtime: runtime_kit.id non e'' chiave primaria ne'' univoca, chiave esterna non creata';
    RETURN;
  END IF;

  ALTER TABLE public.analisi_kit
    ADD CONSTRAINT analisi_kit_id_kit_runtime_fkey FOREIGN KEY (id_kit_runtime)
    REFERENCES public.runtime_kit (id) ON DELETE CASCADE ON UPDATE CASCADE;
END $$;
