FROM node:26-slim

WORKDIR /app

# Manifest, lockfile e Yarn versionato prima del sorgente (cache layer).
# Yarn si invoca dal binario in .yarn/releases: l'immagine non deve averlo.
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases .yarn/releases
COPY src/package.json src/
COPY server/package.json server/

RUN node .yarn/releases/yarn-4.18.1.cjs install --immutable

COPY . .

EXPOSE 3009

CMD ["node", ".yarn/releases/yarn-4.18.1.cjs", "dev:client", "--host", "0.0.0.0"]
