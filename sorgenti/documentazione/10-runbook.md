# Runbook — come si lavora

Due ambienti: il **server demo in LAN**, che resta, e la **tua istanza locale**, che è dove si
lavora d'ora in poi.

---

# Parte 1 — far partire un'istanza locale

## Cosa serve installato

- **.NET SDK 10** (`dotnet --version` deve dare `10.0.x`; sul demo è `10.0.400`)
- **PostgreSQL** raggiungibile — è il database del **cliente** su cui vuoi lavorare
- **Redis** — serve alla sessione: senza, non resti autenticato
- **Node** solo se vuoi far girare anche olimpo o fidelity in locale

## 1. Clona

```bash
git clone https://github.com/rapidmind/Istanta4.git
cd Istanta4
```

## 2. Crea `appsettings.json` — il passo che blocca tutti

**`appsettings.json` non è in git.** Il `.gitignore` ha la riga `appsettings*.json`, quindi
clonando non ce l'hai e l'applicazione non parte.

Il modello è **`soluzione/appsettings.pgtest.json`** (questo sì è in git, perché ha un altro nome).
La struttura completa, campo per campo:

```jsonc
{
  "Logging": { "LogLevel": { "Default": "Information",
                             "Microsoft.AspNetCore": "Warning" } },
  "AllowedHosts": "*",
  "Urls": "http://0.0.0.0:5076",              // la porta su cui ascolta

  "ConnectionStrings": {
    "IstandaConnectionDb": "Host=…;Port=5432;Database=…;Username=…;Password=…",
    "IstantaSession":      "…"                 // Redis
  },

  "jpg_path_foto":  { "path": "…/storage/jpg/" },
  "path_to_export": { "path": "…/pubblicato/wwwroot/exported_files/" },
  "path_to_import": { "path": "…/pubblicato/wwwroot/imported_files/" },

  "external_paths": {
    "pathLib":    "…/pubblicato/wwwroot/external_lib/",      // dove sta AgenziaLib.dll
    "pathSource": "…/pubblicato/wwwroot/external_source/Famila/"   // ← IL CLIENTE
  },

  "sync_options": {
    "extractPath": "…/storage/estrazioni/",
    "extPreLavorazione":  [ … ],
    "extPostLavorazione": [ … ],
    "delimitersQuery":    [ … ],
    "delimitersIndexRules": [ … ],
    "fotoAmbientateKeyWordsToSearch": [ … ],
    "loghiKeyWordsToSearch":          [ … ],
    "bolliniKeyWordsToSearch":        [ … ],
    "ipUploadGate": "http://127.0.0.1:59999"
  },

  "antlr_options": {
    "patternsDescrizioneRegionale": {
      "livelli": [ { "nome": "Livello 1",
                     "patterns": [ { "condizione": "iniziativa==2505AC || settore==8305",
                                     "valore": "LOC" } ] } ]
    }
  },

  "fico": {
    "olympusServerUrl":  "http://<ip-di-olimpo>:3005/olimpo",
    "fpServerUrl":       "http://127.0.0.1:3010/api",
    "correggoServerUrl": "http://127.0.0.1:59999",     // l'AGENTE, non correggo4
    "agent":             "ws://127.0.0.1:59999/ws",
    "contextsPath":      "…/pubblicato/wwwroot/ficoContexts/Famila/",
    "secretKey":         "…",                           // condivisa con fidelity
    "nomeCliente":       "Famila",                      // ← IL CLIENTE
    "userDataPolicy": [ { "source": "nome",    "dest": "NomeUtente" },
                        { "source": "cognome", "dest": "email" } ]
  }
}
```

**Le tre righe che scelgono il cliente** sono `external_paths/pathSource`, `fico/nomeCliente` e
`fico/contextsPath`. Devono essere coerenti fra loro: se `nomeCliente` è `Edro21` ma `pathSource`
punta a `Famila/`, l'applicazione carica la classe di Edro21 e le configurazioni di Famila, e i
sintomi sono incomprensibili.

Sul server demo le stringhe di connessione **non stanno in `appsettings.json`**: le sovrascrive
`/etc/istanta4-pgtest.env` con le variabili
`ConnectionStrings__IstandaConnectionDb` e `ConnectionStrings__IstantaSession`. In locale puoi fare
come preferisci, ma **non committare mai le stringhe**.

## 3. Prepara `pubblicato/`

**`pubblicato/` non è in git** (`.gitignore`: `**/[Pp]ubblicato/`), e **non è solo output di
build**: contiene anche stato. Ti serve almeno:

```
pubblicato/
  appsettings.json
  wwwroot/external_lib/AgenziaLib.dll
  wwwroot/external_source/<Cliente>/   ← i 14 Source*.json
  wwwroot/external_source/vergine/     ← il modello, serve alla fascia degli avvisi
  wwwroot/ficoContexts/<Cliente>/
  wwwroot/imported_files/
  wwwroot/exported_files/
  logs/
```

`external_source/` e `ficoContexts/` vanno presi dal server demo o dal cliente: **non sono nel
repository**. Se manca `vergine/`, il controllo dei sorgenti mancanti non fallisce — resta solo
silenzioso, per costruzione.

## 4. Compila

```bash
cd soluzione/Istanta
dotnet build Istanta.csproj -c Release
```

Oppure, dal 14/09 in poi, anche `dotnet build Istanta.sln` (prima falliva con `MSB3202` perché la
soluzione puntava a un percorso di AgenziaLib che non esiste più).

**Per verificare i warning serve `-t:Rebuild`.** Una build incrementale non ricompila e **non emette
un solo avviso**: un controllo che li conta trova zero e sembra una conferma. Ci sono cascato.

```bash
dotnet build Istanta.csproj -c Release -t:Rebuild 2>&1 | grep 'warning CS'
```

Stato al 14/09: **0 errori**, ~1.100 warning (quasi tutti `CS86xx` di nullabilità), 1 `CS0219` e
2 `CS0162` lasciati apposta.

## 5. Pubblica

```bash
cd soluzione/Istanta
dotnet publish Istanta.csproj -c Release -o ../pubblicato
```

`-o ../pubblicato` **non cancella** quello che c'è già: aggiunge e sovrascrive. È quello che si
vuole, perché lì dentro c'è anche lo stato.

Se l'applicazione è in esecuzione vedrai dei `MSB3026` sul `.pdb` bloccato: sono innocui, la `.dll`
viene copiata lo stesso. Per sicurezza controlla data e dimensione di `pubblicato/Istanta.dll`.

## 6. AgenziaLib, a mano

```bash
cd soluzione/AgenziaLib
dotnet build AgenziaLib.csproj -c Release
cp bin/Release/net10.0/AgenziaLib.dll ../pubblicato/wwwroot/external_lib/
```

**`dotnet publish` non aggiorna questa dll.** Se salti questo passo, il codice nuovo c'è nei
sorgenti, la build è pulita, e a runtime gira quello vecchio.

## 7. Il front-end del cliente

```bash
cp soluzione/Istanta/wwwroot/js/<cliente>/agenzia.js soluzione/Istanta/wwwroot/js/agenzia.js
```

Controlla la prima riga del file nella radice: dev'essere `//<NomeCliente>`.
Poi ricopia i file statici in `pubblicato/wwwroot/js/`.

## 8. Avvia

```bash
cd soluzione/pubblicato
dotnet Istanta.dll
```

e apri `http://localhost:5076`. Per entrare serve **Olimpo raggiungibile**: l'autenticazione passa
da lui.

---

# Parte 2 — il server demo

## Dove sta cosa

```
/srv/istanta4/
  soluzione/          ← il repository git (ramo main)
  backup/             ← i backup dei job, e doc-raw/ con il materiale di questa documentazione
  storage/            ← jpg, estrazioni
  archivio/ dati/ manifest/ port/ port10/ sorgenti/ sorgenti_nuove/ compose/
```

In `soluzione/` ci sono anche quattro promemoria scritti a mano: **`LEGGIMI.txt`**,
**`COMPILARE.txt`**, **`PUBBLICARE.txt`**, **`ACCESSI.txt`** e **`ADMINER.txt`**. Gli ultimi due
sono in `.gitignore` (contengono credenziali) e **vanno considerati vecchi**: sono di inizio
settembre e non è detto che siano ancora veri.

## I servizi

```bash
systemctl status  istanta4-pgtest      # Istanta       :5076
systemctl status  istanta4-correggo4   # correggo4     :5080
systemctl status  istanta4-fidelity    # fidelity      :3010
systemctl status  istanta4-olimpo      # olimpo        :3005
systemctl restart istanta4-pgtest
```

I container:

```bash
docker ps    # istanta4-postgres :5432, istanta4-redis :6379,
             # istanta4-mongo :27017, istanta4-adminer :8081
```

## I log — non sono nel journal

`Program.cs:430` fa `Console.SetOut(new LogAssistent())`, che inoltra a **Serilog**:

```bash
tail -f /srv/istanta4/soluzione/pubblicato/logs/log-$(date +%Y%m%d).txt
```

Il journal e `/var/log/istanta4-pgtest.log` contengono quasi solo il rumore dell'avvio. Ho perso
mezza giornata a cercare lì.

## L'utente giusto

**L'applicazione gira come `serverpop`, ma l'agente della coda gira come `root`.** Ogni file creato
o ripristinato da un job va riportato a `serverpop`:

```bash
chown -R serverpop:serverpop /srv/istanta4/soluzione/pubblicato
```

Se lo dimentichi, l'applicazione muore all'avvio con `UnauthorizedAccessException`. È già successo:
sette minuti di servizio giù.

## Il canale Dropbox

Il metodo con cui si è lavorato tutto il 14/09, e che **resta valido**.

- Si deposita uno script in `~/Dropbox/istanta4/canale/queue/`, con `# ISTANTA4` sulla prima riga
  dopo lo shebang.
- `istanta4-agente.timer` (ogni **30 secondi**) lo esegue **come root** e scrive l'output in
  `canale/logs/<nome>.log`.
- La coda prende **tutti** gli script in una volta: se ne depositi quattro, partono insieme.

Cose imparate:

- **Solo le cartelle che già esistevano sincronizzano.** Una `canale/doc/` creata dal server non è
  mai arrivata sul Mac. Usa `canale/logs/`.
- I file grossi sincronizzano male o tardi; i **log** invece sì. Per leggere un file grosso, fai un
  job che ne stampa una fetta.
- **Nessuna password nei log.** Una volta ne è finita una in un log su Dropbox ed è stato necessario
  sovrascriverlo. Quando uno script usa una stringa di connessione, la legge e non la stampa.

Ogni job di modifica del 14/09 seguiva lo stesso schema, che vale la pena riusare:

1. copia di sicurezza in `/srv/istanta4/backup/<nome>-<data>/`
2. **mostra** cosa sta per cambiare, prima di cambiarlo
3. cambia
4. **compila**
5. se la build fallisce, **ripristina dal backup ed esci con 1**
6. pubblica, riavvia, prova con `curl`
7. committa con un percorso esplicito

Il passo 5 ha salvato la giornata almeno due volte.

---

# Parte 3 — git

- Origine: `https://github.com/rapidmind/Istanta4.git`, ramo **`main`**.
- **Committa sempre con il percorso esplicito**: `git commit -- Istanta/` e non `git commit -a`,
  perché `correggo4/` è lavoro di un altro flusso e non va portato dentro per sbaglio.
- `git status` mostrerà sempre righe di `correggo4/` e `docker/`: è normale.

**Attenzione a un errore di comando** che ha già fatto danno: `git status --cached` **non esiste**.
Un `if` costruito sul suo output vuoto salta il commit in silenzio, e il commit successivo racconta
una cosa che non è mai avvenuta. La forma giusta è `git diff --cached --quiet`.

Cosa è escluso dal repository, e va quindi ricreato o copiato a mano:

```
appsettings*.json          (ma non appsettings*.example.json / *.template.json)
**/pubblicato/
**/bin/  **/obj/  **/node_modules/  **/logs/
**/backup*/
*.env  *.key  *.pem  secrets.json  credentials.json
ACCESSI.txt  ADMINER.txt
*.bak  *.pre-*  *.prima-*  *.originale  *.SBAGLIATO
```

> Le ultime quattro estensioni sono le copie di sicurezza che si fanno prima di una modifica: ce ne
> sono circa 135 nell'albero e **sono tutte già ignorate**. Non sono sporcizia da pulire.

---

# Parte 4 — i segreti

**Nessuna password è in questo repository, e non deve entrarci.**

Sul server demo stanno in tre file, tutti `600 root:root`:

| file | contiene |
|---|---|
| `/etc/istanta4-pgtest.env` | `ConnectionStrings__IstandaConnectionDb`, `ConnectionStrings__IstantaSession` |
| `/etc/istanta4-edro.env` | `EDRO_HOST`, `EDRO_PORT`, `EDRO_DB`, `EDRO_USER`, `EDRO_PASS` |
| `/etc/istanta4-correggo4.env` | `Fico__Secret` — il segreto condiviso con Olimpo |

Più `fico/secretKey` dentro `appsettings.json`, condivisa con fidelity per il passaporto.

> **Due avvertenze da non perdere.**
>
> La password `sa` della produzione di Edro21 è transitata in chiaro in una chat e in un log su
> Dropbox. **Va ruotata.** Adesso vive solo in `/etc/istanta4-edro.env`, ma è stata esposta.
>
> Le credenziali dell'ambiente demo (PostgreSQL, MSSQL, Mongo, l'utente di prova) vanno rigenerate
> se quell'ambiente diventa permanente: sono state scritte in chiaro in chat durante
> l'allestimento.
>
> E un'ultima: **l'esenzione di autenticazione su `/Diagnostica`** non deve mai finire nel
> repository della squadra. È stata tolta il 9 settembre.
