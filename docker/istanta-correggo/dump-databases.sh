#!/usr/bin/env bash
# Esporta i database di questo deployment set in una directory datata.
# Gemello di docker/fidelity-olimpo/dump-databases.sh: stesso formato, stesse
# verifiche, cosi' i quattro dump della suite si ripristinano tutti con
# docker/restore-databases.sh.
#
# Si esegue con sudo, dalla directory del progetto:
#
#   cd /opt/company-ai/projects/istanta-correggo
#   sudo ./dump-databases.sh                     # in ./backup/<data>-<ora>/
#   sudo ./dump-databases.sh /mnt/nas/istanta    # altrove
#
# Cosa esporta:
#   PostgreSQL  istanta e correggo4, in formato custom (-Fc). Non SQL testuale:
#               al ripristino permette di scegliere cosa riversare.
#
# Cosa NON esporta, deliberatamente:
#   redis       sessioni e cache di Istanta: perderle significa rifare il login.
#   i file      volantini di Correggo4, external_source e dati di Istanta che
#               stanno nei volumi e nelle cartelle dell'host. Si spostano a parte;
#               gli external_source si riallineano comodamente da Settings.
#
# Lo script non tocca niente: apre i database in lettura e scrive solo i file
# che produce. Le applicazioni possono restare in funzione, con l'avvertenza che
# i due database vengono fotografati in istanti leggermente diversi.
set -uo pipefail

rosso()  { printf '\033[31m%s\033[0m\n' "$*"; }
giallo() { printf '\033[33m%s\033[0m\n' "$*"; }
verde()  { printf '\033[32m%s\033[0m\n' "$*"; }

[ -f release.env ] || { rosso "release.env non trovato: esegui lo script dalla directory del progetto."; exit 1; }

leggi() {
    sed -n "s/^$1=//p" release.env | tail -n 1 | tr -d '\r' \
        | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

progetto=$(leggi COMPOSE_PROJECT_NAME);   progetto="${progetto:-istanta-correggo}"
istanta_db=$(leggi ISTANTA_DB_NAME);      istanta_db="${istanta_db:-istanta}"
istanta_user=$(leggi ISTANTA_DB_USER);    istanta_user="${istanta_user:-istanta}"
correggo_db=$(leggi CORREGGO_DB_NAME);    correggo_db="${correggo_db:-correggo4}"
correggo_user=$(leggi CORREGGO_DB_USER);  correggo_user="${correggo_user:-correggo4}"

postgres_c="${progetto}-postgres-1"

destinazione="${1:-./backup}"
istante=$(date +%Y%m%d-%H%M%S)
cartella="$destinazione/$istante"

errori=0

if ! docker inspect "$postgres_c" >/dev/null 2>&1; then
    rosso "Container $postgres_c non trovato. Il progetto è distribuito su questa macchina?"
    exit 1
fi

mkdir -p "$cartella" || { rosso "Non riesco a creare $cartella"; exit 1; }
echo
echo "Destinazione: $cartella"

# Un dump che non si riesce a rileggere è peggio di nessun dump. `pg_restore -l`
# senza nome di file legge l'archivio da stdin e ne stampa l'indice: se il file
# è troncato o corrotto, fallisce qui.
verifica_dump_postgres() {
    local file="$1" voci
    voci=$(docker exec -i "$postgres_c" pg_restore -l < "$file" 2>/dev/null | grep -c '^[0-9]')
    if [ "${voci:-0}" -eq 0 ]; then
        rosso "  illeggibile $(basename "$file")"
        errori=$((errori + 1))
        return 1
    fi
    verde "  ok        $(basename "$file") — $(du -h "$file" | cut -f1), $voci voci"
}

dump_postgres() {
    local db="$1" utente="$2" nome="$3"
    # Il file lo apre la shell, non pg_dump: dentro il container scriverebbe in
    # un filesystem che sparisce.
    if ! docker exec "$postgres_c" \
        pg_dump -U "$utente" -d "$db" -Fc --no-owner --no-acl > "$cartella/$nome.dump" 2>"$cartella/$nome.err"
    then
        rosso "  errore    $db"
        sed 's/^/            /' "$cartella/$nome.err" | head -5
        errori=$((errori + 1))
        return
    fi
    rm -f "$cartella/$nome.err"
    verifica_dump_postgres "$cartella/$nome.dump"
}

echo
echo "PostgreSQL"
dump_postgres "$istanta_db"  "$istanta_user"  istanta
dump_postgres "$correggo_db" "$correggo_user" correggo4

# Le impronte servono a verificare il trasferimento verso un'altra macchina.
( cd "$cartella" && sha256sum ./*.dump > SHA256SUMS )

{
    echo "progetto:   $progetto"
    echo "istante:    $(date -Iseconds)"
    echo "macchina:   $(hostname)"
    echo "postgres:   $(docker exec "$postgres_c" postgres --version 2>/dev/null)"
    echo "database:   $istanta_db (utente $istanta_user), $correggo_db (utente $correggo_user)"
    echo
    echo "Ripristino: docker/restore-databases.sh (vedi README.md)."
    echo "NON include i file: volantini, external_source, dati di Istanta."
} > "$cartella/MANIFEST"

echo
if [ "$errori" -gt 0 ]; then
    rosso "$errori problemi: l'archivio in $cartella è incompleto."
    exit 1
fi
verde "Archivio completato."
echo
ls -lh "$cartella"
echo
giallo "Ricorda: qui dentro ci sono i database, non i file. Volantini di Correggo4 e"
giallo "dati di Istanta stanno nei volumi e vanno salvati a parte."
