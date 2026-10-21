FROM node:26-slim AS builder

WORKDIR /app

# Manifest, lockfile e Yarn versionato prima del sorgente (cache layer).
# Yarn si invoca dal binario in .yarn/releases: l'immagine non deve avere
# ne' Yarn ne' Corepack. Aggiornando Yarn va aggiornato anche questo nome.
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases
COPY server/package.json ./server/
COPY src/package.json ./src/

RUN node .yarn/releases/yarn-4.18.1.cjs install --immutable

# Copia il sorgente completo per la build del client
COPY . .

# Variabili VITE_* bakate nel bundle a compile-time.
# Devono essere passate come build args (le .env sono escluse dal contesto Docker).
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Build del client (Vite -> dist/)
RUN node .yarn/releases/yarn-4.18.1.cjs build

FROM node:26-slim AS runtime

WORKDIR /app

# Runtime minimale: copia solo cio che serve davvero. Il server parte con tsx
# diretto (vedi entrypoint): qui non serve un package manager ne' il lockfile.
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/docker/server-entrypoint.prod.sh ./docker/server-entrypoint.prod.sh

# Directory scrivibili dal runtime non-root:
# - /app/uploads/tmp (file caricati in attesa di elaborazione, vedi server/core/config/percorsi.ts)
# - /app/logs (LogService)
RUN mkdir -p /app/uploads/tmp /app/logs \
  && chown -R node:node /app/uploads /app/logs

RUN chmod +x docker/server-entrypoint.prod.sh

# L'immagine gira non-root anche se avviata senza il `user: node` del compose.
USER node

EXPOSE 3010 3400

CMD ["sh", "docker/server-entrypoint.prod.sh"]
