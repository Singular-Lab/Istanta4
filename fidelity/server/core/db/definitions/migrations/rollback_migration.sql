-- Script di rollback per annullare la migrazione a lowercase
-- ATTENZIONE: Usa questo script solo se la migrazione ha causato problemi
-- Questo script ripristina le colonne originali con nomi camelCase

BEGIN;

-- 1. Tabella utenti
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "id_utenti" TO "id_Utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "outsider_utenti" TO "outsider_Utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "nome_utenti" TO "nome_Utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "cognome_utenti" TO "cognome_Utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "email_utenti" TO "email_Utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "password_utenti" TO "password_Utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "datadinascita_utenti" TO "dataDiNascita_Utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "residenza_utenti" TO "residenza_Utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "tipo_utenti" TO "tipo_Utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "stato_utenti" TO "stato_Utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "privatekey_utenti" TO "privateKey_Utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "telefono_utenti" TO "telefono_Utenti";

-- 2. Tabella gdo
ALTER TABLE IF EXISTS public.gdo RENAME COLUMN "id_gdo" TO "id_Gdo";
ALTER TABLE IF EXISTS public.gdo RENAME COLUMN "nome_gdo" TO "nome_Gdo";
ALTER TABLE IF EXISTS public.gdo RENAME COLUMN "idparent_gdo" TO "idParent_Gdo";
ALTER TABLE IF EXISTS public.gdo RENAME COLUMN "regole_gdo" TO "regole_Gdo";

-- 3. Tabella aree
ALTER TABLE IF EXISTS public.aree RENAME COLUMN "id_aree" TO "id_Aree";
ALTER TABLE IF EXISTS public.aree RENAME COLUMN "codice_aree" TO "codice_Aree";
ALTER TABLE IF EXISTS public.aree RENAME COLUMN "nome_aree" TO "nome_Aree";
ALTER TABLE IF EXISTS public.aree RENAME COLUMN "id_gdo_aree" TO "idGDO_Aree";

-- 4. Tabella canali
ALTER TABLE IF EXISTS public.canali RENAME COLUMN "id_canali" TO "id_Canali";
ALTER TABLE IF EXISTS public.canali RENAME COLUMN "codice_canali" TO "codice_Canali";
ALTER TABLE IF EXISTS public.canali RENAME COLUMN "nome_canali" TO "nome_Canali";
ALTER TABLE IF EXISTS public.canali RENAME COLUMN "id_gdo_canali" TO "idGdo_Canali";

-- 5. Tabella combinazione_canale_area
ALTER TABLE IF EXISTS public.combinazione_canale_area RENAME COLUMN "id_combinazione_canale_area" TO "id_CombinazioneCanaleArea";
ALTER TABLE IF EXISTS public.combinazione_canale_area RENAME COLUMN "id_gdo_combinazione_canale_area" TO "idGDO_CombinazioneCanaleArea";
ALTER TABLE IF EXISTS public.combinazione_canale_area RENAME COLUMN "id_canale_combinazione_canale_area" TO "idCanale_CombinazioneCanaleArea";
ALTER TABLE IF EXISTS public.combinazione_canale_area RENAME COLUMN "id_area_combinazione_canale_area" TO "idArea_CombinazioneCanaleArea";
ALTER TABLE IF EXISTS public.combinazione_canale_area RENAME COLUMN "stato_combinazione_canale_area" TO "stato_CombinazioneCanaleArea";

-- 6. Tabella punti_vendita
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "id_puntivendita" TO "id_PuntiVendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "nome_puntivendita" TO "nome_PuntiVendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "citta_puntivendita" TO "citta_PuntiVendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "cap_puntivendita" TO "cap_PuntiVendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "indirizzo_puntivendita" TO "indirizzo_PuntiVendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "lat_puntivendita" TO "lat_PuntiVendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "lon_puntivendita" TO "lon_PuntiVendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "id_combinazione_canale_area_puntivendita" TO "idCombinazioneCanaleArea_PuntiVendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "id_gdo_puntivendita" TO "idGDO_PuntiVendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "ragionesociale_puntivendita" TO "ragioneSociale_PuntiVendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "provincia_puntivendita" TO "provincia_puntivendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "regione_puntivendita" TO "regione_puntivendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "telefono_puntivendita" TO "telefono_puntivendita";

-- 7. Tabella punti_vendita_utenti
ALTER TABLE IF EXISTS public.punti_vendita_utenti RENAME COLUMN "id_puntivenditautenti" TO "id_PuntiVenditaUtenti";
ALTER TABLE IF EXISTS public.punti_vendita_utenti RENAME COLUMN "idutenti_puntivenditautenti" TO "idUtenti_PuntiVenditaUtenti";
ALTER TABLE IF EXISTS public.punti_vendita_utenti RENAME COLUMN "idpuntivendita_puntivenditautenti" TO "idPuntiVendita_PuntiVenditaUtenti";

-- 8. Tabella ordini_stampa
ALTER TABLE IF EXISTS public.ordini_stampa RENAME COLUMN "id_ordinistampa" TO "id_OrdiniStampa";
ALTER TABLE IF EXISTS public.ordini_stampa RENAME COLUMN "idutente_ordinistampa" TO "idUtente_OrdiniStampa";
ALTER TABLE IF EXISTS public.ordini_stampa RENAME COLUMN "id_promo_ordinistampa" TO "idPromo_OrdiniStampa";
ALTER TABLE IF EXISTS public.ordini_stampa RENAME COLUMN "stato_ordinistampa" TO "stato_OrdiniStampa";
ALTER TABLE IF EXISTS public.ordini_stampa RENAME COLUMN "data_di_conferma_ordinistampa" TO "dataDiConferma_OrdiniStampa";

-- 9. Tabella ordini_stampa_invii
ALTER TABLE IF EXISTS public.ordini_stampa_invii RENAME COLUMN "id_ordinistampainvii" TO "id_OrdiniStampaInvii";
ALTER TABLE IF EXISTS public.ordini_stampa_invii RENAME COLUMN "idutente_ordinistampainvii" TO "idUtente_OrdiniStampaInvii";
ALTER TABLE IF EXISTS public.ordini_stampa_invii RENAME COLUMN "idordinestampa_ordinistampainvii" TO "idOrdineDiStampa_OrdiniStampaInvii";
ALTER TABLE IF EXISTS public.ordini_stampa_invii RENAME COLUMN "excel_ordinistampainvii" TO "excel_OrdiniStampaInvii";
ALTER TABLE IF EXISTS public.ordini_stampa_invii RENAME COLUMN "report_ordinistampainvii" TO "report_OrdiniStampaInvii";
ALTER TABLE IF EXISTS public.ordini_stampa_invii RENAME COLUMN "segnalazione_ordinistampainvii" TO "segnalazione_OrdiniStampaInvii";

-- 10. Tabella attivita
ALTER TABLE IF EXISTS public.attivita RENAME COLUMN "id_attivita" TO "id_Attivita";
ALTER TABLE IF EXISTS public.attivita RENAME COLUMN "idutente_attivita" TO "idUtente_Attivita";
ALTER TABLE IF EXISTS public.attivita RENAME COLUMN "tipo_attivita" TO "tipo_Attivita";
ALTER TABLE IF EXISTS public.attivita RENAME COLUMN "meta_attivita" TO "meta_Attivita";

-- 11. Tabella tracciati
ALTER TABLE IF EXISTS public.tracciati RENAME COLUMN "id_tracciati" TO "id_Tracciati";
ALTER TABLE IF EXISTS public.tracciati RENAME COLUMN "id_promo_tracciati" TO "idPromo_Tracciati";
ALTER TABLE IF EXISTS public.tracciati RENAME COLUMN "context_tracciati" TO "context_Tracciati";
ALTER TABLE IF EXISTS public.tracciati RENAME COLUMN "filename_tracciati" TO "fileName_Tracciati";
ALTER TABLE IF EXISTS public.tracciati RENAME COLUMN "blobfile_tracciati" TO "blobFile_Tracciati";

-- 12. Tabella tipi_export
ALTER TABLE IF EXISTS public.tipi_export RENAME COLUMN "id_tipiexport" TO "id_TipiDiExport";
ALTER TABLE IF EXISTS public.tipi_export RENAME COLUMN "nome_tipiexport" TO "nome_TipiDiExport";
ALTER TABLE IF EXISTS public.tipi_export RENAME COLUMN "codice_tipiexport" TO "codice_TipiDiExport";
ALTER TABLE IF EXISTS public.tipi_export RENAME COLUMN "modalita_tipiexport" TO "modalita_TipiDiExport";
ALTER TABLE IF EXISTS public.tipi_export RENAME COLUMN "guid_namingconvention_tipiexport" TO "guidNamingConvention_TipiDiExport";
ALTER TABLE IF EXISTS public.tipi_export RENAME COLUMN "filtri_tipiexport" TO "filtri_TipiDiExport";

-- 13. Tabella formati
ALTER TABLE IF EXISTS public.formati RENAME COLUMN "id_formati" TO "id_Formati";
ALTER TABLE IF EXISTS public.formati RENAME COLUMN "nome_formati" TO "nome_Formati";
ALTER TABLE IF EXISTS public.formati RENAME COLUMN "codice_formati" TO "codice_Formati";
ALTER TABLE IF EXISTS public.formati RENAME COLUMN "descrizione_formati" TO "descrizione_Formati";
ALTER TABLE IF EXISTS public.formati RENAME COLUMN "tipo_lavorazione_formati" TO "tipoLavorazione_Formati";

-- 14. Tabella naming_convention
ALTER TABLE IF EXISTS public.naming_convention RENAME COLUMN "id_naming_convention" TO "id_NamingConvention";
ALTER TABLE IF EXISTS public.naming_convention RENAME COLUMN "nome_naming_convention" TO "nome_NamingConvention";
ALTER TABLE IF EXISTS public.naming_convention RENAME COLUMN "descrizione_naming_convention" TO "descrizione_NamingConvention";
ALTER TABLE IF EXISTS public.naming_convention RENAME COLUMN "fields_naming_convention" TO "fields_NamingConvention";

-- 15. Tabella webhooks (già lowercase, quindi non serve rollback)
-- Questa tabella ha già i nomi delle colonne in lowercase, quindi non serve rollback


-- 17. Tabella utenti_gdo
ALTER TABLE IF EXISTS public.utenti_gdo RENAME COLUMN "id_utentegdo" TO "id_UtenteGDO";
ALTER TABLE IF EXISTS public.utenti_gdo RENAME COLUMN "id_utente_utentegdo" TO "idUtente_UtenteGDO";
ALTER TABLE IF EXISTS public.utenti_gdo RENAME COLUMN "id_gdo_utentegdo" TO "idGDO_UtenteGDO";

-- 18. Tabella utenti_anonimi


ALTER TABLE IF EXISTS public.utenti_anonimi RENAME COLUMN "id_utenti_anonimi" TO "id_UtentiAnonimi";
ALTER TABLE IF EXISTS public.utenti_anonimi RENAME COLUMN "meta_utenti_anonimi" TO "meta_UtentiAnonimi";

-- 19. Tabella utenti_guest
ALTER TABLE IF EXISTS public.utenti_guest RENAME COLUMN "id_utenti_guest" TO "id_UtentiGuest";
ALTER TABLE IF EXISTS public.utenti_guest RENAME COLUMN "dettagliutente_utenti_guest" TO "dettagliUtente_UtentiGuest";
ALTER TABLE IF EXISTS public.utenti_guest RENAME COLUMN "origine_utenti_guest" TO "origine_UtentiGuest";
ALTER TABLE IF EXISTS public.utenti_guest RENAME COLUMN "email_utenti_guest" TO "email_UtentiGuest";

-- 21. Tabella contratto_tipografia
ALTER TABLE IF EXISTS public.contratto_tipografia RENAME COLUMN "id_contrattotipografia" TO "id_ContrattoTipografia";
ALTER TABLE IF EXISTS public.contratto_tipografia RENAME COLUMN "tipiexport_contrattotipografia" TO "tipiExport_ContrattoTipografia";
ALTER TABLE IF EXISTS public.contratto_tipografia RENAME COLUMN "nome_contrattotipografia" TO "nome_ContrattoTipografia";
ALTER TABLE IF EXISTS public.contratto_tipografia RENAME COLUMN "id_gdo_contrattotipografia" TO "idGDO_ContrattoTipografia";
ALTER TABLE IF EXISTS public.contratto_tipografia RENAME COLUMN "json_contrattotipografia" TO "json_ContrattoTipografia";

-- 22. Tabella canali_interazione
ALTER TABLE IF EXISTS public.canali_interazione RENAME COLUMN "id_canaliinterazione" TO "id_CanaliInterazione";
ALTER TABLE IF EXISTS public.canali_interazione RENAME COLUMN "idutente_canaliinterazione" TO "idUtente_CanaliInterazione";
ALTER TABLE IF EXISTS public.canali_interazione RENAME COLUMN "tipo_canaliinterazione" TO "tipo_CanaliInterazione";
ALTER TABLE IF EXISTS public.canali_interazione RENAME COLUMN "stato_canaliinterazione" TO "stato_CanaliInterazione";

-- 23. Tabella wishlist_webpliant
ALTER TABLE IF EXISTS public.wishlist_webpliant RENAME COLUMN "id_whishlistwepliant" TO "id_WhishlistWepliant";
ALTER TABLE IF EXISTS public.wishlist_webpliant RENAME COLUMN "idcanale_whishlistwepliant" TO "idCanale_WhishlistWepliant";
ALTER TABLE IF EXISTS public.wishlist_webpliant RENAME COLUMN "idarea_whishlistwepliant" TO "idArea_WhishlistWepliant";
ALTER TABLE IF EXISTS public.wishlist_webpliant RENAME COLUMN "idpv_whishlistwepliant" TO "idPv_WhishlistWepliant";
ALTER TABLE IF EXISTS public.wishlist_webpliant RENAME COLUMN "meta_whishlistwepliant" TO "meta_WhishlistWepliant";
ALTER TABLE IF EXISTS public.wishlist_webpliant RENAME COLUMN "idworkspace_whishlistwepliant" TO "idWorkspace_WhishlistWepliant";
ALTER TABLE IF EXISTS public.wishlist_webpliant RENAME COLUMN "idpagina_whishlistwepliant" TO "idPagina_WhishlistWepliant";

-- 24. Tabella tipo_utente_punto_vendita
ALTER TABLE IF EXISTS public.tipo_utente_punto_vendita RENAME COLUMN "id_tipo_utente_punto_vendita" TO "id_TipoUtentePuntoVendita";
ALTER TABLE IF EXISTS public.tipo_utente_punto_vendita RENAME COLUMN "ruolo_tipo_utente_punto_vendita" TO "ruolo_TipoUtentePuntoVendita";
ALTER TABLE IF EXISTS public.tipo_utente_punto_vendita RENAME COLUMN "tipo_tipo_utente_punto_vendita" TO "tipo_TipoUtentePuntoVendita";

-- Verifica che tutte le modifiche siano state applicate correttamente
DO $$
DECLARE
    v_table_name TEXT;
    v_old_column_name TEXT;
    v_column_name TEXT;
    error_count INTEGER := 0;
BEGIN
    -- Lista delle tabelle e colonne da verificare (esempi)
    FOR v_table_name, v_old_column_name, v_column_name IN
        SELECT * FROM (
            SELECT 'utenti' AS v_table_name, 'id_utenti' AS v_old_column_name, 'id_Utenti' AS v_column_name UNION ALL
            SELECT 'utenti', 'nome_utenti', 'nome_Utenti' UNION ALL
            SELECT 'gdo', 'id_gdo', 'id_Gdo' UNION ALL
            SELECT 'gdo', 'nome_gdo', 'nome_Gdo' UNION ALL
            SELECT 'aree', 'id_Aree', 'id_aree' UNION ALL
            SELECT 'aree', 'nome_Aree', 'nome_aree' UNION ALL
            SELECT 'canali', 'id_canali', 'id_Canali' UNION ALL
            SELECT 'canali', 'nome_canali', 'nome_Canali' UNION ALL
            SELECT 'punti_vendita', 'id_puntivendita', 'id_PuntiVendita' UNION ALL
            SELECT 'punti_vendita', 'nome_puntivendita', 'nome_PuntiVendita'
        ) AS elenco_colonne
    LOOP
        -- Verifica che la colonna originale sia stata ripristinata
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = v_table_name
            AND column_name = v_column_name
        ) THEN
            RAISE NOTICE 'ERRORE: Colonna % non trovata nella tabella %', v_column_name, v_table_name;
            error_count := error_count + 1;
        ELSE
            RAISE NOTICE 'OK: Colonna % ripristinata correttamente da %', v_column_name, v_old_column_name;
        END IF;
    END LOOP;

    IF error_count > 0 THEN
        RAISE EXCEPTION 'Rollback fallito: % errori trovati', error_count;
    ELSE
        RAISE NOTICE 'Rollback completato con successo!';
    END IF;
END $$;

COMMIT;

-- ISTRUZIONI POST-ROLLBACK:
-- 1. Verifica che l'applicazione funzioni correttamente con le colonne originali
-- 2. Ripristina i modelli Sequelize ai nomi originali delle colonne
-- 3. Ripristina le viste PostgreSQL se necessario
-- 4. Testa tutte le funzionalità dell'applicazione
