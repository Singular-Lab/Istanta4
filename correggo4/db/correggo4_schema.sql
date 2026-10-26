-- =====================================================================
-- Correggo4 — schema PostgreSQL
-- Riscrittura di correggo_conad_web (SQL Server / EF6 Database First).
-- Scritto il 3/9/2026 a partire dall'EDMX originale (21 tabelle).
-- RIFATTO il 7/10/2026: portato a 31 tabelle, com'e' il database adesso.
--
-- =====================================================================
-- COSA E' CAMBIATO IL 7/10/2026, e perche' il file era vecchio
-- =====================================================================
-- Dal 4 settembre a oggi il database e' cresciuto mentre si costruiva
-- Correggo4, e questo file e' rimasto fermo: elencava 21 tabelle su 31.
-- Chi avesse rifatto il database da qui si sarebbe trovato
-- un'applicazione che non parte.
--
-- AGGIUNTE DIECI TABELLE, nell'ordine in cui sono nate:
--   utenti_policy                 le policy per reparto dei Category (j219)
--   utenti_impostazioni           l'interruttore delle email di notifica
--   volantini_commenti            i commenti sul volantino nella home
--   volantini_finestre_category   la finestra in cui i Category correggono (j209)
--   volantini_foto_caricate       le foto caricate a mano su un box (j234)
--   volantini_timone              il piano di rimpaginazione del Marketing (j251)
--   volantini_timone_pagine       le pagine del piano, con la loro griglia
--   volantini_timone_voci         le referenze del piano: e' la tabella che conta
--   volantini_timone_blocchi      le caselle bloccate col divieto (j279)
--   volantini_timone_finestre     la finestra in cui il Marketing lavora
--
-- AGGIUNTE DUE COLONNE a tabelle che c'erano gia':
--   volantini_pagine_elementi_versioni.id_elemento_master  (Edit avanzato
--       propagato: il box pilota da cui arriva la correzione)
--   volantini_versioni.da_revocare  (sostituisce il "versione = 0"
--       dell'originale)
--
-- TRE COSE CHE NON TORNANO, lasciate come sono perche' il file deve
-- descrivere il database VERO, non quello che avrei scritto io. Chi le
-- vuole sistemare sa cosa sta cambiando:
--   a) le tabelle del 3/9 usano "GENERATED ALWAYS AS IDENTITY", quelle
--      nate dopo usano "bigserial". Fanno la stessa cosa in due modi
--      diversi: e' il segno che sono state aggiunte da migrazioni
--      separate, non da questo file.
--   b) volantini_finestre_category.classificazione e' "text", mentre la
--      gemella volantini_timone_finestre.classificazione e'
--      "varchar(80)" - come la colonna da cui arriva il valore
--      (volantini.classificazione). La prima e' larga, la seconda
--      giusta.
--   c) tre colonne di autore NON hanno la chiave esterna su utenti:
--      volantini_timone.id_sistemato, volantini_timone_blocchi.id_autore
--      e volantini_foto_caricate.id_autore/id_elemento. Sulle altre c'e'.
--      Aggiungerla e' una riga, ma va fatta sapendo che da quel momento
--      cancellare un utente non e' piu' indolore.
--
-- COME E' STATO VERIFICATO (e come si rifa' la verifica): si crea un
-- database vuoto, ci si esegue questo file, e si confronta il suo schema
-- con quello del database vero riga per riga (pg_dump --schema-only dei
-- due, diff). Il collaudo j329 lo fa e deve uscire senza differenze: e'
-- l'unica prova che conta per un file come questo.
-- =====================================================================
--
-- Differenze volute rispetto all'originale SQL Server, tutte motivate:
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
-- Policy per reparto (j219). AGGIUNTA il 7/10/2026.
-- Al punto 2 della testa c'e' scritto "niente PolicyManager": resta vero
-- per i PERMESSI (i ruoli sono due e bastano). Questa e' un'altra cosa:
-- dice su QUALI REFERENZE un Category puo' lavorare, filtrando per
-- settore, categoria e simili. Il filtro e' un jsonb perche' la forma
-- delle regole la decide l'interfaccia e cambia senza toccare il
-- database; la nota serve a chi legge la riga sei mesi dopo e vuole
-- sapere chi l'ha messa e perche'.
-- Una riga per utente: chi non ce l'ha vede tutto.
-- ---------------------------------------------------------------------
CREATE TABLE utenti_policy (
    id_utente          smallint PRIMARY KEY REFERENCES utenti(id) ON DELETE CASCADE,
    policy             jsonb NOT NULL,
    nota               text NOT NULL DEFAULT '',
    data_modifica      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN utenti_policy.policy IS 'es. {"regole":[[{"field":"codice_settore","inclusione":true,"valori":["40"]}]],"tool":[],"minVersion":1}';

-- ---------------------------------------------------------------------
-- Impostazioni dell'utente. AGGIUNTA il 7/10/2026.
-- Oggi c'e' un interruttore solo, le email di notifica. Sta in una
-- tabella sua e non in una colonna di `utenti` perche' le impostazioni
-- sono destinate a diventare piu' di una, e perche' `utenti` arriva
-- dall'SSO: meglio non mescolare quello che e' nostro con quello che
-- viene da fuori.
-- ---------------------------------------------------------------------
CREATE TABLE utenti_impostazioni (
    id_utente          smallint PRIMARY KEY REFERENCES utenti(id) ON DELETE CASCADE,
    email_notifiche    boolean NOT NULL DEFAULT true,
    data_modifica      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN utenti_impostazioni.email_notifiche IS 'false = l''utente ha silenziato le email di notifica (interruttore della colonna di sinistra).';

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
    contatore_revisioni       smallint NOT NULL DEFAULT 0,
    -- QUESTE DUE STANNO IN FONDO E NON IN MEZZO, ed e' voluto: sono
    -- state aggiunte dopo, con un ALTER TABLE, quindi nel database vero
    -- sono le ultime due colonne. Metterle in mezzo al file - come erano
    -- scritte fino al 7/10/2026 - vuol dire che un database rifatto da
    -- qui ha le colonne in un altro ordine, e un «select *» restituisce
    -- i campi in una sequenza diversa da quella vera. Lo ha scoperto il
    -- collaudo di j329, confrontando i due schemi riga per riga.
    guid_kit_runtime          uuid,             -- guidIdKitRuntime
    id_lavorazione_istanta    integer           -- aggancio lavorazione Istanta
);
-- i tre COMMENT qui sotto stavano in banca dati e in questo file no:
-- rimessi il 7/10/2026, perche' sono le tre colonne che agganciano
-- Correggo4 al mondo di fuori (fidelity-promotion e Istanta) e chi le
-- legge senza contesto non puo' indovinare a cosa servono
COMMENT ON COLUMN volantini.id_promo_fp IS 'guidIdPromo di fidelity-promotion';
COMMENT ON COLUMN volantini.guid_kit_runtime IS 'guidIdKitRuntime: identifica la pubblicazione, torna indietro nella notifica di esito';
COMMENT ON COLUMN volantini.id_lavorazione_istanta IS 'idLavorazioneIstanta: aggancio alla lavorazione lato Istanta';

CREATE INDEX ix_volantini_attivi   ON volantini(status, data_scadenza);
CREATE INDEX ix_volantini_promo_fp ON volantini(id_promo_fp) WHERE id_promo_fp IS NOT NULL;
CREATE INDEX ix_volantini_titolo   ON volantini(titolo);
-- AGGIUNTO il 7/10/2026: c'era in banca dati e non nel file. Serve alla
-- notifica di esito della pubblicazione, che torna indietro da Istanta
-- portando il guid del kit e deve ritrovare il volantino.
CREATE INDEX ix_volantini_kit_runtime ON volantini(guid_kit_runtime) WHERE guid_kit_runtime IS NOT NULL;

-- ---------------------------------------------------------------------
-- Commenti sul volantino. AGGIUNTA il 7/10/2026.
-- Non sono le correzioni (quelle stanno sui box, piu' sotto): sono i due
-- righi che si scrivono nella home, sulla card del volantino, per dirsi
-- qualcosa fra GDO e Agenzia. Non hanno stato ne' flusso: si scrivono e
-- si leggono, in ordine dal piu' recente.
-- ---------------------------------------------------------------------
CREATE TABLE volantini_commenti (
    id                 bigserial PRIMARY KEY,
    id_vol             int NOT NULL REFERENCES volantini(id) ON DELETE CASCADE,
    id_autore          smallint NOT NULL REFERENCES utenti(id),
    testo              text NOT NULL,
    data               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_volantini_commenti_vol ON volantini_commenti(id_vol, data DESC);

-- ---------------------------------------------------------------------
-- La finestra dei Category (j209). AGGIUNTA il 7/10/2026.
-- Dentro questa finestra i Category possono correggere; fuori, il server
-- risponde picche a ogni scrittura. La chiave e' la CLASSIFICAZIONE, non
-- il volantino: la finestra si apre su tutta la promo, perche' e' cosi'
-- che si lavora - non si apre un volantino per volta.
-- Una riga per promo: aprirla di nuovo sovrascrive le date.
-- Il CHECK impedisce la finestra che finisce prima di cominciare, che
-- senza vincolo e' un errore di battitura che nessuno nota.
-- ---------------------------------------------------------------------
CREATE TABLE volantini_finestre_category (
    classificazione    text PRIMARY KEY,
    data_inizio        timestamptz NOT NULL,
    data_fine          timestamptz NOT NULL,
    id_autore          smallint REFERENCES utenti(id),
    data_modifica      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_finestra_ordine CHECK (data_fine > data_inizio)
);

CREATE TABLE volantini_versioni (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_vol             int NOT NULL REFERENCES volantini(id) ON DELETE CASCADE,
    versione           smallint NOT NULL,
    data_pubblicazione timestamptz NOT NULL DEFAULT now(),
    data_chiusura      timestamptz,
    -- AGGIUNTA il 7/10/2026
    da_revocare        boolean NOT NULL DEFAULT false,
    UNIQUE (id_vol, versione)
);
COMMENT ON COLUMN volantini_versioni.da_revocare IS 'Sostituisce il "versione = 0" dell''originale (vedi RevocaVersioneVol)';

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

-- ---------------------------------------------------------------------
-- Foto caricate a mano su un box (j234). AGGIUNTA il 7/10/2026.
-- Le foto dei prodotti arrivano da Olimpo. Quando una manca o e'
-- sbagliata, la si carica a mano da Correggo4: il file va nello storage
-- esterno e qui resta la riga che dice quale box, quale referenza, con
-- che nome e con che md5 - l'md5 per riconoscere se e' la stessa foto
-- ricaricata due volte.
-- NON ha chiavi esterne, ed e' voluto solo a meta': vedi la nota (c) in
-- testa al file. Resta uno storico: cancellando il box la riga sopravvive
-- e si sa che quella foto era stata caricata.
-- ---------------------------------------------------------------------
CREATE TABLE volantini_foto_caricate (
    id                 bigserial PRIMARY KEY,
    id_elemento        bigint NOT NULL,
    codice             text NOT NULL,
    guid_id            text NOT NULL,
    nome_file          text NOT NULL,
    md5                text NOT NULL DEFAULT '',
    id_autore          smallint,
    data_caricamento   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_volantini_foto_caricate_elemento ON volantini_foto_caricate(id_elemento, codice);

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
    stato                    smallint NOT NULL DEFAULT 0,
    -- AGGIUNTA il 7/10/2026: l'Edit avanzato PROPAGATO. Quando una
    -- correzione nasce su un box e si propaga ai suoi gemelli, le righe
    -- dei gemelli non ripetono i valori: puntano al box pilota e li
    -- leggono da li'. Cosi' correggere il pilota corregge tutti, e non
    -- si creano venti copie che poi divergono.
    id_elemento_master       bigint REFERENCES volantini_pagine_elementi(id) ON DELETE CASCADE
);
COMMENT ON COLUMN volantini_pagine_elementi_versioni.id_elemento_master IS 'Edit avanzato propagato: il box pilota da cui arriva la correzione. Se e'' valorizzato, nuova_versione e'' vuota e i valori si leggono dal pilota.';
CREATE INDEX ix_elementi_versioni_elemento ON volantini_pagine_elementi_versioni(id_elemento);
CREATE INDEX ix_elementi_versioni_master   ON volantini_pagine_elementi_versioni(id_elemento_master) WHERE id_elemento_master IS NOT NULL;

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


-- =====================================================================
-- IL TIMONE (j251 e seguenti). AGGIUNTO il 7/10/2026.
--
-- Il volantino e' gia' impaginato; il Marketing deve poter rimettere
-- mano alla disposizione delle referenze - spostarle, raggrupparle,
-- cambiare la griglia della pagina, buttarne fuori alcune - e il
-- risultato deve poter essere rifatto dal plug-in InDesign.
--
-- IL PALETTO CHE SPIEGA TUTTO IL DISEGNO: il timone non scrive MAI sulle
-- tabelle dell'impaginato (volantini_pagine, volantini_pagine_elementi e
-- compagnia). A quelle righe puntano note, timbri, OK visto, Edit
-- avanzato e propagazioni: se il timone spostasse i box veri, le
-- correzioni resterebbero appese a prodotti che non stanno piu' li'.
-- Quindi il timone e' uno STRATO A PARTE, che si fotografa
-- dall'impaginato e poi vive di vita propria. Il legame col box di
-- partenza (volantini_timone_voci.id_elemento) serve SOLO a leggere -
-- il codice, il prezzo, il ritaglio della foto - e mai a scrivere.
-- Il perche' per esteso sta in claude/timone-specifica.md §2.1.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Il piano: uno per volantino e per versione.
-- La REVISIONE sale di uno a ogni salvataggio, ed e' il modo di
-- impedire che due persone si sovrascrivano: chi salva con una revisione
-- vecchia si sente rispondere "qualcun altro ha salvato" e non sovrascrive
-- niente.
-- data_sistemato (j317) e' una DATA e non un si'/no di proposito: se dopo
-- il "fatto" dell'Agenzia il Marketing salva di nuovo, il confronto con
-- data_salvataggio fa tornare da se' l'avviso nella home. Con un si'/no
-- resterebbe spento.
-- ---------------------------------------------------------------------
CREATE TABLE volantini_timone (
    id                      bigserial PRIMARY KEY,
    id_vol                  int NOT NULL REFERENCES volantini(id) ON DELETE CASCADE,
    versione                smallint NOT NULL,
    stato                   smallint NOT NULL DEFAULT 0,
    revisione               int NOT NULL DEFAULT 0,
    data_creazione          timestamptz NOT NULL DEFAULT now(),
    data_modifica           timestamptz,
    data_salvataggio        timestamptz,
    id_autore               smallint NOT NULL REFERENCES utenti(id),
    id_ultimo_salvataggio   smallint REFERENCES utenti(id),
    -- j317: quando l'Agenzia ha premuto FATTO. Senza FK su utenti, vedi
    -- la nota (c) in testa al file.
    data_sistemato          timestamptz,
    id_sistemato            smallint,
    CONSTRAINT ck_timone_stato CHECK (stato IN (0, 1, 2))
);
COMMENT ON COLUMN volantini_timone.stato IS '0 = in lavorazione · 1 = chiuso al Marketing · 2 = esportato';
COMMENT ON COLUMN volantini_timone.revisione IS 'sale di uno a ogni salvataggio: impedisce che due persone si sovrascrivano';
CREATE UNIQUE INDEX ux_timone_vol_versione ON volantini_timone(id_vol, versione);

-- ---------------------------------------------------------------------
-- Le pagine del piano.
-- La GRIGLIA e' il nome com'e' scritto a sistema: "2x3", "4x4"... e nel
-- nome il PRIMO numero sono le COLONNE, il secondo le RIGHE (girato il
-- 28/09 su indicazione di Michele, vedi claude/timone-griglie.md §1).
-- La CAPIENZA e' il prodotto dei due, e diventa il "limite" della pagina
-- nel file dei filtri che si consegna al plug-in.
-- L'ORDINE e' quello di impaginazione: 999 vuol dire "in fondo".
-- attiva/bloccata diventano "active" e "blocco" nello stesso file.
-- ---------------------------------------------------------------------
CREATE TABLE volantini_timone_pagine (
    id                 bigserial PRIMARY KEY,
    id_timone          bigint NOT NULL REFERENCES volantini_timone(id) ON DELETE CASCADE,
    numero             smallint NOT NULL,
    griglia            varchar(10),
    capienza           smallint NOT NULL DEFAULT 0,
    ordine             smallint NOT NULL DEFAULT 0,
    attiva             boolean NOT NULL DEFAULT true,
    bloccata           boolean NOT NULL DEFAULT false
);
COMMENT ON COLUMN volantini_timone_pagine.griglia IS 'la griglia scelta, per esempio 4x4 (primo numero = colonne). Null = come era impaginata. Le sette griglie ammesse sono fisse e stanno in Servizi/GriglieFormato.cs: NON arrivano da Istanta.';
COMMENT ON COLUMN volantini_timone_pagine.capienza IS 'quante referenze ci stanno (4x4 = 16). 0 = illimitata';
COMMENT ON COLUMN volantini_timone_pagine.ordine IS 'ordine di impaginazione: diventa "ordine" nel file dei filtri. 999 = in fondo';
CREATE UNIQUE INDEX ux_timone_pagine ON volantini_timone_pagine(id_timone, numero);

-- ---------------------------------------------------------------------
-- Le referenze del piano. E' la tabella che conta.
--
-- Da leggere con attenzione, perche' sono tre cose diverse che si
-- somigliano:
--   POSIZIONE        la casella nella griglia, contata da 1 per righe.
--                    Null = in pagina ma senza casella: e' il caso dei
--                    compagni di gruppo, vedi sotto.
--   PAGINA_ORIGINE   da quale pagina viene, per il confronto e per il
--                    report dell'Agenzia.
--   POSIZIONE_ORIGINE  ATTENZIONE: NON e' una casella. E' l'ordine di
--                    lettura dell'impaginato di partenza, che le griglie
--                    non le aveva. Confonderla con una casella e'
--                    l'errore piu' facile di tutta la tabella.
--
-- IL GRUPPO sta in UNA CASELLA SOLA: le voci dello stesso gruppo hanno lo
-- stesso id_gruppo, ma solo UNA tiene la posizione e le altre l'hanno
-- null. Da qui la regola che e' stata sbagliata due volte (j305 e j326):
-- per contare i posti di una pagina si contano le CASELLE OCCUPATE, non
-- le referenze. Una pagina con 6 caselle puo' avere 16 referenze.
--
-- COLONNE e RIGHE (j275) sono l'ingombro: quante caselle occupa questa
-- referenza. 1 e 1 e' il caso normale; la posizione e' la casella in
-- alto a sinistra.
--
-- Lo STATO tiene distinte due decisioni che non sono la stessa cosa:
-- "fuori volantino" (esiste, ma non la impaginiamo) ed "eliminata" (va
-- toglita del tutto). Non si cancella nessuna riga: si cambia stato,
-- cosi' si torna indietro e si sa sempre chi ha deciso cosa.
-- ---------------------------------------------------------------------
CREATE TABLE volantini_timone_voci (
    id                 bigserial PRIMARY KEY,
    id_timone          bigint NOT NULL REFERENCES volantini_timone(id) ON DELETE CASCADE,
    id_elemento        bigint REFERENCES volantini_pagine_elementi(id) ON DELETE CASCADE,
    codice             varchar(120) NOT NULL DEFAULT '',
    basecode           varchar(3000) NOT NULL DEFAULT '',
    etichetta          varchar(400) NOT NULL DEFAULT '',
    id_pagina_timone   bigint REFERENCES volantini_timone_pagine(id) ON DELETE SET NULL,
    posizione          smallint,
    id_gruppo          bigint,
    ruolo              varchar(20) NOT NULL DEFAULT '',
    stato              smallint NOT NULL DEFAULT 0,
    pagina_origine     smallint,
    posizione_origine  smallint,
    data_modifica      timestamptz,
    id_autore          smallint REFERENCES utenti(id),
    colonne            smallint NOT NULL DEFAULT 1,
    righe              smallint NOT NULL DEFAULT 1,
    CONSTRAINT ck_timone_voci_stato CHECK (stato IN (0, 1, 2, 3)),
    CONSTRAINT ck_timone_voci_ingombro CHECK (colonne >= 1 AND righe >= 1)
);
COMMENT ON COLUMN volantini_timone_voci.id_elemento IS 'il box di partenza, SOLO per risalire ai dati e al ritaglio: su quella riga non si scrive mai';
COMMENT ON COLUMN volantini_timone_voci.id_gruppo IS 'referenze raggruppate hanno lo stesso valore; null = sciolta';
COMMENT ON COLUMN volantini_timone_voci.stato IS '0 = in pagina · 1 = fuori volantino · 2 = eliminata · 3 = in sospeso (non ci sta: blocca il salvataggio)';
COMMENT ON COLUMN volantini_timone_voci.colonne IS 'Quante caselle occupa in larghezza. 1 = una sola. La casella di partenza e'' posizione.';
COMMENT ON COLUMN volantini_timone_voci.righe IS 'Quante caselle occupa in altezza. 1 = una sola.';
CREATE INDEX ix_timone_voci_pagina  ON volantini_timone_voci(id_timone, id_pagina_timone, posizione);
CREATE INDEX ix_timone_voci_codice  ON volantini_timone_voci(id_timone, codice);
CREATE INDEX ix_timone_voci_gruppo  ON volantini_timone_voci(id_timone, id_gruppo) WHERE id_gruppo IS NOT NULL;
-- l'indice che serve al salvataggio: con una sola voce in sospeso il
-- salvataggio non passa, e la domanda "ce n'e' almeno una?" si fa a ogni giro
CREATE INDEX ix_timone_voci_sospese ON volantini_timone_voci(id_timone) WHERE stato = 3;

-- ---------------------------------------------------------------------
-- Le caselle bloccate (j279).
-- Michele: "l'utente puo' decidere di bloccare una posizione perche' li'
-- ci vorra' un qualcosa di grafico". Non e' una referenza - non ha
-- codice ne' stato - ma OCCUPA una casella come una referenza, e va
-- contata quando si cerca quanta griglia serve.
-- L'unico sul posto: una casella si blocca una volta sola.
-- ---------------------------------------------------------------------
CREATE TABLE volantini_timone_blocchi (
    id                 bigserial PRIMARY KEY,
    id_timone          bigint NOT NULL REFERENCES volantini_timone(id) ON DELETE CASCADE,
    id_pagina_timone   bigint NOT NULL REFERENCES volantini_timone_pagine(id) ON DELETE CASCADE,
    posizione          smallint NOT NULL,
    data_modifica      timestamptz,
    -- senza FK su utenti, vedi la nota (c) in testa al file
    id_autore          smallint
);
CREATE UNIQUE INDEX ux_timone_blocchi ON volantini_timone_blocchi(id_pagina_timone, posizione);
CREATE INDEX ix_timone_blocchi_timone ON volantini_timone_blocchi(id_timone);

-- ---------------------------------------------------------------------
-- La finestra del Marketing.
-- Stessa forma della finestra dei Category, e per lo stesso motivo: la
-- chiave e' la classificazione, perche' la finestra si apre su tutta la
-- promo. Le due finestre sono INDIPENDENTI: possono anche sovrapporsi -
-- il timone non tocca le correzioni, quindi tecnicamente non si rompe
-- niente - ma l'interfaccia avvisa l'Agenzia quando succede, perche'
-- organizzativamente e' un pasticcio.
-- LA REGOLA DEI PERMESSI, che qui non si vede e va saputa: a finestra
-- APERTA scrive il Marketing e l'Agenzia guarda; a finestra CHIUSA e' il
-- contrario. L'esportazione dei filtri la fa l'Agenzia, a finestra chiusa.
-- ---------------------------------------------------------------------
CREATE TABLE volantini_timone_finestre (
    classificazione    varchar(80) PRIMARY KEY,
    data_inizio        timestamptz NOT NULL,
    data_fine          timestamptz NOT NULL,
    id_autore          smallint NOT NULL REFERENCES utenti(id),
    data_modifica      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_timone_finestra_ordine CHECK (data_fine > data_inizio)
);

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
