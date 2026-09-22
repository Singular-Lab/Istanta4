#!/bin/bash
# Crea il primo utente amministratore nei due database, al primo avvio.
#
# Eseguito dall'immagine PostgreSQL dopo 01-init-databases.sh (conta l'ordine
# alfabetico: gli schemi devono esistere prima di poterci inserire una riga), e
# come quello SOLO quando il volume dei dati è vuoto. Non è un seed che si
# ripete: serve ad avere credenziali con cui entrare la prima volta.
#
# Le due applicazioni memorizzano le password in modo molto diverso, quindi
# questo script fa due cose diverse:
#
#   Istanta    utenti.password è varchar(50) e LoginController confronta
#              direttamente `utente.Password == password`: la password finisce
#              nel database IN CHIARO. Non è una scelta di questo script, è come
#              funziona l'applicazione.
#
#   Correggo4  utenti.psw_hash contiene PBKDF2-SHA256 nel formato
#              pbkdf2.sha256$iterazioni$sale$chiave (Auth/Password.cs), che qui
#              viene generato con openssl. Verificato: a parità di sale,
#              iterazioni e password, openssl e Rfc2898DeriveBytes.Pbkdf2
#              producono la stessa chiave.
set -euo pipefail

: "${ADMIN_EMAIL:?ADMIN_EMAIL non impostata}"
: "${ADMIN_USERNAME:?ADMIN_USERNAME non impostata}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD non impostata}"
: "${CORREGGO_DB_NAME:?CORREGGO_DB_NAME non impostata}"
ADMIN_NOME="${ADMIN_NOME:-Amministratore}"
ADMIN_COGNOME="${ADMIN_COGNOME:-Sistema}"
# Ruolo in Correggo4: 1 = GDO (corregge), 2 = Agenzia (pubblica e conferma).
CORREGGO_ADMIN_RUOLO="${CORREGGO_ADMIN_RUOLO:-2}"

# utenti.password di Istanta è varchar(50): oltre, l'INSERT fallirebbe a metà
# inizializzazione e il volume resterebbe in uno stato che non verrà mai più
# ripreso in mano.
if [ "${#ADMIN_PASSWORD}" -gt 50 ]; then
    echo "[init] ADMIN_PASSWORD supera i 50 caratteri, che è il limite della colonna utenti.password di Istanta." >&2
    exit 1
fi

echo "[init] Utente amministratore su Istanta ($ADMIN_USERNAME)"
# stato 1 = Attivo, ruolo 1 = Superadmin (enum statoUtente e ruoloUtente in
# Istanta/Models/IstantaCore.cs).
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -v nome_utente="$ADMIN_USERNAME" \
    -v email="$ADMIN_EMAIL" \
    -v password="$ADMIN_PASSWORD" \
    -v nome="$ADMIN_NOME" \
    -v cognome="$ADMIN_COGNOME" <<'SQL'
INSERT INTO utenti ("nomeUtente", nome, cognome, email, password, stato, ruolo, data_registrazione)
VALUES (:'nome_utente', :'nome', :'cognome', :'email', :'password', 1, 1, now());
SQL

echo "[init] Utente amministratore su Correggo4 ($ADMIN_USERNAME)"
# Sale casuale di 16 byte. openssl kdf vuole il sale in esadecimale, mentre il
# formato memorizzato lo vuole in base64: si generano entrambe le forme dalla
# stessa sequenza di byte, passando da un file per non perdere nulla in una
# pipe di testo.
sale_bin=$(mktemp)
trap 'rm -f "$sale_bin"' EXIT
openssl rand -out "$sale_bin" 16
sale_b64=$(openssl base64 -A -in "$sale_bin")
sale_hex=$(od -An -v -tx1 < "$sale_bin" | tr -d ' \n')

chiave_b64=$(openssl kdf -keylen 32 \
    -kdfopt digest:SHA256 \
    -kdfopt pass:"$ADMIN_PASSWORD" \
    -kdfopt hexsalt:"$sale_hex" \
    -kdfopt iter:210000 \
    -binary PBKDF2 | openssl base64 -A)

psw_hash=$(printf 'pbkdf2.sha256$210000$%s$%s' "$sale_b64" "$chiave_b64")

psql -v ON_ERROR_STOP=1 --username "$CORREGGO_DB_USER" --dbname "$CORREGGO_DB_NAME" \
    -v nome="$ADMIN_NOME" \
    -v cognome="$ADMIN_COGNOME" \
    -v email="$ADMIN_EMAIL" \
    -v username="$ADMIN_USERNAME" \
    -v psw_hash="$psw_hash" \
    -v ruolo="$CORREGGO_ADMIN_RUOLO" <<'SQL'
INSERT INTO utenti (nome, cognome, email, username, psw_hash, ruolo, is_super_admin, attivo)
VALUES (:'nome', :'cognome', :'email', :'username', :'psw_hash', :'ruolo'::smallint, true, true);
SQL

echo "[init] Utente amministratore creato su entrambi i database."
