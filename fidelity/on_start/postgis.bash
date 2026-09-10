#!/bin/bash

# Rileva versione PostgreSQL
PG_VERSION=$(psql --version | grep -oP '\d+' | head -1)

echo "Installazione PostGIS per PostgreSQL $PG_VERSION..."

# Installa PostGIS
sudo apt update
sudo apt install -y postgresql-$PG_VERSION-postgis-3

# Nome del database (cambia questo!)
DB_NAME="il_tuo_database"

# Abilita PostGIS
sudo -u postgres psql -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Verifica
sudo -u postgres psql -d $DB_NAME -c "SELECT PostGIS_version();"

echo "PostGIS installato con successo!"
