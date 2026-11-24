#
# monta-cliente.ps1 - monta su QUESTA macchina i file del cliente scelto. Versione Windows.
#
# TASK-d5f2adb8: e' la traduzione in PowerShell di monta-cliente.sh, con la stessa logica, gli
# stessi messaggi e gli stessi codici di uscita. Se cambi uno dei due script, cambia anche
# l'altro: tests/plugin/configurazioneCliente.test.js li prova tutti e due con gli stessi casi.
# Il perche' di ogni passo e' spiegato nei commenti di monta-cliente.sh.
#
# Funziona con Windows PowerShell 5.1 e con pwsh. I file si scrivono in UTF-8 senza BOM, come
# li scrive bash, cosi' clienteAttivo.json e launchSettings.json sono identici sui due sistemi.
#
# Uso:
#   .\monta-cliente.ps1 Edro21
#   monta-cliente Edro21          (da cmd, con monta-cliente.cmd, senza fermarsi sull'execution policy)
#
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
[Environment]::CurrentDirectory = $PSScriptRoot

$Utf8SenzaBom = New-Object System.Text.UTF8Encoding($false)

function Scrivi([string]$testo) { [Console]::Out.WriteLine($testo) }
function Leggi-Testo([string]$percorso) { [IO.File]::ReadAllText((Join-Path $PSScriptRoot $percorso)) }
function Salva-Testo([string]$percorso, [string]$testo) { [IO.File]::WriteAllText((Join-Path $PSScriptRoot $percorso), $testo, $Utf8SenzaBom) }
function Esiste-File([string]$percorso) { Test-Path -LiteralPath $percorso -PathType Leaf }
function Esiste-Cartella([string]$percorso) { Test-Path -LiteralPath $percorso -PathType Container }

$CLIENTE = ""
foreach ($a in $args) {
    $a = [string]$a
    if ($a -ceq '--forza' -or $a -ceq '-f') {
        # I20-1064: --forza serviva a sovrascrivere plugin/custom.js, che non si copia piu'.
        Scrivi "--forza non serve piu': il plugin non copia niente in radice (I20-1064)."
    }
    elseif ($a.StartsWith('-')) { $CLIENTE = "" }
    else { $CLIENTE = $a }
}

# La mappa dei nomi, che riguarda il solo plugin: vuota se quel cliente non ha un archivio li'.
switch -CaseSensitive ($CLIENTE) {
    'Edro21' { $PLG = 'Edro21' }
    'Coopfi' { $PLG = 'Coopfi' }
    'Famila' { $PLG = 'Famila' }
    'Gross'  { $PLG = '' }
    default {
        Scrivi "Uso: $($MyInvocation.MyCommand.Name) <Cliente>"
        Scrivi "Clienti: Edro21 Coopfi Famila Gross"
        exit 1
    }
}

$SUFFISSO = $CLIENTE.ToLowerInvariant()

# I20-1064: il plugin del cliente. Non si copia niente: si controlla l'archivio, si crea
# l'ipconfig dal modello se manca e si scrive plugin/clienteAttivo.json. I vecchi file in
# radice non si toccano: si dice solo che non servono piu'. Restituisce $true se e' andata.
function Monta-Plugin([string]$nome) {
    $cartella = "plugin/Agenzie/$nome"
    $custom = "$cartella/custom.js"
    $ipconfig = "$cartella/ipconfig.json"
    $modello = "plugin/Agenzie/ipconfig.template.json"
    $puntatore = "plugin/clienteAttivo.json"

    if (-not (Esiste-File $custom)) {
        Scrivi "  MANCA l'archivio $custom"
        return $false
    }

    if (-not (Esiste-File $ipconfig)) {
        if (-not (Esiste-File $modello)) {
            Scrivi "  MANCA $modello, non posso creare $ipconfig"
            return $false
        }
        # come sed "s/__CLIENTE__/<nome>/": la prima occorrenza di ogni riga, fine riga invariati
        $testo = [regex]::Replace((Leggi-Testo $modello), '(?m)^(.*?)__CLIENTE__', { param($m) $m.Groups[1].Value + $nome })
        Salva-Testo $ipconfig $testo
        Scrivi "  ok $ipconfig creato dal modello: SCRIVI GLI INDIRIZZI prima di avviare il plugin"
    }
    elseif ((Leggi-Testo $ipconfig) -notmatch '"custom"\s*:') {
        Scrivi "  FERMO: $ipconfig non ha la voce `"custom`"."
        Scrivi "         Aggiungi `"custom`": `"Agenzie/$nome/custom.js`", come in $modello."
        return $false
    }

    Salva-Testo $puntatore ("{ `"ipconfig`": `"Agenzie/$nome/ipconfig.json`" }`n")
    Scrivi "  ok $puntatore  ->  Agenzie/$nome/ipconfig.json"

    if (Esiste-File "plugin/custom.js") {
        $vecchio = [IO.File]::ReadAllBytes((Join-Path $PSScriptRoot "plugin/custom.js"))
        $archivio = [IO.File]::ReadAllBytes((Join-Path $PSScriptRoot $custom))
        if ([Convert]::ToBase64String($vecchio) -ceq [Convert]::ToBase64String($archivio)) {
            Scrivi "  plugin/custom.js non e' piu' usato ed e' uguale all'archivio: puoi cancellarlo."
        }
        else {
            Scrivi "  ATTENZIONE: plugin/custom.js non e' piu' usato ed e' DIVERSO da $custom."
            Scrivi "              Se contiene correzioni, riportale nell'archivio del suo cliente; poi cancellalo."
        }
    }
    if (Esiste-File "plugin/ipconfig.json") {
        Scrivi "  plugin/ipconfig.json non e' piu' usato: se i suoi indirizzi sono di $CLIENTE"
        Scrivi "  e non li hai ancora riportati in $ipconfig, copiali li'; poi cancellalo."
    }
    return $true
}

Scrivi "Monto $CLIENTE"
$esito = 0

if ($PLG -ne '') {
    if (-not (Monta-Plugin $PLG)) { $esito = 1 }
}
else {
    Scrivi "  $CLIENTE non ha un archivio nel plugin: plugin/clienteAttivo.json lasciato com'e'"
}

# Il profilo di avvio di Visual Studio, con ISTANTA_CLIENTE. Per macchina, fuori da git: il
# modello tracciato e' launchSettings.template.json, con il segnaposto __CLIENTE__.
$LS = "Istanta/Properties/launchSettings.json"
$LST = "Istanta/Properties/launchSettings.template.json"
if ($esito -ne 0) {
    Scrivi "  salto ${LS}: il montaggio non e' andato a buon fine"
}
elseif (-not (Esiste-File $LS)) {
    if (Esiste-File $LST) {
        $testo = [regex]::Replace((Leggi-Testo $LST), '(?m)^(.*?)__CLIENTE__', { param($m) $m.Groups[1].Value + $SUFFISSO })
        Salva-Testo $LS $testo
        Scrivi "  ok $LS creato dal modello, ISTANTA_CLIENTE=$SUFFISSO"
    }
    else {
        Scrivi "  MANCA $LST, non posso creare $LS"
        $esito = 1
    }
}
elseif ((Leggi-Testo $LS) -cmatch 'ISTANTA_CLIENTE') {
    # Si riscrive solo il valore, per non buttare via le altre impostazioni.
    $testo = [regex]::Replace((Leggi-Testo $LS), '("ISTANTA_CLIENTE"\s*:\s*")[^"]*"', { param($m) $m.Groups[1].Value + $SUFFISSO + '"' })
    Salva-Testo $LS $testo
    Scrivi "  ok $LS aggiornato, ISTANTA_CLIENTE=$SUFFISSO"
}
else {
    Scrivi "  ATTENZIONE: $LS non contiene ISTANTA_CLIENTE."
    Scrivi "              Aggiungilo in environmentVariables, oppure cancella il file e rilancia."
    $esito = 1
}

# Quello che lo script NON puo' fare al posto tuo: file locali con indirizzi e password.
Scrivi ""
Scrivi "Da controllare a mano:"
$daControllare = @("Istanta/appsettings.$SUFFISSO.json")
if ($PLG -ne '') { $daControllare += "plugin/Agenzie/$PLG/ipconfig.json" }
foreach ($f in $daControllare) {
    if (Esiste-File $f) { Scrivi "  c'e'    $f" } else { Scrivi "  MANCA   $f" }
}
foreach ($d in @("Istanta/wwwroot/external_source/$CLIENTE", "Istanta/wwwroot/ficoContexts/$CLIENTE")) {
    if (Esiste-Cartella $d) { Scrivi "  c'e'    $d/" } else { Scrivi "  MANCA   $d/" }
}

# La classe del cliente dentro AgenziaLib.dll: la dll si legge dal disco per riflessione e
# dotnet publish NON la aggiorna. Si confronta la data con l'ultimo sorgente modificato.
$DLL = "Istanta/wwwroot/external_lib/AgenziaLib.dll"
if (-not (Esiste-File $DLL)) {
    Scrivi "  MANCA   $DLL"
    $esito = 1
}
else {
    $piuRecente = $null
    if (Esiste-Cartella "AgenziaLib") {
        $piuRecente = Get-ChildItem -Path "AgenziaLib" -Filter *.cs -File | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    }
    if ($piuRecente -and $piuRecente.LastWriteTimeUtc -gt (Get-Item -LiteralPath $DLL).LastWriteTimeUtc) {
        $sorgente = "AgenziaLib/$($piuRecente.Name)"
        Scrivi "  ATTENZIONE: $DLL e' piu' vecchia di $sorgente."
        Scrivi "              La dll si carica dal disco per riflessione e dotnet publish NON la aggiorna."
        Scrivi "              Ricompila e ricopia a mano:"
        Scrivi "                dotnet build AgenziaLib/AgenziaLib.csproj -c Debug"
        Scrivi "                Copy-Item AgenziaLib/bin/Debug/net10.0/AgenziaLib.dll $DLL"
        $esito = 1
    }
    else {
        Scrivi "  c'e'    $DLL, piu' recente dei sorgenti di AgenziaLib"
    }
}

Scrivi ""
Scrivi "ISTANTA_CLIENTE=$SUFFISSO e' impostata nel profilo di avvio di Visual Studio."
Scrivi "Se lanci da terminale o da un altro IDE, impostala li':"
Scrivi "  `$env:ISTANTA_CLIENTE = `"$SUFFISSO`""

exit $esito
