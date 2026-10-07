-- Dati della promo che restano in FP (non vanno a Istanta), una chiave per uso.
-- Oggi: "visibilita" = {"canali": [guid...], "aree": [guid...]} (I20-958): il
-- risultato dei momenti tiene solo quei canali/aree; una lista vuota non filtra.
-- {} su tutte le promo esistenti: per loro non cambia nulla.
ALTER TABLE promo
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;
