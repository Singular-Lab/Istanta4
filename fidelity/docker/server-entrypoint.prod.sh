#!/bin/sh
set -e

echo "[entrypoint] Sincronizzo i modelli (alter: true)..."
npm run models:sync \
  && echo "[entrypoint] Sync completato." \
  || echo "[entrypoint] Sync completato con warning — il server parte comunque."

echo "[entrypoint] Avvio server in modalità produzione..."
exec npm start
