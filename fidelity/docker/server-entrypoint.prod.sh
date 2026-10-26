#!/bin/sh
set -e

# Nessun package manager nell'immagine di runtime: tsx e' caricato come loader
# di node, come in ecosystem.config.cjs. Equivale a `yarn models:sync` e
# `yarn start`, e `exec` lascia a node i segnali di stop del container.

echo "[entrypoint] Sincronizzo i modelli (alter: true)..."
node --import tsx server/core/scripts/initializeModels.ts sync \
  && echo "[entrypoint] Sync completato." \
  || echo "[entrypoint] Sync completato con warning — il server parte comunque."

echo "[entrypoint] Avvio server in modalità produzione..."
exec node --import tsx server/index.ts
