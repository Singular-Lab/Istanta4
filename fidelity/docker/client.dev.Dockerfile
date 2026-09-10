FROM node:26-slim

WORKDIR /app

# Copia i package.json di tutti i workspace prima di npm install (cache layer)
COPY package*.json ./
COPY src/package*.json src/
COPY server/package*.json server/

RUN npm install --install-strategy=hoisted

COPY . .

EXPOSE 3009

CMD ["npm", "run", "dev:client", "--", "--host", "0.0.0.0"]
