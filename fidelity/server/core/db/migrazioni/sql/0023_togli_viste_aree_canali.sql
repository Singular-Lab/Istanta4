-- schema-dopo: a254c6a883822a7278f9b89081335106b7c2e314001b166f75ad33b787ffbbf0
-- Toglie le materialized view di aree, canali e combinazioni (mv_aree_ottimizzata,
-- mv_canali_ottimizzata, mv_combinazioni_ottimizzata) e le loro funzioni di refresh.
--
-- Le leggeva solo la pagina Aree e canali, che dal task TASK-8f8cae8c legge le tabelle: sono
-- piccole e cosi' la pagina e' sempre aggiornata, anche con i membri dei proxy. Il file
-- oggetti_derivati/020_materialized_views.sql non c'e' piu' e gli oggetti sono fra gli OBSOLETI di
-- migrazioni/oggettiDerivati.ts, che li toglie gia' prima delle migrazioni: qui li si toglie
-- comunque una volta per tutte. Rieseguibile.
--
-- Nota sulla 0022 (gia' applicata, non si modifica): l'ordine dei membri non conta piu'. Verso
-- Istanta un kit proxy si divide in un pezzo per combinazione membro, non si presenta piu' con il
-- primo membro.
DROP MATERIALIZED VIEW IF EXISTS public.mv_combinazioni_ottimizzata CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_canali_ottimizzata CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_aree_ottimizzata CASCADE;
DROP FUNCTION IF EXISTS public.refresh_mv_combinazioni();
DROP FUNCTION IF EXISTS public.refresh_mv_canali();
DROP FUNCTION IF EXISTS public.refresh_mv_aree();
