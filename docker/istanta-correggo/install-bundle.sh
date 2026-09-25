#!/usr/bin/env bash
# Allinea al bundle tutti i file di questo deployment set su un target esistente.
#
#   # dal PC di sviluppo
#   scp -r docker/istanta-correggo UTENTE@TARGET:/tmp/
#
#   # sul target
#   cd /opt/company-ai/projects/istanta4
#   sudo /tmp/istanta-correggo/install-bundle.sh
#
# Perché esiste: su una macchina nuova si copia tutto insieme e il bundle è
# coerente per costruzione. Su una macchina già installata, invece, si tende ad
# aggiornare un file alla volta — il compose oggi, uno script domani — e la
# deriva non si vede guardando i file: hanno lo stesso nome e lo stesso aspetto
# di quelli giusti. È così che un `prepare-target.sh` vecchio di due settimane
# ha smesso di creare una directory che il compose nuovo si aspettava, con un
# errore che compariva molto lontano dalla causa.
#
# Cosa sovrascrive: tutto ciò che appartiene al bundle — compose, script,
# postgres-init, schemas, proxy-templates, README, e i .env.example.
#
# Cosa NON tocca mai: i file d'ambiente veri (release.env, istanta.env,
# correggo4.env), i certificati, le directory di dati. Appartengono alla
# macchina, non al bundle. Quando manca un .env lo crea dal rispettivo esempio e
# lo dice, perché a quel punto va compilato prima di distribuire.
set -uo pipefail

rosso()  { printf '\033[31m%s\033[0m\n' "$*"; }
giallo() { printf '\033[33m%s\033[0m\n' "$*"; }
verde()  { printf '\033[32m%s\033[0m\n' "$*"; }

bundle="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
destinazione="$PWD"

if [ "$bundle" = "$destinazione" ]; then
    rosso "Origine e destinazione coincidono."
    rosso "Esegui lo script dalla directory del progetto, indicando il bundle:"
    rosso "  cd /opt/company-ai/projects/<progetto> && sudo /tmp/istanta-correggo/install-bundle.sh"
    exit 1
fi

echo
echo "Bundle:       $bundle"
echo "Destinazione: $destinazione"

aggiornati=0
invariati=0
errori=0

# I file del bundle: si sovrascrivono sempre, perché la loro versione buona è
# quella nel repository.
copia() {
    local nome="$1"
    if [ ! -e "$bundle/$nome" ]; then
        rosso "  assente   $nome non c'è nel bundle"
        errori=$((errori + 1))
        return
    fi

    # Il confronto serve solo a dire cosa è cambiato: la copia avviene comunque,
    # perché un file identico ricopiato non fa danno mentre uno saltato per
    # errore riapre esattamente il problema che questo script chiude.
    local diverso=no
    if [ -d "$bundle/$nome" ]; then
        diff -rq "$bundle/$nome" "$destinazione/$nome" >/dev/null 2>&1 || diverso=si
        rm -rf "${destinazione:?}/$nome"
        cp -a "$bundle/$nome" "$destinazione/"
    else
        cmp -s "$bundle/$nome" "$destinazione/$nome" || diverso=si
        cp -a "$bundle/$nome" "$destinazione/$nome"
    fi

    if [ "$diverso" = si ]; then
        giallo "  aggiornato $nome"
        aggiornati=$((aggiornati + 1))
    else
        verde "  invariato  $nome"
        invariati=$((invariati + 1))
    fi
}

# I file d'ambiente: si creano solo se mancano, non si sovrascrivono mai.
ambiente() {
    local esempio="$1" reale="$2"
    if [ -f "$destinazione/$reale" ]; then
        verde "  conservato $reale (contiene i valori di questa macchina)"
        return
    fi
    cp "$bundle/$esempio" "$destinazione/$reale"
    chmod 600 "$destinazione/$reale"
    giallo "  creato     $reale dall'esempio — VA COMPILATO prima di distribuire"
    aggiornati=$((aggiornati + 1))
}

echo
echo "File del bundle"
copia compose.production.yaml
copia prepare-target.sh
copia install-bundle.sh
copia postgres-init
copia schemas
copia proxy-templates
copia README.md
copia release.env.example
copia istanta.env.example
copia correggo4.env.example

chmod +x "$destinazione/prepare-target.sh" "$destinazione/install-bundle.sh" 2>/dev/null

echo
echo "File d'ambiente"
ambiente release.env.example   release.env
ambiente istanta.env.example   istanta.env
ambiente correggo4.env.example correggo4.env

echo
if [ "$errori" -gt 0 ]; then
    rosso "$errori file mancanti nel bundle: la copia è incompleta."
    exit 1
fi

if [ "$aggiornati" -eq 0 ]; then
    verde "Già allineato: nessun file era diverso."
else
    giallo "$aggiornati file aggiornati, $invariati già allineati."
fi

echo
echo "Ora conviene rilanciare la preparazione, che crea le directory che il"
echo "compose si aspetta e verifica che non manchi nulla:"
echo
echo "  sudo ./prepare-target.sh"
echo
echo "Poi, se il compose è cambiato, i container vanno RICREATI e non riavviati:"
echo "  sudo env DOCKER_CONFIG=/opt/company-ai/runner/docker-config \\"
echo "    docker compose --env-file release.env -f compose.production.yaml \\"
echo "    up -d --force-recreate istanta correggo4"
echo
