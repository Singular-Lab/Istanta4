# Regole locali di Olimpo

Si applica integralmente il protocollo dell'`AGENTS.md` nella root della suite.

## Ambito

Olimpo è un servizio NestJS con UI associata e strumenti nativi per PDF e immagini. Le modifiche ai contratti di archiviazione o recupero devono considerare i componenti produttori e consumatori indicati dalle specifiche.

## Verifica

- Installa le dipendenze in modo riproducibile con `yarn install --immutable`; la cartella `ui` è un progetto Yarn separato con il proprio `yarn.lock`, da installare a parte (`cd ui && yarn install --immutable`).
- Esegui i test mirati con Jest e aggiungi i test unitari come `*.spec.ts` nelle convenzioni esistenti.
- Per una modifica ordinaria esegui almeno `yarn test --runInBand` e `yarn build`.
- Esegui `yarn test:e2e` quando cambiano endpoint o integrazioni coperte dalla configurazione e2e.
- Per modifiche a startup, dipendenze native, elaborazione PDF/immagini o packaging, valida dalla root `docker build -f olimpo/Dockerfile olimpo`.

Non usare storage, FTP, database o credenziali reali nei test. Usa fixture temporanee e verifica esplicitamente la pulizia delle risorse create.
