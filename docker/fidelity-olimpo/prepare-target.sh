#!/usr/bin/env bash
# Prepara la directory di progetto sul target prima di distribuire fidelity+olimpo.
#
# Si esegue con sudo, dalla directory che contiene release.env:
#
#   cd /opt/company-ai/projects/istanta4
#   sudo ./prepare-target.sh
#
# Perché serve: Docker non fallisce mai su un bind mount il cui percorso non
# esiste. Lo crea vuoto, di proprietà di root, e tira dritto. Il guasto emerge
# molto dopo e lontano dalla causa — con `postgres-init` vuoto il ruolo di Olimpo
# non viene mai creato, e l'errore arriva settimane dopo come `password
# authentication failed`.
#
# Lo script controlla anche le variabili obbligatorie di fidelity.env, perché lì
# il modo di fallire è particolarmente sgradevole: Fidelity valida l'ambiente con
# Zod all'avvio e, se ne manca una, termina con exit 1. Il container muore prima
# di diventare healthy, `up --wait` scade e il Runner fa rollback su un
# deployment che in realtà è sano — sembra un problema di release quando invece
# è una riga vuota in un file di configurazione.
set -uo pipefail

# UID/GID dell'utente `node`, con cui gira Fidelity (`user: "node"` nel compose).
readonly UID_APP=1000

rosso()  { printf '\033[31m%s\033[0m\n' "$*"; }
giallo() { printf '\033[33m%s\033[0m\n' "$*"; }
verde()  { printf '\033[32m%s\033[0m\n' "$*"; }

errori=0
avvisi=0

for f in release.env fidelity.env olimpo.env; do
    if [ ! -f "$f" ]; then
        rosso "$f non trovato: esegui lo script dalla directory del progetto,"
        rosso "dopo aver copiato i tre file d'ambiente dal bundle."
        exit 1
    fi
done

# Legge una variabile senza eseguire il file: contengono segreti, e un `source`
# eseguirebbe anche quello che ci fosse dentro per errore. Unica funzione che
# gira in una subshell, e infatti si limita a stampare: ogni verifica avviene
# nella shell principale, dove i contatori esistono davvero.
leggi() {
    sed -n "s/^$2=//p" "$1" | tail -n 1 | tr -d '\r' \
        | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

# --------------------------------------------------------------- directory

# verifica_directory lascia il percorso in `percorso_verificato` e restituisce 0
# solo se c'è davvero, così verifica_file può proseguire da lì.
percorso_verificato=""

verifica_directory() {
    local nome="$1" attesi="$2" percorso
    percorso_verificato=""
    percorso=$(leggi release.env "$nome")

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
            rosso "            in /deployments/istanta4, che sull'host non esiste."
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

# Cerca i file che devono esserci dentro la directory appena verificata. Non
# basta che la directory non sia vuota: con `postgres-init` presente ma senza lo
# script dentro, PostgreSQL parte lo stesso e salta l'inizializzazione.
verifica_file() {
    local modello="$1" attesi="$2" trovati
    [ -n "$percorso_verificato" ] || return

    # Si conta con find e non con un glob della shell: sotto `set -u` un glob che
    # non trova nulla resterebbe il testo del modello, e il confronto direbbe
    # che il file c'è.
    trovati=$(find "$percorso_verificato" -path "$percorso_verificato/$modello" -type f 2>/dev/null | wc -l)
    if [ "$trovati" -eq 0 ]; then
        rosso "  incompleta $percorso_verificato non contiene $modello"
        rosso "            Ci vanno $attesi."
        errori=$((errori + 1))
        return
    fi
    verde "  ok        $percorso_verificato/$modello ($trovati)"
}

# Directory di dati: si crea, e si assegna all'utente applicativo.
verifica_dati() {
    local nome="$1" proprietario="$2" percorso
    percorso=$(leggi release.env "$nome")

    if [ -z "$percorso" ]; then
        rosso "  manca     $nome non è valorizzata in release.env"
        errori=$((errori + 1))
        return 1
    fi
    case "$percorso" in
        /*) ;;
        *)  rosso "  relativo  $nome = $percorso (serve un percorso assoluto)"
            errori=$((errori + 1))
            return 1 ;;
    esac
    if [ ! -d "$percorso" ]; then
        if ! mkdir -p "$percorso"; then
            rosso "  errore    non riesco a creare $percorso"
            errori=$((errori + 1))
            return 1
        fi
        giallo "  creata    $nome = $percorso"
    fi
    if ! chown -R "$proprietario:$proprietario" "$percorso"; then
        rosso "  errore    non riesco ad assegnare $percorso a $proprietario (serve sudo)"
        errori=$((errori + 1))
        return 1
    fi
    verde "  ok        $percorso (proprietario $proprietario)"
    percorso_verificato="$percorso"
    return 0
}

# --------------------------------------------------------------- variabili

valore_richiesto() {
    local file="$1" nome="$2" nota="$3" valore
    valore=$(leggi "$file" "$nome")

    if [ -z "$valore" ]; then
        rosso "  manca     $nome — $nota"
        errori=$((errori + 1))
        return 1
    fi
    [ "${silenzioso:-no}" = si ] || verde "  ok        $nome"
    return 0
}

# release.env e' il file che docker compose usa per l'interpolazione, e li' un
# `$` seguito da lettere viene trattato come riferimento a un'altra variabile:
# `uno$due` arriva al container come `uno`, senza che nessuno protesti. Con una
# cifra (`chiave$1abc`) invece sopravvive. E' un modo di sbagliare silenzioso e
# molto difficile da ricondurre alla causa, quindi val la pena dirlo prima.
avvisa_dollaro() {
    local nome="$1" valore
    valore=$(leggi release.env "$nome")
    case "$valore" in
        *\$[A-Za-z_{]*)
            giallo "  attenzione $nome contiene un \$ seguito da lettere."
            giallo "            docker compose lo interpreta come un'altra variabile e la"
            giallo "            parte da li' in poi sparisce. Cambia il valore, oppure"
            giallo "            raddoppia il dollaro: \$\$."
            avvisi=$((avvisi + 1)) ;;
    esac
}

# Obbligatoria per Zod, e di tipo z.string().url(): un path relativo passa il
# controllo "non è vuota" ma fa terminare il processo all'avvio.
url_richiesto() {
    local nome="$1" valore
    valore_richiesto fidelity.env "$nome" "obbligatoria, Fidelity non parte senza" || return
    valore=$(leggi fidelity.env "$nome")
    case "$valore" in
        http://*|https://*) ;;
        *)  rosso "  non URL   $nome = $valore"
            rosso "            Lo schema la vuole come URL assoluto (z.string().url()):"
            rosso "            deve iniziare con http:// o https://."
            errori=$((errori + 1)) ;;
    esac
}

numero_richiesto() {
    local nome="$1" valore
    valore_richiesto fidelity.env "$nome" "obbligatoria, Fidelity non parte senza" || return
    valore=$(leggi fidelity.env "$nome")
    case "$valore" in
        ''|*[!0-9]*)
            rosso "  non num.  $nome = $valore (lo schema la vuole numerica)"
            errori=$((errori + 1)) ;;
    esac
}

# --------------------------------------------------------------- controlli

echo
echo "Directory che arrivano col bundle"
if verifica_directory POSTGRES_INIT_DIR "lo script che crea database e ruolo di Olimpo"; then
    verifica_file "*.sh" "01-init-databases.sh"
fi
if verifica_directory PROXY_TEMPLATE_DIR "la configurazione di nginx"; then
    verifica_file "*.template" "default.conf.template"
fi

echo
echo "Directory di dati"
# Montata su /app/config. Fidelity vi legge config/menu.json e lo RISCRIVE dalla
# schermata di gestione pagine, quindi non basta che esista: deve appartenere a
# node, altrimenti il salvataggio fallisce.
if verifica_dati FIDELITY_CONFIG_DIR "$UID_APP"; then
    if [ ! -f "$percorso_verificato/menu.json" ]; then
        giallo "  da fare   manca $percorso_verificato/menu.json"
        giallo "            Non impedisce l'avvio: solo la schermata di gestione pagine"
        giallo "            risponderà in errore finché il file non c'è."
        avvisi=$((avvisi + 1))
    else
        verde "  ok        $percorso_verificato/menu.json"
    fi
fi

# Le directory di lavoro di Olimpo stanno dentro il volume olimpo_uploads, non
# sull'host, quindi non si creano con mkdir. Si pre-crea il volume e ci si entra
# con un container usa e getta: fatto PRIMA del primo `up`, il volume risulta poi
# non vuoto e Docker non lo semina dall'immagine — che in quel punto contiene
# solo FTP/, ricreata qui insieme alle altre.
#
# Perché serve: absolute_paths indica a Olimpo dove scrivere (WEB, ARCHIVIO,
# MATERIALI, VIDEO), ma il codice non crea quelle directory: garantisce solo
# FTP_ROOT. Senza, il primo salvataggio fallisce.
prepara_volume_olimpo() {
    local progetto volume
    progetto=$(leggi release.env COMPOSE_PROJECT_NAME)
    volume="${progetto:-istanta4}_olimpo_uploads"

    if ! docker info >/dev/null 2>&1; then
        giallo "  saltato   Docker non interrogabile: il volume $volume va preparato a parte"
        avvisi=$((avvisi + 1))
        return
    fi
    docker volume create "$volume" >/dev/null 2>&1
    if docker run --rm -v "$volume:/v" busybox:1.36 sh -c         'mkdir -p /v/web /v/archivio /v/materiali /v/video /v/FTP && chown -R 1000:1000 /v'         >/dev/null 2>&1
    then
        verde "  ok        volume $volume (web, archivio, materiali, video, FTP)"
    else
        rosso "  errore    non riesco a preparare il volume $volume"
        rosso "            Serve l'immagine busybox: docker pull busybox:1.36"
        errori=$((errori + 1))
    fi
}

echo
echo "Volume di lavoro di Olimpo"
prepara_volume_olimpo

echo
echo "Facoltativo"
cert_dir=$(leggi release.env PROXY_CERT_DIR)
if [ -z "$cert_dir" ]; then
    rosso "  manca     PROXY_CERT_DIR non è valorizzata (il compose la richiede lo stesso)"
    errori=$((errori + 1))
elif [ ! -f "$cert_dir/fullchain.pem" ] || [ ! -f "$cert_dir/privkey.pem" ]; then
    mkdir -p "$cert_dir" 2>/dev/null
    giallo "  da fare   $cert_dir senza fullchain.pem e privkey.pem"
    giallo "            Serve solo al proxy, che si avvia a parte e non è una"
    giallo "            dipendenza di Fidelity: senza, il deployment funziona lo stesso."
    avvisi=$((avvisi + 1))
    certificato_presente=no
else
    verde "  ok        $cert_dir (fullchain.pem e privkey.pem)"
    certificato_presente=si
fi

echo
echo "Valori in release.env"
valore_richiesto release.env FIDELITY_DB_PASSWORD "password del database di Fidelity"
valore_richiesto release.env OLIMPO_DB_PASSWORD   "password del database di Olimpo"
avvisa_dollaro FIDELITY_DB_PASSWORD
avvisa_dollaro OLIMPO_DB_PASSWORD

echo
echo "Variabili obbligatorie di fidelity.env"
# L'elenco è quello di server/core/config/index.ts, meno le variabili che imposta
# il compose (DB_POSTGRESQL_*, MONGO_*, NODE_*, WS_PORT, ICONE_INSEGNA_DIR):
# quelle in fidelity.env verrebbero comunque ignorate, perché `environment` vince
# su `env_file`.
errori_prima=$errori
silenzioso=si
url_richiesto CLIENT_URL
url_richiesto ISTANTA_IP_ADDRESS
url_richiesto PROXY_URL
url_richiesto VITE_API_URL
url_richiesto OLYMPUS_IP_ADDRESS
url_richiesto VITE_OLYMPUS_IP_ADDRESS
url_richiesto OLYMPUS_IP_ADDRESS_CORS
url_richiesto VITE_OLYMPUS_IP_ADDRESS_CORS
numero_richiesto SALT_ROUNDS
numero_richiesto SMTP_PORT
for v in FICO_SECRET SESSION_SECRET EPHEMERAL_TOKEN_SECRET \
         OPENAI_API_KEY OPENAI_PROJECT_ID API_KEY_AI ASSISTANT_ID \
         OPEN_AI_ASSISTANT_ID OPEN_AI_ASSISTANT_ID_TRANSLATION \
         SMTP_HOST SMTP_USER SMTP_PASSWORD; do
    valore_richiesto fidelity.env "$v" "obbligatoria, Fidelity non parte senza"
done
silenzioso=no
if [ "$errori" -eq "$errori_prima" ]; then
    verde "  ok        tutte valorizzate (22 variabili)"
fi

# --------------------------------------------------- coerenza fra le scelte

# Due combinazioni che passano ogni controllo preso da solo e poi non funzionano
# nel browser. Entrambe già incontrate: vale la pena che lo dica lo script e non
# mezz'ora di prove.
echo
echo "Coerenza"
client_url=$(leggi fidelity.env CLIENT_URL)
node_env=$(leggi release.env FIDELITY_NODE_ENV)
case "$client_url" in
    https://*)
        if [ "${certificato_presente:-no}" = no ]; then
            giallo "  attenzione CLIENT_URL è https:// ma il certificato del proxy non c'è."
            giallo "            Il browser non raggiungerà l'applicazione finché non avvii"
            giallo "            il proxy, che si avvia a parte: docker compose up -d proxy"
            avvisi=$((avvisi + 1))
        else
            verde "  ok        CLIENT_URL https con certificato presente"
        fi ;;
    http://*)
        if [ "$node_env" != development ]; then
            giallo "  attenzione CLIENT_URL è http:// ma FIDELITY_NODE_ENV non è development."
            giallo "            In production la CSP applica upgrade-insecure-requests: il"
            giallo "            browser richiede ogni risorsa in https e la pagina resta"
            giallo "            bianca, senza errori nei log del server. Su una macchina di"
            giallo "            prova in chiaro, imposta FIDELITY_NODE_ENV=development in"
            giallo "            release.env."
            avvisi=$((avvisi + 1))
        else
            verde "  ok        CLIENT_URL http con FIDELITY_NODE_ENV=development"
        fi ;;
    *)  giallo "  saltato   senza CLIENT_URL non c'è niente da verificare" ;;
esac

# --------------------------------------------------------------- esito

echo
if [ "$errori" -gt 0 ]; then
    if [ "$errori" -eq 1 ]; then
        rosso "1 problema da risolvere prima di distribuire."
    else
        rosso "$errori problemi da risolvere prima di distribuire."
    fi
    echo
    echo "Lo script di init e i template si copiano dal bundle:"
    echo "  sudo cp -r /percorso/del/bundle/{postgres-init,proxy-templates} ."
    exit 1
fi

if [ "$avvisi" -eq 1 ]; then
    giallo "Pronto per distribuire. 1 cosa da sistemare quando servirà."
elif [ "$avvisi" -gt 1 ]; then
    giallo "Pronto per distribuire. $avvisi cose da sistemare quando serviranno."
else
    verde "Pronto per distribuire."
fi

# Il promemoria più importante viene per ultimo, perché è l'unico che non si
# risolve preparando qualcosa: se PostgreSQL ha già inizializzato il volume
# quando postgres-init era vuoto, quel volume resta senza il ruolo di Olimpo e
# non si sistema da solo. Lo si stampa anche quando Docker non è interrogabile,
# perché senza sudo la verifica fallirebbe in silenzio proprio a chi serve.
volume="$(leggi release.env COMPOSE_PROJECT_NAME)_postgres_data"
if docker volume inspect "$volume" >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    echo
    giallo "Attenzione al volume $volume."
    giallo "Gli script di /docker-entrypoint-initdb.d girano soltanto su un volume"
    giallo "vuoto: se PostgreSQL si è avviato prima che postgres-init fosse al suo"
    giallo "posto, il ruolo di Olimpo non esiste e non verrà creato da solo."
    echo
    echo "Per controllare:"
    echo "  docker exec ${volume%_postgres_data}-postgres-1 \\"
    echo "    psql -U \"\$(sed -n 's/^FIDELITY_DB_USER=//p' release.env)\" \\"
    echo "    -d \"\$(sed -n 's/^FIDELITY_DB_NAME=//p' release.env)\" -c '\\du'"
    echo
    echo "Per ripartire da zero (SI PERDONO I DATI):"
    echo "  docker compose --env-file release.env -f compose.production.yaml down -v"
fi
echo
