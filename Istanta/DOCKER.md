# Immagine Docker di Istanta

Eseguire dalla radice della suite (la directory che contiene `Istanta`,
`IstantaLib` e `AgenziaLib`):

```sh
docker build -f Istanta/Dockerfile -t istanta:local .
```

Il contesto deve essere la radice, non `./Istanta`. Il Dockerfile usa .NET 10
su Ubuntu Noble, pubblica Istanta e IstantaLib in Release e compila separatamente
AgenziaLib, caricata dinamicamente dall'applicazione. La DLL viene inclusa in
`/app/external_lib/`; `external_paths__pathLib` punta gia a questa directory.
Il percorso termina con `/` perche il codice concatena il nome della DLL.
Non si usa la solution, che contiene un percorso di AgenziaLib diverso da quello
presente in questo repository.

## Workflow GitHub Actions

Il workflow `.github/workflows/istanta-docker.yml` viene avviato con
`workflow_dispatch`, dall'interfaccia Actions oppure tramite API/CLI.
Richiede esattamente questi tre input stringa (nomi case-sensitive):

| Input | Utilizzo |
| --- | --- |
| `version` | Versione senza prefisso `v`, per esempio `3.5.12` oppure `3.5.12-rc.1`. |
| `releaseID` | ID del sistema chiamante, registrato nella label `company.ai.release.id`, nel manifest e nel riepilogo. |
| `sourceSHA` | SHA completo di 40 caratteri del commit da compilare; il checkout viene verificato prima della build. |

Il workflow pubblica `ghcr.io/singular-lab/istanta4/istanta:<version>` per
`linux/amd64`, usando `GITHUB_TOKEN` con permesso `packages: write`.
Il nome dell'immagine viene derivato dal repository in minuscolo.
Non servono credenziali aggiuntive per GHCR; se il package esiste gia, deve
consentire l'accesso in scrittura a questo repository nelle impostazioni Actions.
Una nuova esecuzione con la stessa versione aggiorna quel tag; il riepilogo
riporta anche il digest immutabile dell'immagine pubblicata.
Come in DEMO-PROJECT vengono pubblicati anche i tag `latest` e `sha-<sourceSHA>`.
Le pubblicazioni di Istanta condividono un gruppo di concorrenza per evitare
aggiornamenti simultanei di `latest`.

Esempio PowerShell, dopo commit e push dei file:

```powershell
$sourceCommit = git rev-parse HEAD
gh workflow run istanta-docker.yml --repo Singular-Lab/Istanta4 --ref main -f version=3.5.12 -f releaseID=12345 -f sourceSHA=$sourceCommit
```

Il workflow deve essere presente sul branch predefinito per ricevere il dispatch.
Come in DEMO-PROJECT, il dispatch deve usare `ref: main`.
Il commit `sourceSHA` deve essere gia su GitHub e contenere il Dockerfile con
le tre cartelle dei progetti. Il semplice push non avvia la pubblicazione.
`releaseID` accetta lettere, cifre, punti, trattini e underscore (1-128 caratteri).
Non crea una GitHub Release e non invia callback a servizi esterni.

### Manifest per il Control Plane

Dopo la pubblicazione viene generato `release-manifest.json`, caricato come
artifact `release-manifest-<releaseID>` con conservazione di 7 giorni.
Il formato JSON e identico a DEMO-PROJECT:

```json
{
  "releaseId": "12345",
  "version": "3.5.12",
  "image": "ghcr.io/singular-lab/istanta4/istanta",
  "digest": "sha256:<digest pubblicato>",
  "imageReference": "ghcr.io/singular-lab/istanta4/istanta@sha256:<digest pubblicato>",
  "sourceCommit": "<SHA completo del commit compilato>"
}
```

Il sistema server-to-server deve verificare la conclusione della specifica run
GitHub Actions. Dopo `completed` con `conclusion: success`, recupera l'artifact
di quella run e controlla `releaseId`, `version` e `sourceCommit` prima di usare
`imageReference`. Come in DEMO-PROJECT, il manifest descrive una pubblicazione
riuscita: non viene prodotto se validazione o build falliscono. Per fallimenti
e cancellazioni fa fede la conclusione della run, non l'assenza temporanea del
manifest. Un errore nell'upload rende la run fallita anche se l'immagine e gia
stata pubblicata; dopo 7 giorni l'artifact puo non essere piu disponibile.

Gli input restano `version`, `releaseID`, `sourceSHA` come richiesto per Istanta;
il chiamante deve usare questi nomi, non `release_id` e `source_sha` presenti
nel workflow DEMO-PROJECT. Il campo JSON del manifest si chiama `releaseId`.

Riferimenti: [input workflow_dispatch](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onworkflow_dispatchinputs)
e [build-push-action](https://github.com/docker/build-push-action).

## Avvio

Le configurazioni locali e gli output bin/obj sono esclusi dal contesto tramite
`Dockerfile.dockerignore`. Fornire la configurazione del cliente a runtime,
con percorsi Linux, ad esempio:

```sh
docker run -d --name istanta -p 8080:8080 \
  --env-file /srv/istanta/istanta.env \
  --mount type=bind,src=/srv/istanta/appsettings.json,dst=/app/appsettings.json,readonly \
  --mount type=bind,src=/srv/istanta/data,dst=/data \
  --mount type=bind,src=/srv/istanta/external_lib,dst=/app/external_lib,readonly \
  --mount type=volume,src=istanta-logs,dst=/app/logs \
  --mount type=volume,src=istanta-keys,dst=/home/app/.aspnet/DataProtection-Keys \
  istanta:local
```

Prima dell'avvio, inizializzare `external_lib` come descritto in
[AGENZIALIB.md](AGENZIALIB.md). E disponibile anche `Istanta/compose.yml`, con
lo stesso mount e immagine selezionata tramite `ISTANTA_IMAGE`.
La directory montata nasconde la DLL inclusa nell'immagine: deve contenere la
versione compatibile prima dell'avvio. Il workflow completo mantiene il proprio
manifest; il nuovo workflow `agenzialib.yml` serve solo per distribuire la DLL.

Il file env esterno al repository deve definire almeno le connessioni:

```dotenv
ConnectionStrings__IstandaConnectionDb=Host=postgres;Database=DATABASE;Username=UTENTE;Password=PASSWORD
ConnectionStrings__IstantaSession=redis:6379
```

PostgreSQL e Redis devono essere raggiungibili dal container: per servizi in
altri container collegarli alla stessa rete Docker con `--network`.
Configurare inoltre le opzioni del cliente, inclusi `external_paths:pathSource`,
`path_to_import:path`, `path_to_export:path`, percorsi foto e `fico`.
I dati montati devono essere leggibili e, dove necessario, scrivibili dall'utente
`app` (UID 1654). Il JSON montato deve essere leggibile da tale utente.
La porta interna HTTP e 8080; HTTPS e l'eventuale autenticazione OIDC richiedono
la configurazione del reverse proxy e dei relativi URL pubblici.

La compilazione non verifica le funzioni applicative contro database, file del
cliente e servizi esterni. Le funzioni che usano System.Drawing.Common richiedono
una verifica specifica su Linux; il Dockerfile non modifica il codice grafico.

## Verifiche eseguite

Immagine `istanta:local` costruita con Docker Linux. Verificate nell'immagine
le DLL Istanta, IstantaLib e AgenziaLib, l'assenza di `appsettings.json`,
l'esecuzione come utente `app` e la scrivibilita della directory dei log.
Anche la pubblicazione Release locale e riuscita. Non e stato verificato
l'avvio applicativo con la configurazione e i servizi del cliente.
Il restore segnala vulnerabilita nei pacchetti esistenti, tra cui
Magick.NET-Q8-AnyCPU 13.9.1; questa modifica non aggiorna le dipendenze.
