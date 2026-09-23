#!/usr/bin/env bash
# Dati minimi per poter entrare in Fidelity la prima volta.
#
# Si esegue con sudo, dalla directory del progetto, DOPO il primo avvio di
# Fidelity:
#
#   cd /opt/company-ai/projects/istanta4
#   sudo ./seed-fidelity.sh
#
# Perché non sta in postgres-init: `auth_providers`, `utenti` e `menu_items` le
# crea Sequelize quando Fidelity parte, quindi al momento dell'inizializzazione
# di PostgreSQL non esistono ancora. Scriverne qui la definizione significherebbe
# duplicare i modelli, e la copia divergerebbe al primo campo aggiunto. Meglio
# lasciarle creare all'applicazione e riempirle dopo.
#
# Lo script è idempotente: rilanciarlo non duplica nulla e non tocca quello che
# c'è già. Le tre parti sono indipendenti, quindi si può rilanciare anche solo
# per aggiungere le voci di menu introdotte da una versione nuova.
set -uo pipefail

rosso()  { printf '\033[31m%s\033[0m\n' "$*"; }
giallo() { printf '\033[33m%s\033[0m\n' "$*"; }
verde()  { printf '\033[32m%s\033[0m\n' "$*"; }

[ -f release.env ] || { rosso "release.env non trovato: esegui lo script dalla directory del progetto."; exit 1; }

leggi() {
    sed -n "s/^$1=//p" release.env | tail -n 1 | tr -d '\r' \
        | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

progetto=$(leggi COMPOSE_PROJECT_NAME); progetto="${progetto:-istanta4}"
db_user=$(leggi FIDELITY_DB_USER);      db_user="${db_user:-fidelity}"
db_name=$(leggi FIDELITY_DB_NAME);      db_name="${db_name:-fidelity}"
admin_email=$(leggi FIDELITY_ADMIN_EMAIL)
admin_password=$(leggi FIDELITY_ADMIN_PASSWORD)
admin_nome=$(leggi FIDELITY_ADMIN_NOME);       admin_nome="${admin_nome:-Amministratore}"
admin_cognome=$(leggi FIDELITY_ADMIN_COGNOME); admin_cognome="${admin_cognome:-Sistema}"

postgres_c="${progetto}-postgres-1"
fidelity_c="${progetto}-fidelity-1"

if [ -z "$admin_email" ] || [ -z "$admin_password" ]; then
    rosso "Servono FIDELITY_ADMIN_EMAIL e FIDELITY_ADMIN_PASSWORD in release.env."
    exit 1
fi

for c in "$postgres_c" "$fidelity_c"; do
    if ! docker inspect "$c" >/dev/null 2>&1; then
        rosso "Container $c non trovato."
        rosso "Distribuisci prima il progetto: le tabelle le crea Fidelity al suo avvio."
        exit 1
    fi
done

psql_fidelity() { docker exec -i "$postgres_c" psql -v ON_ERROR_STOP=1 -U "$db_user" -d "$db_name" "$@"; }

# Le tre tabelle devono già esserci: se mancano, Fidelity non è mai arrivata a
# sincronizzare i modelli e riempirle non avrebbe senso.
echo
echo "Tabelle attese"
mancanti=0
for t in auth_providers utenti menu_items; do
    if [ "$(psql_fidelity -tAc "select to_regclass('public.$t') is not null")" = t ]; then
        verde "  ok        $t"
    else
        rosso "  assente   $t"
        mancanti=$((mancanti + 1))
    fi
done
if [ "$mancanti" -gt 0 ]; then
    echo
    rosso "Fidelity non ha ancora creato le sue tabelle."
    echo "Controlla l'avvio: docker logs $fidelity_c 2>&1 | grep -i sincronizz"
    exit 1
fi

# L'hash si genera dentro il container di Fidelity, con la stessa libreria che
# poi lo verifica: `bcrypt` non è dichiarato in dependencies, arriva come
# dipendenza transitiva, quindi generarlo altrove sarebbe una scommessa sul
# formato ($2a$/$2b$/$2y$ non sono intercambiabili fra tutte le implementazioni).
echo
echo "Password dell'amministratore"
hash=$(docker exec -i -e SEED_PWD="$admin_password" "$fidelity_c" \
    node -e 'console.log(require("bcrypt").hashSync(process.env.SEED_PWD, 10))' 2>/dev/null | tr -d '\r')
case "$hash" in
    \$2[aby]\$*) verde "  ok        hash bcrypt generato con la libreria dell'applicazione" ;;
    *)  rosso "  errore    non sono riuscito a generare l'hash dentro $fidelity_c"
        rosso "            Verifica: docker exec $fidelity_c node -e \"require('bcrypt')\""
        exit 1 ;;
esac

echo
echo "Inserimenti"

# 1. Metodo di accesso. Senza almeno un provider attivo la pagina di login non
#    propone nulla su cui autenticarsi.
psql_fidelity <<'SQL' >/dev/null
INSERT INTO auth_providers
    (id, codice, nome, descrizione, icona, tipo, ordine, attivo,
     config_client, config_server, ruoli_ammessi, "createdAt", "updatedAt")
SELECT '4720cd6b-298d-42ad-a5a8-be3cd00f39d7', 'email_password', 'Email e Password',
       'Accedi con le tue credenziali email e password', 'Mail', 'internal', 0, true,
       NULL, NULL, NULL, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM auth_providers WHERE codice = 'email_password');
SQL
verde "  ok        auth_providers (email_password)"

# 2. Primo utente. Si confronta sull'email invece di usare ON CONFLICT, perché
#    non dipende dall'esistenza di un indice univoco su quella colonna.
psql_fidelity \
    -v email="$admin_email" \
    -v pwd_hash="$hash" \
    -v nome="$admin_nome" \
    -v cognome="$admin_cognome" <<'SQL' >/dev/null
INSERT INTO utenti
    (id_utenti, nome_utenti, cognome_utenti, email_utenti, password_utenti,
     stato_utenti, tipo_utenti, privatekey_utenti, outsider_utenti,
     createdat, updatedat)
SELECT gen_random_uuid(), :'nome', :'cognome', :'email', :'pwd_hash',
       'ATTIVO', 'Superadmin', gen_random_uuid()::text, false, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM utenti WHERE email_utenti = :'email');
SQL
verde "  ok        utenti ($admin_email, Superadmin)"

# 3. Voci di menu del Superadmin. Gli identificativi sono fissi di proposito:
#    sono dati di riferimento, e restano gli stessi su tutte le installazioni.
psql_fidelity <<'SQL' >/dev/null
INSERT INTO menu_items
  (id_menu_item, tipo_utente, ruolo_gdo, titolo, tipo, icona, pathname,
   codice_permesso, disabilitato, start_page, ordinamento, id_parent,
   createdat, updatedat)
VALUES
('7ac7896d-fae8-4ab8-98bc-58808c2221d9','Superadmin',NULL,'VOLANTINI','separator',NULL,NULL,NULL,false,false,0,NULL,NOW(),NOW()),
('e3e9679d-48e7-4a40-b1c5-5771972452eb','Superadmin',NULL,'Dashboard','item','LayoutDashboard','/dashboard','pagina.dashboard',false,false,1,NULL,NOW(),NOW()),
('97d81e0f-87a5-4d17-a073-4cb5dbc771fe','Superadmin',NULL,'PROMOZIONI','separator',NULL,NULL,NULL,false,false,2,NULL,NOW(),NOW()),
('c0a1cb43-d952-48f4-b3d5-3df0136e266e','Superadmin',NULL,'Nuova promozione','item','CirclePlus','/promozioni/nuova','pagina.nuova_lavorazione',false,false,3,NULL,NOW(),NOW()),
('c51138b8-a5d9-468a-bbe9-dfdc4624e99d','Superadmin',NULL,'Promozioni in corso','item','Activity','/promozioni/in-corso','pagina.lavorazioni_in_corso',false,false,4,NULL,NOW(),NOW()),
('cf751b87-81e6-4ba5-84d4-d0bef08098c7','Superadmin',NULL,'Storico promozioni','item','History','/promozioni/storico','pagina.storico_lavorazioni',false,false,5,NULL,NOW(),NOW()),
('6b03214e-1da8-4763-a67f-ca911415e8d6','Superadmin',NULL,'MATERIALI','separator',NULL,NULL,NULL,false,false,6,NULL,NOW(),NOW()),
('9377d668-7ce9-4215-9fca-274422fa533b','Superadmin',NULL,'Materiali attivi','item','FolderOpen','/materiali-attivi','pagina.materiali_attivi',false,false,7,NULL,NOW(),NOW()),
('c5779471-fe38-4b4a-b7fd-827c5ac5ef8e','Superadmin',NULL,'Materiali in corso','item','Clock','/materiali-in-corso','pagina.materiali_in_corso',false,false,8,NULL,NOW(),NOW()),
('ee608d8d-5439-4f26-9010-81d88c2dc6a0','Superadmin',NULL,'Storico materiali','item','Archive','/storico-materiali','pagina.storico_materiali',false,false,9,NULL,NOW(),NOW()),
('cadd7253-7ad9-4cdd-8063-4bd9b2582a8b','Superadmin',NULL,'ORDINI DI STAMPA','separator',NULL,NULL,NULL,false,false,10,NULL,NOW(),NOW()),
('1fd9830f-75f9-4ea0-a2cf-d3e42c7ea332','Superadmin',NULL,'Nuovo Ordine di Stampa','item','PackagePlus','/nuovo-ods','pagina.nuovo_ods',false,false,11,NULL,NOW(),NOW()),
('1c1c3281-4101-45be-a3ca-3a98dd5962fd','Superadmin',NULL,'Ordine di Stampa in corso','item','Truck','/ods-in-corso','pagina.ods_in_corso',false,false,12,NULL,NOW(),NOW()),
('2d5b27a4-4e2c-4a73-b6db-008da7a52281','Superadmin',NULL,'Ordine di Stampa completati','item','CircleCheck','/ods-completati','pagina.ods_completati',false,false,13,NULL,NOW(),NOW()),
('8b8214c1-51c9-4248-ba81-eddec2754457','Superadmin',NULL,'WEBPLIANT','separator',NULL,NULL,NULL,false,false,14,NULL,NOW(),NOW()),
('310e96be-2ab8-4588-bcea-20be1026e2d2','Superadmin',NULL,'Impostazioni WebPliant','item','Settings','/webliant/impostazioni-webpliant','pagina.impostazioni_webpliant',false,false,15,NULL,NOW(),NOW()),
('02fa3754-b947-47d7-93c3-c2c5ef29bb65','Superadmin',NULL,'Webpliant disponibili','item','Wallpaper','/webliant/webpliant-disponibili','pagina.webpliant_disponibili',false,false,16,NULL,NOW(),NOW()),
('654b1cda-c84f-42dc-bb08-ce87afb44ff6','Superadmin',NULL,'SERVIZI','separator',NULL,NULL,NULL,false,false,17,NULL,NOW(),NOW()),
('ac7d0a01-9558-4db5-9cac-b962e7e3538c','Superadmin',NULL,'Correggo','item','ThumbsUp','/dashboard-overview-8',NULL,true,false,18,NULL,NOW(),NOW()),
('52501e5c-d22c-412d-a1a3-c42b4314f22d','Superadmin',NULL,'Gestione Ricette','item','BookOpen','/gestione-ricette','pagina.gestione_ricette',false,false,19,NULL,NOW(),NOW()),
('1b9380f8-15dc-4735-bbfa-7bebe341a836','Superadmin',NULL,'Approfondimenti Vini','item','Wine','/gestione-approfondimento-vini','pagina.gestione_vini',false,false,20,NULL,NOW(),NOW()),
('3e70c8ce-2c65-4208-b5e2-a6850cb3a78b','Superadmin',NULL,'Whatsapp','item','PhoneForwarded','/whatsapp/gestione-whatsapp-superadmin','pagina.gestione_whatsapp_superadmin',false,false,21,NULL,NOW(),NOW()),
('4e36e61c-227b-4180-9501-852878b99215','Superadmin',NULL,'GESTIONE INTERNA','separator',NULL,NULL,NULL,false,false,22,NULL,NOW(),NOW()),
('71d3dd1c-697a-426b-bafd-4ca4bea4acfe','Superadmin',NULL,'Aree e Canali','item','Globe','/aree-e-canali','pagina.aree_e_canali',false,false,23,NULL,NOW(),NOW()),
('3dde53ae-19df-4cd7-b7ef-ba7246910d79','Superadmin',NULL,'Punti Vendita','item','Store','/punti-vendita','pagina.punti_vendita',false,false,24,NULL,NOW(),NOW()),
('4290ecac-d5be-46be-9090-69293b6ca7ca','Superadmin',NULL,'Gestione Utenti','item','Users','/gestione-utenti','pagina.gestione_utenti',false,false,25,NULL,NOW(),NOW()),
('7fb7ef8a-6626-4879-8222-68603dc4267f','Superadmin',NULL,'IMPOSTAZIONI','separator',NULL,NULL,NULL,false,false,26,NULL,NOW(),NOW()),
('9d1ab6b0-2bb1-4e45-b6ce-a418fea0106c','Superadmin',NULL,'Impostazioni Kit','item','SlidersVertical','/impostazioni-di-produzione','pagina.impostazioni_produzione',false,false,27,NULL,NOW(),NOW()),
('fccb70b4-eb04-4e22-b013-6b4222be1f3b','Superadmin',NULL,'Impostazioni Tipografia','item','FolderTree','/impostazioni-tipografia','pagina.impostazioni_tipografia',false,false,28,NULL,NOW(),NOW()),
('2a828c41-ec86-4533-9c8f-ea4580234f2a','Superadmin',NULL,'Gestione Permessi','item','Shield','/gestione-permessi','pagina.gestione_permessi',false,false,29,NULL,NOW(),NOW()),
('1ee578ea-154a-425e-bccd-c15e277559b9','Superadmin',NULL,'DEVELOPMENT SINGULAR','separator',NULL,NULL,NULL,false,false,30,NULL,NOW(),NOW()),
('e023fa1c-7af3-4bbe-9fd6-2bf0dd605175','Superadmin',NULL,'Gestione Pagine','item','PanelsTopLeft','/gestione-pagine-singular','pagina.gestione_pagine_singular',false,false,31,NULL,NOW(),NOW()),
('0b8f277c-bd3f-40d4-bf4c-f3b7b907b906','Superadmin',NULL,'Gestione Webhook','item','Zap','/gestione-webhook','pagina.gestione_webhook',false,false,32,NULL,NOW(),NOW())
ON CONFLICT (id_menu_item) DO NOTHING;
SQL
verde "  ok        menu_items (33 voci del Superadmin)"

echo
echo "Situazione"
psql_fidelity -c "select
    (select count(*) from auth_providers where attivo) as provider_attivi,
    (select count(*) from utenti)                     as utenti,
    (select count(*) from menu_items)                 as voci_menu;"

echo
verde "Fatto. Entra con $admin_email e la password che hai messo in release.env."
giallo "release.env contiene quella password in chiaro: tienilo a chmod 600."
