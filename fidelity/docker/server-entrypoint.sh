#!/bin/sh

# Garantisce che node_modules sia pronto anche se il named volume era vuoto al primo avvio
echo "[entrypoint] Verifico node_modules..."
node .yarn/releases/yarn-4.18.1.cjs install

echo "[entrypoint] Sincronizzo i modelli (alter: true)..."
# node .yarn/releases/yarn-4.18.1.cjs models:sync \
#   && echo "[entrypoint] Sync completato." \
#   || echo "[entrypoint] Sync completato con warning — il server parte comunque."

echo "[entrypoint] Avvio server..."
exec node .yarn/releases/yarn-4.18.1.cjs dev:server
