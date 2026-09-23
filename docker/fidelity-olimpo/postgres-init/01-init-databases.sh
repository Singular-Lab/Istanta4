#!/bin/bash
# Eseguito dall'immagine PostgreSQL SOLO al primo avvio, cioè quando il volume
# dei dati è vuoto. Se il volume esiste già, questo script non viene rieseguito:
# se fallisce a metà, il database resta inizializzato parzialmente e va ricreato
# eliminando il volume (docker compose down -v), perdendo i dati.
#
# L'immagine ha già creato il database e il ruolo di Fidelity leggendo
# POSTGRES_DB e POSTGRES_USER. Qui si aggiungono le estensioni richieste e si
# crea il database separato di Olimpo.
set -euo pipefail

: "${OLIMPO_DB_NAME:?OLIMPO_DB_NAME non impostata}"
: "${OLIMPO_DB_USER:?OLIMPO_DB_USER non impostata}"
: "${OLIMPO_DB_PASSWORD:?OLIMPO_DB_PASSWORD non impostata}"

echo "[init] Estensioni sul database di Fidelity ($POSTGRES_DB)"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
-- uuid_generate_v4() è il defaultValue di parecchi modelli Sequelize.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Richiesta da DataTypes.GEOMETRY (per esempio geom_utenti sul modello Utente).
CREATE EXTENSION IF NOT EXISTS postgis;
SQL

# Nove script in server/core/db/scripts/ terminano con `OWNER TO postgres`, e li
# esegue Fidelity all'avvio. Qui il superutente si chiama come il database
# (POSTGRES_USER=fidelity), quindi un ruolo `postgres` non esiste e quegli script
# falliscono tutti con 42704. Il ruolo non serve per accedere — non ha LOGIN e
# nessuno ci si connette — serve solo a poter essere indicato come proprietario.
echo "[init] Ruolo postgres, atteso dagli script SQL di Fidelity"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<'SQL'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        CREATE ROLE postgres NOLOGIN;
    END IF;
END
$$;
SQL

echo "[init] Ruolo e database di Olimpo ($OLIMPO_DB_NAME)"
# Le variabili psql vanno passate da stdin: con -c non vengono interpolate e
# ":nome" arriverebbe letterale al server. :"x" cita un identificatore, :'x' un
# valore: è il modo corretto di inserire nomi e password senza concatenare SQL.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
    -v olimpo_user="$OLIMPO_DB_USER" \
    -v olimpo_password="$OLIMPO_DB_PASSWORD" \
    -v olimpo_db="$OLIMPO_DB_NAME" <<'SQL'
CREATE ROLE :"olimpo_user" LOGIN PASSWORD :'olimpo_password';
CREATE DATABASE :"olimpo_db" OWNER :"olimpo_user";
SQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$OLIMPO_DB_NAME" <<'SQL'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SQL

echo "[init] Inizializzazione completata."
