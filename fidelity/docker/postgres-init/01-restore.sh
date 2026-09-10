#!/bin/bash
# Eseguito dal container postgres SOLO al primo avvio (volume vuoto).
# Se trova il dump in /dump/fidelity-dump.dump, lo ripristina.
# Altrimenti lascia il DB vuoto: il server lo inizializzerà via models:sync.
set -e

DUMP="/dump/fidelity-dump.dump"

if [ ! -f "$DUMP" ]; then
  echo "[postgres-init] Nessun dump trovato. Il DB verrà inizializzato dai modelli."
  exit 0
fi

echo "[postgres-init] Dump trovato. Ripristino in corso..."
pg_restore \
  --no-owner \
  --no-acl \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --verbose \
  "$DUMP" 2>&1 || echo "[postgres-init] Ripristino completato (eventuali warning sui ruoli sono normali)."

echo "[postgres-init] DB ripristinato da dump."

# Elimina il dump: è temporaneo, serve solo al primo avvio.
# Così docker/data/ torna vuota e il prossimo avvio parte da models:sync.
rm -f "$DUMP"
echo "[postgres-init] Dump eliminato da docker/data/."
