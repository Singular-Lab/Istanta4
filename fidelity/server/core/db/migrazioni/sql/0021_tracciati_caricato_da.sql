-- schema-dopo: 6f17746b33dd9d6d3d078f24269b92377a54d6ed0fd07655a6b088331fea5478
-- Chi ha caricato il tracciato (spec ciclo-promozione-importazione, "Autore e date del tracciato").
--
-- caricato_da: id dell'utente FP che ha caricato il tracciato, dal caricamento della promo o dalle
-- liste dell'archivio. NULL per i tracciati caricati prima di questa migrazione di cui non resta
-- traccia: la scheda dice che l'autore non e' registrato.
--
-- 1. La colonna, solo se manca.
-- 2. L'autore dei tracciati gia' caricati, dove si sa: dal Registro Audit (il caricamento riuscito,
--    tenuto 90 giorni) e, per quelli ancora in attesa di Istanta, dalla coda di invio, che li manda
--    a nome di chi li ha caricati. Si riempiono solo le righe ancora vuote.
-- Rieseguibile: niente viene sovrascritto.
ALTER TABLE public.tracciati ADD COLUMN IF NOT EXISTS caricato_da VARCHAR(255);

UPDATE public.tracciati t
SET caricato_da = caricamento.user_id
FROM (
  SELECT DISTINCT ON (a.target_entity_id) a.target_entity_id, a.user_id::text AS user_id
  FROM public.audit_log a
  WHERE a.resource = 'tracciato'
    AND a.action = 'upload'
    AND a.result = 'SUCCESS'
    AND a.user_id IS NOT NULL
    AND a.target_entity_id IS NOT NULL
  ORDER BY a.target_entity_id, a.createdat
) caricamento
WHERE t.caricato_da IS NULL
  AND caricamento.target_entity_id = t.id_tracciati::text;

UPDATE public.tracciati t
SET caricato_da = c.id_utente
FROM public.tracciati_invio_istanta c
WHERE t.caricato_da IS NULL
  AND c.id_tracciato = t.id_tracciati
  AND c.id_utente <> '';
