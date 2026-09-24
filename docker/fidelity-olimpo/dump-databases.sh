#!/usr/bin/env bash
# Esporta i database di questo deployment set in una directory datata.
#
# Si esegue con sudo, dalla directory del progetto:
#
#   cd /opt/company-ai/projects/istanta4
#   sudo ./dump-databases.sh                 # in ./backup/<data>-<ora>/
#   sudo ./dump-databases.sh /mnt/nas/istanta4   # altrove
#
# Cosa esporta:
#   PostgreSQL  i due database, in formato custom (-Fc). Non SQL testuale:
#               al ripristino permette di scegliere cosa riversare, cosa che
#               con un .sql non si puo' fare.
#
# Cosa NON esporta, deliberatamente:
#   redis       sessioni e cache. Perderle significa che gli utenti rifanno il
#               login, niente di piu'.
#   mongo       i dati che ci stavano sono gia' stati portati in PostgreSQL. Nel
#               codice di Fidelity restano tre agganci, nessuno dei quali e' dato
#               vivo: un endpoint legacy (update_data_fields_translation_map),
#               il codice della migrazione in PromoController — che non e'
#               registrato su alcuna rotta — e un `await` a livello di modulo in
#               models/mongoose.ts che apre la connessione al solo caricamento.
#               Il servizio resta nel compose finche' quell'ultimo aggancio non
#               viene sciolto, ma il suo contenuto non e' piu' la fonte di
#               nulla. Se un giorno tornasse a esserlo, questa riga e' il posto
#               dove accorgersene.
#   i file      immagini, materiali, volantini, quello che sta nei volumi
#               fidelity_* e olimpo_uploads. Sono decine di gigabyte e vanno
#               trattati con altri strumenti; questo script si ferma ai database
#               e lo dice, invece di dare l'impressione di aver salvato tutto.
#
# Lo script non tocca niente: apre i database in lettura e scrive solo i file
# che produce. Le applicazioni possono restare in funzione, con l'avvertenza che
# ogni database viene fotografato in un istante leggermente diverso dagli altri.
set -uo pipefail

rosso()  { printf '\033[31m%s\033[0m\n' "$*"; }
giallo() { printf '\033[33m%s\033[0m\n' "$*"; }
verde()  { printf '\033[32m%s\033[0m\n' "$*"; }

[ -f release.env ] || { rosso "release.env non trovato: esegui lo script dalla directory del progetto."; exit 1; }

leggi() {
    sed -n "s/^$1=//p" release.env | tail -n 1 | tr -d '\r' \
        | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

progetto=$(leggi COMPOSE_PROJECT_NAME);   progetto="${progetto:-istanta4}"
fidelity_db=$(leggi FIDELITY_DB_NAME);    fidelity_db="${fidelity_db:-fidelity}"
fidelity_user=$(leggi FIDELITY_DB_USER);  fidelity_user="${fidelity_user:-fidelity}"
olimpo_db=$(leggi OLIMPO_DB_NAME);        olimpo_db="${olimpo_db:-olimpo}"
olimpo_user=$(leggi OLIMPO_DB_USER);      olimpo_user="${olimpo_user:-olimpo}"

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

# Un dump che non si riesce a rileggere è peggio di nessun dump, perché ci si
# conta sopra. `pg_restore -l` apre l'archivio e ne stampa l'indice senza
# connettersi a niente: se il file è troncato o corrotto, fallisce qui.
verifica_dump_postgres() {
    local file="$1" voci
    voci=$(docker exec -i "$postgres_c" pg_restore -l /dev/stdin < "$file" 2>/dev/null | grep -c '^[0-9]')
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
    # un filesystem che sparisce, e con `docker cp` servirebbe un passaggio in
    # piu' e il doppio dello spazio.
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
dump_postgres "$fidelity_db" "$fidelity_user" fidelity
dump_postgres "$olimpo_db"   "$olimpo_user"   olimpo

# Le impronte servono a verificare il trasferimento verso un'altra macchina, che
# e' il momento in cui un file si tronca senza che nessuno se ne accorga.
( cd "$cartella" && sha256sum ./*.dump > SHA256SUMS )

{
    echo "progetto:   $progetto"
    echo "istante:    $(date -Iseconds)"
    echo "macchina:   $(hostname)"
    echo "postgres:   $(docker exec "$postgres_c" postgres --version 2>/dev/null)"
    echo "database:   $fidelity_db (utente $fidelity_user), $olimpo_db (utente $olimpo_user)"
    echo
    echo "Ripristino: vedi README.md, sezione «Trasportare i dati da un'altra macchina»."
    echo "NON include i file dei volumi (immagini, materiali, volantini)."
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
giallo "Ricorda: qui dentro ci sono i database, non i file. Immagini, materiali e"
giallo "volantini stanno nei volumi Docker e vanno salvati a parte."
