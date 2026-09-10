FROM node:26-slim

WORKDIR /app

# Copia i package.json di tutti i workspace prima di npm install (cache layer)
COPY package*.json ./
COPY server/package*.json server/
COPY src/package*.json src/

RUN npm install --install-strategy=hoisted

COPY . .

RUN chmod +x docker/server-entrypoint.sh

EXPOSE 3010

CMD ["sh", "docker/server-entrypoint.sh"]
