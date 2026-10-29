# Primo avvio ambiente di test

Guida per avviare `docker-compose.test.yml` senza errori.

Il compose avvia l'app in modalità produzione con `NODE_ENV=test` (senza HTTPS), Redis e lo stack di
osservabilità (Prometheus, Loki, Promtail, Grafana). **PostgreSQL non è nel compose**: gira sull'host e il
container dell'app lo raggiunge tramite `host.docker.internal`.

---

## Prerequisiti sull'host

| Servizio   | Requisito |
|------------|-----------|
| Docker     | Engine attivo. |
| PostgreSQL | In esecuzione sull'host e raggiungibile dai container: `host.docker.internal` punta al gateway della rete Docker, non a `127.0.0.1`, quindi PostgreSQL deve ascoltare anche su quell'interfaccia e `pg_hba.conf` deve ammettere la rete Docker. |
| Database   | Il database `DB_POSTGRESQL_NAME` deve esistere. Le estensioni `postgis` e `uuid-ossp` le crea la prima migrazione, se l'utente ne ha il permesso; altrimenti va fatto prima da un superuser. |
| `config/`  | La cartella `config/` del progetto viene montata in `/app/config` (vedi "La cartella `config/`" nel README). |

---

## Variabili `.env` obbligatorie

Il container legge il `.env` del progetto (`env_file`): servono tutte le variabili obbligatorie dello schema
in `server/core/config/index.ts`. Per questo ambiente contano in particolare:

```bash
# URL con cui si apre l'app nel browser, con http:// (nessun TLS in questo ambiente).
# CORS e Content-Security-Policy lo usano; con NODE_ENV=test il cookie di sessione non e' mai secure.
CLIENT_URL="http://<IP>:<NODE_PORT>"

# Fissate nel bundle Vite durante la build dell'immagine (build args)
VITE_API_URL="http://<IP>:<NODE_PORT>/api"
VITE_WS_URL="http://<IP>:<WS_PORT>"

# Porta di PostgreSQL sull'host (default 5432)
DB_POSTGRESQL_PORT=5432
DB_POSTGRESQL_HOST=localhost    # ignorato in Docker: il compose lo sostituisce con host.docker.internal

# Nome progetto Docker (isola volumi e rete)
COMPOSE_PROJECT_NAME=fidelity-coopfi-test   # usa un nome diverso da prod per non collidere
```

---

## Porte host default (modificabili nel `.env`)

| Variabile                | Default | Servizio        |
|--------------------------|---------|-----------------|
| `NODE_PORT`              | 3010    | App HTTP        |
| `WS_PORT`                | 3400    | WebSocket       |
| `DOCKER_PROMETHEUS_PORT` | 9091    | Prometheus      |
| `DOCKER_GRAFANA_PORT`    | 3002    | Grafana         |
| `DOCKER_LOKI_PORT`       | 3101    | Loki            |

PostgreSQL non ha una porta nel compose: è quella dell'host, `DB_POSTGRESQL_PORT`.
Grafana usa `GRAFANA_ADMIN_USER` e `GRAFANA_ADMIN_PASSWORD`, che in test valgono `admin`/`admin` se non impostate.

> Se una porta è già occupata sul host, aggiungila al `.env` con un valore libero.

---

## Sequenza di avvio

```bash
# Primo avvio (o dopo docker:test:prune): costruisce l'immagine
yarn docker:test:up

# Lo stesso, in background
yarn docker:test:up:detach

# Avvii successivi (immagine già costruita)
docker compose -f docker-compose.test.yml up -d
```

---

## Cosa succede all'avvio

1. L'entrypoint (`docker/server-entrypoint.prod.sh`) esegue `server/core/scripts/initializeModels.ts sync`,
   cioè `yarn models:sync`: applica le migrazioni pendenti di `server/core/db/migrazioni`, con lo stesso
   lock e lo stesso storico del server, e rispetta `MIGRAZIONI_APPLICA_ALL_AVVIO`. Il messaggio
   "Sincronizzo i modelli (alter: true)" è rimasto dalla vecchia sincronizzazione: lo schema non si
   sincronizza più con `alter`.
2. Il server parte: il processo primary applica le eventuali migrazioni rimaste, prepara accessi e
   configurazione, avvia il WebSocket e solo dopo crea i worker HTTP. Job pianificati e coda WhatsApp
   girano nel worker 1, quindi trovano già tutte le tabelle.
3. Il controllo di salute del container chiama `/health` ogni 30 secondi (i fallimenti dei primi 90
   non contano); l'endpoint risponde 503 finché PostgreSQL non è raggiungibile.

### Messaggi dell'entrypoint

```
[entrypoint] Sync completato.
```
Migrazioni applicate, o nessuna da applicare. È l'esito normale.

```
[entrypoint] Sync completato con warning — il server parte comunque.
```
**Non è normale**: il comando delle migrazioni è terminato con errore e lo schema non è stato aggiornato.
La causa è nelle righe precedenti (`Errore durante le migrazioni`): database non raggiungibile, una
migrazione fallita, un file già applicato modificato (checksum), modelli che non corrispondono
all'ultima migrazione. Il server ripete le migrazioni all'avvio e, se l'errore resta, si ferma; il
container allora riparte in ciclo (`restart: unless-stopped`). Va corretta la causa, non ignorato l'avviso.

### Errori `42P01` nei log

```
ERROR: relation "nome_tabella" does not exist
```

Non sono più attesi al primo avvio: le tabelle esistono prima che partano worker e job. Se compaiono, le
migrazioni non sono state applicate (vedi l'avviso sopra, oppure `MIGRAZIONI_APPLICA_ALL_AVVIO=false`
nel `.env`). Lo stato si controlla con `yarn migrazioni:stato` dall'host, con lo stesso `.env`.

---

## Caricare un dump nel DB di test

PostgreSQL sta sull'host, quindi il dump si ripristina lì, non in un container.

### 1. Esportare il database sorgente

```bash
yarn db:export
```

Esegue `pg_dump` in un container `postgis/postgis` con le variabili `DB_POSTGRESQL_*` del `.env` e scrive
`docker/data/fidelity-dump.dump`. Il messaggio finale del comando ("npm run dev:docker", ripristino
automatico al primo avvio di postgres) non vale più: nessun compose avvia PostgreSQL, e gli script di
`docker/postgres-init/` non vengono eseguiti.

In alternativa, con `pg_dump` installato sull'host:

```bash
export $(grep "DB_POSTGRESQL_PASSWORD" .env | tr -d '"')
PGPASSWORD=$DB_POSTGRESQL_PASSWORD pg_dump \
  -h 127.0.0.1 -p <PORTA_SORGENTE> \
  -U <UTENTE> -d <DB_SORGENTE> \
  --no-owner --no-privileges --format=custom \
  -f docker/data/fidelity-dump.dump
```

### 2. Ripristinarlo nel database di test sull'host

```bash
createdb -h 127.0.0.1 -p <PORTA> -U <UTENTE> <DB_TEST>
pg_restore -h 127.0.0.1 -p <PORTA> -U <UTENTE> -d <DB_TEST> \
  --no-owner --no-privileges docker/data/fidelity-dump.dump
```

`<DB_TEST>` è il database indicato da `DB_POSTGRESQL_NAME` nel `.env` dell'ambiente di test.

### 3. Riavviare l'app

```bash
docker compose -f docker-compose.test.yml restart app
```

All'avvio le migrazioni portano il database alla versione dell'applicazione: un database con lo
storico applica solo le migrazioni mancanti, uno senza storico adotta la baseline (vedi "Migrazioni
dello schema" nel README).

---

## Comandi utili

```bash
# Log in tempo reale dell'app
yarn docker:test:logs

# Fermare tutto
yarn docker:test:down

# Fermare + eliminare volumi e immagini inutilizzate (Redis e Grafana; il database sull'host resta)
yarn docker:test:prune

# Rebuild solo dell'app (es. dopo modifiche al codice)
docker compose -f docker-compose.test.yml up -d --build --no-deps app
```

---

## Perché `VITE_API_URL` non va nel `.env` dell'immagine

Il file `.env` è escluso dal `.dockerignore`. Vite fissa le variabili `VITE_*` nel bundle
durante la build, quindi devono arrivare tramite build args (`build.args` nel compose).
Docker Compose legge il `.env` del progetto per l'interpolazione del compose YAML,
quindi `${VITE_API_URL}` nel `docker-compose.test.yml` viene risolto correttamente
e passato al Dockerfile come `ARG`.

**Non serve fare nulla di speciale**: basta che `VITE_API_URL` e `VITE_WS_URL`
siano nel `.env` e il meccanismo funziona da solo.
