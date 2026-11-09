-- schema-dopo: 7e45a47272c1e6c2d8aabd41c8e89de011a8578589fab016b79442cd6018597e
-- Le vendite del cliente importate per gli insight del volantino, e i loro import (lib/vendite/tipi.ts).
--
-- vendite_prodotti: una riga per prodotto, punto vendita e periodo, con pezzi e (se il file lo porta)
-- valore in euro. Il codice prodotto e' gia' normalizzato (normalizzaCodiceProdotto). L'indice univoco
-- e' la chiave dell'upsert dell'import: reimportare la stessa vendita la sostituisce, non la somma.
-- importazioni_vendite: gli import di una GDO, con avanzamento, battito_il (ultimo segno di vita del
-- lavoro) e annullato (annullamento richiesto da qualunque worker). Al piu' uno 'in_corso' per GDO:
-- lo garantisce l'avvio, con un lock sulla GDO; uno senza battito da troppo risulta interrotto.
--
-- 1. Le tabelle, solo se mancano.
-- 2. La chiave esterna di vendite_prodotti verso punti_vendita (eliminato il PV se ne vanno le sue
--    vendite), con il nome che darebbe PostgreSQL, solo se punti_vendita.id_puntivendita e' chiave
--    primaria o univoca: su un'installazione vecchia senza la chiave primaria non si crea (avviso) e
--    la tabella funziona lo stesso.
-- 3. Gli indici: l'univoco della vendita, le vendite di un prodotto in un periodo, quelle di un PV,
--    gli import di una GDO in ordine di avvio.
-- Rieseguibile: ogni oggetto si crea solo se manca. Niente CONCURRENTLY: le tabelle sono nuove.
CREATE TABLE IF NOT EXISTS public.vendite_prodotti (
  id UUID NOT NULL,
  id_gdo UUID NOT NULL,
  codice_prodotto VARCHAR(100) NOT NULL,
  id_punto_vendita UUID NOT NULL,
  dal DATE NOT NULL,
  al DATE NOT NULL,
  pezzi NUMERIC(14,3) NOT NULL,
  valore NUMERIC(14,2),
  id_import UUID,
  aggiornato_il TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.importazioni_vendite (
  id UUID NOT NULL,
  id_gdo UUID NOT NULL,
  stato VARCHAR(20) NOT NULL,
  nome_file VARCHAR(255) NOT NULL,
  righe INTEGER NOT NULL DEFAULT 0,
  elaborate INTEGER NOT NULL DEFAULT 0,
  scritte INTEGER NOT NULL DEFAULT 0,
  scartate INTEGER NOT NULL DEFAULT 0,
  errore TEXT,
  avviato_da UUID,
  avviato_il TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  terminato_il TIMESTAMP WITH TIME ZONE,
  battito_il TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  annullato BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.vendite_prodotti'::regclass AND conname = 'vendite_prodotti_id_punto_vendita_fkey'
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
    RAISE NOTICE 'vendite_prodotti.id_punto_vendita: punti_vendita.id_puntivendita non e'' chiave primaria ne'' univoca, chiave esterna non creata';
    RETURN;
  END IF;

  ALTER TABLE public.vendite_prodotti
    ADD CONSTRAINT vendite_prodotti_id_punto_vendita_fkey FOREIGN KEY (id_punto_vendita)
    REFERENCES public.punti_vendita (id_puntivendita) ON DELETE CASCADE ON UPDATE CASCADE;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS vendite_prodotti_prodotto_pv_periodo_uq
  ON public.vendite_prodotti (id_gdo, codice_prodotto, id_punto_vendita, dal, al);
CREATE INDEX IF NOT EXISTS idx_vendite_prodotti_id_gdo_codice_prodotto_dal_al
  ON public.vendite_prodotti (id_gdo, codice_prodotto, dal, al);
CREATE INDEX IF NOT EXISTS idx_vendite_prodotti_id_punto_vendita
  ON public.vendite_prodotti (id_punto_vendita);
CREATE INDEX IF NOT EXISTS idx_importazioni_vendite_id_gdo_avviato_il
  ON public.importazioni_vendite (id_gdo, avviato_il);
