# Il modello multi-cliente

Questa è la pagina più importante della documentazione. Se salti tutto il resto, leggi questa.

## L'idea

**Un solo codice serve N clienti.** Non ci sono rami per cliente, non ci sono build per cliente:
c'è un'unica applicazione, e il cliente viene scelto dalla **configurazione dell'istanza**.

Ogni istanza di Istanta è configurata per **un** cliente. Se lavori su Edro21, la tua istanza punta
al database di Edro21, carica le configurazioni di Edro21 e usa la classe `Edro21` di AgenziaLib.
Un'altra istanza, sulla stessa base di codice, può essere configurata per Famila.

## Le cinque cose che cambiano

**Dal 15/09/2026 il cliente si sceglie con la variabile d'ambiente `ISTANTA_CLIENTE`.**
`Program.cs` la legge all'avvio e sovrappone `appsettings.<cliente>.json` ad `appsettings.json`:

```csharp
var chosenConfig = Environment.GetEnvironmentVariable("ISTANTA_CLIENTE");
if (!string.IsNullOrWhiteSpace(chosenConfig))
{
    builder.Configuration
        .AddJsonFile($"appsettings.{chosenConfig}.json", optional: false, reloadOnChange: true)
        .AddEnvironmentVariables()
        .AddCommandLine(args);
}
```

Tre dettagli che contano, tutti e tre nati da altrettanti difetti della versione precedente:

- **`optional: false`.** Se la variabile nomina un file che non c'è, l'avvio si ferma. Prima era
  `optional: true`: un nome sbagliato passava in silenzio e l'applicazione partiva sul database
  del file base.
- **Variabili d'ambiente e riga di comando sono rimesse in coda**, dopo il json. Nella
  configurazione di .NET una sorgente aggiunta dopo vince su quelle prima: senza quelle due righe
  il json del cliente scavalcherebbe `ConnectionStrings__IstandaConnectionDb`, che è il modo in cui
  il server demo riceve le stringhe di connessione (`/etc/istanta4-pgtest.env`).
- **Vale in Debug e in Release.** Prima il blocco stava dentro un `#if DEBUG`, e in Release la
  sovrapposizione non avveniva affatto.

Il nome del cliente **non è più scritto nel sorgente**: `Program.cs` è identico su tutte le
macchine. Chi lavora in Visual Studio trova `ISTANTA_CLIENTE` nel profilo di avvio
(`Istanta/Properties/launchSettings.json`, che non sta in git — vedi più sotto).

Dentro `appsettings.<cliente>.json` le righe che scelgono il cliente restano tre:

```json
"external_paths": {
  "pathSource": "wwwroot/external_source/Edro21/"
},
"fico": {
  "nomeCliente": "Edro21",
  "contextsPath": "wwwroot/ficoContexts/Edro21/"
}
```

e da lì si propaga in cinque direzioni.

### 1. La classe di AgenziaLib — per riflessione

`nomeCliente` finisce dentro una **stringa** che nomina un tipo e un metodo:

```csharp
icCtrl.execLibFunction($"AgenziaLib.{this._fico_conf.Value.nomeCliente}.specificaInOutVol", _pass)
```

`execLibFunction` (in `Istanta/Controllers/IstantaController.cs`, righe 267-318) fa così:

```csharp
var dll = Assembly.Load(System.IO.File.ReadAllBytes(dllFile));   // riga 279
var ty  = dll.GetType(_dllCls);                                   // "AgenziaLib.Famila"
var mth = ty!.GetMethod(_dllMth);                                 // riga 281 — "specificaInOutVol"
// ... costruzione degli argomenti ...
object? objResult = mth!.Invoke(obj, _objP);                      // riga 316
```

Conseguenze da tenere a mente, tutte e tre imparate sul campo:

- **Il compilatore non vede queste chiamate.** Se rinomini o togli un metodo di AgenziaLib, la build
  passa e l'errore arriva a runtime, come `TargetInvocationException`.
- **Gli argomenti si legano per NOME del parametro, non per posizione.** Alla riga 305 di
  `IstantaController.cs`: `_objP[po] = dataset[pi.Name]`. Il chiamante costruisce un
  `Dictionary<string,object>` e i nomi delle chiavi **devono corrispondere ai nomi dei parametri**
  del metodo in AgenziaLib. Rinominare un parametro nell'interfaccia rompe il chiamante in silenzio.
  È esattamente il bug che il 14/09 impediva al Revisore di funzionare: `IAgenzia.specificaInOutVol`
  chiama il primo parametro `tracciatoSingoli`, il chiamante metteva nel dizionario
  `tracciatoRevisione`, e ne usciva un `KeyNotFoundException`.
- **La dll viene letta dal disco a ogni chiamata**, da `pathLib` — cioè
  `pubblicato/wwwroot/external_lib/AgenziaLib.dll`. Per questo va copiata a mano dopo ogni build:
  `dotnet publish` non la aggiorna.

**Non tutti i nomi di metodo sono letterali nel codice.** In almeno due punti il nome arriva dal
**database**:

```csharp
// TracciatiController.cs:1515
string resultExternal = icCtrl.execLibFunction(addestramento.externalCallPerImport!, _pass)…
```

Le colonne sono `addestramento_excel.externalCallPerImport`, `.externalCallPerExport`,
`.externalCallPerExportPoP` e `addestramento_excel_relazioni.algoritmo`. **Nel database demo sono
tutte vuote**, ma in produzione possono non esserlo: prima di dichiarare morto un metodo di
AgenziaLib bisogna guardare il database del cliente vero.

### 2. Le configurazioni — `external_source/<Cliente>/`

`pathSource` punta a una cartella per cliente sotto
`pubblicato/wwwroot/external_source/`. Ogni cliente ha i suoi `Source*.json`. Il modello vuoto è
**`external_source/vergine/`**, che contiene i **quattordici** file che un cliente deve avere:

```
SourceACPV.json                     SourceLoghiBolli.json
SourceDeclinazioneMeccaniche.json   SourceMeccaniche.json
SourceDeclinazioniKit.json          SourceNamingConvention.json
SourceEtichetteRef.json             SourceOrdinamentoLista.json
SourceFormati.json                  SourceRegoleMastro.json
SourceFrameworkCss.json             SourceTipiDiExport.json
SourceLabels.json                   SourceTraduttoreAC.json
```

Chi li legge è `Istanta/Models/ExternalSourceClass.cs`, con 21 metodi `getXxx()`. Dal 14/09, **se a
un cliente manca uno di questi file, una fascia gialla in cima a ogni pagina lo dice**, con il nome
del file e l'istruzione di copiarlo da `vergine` e compilarlo. Il controllo è in
`ExternalSourceClass.SorgentiDaCompilare()`, lo passa alla vista `CustomViewBagFilter`, e lo mostrano
`_Layout.cshtml` e `_LayoutLogin.cshtml`. Si ricalcola al massimo una volta al minuto, quindi
sparisce da sola quando il file torna a posto, senza riavviare.

> **Perché quella fascia esiste.** Cinque dei ventuno getter, se il file manca, ne creano uno
> **vuoto in silenzio**; gli altri sedici vanno dritti in errore su `ReadAllText`. In entrambi i
> casi l'utente non aveva modo di sapere che gli mancava una configurazione. `SourceLabels.json` e
> gli altri contengono dati che per un cliente nuovo vanno **compilati correttamente**, non
> semplicemente creati.

### 3. Il front-end — `wwwroot/js/<cliente>/agenzia.js`

Anche il javascript ha il suo punto di estensione, ed è fatto in modo **molto diverso** dal
back-end. Vale la pena capirlo bene perché è controintuitivo.

`js/IAgenzia.js` definisce la classe base `IAgenzia`, con **60 metodi** che di default fanno solo
`console.error("Chiamata … non implementata")`. `js/agenzia.js` definisce
`class Agenzia extends IAgenzia` e implementa quelli che servono a *quel* cliente.

**A runtime `_Layout` carica un solo `js/agenzia.js`: quello nella radice.** Le cartelle per cliente

```
js/coop/  js/craiOvest/  js/edro21/  js/famila/  js/gross/
js/Maiora/  js/navcove/  js/pac/  js/trea/
```

sono **l'archivio**, e **non sono codice morto**: al cambio cliente il file giusto viene copiato
nella radice. Chi cerca "chi carica `js/trea/agenzia.js`" non trova nessuno, e ha ragione: non lo
carica nessuno finché non diventa la radice.

**Dal 15/09/2026 la copia la fa `./monta-cliente.sh <Cliente>`, e `js/agenzia.js` non è più in
git.** Il motivo è che quel file dice quale cliente è montato su *quella* macchina: finché era
tracciato, il cliente di uno finiva nei diff di tutti. L'archivio resta in git ed è la fonte.

Come si riconosce chi c'è adesso nella radice: **la prima riga del file è un commento con il nome
del cliente** (`//Famila`, `//Edro21`, …).

> Il 14/09 la radice conteneva la copia di **Edro21** benché il cliente configurato fosse **Famila**,
> e Famila non aveva nemmeno una propria cartella d'archivio. È stata creata `js/famila/agenzia.js`.

Le due copie non sono sempre allineate: la radice può aver ricevuto correzioni che l'archivio non
ha. Il 14/09 la radice aveva una guardia `if (infoEsempio != null)` che `edro21/agenzia.js` non
aveva, e una copia futura dall'archivio avrebbe reintrodotto un `TypeError`. **Quando correggi il
file nella radice, porta la correzione anche nell'archivio del cliente**, o la perderai al prossimo
cambio — e adesso che la radice non è più in git, la perderesti per davvero, senza modo di
recuperarla. Per questo `monta-cliente.sh` si rifiuta di sovrascrivere una radice che differisce
dall'archivio, finché non gli si passa `--forza`.

### 4. I contesti FICO — `ficoContexts/<Cliente>/`

`fico/contextsPath` punta a una cartella per cliente. **Il contenuto non è verificato** in questa
documentazione.

### 5. Il plugin InDesign — `plugin/Agenzie/<Cliente>/custom.js`

Il plugin ripete **esattamente lo schema del front-end**: un solo file in radice, caricato da
`indexNew.js:6` con `require('./custom')`, e le cartelle `plugin/Agenzie/<Cliente>/` come archivio,
che nessuno legge mai. Anche qui la prima riga del file dice chi è montato (`//EDRO21`,
`//Coop.fi`, …), anche qui la copia la fa `./monta-cliente.sh`, e anche qui `plugin/custom.js` non
è in git dal 15/09/2026.

Attenzione a una differenza di grafia, che è una trappola quando si copia a mano: il cliente si
chiama `Coopfi` in `AgenziaLib` e in `plugin/Agenzie/`, ma la sua cartella javascript si chiama
`js/coop/`. La mappa completa sta dentro `monta-cliente.sh`.

Come si riconosce un `custom.js` di generazione recente: **ha `callCustom: false`**. Le versioni
vecchie ce l'hanno a `true` o non ce l'hanno affatto. Al 15/09/2026 solo la radice e
`Agenzie/Edro21/` erano aggiornate; gli altri cinque archivi sono di generazione precedente.

Il plugin ha poi una sua configurazione locale, `plugin/ipconfig.json`, con gli indirizzi di
Istanta e di Olimpo e l'interruttore `testMode`. **Non è in git** (`.gitignore`:
`**/ipconfig*.json`) e va procurato a parte: senza, il `require` della riga 19 di `indexNew.js`
fallisce e il plugin non si carica affatto.

---

## I quattro file che non stanno in git

Dicono tutti la stessa cosa — **quale cliente è montato su questa macchina** — e per questo nessuno
dei quattro è tracciato: se lo fossero, il cliente montato da uno comparirebbe nei diff di tutti, e
un `git pull` cambierebbe il cliente sotto i piedi a chi sta lavorando.

| file | cosa sceglie | da dove si ottiene |
|---|---|---|
| `Istanta/appsettings.<cliente>.json` | database, servizi, le tre righe del cliente | a mano, o dal responsabile del cliente |
| `Istanta/Properties/launchSettings.json` | `ISTANTA_CLIENTE` per Visual Studio | generato da `monta-cliente.sh` dal modello `launchSettings.template.json` |
| `Istanta/wwwroot/js/agenzia.js` | il front-end del cliente | copiato da `monta-cliente.sh` da `js/<cliente>/` |
| `plugin/custom.js` | la logica InDesign del cliente | copiato da `monta-cliente.sh` da `plugin/Agenzie/<Cliente>/` |

Più `plugin/ipconfig.json`, che non sceglie il cliente ma gli indirizzi, e vale la stessa regola.

**Le fonti restano tutte in git**: gli archivi per cliente e il modello del profilo di avvio. Quello
che non passa è solo la *scelta*.

```bash
./monta-cliente.sh Edro21           # monta i file del cliente e scrive ISTANTA_CLIENTE
./monta-cliente.sh Edro21 --forza   # sovrascrive anche una radice divergente dall'archivio
```

Lo script si ferma da solo in due casi: se un file in radice differisce dal suo archivio (per non
cancellare una correzione che lì non è recuperabile, non essendo più in git), e se il montaggio è
fallito, nel qual caso **non** tocca `launchSettings.json` — perché una macchina con il server su un
cliente e i file di un altro è la situazione più difficile da diagnosticare.

> **Quando questo cambiamento arriva sulle altre macchine.** Al primo `git pull` che contiene la
> rimozione dal tracciamento, git **cancella** `js/agenzia.js`, `plugin/custom.js` e
> `launchSettings.json` dalla copia di lavoro, perché non sono più file tracciati. Chi tira deve
> lanciare `./monta-cliente.sh <Cliente>` subito dopo, o si ritrova front-end e plugin senza il file
> del cliente.

---

## Come si riconosce un cliente vivo

Un cliente vivo lascia **tre** tracce. Questo criterio è servito il 14/09 a decidere cosa togliere,
e resta valido:

1. una **classe** in `AgenziaLib/<Cliente>.cs`;
2. una cartella **`wwwroot/js/<cliente>/`** con il suo front-end;
3. una cartella **`external_source/<Cliente>/`** con i suoi `Source*.json`.

Lo stato al 14/09/2026:

| cliente | classe AgenziaLib | righe | implementa `IAgenzia` | `js/` | `external_source/` | note |
|---|---|---|---|---|---|---|
| **Edro21** | sì | 14.279 | sì | sì | sì | il più grande, e quello da cui nascono quasi tutte le chiamate di AgenziaLib |
| **Coopfi** | sì | 6.202 | sì | sì (cartella `coop`) | sì | |
| **Trea** | sì | 3.165 | **no** | sì | sì | **dismesso**: gli manca `SourceMeccaniche.json` e non lo aggiungiamo |
| **Pac** | sì | 1.567 | sì | sì | sì | |
| **Famila** | sì | 1.000 | sì | sì | sì | **è il cliente configurato sul server demo** |
| **Gross** | sì | 910 | **no** | sì | no | |
| ~~DocRoma~~ | tolta il 14/09 | ~~2.292~~ | no | no | no | nessuna delle tre tracce |
| ~~Etruria~~ | tolta il 14/09 | ~~477~~ | sì | no | no | solo la classe |

Tre cartelle `js/` — **`Maiora`**, **`craiOvest`**, **`navcove`** — hanno un front-end ma **nessuna
classe in AgenziaLib**: clienti che non hanno mai avuto bisogno di logica lato server, o la cui
classe è stata tolta in passato.

> `Trea` e `Gross` **non implementano `IAgenzia`**. Restano comunque raggiungibili per riflessione,
> perché `execLibFunction` cerca il tipo per nome e il metodo per nome: il contratto non c'entra.
> Significa però che per loro non c'è nessuna garanzia a compilazione che i metodi attesi esistano.

---

## Aggiungere un cliente nuovo

Dalla struttura, la procedura è questa. **Non l'ho eseguita**, quindi va verificata al primo uso —
ma i punti da toccare sono tutti e soli questi:

1. `AgenziaLib/NuovoCliente.cs` — `public class NuovoCliente : IAgenzia`, e implementa i 24 metodi
   del contratto. Il modo più rapido è partire da `Coopfi.cs`, che è la più lineare.
2. `wwwroot/js/nuovocliente/agenzia.js` — copia da un cliente simile e cambia la prima riga in
   `//NuovoCliente`. In radice ci finisce con `./monta-cliente.sh`, non a mano.
3. `external_source/NuovoCliente/` — copia **tutti e quattordici** i file da `vergine/` e
   **compilali**. La fascia gialla ti dirà quali mancano, ma non può dirti se il contenuto è giusto.
4. `ficoContexts/NuovoCliente/`.
5. `plugin/Agenzie/NuovoCliente/custom.js` — se il cliente usa il plugin InDesign. Parti da
   `Agenzie/Edro21/custom.js`, che è l'unico archivio di generazione recente.
6. `Istanta/appsettings.nuovocliente.json` — `fico/nomeCliente`, `external_paths/pathSource`,
   `fico/contextsPath`, e la stringa di connessione al database di quel cliente. Il nome del file
   deve corrispondere a quello che si mette in `ISTANTA_CLIENTE`.
7. La riga nella mappa dentro `monta-cliente.sh`: cliente, cartella js, cartella del plugin.
8. Ricompila AgenziaLib e **copia a mano** `AgenziaLib.dll` in `pubblicato/wwwroot/external_lib/`.

L'ultimo punto è quello che si dimentica sempre, e il sintomo è sconcertante: il codice nuovo c'è nei
sorgenti, la build è pulita, e a runtime continua a girare quello vecchio.
