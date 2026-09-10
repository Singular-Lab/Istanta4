#!/bin/sh

# Garantisce che node_modules sia pronto anche se il named volume era vuoto al primo avvio
echo "[entrypoint] Verifico node_modules..."
npm install --prefer-offline

echo "[entrypoint] Sincronizzo i modelli (alter: true)..."
# npm run models:sync \
#   && echo "[entrypoint] Sync completato." \
#   || echo "[entrypoint] Sync completato con warning — il server parte comunque."

echo "[entrypoint] Avvio server..."
exec npm run dev:server
