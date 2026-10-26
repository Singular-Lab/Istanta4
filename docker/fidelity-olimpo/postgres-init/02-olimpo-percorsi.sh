#!/bin/bash
# Percorsi assoluti di Olimpo, al primo avvio.
#
# Eseguito dall'immagine PostgreSQL dopo 01-init-databases.sh (conta l'ordine
# alfabetico: il database di Olimpo deve esistere), e come quello SOLO quando il
# volume dei dati è vuoto.
#
# Perché serve: OlimpoService.initialize() legge dalla tabella absolute_paths i
# percorsi di tipo WEB, ARCHIVIO e VIDEO, e ne usa il campo `path` senza
# verificare di averli trovati:
#
#     this.PATH_WEB_ASSOLUTO = (await this.getAbsolutePathFromType(WEB)).path;
#
# Su un database nuovo la tabella è vuota, quindi `getAbsolutePathFromType`
# solleva una HttpException e `.path` viene letto su undefined. L'eccezione non
# è gestita e il processo termina. In produzione AppClusterService rilancia
# subito il worker, quindi il container resta "Up" mentre in realtà nessuno
# ascolta sulla porta: il guasto si presenta come "connessione rifiutata senza
# errori nei log", che è il modo più scomodo possibile.
#
# La tabella la creerebbe Sequelize all'avvio dell'applicazione, ma a quel punto
# è troppo tardi: serve che le righe ci siano PRIMA. La si crea quindi qui, con
# la stessa forma del modello (src/models/absolute_path.model.ts, timestamps
# disattivati); il `sync({ force: false })` dell'applicazione la trova già
# presente e la lascia stare.
#
# FtpService usa anche MATERIALI, quindi viene inserito insieme agli altri.
set -euo pipefail

: "${OLIMPO_DB_NAME:?OLIMPO_DB_NAME non impostata}"
: "${OLIMPO_DB_USER:?OLIMPO_DB_USER non impostata}"

# Dentro /app/uploads, che è il volume olimpo_uploads: così questi file
# sopravvivono agli aggiornamenti, come già FTP_ROOT. Sono percorsi INTERNI al
# container, non dell'host. Per cambiarli dopo il primo avvio basta una UPDATE
# sulla tabella; il codice li rilegge a ogni avvio.
PATH_WEB="${OLIMPO_PATH_WEB:-/app/uploads/web}"
PATH_ARCHIVIO="${OLIMPO_PATH_ARCHIVIO:-/app/uploads/archivio}"
PATH_MATERIALI="${OLIMPO_PATH_MATERIALI:-/app/uploads/materiali}"
PATH_VIDEO="${OLIMPO_PATH_VIDEO:-/app/uploads/video}"

echo "[init] Percorsi assoluti di Olimpo"
psql -v ON_ERROR_STOP=1 --username "$OLIMPO_DB_USER" --dbname "$OLIMPO_DB_NAME" \
    -v path_web="$PATH_WEB" \
    -v path_archivio="$PATH_ARCHIVIO" \
    -v path_materiali="$PATH_MATERIALI" \
    -v path_video="$PATH_VIDEO" <<'SQL'
-- Senza DEFAULT sull'id, per restare identica alla tabella che creerebbe
-- Sequelize: nel modello `id` e' @PrimaryKey @Column(DataType.UUID) e non ha
-- defaultValue. Se qui mettessimo un default, la stessa INSERT funzionerebbe su
-- un'installazione nuova e fallirebbe su una dove la tabella l'ha gia' creata
-- l'applicazione — cioe' proprio nei casi in cui si interviene a mano.
CREATE TABLE IF NOT EXISTS absolute_paths (
    id uuid PRIMARY KEY,
    path character varying(255),
    tipo character varying(255),
    active boolean
);

-- L'id si genera esplicitamente, per lo stesso motivo.
INSERT INTO absolute_paths (id, path, tipo, active) VALUES
    (gen_random_uuid(), :'path_web',       'WEB',       true),
    (gen_random_uuid(), :'path_archivio',  'ARCHIVIO',  true),
    (gen_random_uuid(), :'path_materiali', 'MATERIALI', true),
    (gen_random_uuid(), :'path_video',     'VIDEO',     true);
SQL

echo "[init] Percorsi di Olimpo inseriti."
