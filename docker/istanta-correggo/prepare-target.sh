#!/usr/bin/env bash
# Prepara la directory di progetto sul target prima di distribuire.
#
# Si esegue con sudo, dalla directory che contiene release.env:
#
#   cd /opt/company-ai/projects/<progetto>
#   sudo ./prepare-target.sh
#
# Perché serve: Docker non fallisce mai su un bind mount il cui percorso non
# esiste. Lo crea vuoto, di proprietà di root, e tira dritto. Il guasto emerge
# molto dopo e lontano dalla causa — gli script di init di PostgreSQL mai
# eseguiti, l'applicazione che non riesce a scrivere i propri dati — e nel caso
# di PostgreSQL non si corregge da solo nemmeno dopo aver sistemato il percorso,
# perché il volume ormai inizializzato non viene più ripreso in mano.
#
# Lo script distingue tre categorie di directory:
#
#   contenuto   devono ARRIVARE col bundle, già popolate. Se mancano o sono
#               vuote è un errore: crearle vuote qui riprodurrebbe esattamente
#               il difetto che stiamo cercando di evitare.
#   dati        di runtime: le crea lui, con il proprietario giusto.
#   facoltativo serve solo al proxy TLS, di cui si può fare a meno per provare.
set -uo pipefail

# UID/GID dell'utente `app` nelle immagini .NET: è con quello che gira Istanta,
# ed è chi deve poter scrivere in /data.
readonly UID_APP=1654

rosso()  { printf '\033[31m%s\033[0m\n' "$*"; }
giallo() { printf '\033[33m%s\033[0m\n' "$*"; }
verde()  { printf '\033[32m%s\033[0m\n' "$*"; }

errori=0
avvisi=0

if [ ! -f release.env ]; then
    rosso "release.env non trovato: esegui lo script dalla directory del progetto."
    exit 1
fi

# Legge una variabile da release.env senza eseguire il file: contiene password, e
# un `source` eseguirebbe anche quello che ci fosse dentro per errore.
# Unica funzione che gira in una subshell, e infatti si limita a stampare: ogni
# verifica avviene nella shell principale, dove i contatori esistono davvero.
leggi() {
    sed -n "s/^$1=//p" release.env | tail -n 1 | tr -d '\r' \
        | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

# Directory che arriva col bundle. Si verifica in due passi, perché "esiste e
# non è vuota" non basta: una schemas/ con dentro due sottocartelle vuote
# passerebbe il controllo e lascerebbe PostgreSQL senza tabelle, che è
# esattamente il guasto da cui nasce questo script.
#
# verifica_directory lascia il percorso in `percorso_verificato` e restituisce 0
# solo se c'è davvero, così verifica_file può proseguire da lì.
percorso_verificato=""

verifica_directory() {
    local nome="$1" attesi="$2" percorso
    percorso_verificato=""
    percorso=$(leggi "$nome")

    if [ -z "$percorso" ]; then
        rosso "  manca     $nome non è valorizzata in release.env"
        errori=$((errori + 1))
        return 1
    fi
    case "$percorso" in
        /*) ;;
        *)  rosso "  relativo  $nome = $percorso"
            rosso "            Serve un percorso assoluto: il Runner lancia compose dal"
            rosso "            proprio container, e un percorso relativo verrebbe risolto"
            rosso "            in /deployments/..., che sull'host non esiste."
            errori=$((errori + 1))
            return 1 ;;
    esac
    if [ ! -d "$percorso" ]; then
        rosso "  assente   $nome = $percorso"
        rosso "            Va copiata dal bundle: contiene $attesi."
        errori=$((errori + 1))
        return 1
    fi
    percorso_verificato="$percorso"
    return 0
}

# Cerca i file che devono esserci dentro la directory appena verificata.
verifica_file() {
    local modello="$1" attesi="$2" trovati
    [ -n "$percorso_verificato" ] || return

    # Si conta con find e non con un glob della shell: sotto `set -u` un glob
    # che non trova nulla resterebbe il testo del modello, e il confronto
    # direbbe che il file c'è.
    trovati=$(find "$percorso_verificato" -path "$percorso_verificato/$modello" -type f 2>/dev/null | wc -l)
    if [ "$trovati" -eq 0 ]; then
        rosso "  incompleta $percorso_verificato non contiene $modello"
        rosso "            Ci vanno $attesi."
        errori=$((errori + 1))
        return
    fi
    verde "  ok        $percorso_verificato/$modello ($trovati)"
}

# Directory di dati: si crea, e se serve si assegna all'utente applicativo.
verifica_dati() {
    local nome="$1" proprietario="${2:-}" percorso
    percorso=$(leggi "$nome")

    if [ -z "$percorso" ]; then
        rosso "  manca     $nome non è valorizzata in release.env"
        errori=$((errori + 1))
        return
    fi
    case "$percorso" in
        /*) ;;
        *)  rosso "  relativo  $nome = $percorso (serve un percorso assoluto)"
            errori=$((errori + 1))
            return ;;
    esac
    if [ ! -d "$percorso" ]; then
        if ! mkdir -p "$percorso"; then
            rosso "  errore    non riesco a creare $percorso"
            errori=$((errori + 1))
            return
        fi
        giallo "  creata    $nome = $percorso"
    fi
    if [ -n "$proprietario" ]; then
        if ! chown -R "$proprietario:$proprietario" "$percorso"; then
            rosso "  errore    non riesco ad assegnare $percorso a $proprietario (serve sudo)"
            errori=$((errori + 1))
            return
        fi
        verde "  ok        $percorso (proprietario $proprietario)"
    else
        verde "  ok        $percorso"
    fi
}

# Directory facoltativa: senza, manca il proxy TLS, non il deployment.
verifica_facoltativa() {
    local nome="$1" nota="$2" percorso
    percorso=$(leggi "$nome")

    if [ -z "$percorso" ]; then
        # Il compose la pretende comunque per costruire il bind mount.
        rosso "  manca     $nome non è valorizzata (il compose la richiede lo stesso)"
        errori=$((errori + 1))
        return
    fi
    if [ ! -d "$percorso" ] || [ -z "$(ls -A "$percorso" 2>/dev/null)" ]; then
        mkdir -p "$percorso" 2>/dev/null
        giallo "  da fare   $nome = $percorso"
        giallo "            $nota"
        avvisi=$((avvisi + 1))
        return
    fi
    verde "  ok        $percorso"
}

valore_richiesto() {
    local nome="$1" nota="$2" valore
    valore=$(leggi "$nome")

    if [ -z "$valore" ]; then
        rosso "  manca     $nome — $nota"
        errori=$((errori + 1))
        return
    fi
    verde "  ok        $nome"
}

echo
echo "Directory che arrivano col bundle"
if verifica_directory POSTGRES_INIT_DIR "gli script di inizializzazione di PostgreSQL"; then
    verifica_file "*.sh" "01-init-databases.sh e 02-utente-admin.sh"
fi
if verifica_directory SCHEMAS_DIR "gli schemi SQL delle due applicazioni"; then
    verifica_file "istanta/*.sql"   "lo schema di Istanta"
    verifica_file "correggo4/*.sql" "lo schema di Correggo4"
fi
if verifica_directory PROXY_TEMPLATE_DIR "la configurazione di nginx"; then
    verifica_file "*.template" "default.conf.template"
fi

# Sottodirectory di una directory di dati. Esistono perché il compose le monta
# come bind mount invece che come volumi nominati: un volume nominato su un
# percorso che nell'immagine non esiste nascerebbe vuoto e di proprietà di root,
# e l'applicazione, che gira come 1654, non potrebbe scriverci. Preparandole qui
# il problema non si presenta, e soprattutto non si ripresenta.
verifica_sottodirectory() {
    local nome="$1" sotto="$2" proprietario="$3" base
    base=$(leggi "$nome")
    [ -n "$base" ] || return          # l'assenza l'ha già segnalata verifica_dati
    case "$base" in /*) ;; *) return ;; esac

    if [ ! -d "$base/$sotto" ]; then
        if ! mkdir -p "$base/$sotto"; then
            rosso "  errore    non riesco a creare $base/$sotto"
            errori=$((errori + 1))
            return
        fi
        giallo "  creata    $base/$sotto"
    fi
    if ! chown -R "$proprietario:$proprietario" "$base/$sotto"; then
        rosso "  errore    non riesco ad assegnare $base/$sotto a $proprietario (serve sudo)"
        errori=$((errori + 1))
        return
    fi
    verde "  ok        $base/$sotto (proprietario $proprietario)"
}

echo
echo "Directory di dati"
verifica_dati ISTANTA_DATA_DIR "$UID_APP"
# Chiavi di DataProtection: senza queste scrivibili, ogni pagina di Istanta
# risponde 500, perché il cookie di sessione non può essere cifrato.
verifica_sottodirectory ISTANTA_DATA_DIR  "dataprotection-keys" "$UID_APP"
# Campioni di addestramento scritti da BackgroundCodeService.
verifica_sottodirectory ISTANTA_DATA_DIR  "ai_models"           "$UID_APP"
verifica_dati CORREGGO_DATA_DIR "$UID_APP"
verifica_sottodirectory CORREGGO_DATA_DIR "volantini"           "$UID_APP"
# Ci scrive il Runner installando AgenziaLib.dll, e Istanta la legge in sola
# lettura: può restare di root, basta che esista.
verifica_dati ISTANTA_EXTERNAL_LIB_DIR

echo
echo "Facoltativo"
verifica_facoltativa PROXY_CERT_DIR \
  "Serve solo al proxy HTTPS: dentro ci vanno fullchain.pem e privkey.pem. Finché è vuota, usa le porte in chiaro."

echo
echo "Valori che il compose pretende"
valore_richiesto ISTANTA_DB_PASSWORD  "password del database di Istanta"
valore_richiesto CORREGGO_DB_PASSWORD "password del database di Correggo4"
valore_richiesto ADMIN_EMAIL          "primo utente amministratore"
valore_richiesto ADMIN_USERNAME       "primo utente amministratore"
valore_richiesto ADMIN_PASSWORD       "primo utente amministratore"

# utenti.password di Istanta è varchar(50): una password più lunga farebbe
# fallire l'INSERT a metà inizializzazione, lasciando un volume che PostgreSQL
# non riprenderà mai più in mano.
pwd_admin=$(leggi ADMIN_PASSWORD)
if [ -n "$pwd_admin" ] && [ "${#pwd_admin}" -gt 50 ]; then
    rosso "  lunga     ADMIN_PASSWORD supera i 50 caratteri, limite della colonna utenti.password di Istanta"
    errori=$((errori + 1))
fi

echo
if [ "$errori" -gt 0 ]; then
    if [ "$errori" -eq 1 ]; then
        rosso "1 problema da risolvere prima di distribuire."
    else
        rosso "$errori problemi da risolvere prima di distribuire."
    fi
    echo
    echo "Gli script di init, gli schemi e i template si copiano dal bundle:"
    echo "  sudo cp -r /percorso/del/bundle/{postgres-init,schemas,proxy-templates} ."
    exit 1
fi

if [ "$avvisi" -eq 1 ]; then
    giallo "Pronto per distribuire. 1 cosa facoltativa da sistemare quando servirà."
elif [ "$avvisi" -gt 1 ]; then
    giallo "Pronto per distribuire. $avvisi cose facoltative da sistemare quando serviranno."
else
    verde "Pronto per distribuire."
fi

# Il controllo più importante viene per ultimo, perché è l'unico che non si
# risolve preparando qualcosa: se PostgreSQL ha già inizializzato il volume
# quando mancavano gli schemi, quel volume resta sbagliato per sempre.
volume="$(leggi COMPOSE_PROJECT_NAME)_postgres_data"
if docker volume inspect "$volume" >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    echo
    giallo "Attenzione al volume $volume."
    giallo "Se PostgreSQL si è avviato prima che gli schemi fossero al loro posto,"
    giallo "è rimasto senza tabelle e non si sistemerà da solo: gli script di"
    giallo "/docker-entrypoint-initdb.d girano soltanto su un volume vuoto."
    echo
    echo "Per ripartire da zero (SI PERDONO I DATI):"
    echo "  docker compose --env-file release.env -f compose.production.yaml down -v"
    echo
    echo "Per controllare prima se le tabelle ci sono:"
    echo "  docker compose --env-file release.env -f compose.production.yaml \\"
    echo "    exec postgres psql -U \"\$(sed -n 's/^ISTANTA_DB_USER=//p' release.env)\" \\"
    echo "    -d \"\$(sed -n 's/^ISTANTA_DB_NAME=//p' release.env)\" -c '\\dt'"
fi
echo
