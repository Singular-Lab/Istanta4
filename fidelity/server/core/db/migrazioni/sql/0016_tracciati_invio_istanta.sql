-- schema-dopo: 86501b078e03919c88cdd5a77c67d9367b66e5577690c25ffd6e9c58a07e7229
-- Le liste dell'archivio storico salvate in FP e non ancora accettate da Istanta.
--
-- POST /api/tracciati/archivio salva le liste subito in FP; l'allineamento le invia poi a
-- Istanta una alla volta, a nome di chi le ha caricate (id_utente). Ci finisce anche il tracciato
-- del flusso normale che Istanta non ha accettato. Una riga per tracciato in attesa: tentativi e
-- ultimo_errore dicono com'e' andata, prossimo_tentativo quando riprovare dopo un errore,
-- inviando_dal da quando qualcuno lo sta inviando. Istanta lo accetta e la riga si elimina.
--
-- 1. La tabella, solo se manca.
-- 2. La chiave esterna verso tracciati (eliminato il tracciato non c'e' piu' nulla da inviare),
--    con il nome che darebbe PostgreSQL, solo se tracciati.id_tracciati e' chiave primaria o
--    univoca: su un'installazione vecchia senza la chiave primaria non si crea (avviso) e la
--    tabella funziona lo stesso.
-- 3. L'indice per trovare il prossimo da inviare.
-- Rieseguibile: ogni oggetto si crea solo se manca. Niente CONCURRENTLY: la tabella e' nuova.
CREATE TABLE IF NOT EXISTS public.tracciati_invio_istanta (
  id_tracciato UUID NOT NULL,
  id_utente VARCHAR(255) NOT NULL,
  tentativi INTEGER NOT NULL DEFAULT 0,
  ultimo_errore TEXT,
  prossimo_tentativo TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  inviando_dal TIMESTAMP WITH TIME ZONE,
  creato_il TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id_tracciato)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tracciati_invio_istanta'::regclass AND conname = 'tracciati_invio_istanta_id_tracciato_fkey'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint k
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
    WHERE k.conrelid = to_regclass('public.tracciati')
      AND k.contype IN ('p', 'u') AND array_length(k.conkey, 1) = 1 AND a.attname = 'id_tracciati'
  ) THEN
    RAISE NOTICE 'tracciati_invio_istanta.id_tracciato: tracciati.id_tracciati non e'' chiave primaria ne'' univoca, chiave esterna non creata';
    RETURN;
  END IF;

  ALTER TABLE public.tracciati_invio_istanta
    ADD CONSTRAINT tracciati_invio_istanta_id_tracciato_fkey FOREIGN KEY (id_tracciato)
    REFERENCES public.tracciati (id_tracciati) ON DELETE CASCADE ON UPDATE CASCADE;
END $$;

CREATE INDEX IF NOT EXISTS tracciati_invio_istanta_prossimo_tentativo
  ON public.tracciati_invio_istanta (prossimo_tentativo);
