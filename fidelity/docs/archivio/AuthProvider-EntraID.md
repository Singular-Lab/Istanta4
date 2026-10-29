# Sistema AuthProvider — Guida all'integrazione con Microsoft Entra ID

## Indice

1. [Panoramica del sistema AuthProvider](#1-panoramica-del-sistema-authprovider)
2. [Architettura e componenti](#2-architettura-e-componenti)
3. [Schema del database](#3-schema-del-database)
4. [Flusso di autenticazione attuale](#4-flusso-di-autenticazione-attuale)
5. [Configurazione Entra ID su Azure Portal](#5-configurazione-entra-id-su-azure-portal)
6. [Registrazione del provider nel database](#6-registrazione-del-provider-nel-database)
7. [Flusso OIDC — Come funziona](#7-flusso-oidc--come-funziona)
8. [Implementazione della callback OIDC (da sviluppare)](#8-implementazione-della-callback-oidc-da-sviluppare)
9. [Sicurezza](#9-sicurezza)
10. [Riferimenti ai file del codice sorgente](#10-riferimenti-ai-file-del-codice-sorgente)

---

## 1. Panoramica del sistema AuthProvider

Il sistema **AuthProvider** è un meccanismo di autenticazione modulare e configurabile che permette di gestire più metodi di login dalla tabella `auth_providers` del database PostgreSQL.

Ogni provider rappresenta un metodo di autenticazione (email/password, Microsoft Entra ID, Google, SAML, ecc.) e viene mostrato come card cliccabile nella pagina di login Hub.

### Tipi di provider supportati

| Tipo       | Descrizione                                         | Esempio              |
|------------|-----------------------------------------------------|----------------------|
| `internal` | Autenticazione locale con email e password          | Login classico       |
| `oidc`     | OpenID Connect (OAuth 2.0 + identità)               | Entra ID, Google     |
| `saml`     | Security Assertion Markup Language                  | ADFS, Okta SAML      |
| `custom`   | Provider personalizzato con redirect esterno        | SSO proprietario     |

---

## 2. Architettura e componenti

Il sistema segue il pattern layered con Dependency Injection (Inversify):

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                                                                  │
│  HubLogin (src/pages/HubLogin/index.tsx)                        │
│    ├── Fetch providers: GET /api/auth-providers                  │
│    ├── ProviderCard (components/ProviderCard.tsx)                │
│    │     └── Click → tipo 'internal': espande form              │
│    │     └── Click → tipo 'oidc': redirect a authorize_url      │
│    │     └── Click → tipo 'custom': redirect a redirect_uri     │
│    └── Form email/password (solo per provider 'internal')       │
├─────────────────────────────────────────────────────────────────┤
│                        BACKEND                                   │
│                                                                  │
│  HubController (server/core/controllers/HubController.ts)       │
│    ├── GET  /api/auth-providers        (pubblico)               │
│    ├── POST /api/auth-providers        (Superadmin)             │
│    ├── PUT  /api/auth-providers/:id    (Superadmin)             │
│    └── DELETE /api/auth-providers/:id  (Superadmin)             │
│                          │                                       │
│  AuthProviderService (server/core/services/AuthProviderService) │
│    └── toDTO() → filtra config_server (MAI esposto al client)   │
│                          │                                       │
│  AuthProviderRepository (server/core/repositories/)             │
│    └── Sequelize queries su tabella auth_providers              │
│                          │                                       │
│  AuthProvider Model (server/core/models/auth_provider.ts)       │
│    └── Tabella PostgreSQL: auth_providers                       │
└─────────────────────────────────────────────────────────────────┘
```

### Dependency Injection

I simboli sono registrati in `server/core/di/types.ts`:
- `TYPES.AuthProviderService`
- `TYPES.AuthProviderRepository`

Le istanze sono singleton nel container Inversify (`server/core/di/container.ts`).

---

## 3. Schema del database

**Tabella**: `auth_providers`

| Colonna          | Tipo                                     | Note                                                                 |
|------------------|------------------------------------------|----------------------------------------------------------------------|
| `id`             | `UUID` (PK)                              | Generato automaticamente (UUIDv4)                                    |
| `codice`         | `STRING(50)`, unique                     | Identificativo univoco: `email_password`, `entra_id`, `google`, ecc. |
| `nome`           | `STRING(100)`                            | Nome visualizzato nella card di login                                |
| `descrizione`    | `TEXT`, nullable                          | Descrizione sotto il nome nella card                                 |
| `icona`          | `STRING(50)`, default `'Key'`            | Nome icona dalla libreria Lucide                                     |
| `tipo`           | `ENUM('internal','oidc','saml','custom')` | Determina il comportamento al click                                  |
| `ordine`         | `INTEGER`, default `0`                   | Ordine di visualizzazione (ASC)                                      |
| `attivo`         | `BOOLEAN`, default `true`                | Se `false`, il provider non appare nel login                         |
| `config_client`  | `JSONB`, nullable                         | Configurazione visibile al frontend (vedi sotto)                     |
| `config_server`  | `JSONB`, nullable                         | Segreti server-side — **MAI esposti al client**                      |
| `ruoli_ammessi`  | `JSONB` (array), nullable                 | Array di `TIPO_UTENTI`. `null` = tutti i ruoli                      |
| `createdAt`      | `DATE`                                   | Timestamp creazione                                                  |
| `updatedAt`      | `DATE`                                   | Timestamp ultimo aggiornamento                                       |

### Struttura `config_client` (esposto al frontend)

```jsonc
{
  "authorize_url": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
  "client_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "scope": "openid profile email",
  "redirect_uri": "https://tuodominio.com/api/auth/callback/entra_id",
  "password_reset_url": null  // opzionale, per provider che supportano reset password esterno
}
```

### Struttura `config_server` (solo backend, mai esposto)

```jsonc
{
  "client_secret": "il-segreto-dell-app-azure",
  "token_url": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
  "jwks_uri": "https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys"
}
```

### Indici

- `idx_auth_provider_codice` — unique su `codice`
- `idx_auth_provider_attivo` — su `attivo` (per filtrare velocemente i provider attivi)
- `idx_auth_provider_ordine` — su `ordine` (per l'ordinamento)

---

## 4. Flusso di autenticazione attuale

### Provider `internal` (email/password)

```
Utente apre /login
    │
    ▼
GET /api/auth-providers → lista provider attivi
    │
    ▼
Click su "Email e Password" (tipo: internal)
    │
    ▼
Si espande il form email/password inline
    │
    ▼
Submit → POST /check_login_for_multiple_users
    │
    ├── 1 utente → POST /login_user → sessione → redirect a /hub
    └── N utenti → Modale selezione account → POST /login_user → sessione → redirect a /hub
```

### Provider `oidc` (es. Entra ID)

```
Utente apre /login
    │
    ▼
GET /api/auth-providers → lista provider attivi
    │
    ▼
Click su "Microsoft Entra ID" (tipo: oidc)
    │
    ▼
window.location.href = config_client.authorize_url
    │
    ▼
Redirect al login Microsoft
    │
    ▼
[DA IMPLEMENTARE] Callback con authorization code
```

Il codice frontend che gestisce il click è in `src/pages/HubLogin/index.tsx`:

```typescript
const handleProviderClick = (provider: AuthProviderDTO) => {
  if (provider.tipo === 'internal') {
    // Espande/chiude il form email/password
    setExpandedProvider(expandedProvider === provider.codice ? null : provider.codice);
  } else if (provider.tipo === 'custom' && provider.config_client?.redirect_uri) {
    window.location.href = provider.config_client.redirect_uri;
  } else if (provider.tipo === 'oidc' && provider.config_client?.authorize_url) {
    window.location.href = provider.config_client.authorize_url;
  }
};
```

---

## 5. Configurazione Entra ID su Azure Portal

### Prerequisiti

1. Un tenant Azure AD (Entra ID)
2. Accesso come Global Administrator o Application Administrator

### Passaggi

#### 5.1 Registrare l'applicazione

1. Vai su [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Compila:
   - **Name**: `Fidelity Promotion`
   - **Supported account types**: scegli in base alle tue esigenze:
     - *Single tenant* — solo utenti del tuo tenant
     - *Multitenant* — utenti di qualsiasi organizzazione Azure AD
   - **Redirect URI**:
     - Tipo: `Web`
     - URI: `https://tuodominio.com/api/auth/callback/entra_id`
3. Clicca **Register**

#### 5.2 Annotare i valori

Dalla pagina dell'app appena creata, annota:

| Valore            | Dove trovarlo                        | Uso nel sistema              |
|-------------------|--------------------------------------|------------------------------|
| Application (client) ID | Overview                      | `config_client.client_id`    |
| Directory (tenant) ID   | Overview                      | Parte degli URL              |
| Client Secret           | Certificates & secrets → New  | `config_server.client_secret`|

#### 5.3 Configurare i permessi API

1. **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**
2. Seleziona:
   - `openid`
   - `profile`
   - `email`
3. Clicca **Grant admin consent** (se necessario)

#### 5.4 Configurare il token

1. **Token configuration** → **Add optional claim**
2. Token type: **ID**
3. Seleziona: `email`, `family_name`, `given_name`

---

## 6. Registrazione del provider nel database

### Opzione A: Via seed automatico

Aggiungi il provider nell'array `DEFAULT_PROVIDERS` in `server/core/scripts/seedHubData.ts`:

```typescript
const DEFAULT_PROVIDERS = [
  {
    codice: 'email_password',
    nome: 'Email e Password',
    descrizione: 'Accedi con le tue credenziali email e password',
    icona: 'Mail',
    tipo: 'internal' as const,
    ordine: 0,
    attivo: true,
  },
  {
    codice: 'entra_id',
    nome: 'Microsoft Entra ID',
    descrizione: 'Accedi con il tuo account aziendale Microsoft',
    icona: 'ShieldCheck',
    tipo: 'oidc' as const,
    ordine: 1,
    attivo: true,
    config_client: {
      authorize_url: 'https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/authorize',
      client_id: '{CLIENT_ID}',
      scope: 'openid profile email',
      redirect_uri: 'https://tuodominio.com/api/auth/callback/entra_id',
    },
    config_server: {
      client_secret: '{CLIENT_SECRET}',
      token_url: 'https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token',
      jwks_uri: 'https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys',
    },
    ruoli_ammessi: null, // null = tutti i ruoli possono usarlo
  },
];
```

> **Nota**: In produzione i valori sensibili (`CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID`) dovrebbero provenire da variabili d'ambiente, non hardcoded.

### Opzione B: Via API (richiede sessione Superadmin)

```bash
curl -X POST https://tuodominio.com/api/auth-providers \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=<SESSION_COOKIE>" \
  -d '{
    "codice": "entra_id",
    "nome": "Microsoft Entra ID",
    "descrizione": "Accedi con il tuo account aziendale Microsoft",
    "icona": "ShieldCheck",
    "tipo": "oidc",
    "ordine": 1,
    "attivo": true,
    "config_client": {
      "authorize_url": "https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/authorize",
      "client_id": "{CLIENT_ID}",
      "scope": "openid profile email",
      "redirect_uri": "https://tuodominio.com/api/auth/callback/entra_id"
    },
    "config_server": {
      "client_secret": "{CLIENT_SECRET}",
      "token_url": "https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token",
      "jwks_uri": "https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys"
    },
    "ruoli_ammessi": null
  }'
```

### Limitare il provider a ruoli specifici

Se vuoi che Entra ID sia disponibile solo per certi tipi di utente:

```json
{
  "ruoli_ammessi": ["GDO", "AdminGDO", "Superadmin"]
}
```

Se `ruoli_ammessi` è `null` o un array vuoto, il provider è visibile a tutti.

---

## 7. Flusso OIDC — Come funziona

### Diagramma completo del flusso Authorization Code

```
┌──────────┐     ┌──────────────┐     ┌───────────────────┐
│  Browser  │     │  FP Server   │     │  Microsoft Entra  │
└─────┬─────┘     └──────┬───────┘     └────────┬──────────┘
      │                   │                      │
      │ 1. Click "Entra ID"                      │
      │──────────────────────────────────────────>│
      │   GET authorize_url?                      │
      │     client_id=XXX                         │
      │     response_type=code                    │
      │     redirect_uri=.../callback/entra_id    │
      │     scope=openid profile email            │
      │     state=RANDOM_CSRF_TOKEN               │
      │     nonce=RANDOM_NONCE                    │
      │                                           │
      │ 2. Pagina login Microsoft                 │
      │<──────────────────────────────────────────│
      │                                           │
      │ 3. Utente inserisce credenziali           │
      │──────────────────────────────────────────>│
      │                                           │
      │ 4. Redirect a redirect_uri                │
      │<──────────────────────────────────────────│
      │   ?code=AUTH_CODE&state=RANDOM_CSRF_TOKEN │
      │                                           │
      │ 5. Browser segue redirect                 │
      │─────────────────>│                        │
      │  GET /api/auth/  │                        │
      │  callback/       │                        │
      │  entra_id?       │                        │
      │  code=AUTH_CODE  │                        │
      │                  │                        │
      │                  │ 6. Scambia code → token│
      │                  │───────────────────────>│
      │                  │  POST token_url        │
      │                  │    code=AUTH_CODE       │
      │                  │    client_secret=XXX    │
      │                  │    grant_type=          │
      │                  │    authorization_code   │
      │                  │                        │
      │                  │ 7. Riceve tokens       │
      │                  │<───────────────────────│
      │                  │  { access_token,       │
      │                  │    id_token,           │
      │                  │    refresh_token }     │
      │                  │                        │
      │                  │ 8. Valida id_token     │
      │                  │    (verifica firma     │
      │                  │     con jwks_uri)      │
      │                  │                        │
      │                  │ 9. Estrae claims:      │
      │                  │    email, nome,        │
      │                  │    cognome, oid        │
      │                  │                        │
      │                  │ 10. Cerca/crea utente  │
      │                  │     nel DB locale      │
      │                  │                        │
      │                  │ 11. Crea sessione      │
      │                  │     express-session    │
      │                  │                        │
      │ 12. Redirect     │                        │
      │<─────────────────│                        │
      │  302 → /hub      │                        │
      │  Set-Cookie:     │                        │
      │  connect.sid=... │                        │
      │                                           │
      │ 13. Utente è loggato su /hub              │
      └───────────────────────────────────────────┘
```

### Dettaglio dei parametri nell'authorize URL

Quando il frontend fa il redirect (step 1), l'URL completo sarà:

```
https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/authorize
  ?client_id={CLIENT_ID}
  &response_type=code
  &redirect_uri=https://tuodominio.com/api/auth/callback/entra_id
  &scope=openid%20profile%20email
  &state={RANDOM_STATE}       ← protezione CSRF
  &nonce={RANDOM_NONCE}       ← protezione replay
  &response_mode=query
```

> **Nota**: Attualmente il frontend fa un redirect diretto a `config_client.authorize_url`. Per aggiungere i parametri `state` e `nonce` (raccomandato per sicurezza), sarà necessario comporre l'URL dinamicamente.

---

## 8. Implementazione della callback OIDC (da sviluppare)

Questa parte è stata **implementata**. Di seguito la descrizione dell'implementazione.

### 8.1 Nuovo endpoint: `GET /api/auth/callback/entra_id`

Da aggiungere nel `HubController`:

```typescript
// Pubblico — callback OAuth2 da Entra ID
this.router.get('/auth/callback/entra_id', this.handleEntraIdCallback.bind(this));
```

### 8.2 Logica della callback (pseudocodice)

```typescript
private async handleEntraIdCallback(req: Request, res: Response): Promise<void> {
  try {
    const { code, state, error, error_description } = req.query;

    // 1. Gestisci errori da Azure
    if (error) {
      return res.redirect(`/login?reason=entra_error&message=${error_description}`);
    }

    // 2. Valida il parametro state (CSRF protection)
    //    Confronta con il valore salvato in sessione prima del redirect

    // 3. Recupera la configurazione server del provider
    const provider = await this.authProviderService.getProviderByCode('entra_id');
    const serverConfig = await this.authProviderRepository.findByCode('entra_id');
    const { client_secret, token_url, jwks_uri } = serverConfig.config_server;
    const { client_id, redirect_uri } = provider.config_client;

    // 4. Scambia il code con i token
    const tokenResponse = await fetch(token_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        client_id,
        client_secret,
        redirect_uri,
      }),
    });
    const tokens = await tokenResponse.json();

    // 5. Valida l'id_token
    //    Usa libreria 'jose' per verificare la firma JWT con le chiavi da jwks_uri
    //    Verifica: iss, aud, exp, nonce

    // 6. Estrai i claims dell'utente dall'id_token
    const { email, name, oid, preferred_username } = decodedToken;

    // 7. Cerca l'utente nel DB per email
    //    Se non esiste: crea nuovo utente o rifiuta (in base alla policy)
    //    Se esiste: aggiorna eventualmente i dati

    // 8. Crea la sessione (come fa il login classico)
    req.session.id_utente = user.id;
    req.session.email = user.email;
    req.session.tipo_utente = user.tipo;
    // ... altri dati sessione

    // 9. Redirect al frontend
    res.redirect('/hub');

  } catch (error) {
    log.error('EntraID callback error:', error);
    res.redirect('/login?reason=entra_error');
  }
}
```

### 8.3 Librerie consigliate

| Libreria      | Scopo                                      | Note                               |
|---------------|--------------------------------------------|-------------------------------------|
| `jose`        | Validazione JWT, verifica JWKS             | Leggera, zero dipendenze           |
| `openid-client` | Client OIDC completo                     | Gestisce tutto il flusso           |

> **NON serve MSAL lato server**. MSAL è utile solo se si vuole usare il flusso interattivo lato client (SPA). Il nostro flusso è server-side (Authorization Code), quindi `jose` o `openid-client` sono sufficienti.

### 8.4 Gestione utenti — Strategie possibili

| Strategia           | Descrizione                                               | Quando usarla                    |
|---------------------|-----------------------------------------------------------|----------------------------------|
| **Solo matching**   | L'utente deve già esistere nel DB con la stessa email      | Utenti pre-registrati            |
| **Auto-provisioning** | Se l'utente non esiste, viene creato automaticamente    | Onboarding automatico            |
| **Linking**         | L'utente esistente collega il suo account Entra ID        | Migrazione graduale              |

### 8.5 Miglioramento frontend (opzionale)

Per aggiungere i parametri `state` e `nonce` all'URL di autorizzazione, modificare `handleProviderClick` in `HubLogin/index.tsx`:

```typescript
const handleProviderClick = (provider: AuthProviderDTO) => {
  if (provider.tipo === 'oidc' && provider.config_client?.authorize_url) {
    const state = crypto.randomUUID();
    sessionStorage.setItem('oidc_state', state);

    const params = new URLSearchParams({
      client_id: provider.config_client.client_id!,
      response_type: 'code',
      redirect_uri: provider.config_client.redirect_uri!,
      scope: provider.config_client.scope || 'openid profile email',
      state,
      nonce: crypto.randomUUID(),
      response_mode: 'query',
    });

    window.location.href = `${provider.config_client.authorize_url}?${params}`;
  }
  // ... resto della logica
};
```

---

## 9. Sicurezza

### 9.1 Separazione config_client / config_server

Il `AuthProviderService` espone al frontend solo i dati necessari tramite la funzione `toDTO()`:

```typescript
function toDTO(provider: AuthProvider): AuthProviderDTO {
  return {
    id: provider.id,
    codice: provider.codice,
    nome: provider.nome,
    descrizione: provider.descrizione ?? undefined,
    icona: provider.icona,
    tipo: provider.tipo,
    ordine: provider.ordine,
    attivo: provider.attivo,
    config_client: provider.config_client ?? undefined,
    // config_server is NEVER exposed ← IL CLIENT SECRET NON ESCE MAI
  };
}
```

### 9.2 Parametro `state` (CSRF protection)

Il parametro `state` nel flusso OIDC serve a prevenire attacchi CSRF:
1. Il frontend genera un valore random e lo salva in `sessionStorage`
2. Lo passa come parametro nella richiesta di autorizzazione
3. Azure lo restituisce nella callback
4. Il server (o il frontend) verifica che corrisponda

### 9.3 Validazione del token

L'`id_token` ricevuto da Azure deve essere validato verificando:
- **Firma**: usando le chiavi pubbliche da `jwks_uri`
- **Issuer (`iss`)**: deve corrispondere a `https://login.microsoftonline.com/{TENANT_ID}/v2.0`
- **Audience (`aud`)**: deve corrispondere al `client_id` dell'app
- **Expiry (`exp`)**: il token non deve essere scaduto
- **Nonce**: deve corrispondere al valore inviato nella richiesta

### 9.4 Accesso admin limitato

Solo gli utenti con `tipo_utente === SUPERADMIN` possono creare, modificare o eliminare provider tramite le API:

```typescript
if (req.session?.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
  this.sendResponse(res, HttpStatusCode.FORBIDDEN, {
    message: 'Solo Superadmin può creare provider'
  });
  return;
}
```

### 9.5 Filtro per ruolo

Il campo `ruoli_ammessi` permette di limitare la visibilità di un provider a certi ruoli. Il filtro avviene nel repository:

```typescript
if (userType) {
  return providers.filter(p => {
    const ruoli = p.ruoli_ammessi;
    return !ruoli || ruoli.length === 0 || ruoli.includes(userType);
  });
}
```

---

## 10. Riferimenti ai file del codice sorgente

| Componente                | File                                                          |
|---------------------------|---------------------------------------------------------------|
| **Modello DB**            | `server/core/models/auth_provider.ts`                         |
| **Repository**            | `server/core/repositories/AuthProviderRepository.ts`          |
| **Interfaccia Service**   | `server/core/interfaces/IAuthProviderService.ts`              |
| **Service**               | `server/core/services/AuthProviderService.ts`                 |
| **Controller**            | `server/core/controllers/HubController.ts`                    |
| **Seed dati default**     | `server/core/scripts/seedHubData.ts`                          |
| **Tipi TypeScript**       | `lib/types.ts` (interfaccia `AuthProviderDTO`)                |
| **DI Symbols**            | `server/core/di/types.ts` (`TYPES.AuthProviderService`, ecc.) |
| **DI Container**          | `server/core/di/container.ts`                                 |
| **Pagina Login**          | `src/pages/HubLogin/index.tsx`                                |
| **Card Provider**         | `src/pages/HubLogin/components/ProviderCard.tsx`              |
| **Background animato**    | `src/pages/HubLogin/components/HubBackground.tsx`             |
| **Banner sessione**       | `src/pages/HubLogin/components/SessionExpiredBanner.tsx`      |

---

## Checklist per attivare Entra ID

- [ ] Registrare l'app su Azure Portal (sezione 5)
- [ ] Inserire il record provider nel DB con `config_client` e `config_server` (sezione 6)
- [ ] Implementare l'endpoint di callback `GET /api/auth/callback/entra_id` (sezione 8)
- [ ] Installare libreria `jose` o `openid-client` per validazione JWT
- [ ] Aggiornare il frontend per comporre l'authorize URL con `state` e `nonce` (sezione 8.5)
- [ ] Definire la strategia di gestione utenti: matching, auto-provisioning, o linking (sezione 8.4)
- [ ] Testare il flusso end-to-end in ambiente di sviluppo
- [ ] Verificare che `config_server` non venga mai esposto nelle risposte API
