# Fidelity Promotion

**Versione:** 2.18.002. Fa fede il campo `version` di `package.json`; le novita' sono in `CHANGELOG.md`.

Piattaforma enterprise per la gestione di promozioni retail con focus su GDO (Grande Distribuzione Organizzata).

## Panoramica

Fidelity Promotion è un'applicazione full-stack che integra:
- **Volantini digitali** - Creazione e gestione WebPliant dinamici
- **WhatsApp Business** - Campagne massive con coda BullMQ su Redis
- **Contenuti AI** - Ricette e approfondimenti sui vini generati dal servizio AI esterno (`AI_RICETTE_API_URL`)
- **Ordini di Stampa** - Gestione completa workflow tipografico
- **Multi-tenant** - Supporto GDO, Agenzie, Punti Vendita
- **Real-time** - Socket.IO per notifiche e sync

Il client è una single-page application: le pagine si disegnano nel browser, non c'è rendering lato server.

## Stack Tecnologico

### Frontend
- **React 18** con TypeScript strict mode
- **Vite 8** (bundler Rolldown, minificazione oxc) come build tool
- **React Router DOM 7** con lazy loading e loader functions
- **Redux Toolkit** + **React Query** per state management
- **TailwindCSS**, insieme a fogli CSS e SCSS esistenti
- **Socket.IO Client** per comunicazione real-time
- **Leaflet** (react-leaflet) per mappe e geolocalizzazione
- **i18next** per internazionalizzazione
- **React Helmet Async** per meta tag dinamici

### Backend
- **Node.js 26** con **TypeScript** (ES Modules), eseguito con tsx
- **Express 5** framework
- **Inversify** per Dependency Injection di servizi e repository (vedi "Architettura Backend")
- **PostgreSQL** con PostGIS (Sequelize ORM), schema gestito da migrazioni versionate
- **Socket.IO Server** nel processo primary del cluster
- **Redis** facoltativo (`REDIS_URL`): coda BullMQ delle campagne WhatsApp, cache e rate limit condivisi fra i processi
- **node-cron** per task pianificati
- **PM2** (`ecosystem.config.cjs`, una sola istanza in fork mode) oppure Docker per l'esecuzione
- **Pino** per logging strutturato

## Quick Start

### Prerequisiti
- Node.js 26 (in `.nvmrc`, come la CI e le immagini Docker)
- PostgreSQL >= 14.x con le estensioni `postgis` e `uuid-ossp` (la prima migrazione le crea, se l'utente puo' farlo)
- Yarn: basta un `yarn` qualsiasi (anche 1.x): la versione del progetto, 4.18.1, e' in `.yarn/releases` e viene usata automaticamente

### Installazione

```bash
# Clone repository
git clone https://github.com/Singular-Lab/fidelity_promotion.git
cd fidelity_promotion

# Installa dipendenze
yarn install

# Configura variabili d'ambiente: crea .env con le variabili
# validate in server/core/config/index.ts

# Crea o aggiorna lo schema PostgreSQL (migrazioni; lo fa anche l'avvio del server)
yarn models:sync

# Avvia in development
yarn dev
```

### Build Production

```bash
# Build completo
yarn build

# Start production server
yarn start
```

## Struttura Progetto

```
fidelity_promotion/
├── server/                 # Backend Node.js/Express
│   ├── index.ts           # Entry point (cluster in produzione e test)
│   ├── ws-server.ts       # Server Socket.IO separato (porta WS_PORT, default 3400)
│   ├── core/
│   │   ├── controllers/   # REST controllers
│   │   ├── services/      # Business services
│   │   ├── repositories/  # Repository (BaseRepository)
│   │   ├── interfaces/    # Interfacce per DI contracts
│   │   ├── dto/           # Data Transfer Objects
│   │   ├── models/        # Sequelize models
│   │   ├── accessi/       # Permessi effettivi, contesto di accesso, migrazione degli accessi
│   │   ├── agenzia_lib/   # Logiche specifiche per cliente (CLIENT_ID)
│   │   ├── http/          # Client HTTP in uscita (clienteHttp.ts) e protezione SSRF
│   │   ├── inizializzazione/ # Dati e migrazioni di avvio dell'installazione
│   │   ├── middleware/    # Security, auth, errors
│   │   ├── cron/          # Job di pulizia avviati da ChronService
│   │   ├── workers/       # Background jobs (WhatsApp queue)
│   │   ├── di/            # Inversify IoC container
│   │   ├── db/            # Connessione, migrazioni (db/migrazioni) e oggetti derivati
│   │   └── scripts/       # Script a riga di comando e di manutenzione
│   └── src/               # Redis e cache, code BullMQ (shared/); /health e /metrics (app/http, shared/observability)
├── src/                   # Frontend React
│   ├── pages/            # Pagine applicazione
│   ├── components/       # Componenti riutilizzabili
│   ├── router/           # Routing + loader functions
│   ├── stores/           # Redux slices
│   ├── hooks/            # Custom hooks
│   ├── context/          # Context providers
│   └── query/            # React Query hooks
├── lib/                   # Librerie condivise client/server
│   ├── types.ts          # Type definitions condivise
│   ├── enums.ts          # Enumerazioni
│   ├── accessi/          # Catalogo dei permessi e delle pagine
│   ├── errors/           # Gerarchia errori strutturata
│   ├── encryption.ts     # 2-Key TripleDES (.NET-compat)
│   └── server_call.ts    # ServerCall: client HTTP del frontend verso le API (CSRF, errori, richieste in volo)
├── plugin/                # Plugin FP (libreria esterna, build con tsup)
├── scripts/               # Script di build (icone Lucide, budget del bundle)
├── public/                # Assets statici
└── config/                # Configurazione dell'installazione, fuori dal repository (vedi sotto)
```

### La cartella `config/`

`config/` è in `.gitignore`: ogni installazione ha la sua e il repository non ne contiene una copia. Il server
ci legge file JSON con `process.cwd()/config/...`, per esempio `plugin_registry.json` e
`flyerInsightsConfig.json` (`ConfigService`) e `menu.json` delle pagine Singular (`ImpostazioniController`,
che lo riscrive anche). Se un file manca, la funzione che lo usa risponde con un errore.
`docker-compose.prod.yml` e `docker-compose.test.yml` montano `./config` in `/app/config`.

## Features Principali

### 1. Volantini & Promozioni
- Editor drag & drop visuale per volantini digitali
- Sistema keyframe per contenuti temporizzati
- Tracciati personalizzabili per aree/canali
- Export multi-formato (PDF, Excel, immagini)
- Gestione referenze prodotti con foto
- Filtri avanzati e combinazioni

### 2. WhatsApp Business Integration
- **Template Management**: Creazione e versioning template
- **Preset System**: Mappatura dinamica parametri
- **Campagne**: Invio massivo con targeting utenti
- **Queue System**: Code messaggi con retry logic
- **Business Chat**: Conversazioni bidirezionali
- **Analytics**: Statistiche e tracking delivery
- **Opt-in Management**: Gestione consensi GDPR

### 3. Ordini di Stampa
- Tracking completo stato ordini
- Gestione contratti tipografie
- Sistema revisione multi-step
- Formati stampa configurabili
- Naming convention automatiche

### 4. Contenuti AI
- Generazione delle ricette e delle loro foto
- Approfondimenti sui vini
- Le richieste vanno al servizio AI esterno indicato da `AI_RICETTE_API_URL` (`GPTService`), con la chiave `API_KEY_AI`

### 5. Kit Design & Produzione
- Kit design automatici e manuali
- Runtime kit per generazione dinamica
- Gestione lavorazioni in corso
- Tracking combinazioni produzione

### 6. Dashboard
- Dashboard per tipo di utente (`/dashboard`, `/gdo/dashboard`, `/marketing/dashboard`, `/category/dashboard`) e dashboard del Superadmin
- Grafici con Chart.js

### 7. Multi-Tenant & RBAC
Tipi di utente (`TIPO_UTENTI` in `lib/enums.ts`): **Superadmin**, **Agenzia**, **GDO**, **PuntoVendita**,
**Category**, **Marketing**, **IT**, **Guest**. Gli utenti GDO hanno anche un sotto-ruolo (tabella
`ruolo_utente_gdo`). Permessi, aree e pagine sono descritti in `docs/RBAC_MODELLO.md`.

### 8. Mappe & Geolocalizzazione
- Leaflet (react-leaflet) per le mappe dei punti vendita
- Mappa di densità dei destinatari nelle campagne WhatsApp, disegnata con `CircleMarker` (nessun plugin di heatmap)
- PostGIS per i dati geospaziali

## Database

### PostgreSQL
**Categorie principali:**
- Utenti & Autenticazione
- Promozioni & Tracciati
- Prodotti & Referenze
- WhatsApp
- Ordini di Stampa & Contratti
- Kit Design & Runtime
- Webhook & API log
- Audit log & Statistiche

### Migrazioni dello schema

Lo schema cambia solo con migrazioni versionate, in `server/core/db/migrazioni/sql`
(`NNNN_nome.sql`, numerazione contigua). Si applicano all'avvio del server, una volta sola e
prima dei worker, sotto un advisory lock: container, PM2 e server che partono insieme si mettono
in fila. Lo storico sta nella tabella `migrazioni_schema` (nome, checksum, data, durata, modo,
versione dell'applicazione).

- **Database vuoto**: si esegue `0000_baseline.sql` (estensioni, enum, tabelle e indici dei
  modelli), poi le migrazioni successive.
- **Database esistente senza storico** (creato dalla vecchia sincronizzazione): la baseline si
  *adotta*, cioe' si registra senza eseguirla. Prima gira, un'ultima volta, l'ALTER di Sequelize con
  i modelli della versione installata, anche in un aggiornamento a salto: cosi' tabelle, colonne e
  indici nati dopo l'ultimo avvio esistono. Poi si applicano le successive, che sistemano il resto.
  Le migrazioni elencate in `PRIMA_DELL_ALLINEAMENTO` (`applicaMigrazioni.ts`) girano anche prima
  di quell'ALTER, perche' recuperano valori da colonne che l'ALTER eliminerebbe (oggi `0013`, le date
  dei preset WhatsApp); al loro turno non trovano piu' nulla da fare e si registrano.
- Ogni migrazione gira in una sua transazione con `lock_timeout` di 30 secondi; con
  `-- senza-transazione` in testa gira fuori (solo per `CREATE INDEX CONCURRENTLY` e simili: una
  sola istruzione, rieseguibile). View e materialized view (`db/oggetti_derivati`) si tolgono
  prima e si ricreano dopo.
- **Errore**: la migrazione si annulla e l'avvio si ferma. Si ferma anche se un file gia'
  applicato e' stato modificato (checksum) o se i modelli non corrispondono all'ultima migrazione.
  Dopo le migrazioni una verifica dello schema (`verificaSchema.ts`) confronta il database con i
  modelli e scrive solo un avviso: tabelle, colonne, tipi, enum, indici e chiavi primarie mancanti o
  diverse; gli enum in piu' non usati da nessuna colonna sono solo un'informazione.

Per cambiare lo schema: modificare il modello, poi `yarn migrazioni:nuova <nome>`. Il comando crea
il file successivo con l'intestazione `-- schema-dopo: <hash dei modelli>`, aggiorna `schema.json`,
e nel file si scrive l'SQL. Una migrazione applicata non si modifica: la correzione va in una nuova.
La CI controlla che modelli, `schema.json` e intestazione dell'ultima migrazione coincidano.

| Variabile | Effetto |
| --- | --- |
| `MIGRAZIONI_APPLICA_ALL_AVVIO=false` | non applica le migrazioni all'avvio (avviso nel log); si applicano con `yarn migrazioni:applica` |
| `DB_SYNC_ON_START=false` | alias deprecato della precedente |
| `DB_AUTO_SYNC` | ignorata, con avviso |

### Script di dati

Le correzioni dei dati lanciate a mano (`server/core/scripts`) non sono migrazioni: non girano
all'avvio. Ogni esecuzione reale riuscita si registra nella tabella `script_dati_eseguiti`
(migrazione `0010`: va applicata prima, altrimenti lo script si ferma e chiede
`yarn migrazioni:applica`) con data, numero di esecuzioni, durata, riepilogo e versione.

- **Non ripetibile**: se il registro dice che e' gia' stato eseguito, lo script si rifiuta, dice
  quando e non cambia nulla; si riesegue solo con `--forza`. Le scritture stanno in una sola
  transazione con la registrazione: un errore non lascia il lavoro a meta'.
- **Ripetibile**: tocca solo cio' che non e' ancora nello stato voluto; ogni esecuzione si registra.
- `--dry-run` mostra cosa cambierebbe, non scrive e non si registra.
- Un errore non si registra. Due esecuzioni dello stesso script insieme: la seconda si rifiuta.
- Il registro conosce solo le esecuzioni da quando esiste: quelle precedenti non ci sono.

| Script | Ripetibile | Cosa fa |
| --- | --- | --- |
| `yarn migrate:utenti-gdo` | no | Associa alla GDO indicata (`--gdo-id`, default la piu' vecchia) gli utenti non SUPERADMIN senza GDO; rilanciato ci metterebbe anche gli utenti creati da allora |
| `yarn migrate:olimpo-urls` | si' | Riscrive gli URL assoluti di Olimpo nella forma relativa `/olimpo/...` |
| `yarn accessi:migra` | si' | Prepara gli accessi per aree (lo fa anche l'avvio del server, che non si registra) |
| `yarn auth:segreti` | si' | Cifra (o con `--decifra` riporta in chiaro) i segreti dei metodi di accesso |

`yarn script-dati:stato` elenca gli script noti e le esecuzioni registrate.

## Sicurezza

- **Session-based authentication** con cookie HTTP-only
- **Timeout dinamico** basato su ruolo (30min - 4h)
- **Password hashing** con bcrypt (round da `SALT_ROUNDS`)
- **Metodi di accesso** configurabili dal Superadmin: email e password, OIDC (`/api/auth/oidc/*`, `HubController`) e SAML (`/api/auth/saml/*`, `MetodiAccessoController`)
- **Helmet.js** per header HTTP sicuri
- **CSRF protection** HMAC-SHA256 (scadenza 1h)
- **Rate limiting** per protezione DDoS
- **API Key auth** per servizi esterni
- **Ephemeral tokens** per integrazioni esterne temporanee
- **Browser security middleware** - validazione User-Agent e Sec-Fetch-*
- **Origin whitelist** - validazione origine richieste
- **Input validation** con Zod sul server (configurazione e parte delle richieste) e Yup nei form del client
- **Chiamate in uscita** dal client comune `server/core/http/clienteHttp.ts`, con un timeout per categoria di chiamata; gli indirizzi configurati dagli utenti (webhook, discovery OIDC, metadati SAML) non possono puntare a loopback o link-local (`indirizziSicuri.ts`)

## Real-Time Communication

### Socket.IO Architecture
- Server Socket.IO separato sulla porta `WS_PORT` (default 3400)
- In produzione e test gira nel processo primary; i worker HTTP gli inoltrano gli eventi via IPC (`process.send`). In sviluppo un solo processo fa tutto
- Riconnessione con recupero dello stato entro 30 secondi (`connectionStateRecovery`)
- Transport: Solo WebSocket (no polling)

**Eventi gestiti:**
- Notifiche (`notifica`) e avviso di manutenzione
- Avanzamento degli ordini di stampa, inviato all'utente che li ha avviati
- Stato delle campagne WhatsApp
- Presenze nel menabò
- Collegamento dei dispositivi (`device:*`)

## Integrazioni Esterne

1. **Servizio AI** (`AI_RICETTE_API_URL`) - Ricette, foto delle ricette, approfondimenti sui vini
2. **WhatsApp Business API** - Graph API di Meta (`META_GRAPH_API_VERSION`)
3. **ISTANTA** - Sistema referenze prodotti
4. **CORREGGO** - Servizio correzione bozze volantini
5. **OLYMPUS** - Microservizi esterni e archivio file (Olimpo)

## Configurazione

### Variabili d'Ambiente Principali

```env
# Ambiente
NODE_ENV=development|production|test
NODE_PORT=3010
WS_PORT=3400
PORTA_VITE=3009          # porta del dev server Vite (default 3000)
CLIENT_URL=http://localhost:3009

# PostgreSQL
DB_POSTGRESQL_NAME=fp
DB_POSTGRESQL_HOST=localhost
DB_POSTGRESQL_PORT=5432
DB_POSTGRESQL_USER=postgres
DB_POSTGRESQL_PASSWORD=your_password

# Security
FICO_SECRET=your_secret_key
SESSION_SECRET=your_session_secret
SALT_ROUNDS=10

# Servizio AI di ricette e vini (obbligatoria la chiave)
API_KEY_AI=...
# Facoltative, con questi default
# AI_RICETTE_API_URL=https://www.istantabusiness.it/betatools/ricette_ai/endpoint-api.php
# AI_RICETTE_TIMEOUT_MS=120000

# WhatsApp: versione della Graph API di Meta (facoltativa, default v24.0)
# META_GRAPH_API_VERSION=v24.0

# OPENAI_API_KEY, ASSISTANT_ID, OPEN_AI_ASSISTANT_ID, OPEN_AI_ASSISTANT_ID_TRANSLATION
# e OPENAI_PROJECT_ID non sono piu' lette dal codice: facoltative

# Redis (facoltativo): senza, la coda WhatsApp non c'e' e cache e rate limit restano per processo
# REDIS_URL=redis://localhost:6379

# External Services
ISTANTA_IP_ADDRESS=http://...
OLYMPUS_IP_ADDRESS=http://...
```

L'elenco completo, con obbligatorieta' e default, e' lo schema Zod di `server/core/config/index.ts`.

## Scripts yarn

### Development
```bash
yarn dev              # Dev mode (client + server concorrenti)
yarn dev:debug        # Debug mode con Node inspector
yarn dev:server       # Solo server (porta NODE_PORT)
yarn dev:client       # Solo client Vite (porta PORTA_VITE)
```

### Build & Production
```bash
yarn build            # Build production completo: icone Lucide, client, budget del bundle
yarn build:client     # Build solo frontend
yarn icone:lucide     # Rigenera l'elenco delle icone Lucide usate
yarn budget:bundle    # Confronta il bundle con budget.json (--aggiorna con budget:bundle:aggiorna)
yarn start            # Start production server
yarn clean            # Rimuovi dist folder
```

### Database
```bash
yarn migrazioni:nuova <nome>  # Nuova migrazione con l'hash dei modelli, aggiorna schema.json
yarn migrazioni:stato         # Migrazioni applicate e da applicare
yarn migrazioni:verifica      # Confronto in sola lettura fra database e modelli
yarn migrazioni:applica       # Applica le migrazioni pendenti
yarn migrazioni:baseline      # Rigenera la baseline (congelata: solo con --sovrascrivi)
yarn models:sync              # Come migrazioni:applica, ma rispetta MIGRAZIONI_APPLICA_ALL_AVVIO
yarn models:sync:force        # Solo NODE_ENV=development: elimina tabelle e storico (DISTRUTTIVO)
yarn models:status            # Come migrazioni:stato
yarn models:check             # Come migrazioni:verifica
yarn models:sync-db-objects   # Ricrea view e materialized view
yarn script-dati:stato        # Script di dati noti ed esecuzioni registrate
yarn migrate:utenti-gdo       # Script di dati (anche :dry-run): vedi "Script di dati"
yarn migrate:olimpo-urls      # Script di dati (anche :dry-run)
yarn accessi:migra            # Script di dati (--dry-run per il solo report)
yarn auth:segreti             # Script di dati (anche :dry-run)
```

### Testing & Quality
```bash
yarn test                     # Vitest in watch mode
yarn test:server              # Test una volta (server, lib e src) con coverage e soglie
yarn lint                     # ESLint su src, server e lib, 0 errori e 0 warning
yarn lint:fix                 # Fix automatico lint
yarn lint:prune               # Toglie dal baseline le violazioni corrette
yarn type-check               # TypeScript del frontend
yarn type-check:server        # type-check:test + type-check:strict
yarn type-check:test          # TypeScript del server, test compresi
yarn type-check:strict        # Server in strict a cricchetto (--aggiorna dopo una correzione)
yarn security-check           # audit delle vulnerabilita' high (yarn npm audit), come la CI
yarn deps-check               # Check dipendenze inutilizzate
yarn ci                       # Gli stessi controlli della CI, nello stesso ordine
```

I controlli partono dallo stato del 2026-10-28 e possono solo migliorare:
- **ESLint**: le violazioni gia' presenti sono in `eslint-suppressions.json` (bulk suppressions di ESLint). Una violazione nuova fa fallire `yarn lint`. Quando se ne corregge una, `yarn lint` fallisce finche' non si esegue `yarn lint:prune`, che abbassa il baseline. Il baseline non si rigenera con `--suppress-all` per far passare codice nuovo.
- **TypeScript strict**: il server compila con `strict: false`. `server/tsconfig.strict.json` lo compila in strict e `server/tsconfig.strict.baseline.json` conta gli errori file per file. Un file che peggiora, o un file nuovo con errori, fa fallire il controllo. Dopo una correzione si aggiorna il baseline con `yarn type-check:strict --aggiorna`.
- **Coverage**: le soglie sono in `vitest.config.ts`, globali e per cartella (http, inizializzazione, agenzia_lib, db, accessi). Si alzano a mano quando i test crescono.
- **Route senza chiamanti**: le route per cui l'inventario del 2026-10-29 non ha trovato chiamanti sono elencate, con il motivo, in `server/core/middleware/routeSenzaChiamanti.ts` e montano il middleware `server/core/middleware/routeDeprecata.ts`. La risposta non cambia: ogni chiamata incrementa la metrica `api_route_senza_chiamanti_total{method,route}` su `/metrics` e scrive un avviso nel log (al massimo uno ogni 15 minuti per route). Si osservano per 30 giorni, fino a `RIMUOVIBILI_DAL`: quelle mai chiamate si rimuovono, quelle chiamate si analizzano prima di decidere. Il test `server/core/middleware/__tests__/routeSenzaChiamanti.test.ts` verifica che l'elenco e le route che montano il middleware coincidano.

#### Test d'integrazione
I file `*.integrazione.test.ts` girano su un PostgreSQL vero, con lo schema creato da zero dalle migrazioni come in una installazione nuova (`server/__tests__/integrazione/`). `yarn test:server` li esegue insieme agli altri; `yarn vitest run --project integrazione` solo loro.
- **In CI**: un container `postgis/postgis:17-3.5` avviato dai test con testcontainers, senza configurazione.
- **In locale**: il database indicato da `FIDELITY_TEST_DB_URL`, nell'ambiente o in `.env`, per esempio `postgres://utente:password@localhost:5433/fidelity_test`. Il nome deve finire in `_test` e non puo' essere quello di `DB_POSTGRESQL_NAME`: viene cancellato e ricreato a ogni esecuzione e cancellato alla fine. L'utente deve poter creare database ed estensioni (postgis, uuid-ossp).
- **Senza nessuno dei due**: in locale si saltano con un avviso, in CI la suite fallisce.

## Architettura Backend

### Dependency Injection (Inversify)
Container IoC in `server/core/di/`:
- `container.ts` - Binding singleton di servizi e repository con lazy `toDynamicValue()`
- `types.ts` - Costanti simbolo dei binding
- I controller non passano dal container: `server/core/routes.ts` li crea con `new`, passando i servizi letti dal container. Alcuni servizi si creano direttamente o sono singleton propri (`getInstance()`, `RisolutoreAccessi.get()`)

### Scheduled Tasks (Cron)
`ChronService` (`server/core/services/ChronService.ts`) avvia i job pianificati e il worker della coda WhatsApp.
In produzione e test girano solo nel worker HTTP 1 (`server/core/services/startup.ts`):
- **Stati delle promo** - Ogni 5 minuti
- **attivitaCleanupJob** (`server/core/cron/`) - Pulizia delle attività scadute, ogni giorno alle 4:00
- **auditLogCleanupJob** (`server/core/cron/`) - Pulizia dell'audit log, ogni giorno alle 2:30
- **Eventi analytics del plugin** - Pulizia ogni giorno alle 4:30 degli eventi più vecchi di 90 giorni (valore fisso nel codice)

I log vanno su stdout: la conservazione dipende da chi li raccoglie (driver `json-file` di Docker con
`max-size`/`max-file`, PM2).

### Entry Point & Cluster
- **Produzione e test**: il primary applica le migrazioni, prepara accessi e configurazione, ospita Socket.IO (`WS_PORT`) e forka i worker HTTP (`NODE_PORT`; di default 2, oppure `HTTP_WORKERS`, mai piu' dei core)
- **Development**: Processo singolo per entrambi

### Osservabilità
- `GET /health`: stato di HTTP, PostgreSQL e Redis; risponde 503 solo se PostgreSQL non risponde
- `GET /metrics`: metriche Prometheus (`prom-client`), senza autenticazione
- I compose di test e produzione avviano anche Prometheus, Loki, Promtail e Grafana (`docker/observability/`)

## Build Configuration

### Vite (Frontend)
- **Target**: `es2020`, anche per i vecchi iPhone che aprono il volantino pubblico; nessun plugin per browser legacy
- **Minification**: oxc in produzione; `console.log`/`info`/`debug` e `debugger` rimossi, restano `warn` ed `error`
- **CSS**: minificazione con Lightning CSS
- **Code Splitting**: gruppi `codeSplitting.groups` in `vite.config.ts`, uno per libreria, con `vendor-core` (React e helper del transpiler) a priorità più alta
- **Icone Lucide**: `scripts/generaIconeLucide.mjs` (lanciato da `yarn build`) scrive `src/components/Base/Lucide/iconeUsate.ts`; le altre icone si caricano a parte quando servono
- **Budget**: `budget.json` fissa il peso gzip/brotli di JS e CSS per rotta; `scripts/budgetBundle.mjs` lo controlla dopo la build e fallisce solo in CI (o con `--rigoroso`)
- **Compression**: la build scrive accanto ai file i `.gz` e `.br`, che Express serve al posto dell'originale (`server/core/middleware/staticiPrecompressi.ts`)
- **SRI**: `vite-plugin-sri` aggiunge l'attributo `integrity` (sha384) a script e fogli di stile di `index.html`

### TypeScript
- **Strict Mode**: Abilitato per frontend; sul server a cricchetto (`yarn type-check:strict`)
- **Target**: ES2022 (server); il client si controlla con target ES6 e si compila con Vite in es2020
- **Path Aliases**: `@/*` → `src/` nel client (tsconfig e Vite); `lib/` si importa con percorsi relativi

## Plugin System

Il progetto include un plugin (`/plugin`) per accesso esterno all'API con autenticazione tramite ephemeral token.
Non è un workspace di Yarn: ha il suo `package.json` e si costruisce con tsup.

```bash
cd plugin
npm install
npm run build        # tsup in produzione + offuscamento del bundle IIFE
```

Output in `plugin/dist/<versione>/` (la `version` di `plugin/package.json`): `index.js` (ESM), `index.cjs` (CommonJS),
`index.global.js` (IIFE, globale `FP`) e `index.d.ts`.

### Utilizzo

```javascript
const fp = new FP();

// url, container e slug sono obbligatori; il resto arriva dal Filter Template dello slug
await fp.init({
  url: 'https://<host>/api',
  container: document.getElementById('fp-container'),
  slug: 'promo-estate-2024'
});

await fp.render();
```

La guida completa è nella pagina Documentazione → Plugin dell'applicazione (`src/pages/Documentazione/Plugin`).

## CI/CD

La CI e' quella della suite (`.github/workflows/ci.yml` nella root del repository): per fidelity installa con `yarn install --immutable` ed esegue type-check, lint, audit delle dipendenze di runtime, test, build e build dell'immagine di produzione. Chiama gli script `yarn` (`type-check`, `type-check:server`, `lint`, `test:server`, `build`), quindi i controlli descritti in "Testing & Quality" valgono anche in CI. `yarn ci` li esegue in locale.

## Documentazione

- `docs/RBAC_MODELLO.md` - permessi, aree, pagine e menu
- `docs/AGENZIA_LIB_POLICY_V2.md` - policy CoopFI dal codice posizione
- `docs/SECURITY_EXTERNAL_API.md` - sicurezza delle API esterne
- `PRIMO_AVVIO_TEST.md` - primo avvio dell'ambiente Docker di test
- `docs/archivio/` - documenti superati, con il motivo e cosa li sostituisce

## License

Questo progetto è proprietario. Tutti i diritti riservati.

## Team

Sviluppato da **Singular Lab**
