# Fidelity Promotion

**Versione:** 1.4.20.20

Piattaforma enterprise per la gestione di promozioni retail con focus su GDO (Grande Distribuzione Organizzata).

## Panoramica

Fidelity Promotion è un'applicazione full-stack che integra:
- **Volantini digitali** - Creazione e gestione WebPliant dinamici
- **WhatsApp Business** - Campagne massive con queue system
- **AI-Powered Content** - Generazione contenuti con OpenAI GPT-4
- **Ordini di Stampa** - Gestione completa workflow tipografico
- **Multi-tenant** - Supporto GDO, Agenzie, Punti Vendita
- **Real-time** - WebSocket per notifiche e sync
- **SSR** - Server-Side Rendering per SEO e performance

## Stack Tecnologico

### Frontend
- **React 18.3.1** con TypeScript strict mode
- **Vite** (rolldown-vite) come build tool
- **Server-Side Rendering (SSR)** per SEO e performance
- **React Router DOM 7.6.2** con lazy loading e SSR
- **Redux Toolkit** + **React Query** per state management
- **TailwindCSS** + **Styled Components** per styling
- **Socket.IO Client** per comunicazione real-time
- **Leaflet** con MarkerCluster per mappe e geolocalizzazione
- **i18next** per internazionalizzazione
- **React Helmet Async** per meta tag dinamici

### Backend
- **Node.js** con **TypeScript** (ES Modules)
- **Express 5.2.0** framework
- **Inversify** per Dependency Injection (IoC container)
- **PostgreSQL** (Sequelize ORM) - 51+ tabelle
- **Socket.IO Server** con clustering
- **node-cron** per task pianificati
- **PM2** per process management
- **Pino** per logging strutturato

## Quick Start

### Prerequisiti
- Node.js >= 20.x
- PostgreSQL >= 14.x
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
│   ├── index.ts           # Entry point (cluster mode)
│   ├── ws-server.ts       # WebSocket server separato (porta 3400)
│   └── core/
│       ├── controllers/   # 37 REST controllers
│       ├── services/      # 47 business services
│       ├── repositories/  # 33 repository (BaseRepository)
│       ├── interfaces/    # 35 interfacce per DI contracts
│       ├── dto/           # 34 Data Transfer Objects (Zod)
│       ├── models/        # 51+ Sequelize models
│       ├── middleware/    # Security, auth, errors
│       ├── cron/          # Scheduled tasks
│       ├── workers/       # Background jobs (WhatsApp queue)
│       ├── di/            # Inversify IoC container
│       ├── db/            # Database connectors
│       └── scripts/       # Migration & maintenance
├── src/                   # Frontend React
│   ├── pages/            # 153+ pagine applicazione
│   ├── components/       # Componenti riutilizzabili
│   ├── router/           # Routing + loader functions
│   ├── stores/           # 10 Redux slices
│   ├── hooks/            # Custom hooks
│   ├── context/          # 8 Context providers
│   └── query/            # React Query hooks
├── lib/                   # Librerie condivise client/server
│   ├── types.ts          # 1743+ righe type definitions
│   ├── enums.ts          # Enumerazioni
│   ├── errors/           # Gerarchia errori strutturata
│   ├── encryption.ts     # 2-Key TripleDES (.NET-compat)
│   ├── server_call.ts    # Definizioni API centralizzate
│   └── MessageBuilder.ts # Utility costruzione messaggi
├── plugin/                # Plugin FP (libreria esterna)
├── public/                # Assets statici
└── config/                # Configurazioni
```

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

### 4. AI & Content Generation
- Integrazione OpenAI GPT-4
- Generazione automatica ricette
- Approfondimenti vino intelligenti
- Traduzioni automatiche
- Suggerimenti contenuti

### 5. Kit Design & Produzione
- Kit design automatici e manuali
- Runtime kit per generazione dinamica
- Gestione lavorazioni in corso
- Tracking combinazioni produzione

### 6. Dashboard & Analytics
- Dashboard personalizzabili con drag & drop
- Widget configurabili per ruolo
- Grafici interattivi
- Export dati personalizzati

### 7. Multi-Tenant & RBAC
Sistema gerarchico con ruoli:
- **Superadmin** - Accesso completo al sistema
- **Agenzia** - Gestione contenuti e promozioni
- **GDO** - Gestione catena retail
- **AdminGDO** - Amministratore catena
- **PuntoVendita** - Gestione singolo negozio
- **Guest** - Accesso in sola lettura

### 8. Mappe & Geolocalizzazione
- Leaflet con MarkerCluster
- Heatmap punti vendita
- Supporto PostGIS per dati geospaziali
- Visualizzazione geografica analytics

## Database

### PostgreSQL (51+ tabelle)
**Categorie principali:**
- Utenti & Autenticazione
- Promozioni & Tracciati
- Prodotti & Referenze
- WhatsApp (7+ tabelle dedicate)
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
  *adotta*, cioe' si registra senza eseguirla. Se i modelli sono quelli della baseline gira prima,
  un'ultima volta, l'ALTER di Sequelize; altrimenti (aggiornamento a salto) si salta e un avviso
  chiede di controllare con `yarn migrazioni:verifica`. Poi si applicano le successive.
- Ogni migrazione gira in una sua transazione con `lock_timeout` di 30 secondi; con
  `-- senza-transazione` in testa gira fuori (solo per `CREATE INDEX CONCURRENTLY` e simili: una
  sola istruzione, rieseguibile). View e materialized view (`db/oggetti_derivati`) si tolgono
  prima e si ricreano dopo.
- **Errore**: la migrazione si annulla e l'avvio si ferma. Si ferma anche se un file gia'
  applicato e' stato modificato (checksum) o se i modelli non corrispondono all'ultima migrazione.
  Dopo le migrazioni una verifica dello schema scrive solo un avviso.

Per cambiare lo schema: modificare il modello, poi `yarn migrazioni:nuova <nome>`. Il comando crea
il file successivo con l'intestazione `-- schema-dopo: <hash dei modelli>`, aggiorna `schema.json`,
e nel file si scrive l'SQL. Una migrazione applicata non si modifica: la correzione va in una nuova.
La CI controlla che modelli, `schema.json` e intestazione dell'ultima migrazione coincidano.

| Variabile | Effetto |
| --- | --- |
| `MIGRAZIONI_APPLICA_ALL_AVVIO=false` | non applica le migrazioni all'avvio (avviso nel log); si applicano con `yarn migrazioni:applica` |
| `DB_SYNC_ON_START=false` | alias deprecato della precedente |
| `DB_AUTO_SYNC` | ignorata, con avviso |

## Sicurezza

- **Session-based authentication** con cookie HTTP-only
- **Timeout dinamico** basato su ruolo (30min - 4h)
- **Password hashing** con bcrypt (10 rounds)
- **Helmet.js** per header HTTP sicuri
- **CSRF protection** HMAC-SHA256 (scadenza 1h)
- **Rate limiting** per protezione DDoS
- **API Key auth** per servizi esterni
- **Ephemeral tokens** per integrazioni esterne temporanee
- **Browser security middleware** - validazione User-Agent e Sec-Fetch-*
- **Origin whitelist** - validazione origine richieste
- **Input validation** con express-validator, Zod, Yup

## Real-Time Communication

### Socket.IO Architecture
- Server WebSocket separato su porta 3400
- Supporto clustering con IPC in produzione
- Master-Worker pattern
- Auto-reconnection con recovery 2min
- Transport: Solo WebSocket (no polling)

**Eventi gestiti:**
- Notifiche sistema (info/success/error/warning)
- Aggiornamenti stato lavorazioni
- Status campagne WhatsApp
- Sync multi-utente dashboard
- Status elaborazione kit

## Integrazioni Esterne

1. **OpenAI (GPT-4)** - Generazione contenuti AI, ricette, traduzioni
2. **WhatsApp Business API** - Piattaforma messaging
3. **ISTANTA** - Sistema referenze prodotti
4. **CORREGGO** - Servizio correzione bozze volantini
5. **OLYMPUS** - Microservizi esterni
6. **mattoliniapi** - Approfondimenti vino AI

## Configurazione

### Variabili d'Ambiente Principali

```env
# Ambiente
NODE_ENV=development|production|test
NODE_PORT=3010
WS_PORT=3400
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

# External Services
ISTANTA_IP_ADDRESS=http://...
OLYMPUS_IP_ADDRESS=http://...
```

## Scripts NPM

### Development
```bash
yarn dev              # Dev mode (client + server concorrenti)
yarn dev:debug        # Debug mode con Node inspector
yarn dev:server       # Solo server (porta 3010)
yarn dev:client       # Solo client Vite (porta 3009)
```

### Build & Production
```bash
yarn build            # Build production completo
yarn build:client     # Build solo frontend
yarn start                # Start production server
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
```

### Testing & Quality
```bash
yarn test                         # Vitest in watch mode
yarn test:server              # Test una volta (server e lib)
yarn test:server:coverage     # Coverage report
yarn lint                     # Lint frontend
yarn lint:fix                 # Fix automatico lint
yarn type-check               # TypeScript check
yarn security-check           # audit delle vulnerabilita' (yarn npm audit)
yarn deps-check               # Check dipendenze inutilizzate
```

## Architettura Backend

### Dependency Injection (Inversify)
Container IoC in `server/core/di/`:
- `container.ts` - Binding singleton con lazy `toDynamicValue()`
- `types.ts` - 100+ costanti simbolo per tutti i servizi, repository e controller
- Tutti i componenti risolti tramite container

### Scheduled Tasks (Cron)
Gestiti da `ChronService`, in `server/core/cron/`:
- **logCleanupJob** - Giornaliero alle 3:00 (Europe/Rome): 7d combined / 30d error / 3d HTTP, cap 500 MB
- **attivitaCleanupJob** - Pulizia attività

### Entry Point & Cluster
- **Produzione**: Master gestisce WebSocket (3400), Worker gestiscono HTTP (3010)
- **Development**: Processo singolo per entrambi

## Build Configuration

### Vite (Frontend)
- **Minification**: oxc in produzione
- **CSS**: Lightning CSS
- **Code Splitting**: 7+ vendor chunk (React, Router, Redux, UI, Charts, Maps, Lexical)
- **Compression**: Gzip + Brotli
- **Legacy Support**: Browser vecchi via @vitejs/plugin-legacy
- **Tree Shaking**: PropTypes rimossi in produzione

### TypeScript
- **Strict Mode**: Abilitato per frontend
- **Target**: ES2022 (backend), ES6 (frontend)
- **Path Aliases**: `@/*` → `src/`, `@lib/*` → `lib/`

## Metriche Progetto

- **1.4.20.20** versione corrente
- **153+** pagine frontend
- **51+** tabelle PostgreSQL
- **37** controller REST API
- **47** servizi business logic
- **33** repository
- **1743+** righe type definitions condivise

## Plugin System

Il progetto include un plugin (`/plugin`) per accesso esterno all'API con autenticazione tramite ephemeral token:

```bash
cd plugin
npm install
npm run build
```

Output: `dist/FP.js` (IIFE), `dist/FP.esm.js` (ESM), `dist/FP.cjs.js` (CommonJS)

### Utilizzo

```javascript
import FP from './plugin/dist/FP.esm.js';

const fp = new FP('http://localhost:3010/api');
// Health check automatico all'inizializzazione
```

## CI/CD

La CI e' quella della suite (`.github/workflows/ci.yml` nella root del repository): per fidelity installa con `yarn install --immutable` ed esegue type-check, lint, audit delle dipendenze di runtime, test, build e build dell'immagine di produzione.

## License

Questo progetto è proprietario. Tutti i diritti riservati.

## Team

Sviluppato da **Singular Lab**

---

**Nota**: Piattaforma enterprise complessa. Consultare `CLAUDE.md` per la documentazione completa dell'architettura e dei pattern di sviluppo.
