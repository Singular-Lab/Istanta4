-- Marca la lavorazione come recuperata dallo storico e ne conserva l'esito.
-- Sta sul kit e non sulla singola referenza: sono le referenze a ereditarlo.
-- Contiene: data import, nome file, le referenze a listino rimaste non impaginate,
-- i box fuori listino compilati a mano (per codice box) e quanti sono stati ignorati.
-- NULL su tutte le lavorazioni che non vengono dal plugin: per loro non cambia nulla.
ALTER TABLE runtime_kit
  ADD COLUMN IF NOT EXISTS import_storico JSONB DEFAULT NULL;
