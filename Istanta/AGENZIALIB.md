# Aggiornare soltanto AgenziaLib

Istanta legge la DLL da `external_paths:pathLib` ad ogni chiamata a
`execLibFunction`/`getParameterInfo`, usando `Assembly.Load(File.ReadAllBytes(...))`.
La directory del server `/srv/istanta/external_lib` viene montata in sola lettura
su `/app/external_lib`. Sostituendo atomicamente il file sul server, i successivi
caricamenti leggono la nuova DLL senza riavviare Istanta. Le operazioni gia in
corso possono terminare con la vecchia versione; non e una transazione globale
fra tutte le richieste. Questo intervento non modifica il loader applicativo.

## 1. Prima installazione del mount (una sola volta)

Questi comandi sono per il server Linux che esegue Docker, dalla radice del
checkout della suite. Usare il riferimento immutabile dell'immagine completa
dal suo manifest, non il tag `latest` per inizializzare una versione specifica.

```bash
export ISTANTA_IMAGE='ghcr.io/singular-lab/istanta4/istanta@sha256:DIGEST_REALE'
docker pull "$ISTANTA_IMAGE"
sudo install -d -m 0755 /srv/istanta/external_lib

# Estrae la DLL incorporata nell'immagine, senza avviare Istanta.
# Eseguire solo su una directory appena predisposta, senza una DLL gia attiva.
seed=$(docker create "$ISTANTA_IMAGE")
docker cp "$seed:/app/external_lib/AgenziaLib.dll" /tmp/AgenziaLib.initial.dll
docker rm "$seed"
sudo install -m 0644 /tmp/AgenziaLib.initial.dll /srv/istanta/external_lib/AgenziaLib.dll
```

Predisporre inoltre `/srv/istanta/istanta.env`, `/srv/istanta/appsettings.json` e
`/srv/istanta/data` con le configurazioni e i dati gia usati dall'installazione.
L'esempio Compose non avvia PostgreSQL o Redis: gli indirizzi configurati devono
essere raggiungibili dal container. Aggiungere la rete del deployment se tali
servizi sono in altri container. Se esiste gia una definizione Compose,
integrare in quella il mount di `external_lib`, mantenendo reti, porte, proxy,
nome del progetto Compose e volumi gia usati per log/chiavi di protezione.

Per un'installazione gestita dal nuovo file:

```bash
docker compose -f Istanta/compose.yml up -d
```

L'introduzione del mount richiede una ricreazione iniziale del container. Non
avviare un secondo container sulla porta di quello esistente: applicare la nuova
configurazione tramite il meccanismo che gia gestisce il deployment.
`ISTANTA_ROOT` puo cambiare la radice `/srv/istanta`; `ISTANTA_HTTP_PORT` la porta
host 8080. Il percorso interno `/app/external_lib/` resta invariato.
Montare l'intera directory, non il singolo file: la rinomina atomica deve essere
visibile attraverso il mount. Non sostituire la directory montata stessa.

## 2. Build quando cambia solo AgenziaLib

Dopo commit e push, avviare il workflow dedicato con gli stessi tre input:

```powershell
$sourceCommit = git rev-parse HEAD
gh workflow run agenzialib.yml --repo Singular-Lab/Istanta4 --ref main -f version=3.5.13 -f releaseID=12346 -f sourceSHA=$sourceCommit
```

`sourceSHA` deve identificare un commit realmente presente su GitHub con il nuovo
target Docker. Il workflow usa .NET 10 Linux e compila anche i progetti referenziati,
perche AgenziaLib dipende da Istanta che dipende da IstantaLib, ma esporta e
distribuisce **soltanto AgenziaLib.dll**. Non pubblica immagini e non contatta il
server di produzione. `version` e la versione di distribuzione nel manifest;
non riscrive gli attributi AssemblyVersion del progetto.

Per provare l'esportazione localmente dalla radice della suite:

```bash
docker build -f Istanta/Dockerfile --target agenzialib-export --output type=local,dest=artifacts/agenzialib .
```

## 3. Contratto server-to-server

Il workflow completo `istanta-docker.yml` conserva il manifest immagine esistente.
Il workflow `agenzialib.yml` pubblica due artifact, conservati per 7 giorni:

- `agenzialib-<releaseID>`: contiene `AgenziaLib.dll`.
- `release-manifest-<releaseID>`: contiene `release-manifest.json`.

Il manifest della DLL ha un contratto diverso da quello dell'immagine:

```json
{
  "schemaVersion": 1,
  "component": "AgenziaLib",
  "distribution": "dll",
  "releaseId": "12346",
  "version": "3.5.13",
  "sourceCommit": "<SHA Git completo>",
  "artifact": "agenzialib-12346",
  "artifactId": "<ID GitHub artifact, stringa>",
  "file": "AgenziaLib.dll",
  "sha256": "<64 caratteri esadecimali, checksum del file DLL>"
}
```

Il tuo Control Plane deve aggiungere la gestione di `distribution: dll`:

1. Attendere `status: completed` e `conclusion: success` della run avviata.
2. Scaricare il manifest di quella run e confrontare release, versione e SHA
   con la richiesta. Non cercare artifact solo per nome fra run diverse.
3. Scaricare l'artifact indicato da `artifactId`, estrarlo in una directory di
   staging esterna a quella montata. `sha256` riguarda la DLL, non lo ZIP GitHub.
4. Verificare la compatibilita con l'Istanta effettivamente in esecuzione.
5. Eseguire l'installazione sul server e registrare l'esito separatamente dalla
   build. `success` su GitHub significa artifact pronto, non DLL gia installata.

In caso di fallimento o cancellazione, leggere la conclusione della run. Il
manifest non viene creato se la build/upload DLL fallisce. Se l'upload del manifest
fallisce puo gia esistere l'artifact DLL: non installarlo da una run fallita.
Archiviare gli artifact nel proprio sistema se devono essere disponibili oltre
la scadenza GitHub di 7 giorni.

## 4. Installazione a caldo sul server Linux

Esempio dopo estrazione degli artifact in `/srv/istanta/releases/12346`.
Richiede Bash, coreutils, flock e jq sul server; usare un percorso di staging
controllato dal deployer e non scrivibile dall'applicazione.

```bash
release_dir=/srv/istanta/releases/12346
expected=$(jq -er '.sha256' "$release_dir/release-manifest.json")
sudo bash Istanta/deploy/install-agenzialib.sh \
  "$release_dir/AgenziaLib.dll" "$expected" /srv/istanta/external_lib
```

Lo script copia in un file temporaneo nella directory destinazione, controlla
il checksum, imposta i permessi di lettura e conserva la DLL corrente in
`.history/<sha256-precedente>.dll`. Solo dopo queste operazioni rinomina il
temporaneo in `AgenziaLib.dll`. Un lock serializza gli installatori che usano lo
stesso script; il server-to-server deve comunque coordinare aggiornamenti completi
e aggiornamenti DLL. Un checksum errato lascia intatta la DLL attiva.

Non servono `docker stop`, `restart`, `pull` o `compose up` per questo passaggio.
Verificare poi una funzione applicativa interessata e registrare il checksum
installato. Il solo checksum prova l'integrita del file, non la sua compatibilita.

Per tornare alla versione precedente usare lo stesso script indicando il backup
e il suo SHA-256 come checksum atteso; non occorre riavviare il container:

```bash
previous_sha='SHA256_REALE_DELLA_VERSIONE_PRECEDENTE'
sudo bash Istanta/deploy/install-agenzialib.sh \
  "/srv/istanta/external_lib/.history/$previous_sha.dll" \
  "$previous_sha" /srv/istanta/external_lib
```

## 5. Compatibilita e successive distribuzioni complete

La build della DLL non prova la compatibilita con l'applicazione gia avviata.
Prima di scegliere questo percorso confrontare il commit dell'immagine in uso
con `sourceSHA`: cambiamenti a Istanta, IstantaLib, firme dei metodi richiamati,
tipi scambiati, pacchetti o configurazione possono richiedere una distribuzione
completa. Non installare la DLL compilata contro contratti nuovi su un'app vecchia.
Anche i riferimenti NuGet con versioni variabili richiedono attenzione: stesso
sorgente non garantisce identica risoluzione delle dipendenze in build diverse.

Quando distribuisci una nuova immagine completa, il mount **continua a nascondere
la DLL incorporata**. Il deployer deve quindi riallineare esplicitamente anche
la DLL esterna alla versione scelta. Per aggiornamenti incompatibili, fermare
il vecchio container prima di sostituire la DLL e avviare quello nuovo; per
piu istanze/versioni usare directory dedicate, senza condividere una DLL
incompatibile con container ancora attivi. Un rollback completo deve ripristinare
sia immagine sia DLL compatibile. Ogni istanza con directory locale separata
richiede il proprio aggiornamento.

Il loader attuale non scarica esplicitamente le assembly caricate. Questo lavoro
abilita la distribuzione dei file; non introduce cache o AssemblyLoadContext
scaricabili e non elimina il possibile accumulo di memoria dopo molti caricamenti.
Le chiamate gia avviate non vengono annullate ne dal rilascio ne dal rollback.

Riferimenti Docker: [bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)
e [esportazione di file dalla build](https://docs.docker.com/build/building/export/).
