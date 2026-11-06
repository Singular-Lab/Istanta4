-- schema-dopo: 4156800401b55cd77fe4e1c7197d7b92bb134f54fc275b27c39c6b9cb80d04aa
-- Le righe dei volantini collegate a mano a un punto vendita dalla gestione dei punti vendita.
--
-- Una riga per collegamento: le chiavi delle righe del volantino collegate (telefono, localita'
-- e indirizzo, testo) e il PV a cui vanno. Il riabbinamento le applica prima delle regole
-- automatiche: la nuova sincronizzazione di un kit riscrive le sue righe in punti_vendita_volantino,
-- e il collegamento deve restare. L'anagrafica non si tocca.
--
-- 1. La tabella, solo se manca.
-- 2. La chiave esterna verso punti_vendita (eliminato il PV il collegamento se ne va), con il nome
--    che darebbe PostgreSQL, solo se punti_vendita.id_puntivendita e' chiave primaria o univoca: su
--    un'installazione vecchia senza la chiave primaria non si crea (avviso) e la tabella funziona
--    lo stesso.
-- 3. Gli indici: i collegamenti di una GDO e quelli di un PV.
-- Rieseguibile: ogni oggetto si crea solo se manca. Niente CONCURRENTLY: la tabella e' nuova.
CREATE TABLE IF NOT EXISTS public.abbinamenti_manuali_pv_volantino (
  id UUID NOT NULL,
  id_gdo UUID NOT NULL,
  id_punto_vendita UUID NOT NULL,
  chiavi TEXT[] NOT NULL,
  riga TEXT NOT NULL,
  creato_da VARCHAR(255),
  creato_il TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.abbinamenti_manuali_pv_volantino'::regclass
      AND conname = 'abbinamenti_manuali_pv_volantino_id_punto_vendita_fkey'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint k
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
    WHERE k.conrelid = to_regclass('public.punti_vendita')
      AND k.contype IN ('p', 'u') AND array_length(k.conkey, 1) = 1 AND a.attname = 'id_puntivendita'
  ) THEN
    RAISE NOTICE 'abbinamenti_manuali_pv_volantino.id_punto_vendita: punti_vendita.id_puntivendita non e'' chiave primaria ne'' univoca, chiave esterna non creata';
    RETURN;
  END IF;

  ALTER TABLE public.abbinamenti_manuali_pv_volantino
    ADD CONSTRAINT abbinamenti_manuali_pv_volantino_id_punto_vendita_fkey FOREIGN KEY (id_punto_vendita)
    REFERENCES public.punti_vendita (id_puntivendita) ON DELETE CASCADE ON UPDATE CASCADE;
END $$;

CREATE INDEX IF NOT EXISTS idx_abbinamenti_manuali_pv_volantino_id_gdo
  ON public.abbinamenti_manuali_pv_volantino (id_gdo);
CREATE INDEX IF NOT EXISTS idx_abbinamenti_manuali_pv_volantino_id_punto_vendita
  ON public.abbinamenti_manuali_pv_volantino (id_punto_vendita);
