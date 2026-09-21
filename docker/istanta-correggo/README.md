# Deployment set `istanta-correggo`

Questa cartella contiene tutto ciò che serve per far girare **Istanta e
Correggo4** su una macchina target gestita da Company.AI.Runner. È materiale di
macchina, non di release: lo si copia una volta quando si prepara il target, e
da lì in poi non lo si tocca più. Gli aggiornamenti di versione li applica il
Runner riscrivendo le sole variabili immagine in `release.env`.

| File | A cosa serve |
| --- | --- |
| `compose.production.yaml` | I servizi. Lo esegue il Runner, non va lanciato a mano. |
| `release.env.example` | Variabili di sostituzione del compose. Il Runner ci scrive `ISTANTA_IMAGE` e `CORREGGO4_IMAGE`. |
| `istanta.env.example` | Ambiente aggiuntivo del container Istanta. |
| `correggo4.env.example` | Ambiente aggiuntivo del container Correggo4. |
| `postgres-init/` | Script eseguito al primo avvio di PostgreSQL: database di Correggo4 e applicazione degli schemi. |
| `proxy-templates/` | Configurazione di nginx: due origini TLS, una per applicazione. |
| `schemas/` | Gli schemi SQL applicati al primo avvio, una sottocartella per database. |

**Tutti i servizi sono in container.** Oltre alle due applicazioni ci sono:

- **PostgreSQL**, con un database e un ruolo per componente. `istanta` lo crea
  l'immagine leggendo `POSTGRES_DB`/`POSTGRES_USER`, `correggo4` lo crea lo
  script di init.
- **Redis**, che non è una scelta di comodo: la connection string
  `IstantaSession` alimenta `AddStackExchangeRedisCache` in `Istanta/Program.cs`,
  quindi è la cache di sessione, non un database SQL.
- **nginx**, che termina il TLS e dà a ciascuna applicazione la propria origine
  su due porte distinte. Porte separate invece di prefissi di percorso, perché
  un prefisso richiederebbe a ciascuna applicazione di sapere di vivere sotto un
  path base, e nessuna delle due è configurata per farlo.

Né PostgreSQL, né Redis, né nginx sono componenti della release: il ControlPlane
non li conosce e il Runner non li aggiorna.

## 1. Gli schemi

Nessuna delle due applicazioni crea il proprio schema all'avvio — non ci sono
migrazioni EF applicate a runtime. Gli schemi sono **già in questa cartella** e
vengono applicati al primo avvio di PostgreSQL:

```
schemas/istanta/01-istanta.sql   -> database di Istanta,   applicato come utente istanta
schemas/correggo4/01-schema.sql  -> database di Correggo4, applicato come utente correggo4
```

Risultato verificato: **25 tabelle** per Istanta, 21 per Correggo4, e le 25
corrispondono esattamente a quelle che i contesti EF mappano — nessuna in più,
nessuna in meno.

### `01-istanta.sql` è generato, non copiato

Istanta usa due contesti EF sulla stessa connection string
`IstandaConnectionDb`, entrambi codice vivo: `edro21_dbContext` (`Models`) mappa
11 tabelle, `Edro21_DbContext2` (`Models_2`) ne mappa 15. Tutte con `ToTable`
esplicito, quindi il nome fisico è sempre snake_case, con due sole eccezioni
volute: `AttivitaLog` → `AttivitaLogs` e `Attivitum` → `Attivita`.

I due file alla radice del repository, `pg-ctx1.sql` e `pg-ctx2.sql`, **non
riflettono più quel modello**: contengono 15 tabelle PascalCase residue della
convenzione precedente — `Promo`, `PromoLavorazioni`, `AddestramentoExcel`,
`MenaboPagine`, `Attivitum` e altre — verso cui nessun `ToTable` punta.
Applicarli così com'erano creava 40 tabelle, 15 delle quali morte.

`01-istanta.sql` è quindi composto tenendo solo le 25 tabelle mappate, ordinate
perché ogni genitore precede i suoi figli. Al DDL originale è stata applicata
**una** correzione: in `promo_importazioni` la chiave esterna riferiva
`"Attivitum" ("Id")`, cioè il nome dell'entità e una colonna PascalCase; ora
riferisce `"Attivita" (id)`, che è la tabella davvero mappata e la sua colonna
reale.

Esclusa anche `promo_lavorazioni_records_register`: il codice non la usa più —
compare solo come entità e come collezione di navigazione, in nessuna query — e
nei file sorgente esisteva comunque solo col vecchio nome PascalCase.

**Va rigenerato** se cambiano i `ToTable` dei contesti o i due file sorgente.
L'alternativa strutturale, che elimina il problema alla radice, è generare il
DDL direttamente dai contesti con `dotnet ef dbcontext script`: uno schema così
non può divergere dal codice.

## 2. Catalogo ControlPlane

Nella pagina Progetti, i componenti devono avere la variabile immagine allineata
al compose:

| Componente | `EnvironmentVariable` | Tipo |
| --- | --- | --- |
| `istanta` | `ISTANTA_IMAGE` | ContainerImage |
| `correggo` | `CORREGGO4_IMAGE` | ContainerImage |
| `agenzia-lib` | — | File |

`agenzia-lib` è un artifact di tipo File: il Runner lo scarica via ORAS e lo
installa in `WorkingDirectory/<DestinationPath>`. Configurate `DestinationPath`
come `external_lib/AgenziaLib.dll`, e fate combaciare `ISTANTA_EXTERNAL_LIB_DIR`
in `release.env` con quella stessa directory, che il compose monta in sola
lettura su `/app/external_lib`. Istanta rilegge la DLL a ogni chiamata, quindi
l'aggiornamento non richiede il riavvio del container.

## 3. Preparare il target

`/percorso/bundle` è la directory in cui hai copiato questa cartella sul target.

```bash
sudo mkdir -p /opt/company-ai/projects/istanta-correggo
cd /opt/company-ai/projects/istanta-correggo

sudo cp /percorso/bundle/compose.production.yaml .
sudo cp -r /percorso/bundle/postgres-init .
sudo cp -r /percorso/bundle/proxy-templates .
sudo cp -r /percorso/bundle/schemas .
sudo cp /percorso/bundle/release.env.example    release.env
sudo cp /percorso/bundle/istanta.env.example    istanta.env
sudo cp /percorso/bundle/correggo4.env.example  correggo4.env
sudo chmod 600 release.env istanta.env correggo4.env

# le directory che il compose monta: devono esistere PRIMA del primo avvio
sudo mkdir -p external_lib istanta-data proxy-certs
```

Gli schemi arrivano con il bundle e non vanno copiati a mano. Resta la
configurazione del cliente:

```bash
# appsettings.json del cliente, sul modello di Istanta/appsettings.famila.template.json
sudo cp appsettings.<cliente>.json istanta-appsettings.json
```

Nell'`appsettings.json` i percorsi vanno riscritti su `/data`, che è dove il
compose monta `ISTANTA_DATA_DIR`: `jpg_path_foto.path`, `sync_options.extractPath`
e simili. E gli indirizzi dei servizi della suite vanno espressi con i nomi dei
servizi, non con `127.0.0.1`: dentro un container il localhost è il container
stesso. `fico.correggoServerUrl` diventa `http://correggo4:8080`.

Il certificato del proxy, con l'indirizzo IP nel SAN — senza, i browser lo
rifiutano a prescindere:

```bash
cd proxy-certs
sudo openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout privkey.pem -out fullchain.pem \
  -subj "/CN=192.168.1.66" -addext "subjectAltName=IP:192.168.1.66"
sudo chmod 600 privkey.pem
cd ..
```

Infine compila `release.env`: password dei due database, e i percorsi assoluti,
che devono corrispondere alle directory appena create.

### Perché i percorsi sono assoluti

Il Runner esegue `docker compose` da dentro il proprio container, parlando con
il daemon dell'host. Un percorso relativo verrebbe risolto nella directory di
lavoro del Runner, `/deployments/istanta-correggo`, che sull'host non esiste:
Docker non segnala niente, crea una directory vuota e il container si ritrova
senza quei file. Per `postgres-init` il risultato sarebbe un database senza
schemi, con l'errore che compare molto più tardi.

### L'inizializzazione avviene una volta sola

Quando il volume `postgres_data` è vuoto. Due conseguenze:

- cambiare una password in `release.env` dopo il primo avvio non la cambia
  dentro il database: serve un `ALTER ROLE` nel container e poi riallineare il
  file;
- se lo script di init fallisce a metà, il volume resta inizializzato
  parzialmente e non viene rieseguito. Si riparte con `docker compose down -v`,
  che **cancella i dati**.

L'healthcheck di PostgreSQL controlla che entrambi i database abbiano tabelle,
non solo che il ruolo esista: un init interrotto a metà fa fallire il
deployment subito, invece di lasciare il guasto latente.

## 4. Configurare il Runner

In `/opt/company-ai/runner/compose.yaml`, sotto `environment` del servizio
`runner`:

```yaml
      Runner__Projects__istanta4__WorkingDirectory: /deployments/istanta-correggo
      Runner__Projects__istanta4__ComposeFile: compose.production.yaml
      Runner__Projects__istanta4__EnvironmentFile: release.env
      Runner__Projects__istanta4__Components__istanta__ComposeService: istanta
      Runner__Projects__istanta4__Components__correggo__ComposeService: correggo4
```

e, sotto `volumes`:

```yaml
      - ${ISTANTA_CORREGGO_DIR:?Set ISTANTA_CORREGGO_DIR in .env}:/deployments/istanta-correggo
```

In `/opt/company-ai/runner/.env`:

```properties
ISTANTA_CORREGGO_DIR=/opt/company-ai/projects/istanta-correggo
RUNNER_COMPOSE_WAIT_SECONDS=300
```

`agenzia-lib` non compare fra i `Components__`: è una dipendenza dichiarata nel
catalogo, e il ControlPlane la aggiunge da sé agli artifact assegnati al target.

## 5. Avviare e verificare

Il primo deployment si lancia dal ControlPlane. Il proxy invece si avvia una
volta a mano: dipende dalle applicazioni, non viceversa, quindi il deployment
selettivo del Runner non lo tocca.

```bash
cd /opt/company-ai/projects/istanta-correggo
docker compose --env-file release.env -f compose.production.yaml up -d proxy
```

Le verifiche che contano:

```bash
# l'init ha applicato gli schemi
docker logs istanta-correggo-postgres-1 2>&1 | grep "\[init\]"

# quante tabelle per database
docker exec istanta-correggo-postgres-1 psql -U istanta -d istanta   -tAc "select count(*) from pg_tables where schemaname='public'"
docker exec istanta-correggo-postgres-1 psql -U istanta -d correggo4 -tAc "select count(*) from pg_tables where schemaname='public'"

# AgenziaLib installata dal Runner
ls -l external_lib/

# stato di tutti i servizi
docker ps --filter name=istanta-correggo --format '{{.Names}}\t{{.Status}}'
```

Gli indirizzi sono `https://<host>:8443` per Istanta e `https://<host>:8444` per
Correggo4, con l'avviso del browser sul certificato autofirmato. Le porte 18080
e 18081 sono esposte solo su `127.0.0.1` dell'host, per diagnosi.

Nelle immagini .NET non ci sono `curl`, `wget` né `nc`: per interrogare
un'applicazione dall'interno si usa bash, che c'è.

```bash
docker exec istanta-correggo-istanta-1 bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080 && echo porta aperta'
```
