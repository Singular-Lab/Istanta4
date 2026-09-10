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
- **MongoDB** (Mongoose ODM) - Configurazioni dinamiche
- **Socket.IO Server** con clustering
- **node-cron** per task pianificati
- **PM2** per process management
- **Winston** per logging avanzato

## Quick Start

### Prerequisiti
- Node.js >= 18.x
- PostgreSQL >= 14.x
- MongoDB >= 6.x
- npm

### Installazione

```bash
# Clone repository
git clone https://github.com/Singular-Lab/fidelity_promotion.git
cd fidelity_promotion

# Installa dipendenze
npm install

# Configura variabili d'ambiente
cp .env.example .env
# Modifica .env con le tue configurazioni

# Sincronizza database PostgreSQL
npm run models:sync

# Avvia in development
npm run dev
```

### Build Production

```bash
# Build completo
npm run build

# Start production server
npm start
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
│       ├── models/        # 51+ Sequelize + Mongoose models
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

### MongoDB
**Collections:**
- Configurazioni dinamiche
- Dashboard & Workspace layout
- Sessioni utente
- Kit design temporanei
- Foto e media

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

# MongoDB
MONGO_URL=mongodb://localhost:27017/FIDELITY_PROMOTION
MONGO_DB_NAME=FIDELITY_PROMOTION

# Security
FICO_SECRET=your_secret_key
SESSION_SECRET=your_session_secret
SALT_ROUNDS=10

# OpenAI
OPENAI_API_KEY=sk-...
ASSISTANT_ID=asst_...

# External Services
ISTANTA_IP_ADDRESS=http://...
OLYMPUS_IP_ADDRESS=http://...
```

## Scripts NPM

### Development
```bash
npm run dev              # Dev mode (client + server concorrenti)
npm run dev:debug        # Debug mode con Node inspector
npm run dev:server       # Solo server (porta 3010)
npm run dev:client       # Solo client Vite (porta 3009)
```

### Build & Production
```bash
npm run build            # Build production completo
npm run build:client     # Build solo frontend
npm start                # Start production server
npm run clean            # Rimuovi dist folder
```

### Database
```bash
npm run models:sync              # Sync schema database
npm run models:sync:force        # Force sync (DROP tables - DISTRUTTIVO)
npm run models:status            # Check status modelli
npm run models:check             # Verifica connessione DB
npm run models:sync-model        # Sync singolo modello
npm run models:sync-db-objects   # Sync oggetti DB custom (views, enum)
npm run migrate:lowercase        # Migrazione colonne lowercase
npm run migrate:verify           # Verifica stato migrazione
```

### Testing & Quality
```bash
npm test                         # Run tests (Vitest)
npm run test:server              # Test server una volta
npm run test:server:watch        # Watch mode
npm run test:server:coverage     # Coverage report
npm run test:server:ci           # Test + coverage per CI
npm run lint                     # Lint frontend
npm run lint:fix                 # Fix automatico lint
npm run type-check               # TypeScript check
npm run security-check           # npm audit
npm run deps-check               # Check dipendenze inutilizzate
```

### Log Management
```bash
npm run logs:cleanup             # Pulizia log vecchi
npm run logs:cleanup:dry-run     # Preview pulizia
npm run logs:cleanup:force       # Forza pulizia con retention personalizzata
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

GitHub Actions workflows:
1. **CI** (`.github/workflows/ci.yml`) - type-check, lint, security, build — trigger su push/PR a main
2. **Deploy** (`.github/workflows/deploy.yml`) - packaging dopo CI
3. **Cleanup** (`.github/workflows/cleanup.yml`) - pulizia artifact settimanale (domenica 2:00 UTC)

Dependabot configurato per aggiornamenti npm settimanali con freeze su major versions critiche.

## License

Questo progetto è proprietario. Tutti i diritti riservati.

## Team

Sviluppato da **Singular Lab**

---

**Nota**: Piattaforma enterprise complessa. Consultare `CLAUDE.md` per la documentazione completa dell'architettura e dei pattern di sviluppo.
