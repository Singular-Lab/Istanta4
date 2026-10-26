#!/bin/bash
# Eseguito dall'immagine PostgreSQL SOLO al primo avvio, cioè quando il volume
# dei dati è vuoto. Se il volume esiste già, questo script non viene rieseguito:
# se fallisce a metà, il database resta inizializzato parzialmente e va ricreato
# eliminando il volume (docker compose down -v), perdendo i dati.
#
# L'immagine ha già creato il database e il ruolo di Istanta leggendo
# POSTGRES_DB e POSTGRES_USER. Qui si crea il database separato di Correggo4 e
# si applicano gli schemi: nessuna delle due applicazioni li crea da sé.
#
# Gli schemi non sono elencati qui ma presi da due directory, in ordine
# alfabetico:
#
#   /schemas/istanta/*.sql     -> database di Istanta, come POSTGRES_USER
#   /schemas/correggo4/*.sql   -> database di Correggo4, come CORREGGO_DB_USER
#
# Quali file mettere dentro è una decisione dell'installazione, non di questo
# script: per Istanta, pg-ctx1.sql e pg-ctx2.sql sono due mappature ALTERNATIVE
# dello stesso modello (tredici entità in comune, PascalCase contro snake_case),
# quindi applicarli entrambi allo stesso database crea tabelle duplicate.
set -euo pipefail

: "${CORREGGO_DB_NAME:?CORREGGO_DB_NAME non impostata}"
: "${CORREGGO_DB_USER:?CORREGGO_DB_USER non impostata}"
: "${CORREGGO_DB_PASSWORD:?CORREGGO_DB_PASSWORD non impostata}"

conta_sql() {
    find "$1" -maxdepth 1 -name '*.sql' -type f 2>/dev/null | wc -l
}

# Si controlla tutto prima di creare qualsiasi cosa: fallire a metà lascerebbe
# un volume inizializzato male, che questo script non riprenderà mai più in
# mano perché PostgreSQL lo salta quando la directory dati non è vuota.
for dir in /schemas/istanta /schemas/correggo4; do
    if [ "$(conta_sql "$dir")" -eq 0 ]; then
        echo "[init] Nessuno schema .sql in $dir: monta SCHEMAS_DIR con le due sottocartelle popolate." >&2
        exit 1
    fi
done

echo "[init] Ruolo e database di Correggo4 ($CORREGGO_DB_NAME)"
# Le variabili psql vanno passate da stdin: con -c non vengono interpolate e
# ":nome" arriverebbe letterale al server. :"x" cita un identificatore, :'x' un
# valore: è il modo corretto di inserire nomi e password senza concatenare SQL.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
    -v correggo_user="$CORREGGO_DB_USER" \
    -v correggo_password="$CORREGGO_DB_PASSWORD" \
    -v correggo_db="$CORREGGO_DB_NAME" <<'SQL'
CREATE ROLE :"correggo_user" LOGIN PASSWORD :'correggo_password';
CREATE DATABASE :"correggo_db" OWNER :"correggo_user";
SQL

for file in $(find /schemas/istanta -maxdepth 1 -name '*.sql' -type f | sort); do
    echo "[init] Istanta <- $(basename "$file")"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$file"
done

# Applicati collegandosi COME il ruolo di Correggo4, non come superutente:
# altrimenti le tabelle nascerebbero di proprietà di un altro ruolo e
# l'applicazione non potrebbe scriverci. Durante l'inizializzazione
# l'autenticazione locale è `trust`, quindi non serve la password.
for file in $(find /schemas/correggo4 -maxdepth 1 -name '*.sql' -type f | sort); do
    echo "[init] Correggo4 <- $(basename "$file")"
    psql -v ON_ERROR_STOP=1 --username "$CORREGGO_DB_USER" --dbname "$CORREGGO_DB_NAME" -f "$file"
done

echo "[init] Inizializzazione completata."
