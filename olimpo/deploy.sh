#!/bin/bash

# Nome dello script: deploy.sh

# Funzione per colorare il testo
color_text() {
  local color=$1
  local text=$2
  echo "$(tput setaf $color)$text$(tput sgr0)"
}

# Esegui git pull (git chiederà automaticamente la password)
echo "$(color_text 3 'Eseguendo git pull...')"
git pull > /dev/null 2>&1

if [ $? -ne 0 ]; then
  echo "$(color_text 1 'Errore durante git pull')"
  exit 1
fi

echo "$(color_text 3 'Installazione dei pacchetti npm...')"
npm install > /dev/null 2>&1

if [ $? -ne 0 ]; then
  echo "$(color_text 1 'Errore durante npm install')"
  exit 1
fi

echo "$(color_text 3 'Costruzione del progetto...')"
npm run build > /dev/null 2>&1

if [ $? -ne 0 ]; then
  echo "$(color_text 1 'Errore durante la build del progetto')"
  exit 1
fi

echo "$(color_text 3 'Riavvio del servizio con pm2...')"
pm2 restart olimpo-service > /dev/null 2>&1

if [ $? -ne 0 ]; then
  echo "$(color_text 1 'Errore durante il riavvio del servizio pm2')"
  exit 1
fi

echo "$(color_text 3 'Mostrando i log del servizio...')"
pm2 logs olimpo-service