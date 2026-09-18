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

Cosa non c'è, di proposito:

- **PostgreSQL**, che gira sull'host come nel compose di produzione di Fidelity. I
  container lo raggiungono via `host.docker.internal`.
- **Lo stack di osservabilità** (Prometheus, Grafana, Loki, Promtail): richiede i
  file di `fidelity/docker/observability` montati accanto al compose. Si aggiunge
  come passo successivo, quando questo deployment è verificato.
- **Istanta e Correggo4**, che sono altri componenti della suite.

Redis invece c'è: è una dipendenza interna di Fidelity, non un componente della
release. Il ControlPlane non la conosce e il Runner non la aggiorna.

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

```bash
sudo mkdir -p /opt/company-ai/projects/istanta4/fidelity-config
cd /opt/company-ai/projects/istanta4

sudo cp /percorso/bundle/compose.production.yaml .
sudo cp /percorso/bundle/release.env.example   release.env
sudo cp /percorso/bundle/fidelity.env.example  fidelity.env
sudo cp /percorso/bundle/olimpo.env.example    olimpo.env
sudo chmod 600 fidelity.env olimpo.env
```

Compilare poi i tre file: porte in `release.env`, credenziali e segreti negli
altri due. `FIDELITY_IMAGE` e `OLIMPO_IMAGE` non vanno aggiunte a mano, le scrive
il Runner al primo deployment.

Fidelity valida il proprio ambiente con Zod all'avvio (`server/core/config/index.ts`):
se manca una delle variabili obbligatorie elencate in `fidelity.env.example`, stampa
quali e termina con exit 1. Il container muore prima di diventare healthy, `up --wait`
scade e il Runner fa rollback su un deployment che in realtà è sano. Vale la pena
compilarle tutte prima del primo deployment. Attenzione in particolare a `CLIENT_URL`:
senza TLS deve iniziare con `http://`, perché con `https://` il cookie di sessione
diventa secure e il login non funziona.

`fidelity-config` deve esistere **prima** del primo avvio: è montata in
`/app/config` e, se manca, Docker la crea vuota e di proprietà di root, con un
errore che si manifesta solo dentro l'applicazione.

Sull'host servono inoltre:

- i database `fidelity` e `olimpo` già creati, con gli utenti indicati nei due
  file `.env`;
- PostgreSQL in ascolto sull'interfaccia raggiungibile dai container (non solo su
  `127.0.0.1`) e un `pg_hba.conf` che ammetta la subnet Docker.

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
