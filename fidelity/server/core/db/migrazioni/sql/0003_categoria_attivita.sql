-- schema-dopo: 8eea939c7540ae1b1647a64678509ae6790461f9cbbedb63b14841676938be8d
-- Categoria delle attivita' allineata a TIPO_TO_CATEGORIA di models/attivita.ts:
-- una volta sola.
--
-- Prima l'UPDATE in fondo a db/scripts/v_attivita.sql, a ogni avvio, dava una
-- categoria alle righe che non l'avevano con una mappa diversa da quella del
-- modello (per esempio INVIO_FILES_FTP in PUBBLICAZIONE invece che in STAMPA),
-- mentre le attivita' nuove la ricevono dall'hook del modello. Qui ogni riga
-- prende la categoria del modello, comprese quelle categorizzate con la vecchia
-- mappa, cosi' storico e attivita' nuove si filtrano allo stesso modo.
-- Un tipo sconosciuto conserva la sua categoria (o riceve INTEGRAZIONI se non
-- ne ha, come faceva lo script). Ripeterla non cambia nulla.
--
-- La mappa deve restare uguale a TIPO_TO_CATEGORIA: lo controlla
-- db/__tests__/scriptsDatabase.test.ts.
--
-- Il tipo si confronta come testo e il risultato si converte nel tipo della
-- colonna: l'enum del modello, o il VARCHAR che il vecchio script aggiungeva
-- quando la sincronizzazione era spenta.
DO $$
DECLARE
  tipo_categoria TEXT;
  aggiornate BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attivita'
      AND column_name = 'tipo_attivita'
  ) THEN
    RETURN;
  END IF;

  SELECT format('%I.%I', udt_schema, udt_name) INTO tipo_categoria
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'attivita'
    AND column_name = 'categoria_attivita';

  IF tipo_categoria IS NULL THEN
    RETURN;
  END IF;

  EXECUTE format($sql$
    WITH secondo_il_modello AS (
      SELECT id_attivita,
        CASE tipo_attivita::text
          -- ACCOUNT
          WHEN 'CREAZIONE_UTENTE' THEN 'ACCOUNT'
          WHEN 'ELIMINAZIONE_UTENTE' THEN 'ACCOUNT'
          -- PRODUZIONE
          WHEN 'CREAZIONE_RUNTIME_KIT_AUTOMATICO' THEN 'PRODUZIONE'
          WHEN 'CREAZIONE_RUNTIME_KIT_MANUALE' THEN 'PRODUZIONE'
          WHEN 'UPLOAD_FILE_MANUALE' THEN 'PRODUZIONE'
          WHEN 'MODIFICA_WORKSPACE_WEBPLIANT' THEN 'PRODUZIONE'
          WHEN 'CREAZIONE_DESIGN_KIT' THEN 'PRODUZIONE'
          WHEN 'IMPORT_TRACCIATO' THEN 'PRODUZIONE'
          WHEN 'CREAZIONE_LAVORAZIONE' THEN 'PRODUZIONE'
          -- PUBBLICAZIONE
          WHEN 'PUBBLICAZIONE_WEBPLIANT' THEN 'PUBBLICAZIONE'
          WHEN 'RICHIESTA_WEBPLIANT' THEN 'PUBBLICAZIONE'
          -- STAMPA
          WHEN 'CREAZIONE_ORDINE_DI_STAMPA' THEN 'STAMPA'
          WHEN 'INVIO_FILES_FTP' THEN 'STAMPA'
          -- INTEGRAZIONI
          WHEN 'INVIO_FILE_CORREGGO' THEN 'INTEGRAZIONI'
          WHEN 'PUBBLICAZIONE_FILE_CORREGGO' THEN 'INTEGRAZIONI'
          -- Tipo sconosciuto: resta com'e', o INTEGRAZIONI se non ha categoria
          ELSE COALESCE(categoria_attivita::text, 'INTEGRAZIONI')
        END AS categoria
      FROM public.attivita
    )
    UPDATE public.attivita a
    SET categoria_attivita = m.categoria::%s
    FROM secondo_il_modello m
    WHERE a.id_attivita = m.id_attivita
      AND a.categoria_attivita::text IS DISTINCT FROM m.categoria
  $sql$, tipo_categoria);
  GET DIAGNOSTICS aggiornate = ROW_COUNT;

  IF aggiornate > 0 THEN
    RAISE NOTICE 'Attivita'': categoria allineata al modello su % righe', aggiornate;
  END IF;
END $$;
