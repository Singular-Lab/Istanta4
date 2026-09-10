# Backend Corporate Foundation

## Architettura target

Il progetto adotta una struttura a layer progressivi:

```
server/
  core/           ← codice legacy — non toccare salvo integrazioni minime
  src/
    shared/       ← utility condivise: logger, cache, queue, osservabilità, errori, http
    app/          ← bootstrap applicazione: routing di sistema, DI aggregata
    modules/      ← dominio business futuro (attualmente solo struttura)
```

## Docker dev — PostgreSQL-only

Il compose `docker-compose.dev.yml` include:

| Servizio    | Immagine              | Porta   |
|-------------|-----------------------|---------|
| server      | node:20-alpine        | 3010    |
| client      | node:20-alpine        | 3009    |
| postgres    | postgres:16-alpine    | 5432    |
| redis       | redis:7-alpine        | 6379    |
| prometheus  | prom/prometheus       | 9090    |
| grafana     | grafana/grafana       | 3001    |
| loki        | grafana/loki          | 3100    |
| promtail    | grafana/promtail      | —       |

**MongoDB non è incluso.** `MONGO_URL` e `MONGO_DB_NAME` sono stati resi opzionali nella config.

Per avviare:
```bash
cp .env.docker.example .env.docker
# Compilare le variabili replace_me
npm run dev:docker
```

## Redis

Redis è integrato come infrastruttura ma **non ancora usato nella business logic esistente**.

- `server/src/shared/cache/redis.client.ts` — client ioredis opzionale
- `server/src/shared/cache/cache.service.ts` — `get/set/del/remember` con fallback no-op
- `server/src/shared/queue/bullmq.client.ts` — factory queue BullMQ
- `server/src/shared/queue/queues.ts` — nomi queue (`whatsapp`, `webhooks`, `exports`, `emails`, `ai-content`)

Se `REDIS_URL` non è impostato, client e queue non crashano: restituiscono `null` e log di warning.

## Grafana stack

- **Prometheus** fa scrape di `/metrics` sul server ogni 15s
- **Loki** raccoglie i log JSON dai container via Promtail
- **Grafana** (admin/admin) è disponibile su `http://localhost:3001`

Datasource da aggiungere manualmente in Grafana:
- Prometheus: `http://prometheus:9090`
- Loki: `http://loki:3100`

## Endpoint di sistema

| Endpoint      | Descrizione                                      |
|---------------|--------------------------------------------------|
| `GET /health` | Status HTTP, PostgreSQL e Redis                  |
| `GET /metrics`| Metriche Prometheus (default + custom)           |

## Moduli futuri

I moduli sotto `server/src/modules/` sono directory vuote con README. Nessuna business logic è stata spostata. Ordine di migrazione suggerito:

1. **audit** — nessuna dipendenza esterna, facile da isolare
2. **tenants** — prerequisito per multi-tenancy nei moduli successivi
3. **webhooks** — integra BullMQ queue
4. **catalog** — ISTANTA integration
5. **promotions** — dominio centrale, farlo per ultimo
6. **whatsapp** — complessità media, dipende da queue
7. **tracking** — report, dipende da promotions
8. **menabo** — integrazione esterna, bassa priorità

## Rollback manuale

Vedere `docs/rollback-corporate-foundation.md`.
