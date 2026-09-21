FROM node:26-slim AS builder

WORKDIR /app

# Copia i package.json di tutti i workspace prima di installare le dipendenze (cache layer)
COPY package*.json ./
COPY server/package*.json ./server/
COPY src/package*.json ./src/

# Il repository storico non versiona package-lock.json: installa i workspace
# senza dipendere da un lockfile assente.
RUN npm install --install-strategy=hoisted --legacy-peer-deps --no-audit --no-fund

# Copia il sorgente completo per la build del client
COPY . .

# Variabili VITE_* bakate nel bundle a compile-time.
# Devono essere passate come build args (le .env sono escluse dal contesto Docker).
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Build del client (Vite -> dist/)
RUN npm run build

FROM node:26-slim AS runtime

WORKDIR /app

# Runtime minimale: copia solo cio che serve davvero
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/assets/images ./src/assets/images
# Letta a runtime da MongoDBConnector.ensureCollections() per la seed della
# configurazione WebPliant quando il database Mongo e' vuoto.
COPY --from=builder /app/on_start ./on_start
COPY --from=builder /app/docker/server-entrypoint.prod.sh ./docker/server-entrypoint.prod.sh

# Directory scrivibili dal runtime non-root:
# - /home/node/insegne (icone insegne)
# - /app/uploads/tmp (upload temporanei Multer)
# - /app/public/uploads/materiali_POP (materiali pubblicazioni)
# - /app/server/core/public/uploads/materiali_POP (compatibilità con path legacy)
# - /app/logs (LogService)
RUN mkdir -p /home/node/insegne /app/uploads/tmp /app/public/uploads/materiali_POP /app/server/core/public/uploads/materiali_POP /app/logs \
  && chown -R node:node /home/node/insegne /app/uploads /app/public/uploads /app/server/core/public/uploads /app/logs

RUN chmod +x docker/server-entrypoint.prod.sh

EXPOSE 3010 3400

CMD ["sh", "docker/server-entrypoint.prod.sh"]
