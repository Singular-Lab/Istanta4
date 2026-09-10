-- Rimozione view esistente
DROP VIEW IF EXISTS public.v_ordini_stampa_dettagli CASCADE;

CREATE VIEW v_ordini_stampa_dettagli AS
SELECT
    os."id_ordinistampa",
    os."stato_ordinistampa",
    os."data_di_conferma_ordinistampa",
    os."createdat" as data_creazione_ordine,
    u."nome_utenti" as nome_utente,
    u."cognome_utenti" as cognome_utente,
    u."email_utenti" as email_utente,
    u."tipo_utenti" as tipo_utente,
    COUNT(osi."id_ordinistampainvii") as numero_invii,
    COUNT(CASE WHEN osi."stato_OrdiniStampaInvii" = 'COMPLETATO' THEN 1 END) as invii_completati,
    COUNT(CASE WHEN osi."stato_OrdiniStampaInvii" = 'IN_LAVORAZIONE' THEN 1 END) as invii_in_lavorazione,
    COUNT(CASE WHEN osi."stato_OrdiniStampaInvii" = 'ERRORE' THEN 1 END) as invii_con_errore
FROM "ordini_stampa" os
JOIN "utenti" u ON os."idutente_ordinistampa" = u."id_utenti"
LEFT JOIN "ordini_stampa_invii" osi ON os."id_ordinistampa" = osi."idordinestampa_ordinistampainvii"
GROUP BY os."id_ordinistampa", os."stato_ordinistampa", os."data_di_conferma_ordinistampa", os."createdat",
         u."nome_utenti", u."cognome_utenti", u."email_utenti", u."tipo_utenti";
