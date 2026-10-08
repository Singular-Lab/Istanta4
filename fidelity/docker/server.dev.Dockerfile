FROM node:26-slim

WORKDIR /app

# Manifest, lockfile e Yarn versionato prima del sorgente (cache layer).
# Yarn si invoca dal binario in .yarn/releases: l'immagine non deve averlo.
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases .yarn/releases
COPY server/package.json server/
COPY src/package.json src/

RUN node .yarn/releases/yarn-4.18.1.cjs install --immutable

COPY . .

RUN chmod +x docker/server-entrypoint.sh

EXPOSE 3010

CMD ["sh", "docker/server-entrypoint.sh"]
