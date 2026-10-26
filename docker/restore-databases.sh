#!/usr/bin/env bash
# Ripristina sulla macchina dove lo lanci i dump dei database della suite, per
# esempio per riprodurre in locale un caso reale della produzione.
#
#   sudo ./restore-databases.sh <cartella-dump> \
#       --fidelity-olimpo  /opt/company-ai/projects/istanta4 \
#       --istanta-correggo /opt/company-ai/projects/istanta-correggo
#
# <cartella-dump> contiene i file prodotti dai due dump-databases.sh:
# fidelity.dump e olimpo.dump (docker/fidelity-olimpo), istanta.dump e
# correggo4.dump (docker/istanta-correggo), con SHA256SUMS se c'e'. Si
# ripristinano solo i dump presenti, e solo per gli stack indicati.
#
# Opzioni:
#   --fidelity-olimpo DIR      cartella del bundle: da release.env legge progetto,
#   --istanta-correggo DIR     database e ruoli, quindi i nomi dei container
#   --pg-fidelity-olimpo NOME  in alternativa, il container postgres dello stack
#   --pg-istanta-correggo NOME (es. istanta4-postgres-1); database e ruoli sono
#                              quelli predefiniti
#   --backup-in DIR            dove salvare i database che stanno per essere
#                              sostituiti (predefinito: accanto alla cartella dei
#                              dump, prima-del-ripristino-<data>-<ora>)
#   --senza-backup             non salvarli (target senza niente da conservare)
#   --tieni-sessioni           non svuotare Redis
#   --si                       non chiedere conferma
#
# Cosa fa, per ogni stack toccato:
#   1. verifica impronte e leggibilita' dei dump, mostra il piano e chiede di
#      scrivere RIPRISTINA;
#   2. salva i database che sta per cancellare (se un backup fallisce si ferma
#      senza aver toccato nulla);
#   3. ferma le applicazioni, ricrea ogni database con il suo proprietario e le
#      estensioni che il dump usa, lo ripristina connesso con il suo ruolo (mai
#      da superutente: le tabelle di olimpo e correggo4 devono essere loro);
#   4. riporta i percorsi di Olimpo a quelli del container, svuota Redis
#      (sessioni del vecchio database), riavvia le applicazioni.
#
# Cosa NON porta: i file dei volumi (immagini, materiali, volantini), gli
# external_source di Istanta (si riallineano da Settings), i job di pgagent.
# Dopo un ripristino seed-fidelity.sh non va eseguito: gli utenti arrivano con
# il dump.
set -uo pipefail

rosso()  { printf '\033[31m%s\033[0m\n' "$*"; }
giallo() { printf '\033[33m%s\033[0m\n' "$*"; }
verde()  { printf '\033[32m%s\033[0m\n' "$*"; }

uso() { sed -n '2,/^set -uo/p' "$0" | sed -e '$d' -e 's/^# \{0,1\}//'; }

cartella_dump=""
dir_fo=""; dir_ic=""; pg_fo=""; pg_ic=""
backup_in=""; senza_backup=no; tieni_sessioni=no; conferma=no

while [ $# -gt 0 ]; do
    case "$1" in
        --fidelity-olimpo)     dir_fo="${2:-}"; shift 2 ;;
        --istanta-correggo)    dir_ic="${2:-}"; shift 2 ;;
        --pg-fidelity-olimpo)  pg_fo="${2:-}"; shift 2 ;;
        --pg-istanta-correggo) pg_ic="${2:-}"; shift 2 ;;
        --backup-in)           backup_in="${2:-}"; shift 2 ;;
        --senza-backup)        senza_backup=si; shift ;;
        --tieni-sessioni)      tieni_sessioni=si; shift ;;
        --si)                  conferma=si; shift ;;
        -h|--help)             uso; exit 0 ;;
        -*)                    rosso "Opzione sconosciuta: $1"; echo; uso; exit 2 ;;
        *)                     cartella_dump="$1"; shift ;;
    esac
done

[ -n "$cartella_dump" ] || { rosso "Manca la cartella dei dump."; echo; uso; exit 2; }
[ -d "$cartella_dump" ] || { rosso "Cartella dei dump inesistente: $cartella_dump"; exit 2; }
if [ -z "$dir_fo$pg_fo$dir_ic$pg_ic" ]; then
    rosso "Indica almeno uno stack: --fidelity-olimpo/--pg-fidelity-olimpo o --istanta-correggo/--pg-istanta-correggo."
    exit 2
fi

istante=$(date +%Y%m%d-%H%M%S)

# leggi_da FILE NOME: il valore di NOME nel file env indicato.
leggi_da() {
    sed -n "s/^$2=//p" "$1" | tail -n 1 | tr -d '\r' \
        | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

# --------------------------------------------------------------- configurazione

# fidelity-olimpo: il superutente di PostgreSQL e' il ruolo di Fidelity.
fo_attivo=no
if [ -n "$dir_fo" ]; then
    env_fo="$dir_fo/release.env"
    [ -f "$env_fo" ] || { rosso "release.env non trovato in $dir_fo"; exit 2; }
    fo_prefisso=$(leggi_da "$env_fo" COMPOSE_PROJECT_NAME); fo_prefisso="${fo_prefisso:-istanta4}"
    fidelity_db=$(leggi_da "$env_fo" FIDELITY_DB_NAME);     fidelity_db="${fidelity_db:-fidelity}"
    fidelity_user=$(leggi_da "$env_fo" FIDELITY_DB_USER);   fidelity_user="${fidelity_user:-fidelity}"
    olimpo_db=$(leggi_da "$env_fo" OLIMPO_DB_NAME);         olimpo_db="${olimpo_db:-olimpo}"
    olimpo_user=$(leggi_da "$env_fo" OLIMPO_DB_USER);       olimpo_user="${olimpo_user:-olimpo}"
    pg_fo="${fo_prefisso}-postgres-1"
    fo_attivo=si
elif [ -n "$pg_fo" ]; then
    fo_prefisso="${pg_fo%-postgres-1}"
    fidelity_db=fidelity; fidelity_user=fidelity; olimpo_db=olimpo; olimpo_user=olimpo
    fo_attivo=si
fi

# istanta-correggo: il superutente di PostgreSQL e' il ruolo di Istanta.
ic_attivo=no
if [ -n "$dir_ic" ]; then
    env_ic="$dir_ic/release.env"
    [ -f "$env_ic" ] || { rosso "release.env non trovato in $dir_ic"; exit 2; }
    ic_prefisso=$(leggi_da "$env_ic" COMPOSE_PROJECT_NAME); ic_prefisso="${ic_prefisso:-istanta-correggo}"
    istanta_db=$(leggi_da "$env_ic" ISTANTA_DB_NAME);       istanta_db="${istanta_db:-istanta}"
    istanta_user=$(leggi_da "$env_ic" ISTANTA_DB_USER);     istanta_user="${istanta_user:-istanta}"
    correggo_db=$(leggi_da "$env_ic" CORREGGO_DB_NAME);     correggo_db="${correggo_db:-correggo4}"
    correggo_user=$(leggi_da "$env_ic" CORREGGO_DB_USER);   correggo_user="${correggo_user:-correggo4}"
    pg_ic="${ic_prefisso}-postgres-1"
    ic_attivo=si
elif [ -n "$pg_ic" ]; then
    ic_prefisso="${pg_ic%-postgres-1}"
    istanta_db=istanta; istanta_user=istanta; correggo_db=correggo4; correggo_user=correggo4
    ic_attivo=si
fi

# Come si indicano gli stack a questo stesso script: serve per il comando di ritorno.
arg_stack=""
if [ -n "$dir_fo" ]; then arg_stack+="--fidelity-olimpo $dir_fo "; elif [ -n "$pg_fo" ]; then arg_stack+="--pg-fidelity-olimpo $pg_fo "; fi
if [ -n "$dir_ic" ]; then arg_stack+="--istanta-correggo $dir_ic "; elif [ -n "$pg_ic" ]; then arg_stack+="--pg-istanta-correggo $pg_ic "; fi

# Il piano: una riga per database da ripristinare.
#   nome|container postgres|database|ruolo proprietario|superutente|prefisso stack
piano=()
aggiungi() {
    local nome="$1" attivo="$2"; shift 2
    if [ ! -f "$cartella_dump/$nome.dump" ]; then return; fi
    if [ "$attivo" != si ]; then
        giallo "  saltato   $nome.dump: lo stack di destinazione non è stato indicato"
        return
    fi
    piano+=("$nome|$*")
}

echo
echo "Dump trovati in $cartella_dump"
aggiungi fidelity  "$fo_attivo" "${pg_fo:-}|${fidelity_db:-}|${fidelity_user:-}|${fidelity_user:-}|${fo_prefisso:-}"
aggiungi olimpo    "$fo_attivo" "${pg_fo:-}|${olimpo_db:-}|${olimpo_user:-}|${fidelity_user:-}|${fo_prefisso:-}"
aggiungi istanta   "$ic_attivo" "${pg_ic:-}|${istanta_db:-}|${istanta_user:-}|${istanta_user:-}|${ic_prefisso:-}"
aggiungi correggo4 "$ic_attivo" "${pg_ic:-}|${correggo_db:-}|${correggo_user:-}|${istanta_user:-}|${ic_prefisso:-}"

if [ ${#piano[@]} -eq 0 ]; then
    rosso "Nessun dump da ripristinare per gli stack indicati (attesi fidelity/olimpo/istanta/correggo4 .dump)."
    exit 1
fi

campo() { echo "$1" | cut -d'|' -f"$2"; }

# ------------------------------------------------------------------- verifiche

errori=0

for voce in "${piano[@]}"; do
    c=$(campo "$voce" 2)
    if [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)" != true ]; then
        rosso "  assente   container $c (non esiste o non è avviato)"
        errori=$((errori + 1))
    fi
done
[ "$errori" -eq 0 ] || exit 1

# Le impronte dicono se il trasferimento ha troncato qualcosa.
if [ -f "$cartella_dump/SHA256SUMS" ]; then
    if ( cd "$cartella_dump" && sha256sum --quiet --ignore-missing -c SHA256SUMS ) >/dev/null 2>&1; then
        verde "  ok        impronte SHA256SUMS"
    else
        rosso "  errore    le impronte non corrispondono: un dump è stato alterato o troncato"
        exit 1
    fi
else
    giallo "  avviso    SHA256SUMS assente: non posso verificare il trasferimento"
fi

# Ogni dump deve essere un archivio leggibile; se ne ricavano le estensioni da
# creare prima del ripristino, che i ruoli non superutente non possono creare.
declare -A estensioni
for voce in "${piano[@]}"; do
    nome=$(campo "$voce" 1); c=$(campo "$voce" 2)
    indice=$(docker exec -i "$c" pg_restore -l < "$cartella_dump/$nome.dump" 2>/dev/null)
    voci=$(printf '%s\n' "$indice" | grep -c '^[0-9]')
    if [ "${voci:-0}" -eq 0 ]; then
        rosso "  illeggibile $nome.dump"
        errori=$((errori + 1))
        continue
    fi
    estensioni[$nome]=$(printf '%s\n' "$indice" | awk '/ EXTENSION - /{print $NF}' | tr '\n' ' ')
    verde "  ok        $nome.dump — $(du -h "$cartella_dump/$nome.dump" | cut -f1), $voci voci"
done
[ "$errori" -eq 0 ] || exit 1

# ------------------------------------------------------------------- conferma

backup_dir="${backup_in:-$(dirname "$cartella_dump")/prima-del-ripristino-$istante}"

echo
echo "Piano"
for voce in "${piano[@]}"; do
    printf '  %-10s -> database %s in %s, proprietario %s\n' \
        "$(campo "$voce" 1)" "$(campo "$voce" 3)" "$(campo "$voce" 2)" "$(campo "$voce" 4)"
done
if [ "$senza_backup" = si ]; then
    giallo "  backup    NESSUNO (--senza-backup): i database attuali andranno persi"
else
    echo "  backup    dei database attuali in $backup_dir"
fi
[ "$tieni_sessioni" = si ] || echo "  redis     svuotato: sessioni e cache del vecchio database"
echo
rosso "I database elencati verranno CANCELLATI e sostituiti."

if [ "$conferma" != si ]; then
    if [ ! -t 0 ]; then
        rosso "Senza terminale serve --si per confermare. Non ho toccato nulla."
        exit 1
    fi
    read -r -p "Scrivi RIPRISTINA per continuare: " risposta
    if [ "$risposta" != RIPRISTINA ]; then
        giallo "Annullato. Non ho toccato nulla."
        exit 1
    fi
fi

# ------------------------------------------------------------------- backup

psql_su() {  # container superutente database [argomenti psql...]
    local c="$1" su="$2" db="$3"; shift 3
    docker exec -i "$c" psql -v ON_ERROR_STOP=1 -U "$su" -d "$db" "$@"
}

if [ "$senza_backup" != si ]; then
    echo
    echo "Backup dei database attuali"
    mkdir -p "$backup_dir" || { rosso "Non riesco a creare $backup_dir"; exit 1; }
    salvati=0
    for voce in "${piano[@]}"; do
        nome=$(campo "$voce" 1); c=$(campo "$voce" 2); db=$(campo "$voce" 3); su=$(campo "$voce" 5)
        if [ "$(psql_su "$c" "$su" postgres -tAc "select 1 from pg_database where datname = '$db'")" != 1 ]; then
            giallo "  saltato   $nome: il database $db non esiste ancora sul target"
            continue
        fi
        if ! docker exec "$c" pg_dump -U "$su" -d "$db" -Fc --no-owner --no-acl \
                > "$backup_dir/$nome.dump" 2>"$backup_dir/$nome.err"; then
            rosso "  errore    backup di $db"
            sed 's/^/            /' "$backup_dir/$nome.err" | head -5
            errori=$((errori + 1))
            continue
        fi
        rm -f "$backup_dir/$nome.err"
        if [ "$(docker exec -i "$c" pg_restore -l < "$backup_dir/$nome.dump" 2>/dev/null | grep -c '^[0-9]')" -eq 0 ]; then
            rosso "  illeggibile backup di $db"
            errori=$((errori + 1))
            continue
        fi
        verde "  ok        $nome — $(du -h "$backup_dir/$nome.dump" | cut -f1)"
        salvati=$((salvati + 1))
    done
    if [ "$errori" -gt 0 ]; then
        rosso "Il backup non è riuscito: mi fermo senza aver toccato i database."
        exit 1
    fi
    if [ "$salvati" -gt 0 ]; then
        ( cd "$backup_dir" && sha256sum ./*.dump > SHA256SUMS )
        {
            echo "istante:    $(date -Iseconds)"
            echo "macchina:   $(hostname)"
            echo "contenuto:  i database del target prima del ripristino da $cartella_dump"
        } > "$backup_dir/MANIFEST"
    fi
fi

# ------------------------------------------------------------------- applicazioni

# Si fermano solo le applicazioni degli stack toccati, e alla fine si riavviano
# solo quelle che erano in funzione.
applicazioni=()
[ "$fo_attivo" = si ] && applicazioni+=("${fo_prefisso}-fidelity-1" "${fo_prefisso}-olimpo-1")
[ "$ic_attivo" = si ] && applicazioni+=("${ic_prefisso}-istanta-1" "${ic_prefisso}-correggo4-1")
fermate=()
echo
echo "Applicazioni"
for app in "${applicazioni[@]}"; do
    if [ "$(docker inspect -f '{{.State.Running}}' "$app" 2>/dev/null)" = true ]; then
        docker stop -t 30 "$app" >/dev/null && fermate+=("$app") && echo "  fermata   $app"
    fi
done
[ ${#fermate[@]} -gt 0 ] || echo "  nessuna in funzione"

# ------------------------------------------------------------------- ripristino

# Messaggi di pg_restore attesi e innocui: l'estensione pgagent non e' nell'immagine,
# e un ruolo non superutente non puo' commentare un'estensione creata da altri.
innocui='pgagent|must be owner of extension|COMMENT ON EXTENSION|extension "[^"]*" is not available'

ripristina() {
    local voce="$1" nome c db ruolo su err
    nome=$(campo "$voce" 1); c=$(campo "$voce" 2); db=$(campo "$voce" 3); ruolo=$(campo "$voce" 4); su=$(campo "$voce" 5)

    if [ "$(psql_su "$c" "$su" postgres -tAc "select 1 from pg_roles where rolname = '$ruolo'")" != 1 ]; then
        rosso "  errore    $nome: il ruolo $ruolo non esiste su $c (l'installazione non è inizializzata?)"
        return 1
    fi

    if ! psql_su "$c" "$su" postgres -q -v db="$db" -v ruolo="$ruolo" >/dev/null <<'SQL'
DROP DATABASE IF EXISTS :"db" WITH (FORCE);
CREATE DATABASE :"db" OWNER :"ruolo";
SQL
    then
        rosso "  errore    $nome: non riesco a ricreare il database $db"
        return 1
    fi

    # Le estensioni si creano in anticipo solo per i ruoli che non possono farlo da
    # se' (olimpo, correggo4). Da superutente le crea pg_restore, nell'ordine del dump:
    # crearle prima farebbe trovare gia' esistenti i loro schemi (tiger, topology
    # dell'immagine PostGIS) e il ripristino fallirebbe.
    if [ "$ruolo" != "$su" ]; then
        for e in ${estensioni[$nome]}; do
            psql_su "$c" "$su" "$db" -q -c "CREATE EXTENSION IF NOT EXISTS \"$e\"" >/dev/null 2>&1 \
                || giallo "  avviso    $nome: estensione $e non disponibile su $c"
        done
    fi

    # pg_restore lavora meglio da file che da stdin, quindi il dump si scrive prima
    # dentro il container. Ci arriva da stdin e non con `docker cp`: il percorso
    # sull'host lo apre la shell, cosi' funziona allo stesso modo su Linux e dai
    # terminali Windows (dove `docker cp /tmp/...` cerca C:\tmp).
    docker exec -i "$c" sh -c "cat > /tmp/ripristino-$nome.dump" < "$cartella_dump/$nome.dump" || {
        rosso "  errore    $nome: copia del dump nel container non riuscita"; return 1; }
    err=$(docker exec "$c" pg_restore -U "$ruolo" -d "$db" --no-owner --no-acl "/tmp/ripristino-$nome.dump" 2>&1 >/dev/null)
    docker exec "$c" rm -f "/tmp/ripristino-$nome.dump"

    local gravi
    gravi=$(printf '%s\n' "$err" | grep -E '^pg_restore: error:' | grep -vE "$innocui")
    if [ -n "$gravi" ]; then
        rosso "  errore    $nome: pg_restore ha segnalato errori"
        printf '%s\n' "$gravi" | head -8 | sed 's/^/            /'
        return 1
    fi
    if printf '%s\n' "$err" | grep -qE "$innocui"; then
        giallo "  avviso    $nome: ignorati messaggi attesi (pgagent / commenti alle estensioni)"
    fi

    psql_su "$c" "$su" "$db" -q -c 'ANALYZE' >/dev/null 2>&1
    local riassunto
    riassunto=$(psql_su "$c" "$su" "$db" -tA -F ' ' -c \
        "select count(*), coalesce(sum(n_live_tup), 0) from pg_stat_user_tables")
    verde "  ok        $nome -> $db: $(echo "$riassunto" | cut -d' ' -f1) tabelle, circa $(echo "$riassunto" | cut -d' ' -f2) righe"
}

# I percorsi di Olimpo puntano ancora alla macchina di origine: vanno riportati a
# quelli del container, altrimenti Olimpo non trova le directory e riparte in ciclo.
riallinea_olimpo() {
    local voce="$1" c db ruolo
    c=$(campo "$voce" 2); db=$(campo "$voce" 3); ruolo=$(campo "$voce" 4)
    if [ "$(psql_su "$c" "$ruolo" "$db" -tAc "select to_regclass('public.absolute_paths') is not null")" != t ]; then
        return
    fi
    echo "  percorsi di Olimpo sulla macchina di origine (da qui si copiano i file):"
    psql_su "$c" "$ruolo" "$db" -tA -F ' = ' -c "select tipo, path from absolute_paths order by tipo" | sed 's/^/            /'
    psql_su "$c" "$ruolo" "$db" -q >/dev/null <<'SQL'
UPDATE absolute_paths
SET path = CASE tipo
    WHEN 'WEB'       THEN '/app/uploads/web'
    WHEN 'ARCHIVIO'  THEN '/app/uploads/archivio'
    WHEN 'MATERIALI' THEN '/app/uploads/materiali'
    WHEN 'VIDEO'     THEN '/app/uploads/video'
    ELSE path
END
WHERE tipo IN ('WEB', 'ARCHIVIO', 'MATERIALI', 'VIDEO');
SQL
    verde "  ok        percorsi di Olimpo riportati a /app/uploads/*"
}

echo
echo "Ripristino"
falliti=0
for voce in "${piano[@]}"; do
    if ripristina "$voce"; then
        [ "$(campo "$voce" 1)" = olimpo ] && riallinea_olimpo "$voce"
    else
        falliti=$((falliti + 1))
    fi
done

if [ "$falliti" -gt 0 ]; then
    echo
    rosso "$falliti database non ripristinati. Le applicazioni restano ferme."
    if [ "$senza_backup" != si ] && [ -f "$backup_dir/SHA256SUMS" ]; then
        echo "Per tornare allo stato di prima:"
        echo "  sudo $0 $backup_dir $arg_stack--senza-backup"
    fi
    exit 1
fi

# ------------------------------------------------------------------- chiusura

if [ "$tieni_sessioni" != si ]; then
    prefissi=()
    [ "$fo_attivo" = si ] && prefissi+=("$fo_prefisso")
    [ "$ic_attivo" = si ] && prefissi+=("$ic_prefisso")
    for prefisso in "${prefissi[@]}"; do
        r="${prefisso}-redis-1"
        if [ "$(docker inspect -f '{{.State.Running}}' "$r" 2>/dev/null)" = true ]; then
            docker exec "$r" redis-cli FLUSHALL >/dev/null && verde "  ok        $r svuotato"
        fi
    done
fi

for app in "${fermate[@]}"; do
    docker start "$app" >/dev/null && echo "  avviata   $app"
done

echo
verde "Ripristino completato."
if [ "$senza_backup" != si ] && [ -f "$backup_dir/SHA256SUMS" ]; then
    echo "I database di prima sono in $backup_dir. Per tornarci:"
    echo "  sudo $0 $backup_dir $arg_stack--senza-backup"
fi
echo
giallo "Non ripristinati: i file dei volumi (immagini, materiali, volantini), gli"
giallo "external_source di Istanta (allineali da Settings) e i job di pgagent."
giallo "Non eseguire seed-fidelity.sh: gli utenti arrivano con il dump."
