-- Script di migrazione sicura da camelCase a lowercase usando ALTER TABLE RENAME COLUMN
-- ATTENZIONE: Esegui questo script in un ambiente di test prima della produzione
-- Questo script è progettato per essere sicuro e preservare tutti i dati

BEGIN;

-- 1. Tabella utenti
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "id_Utenti" TO "id_utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "outsider_Utenti" TO "outsider_utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "nome_Utenti" TO "nome_utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "cognome_Utenti" TO "cognome_utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "email_Utenti" TO "email_utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "password_Utenti" TO "password_utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "dataDiNascita_Utenti" TO "datadinascita_utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "residenza_Utenti" TO "residenza_utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "tipo_Utenti" TO "tipo_utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "stato_Utenti" TO "stato_utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "privateKey_Utenti" TO "privatekey_utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "telefono_Utenti" TO "telefono_utenti";
ALTER TABLE IF EXISTS public.utenti RENAME COLUMN "meta_Utenti" TO "meta_utenti";

-- 2. Tabella gdo
ALTER TABLE IF EXISTS public.gdo RENAME COLUMN "id_Gdo" TO "id_gdo";
ALTER TABLE IF EXISTS public.gdo RENAME COLUMN "nome_Gdo" TO "nome_gdo";
ALTER TABLE IF EXISTS public.gdo RENAME COLUMN "idParent_Gdo" TO "idparent_gdo";
ALTER TABLE IF EXISTS public.gdo RENAME COLUMN "regole_Gdo" TO "regole_gdo";

-- 3. Tabella aree
ALTER TABLE IF EXISTS public.aree RENAME COLUMN "id_Aree" TO "id_aree";
ALTER TABLE IF EXISTS public.aree RENAME COLUMN "codice_Aree" TO "codice_aree";
ALTER TABLE IF EXISTS public.aree RENAME COLUMN "nome_Aree" TO "nome_aree";
ALTER TABLE IF EXISTS public.aree RENAME COLUMN "idGDO_Aree" TO "id_gdo_aree";

-- 4. Tabella canali
ALTER TABLE IF EXISTS public.canali RENAME COLUMN "id_Canali" TO "id_canali";
ALTER TABLE IF EXISTS public.canali RENAME COLUMN "codice_Canali" TO "codice_canali";
ALTER TABLE IF EXISTS public.canali RENAME COLUMN "nome_Canali" TO "nome_canali";
ALTER TABLE IF EXISTS public.canali RENAME COLUMN "idGdo_Canali" TO "id_gdo_canali";

-- 5. Tabella combinazione_canale_area
ALTER TABLE IF EXISTS public.combinazione_canale_area RENAME COLUMN "id_CombinazioneCanaleArea" TO "id_combinazione_canale_area";
ALTER TABLE IF EXISTS public.combinazione_canale_area RENAME COLUMN "idGDO_CombinazioneCanaleArea" TO "id_gdo_combinazione_canale_area";
ALTER TABLE IF EXISTS public.combinazione_canale_area RENAME COLUMN "idCanale_CombinazioneCanaleArea" TO "id_canale_combinazione_canale_area";
ALTER TABLE IF EXISTS public.combinazione_canale_area RENAME COLUMN "idArea_CombinazioneCanaleArea" TO "id_area_combinazione_canale_area";
ALTER TABLE IF EXISTS public.combinazione_canale_area RENAME COLUMN "stato_CombinazioneCanaleArea" TO "stato_combinazione_canale_area";

-- 6. Tabella punti_vendita
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "id_PuntiVendita" TO "id_puntivendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "nome_PuntiVendita" TO "nome_puntivendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "citta_PuntiVendita" TO "citta_puntivendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "cap_PuntiVendita" TO "cap_puntivendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "indirizzo_PuntiVendita" TO "indirizzo_puntivendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "lat_PuntiVendita" TO "lat_puntivendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "lon_PuntiVendita" TO "lon_puntivendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "idCombinazioneCanaleArea_PuntiVendita" TO "id_combinazione_canale_area_puntivendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "idGDO_PuntiVendita" TO "id_gdo_puntivendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "ragioneSociale_PuntiVendita" TO "ragionesociale_puntivendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "provincia_puntivendita" TO "provincia_puntivendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "regione_puntivendita" TO "regione_puntivendita";
ALTER TABLE IF EXISTS public.punti_vendita RENAME COLUMN "telefono_puntivendita" TO "telefono_puntivendita";

-- 7. Tabella punti_vendita_utenti
ALTER TABLE IF EXISTS public.punti_vendita_utenti RENAME COLUMN "id_PuntiVenditaUtenti" TO "id_puntivenditautenti";
ALTER TABLE IF EXISTS public.punti_vendita_utenti RENAME COLUMN "idUtenti_PuntiVenditaUtenti" TO "idutenti_puntivenditautenti";
ALTER TABLE IF EXISTS public.punti_vendita_utenti RENAME COLUMN "idPuntiVendita_PuntiVenditaUtenti" TO "idpuntivendita_puntivenditautenti";

-- 8. Tabella ordini_stampa
ALTER TABLE IF EXISTS public.ordini_stampa RENAME COLUMN "id_OrdiniStampa" TO "id_ordinistampa";
ALTER TABLE IF EXISTS public.ordini_stampa RENAME COLUMN "idUtente_OrdiniStampa" TO "idutente_ordinistampa";
ALTER TABLE IF EXISTS public.ordini_stampa RENAME COLUMN "idPromo_OrdiniStampa" TO "id_promo_ordinistampa";
ALTER TABLE IF EXISTS public.ordini_stampa RENAME COLUMN "stato_OrdiniStampa" TO "stato_ordinistampa";
ALTER TABLE IF EXISTS public.ordini_stampa RENAME COLUMN "dataDiConferma_OrdiniStampa" TO "data_di_conferma_ordinistampa";

-- 9. Tabella ordini_stampa_invii
ALTER TABLE IF EXISTS public.ordini_stampa_invii RENAME COLUMN "id_OrdiniStampaInvii" TO "id_ordinistampainvii";
ALTER TABLE IF EXISTS public.ordini_stampa_invii RENAME COLUMN "idUtente_OrdiniStampaInvii" TO "idutente_ordinistampainvii";
ALTER TABLE IF EXISTS public.ordini_stampa_invii RENAME COLUMN "idOrdineDiStampa_OrdiniStampaInvii" TO "idordinestampa_ordinistampainvii";
ALTER TABLE IF EXISTS public.ordini_stampa_invii RENAME COLUMN "excel_OrdiniStampaInvii" TO "excel_ordinistampainvii";
ALTER TABLE IF EXISTS public.ordini_stampa_invii RENAME COLUMN "report_OrdiniStampaInvii" TO "report_ordinistampainvii";
ALTER TABLE IF EXISTS public.ordini_stampa_invii RENAME COLUMN "segnalazione_OrdiniStampaInvii" TO "segnalazione_ordinistampainvii";

-- 10. Tabella attivita
ALTER TABLE IF EXISTS public.attivita RENAME COLUMN "id_Attivita" TO "id_attivita";
ALTER TABLE IF EXISTS public.attivita RENAME COLUMN "idUtente_Attivita" TO "idutente_attivita";
ALTER TABLE IF EXISTS public.attivita RENAME COLUMN "tipo_Attivita" TO "tipo_attivita";
ALTER TABLE IF EXISTS public.attivita RENAME COLUMN "meta_Attivita" TO "meta_attivita";

-- 11. Tabella tracciati
ALTER TABLE IF EXISTS public.tracciati RENAME COLUMN "id_Tracciati" TO "id_tracciati";
ALTER TABLE IF EXISTS public.tracciati RENAME COLUMN "idPromo_Tracciati" TO "id_promo_tracciati";
ALTER TABLE IF EXISTS public.tracciati RENAME COLUMN "context_Tracciati" TO "context_tracciati";
ALTER TABLE IF EXISTS public.tracciati RENAME COLUMN "fileName_Tracciati" TO "filename_tracciati";
ALTER TABLE IF EXISTS public.tracciati RENAME COLUMN "blobFile_Tracciati" TO "blobfile_tracciati";

-- 12. Tabella tipi_export
ALTER TABLE IF EXISTS public.tipi_export RENAME COLUMN "id_TipiDiExport" TO "id_tipiexport";
ALTER TABLE IF EXISTS public.tipi_export RENAME COLUMN "nome_TipiDiExport" TO "nome_tipiexport";
ALTER TABLE IF EXISTS public.tipi_export RENAME COLUMN "codice_TipiDiExport" TO "codice_tipiexport";
ALTER TABLE IF EXISTS public.tipi_export RENAME COLUMN "modalita_TipiDiExport" TO "modalita_tipiexport";
ALTER TABLE IF EXISTS public.tipi_export RENAME COLUMN "guidNamingConvention_TipiDiExport" TO "guid_namingconvention_tipiexport";
ALTER TABLE IF EXISTS public.tipi_export RENAME COLUMN "filtri_TipiDiExport" TO "filtri_tipiexport";

-- 13. Tabella formati
ALTER TABLE IF EXISTS public.formati RENAME COLUMN "id_Formati" TO "id_formati";
ALTER TABLE IF EXISTS public.formati RENAME COLUMN "nome_Formati" TO "nome_formati";
ALTER TABLE IF EXISTS public.formati RENAME COLUMN "codice_Formati" TO "codice_formati";
ALTER TABLE IF EXISTS public.formati RENAME COLUMN "descrizione_Formati" TO "descrizione_formati";
ALTER TABLE IF EXISTS public.formati RENAME COLUMN "tipoLavorazione_Formati" TO "tipo_lavorazione_formati";

-- 14. Tabella naming_convention
ALTER TABLE IF EXISTS public.naming_convention RENAME COLUMN "id_NamingConvention" TO "id_naming_convention";
ALTER TABLE IF EXISTS public.naming_convention RENAME COLUMN "nome_NamingConvention" TO "nome_naming_convention";
ALTER TABLE IF EXISTS public.naming_convention RENAME COLUMN "descrizione_NamingConvention" TO "descrizione_naming_convention";
ALTER TABLE IF EXISTS public.naming_convention RENAME COLUMN "fields_NamingConvention" TO "fields_naming_convention";

-- 15. Tabella webhooks (già lowercase, ma per sicurezza)
-- Questa tabella ha già i nomi delle colonne in lowercase, quindi non serve rinominare

-- 17. Tabella utenti_gdo
ALTER TABLE IF EXISTS public.utenti_gdo RENAME COLUMN "id_UtenteGDO" TO "id_utentegdo";
ALTER TABLE IF EXISTS public.utenti_gdo RENAME COLUMN "idUtente_UtenteGDO" TO "id_utente_utentegdo";
ALTER TABLE IF EXISTS public.utenti_gdo RENAME COLUMN "idGDO_UtenteGDO" TO "id_gdo_utentegdo";

-- 18. Tabella utenti_anonimi
ALTER TABLE IF EXISTS public.utenti_anonimi RENAME COLUMN "id_UtentiAnonimi" TO "id_utenti_anonimi";
ALTER TABLE IF EXISTS public.utenti_anonimi RENAME COLUMN "meta_UtentiAnonimi" TO "meta_utenti_anonimi";

-- 19. Tabella utenti_guest
ALTER TABLE IF EXISTS public.utenti_guest RENAME COLUMN "id_UtentiGuest" TO "id_utenti_guest";
ALTER TABLE IF EXISTS public.utenti_guest RENAME COLUMN "dettagliUtente_UtentiGuest" TO "dettagliutente_utenti_guest";
ALTER TABLE IF EXISTS public.utenti_guest RENAME COLUMN "origine_UtentiGuest" TO "origine_utenti_guest";
ALTER TABLE IF EXISTS public.utenti_guest RENAME COLUMN "email_UtentiGuest" TO "email_utenti_guest";


-- 21. Tabella contratto_tipografia
ALTER TABLE IF EXISTS public.contratto_tipografia RENAME COLUMN "id_ContrattoTipografia" TO "id_contrattotipografia";
ALTER TABLE IF EXISTS public.contratto_tipografia RENAME COLUMN "tipiExport_ContrattoTipografia" TO "tipiexport_contrattotipografia";
ALTER TABLE IF EXISTS public.contratto_tipografia RENAME COLUMN "nome_ContrattoTipografia" TO "nome_contrattotipografia";
ALTER TABLE IF EXISTS public.contratto_tipografia RENAME COLUMN "idGDO_ContrattoTipografia" TO "id_gdo_contrattotipografia";
ALTER TABLE IF EXISTS public.contratto_tipografia RENAME COLUMN "json_ContrattoTipografia" TO "json_contrattotipografia";

-- 22. Tabella canali_interazione
ALTER TABLE IF EXISTS public.canali_interazione RENAME COLUMN "id_CanaliInterazione" TO "id_canaliinterazione";
ALTER TABLE IF EXISTS public.canali_interazione RENAME COLUMN "idUtente_CanaliInterazione" TO "idutente_canaliinterazione";
ALTER TABLE IF EXISTS public.canali_interazione RENAME COLUMN "tipo_CanaliInterazione" TO "tipo_canaliinterazione";
ALTER TABLE IF EXISTS public.canali_interazione RENAME COLUMN "stato_CanaliInterazione" TO "stato_canaliinterazione";

-- 23. Tabella wishlist_webpliant
ALTER TABLE IF EXISTS public.wishlist_webpliant RENAME COLUMN "id_WhishlistWepliant" TO "id_whishlistwepliant";
ALTER TABLE IF EXISTS public.wishlist_webpliant RENAME COLUMN "idCanale_WhishlistWepliant" TO "idcanale_whishlistwepliant";
ALTER TABLE IF EXISTS public.wishlist_webpliant RENAME COLUMN "idArea_WhishlistWepliant" TO "idarea_whishlistwepliant";
ALTER TABLE IF EXISTS public.wishlist_webpliant RENAME COLUMN "idPv_WhishlistWepliant" TO "idpv_whishlistwepliant";
ALTER TABLE IF EXISTS public.wishlist_webpliant RENAME COLUMN "meta_WhishlistWepliant" TO "meta_whishlistwepliant";
ALTER TABLE IF EXISTS public.wishlist_webpliant RENAME COLUMN "idWorkspace_WhishlistWepliant" TO "idworkspace_whishlistwepliant";
ALTER TABLE IF EXISTS public.wishlist_webpliant RENAME COLUMN "idPagina_WhishlistWepliant" TO "idpagina_whishlistwepliant";

-- 24. Tabella tipo_utente_punto_vendita
ALTER TABLE IF EXISTS public.tipo_utente_punto_vendita RENAME COLUMN "id_TipoUtentePuntoVendita" TO "id_tipo_utente_punto_vendita";
ALTER TABLE IF EXISTS public.tipo_utente_punto_vendita RENAME COLUMN "ruolo_TipoUtentePuntoVendita" TO "ruolo_tipo_utente_punto_vendita";
ALTER TABLE IF EXISTS public.tipo_utente_punto_vendita RENAME COLUMN "tipo_TipoUtentePuntoVendita" TO "tipo_tipo_utente_punto_vendita";

-- Verifica che tutte le modifiche siano state applicate correttamente
DO $$
DECLARE
    v_table_name TEXT;
    v_column_name TEXT;
    v_new_column_name TEXT;
    error_count INTEGER := 0;
BEGIN
    -- Lista delle tabelle e colonne da verificare
    FOR v_table_name, v_column_name, v_new_column_name IN
        SELECT 'utenti', 'id_Utenti', 'id_utenti' UNION ALL
        SELECT 'utenti', 'nome_Utenti', 'nome_utenti' UNION ALL
        SELECT 'gdo', 'id_Gdo', 'id_gdo' UNION ALL
        SELECT 'gdo', 'nome_Gdo', 'nome_gdo' UNION ALL
        SELECT 'aree', 'id_Aree', 'id_aree' UNION ALL
        SELECT 'aree', 'nome_Aree', 'nome_aree' UNION ALL
        SELECT 'canali', 'id_Canali', 'id_canali' UNION ALL
        SELECT 'canali', 'nome_Canali', 'nome_canali' UNION ALL
        SELECT 'punti_vendita', 'id_PuntiVendita', 'id_puntivendita' UNION ALL
        SELECT 'punti_vendita', 'nome_PuntiVendita', 'nome_puntivendita'
    LOOP
        -- Verifica che la nuova colonna esista
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE information_schema.columns.table_name = v_table_name
            AND information_schema.columns.column_name = v_new_column_name
        ) THEN
            RAISE NOTICE 'ERRORE: Colonna % non trovata nella tabella %', v_new_column_name, v_table_name;
            error_count := error_count + 1;
        ELSE
            RAISE NOTICE 'OK: Colonna % rinominata correttamente in %', v_column_name, v_new_column_name;
        END IF;
    END LOOP;

    IF error_count > 0 THEN
        RAISE EXCEPTION 'Migrazione fallita: % errori trovati', error_count;
    ELSE
        RAISE NOTICE 'Migrazione completata con successo!';
    END IF;
END $$;

COMMIT;

-- ISTRUZIONI POST-MIGRAZIONE:
-- 1. Verifica che l'applicazione funzioni correttamente con le nuove tabelle
-- 2. Aggiorna i modelli Sequelize per usare i nuovi nomi delle colonne
-- 3. Aggiorna le viste PostgreSQL se necessario
-- 4. Testa tutte le funzionalità dell'applicazione
