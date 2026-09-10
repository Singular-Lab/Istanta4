<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Security configuration

### Security perimeter

- Le pagine private `/olimpo/private*` e gli endpoint `/olimpo/impostazioni/*` sono riservati alla dashboard privata.
- Gli endpoint pubblici di consultazione media restano pubblici per scelta di progetto:
  `/olimpo/foto/*`, `/olimpo/materiali/getMaterialePDF`, `/olimpo/materiali/getThumbnailMaterialePdfs`,
  `/olimpo/materiali/getPagineMaterialePDF`, `/olimpo/materiali/getVideoOnDemand`.
- Se un IP non e autorizzato per la dashboard privata, il browser viene reindirizzato alla pagina HTML
  `/olimpo/private-forbidden`.

### `.env` utili per restare sicuro

Questi sono i campi di configurazione rilevanti per la sicurezza della dashboard privata e delle integrazioni sensibili.

| Campo | Obbligatorio | Default | Consiglio |
| --- | --- | --- | --- |
| `PRIVATE_DASHBOARD_SECRET` | Consigliato fortemente | fallback su `FICO_SECRET` | Usa una secret dedicata, lunga e casuale, diversa da tutte le altre. |
| `FICO_SECRET` | Si | nessuno | Serve ancora ad altre parti del sistema; non riutilizzarla come secret condivisa pubblicamente. |
| `PRIVATE_DASHBOARD_ALLOWED_IPS` | No | vuoto | Usa una allowlist IP separata da virgole, ad esempio `127.0.0.1,::1,203.0.113.10`. |
| `PRIVATE_SESSION_TTL_HOURS` | No | `8` | Durata massima della sessione dashboard. In produzione usa valori contenuti. |
| `PRIVATE_SESSION_IDLE_MINUTES` | No | `30` | Timeout di inattivita. Riducilo se vuoi sessioni piu strette. |
| `PRIVATE_SESSION_MAX_ACTIVE` | No | `3` | Numero massimo di sessioni dashboard contemporanee consentite. |
| `PRIVATE_SESSION_BIND_USER_AGENT` | No | `true` | Lascia `true` per legare la sessione al browser che l ha aperta. |
| `PRIVATE_SESSION_BIND_IP` | No | `false` | Metti `true` solo se gli IP client sono stabili e prevedibili. |
| `PRIVATE_SESSION_SLIDING` | No | `true` | Se `true`, la sessione si rinnova mentre l utente e attivo. |
| `FORCE_SECURE_COOKIES` | No | `false` | In produzione con HTTPS metti `true` per forzare cookie `Secure`. |
| `CORS_ORIGINS` | Consigliato in produzione | solo `localhost` / `127.0.0.1` se vuoto | Inserisci solo gli origin frontend autorizzati, separati da virgole. |
| `NODE_ENV` | Consigliato | `development` implicito | In produzione imposta `production` per abilitare comportamento piu sicuro e HSTS. |

### Campi sensibili da proteggere

Anche se non sono parametri "dashboard", questi valori non devono mai essere esposti o committati:

- `DB_PASSWORD`
- `ISTANTA_AUTH_TOKEN`
- `FICO_SECRET`
- `PRIVATE_DASHBOARD_SECRET`

### Configurazione consigliata per produzione

```env
NODE_ENV=production

FICO_SECRET=metti-qui-una-secret-lunga-e-casuale-per-le-integrazioni
PRIVATE_DASHBOARD_SECRET=metti-qui-una-secret-diversa-e-dedicata-alla-dashboard

PRIVATE_DASHBOARD_ALLOWED_IPS=203.0.113.10,198.51.100.20

PRIVATE_SESSION_TTL_HOURS=8
PRIVATE_SESSION_IDLE_MINUTES=30
PRIVATE_SESSION_MAX_ACTIVE=2
PRIVATE_SESSION_BIND_USER_AGENT=true
PRIVATE_SESSION_BIND_IP=false
PRIVATE_SESSION_SLIDING=true

FORCE_SECURE_COOKIES=true
CORS_ORIGINS=https://admin.example.com
```

### Raccomandazioni operative

- Usa sempre HTTPS davanti all applicazione.
- Se sei dietro reverse proxy, inoltra correttamente `X-Forwarded-Proto: https`.
- Non riutilizzare `FICO_SECRET` come secret della dashboard: preferisci `PRIVATE_DASHBOARD_SECRET`.
- Mantieni `PRIVATE_DASHBOARD_ALLOWED_IPS` il piu stretto possibile.
- Riduci `PRIVATE_SESSION_MAX_ACTIVE` a `1` o `2` se l area privata e usata da poche persone.
- Attiva `PRIVATE_SESSION_BIND_IP=true` solo se gli utenti entrano da IP stabili; con reti mobili, VPN variabili o proxy aggressivi puo creare logout indesiderati.
- Non pubblicare mai il file `.env`.
- Ruota periodicamente `FICO_SECRET`, `PRIVATE_DASHBOARD_SECRET` e `ISTANTA_AUTH_TOKEN`.
- Per la UI privata usa `npm run build` per la build completa oppure `cd ui && npm run build` se vuoi rigenerare solo la SPA React.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
