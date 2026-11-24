-- schema-dopo: 4b219ccf8013e8efadc349cba1ac3d55d16c1fcd73250e74c6bf10a3c97d47c4
-- Le regole delle sezioni del menabo' degli insight, per GDO (spec impostazioni-gdo, "Regole delle
-- sezioni del menabo' del volantino"): un elenco JSON di regole { id, sezione, condizioni }.
-- Vuoto = nessuna regola: il menabo' resta quello di prima (sezione ricavata dalla libreria agenzia).
--
-- Rieseguibile: la colonna si aggiunge solo se manca. Le righe esistenti partono con l'elenco vuoto.
ALTER TABLE public.impostazioni_gdo
  ADD COLUMN IF NOT EXISTS regole_menabo JSONB NOT NULL DEFAULT '[]';
