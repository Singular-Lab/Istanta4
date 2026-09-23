# Deployment set `fidelity-olimpo`

Questa cartella contiene tutto ciò che serve per far girare **Fidelity e Olimpo**
su una macchina target gestita da Company.AI.Runner. È materiale di macchina, non
di release: lo si copia una volta quando si prepara il target, e da lì in poi
non lo si tocca più. Gli aggiornamenti di versione li applica il Runner
riscrivendo le sole variabili immagine in `release.env`.

| File | A cosa serve |
| --- | --- |
| `compose.production.yaml` | I servizi. Lo esegue il Runner, non va lanciato a mano. |
| `release.env.example` | Variabili di sostituzione del compose. Il Runner ci scrive dentro `FIDELITY_IMAGE` e `OLIMPO_IMAGE`. |
| `fidelity.env.example` | Ambiente iniettato nel container Fidelity: credenziali e segreti. |
| `olimpo.env.example` | Ambiente iniettato nel container Olimpo: credenziali e segreti. |
| `postgres-init/` | Script eseguito al primo avvio di PostgreSQL: estensioni e database di Olimpo. |
| `proxy-templates/` | Configurazione di nginx, l'unica origine con cui parla il browser. |

Cosa non c'è, di proposito:

- **Lo stack di osservabilità** (Prometheus, Grafana, Loki, Promtail): richiede i
  file di `fidelity/docker/observability` montati accanto al compose. Si aggiunge
  come passo successivo, quando questo deployment è verificato.
- **Istanta e Correggo4**, che sono altri componenti della suite.

PostgreSQL, MongoDB e Redis invece ci sono, e non sono componenti della release:
il ControlPlane non li conosce e il Runner non li aggiorna. PostgreSQL usa
l'immagine **PostGIS**, non `postgres` semplice, perché il database di Fidelity
usa `DataTypes.GEOMETRY`; con l'immagine normale il primo `models:sync`
fallisce. Ogni componente ha il suo database e il suo ruolo: `fidelity` lo crea
l'immagine leggendo `POSTGRES_DB`/`POSTGRES_USER`, `olimpo` lo crea
`postgres-init/01-init-databases.sh` al primo avvio.

Nginx c'è per una ragione che non è la comodità: l'immagine di Fidelity contiene
solo il server Node, e il bundle del frontend è costruito con URL **relative**
(`VITE_API_URL=/api`, `VITE_WS_URL=/`). La SPA quindi presuppone che pagina, API
e WebSocket stiano sulla stessa origine, mentre nell'applicazione il WebSocket
ascolta su una porta diversa. Senza il proxy il socket non si connette.

Il TLS non è un di più. La CSP dell'applicazione contiene
`upgrade-insecure-requests` quando `NODE_ENV=production`
(`server/core/middleware/securityMiddleware.ts`): servita in chiaro, la pagina
arriva ma il browser richiede da solo ogni risorsa in `https` e fallisce con
`ERR_SSL_PROTOCOL_ERROR`. Con il certificato davanti, gli header di sicurezza
di Fidelity funzionano come previsto invece di doverli rimuovere.

MongoDB serve a Fidelity per la configurazione di WebPliant. Lo schema Zod
dichiara `MONGO_URL` opzionale, ma `server/core/models/mongoose.ts` apre la
connessione al caricamento del modulo: senza, il processo termina prima di
mettersi in ascolto. Il servizio non pubblica porte e non ha autenticazione,
perché è raggiungibile solo dalla rete interna del progetto.

Le credenziali stanno in `release.env`, non nei due file d'ambiente delle
applicazioni: sono la stessa cosa per il container che inizializza il database e
per chi ci si connette, e tenerle in un posto solo evita che divergano.

## 1. Catalogo ControlPlane

Nella pagina Progetti, per il progetto `istanta4`, i due componenti devono avere
la variabile immagine allineata al compose:

| Componente | `EnvironmentVariable` |
| --- | --- |
| `fidelity` | `FIDELITY_IMAGE` |
| `olimpo` | `OLIMPO_IMAGE` |

Se i nomi non coincidono, il Runner scrive variabili che il compose non legge e
`docker compose up` fallisce sul `:?` dell'immagine mancante.

## 2. Preparare il target

`/percorso/bundle` è la directory in cui hai copiato questa cartella sul target,
per esempio `/tmp/fidelity-olimpo`.

```bash
sudo mkdir -p /opt/company-ai/projects/istanta4
cd /opt/company-ai/projects/istanta4

sudo cp /percorso/bundle/compose.production.yaml .
sudo cp /percorso/bundle/prepare-target.sh .
sudo cp -r /percorso/bundle/postgres-init .
sudo cp -r /percorso/bundle/proxy-templates .
sudo cp /percorso/bundle/release.env.example   release.env
sudo cp /percorso/bundle/fidelity.env.example  fidelity.env
sudo cp /percorso/bundle/olimpo.env.example    olimpo.env
sudo chmod 600 release.env fidelity.env olimpo.env
sudo chmod +x prepare-target.sh
```

Compilare poi i tre file: porte in `release.env`, credenziali e segreti negli
altri due. `FIDELITY_IMAGE` e `OLIMPO_IMAGE` non vanno aggiunte a mano, le scrive
il Runner al primo deployment.

E **poi**, prima di distribuire:

```bash
sudo ./prepare-target.sh
```

Lo script crea `fidelity-config` assegnandola a `node` (UID 1000, che è l'utente
con cui gira Fidelity e che deve poter riscrivere `config/menu.json`), verifica
che `postgres-init` e `proxy-templates` contengano davvero i file — non che le
cartelle esistano — e controlla una per una le variabili obbligatorie di
`fidelity.env`, comprese quelle che lo schema vuole come URL assoluti o come
numeri. Si ferma elencando cosa manca.

Controlla anche due incoerenze che passano ogni verifica presa da sola e poi non
funzionano nel browser: `CLIENT_URL` in `https://` senza certificato del proxy, e
`CLIENT_URL` in `http://` senza `FIDELITY_NODE_ENV=development` — nel secondo
caso la CSP applica `upgrade-insecure-requests`, la pagina resta bianca e nei log
del server non compare nulla.

Un ultimo avviso riguarda i `$` nei valori di `release.env`: quel file lo usa
docker compose per l'interpolazione, e un `$` seguito da lettere viene preso per
il nome di un'altra variabile. Una password come `segreta$dollaro` arriva al
container come `segreta`, senza che nessuno protesti. Con una cifra subito dopo
il dollaro il problema non si pone; in ogni caso si può raddoppiare: `$$`.

Fidelity valida il proprio ambiente con Zod all'avvio (`server/core/config/index.ts`):
se manca una delle variabili obbligatorie elencate in `fidelity.env.example`, stampa
quali e termina con exit 1. Il container muore prima di diventare healthy, `up --wait`
scade e il Runner fa rollback su un deployment che in realtà è sano. Vale la pena
compilarle tutte prima del primo deployment. Attenzione in particolare a `CLIENT_URL`:
senza TLS deve iniziare con `http://`, perché con `https://` il cookie di sessione
diventa secure e il login non funziona.

### I percorsi dei mount vanno assoluti

`POSTGRES_INIT_DIR` e `FIDELITY_CONFIG_DIR` in `release.env` devono essere
percorsi **assoluti dell'host**, e le directory devono esistere con il contenuto
giusto prima del primo avvio.

Il motivo è che il Runner esegue `docker compose` da dentro il proprio
container, parlando con il daemon dell'host. Un percorso relativo come
`./postgres-init` verrebbe risolto nella directory di lavoro del Runner,
`/deployments/istanta4`, che sull'host non esiste: Docker non segnala niente,
crea una directory vuota e il container si ritrova senza quei file. Nel caso di
`postgres-init` il risultato è che il ruolo di Olimpo non viene mai creato, e
l'errore compare molto più tardi come `password authentication failed`.

Sull'host non serve più nessun PostgreSQL: niente database da creare a mano,
niente `listen_addresses`, niente `pg_hba.conf`. Le password però vanno scelte
**prima** del primo avvio e scritte in `release.env`, perché è in quel momento
che il container crea database e ruoli.

L'inizializzazione avviene **una volta sola**, quando il volume `postgres_data` è
vuoto. Due conseguenze pratiche:

- cambiare una password in `release.env` dopo il primo avvio non la cambia dentro
  il database, e l'applicazione smette di connettersi: serve un `ALTER ROLE`
  dentro il container e poi riallineare il file;
- se lo script di init fallisce a metà, il volume resta inizializzato
  parzialmente e non viene rieseguito, ma il container risulta comunque sano.
  Si riparte con `docker compose down -v`, che **cancella i dati**.

Per la manutenzione PostgreSQL è raggiungibile dall'host su `127.0.0.1:5433`
(`POSTGRES_HOST_PORT`), non dall'esterno:

```bash
psql -h 127.0.0.1 -p 5433 -U fidelity -d fidelity
```

### Il certificato del proxy

`PROXY_CERT_DIR` deve contenere `fullchain.pem` e `privkey.pem`. Su un indirizzo
di LAN si genera un certificato autofirmato, con l'indirizzo IP nel SAN — senza,
i browser lo rifiutano a prescindere:

```bash
sudo mkdir -p /opt/company-ai/projects/istanta4/proxy-certs
cd /opt/company-ai/projects/istanta4/proxy-certs
sudo openssl req -x509 -nodes -newkey rsa:2048 -days 825   -keyout privkey.pem -out fullchain.pem   -subj "/CN=192.168.1.66"   -addext "subjectAltName=IP:192.168.1.66"
sudo chmod 600 privkey.pem
```

Il browser mostrerà un avviso perché la CA non è nota: si accetta una volta. Il
giorno in cui il target avrà un nome DNS e un certificato vero, si sostituiscono
questi due file e non cambia altro.

`CLIENT_URL` in `fidelity.env` deve coincidere con l'indirizzo del proxy, schema
compreso:

```properties
CLIENT_URL=https://192.168.1.66:8081
```

Le porte 3010 e 3400 restano pubblicate ma non vanno usate dal browser: servono
solo al proxy e alla diagnosi.

### Il proxy si avvia una volta

`proxy` dipende da `fidelity`, non viceversa, quindi il deployment selettivo del
Runner (`up -d --wait fidelity olimpo`) non lo avvia. Si avvia a mano la prima
volta e poi resta su, anche attraverso le release, perché instrada per nome di
servizio:

```bash
docker compose --env-file release.env -f compose.production.yaml up -d proxy
```

### Dopo il primo avvio: `seed-fidelity.sh`

Su un database nuovo Fidelity parte ma non ci si entra: non esiste alcun metodo
di accesso, nessun utente e nessuna voce di menu. Dopo il primo deployment:

```bash
sudo ./seed-fidelity.sh
```

Inserisce il provider `email_password`, l'utente amministratore preso da
`FIDELITY_ADMIN_*` di `release.env` (password cifrata con bcrypt) e le 33 voci di
menu del Superadmin.

Non sta in `postgres-init` per una ragione precisa: `auth_providers`, `utenti` e
`menu_items` le crea Sequelize quando Fidelity parte, quindi durante
l'inizializzazione di PostgreSQL non esistono ancora. Definirle a mano nello
script di init significherebbe duplicare i modelli, e la copia divergerebbe al
primo campo aggiunto.

Lo script è idempotente: rilanciarlo non duplica nulla e non tocca quello che c'è
già, quindi si può rieseguire anche solo per aggiungere le voci di menu
introdotte da una versione nuova.

## 3. Configurare il Runner

In `/opt/company-ai/runner/compose.yaml`, sotto `environment` del servizio
`runner`:

```yaml
      Runner__Projects__istanta4__WorkingDirectory: /deployments/istanta4
      Runner__Projects__istanta4__ComposeFile: compose.production.yaml
      Runner__Projects__istanta4__EnvironmentFile: release.env
      Runner__Projects__istanta4__Components__fidelity__ComposeService: fidelity
      Runner__Projects__istanta4__Components__olimpo__ComposeService: olimpo
```

e, sotto `volumes`:

```yaml
      - ${ISTANTA4_PROJECT_DIR:?Set ISTANTA4_PROJECT_DIR in .env}:/deployments/istanta4
```

In `/opt/company-ai/runner/.env`:

```properties
ISTANTA4_PROJECT_DIR=/opt/company-ai/projects/istanta4
RUNNER_COMPOSE_WAIT_SECONDS=300
```

`RUNNER_COMPOSE_WAIT_SECONDS` va alzato dai 120 secondi di default: Fidelity ha
uno `start_period` di 120 secondi perché il suo entrypoint sincronizza i modelli
prima di avviare il server, e con il timeout di default `docker compose up --wait`
scadrebbe prima che il container diventi healthy, facendo fallire e rollbackare un
deployment in realtà sano.

Le due voci `Components__` limitano il target a questi due componenti: il Runner
comunica la allowlist al ControlPlane durante il claim e i comandi Compose vengono
eseguiti solo sui servizi scelti, senza `--remove-orphans`. Se il ControlPlane non
conferma la selezione, il Runner rifiuta il deployment invece di installare tutta
la suite.

Poi, da `/opt/company-ai/runner`:

```bash
sudo docker compose config
sudo docker compose up -d
```

## 4. Verificare

Il primo deployment vero si lancia dal ControlPlane. Per controllare prima che la
configurazione sia coerente, senza avviare nulla:

```bash
cd /opt/company-ai/projects/istanta4
sudo docker compose --env-file release.env -f compose.production.yaml config -q
```

Finché il Runner non ha scritto le variabili immagine, questo comando fallisce
segnalando `FIDELITY_IMAGE` mancante: è il comportamento atteso, non un errore di
configurazione.

Se il deployment fallisce subito dopo il `pull`, il primo posto da guardare è
`sudo docker compose logs fidelity`: `Errore di validazione della configurazione`
seguito dall'elenco delle variabili significa che manca qualcosa in `fidelity.env`.

Durante il deployment i log utili sono due: `sudo docker compose logs -f runner`
in `/opt/company-ai/runner` per il Runner, e i log dei singoli servizi in questa
directory. Il Runner, se `up --wait` fallisce, ripristina automaticamente le
immagini precedenti.
