# Primo avvio ambiente di test

Guida per avviare `docker-compose.test.yml` senza errori.

---

## Prerequisiti sul host

| Servizio | Requisito |
|----------|-----------|
| MongoDB  | Deve girare sul host alla porta `27017`. Il container non lo include — si connette via `host.docker.internal`. |
| Docker   | Engine attivo. |

---

## Variabili `.env` obbligatorie

```bash
# URL dell'app — DEVE iniziare con http:// (mai https://)
# Se inizia con https:// il cookie session diventa secure e il login non funziona senza TLS
CLIENT_URL="http://<IP>:<NODE_PORT>"

# Bakate nel bundle Vite a compile-time
VITE_API_URL="http://<IP>:<NODE_PORT>/api"
VITE_WS_URL="http://<IP>:<WS_PORT>"

# Porta PostgreSQL interna (usata dall'entrypoint)
DB_POSTGRESQL_PORT=5432
DB_POSTGRESQL_HOST=localhost    # ignorato in Docker (sovrascitto con "postgres")

# Nome progetto Docker (isola volumi e rete)
COMPOSE_PROJECT_NAME=fidelity-coopfi-test   # usa un nome diverso da prod per non collidere
```

---

## Porte host default (modificabili nel `.env`)

| Variabile              | Default | Servizio        |
|------------------------|---------|-----------------|
| `NODE_PORT`            | 3010    | App HTTP        |
| `WS_PORT`              | 3400    | WebSocket       |
| `DOCKER_POSTGRES_PORT` | 5434    | PostgreSQL      |
| `DOCKER_PROMETHEUS_PORT`| 9091   | Prometheus      |
| `DOCKER_GRAFANA_PORT`  | 3002    | Grafana         |
| `DOCKER_LOKI_PORT`     | 3101    | Loki            |

> Se una porta è già occupata sul host, aggiungila al `.env` con un valore libero.

---

## Sequenza di avvio

```bash
# Primo avvio (o dopo docker:test:prune)
docker compose -f docker-compose.test.yml up --build

# Avvii successivi (immagine già costruita)
docker compose -f docker-compose.test.yml up -d
```

---

## Comportamento normale al primo avvio

### Errori `42P01` nei log — NORMALI

```
ERROR: relation "nome_tabella" does not exist
```

Il DB è vuoto. L'entrypoint esegue `models:sync` che crea le tabelle, ma i background job
partono quasi contemporaneamente e possono loggare questi errori per qualche secondo.
Spariscono da soli una volta che le tabelle esistono.

### Warning nel sync — NORMALI

```
[entrypoint] Sync completato con warning — il server parte comunque.
```

Indica che alcune tabelle non esistevano ancora al momento del sync. Non blocca l'avvio.

---

## Caricare un dump nel DB di test

### Se il DB sorgente è sulla porta standard (5432)
```bash
npm run db:export
```

### Se il DB sorgente è su una porta diversa (es. 5433)
`npm run db:export` usa Docker internamente e non riesce a raggiungere il DB locale su porte
non standard. Usa direttamente `pg_dump` dell'host:

```bash
export $(grep "DB_POSTGRESQL_PASSWORD" .env | tr -d '"')
PGPASSWORD=$DB_POSTGRESQL_PASSWORD pg_dump \
  -h 127.0.0.1 -p <PORTA_SORGENTE> \
  -U $DB_POSTGRESQL_USER -d $DB_POSTGRESQL_NAME \
  --no-owner --no-privileges --format=custom \
  -f docker/data/fidelity-dump.dump
```

### Dopo aver messo il dump, resetta il volume postgres e riparti

> ⚠️ Gli init script (`docker-entrypoint-initdb.d`) girano solo con il volume vuoto.
> Se postgres è già partito in precedenza, bisogna resettare il volume.

```bash
docker compose -f docker-compose.test.yml stop app postgres
docker compose -f docker-compose.test.yml rm -f postgres
docker volume rm ${COMPOSE_PROJECT_NAME}_postgres_test_data
docker compose -f docker-compose.test.yml up -d
```

---

## Comandi utili

```bash
# Log in tempo reale
npm run docker:test:logs

# Fermare tutto
npm run docker:test:down

# Fermare + eliminare volumi (reset completo)
npm run docker:test:prune

# Rebuild solo dell'app (es. dopo modifiche al codice)
docker compose -f docker-compose.test.yml up -d --build --no-deps app
```

---

## Perché `VITE_API_URL` non va nel `.env` normale

Il file `.env` è escluso dal `.dockerignore`. Vite baka le variabili `VITE_*` nel bundle
a compile-time, quindi devono arrivare tramite build args (`build.args` nel compose).
Docker Compose legge il `.env` del progetto per l'interpolazione del compose YAML,
quindi `${VITE_API_URL}` nel `docker-compose.test.yml` viene risolto correttamente
e passato al Dockerfile come `ARG`.

**Non serve fare nulla di speciale**: basta che `VITE_API_URL` e `VITE_WS_URL`
siano nel `.env` e il meccanismo funziona da solo.
