-- Aggiornamento della view v_attivita per includere is_read
-- DROP VIEW public.v_attivita;

CREATE OR REPLACE VIEW public.v_attivita
 AS
 SELECT a.id_attivita AS id,
    a.createdat AS data_creazione,
    a.idutente_attivita AS assegnato_a_id,
    COALESCE(u.nome_utenti, 'N/A'::character varying) AS nome_assegnato,
    COALESCE(u.cognome_utenti, 'N/A'::character varying) AS cognome_assegnato,
    a.tipo_attivita AS tipo,
    a.meta_attivita AS meta,
    CASE 
        WHEN au.id_attivita_utente IS NOT NULL THEN true 
        ELSE false 
    END AS is_read
   FROM attivita a
     LEFT JOIN utenti u ON a.idutente_attivita = u.id_utenti
     LEFT JOIN attivita_utente au ON a.id_attivita = au.id_attivita_attivita_utente
  ORDER BY a.createdat;

ALTER TABLE public.v_attivita
    OWNER TO postgres; 