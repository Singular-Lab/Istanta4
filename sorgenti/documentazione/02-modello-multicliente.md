# Il modello multi-cliente

Questa è la pagina più importante della documentazione. Se salti tutto il resto, leggi questa.

## L'idea

**Un solo codice serve N clienti.** Non ci sono rami per cliente, non ci sono build per cliente:
c'è un'unica applicazione, e il cliente viene scelto dalla **configurazione dell'istanza**.

Ogni istanza di Istanta è configurata per **un** cliente. Se lavori su Edro21, la tua istanza punta
al database di Edro21, carica le configurazioni di Edro21 e usa la classe `Edro21` di AgenziaLib.
Un'altra istanza, sulla stessa base di codice, può essere configurata per Famila.

## Le quattro cose che cambiano

La scelta del cliente parte da **due righe** di `appsettings.json`:

```json
"external_paths": {
  "pathSource": ".../pubblicato/wwwroot/external_source/Famila/"
},
"fico": {
  "nomeCliente": "Famila",
  "contextsPath": ".../pubblicato/wwwroot/ficoContexts/Famila/"
}
```

e da lì si propaga in quattro direzioni.

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

sono **l'archivio**, e **non sono codice morto**: al cambio cliente si copia a mano il file giusto
nella radice. Chi cerca "chi carica `js/trea/agenzia.js`" non trova nessuno, e ha ragione: non lo
carica nessuno finché non diventa la radice.

Come si riconosce chi c'è adesso nella radice: **la prima riga del file è un commento con il nome
del cliente** (`//Famila`, `//Edro21`, …).

> Il 14/09 la radice conteneva la copia di **Edro21** benché il cliente configurato fosse **Famila**,
> e Famila non aveva nemmeno una propria cartella d'archivio. È stata creata `js/famila/agenzia.js`.

Le due copie non sono sempre allineate: la radice può aver ricevuto correzioni che l'archivio non
ha. Il 14/09 la radice aveva una guardia `if (infoEsempio != null)` che `edro21/agenzia.js` non
aveva, e una copia futura dall'archivio avrebbe reintrodotto un `TypeError`. **Quando correggi il
file nella radice, porta la correzione anche nell'archivio del cliente**, o la perderai al prossimo
cambio.

### 4. I contesti FICO — `ficoContexts/<Cliente>/`

`fico/contextsPath` punta a una cartella per cliente. **Il contenuto non è verificato** in questa
documentazione.

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
2. `wwwroot/js/nuovocliente/agenzia.js` — copia da un cliente simile, cambia la prima riga in
   `//NuovoCliente`, e ricordati di copiarla nella **radice** al momento del deploy.
3. `external_source/NuovoCliente/` — copia **tutti e quattordici** i file da `vergine/` e
   **compilali**. La fascia gialla ti dirà quali mancano, ma non può dirti se il contenuto è giusto.
4. `ficoContexts/NuovoCliente/`.
5. `appsettings.json` — `fico/nomeCliente`, `external_paths/pathSource`, `fico/contextsPath`, e la
   stringa di connessione al database di quel cliente.
6. Ricompila AgenziaLib e **copia a mano** `AgenziaLib.dll` in `pubblicato/wwwroot/external_lib/`.

Il punto 6 è quello che si dimentica sempre, e il sintomo è sconcertante: il codice nuovo c'è nei
sorgenti, la build è pulita, e a runtime continua a girare quello vecchio.
