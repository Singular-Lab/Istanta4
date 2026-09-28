# indexNew — le globali e l'ossatura

Panoramica del file: [README.md](README.md).

Questa pagina documenta **le variabili globali del Plugin**, che sono dichiarate qui e usate
ovunque. È l'informazione che manca a chiunque legga un altro file e trovi un nome che non è
importato da nessuna parte.

---

## Fin dove arrivano

| globale | usata in altri file |
|---|---|
| `pathLavorazione` | **17** |
| `messaggioUtente` | **17** |
| `docInLavorazione` | 10 |
| `hideLoading` | 9 |
| `showLoading` | 7 |
| `percorsoLinks` | 4 |
| `olimpoIp` | 3 |
| `istantaIp`, `percorsoLogs`, `testMode`, `addSegnalazione` | 2 ciascuna |
| `noLoginCallback` | 1 |

**`pathLavorazione` e `messaggioUtente` sono usate in diciassette file su quaranta.** Sono di fatto
l'interfaccia implicita del Plugin, e non esistono da nessun'altra parte se non qui.

## I gruppi

### I percorsi, e i loro default

`percorsoLinks` `/Links/`, `percorsoLoghi` `/Links/Loghi/`, `percorsoLogs` `/Logs/`,
`percorsoEsportazione` `/Export/`.

Ognuno ha un gemello `defaultPercorso*`: **i primi si possono cambiare, i secondi dicono da cosa si
riparte.**

### Il documento e la lavorazione

`docInLavorazione`, `libroInLavorazione`, `pathLavorazione`, `idKitLavorazione`,
`contenutoKitInLavorazione`, `pagSelected`, `jobImpaginazioneLibro`.

### Le due enum

`RuoloUtente` e `IstantaState`, con lo stato corrente in `ruoloUtenteLoggato` e `istantaState`, più
`nomeUtente`, `idUtente`, `userLoggedDetails`.

### Gli indirizzi

`testMode`, `olimpoIp`, `istantaIp`, che vengono da [ipconfig.json](../ipconfig.md). Sono il punto
in cui un file di configurazione diventa stato del programma.

### Le due istanze uniche

`indesignEvents` e `gC`: tutto il Plugin ha **un solo** registro eventi
([events.js](../events.md)) e **un solo** raccoglitore di rimozioni differite
([garbageCollector.js](../garbageCollector.md)).

### `xhrInProcess` — una sola richiesta alla volta

È la variabile che spiega i sei `abort()` sparsi per il Plugin: c'è una sola richiesta al server in
volo, e chi ne avvia una nuova ferma la precedente. **Peccato che `abort()` non fermi davvero
niente** — vedi [XMLHttpRequestClient.md](../XMLHttpRequestClient.md).

### Lo stato del lavoro

`offlineMode`, `listaTracciatiScaricata`, `tracciatoOnlineScaricato`, `useCompiledField`,
`dbMastro`, `segnalazioniBoxImpaginato`, `datiRefInEsame`, `cacheLoghi`,
`riletturaDocumentoInCorso`, `lastSelections`, `paramsCache`, `syncFotoInCorso`,
`abortedSyncFoto`, `isOnline`.

**`dbMastro` ha una particolarità:** è inizializzata con
`readFile(pathLavorazione + "/dbMastro.json")`, ma a quel punto `pathLavorazione` è ancora `""`.
Legge quindi da `/dbMastro.json` alla radice, che non esiste, e vale `null` finché qualcuno non la
riassegna.

---

## Nove globali rimosse in I20-1002

Erano **l'eco di `ficoProcess.js`**: stessi nomi, stessi significati, ma `indexNew` non le leggeva
mai. Quando gli serviva il dato, leggeva sempre `ficoProcess.qualcosa`.

| globale | in `indexNew` | in `ficoProcess` |
|---|---|---|
| `sourceFormati` | solo dichiarata | letta 11 volte |
| `sourceAree` | solo dichiarata, e tre righe che la nominano sono commentate | 10 |
| `sourceCanali` | solo dichiarata | 10 |
| `sourceTipiExport` | solo dichiarata | 18 |
| `listaPromoAperte` | solo dichiarata | 4 |
| `datiFicoScaricati` | solo dichiarata | 9 |
| `cacheKitSearchResult` | solo dichiarata | 7 |
| `listaElementiMateriali` | solo dichiarata | 9 |
| `abortExport` | dichiarata e **scritta una volta**, mai letta | 3 |

`abortExport` meritava un controllo in più: in `esportaMateriale` c'era `abortExport = false`, che
sembrava voler annullare un'interruzione. **Non era un difetto**: `indexNew.esportaMateriale` chiama
`ficoProcess.esportaMateriale`, che alla sua riga 1275 azzera correttamente il proprio flag. La riga
era inutile, non dannosa.
