# Rollback — Corporate Backend Foundation

## File creati (da rimuovere per rollback completo)

```
docker/server.dev.Dockerfile
docker/client.dev.Dockerfile
docker/observability/prometheus.yml
docker/observability/loki.yml
docker/observability/promtail.yml
docker-compose.dev.yml
.env.docker.example
server/src/shared/logger/logger.ts
server/src/shared/logger/request-logger.ts
server/src/shared/cache/redis.client.ts
server/src/shared/cache/cache.service.ts
server/src/shared/queue/bullmq.client.ts
server/src/shared/queue/queues.ts
server/src/shared/observability/metrics.ts
server/src/shared/observability/health.ts
server/src/shared/errors/app-error.ts
server/src/shared/errors/error-handler.ts
server/src/shared/http/response.ts
server/src/shared/http/pagination.ts
server/src/shared/security/rate-limit.middleware.ts
server/src/app/http/health.routes.ts
server/src/app/http/metrics.routes.ts
server/src/app/di/modules.ts
server/src/modules/audit/README.md
server/src/modules/webhooks/README.md
server/src/modules/whatsapp/README.md
server/src/modules/menabo/README.md
server/src/modules/tenants/README.md
server/src/modules/catalog/README.md
server/src/modules/promotions/README.md
server/src/modules/tracking/README.md
docs/backend-corporate-foundation.md
docs/rollback-corporate-foundation.md
```

## File modificati

| File | Modifica |
|------|----------|
| `server/core/config/index.ts` | `MONGO_URL` e `MONGO_DB_NAME` resi opzionali |
| `server/core/server.ts` | Aggiunti import e mount di `healthRouter`, `metricsRouter`, `metricsMiddleware` |
| `package.json` | Aggiunti script `dev:docker`, `docker:dev:down`, `docker:dev:logs` |
| `server/package.json` | Aggiunte dipendenze `bullmq`, `ioredis`, `prom-client` |

## Dipendenze aggiunte

- `bullmq` ^5.34.8 (in `server/package.json`)
- `ioredis` ^5.4.2 (in `server/package.json`)
- `prom-client` ^15.1.3 (in `server/package.json`)

## Comandi Git per rollback manuale

```bash
# Ripristinare i file modificati
git restore server/core/config/index.ts
git restore server/core/server.ts
git restore package.json
git restore server/package.json

# Rimuovere i file creati
git clean -fd docker/
git clean -fd server/src/
git clean -fd docs/
git clean -f docker-compose.dev.yml
git clean -f .env.docker.example
```

> **Nota:** eseguire `git clean` solo dopo aver verificato con `git clean -n` (dry-run) che i file da rimuovere siano solo quelli della foundation.
