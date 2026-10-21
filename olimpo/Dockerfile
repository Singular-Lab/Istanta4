# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build

WORKDIR /app
# Yarn si invoca dal binario versionato in .yarn/releases: l'immagine non deve
# avere ne' Yarn ne' Corepack. Aggiornando Yarn va aggiornato anche questo nome.
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases
RUN node .yarn/releases/yarn-4.18.1.cjs install --immutable

# ui/ e' un progetto a parte con il proprio yarn.lock (eredita .yarnrc.yml).
COPY ui/package.json ui/yarn.lock ./ui/
RUN cd ui && node ../.yarn/releases/yarn-4.18.1.cjs install --immutable

COPY . .
RUN node .yarn/releases/yarn-4.18.1.cjs build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

# Olimpo invokes these tools while processing PDF and image assets.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ghostscript \
        imagemagick \
        inkscape \
        poppler-utils \
        python3 \
        python3-pil \
    && rm -rf /var/lib/apt/lists/*

# Solo le dipendenze di produzione, alle versioni del lockfile.
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases
RUN node .yarn/releases/yarn-4.18.1.cjs workspaces focus --production \
    && node .yarn/releases/yarn-4.18.1.cjs cache clean --all

COPY --from=build /app/dist ./dist
COPY --from=build /app/private-ui ./private-ui
COPY ICC ./ICC
COPY nofoto.jpg Metadata.json contratto.json ./

RUN mkdir -p /app/uploads/FTP \
    && chown node:node /app/uploads /app/uploads/FTP /app/dist/src/logger

USER node
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
