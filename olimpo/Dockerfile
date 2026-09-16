# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY ui/package.json ./ui/
RUN npm --prefix ui install --legacy-peer-deps --no-audit --no-fund

COPY . .
RUN npm run build

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

COPY package.json ./
RUN npm install --omit=dev --legacy-peer-deps --no-audit --no-fund \
    && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/private-ui ./private-ui
COPY ICC ./ICC
COPY nofoto.jpg Metadata.json contratto.json ./

RUN mkdir -p /app/uploads/FTP \
    && chown node:node /app/uploads /app/uploads/FTP /app/dist/src/logger

USER node
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
