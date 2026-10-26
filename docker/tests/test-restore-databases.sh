#!/usr/bin/env bash
# Test d'integrazione di docker/restore-databases.sh e dei due dump-databases.sh.
#
#   bash docker/tests/test-restore-databases.sh
#
# Lavora SOLO su container usa e getta, con nomi propri (rtest<pid>...), e li
# cancella alla fine: non tocca nessun container o volume esistente. Serve Docker
# e la possibilita' di scaricare postgis/postgis:17-3.5, postgres:17,
# redis:7-alpine e alpine.
#
# Ricostruisce in piccolo i due stack (ruoli, database ed estensioni come gli
# script di postgres-init), esporta dati "nuovo" con i dump-databases.sh veri,
# porta i database a "vecchio" e verifica che il ripristino:
#   - rifiuti di procedere senza conferma e con un dump alterato;
#   - riporti i dati "nuovo" con i proprietari giusti e PostGIS funzionante;
#   - riallinei i percorsi di Olimpo, svuoti Redis, riavvii le applicazioni;
#   - salvi prima i database "vecchio", e che da quel backup si torni indietro.
set -uo pipefail

# Git Bash su Windows riscrive gli argomenti che sembrano percorsi
# (/tmp/..., /dev/stdin) prima di passarli a docker; su Linux non cambia nulla.
export MSYS_NO_PATHCONV=1

qui=$(cd "$(dirname "$0")" && pwd)
radice=$(dirname "$qui")
pfx="rtest$$"
fo="${pfx}fo"
ic="${pfx}ic"
tmp=$(mktemp -d)

pulisci() {
    docker ps -aq --filter "name=^${pfx}" | xargs -r docker rm -f >/dev/null 2>&1
    rm -rf "$tmp"
}
trap pulisci EXIT

falliti=0
verifica() {
    local descrizione="$1" atteso="$2" reale="$3"
    if [ "$atteso" = "$reale" ]; then
        printf '  \033[32mok\033[0m    %s\n' "$descrizione"
    else
        printf '  \033[31mKO\033[0m    %s: atteso [%s], trovato [%s]\n' "$descrizione" "$atteso" "$reale"
        falliti=$((falliti + 1))
    fi
}

q() {  # container utente database sql
    docker exec -i "$1" psql -v ON_ERROR_STOP=1 -U "$2" -d "$3" -tA -c "$4" | tr -d '\r'
}

aspetta_postgres() {
    # L'immagine ufficiale avvia un server temporaneo per l'inizializzazione e poi
    # lo riavvia: e' pronto davvero alla seconda "ready to accept connections".
    local c="$1" i
    for i in $(seq 1 120); do
        if [ "$(docker logs "$c" 2>&1 | grep -c 'ready to accept connections')" -ge 2 ]; then
            return 0
        fi
        sleep 1
    done
    echo "Timeout in attesa di $c"; docker logs "$c" | tail -20; exit 1
}

echo "Container usa e getta ($pfx)"
docker run -d --name "${fo}-postgres-1" -e POSTGRES_USER=fidelity -e POSTGRES_PASSWORD=prova \
    -e POSTGRES_DB=fidelity postgis/postgis:17-3.5 >/dev/null || exit 1
docker run -d --name "${ic}-postgres-1" -e POSTGRES_USER=istanta -e POSTGRES_PASSWORD=prova \
    -e POSTGRES_DB=istanta postgres:17 >/dev/null || exit 1
docker run -d --name "${fo}-redis-1" redis:7-alpine >/dev/null || exit 1
docker run -d --name "${fo}-fidelity-1" alpine sleep 3600 >/dev/null || exit 1   # applicazione finta
aspetta_postgres "${fo}-postgres-1"
aspetta_postgres "${ic}-postgres-1"

# Ruoli, database ed estensioni come postgres-init/01-init-databases.sh dei due stack.
docker exec -i "${fo}-postgres-1" psql -q -v ON_ERROR_STOP=1 -U fidelity -d fidelity >/dev/null <<'SQL'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE ROLE olimpo LOGIN PASSWORD 'prova';
CREATE DATABASE olimpo OWNER olimpo;
SQL
q "${fo}-postgres-1" fidelity olimpo 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"' >/dev/null
docker exec -i "${ic}-postgres-1" psql -q -v ON_ERROR_STOP=1 -U istanta -d istanta >/dev/null <<'SQL'
CREATE ROLE correggo4 LOGIN PASSWORD 'prova';
CREATE DATABASE correggo4 OWNER correggo4;
SQL

echo "Dati della sorgente (\"nuovo\")"
q "${fo}-postgres-1" fidelity fidelity "
    CREATE TABLE utenti (id serial PRIMARY KEY, nome text);
    INSERT INTO utenti (nome) VALUES ('nuovo');
    CREATE TABLE luoghi (id int, punto geometry(Point, 4326));
    INSERT INTO luoghi VALUES (1, ST_SetSRID(ST_MakePoint(11.25, 43.77), 4326));" >/dev/null
q "${fo}-postgres-1" olimpo olimpo "
    CREATE TABLE absolute_paths (tipo text, path text, active boolean);
    INSERT INTO absolute_paths VALUES ('WEB', 'D:\\olimpo\\web', true), ('ARCHIVIO', 'D:\\olimpo\\archivio', true);
    CREATE TABLE materiali (id uuid DEFAULT uuid_generate_v4(), nome text);
    INSERT INTO materiali (nome) VALUES ('nuovo');" >/dev/null
q "${ic}-postgres-1" istanta istanta "
    CREATE TABLE promo (id int, nome text); INSERT INTO promo VALUES (1, 'nuovo');" >/dev/null
q "${ic}-postgres-1" correggo4 correggo4 "
    CREATE TABLE volantini (id int, titolo text); INSERT INTO volantini VALUES (1, 'nuovo');" >/dev/null

# Due bundle finti, con il release.env che leggono gli script veri.
mkdir -p "$tmp/fo" "$tmp/ic" "$tmp/sorgente"
printf 'COMPOSE_PROJECT_NAME=%s\nFIDELITY_DB_NAME=fidelity\nFIDELITY_DB_USER=fidelity\nOLIMPO_DB_NAME=olimpo\nOLIMPO_DB_USER=olimpo\n' "$fo" > "$tmp/fo/release.env"
printf 'COMPOSE_PROJECT_NAME=%s\nISTANTA_DB_NAME=istanta\nISTANTA_DB_USER=istanta\nCORREGGO_DB_NAME=correggo4\nCORREGGO_DB_USER=correggo4\n' "$ic" > "$tmp/ic/release.env"

echo "Dump con i dump-databases.sh dei due stack"
( cd "$tmp/fo" && bash "$radice/fidelity-olimpo/dump-databases.sh" "$tmp/dump-fo" > "$tmp/dump-fo.log" 2>&1 ) || sed "s/^/        /" "$tmp/dump-fo.log"
verifica "dump di fidelity-olimpo" 0 "$?"
( cd "$tmp/ic" && bash "$radice/istanta-correggo/dump-databases.sh" "$tmp/dump-ic" >/dev/null 2>&1 )
verifica "dump di istanta-correggo" 0 "$?"
# Come farebbe l'operatore: i quattro dump in una cartella sola, con le impronte di entrambi.
for d in "$tmp"/dump-fo/* "$tmp"/dump-ic/*; do
    cp "$d"/*.dump "$tmp/sorgente/" && cat "$d/SHA256SUMS" >> "$tmp/sorgente/SHA256SUMS"
done
verifica "quattro dump nella cartella" 4 "$(ls "$tmp"/sorgente/*.dump | wc -l | tr -d ' ')"

echo "Il target diventa \"vecchio\""
q "${fo}-postgres-1" fidelity fidelity "UPDATE utenti SET nome = 'vecchio'" >/dev/null
q "${fo}-postgres-1" olimpo olimpo "UPDATE materiali SET nome = 'vecchio'" >/dev/null
q "${ic}-postgres-1" istanta istanta "UPDATE promo SET nome = 'vecchio'" >/dev/null
q "${ic}-postgres-1" correggo4 correggo4 "UPDATE volantini SET titolo = 'vecchio'" >/dev/null
docker exec "${fo}-redis-1" redis-cli SET sessione-vecchia 1 >/dev/null

stack=(--pg-fidelity-olimpo "${fo}-postgres-1" --pg-istanta-correggo "${ic}-postgres-1")

echo "Senza conferma e senza terminale non procede"
bash "$radice/restore-databases.sh" "$tmp/sorgente" "${stack[@]}" </dev/null >/dev/null 2>&1
verifica "uscita con errore" 1 "$?"
verifica "fidelity intatto" vecchio "$(q "${fo}-postgres-1" fidelity fidelity 'select nome from utenti')"

echo "Con un dump alterato non procede"
cp -r "$tmp/sorgente" "$tmp/alterato"
printf 'x' >> "$tmp/alterato/istanta.dump"
bash "$radice/restore-databases.sh" "$tmp/alterato" "${stack[@]}" --si --senza-backup >/dev/null 2>&1
verifica "uscita con errore" 1 "$?"
verifica "istanta intatto" vecchio "$(q "${ic}-postgres-1" istanta istanta 'select nome from promo')"

echo "Ripristino completo con backup"
bash "$radice/restore-databases.sh" "$tmp/sorgente" "${stack[@]}" --si --backup-in "$tmp/backup" > "$tmp/ripristino.log" 2>&1
esito=$?
verifica "uscita senza errori" 0 "$esito"
[ "$esito" -eq 0 ] || sed 's/^/        /' "$tmp/ripristino.log"
verifica "fidelity: dati della sorgente" nuovo "$(q "${fo}-postgres-1" fidelity fidelity 'select nome from utenti')"
verifica "fidelity: PostGIS funzionante" 43.77 "$(q "${fo}-postgres-1" fidelity fidelity 'select ST_Y(punto) from luoghi')"
verifica "olimpo: dati della sorgente" nuovo "$(q "${fo}-postgres-1" olimpo olimpo 'select nome from materiali')"
verifica "olimpo: tabelle di proprieta' di olimpo" olimpo \
    "$(q "${fo}-postgres-1" olimpo olimpo "select tableowner from pg_tables where tablename = 'materiali'")"
verifica "olimpo: percorsi riportati al container" /app/uploads/web \
    "$(q "${fo}-postgres-1" olimpo olimpo "select path from absolute_paths where tipo = 'WEB'")"
verifica "istanta: dati della sorgente" nuovo "$(q "${ic}-postgres-1" istanta istanta 'select nome from promo')"
verifica "correggo4: dati della sorgente" nuovo "$(q "${ic}-postgres-1" correggo4 correggo4 'select titolo from volantini')"
verifica "correggo4: tabelle di proprieta' di correggo4" correggo4 \
    "$(q "${ic}-postgres-1" correggo4 correggo4 "select tableowner from pg_tables where tablename = 'volantini'")"
verifica "redis svuotato" 0 "$(docker exec "${fo}-redis-1" redis-cli EXISTS sessione-vecchia | tr -d '\r')"
verifica "applicazione riavviata" true "$(docker inspect -f '{{.State.Running}}' "${fo}-fidelity-1")"
verifica "backup dei quattro database" 4 "$(ls "$tmp"/backup/*.dump 2>/dev/null | wc -l | tr -d ' ')"
verifica "backup con impronte" si "$([ -f "$tmp/backup/SHA256SUMS" ] && echo si)"

echo "Dal backup si torna indietro"
bash "$radice/restore-databases.sh" "$tmp/backup" "${stack[@]}" --si --senza-backup > "$tmp/ritorno.log" 2>&1
esito=$?
verifica "uscita senza errori" 0 "$esito"
[ "$esito" -eq 0 ] || sed 's/^/        /' "$tmp/ritorno.log"
verifica "fidelity torna vecchio" vecchio "$(q "${fo}-postgres-1" fidelity fidelity 'select nome from utenti')"
verifica "olimpo torna vecchio" vecchio "$(q "${fo}-postgres-1" olimpo olimpo 'select nome from materiali')"
verifica "istanta torna vecchio" vecchio "$(q "${ic}-postgres-1" istanta istanta 'select nome from promo')"
verifica "correggo4 torna vecchio" vecchio "$(q "${ic}-postgres-1" correggo4 correggo4 'select titolo from volantini')"

echo
if [ "$falliti" -gt 0 ]; then
    printf '\033[31m%s verifiche fallite.\033[0m\n' "$falliti"
    exit 1
fi
printf '\033[32mTutte le verifiche sono passate.\033[0m\n'
