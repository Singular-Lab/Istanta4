-- schema-dopo: a254c6a883822a7278f9b89081335106b7c2e314001b166f75ad33b787ffbbf0
-- Canali e aree proxy (lib/areeCanali/proxy.ts): un canale o un'area che raccoglie due o piu'
-- membri della stessa GDO, per un volantino uguale fra insegne o fra aree (il RIL Conad: un kit
-- sul proxy SSCNCY per Superstore, Conad e City).
--
-- membri_canali / membri_aree: gli id dei membri, il primo e' quello "delle liste" con cui il
-- proxy si presenta a Istanta. Vuoto per le voci normali, cioe' tutte quelle che esistono oggi.
-- Rieseguibile: le colonne si aggiungono solo se mancano.
ALTER TABLE public.canali ADD COLUMN IF NOT EXISTS membri_canali UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
ALTER TABLE public.aree ADD COLUMN IF NOT EXISTS membri_aree UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
