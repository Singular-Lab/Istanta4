# ficoProcess.js

**Cosa è:** il dialogo con Istanta su promo, kit e lavorazioni, e l'esportazione dei materiali.
«Fico» è il nome del servizio lato Istanta.

## I quattro mestieri

**1. Scaricare i dati di contesto** — aree, canali, formati, tipi di export, promo aperte.
`init(successCbk, errorCbk)` avvia tutto, `scaricaFicoData(force)` fa il lavoro, e i cinque
`refreshPromo`, `refreshFormati`, `refreshCanali`, `refreshAree`, `refreshTipiExport` aggiornano le
singole parti.

**2. Sapere su cosa si sta lavorando.** `checklavorazioneSelezionata()` e i quattro
`get*LavorazioneCorrente`: tipo, formato, canale, area. **È da qui che tutto il Plugin sa se sta
facendo un Volantino (tipo 1) o un PoP (tipo 2)**, e lo chiedono `filtri.js`, `custom.js`,
`confronti.js`, `CssFramework.js` e `pluginMiddleware.js`.

**3. Cercare e aprire un kit.** `cercaKit(cbk)` cerca, `lavoraKit(idKit, idLavorazioneLocale)` apre:
da lì in poi il Plugin ha una lavorazione corrente. `lavoraKitMassivo` e `lavoraKitMassivo_Queue`
fanno lo stesso su più kit, in coda.

**4. Esportare.** `esportaMateriale(guidExport, callBack, paginaRestart)` è l'ingresso: esporta
pagina per pagina secondo il tipo scelto e invia a Istanta. `paginaRestart` riprende da dove un
export interrotto si era fermato. Sotto ci sono `processExport`, `processFPExport` e
`processCorreggoExport` per le varianti, più i controlli sul tipo: `tipoDiExportValido`,
`selezionatoTipoDiExport`, `attivaPulsanteExport`, `disattivaPulsanteExport`, `creaBannerAvviso`.

## Variabili

| nome | cos'è |
|---|---|
| `metaLavorazioneCorrente` | la lavorazione aperta: è la sorgente dei quattro `get*LavorazioneCorrente` |
| `sourceAree`, `sourceCanali`, `sourceFormati`, `sourceTipiExport` | i dati di contesto scaricati |
| `listaPromoAperte` | le promo disponibili |
| `cacheKitSearchResult`, `cacheKitFilterResult` | l'ultima ricerca di kit, per non rifarla |
| `datiFicoScaricati` | se il contesto è stato scaricato almeno una volta |
| `abortExport` | alzata per interrompere un export in corso |
| `listaElementiMateriali` | i materiali dell'export |
| `errorScaricamentoFicoDataCallback`, `successScaricamentoFicoDataCallback` | cosa fare quando lo scaricamento finisce |

## Una proposta valutata e scartata

Era stato proposto di portare i quattro `get*LavorazioneCorrente` in un file loro,
`lavorazioneCorrente.js`: sono l'unica parte del file che non parla col server — leggono solo
`metaLavorazioneCorrente` — e un file così **si caricherebbe sotto Node**, mentre `ficoProcess`
richiede InDesign.

**L'operatore ha valutato e scartato la proposta**, giudicandola non abbastanza utile. È annotato
qui e nel codice perché non venga riproposta dal task di divisione.

## Cosa è stato rimosso in I20-1002

`filtraKit(resultFiltrato)`, 27 righe: nascondeva e mostrava i kit già cercati filtrando il DOM,
per il processo PoP massivo. Nessun chiamante in tutto il repository.
