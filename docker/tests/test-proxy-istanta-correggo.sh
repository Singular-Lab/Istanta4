#!/usr/bin/env bash
# Test del proxy di docker/istanta-correggo senza dipendenze.
#
#   bash docker/tests/test-proxy-istanta-correggo.sh
#
# Lavora SOLO su container usa e getta, con nomi propri (pictest<pid>...), e li
# cancella alla fine: non tocca nessun container o volume esistente. Serve
# Docker con il plugin compose, openssl e la possibilita' di scaricare
# nginx:1.27-alpine.
#
# Verifica che:
#   - il proxy non trascini con se' Istanta ne' Correggo4, anche quando
#     l'immagine di Correggo4 e' il segnaposto di un target senza Correggo;
#   - il template, reso dall'immagine nginx come in produzione, dia una
#     configurazione valida con Istanta sulla 443 e Correggo4 sulla 444, e che
#     nginx parta senza le due applicazioni in rete.
set -uo pipefail

# Git Bash su Windows riscrive gli argomenti che sembrano percorsi
# (/etc/nginx/...) prima di passarli a docker; su Linux non cambia nulla.
export MSYS_NO_PATHCONV=1

qui=$(cd "$(dirname "$0")" && pwd)
radice=$(dirname "$qui")
bundle="$radice/istanta-correggo"
pfx="pictest$$"
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
: > "$progetto/istanta.env"
: > "$progetto/correggo4.env"
{
    echo "COMPOSE_PROJECT_NAME=${pfx}"
    echo "ISTANTA_IMAGE=segnaposto"
    echo "CORREGGO4_IMAGE=correggo4-non-distribuito-su-questo-target"
    echo "ISTANTA_DB_PASSWORD=prova"
    echo "CORREGGO_DB_PASSWORD=prova"
    echo "ADMIN_EMAIL=admin@example.invalid"
    echo "ADMIN_USERNAME=admin"
    echo "ADMIN_PASSWORD=prova"
    echo "ISTANTA_CLIENTE=prova"
    for v in ISTANTA_CLIENT_CONFIG ISTANTA_DATA_DIR ISTANTA_EXTERNAL_LIB_DIR CORREGGO_DATA_DIR \
             POSTGRES_INIT_DIR SCHEMAS_DIR PROXY_TEMPLATE_DIR PROXY_CERT_DIR; do
        echo "$v=/non/usata/$v"
    done
} > "$progetto/release.env"

echo "Compose"
(cd "$progetto" && docker compose --env-file release.env -f compose.production.yaml config proxy) \
    > "$tmp/proxy.log" 2>&1
esito=$?
verifica "il compose si risolve" 0 "$esito"
[ "$esito" -eq 0 ] || sed 's/^/        /' "$tmp/proxy.log"
verifica "il proxy non avvia istanta" 0 "$(grep -c '^  istanta:' "$tmp/proxy.log")"
verifica "il proxy non avvia correggo4" 0 "$(grep -c '^  correggo4:' "$tmp/proxy.log")"
verifica "il proxy non ha depends_on" 0 "$(grep -c 'depends_on:' "$tmp/proxy.log")"

# --------------------------------------------------------------- nginx

echo
echo "Template reso da nginx"
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

# Come il servizio del compose, ma senza rete condivisa: istanta e correggo4
# non esistono, e nginx deve partire lo stesso.
c="${pfx}-proxy"
docker create --name "$c" \
    -e APP_ISTANTA_PORT=8080 -e APP_CORREGGO_PORT=8080 \
    -e NGINX_ENVSUBST_FILTER='^APP_' \
    nginx:1.27-alpine >/dev/null || exit 1
docker cp "$(host "$bundle/proxy-templates")" "$c:/etc/nginx/templates" >/dev/null || exit 1
docker cp "$(host "$tmp/certs")" "$c:/etc/nginx/certs" >/dev/null || exit 1
docker start "$c" >/dev/null || exit 1

partito=no
for i in $(seq 1 30); do
    if docker exec "$c" test -f /var/run/nginx.pid 2>/dev/null; then partito=si; break; fi
    [ "$(docker inspect -f '{{.State.Running}}' "$c")" = true ] || break
    sleep 1
done
verifica "nginx parte senza istanta e correggo4" si "$partito"
[ "$partito" = si ] || docker logs "$c" 2>&1 | tail -20 | sed 's/^/        /'

if [ "$partito" = si ]; then
    conta() { docker exec "$c" cat /etc/nginx/conf.d/default.conf | tr -d '\r' | grep -c -- "$1"; }
    verifica "nginx -t" 0 "$(docker exec "$c" nginx -t >/dev/null 2>&1; echo $?)"
    verifica "Istanta sulla 443" 1 "$(conta 'listen 443 ssl')"
    verifica "Correggo4 sulla 444" 1 "$(conta 'listen 444 ssl')"
    verifica "Istanta su istanta:8080" 1 "$(conta 'http://istanta:8080;')"
    verifica "Correggo4 su correggo4:8080" 1 "$(conta 'http://correggo4:8080;')"
fi

echo
if [ "$falliti" -gt 0 ]; then
    printf '\033[31m%s verifiche fallite.\033[0m\n' "$falliti"
    exit 1
fi
printf '\033[32mTutte le verifiche sono passate.\033[0m\n'
