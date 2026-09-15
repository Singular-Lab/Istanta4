#!/usr/bin/env bash
#
# monta-cliente.sh - monta su QUESTA macchina i file del cliente scelto.
#
# Perche esiste: Istanta serve N clienti con un solo codice, e la scelta del
# cliente vive in file che su ogni postazione sono diversi. Quei file NON sono
# in git (vedi .gitignore), altrimenti il cliente montato da uno comparirebbe
# nei diff di tutti. Le fonti sono gli archivi, quelli si che stanno in git:
#
#   Istanta/wwwroot/js/<cartellaJs>/agenzia.js  ->  Istanta/wwwroot/js/agenzia.js
#   plugin/Agenzie/<Cliente>/custom.js          ->  plugin/custom.js
#
# A runtime viene caricato SOLO il file in radice: il front-end web legge
# js/agenzia.js e il plugin fa require('./custom'). Le cartelle per cliente
# non le legge nessuno, sono l'archivio.
#
# Uso:
#   ./monta-cliente.sh Edro21
#   ./monta-cliente.sh Edro21 --forza     (sovrascrive anche se la radice e' diversa dall'archivio)
#
set -euo pipefail
cd "$(dirname "$0")"

CLIENTE=""
FORZA=0
for a in "$@"; do
    case "$a" in
        --forza|-f) FORZA=1 ;;
        -*)         CLIENTE="" ;;
        *)          CLIENTE="$a" ;;
    esac
done

# La mappa dei nomi. Serve perche i tre mondi non usano la stessa grafia:
# il cliente si chiama Coopfi in AgenziaLib e nel plugin, ma la sua cartella
# javascript si chiama "coop". Ogni riga: cliente, cartella js, cartella plugin
# (vuota se quel cliente non ha un archivio nel plugin).
case "$CLIENTE" in
    Edro21) JS=edro21; PLG=Edro21 ;;
    Coopfi) JS=coop;   PLG=Coopfi ;;
    Pac)    JS=pac;    PLG=Pac    ;;
    Trea)   JS=trea;   PLG=Trea   ;;
    Famila) JS=famila; PLG=""     ;;
    Gross)  JS=gross;  PLG=""     ;;
    *)
        echo "Uso: $0 <Cliente> [--forza]"
        echo "Clienti: Edro21 Coopfi Pac Trea Famila Gross"
        exit 1
        ;;
esac

SUFFISSO=$(echo "$CLIENTE" | tr 'A-Z' 'a-z')

# Copia un file d'archivio in radice.
# Se la radice esiste ed e' DIVERSA dall'archivio si ferma: quasi sempre vuol
# dire che la radice ha ricevuto una correzione che nessuno ha riportato
# nell'archivio, e sovrascriverla la perderebbe per sempre (la radice non e'
# in git, quindi non si recupera). Con --forza si sovrascrive lo stesso.
monta() {
    local archivio="$1" radice="$2"
    if [ ! -f "$archivio" ]; then
        echo "  MANCA l'archivio $archivio"
        return 1
    fi
    if [ -f "$radice" ] && ! cmp -s "$archivio" "$radice"; then
        if [ "$FORZA" -eq 0 ]; then
            echo "  FERMO: $radice e' diverso da $archivio."
            echo "         Se la radice ha correzioni, riportale prima nell'archivio:"
            echo "         cp $radice $archivio"
            echo "         Altrimenti rilancia con --forza."
            return 1
        fi
        echo "  sovrascrivo $radice (era diverso)"
    fi
    cp "$archivio" "$radice"
    echo "  ok $radice  <-  $archivio"
}

echo "Monto $CLIENTE"
esito=0

monta "Istanta/wwwroot/js/$JS/agenzia.js" "Istanta/wwwroot/js/agenzia.js" || esito=1

if [ -n "$PLG" ]; then
    monta "plugin/Agenzie/$PLG/custom.js" "plugin/custom.js" || esito=1
else
    echo "  $CLIENTE non ha un archivio nel plugin: plugin/custom.js lasciato com'e'"
fi

# Il profilo di avvio di Visual Studio. Contiene ISTANTA_CLIENTE, che e' la
# variabile letta da Program.cs per sapere quale appsettings.<cliente>.json
# sovrapporre. Anche questo file e' per macchina e non sta in git: il modello
# tracciato e' launchSettings.template.json, con il segnaposto __CLIENTE__.
LS="Istanta/Properties/launchSettings.json"
LST="Istanta/Properties/launchSettings.template.json"
if [ "$esito" -ne 0 ]; then
    # Se la copia dei file si e' fermata, il cliente NON e' montato: scrivere qui
    # il suo nome lascerebbe la macchina a meta', con il server su un cliente e i
    # file di un altro, che e' la situazione piu' difficile da diagnosticare.
    echo "  salto $LS: il montaggio non e' andato a buon fine"
elif [ ! -f "$LS" ]; then
    if [ -f "$LST" ]; then
        sed "s/__CLIENTE__/$SUFFISSO/" "$LST" > "$LS"
        echo "  ok $LS creato dal modello, ISTANTA_CLIENTE=$SUFFISSO"
    else
        echo "  MANCA $LST, non posso creare $LS"
        esito=1
    fi
elif grep -q ISTANTA_CLIENTE "$LS"; then
    # Si riscrive solo il valore, per non buttare via le altre impostazioni
    # (url, profili aggiuntivi) che ognuno puo' essersi messo.
    # Niente sed -i: su macOS vuole un argomento in piu' e la riga non sarebbe portabile.
    sed 's/\("ISTANTA_CLIENTE"[[:space:]]*:[[:space:]]*"\)[^"]*"/\1'"$SUFFISSO"'"/' "$LS" > "$LS.nuovo"
    mv "$LS.nuovo" "$LS"
    echo "  ok $LS aggiornato, ISTANTA_CLIENTE=$SUFFISSO"
else
    echo "  ATTENZIONE: $LS non contiene ISTANTA_CLIENTE."
    echo "              Aggiungilo in environmentVariables, oppure cancella il file e rilancia."
    esito=1
fi

# Quello che lo script NON puo' fare al posto tuo, perche' sono file locali
# che contengono indirizzi e password: si controlla solo che ci siano.
echo
echo "Da controllare a mano:"
for f in "Istanta/appsettings.$SUFFISSO.json" "plugin/ipconfig.json"; do
    [ -f "$f" ] && echo "  c'e'    $f" || echo "  MANCA   $f"
done
for d in "Istanta/wwwroot/external_source/$CLIENTE" "Istanta/wwwroot/ficoContexts/$CLIENTE"; do
    [ -d "$d" ] && echo "  c'e'    $d/" || echo "  MANCA   $d/"
done

echo
echo "ISTANTA_CLIENTE=$SUFFISSO e' impostata nel profilo di avvio di Visual Studio."
echo "Se lanci da terminale o da un altro IDE, impostala li':"
echo "  export ISTANTA_CLIENTE=$SUFFISSO"

exit $esito
