-- =====================================================================
-- Correggo4 — schema PostgreSQL (Fase 1: spina dorsale)
-- Riscrittura di correggo_conad_web (SQL Server / EF6 Database First).
-- Generato il 3/9/2026 a partire dall'EDMX originale (22 tabelle).
--
-- Differenze volute rispetto all'originale, tutte motivate:
--   1. FK polimorfiche: mantenute come colonne tipizzate MA con FK vere
--      e un CHECK che impone "esattamente una valorizzata". Nell'originale
--      non c'era nessun vincolo.
--   2. Permessi: niente PolicyManager. Due ruoli, GDO e Agenzia.
--   3. Password: hash, non testo in chiaro.
--   4. Colonne `image` (pdf, correzioni, allegati): sostituite da chiavi di
--      storage esterno, come gia' fatto per le foto in olimpo.
--   5. `dna` diventa jsonb (era testo con dentro JSON): indicizzabile.
--   6. Il GUID della promo di fidelity-promotion diventa una colonna vera
--      (`id_promo_fp`), non piu' cercato con LIKE dentro `descrizione`.
--   7. `sysdiagrams` (artefatto di SSMS) non riportata.
--   8. datetime -> timestamptz; tinyint -> smallint; decimal -> numeric.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Utenti
-- Originale: stato = StatoUtente {1=GDO, 2=Agenzia, 3=Eliminato},
-- piu' is_super_admin, id_gruppo, id_permesso, tipo_utente (FicoUserType).
-- Qui: ruolo a due valori + flag attivo. id_gruppo/id_permesso eliminati
-- insieme al sistema di policy per-reparto.
-- ---------------------------------------------------------------------
CREATE TABLE utenti (
    id                 smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome               varchar(100) NOT NULL,
    cognome            varchar(100) NOT NULL,
    email              varchar(150) NOT NULL UNIQUE,
    username           varchar(100) NOT NULL UNIQUE,
    telefono           varchar(100),
    psw_hash           text,                    -- NULL = accede solo via SSO
    ruolo              smallint NOT NULL CHECK (ruolo IN (1, 2)),  -- 1=GDO (corregge), 2=Agenzia (pubblica/conferma)
    is_super_admin     boolean  NOT NULL DEFAULT false,
    attivo             boolean  NOT NULL DEFAULT true,
    tipo_utente_fico   smallint,                -- FicoUserType dall'SSO, informativo
    data_inserimento   timestamptz NOT NULL DEFAULT now(),
    data_modifica      timestamptz
);
COMMENT ON COLUMN utenti.ruolo IS '1=GDO fa le correzioni, 2=Agenzia le legge e conferma';

CREATE TABLE utenti_preferenze (
    id                 smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_utente          smallint NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
    cartella           varchar(80) NOT NULL,
    data_salvataggio   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_utenti_preferenze_utente ON utenti_preferenze(id_utente, data_salvataggio DESC);

-- ---------------------------------------------------------------------
-- Formati pagina (tabella di configurazione, invariata)
-- ---------------------------------------------------------------------
CREATE TABLE formati (
    id                 smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome               varchar(50) NOT NULL,
    w_reale            numeric(18,2) NOT NULL,
    w_esportazione     numeric(18,2) NOT NULL,   -- originale: w_esportazioe (refuso)
    coefficiente       numeric(18,2) NOT NULL    -- originale: coefficente (refuso)
);

-- ---------------------------------------------------------------------
-- Volantini
-- ---------------------------------------------------------------------
CREATE TABLE volantini (
    id                        int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titolo                    varchar(150) NOT NULL,
    descrizione               varchar(400),
    classificazione           varchar(80) NOT NULL,
    id_promo_fp               uuid,             -- era "$<guid>" dentro descrizione
    guid_kit_runtime          uuid,             -- guidIdKitRuntime
    id_lavorazione_istanta    integer,          -- aggancio lavorazione Istanta
    id_formato                smallint REFERENCES formati(id),
    larghezza_pagina          numeric(18,2),
    altezza_pagina            numeric(18,2),
    margini                   varchar(500),
    id_autore                 smallint REFERENCES utenti(id),
    data_pubblicazione        timestamptz,
    ultima_pubblicazione      timestamptz,
    tot_pubblicazioni         smallint NOT NULL DEFAULT 0,
    status                    smallint NOT NULL,   -- StatoVolantino
    stato_pubblicazione       smallint NOT NULL DEFAULT 0,
    coda_pubblicazione        smallint NOT NULL DEFAULT 0,
    progress_pubblicazione    smallint NOT NULL DEFAULT 0,
    data_validita_inizio      timestamptz NOT NULL,
    data_validita_fine        timestamptz NOT NULL,
    data_scadenza             timestamptz NOT NULL,
    ultima_visita             timestamptz,
    -- blocco esclusivo della GDO, 1 ora, vedi mappa funzionale §6
    id_autore_blocco          smallint REFERENCES utenti(id),
    data_registrazione_blocco timestamptz,
    data_scadenza_blocco      timestamptz,
    -- contatori denormalizzati, aggiornati dal demone
    contatore                 smallint NOT NULL DEFAULT 0,
    contatore_conferme        smallint NOT NULL DEFAULT 0,
    contatore_revisioni       smallint NOT NULL DEFAULT 0
);
CREATE INDEX ix_volantini_attivi   ON volantini(status, data_scadenza);
CREATE INDEX ix_volantini_promo_fp ON volantini(id_promo_fp) WHERE id_promo_fp IS NOT NULL;
CREATE INDEX ix_volantini_titolo   ON volantini(titolo);

CREATE TABLE volantini_versioni (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_vol             int NOT NULL REFERENCES volantini(id) ON DELETE CASCADE,
    versione           smallint NOT NULL,
    data_pubblicazione timestamptz NOT NULL DEFAULT now(),
    data_chiusura      timestamptz,
    UNIQUE (id_vol, versione)
);

CREATE TABLE volantini_pagine (
    id                    int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_vol                int NOT NULL REFERENCES volantini(id) ON DELETE CASCADE,
    id_versione           bigint REFERENCES volantini_versioni(id),
    numero                smallint NOT NULL,
    versione              smallint NOT NULL,
    -- geometria: nell'XML arriva come bounds="top,left,bottom,right"
    sinistra              numeric(18,2) NOT NULL,
    alto                  numeric(18,2) NOT NULL,
    larghezza             numeric(18,2) NOT NULL,
    altezza               numeric(18,2) NOT NULL,
    rapporto_x            numeric(18,2),
    rapporto_y            numeric(18,2),
    margine_esterno       numeric(18,2),
    path                  varchar(200) NOT NULL,     -- es. pag3_v2
    path_fisico           varchar(250),              -- <classificazione>/<titolo>/pag3_v2
    mastro                varchar(80),
    stato                 smallint NOT NULL DEFAULT 0,
    data_versione         timestamptz NOT NULL DEFAULT now(),
    ultimo_aggiornamento  timestamptz,
    ultima_visita         timestamptz,
    contatore             smallint NOT NULL DEFAULT 0,
    contatore_conferme    smallint NOT NULL DEFAULT 0,
    UNIQUE (id_vol, numero, versione)
);
CREATE INDEX ix_pagine_versione ON volantini_pagine(id_versione);

-- ---------------------------------------------------------------------
-- Elementi (box e campi). Gerarchia parent/child sullo stesso tavolo.
-- basecode + dna sono la chiave di tutta la propagazione.
-- ---------------------------------------------------------------------
CREATE TABLE volantini_pagine_elementi (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pagina           int NOT NULL REFERENCES volantini_pagine(id) ON DELETE CASCADE,
    id_parent           bigint REFERENCES volantini_pagine_elementi(id) ON DELETE CASCADE,
    tipo                smallint NOT NULL,      -- TipoElemento: Box | Campo
    label_ind           varchar(150) NOT NULL DEFAULT '',
    basecode            varchar(3000) NOT NULL DEFAULT '',
    dna                 jsonb,                  -- {codice, gruppo, descrizione} — era text
    contenuto           text NOT NULL DEFAULT '',
    z_index             smallint NOT NULL DEFAULT 0,
    posizione_x         numeric(18,2) NOT NULL,
    posizione_y         numeric(18,2) NOT NULL,
    larghezza           numeric(18,2) NOT NULL,
    altezza             numeric(18,2) NOT NULL,
    stato               smallint NOT NULL DEFAULT 0,
    ultimo_cambiamento  timestamptz,
    data_ok             timestamptz,
    id_autore_ok        smallint REFERENCES utenti(id),
    contatore           smallint NOT NULL DEFAULT 0,
    contatore_conferme  smallint NOT NULL DEFAULT 0
);
CREATE INDEX ix_elementi_pagina   ON volantini_pagine_elementi(id_pagina);
CREATE INDEX ix_elementi_parent   ON volantini_pagine_elementi(id_parent) WHERE id_parent IS NOT NULL;
CREATE INDEX ix_elementi_basecode ON volantini_pagine_elementi(basecode) WHERE id_parent IS NULL;
CREATE INDEX ix_elementi_dna_gr   ON volantini_pagine_elementi((dna->>'gruppo'));

CREATE TABLE volantini_pagine_elementi_versioni (
    id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_elemento              bigint NOT NULL REFERENCES volantini_pagine_elementi(id) ON DELETE CASCADE,
    id_pagina                int REFERENCES volantini_pagine(id),
    id_elemento_propagazione bigint,   -- FK aggiunta piu' sotto (tabella non ancora creata)
    new_posx                 numeric(18,2) NOT NULL,
    new_posy                 numeric(18,2) NOT NULL,
    new_width                numeric(18,2),
    new_height               numeric(18,2),
    nuova_versione           text NOT NULL,
    data_modifica            timestamptz NOT NULL DEFAULT now(),
    id_autore                smallint NOT NULL REFERENCES utenti(id),
    stato                    smallint NOT NULL DEFAULT 0
);
CREATE INDEX ix_elementi_versioni_elemento ON volantini_pagine_elementi_versioni(id_elemento);

-- ---------------------------------------------------------------------
-- Correzioni: note, disegni, post-it
-- ---------------------------------------------------------------------
CREATE TABLE volantini_pagine_note (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pagina         int NOT NULL REFERENCES volantini_pagine(id) ON DELETE CASCADE,
    id_elemento       bigint REFERENCES volantini_pagine_elementi(id) ON DELETE CASCADE,
    tipo              smallint NOT NULL DEFAULT 0,
    descrizione       text NOT NULL,
    posx              double precision NOT NULL,
    posy              double precision NOT NULL,
    ref_region        varchar(50),
    ref_label         varchar(50),
    allegato_key      text,          -- era colonna `image`: ora chiave su storage esterno
    stato             smallint NOT NULL DEFAULT 0,
    id_autore         smallint REFERENCES utenti(id),
    data_inserimento  timestamptz NOT NULL DEFAULT now(),
    data_modifica     timestamptz,
    id_correttore     smallint REFERENCES utenti(id),
    data_correzione   timestamptz,
    id_revisore       smallint REFERENCES utenti(id),
    data_revisione    timestamptz
);
CREATE INDEX ix_note_pagina   ON volantini_pagine_note(id_pagina);
CREATE INDEX ix_note_elemento ON volantini_pagine_note(id_elemento) WHERE id_elemento IS NOT NULL;

CREATE TABLE volantini_pagine_disegni_composizioni (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pagina         int NOT NULL REFERENCES volantini_pagine(id) ON DELETE CASCADE,
    id_elemento       bigint REFERENCES volantini_pagine_elementi(id) ON DELETE CASCADE,
    simbolo           varchar(40) NOT NULL,      -- 'penna', 'mezza', 'movPrec', ...
    color             varchar(50),
    border            smallint NOT NULL DEFAULT 0,
    stato             smallint NOT NULL DEFAULT 0,
    id_autore         smallint NOT NULL REFERENCES utenti(id),
    data_inserimento  timestamptz NOT NULL DEFAULT now(),
    id_correttore     smallint REFERENCES utenti(id),
    data_correzione   timestamptz,
    id_revisore       smallint REFERENCES utenti(id),
    data_revisione    timestamptz
);
CREATE INDEX ix_disegni_comp_pagina   ON volantini_pagine_disegni_composizioni(id_pagina);
CREATE INDEX ix_disegni_comp_elemento ON volantini_pagine_disegni_composizioni(id_elemento) WHERE id_elemento IS NOT NULL;

CREATE TABLE volantini_pagine_disegni (
    id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_gruppo bigint NOT NULL REFERENCES volantini_pagine_disegni_composizioni(id) ON DELETE CASCADE,
    vectors   text NOT NULL
);
CREATE INDEX ix_disegni_gruppo ON volantini_pagine_disegni(id_gruppo);

CREATE TABLE volantini_postit (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_volantino       int NOT NULL REFERENCES volantini(id) ON DELETE CASCADE,
    versione_vol       smallint NOT NULL,
    messaggio          varchar(500) NOT NULL,
    id_autore          smallint NOT NULL REFERENCES utenti(id),
    stato              smallint NOT NULL DEFAULT 0,
    data_registrazione timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_postit_volantino ON volantini_postit(id_volantino, versione_vol);

-- ---------------------------------------------------------------------
-- Propagazione
-- Il master e' UNA nota OPPURE UN disegno: nell'originale erano due
-- colonne opzionali senza vincoli. Qui il CHECK lo impone.
-- ---------------------------------------------------------------------
CREATE TABLE volantini_propagazioni (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_nota_master     bigint REFERENCES volantini_pagine_note(id) ON DELETE CASCADE,
    id_disegno_master  bigint REFERENCES volantini_pagine_disegni_composizioni(id) ON DELETE CASCADE,
    data_registrazione timestamptz NOT NULL DEFAULT now(),
    visto              boolean NOT NULL DEFAULT false,
    data_visto         timestamptz,
    attivo             smallint NOT NULL DEFAULT 1,
    CONSTRAINT ck_propagazioni_un_solo_master CHECK (
        (id_nota_master IS NOT NULL)::int + (id_disegno_master IS NOT NULL)::int = 1
    )
);

CREATE TABLE volantini_propagazioni_elementi (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_propagazione  bigint NOT NULL REFERENCES volantini_propagazioni(id) ON DELETE CASCADE,
    id_elemento      bigint NOT NULL REFERENCES volantini_pagine_elementi(id) ON DELETE CASCADE,
    stato            smallint NOT NULL DEFAULT 0,
    attivo           boolean NOT NULL DEFAULT true,
    data_attivazione timestamptz,
    id_autore        smallint REFERENCES utenti(id),
    id_correttore    smallint REFERENCES utenti(id),
    data_correzione  timestamptz,
    id_revisore      smallint REFERENCES utenti(id),
    data_revisione   timestamptz,
    UNIQUE (id_propagazione, id_elemento)
);
CREATE INDEX ix_prop_elementi_elemento ON volantini_propagazioni_elementi(id_elemento);

ALTER TABLE volantini_pagine_elementi_versioni
    ADD CONSTRAINT fk_elementi_versioni_propagazione
    FOREIGN KEY (id_elemento_propagazione)
    REFERENCES volantini_propagazioni_elementi(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- Chat sulle correzioni
-- Un thread appartiene a una nota, un disegno o un elemento propagato.
-- ---------------------------------------------------------------------
CREATE TABLE volantini_correzzioni_messaggistica (
    id                           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_parent                    bigint REFERENCES volantini_correzzioni_messaggistica(id) ON DELETE CASCADE,
    id_nota                      bigint REFERENCES volantini_pagine_note(id) ON DELETE CASCADE,
    id_disegno                   bigint REFERENCES volantini_pagine_disegni_composizioni(id) ON DELETE CASCADE,
    id_propagato                 bigint REFERENCES volantini_propagazioni_elementi(id) ON DELETE CASCADE,
    id_autore                    smallint REFERENCES utenti(id),
    messaggio                    text NOT NULL,
    tags                         varchar(200),
    stato                        smallint NOT NULL DEFAULT 0,
    data_registrazione           timestamptz NOT NULL DEFAULT now(),
    data_invio_email_programmata timestamptz,
    data_invio_email             timestamptz,
    CONSTRAINT ck_messaggistica_un_solo_target CHECK (
        (id_nota IS NOT NULL)::int + (id_disegno IS NOT NULL)::int + (id_propagato IS NOT NULL)::int = 1
    )
);
CREATE INDEX ix_msg_nota      ON volantini_correzzioni_messaggistica(id_nota)      WHERE id_nota IS NOT NULL;
CREATE INDEX ix_msg_disegno   ON volantini_correzzioni_messaggistica(id_disegno)   WHERE id_disegno IS NOT NULL;
CREATE INDEX ix_msg_propagato ON volantini_correzzioni_messaggistica(id_propagato) WHERE id_propagato IS NOT NULL;

-- ---------------------------------------------------------------------
-- Notifiche
-- ---------------------------------------------------------------------
CREATE TABLE notifiche (
    id                        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_utente                 smallint NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
    id_nota                   bigint REFERENCES volantini_pagine_note(id) ON DELETE CASCADE,
    id_disegno                bigint REFERENCES volantini_pagine_disegni_composizioni(id) ON DELETE CASCADE,
    id_propagazione_elemento  bigint REFERENCES volantini_propagazioni_elementi(id) ON DELETE CASCADE,
    id_volantino              int REFERENCES volantini(id) ON DELETE CASCADE,
    tag                       varchar(20),
    stato                     smallint NOT NULL DEFAULT 0,
    data_registrazione        timestamptz NOT NULL DEFAULT now(),
    data_lettura              timestamptz,
    data_modifica             timestamptz,
    CONSTRAINT ck_notifiche_un_solo_target CHECK (
        (id_nota IS NOT NULL)::int + (id_disegno IS NOT NULL)::int
      + (id_propagazione_elemento IS NOT NULL)::int + (id_volantino IS NOT NULL)::int = 1
    )
);
CREATE INDEX ix_notifiche_da_leggere ON notifiche(id_utente, stato) WHERE data_lettura IS NULL;

CREATE TABLE volantini_notifiche (
    id                     int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_volantino           int NOT NULL REFERENCES volantini(id) ON DELETE CASCADE,
    data_ultima_correzione timestamptz,
    data_ultima_email      timestamptz
);

CREATE TABLE volantini_notifiche_email (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_notifica int NOT NULL REFERENCES volantini_notifiche(id) ON DELETE CASCADE,
    oggetto     varchar(150) NOT NULL,
    messaggio   text NOT NULL,
    data_invio  timestamptz
);

CREATE TABLE settings_email (
    id         int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    materiale  varchar(250) NOT NULL,
    email      varchar(250) NOT NULL,
    stato      smallint NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------
-- Revisione (scambio PDF/correzioni con l'esterno)
-- Le due colonne `image` diventano chiavi di storage esterno.
-- ---------------------------------------------------------------------
CREATE TABLE volantini_revisione (
    id                int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_volantino      int NOT NULL REFERENCES volantini(id) ON DELETE CASCADE,
    data_esportazione timestamptz NOT NULL DEFAULT now(),
    data_ricezione    timestamptz,
    pdf_key           text,
    correzioni_key    text
);
CREATE INDEX ix_revisione_volantino ON volantini_revisione(id_volantino);

-- ---------------------------------------------------------------------
-- Coda del demone
-- Nell'originale: 6 colonne FK opzionali senza vincoli, e il demone
-- veniva svegliato da qualcuno dall'esterno via HTTP. Qui resta la coda
-- (utile e ispezionabile) ma la consuma un BackgroundService interno.
-- L'indice parziale e' la query che il demone fa a ogni giro.
-- ---------------------------------------------------------------------
CREATE TABLE demone_activity (
    id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo_azione              smallint NOT NULL,   -- TipoDemoneActivity (CostruzioneCatena, ...)
    id_vol                   int    REFERENCES volantini(id) ON DELETE CASCADE,
    id_nota                  bigint REFERENCES volantini_pagine_note(id) ON DELETE CASCADE,
    id_disegno               bigint REFERENCES volantini_pagine_disegni_composizioni(id) ON DELETE CASCADE,
    id_propagazione          bigint REFERENCES volantini_propagazioni(id) ON DELETE CASCADE,
    id_elemento_propagazione bigint REFERENCES volantini_propagazioni_elementi(id) ON DELETE CASCADE,
    id_elemento              bigint REFERENCES volantini_pagine_elementi(id) ON DELETE CASCADE,
    data_registrazione       timestamptz NOT NULL DEFAULT now(),
    data_inizio_processo     timestamptz,
    data_processo            timestamptz,
    errore                   text
);
CREATE INDEX ix_demone_da_processare
    ON demone_activity(data_registrazione)
    WHERE data_processo IS NULL;

COMMIT;
