#!/usr/bin/env bash
# Test del proxy di docker/fidelity-olimpo con PROXY_UPSTREAM.
#
#   bash docker/tests/test-proxy-templates.sh
#
# Lavora SOLO su container usa e getta, con nomi propri (ptest<pid>...), e li
# cancella alla fine: non tocca nessun container o volume esistente. Serve
# Docker con il plugin compose, openssl e la possibilita' di scaricare
# nginx:1.27-alpine.
#
# Verifica che:
#   - il compose scelga la cartella dei template da PROXY_UPSTREAM, fidelity se
#     non e' impostata, e che il proxy non trascini con se' nessun servizio;
#   - sul server con solo Olimpo `olimpo proxy` si risolva con fidelity.env
#     vuoto e un FIDELITY_IMAGE qualsiasi;
#   - ciascun template, reso dall'immagine nginx come in produzione, dia una
#     configurazione valida che punta al servizio giusto, e che nginx parta
#     anche senza quel servizio in rete;
#   - un valore sconosciuto non produca nessun sito sulla 443.
set -uo pipefail

# Git Bash su Windows riscrive gli argomenti che sembrano percorsi
# (/etc/nginx/...) prima di passarli a docker; su Linux non cambia nulla.
export MSYS_NO_PATHCONV=1

qui=$(cd "$(dirname "$0")" && pwd)
radice=$(dirname "$qui")
bundle="$radice/fidelity-olimpo"
pfx="ptest$$"
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

# --------------------------------------------------------------- compose

# Una directory di progetto finta: compose ne legge i file d'ambiente, ma con
# `config` non avvia niente e non controlla che i percorsi dei mount esistano.
progetto="$tmp/progetto"
mkdir -p "$progetto"
cp "$bundle/compose.production.yaml" "$progetto/"
: > "$progetto/fidelity.env"
: > "$progetto/olimpo.env"

scrivi_release() {  # valore di PROXY_UPSTREAM, vuoto per ometterlo
    {
        echo "COMPOSE_PROJECT_NAME=${pfx}"
        echo "FIDELITY_IMAGE=segnaposto"
        echo "OLIMPO_IMAGE=segnaposto"
        echo "FIDELITY_DB_PASSWORD=prova"
        echo "OLIMPO_DB_PASSWORD=prova"
        echo "POSTGRES_INIT_DIR=/non/usata/postgres-init"
        echo "FIDELITY_CONFIG_DIR=/non/usata/fidelity-config"
        echo "PROXY_TEMPLATE_DIR=/non/usata/proxy-templates"
        echo "PROXY_CERT_DIR=/non/usata/proxy-certs"
        [ -n "$1" ] && echo "PROXY_UPSTREAM=$1"
    } > "$progetto/release.env"
}

config() {  # servizi...
    (cd "$progetto" && docker compose --env-file release.env -f compose.production.yaml config "$@" 2>&1)
}

cartella_template() {
    config proxy | sed -n 's/^ *NGINX_ENVSUBST_TEMPLATE_DIR: *//p' | tr -d '\r"'
}

echo "Compose"
scrivi_release ""
verifica "senza PROXY_UPSTREAM il proxy usa fidelity" /etc/nginx/templates/fidelity "$(cartella_template)"
verifica "il proxy non avvia fidelity" 0 "$(config proxy | grep -c '^  fidelity:')"
verifica "il proxy non avvia olimpo" 0 "$(config proxy | grep -c '^  olimpo:')"

scrivi_release fidelity
verifica "PROXY_UPSTREAM=fidelity" /etc/nginx/templates/fidelity "$(cartella_template)"

scrivi_release olimpo
verifica "PROXY_UPSTREAM=olimpo" /etc/nginx/templates/olimpo "$(cartella_template)"
config olimpo proxy > "$tmp/solo-olimpo.log"
esito=$?
verifica "solo olimpo: il compose si risolve" 0 "$esito"
[ "$esito" -eq 0 ] || sed 's/^/        /' "$tmp/solo-olimpo.log"
verifica "solo olimpo: fidelity resta fuori" 0 "$(grep -c '^  fidelity:' "$tmp/solo-olimpo.log")"

verifica "prepare-target.sh e' bash valido" 0 "$(bash -n "$bundle/prepare-target.sh" >/dev/null 2>&1; echo $?)"

# --------------------------------------------------------------- nginx

echo
echo "Template resi da nginx"
mkdir -p "$tmp/certs"
# Nomi relativi: l'openssl nativo di Windows non capirebbe /tmp/... senza la
# conversione dei percorsi, spenta qui sopra.
(cd "$tmp/certs" && openssl req -x509 -nodes -newkey rsa:2048 -days 1 -subj "/CN=localhost" \
    -keyout privkey.pem -out fullchain.pem >/dev/null 2>&1) \
    || { echo "openssl non disponibile o fallito"; exit 1; }

# Percorso dell'host da passare a docker: su Git Bash la conversione automatica
# e' spenta, quindi /c/... va tradotto a mano; su Linux resta com'e'.
host() {
    if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else echo "$1"; fi
}

# Avvia nginx come il servizio del compose, ma senza rete condivisa: fidelity e
# olimpo non esistono, e nginx deve partire lo stesso.
avvia_proxy() {  # nome valore-di-PROXY_UPSTREAM
    local c="${pfx}-$1"
    docker create --name "$c" \
        -e FIDELITY_HTTP_PORT=3010 -e FIDELITY_WS_PORT=3400 \
        -e NGINX_ENVSUBST_TEMPLATE_DIR="/etc/nginx/templates/$2" \
        -e NGINX_ENVSUBST_FILTER='^FIDELITY_' \
        nginx:1.27-alpine >/dev/null || exit 1
    docker cp "$(host "$bundle/proxy-templates")" "$c:/etc/nginx/templates" >/dev/null || exit 1
    docker cp "$(host "$tmp/certs")" "$c:/etc/nginx/certs" >/dev/null || exit 1
    docker start "$c" >/dev/null || exit 1
    local i
    for i in $(seq 1 30); do
        docker exec "$c" test -f /var/run/nginx.pid 2>/dev/null && return 0
        [ "$(docker inspect -f '{{.State.Running}}' "$c")" = true ] || break
        sleep 1
    done
    echo "  nginx non e' partito con PROXY_UPSTREAM=$2:"; docker logs "$c" 2>&1 | tail -20 | sed 's/^/        /'
    falliti=$((falliti + 1))
    return 1
}

conf() { docker exec "$1" cat /etc/nginx/conf.d/default.conf | tr -d '\r'; }
conta() { conf "$1" | grep -c -- "$2"; }

if avvia_proxy fidelity fidelity; then
    c="${pfx}-fidelity"
    verifica "fidelity: nginx -t" 0 "$(docker exec "$c" nginx -t >/dev/null 2>&1; echo $?)"
    verifica "fidelity: ascolta sulla 443" 1 "$(conta "$c" 'listen 443 ssl')"
    verifica "fidelity: HTTP su fidelity:3010" 1 "$(conta "$c" 'http://fidelity:3010;')"
    verifica "fidelity: WebSocket su fidelity:3400" 1 "$(conta "$c" 'http://fidelity:3400;')"
    verifica "fidelity: nessun riferimento a olimpo" 0 "$(conta "$c" 'olimpo')"
    verifica "fidelity: variabili di nginx intatte" 1 "$(conta "$c" 'Upgrade           \$http_upgrade')"
fi

if avvia_proxy olimpo olimpo; then
    c="${pfx}-olimpo"
    verifica "olimpo: nginx -t" 0 "$(docker exec "$c" nginx -t >/dev/null 2>&1; echo $?)"
    verifica "olimpo: ascolta sulla 443" 1 "$(conta "$c" 'listen 443 ssl')"
    verifica "olimpo: tutto su olimpo:3000" 1 "$(conta "$c" 'http://olimpo:3000;')"
    verifica "olimpo: nessun riferimento a fidelity" 0 "$(conta "$c" 'fidelity')"
    verifica "olimpo: inoltra l'Upgrade del WebSocket" 1 "$(conta "$c" 'Upgrade           \$http_upgrade')"
    verifica "olimpo: upload senza limite" 1 "$(conta "$c" 'client_max_body_size 0;')"
fi

if avvia_proxy ignoto inesistente; then
    verifica "valore sconosciuto: nessun sito sulla 443" 0 "$(conta "${pfx}-ignoto" 'listen 443')"
fi

echo
if [ "$falliti" -gt 0 ]; then
    printf '\033[31m%s verifiche fallite.\033[0m\n' "$falliti"
    exit 1
fi
printf '\033[32mTutte le verifiche sono passate.\033[0m\n'
