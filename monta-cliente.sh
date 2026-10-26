#!/usr/bin/env bash
#
# monta-cliente.sh - monta su QUESTA macchina i file del cliente scelto.
#
# Perche esiste: Istanta serve N clienti con un solo codice, e la scelta del
# cliente vive in file che su ogni postazione sono diversi. Quei file NON sono
# in git (vedi .gitignore), altrimenti il cliente montato da uno comparirebbe
# nei diff di tutti.
#
# I20-1064: il plugin non usa piu' una copia di custom.js in radice. Lo script
# scrive plugin/clienteAttivo.json, che indica l'ipconfig del cliente:
#
#   plugin/clienteAttivo.json         { "ipconfig": "Agenzie/<Cliente>/ipconfig.json" }
#   plugin/Agenzie/<Cliente>/ipconfig.json   indirizzi + "custom": "Agenzie/<Cliente>/custom.js"
#
# e il plugin legge direttamente plugin/Agenzie/<Cliente>/custom.js, che e' in
# git: le correzioni si fanno li', non ci sono piu' copie da riallineare. Se
# l'ipconfig del cliente non c'e', lo crea da plugin/Agenzie/ipconfig.template.json
# e gli indirizzi vanno scritti a mano.
#
# I20-997: il front-end web NON passa piu' di qui. Lo script di agenzia lo serve
# il server, che legge Istanta/ScriptAgenzia/<cliente>/agenzia.js in base a
# ISTANTA_CLIENTE: niente copia in radice da tenere allineata, e si modifica
# direttamente l'archivio del proprio cliente.
#
# Uso:
#   ./monta-cliente.sh Edro21
#
set -euo pipefail
cd "$(dirname "$0")"

CLIENTE=""
for a in "$@"; do
    case "$a" in
        # I20-1064: --forza serviva a sovrascrivere plugin/custom.js, che non si copia piu'.
        --forza|-f) echo "--forza non serve piu': il plugin non copia niente in radice (I20-1064)." ;;
        -*)         CLIENTE="" ;;
        *)          CLIENTE="$a" ;;
    esac
done

# La mappa dei nomi, che ora riguarda il solo plugin: vuota se quel cliente non
# ha un archivio li'. La cartella javascript non compare piu', perche' il server
# la trova da se' da ISTANTA_CLIENTE, che e' il nome del cliente in minuscolo.
# Per questo la cartella "coop" e' stata rinominata "coopfi" (I20-997): era
# l'unica che non corrispondeva, e teneva in piedi una tabella da allineare.
case "$CLIENTE" in
    Edro21) PLG=Edro21 ;;
    Coopfi) PLG=Coopfi ;;
    Famila) PLG=Famila ;;
    Gross)  PLG=""     ;;
    *)
        echo "Uso: $0 <Cliente>"
        echo "Clienti: Edro21 Coopfi Famila Gross"
        exit 1
        ;;
esac

SUFFISSO=$(echo "$CLIENTE" | tr 'A-Z' 'a-z')

# I20-1064: il plugin del cliente. Non si copia niente: si controlla l'archivio,
# si crea l'ipconfig dal modello se manca e si scrive plugin/clienteAttivo.json.
# I file in radice di prima, plugin/custom.js e plugin/ipconfig.json, non si
# toccano: possono contenere correzioni o indirizzi che non stanno altrove, e
# cancellarli li perderebbe. Si dice solo che non servono piu'.
monta_plugin() {
    local cartella="plugin/Agenzie/$1"
    local custom="$cartella/custom.js"
    local ipconfig="$cartella/ipconfig.json"
    local modello="plugin/Agenzie/ipconfig.template.json"
    local puntatore="plugin/clienteAttivo.json"

    if [ ! -f "$custom" ]; then
        echo "  MANCA l'archivio $custom"
        return 1
    fi

    if [ ! -f "$ipconfig" ]; then
        if [ ! -f "$modello" ]; then
            echo "  MANCA $modello, non posso creare $ipconfig"
            return 1
        fi
        sed "s/__CLIENTE__/$1/" "$modello" > "$ipconfig"
        echo "  ok $ipconfig creato dal modello: SCRIVI GLI INDIRIZZI prima di avviare il plugin"
    elif ! grep -q '"custom"[[:space:]]*:' "$ipconfig"; then
        echo "  FERMO: $ipconfig non ha la voce \"custom\"."
        echo "         Aggiungi \"custom\": \"Agenzie/$1/custom.js\", come in $modello."
        return 1
    fi

    printf '{ "ipconfig": "Agenzie/%s/ipconfig.json" }\n' "$1" > "$puntatore"
    echo "  ok $puntatore  ->  Agenzie/$1/ipconfig.json"

    if [ -f "plugin/custom.js" ]; then
        if cmp -s "plugin/custom.js" "$custom"; then
            echo "  plugin/custom.js non e' piu' usato ed e' uguale all'archivio: puoi cancellarlo."
        else
            echo "  ATTENZIONE: plugin/custom.js non e' piu' usato ed e' DIVERSO da $custom."
            echo "              Se contiene correzioni, riportale nell'archivio del suo cliente; poi cancellalo."
        fi
    fi
    if [ -f "plugin/ipconfig.json" ]; then
        echo "  plugin/ipconfig.json non e' piu' usato: se i suoi indirizzi sono di $CLIENTE"
        echo "  e non li hai ancora riportati in $ipconfig, copiali li'; poi cancellalo."
    fi
}

echo "Monto $CLIENTE"
esito=0

if [ -n "$PLG" ]; then
    monta_plugin "$PLG" || esito=1
else
    echo "  $CLIENTE non ha un archivio nel plugin: plugin/clienteAttivo.json lasciato com'e'"
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
for f in "Istanta/appsettings.$SUFFISSO.json" ${PLG:+"plugin/Agenzie/$PLG/ipconfig.json"}; do
    [ -f "$f" ] && echo "  c'e'    $f" || echo "  MANCA   $f"
done
for d in "Istanta/wwwroot/external_source/$CLIENTE" "Istanta/wwwroot/ficoContexts/$CLIENTE"; do
    [ -d "$d" ] && echo "  c'e'    $d/" || echo "  MANCA   $d/"
done

# La classe del cliente dentro AgenziaLib.dll. E' il controllo che sfugge sempre:
# la dll viene letta dal disco per riflessione a ogni chiamata, e "dotnet publish"
# NON la aggiorna. Se e' un build precedente all'aggiunta del cliente, Istanta
# compila, parte, e si rompe solo al primo scaricamento della lista, con un errore
# che (prima della correzione in IstantaController) non diceva nemmeno quale classe
# mancasse. Meglio saperlo adesso.
DLL="Istanta/wwwroot/external_lib/AgenziaLib.dll"
if [ ! -f "$DLL" ]; then
    echo "  MANCA   $DLL"
    esito=1
else
    # Non si guarda DENTRO la dll: nei metadati .NET i nomi condividono il suffisso,
    # quindi un nome di classe puo' non comparire mai come stringa a se' (se c'e'
    # "areaFamila", "Famila" e' la sua coda) e qualunque grep darebbe una risposta
    # inventata. Si confronta invece la data: una dll piu' vecchia dell'ultimo
    # sorgente modificato e' stantia, ed e' esattamente il caso che fa danno.
    PIU_RECENTE=$(ls -t AgenziaLib/*.cs 2>/dev/null | head -1)
    if [ -n "$PIU_RECENTE" ] && [ "$PIU_RECENTE" -nt "$DLL" ]; then
        echo "  ATTENZIONE: $DLL e' piu' vecchia di $PIU_RECENTE."
        echo "              La dll si carica dal disco per riflessione e dotnet publish NON la aggiorna."
        echo "              Ricompila e ricopia a mano:"
        echo "                dotnet build AgenziaLib/AgenziaLib.csproj -c Debug"
        echo "                cp AgenziaLib/bin/Debug/net10.0/AgenziaLib.dll $DLL"
        esito=1
    else
        echo "  c'e'    $DLL, piu' recente dei sorgenti di AgenziaLib"
    fi
fi

echo
echo "ISTANTA_CLIENTE=$SUFFISSO e' impostata nel profilo di avvio di Visual Studio."
echo "Se lanci da terminale o da un altro IDE, impostala li':"
echo "  export ISTANTA_CLIENTE=$SUFFISSO"

exit $esito
