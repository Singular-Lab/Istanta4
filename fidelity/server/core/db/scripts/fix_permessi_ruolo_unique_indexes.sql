BEGIN;

-- Rimuove il vincolo legacy a 2 colonne e l'eventuale indice a 3 colonne non funzionale.
DROP INDEX IF EXISTS public.permessi_ruolo_tipo_utente_id_permesso;
DROP INDEX IF EXISTS public.permessi_ruolo_tipo_utente_id_permesso_id_ruolo_utente_gdo;

-- Ricrea il vincolo univoco corretto con COALESCE per gestire i NULL su id_ruolo_utente_gdo.
CREATE UNIQUE INDEX IF NOT EXISTS permessi_ruolo_tipo_utente_id_permesso_id_ruolo_utente_gdo
ON public.permessi_ruolo (
  tipo_utente,
  id_permesso,
  COALESCE(id_ruolo_utente_gdo, '00000000-0000-0000-0000-000000000000'::uuid)
);

COMMIT;
