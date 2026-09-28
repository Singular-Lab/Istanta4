# Il Plugin — documentazione file per file

Questa cartella spiega **ogni file del Plugin**: a cosa serve, quali variabili globali ha e cosa fa
ogni sua funzione. È la documentazione richiesta da **I20-1002** e si scrive a lotti, un pezzo per
volta.

La spiegazione sta in due posti, di proposito:

- **qui**, una pagina per sorgente, per il quadro d'insieme del file e le sue variabili globali;
- **nel codice**, come commenti `///` sopra le funzioni, perché la spiegazione di una funzione
  attaccata alla funzione non può divergere da essa.

Quando cambi il codice, correggi la pagina nello stesso commit. Una documentazione sbagliata è
peggio di una documentazione assente, perché fa perdere tempo invece di farne risparmiare.

---

## Tre cose da sapere prima di leggere il resto

1. **`indexNew.js` è il centro di gravità.** È lui che carica con `require` tutti gli altri moduli
   ed è lui che definisce le globali — `percorsoLogs`, `istantaIp`, `messaggioUtente` — da cui gli
   altri dipendono. Molti file del Plugin non si caricano sotto Node proprio per questo; i moduli
   nati di recente (`versionePlugin`, `reportIntegritaAvvio`) sono l'eccezione voluta, scritti
   apposta per essere verificabili da soli.
2. **`ipconfig.json` e `custom.js` cambiano per cliente**, montati da `monta-cliente.sh`. Quello che
   trovi nel repository è l'ultimo montaggio fatto su quella macchina, non il prodotto.
3. **Il Plugin ha residui.** Dove un file è morto o svuotato questa documentazione lo dice, perché
   serve anche a indicare cosa *non* vale la pena guardare.

---

## Stato del lavoro

| lotto | file | stato |
|---|---|---|
| 1 — Fondamenta | `manifest.json`, `ipconfig.json`, `index.html`, `logger.js`, `versionePlugin.js`, `XMLHttpRequestClient.js` | **fatto** |
| 2 — Utilità piccole | `barraScorrimento`, `dissolvenza`, `tooltipPosizione`, `jsIndexControls`, `cacheHashFoto`, `dataCaricamentoFoto`, `credenzialiSalvate`, `fotoAutoSync`, `garbageCollector`, `cambiStrutturali`, `ricollegaEsiti`, `reportConteggi`, `trattiDescrizione`, `variantiDescrizione` | **fatto** |
| 3 — Motore CSS | `CssFramework`, `cssComposizioneBox`, `cssRegoleConflitti`, `cssSequenzaOperazioni`, `cssSpazioFoto`, `noRenderElementi` | da fare |
| 4 — Report | `reportConfronti`, `reportConfrontoCsv`, `reportIntegritaAvvio` | da fare |
| 5 — Nucleo | `utility`, `events`, `cmd`, `pluginMiddleware`, `custom`, `filtri`, `griglia`, `ficoProcess`, `schedaArtwork`, `InputEditController`, `schedaRef`, `confronti`, `indexNew` | da fare |
| 6 — Agenzie e Receiver | i sette `custom.js` di cliente, la cartella `Receiver` | da fare |

## Le pagine scritte finora

### Lotto 1 — le fondamenta

| pagina | il file che spiega |
|---|---|
| [manifest.md](manifest.md) | `plugin/manifest.json` — identità, versione e permessi |
| [ipconfig.md](ipconfig.md) | `plugin/ipconfig.json` — dove stanno Istanta e Olimpo, e `testMode` |
| [index-html.md](index-html.md) | `plugin/index.html` — il pannello, le schede, le funzioni dei tab |
| [logger.md](logger.md) | `plugin/logger.js` — il log su file |
| [versionePlugin.md](versionePlugin.md) | `plugin/versionePlugin.js` — installata contro pubblicata |
| [XMLHttpRequestClient.md](XMLHttpRequestClient.md) | `plugin/XMLHttpRequestClient.js` — il canale verso il server |

### Lotto 2 — le utilità piccole

| pagina | il file che spiega |
|---|---|
| [barraScorrimento.md](barraScorrimento.md) | una barra di scorrimento disegnata da noi, perché in UXP non scorre |
| [dissolvenza.md](dissolvenza.md) | i conti della dissolvenza, perché in UXP `opacity` non si ridisegna |
| [tooltipPosizione.md](tooltipPosizione.md) | dove ancorare un tooltip senza misurarlo |
| [cacheHashFoto.md](cacheHashFoto.md) | la memoria degli hash md5 delle foto |
| [reportConteggi.md](reportConteggi.md) | i numeri sulle linguette del Report Integrità |
| [dataCaricamentoFoto.md](dataCaricamentoFoto.md) | il badge con la data sulle foto |
| [ricollegaEsiti.md](ricollegaEsiti.md) | cosa dire all'operatore dopo un ricollegamento |
| [trattiDescrizione.md](trattiDescrizione.md) | i tratti di stile di un campo descrizione |
| [variantiDescrizione.md](variantiDescrizione.md) | quale variante di descrizione comanda |
| [credenzialiSalvate.md](credenzialiSalvate.md) | le credenziali nell'archivio cifrato del sistema |
| [fotoAutoSync.md](fotoAutoSync.md) | scaricare e impaginare la foto in un colpo solo |
| [jsIndexControls.md](jsIndexControls.md) | le schede del pannello, la copia che chiama il codice |
| [garbageCollector.md](garbageCollector.md) | la rimozione differita degli elementi InDesign |
| [cambiStrutturali.md](cambiStrutturali.md) | quali cambi strutturali si applicano a una referenza |

---

## Cosa è stato rimosso durante il Lotto 1

Documentare ha fatto emergere tre file che non servivano più. Sono stati cancellati nello stesso
task, su decisione dell'operatore, seguendo la regola del progetto: il codice morto si cancella, il
git è la memoria.

| file | perché |
|---|---|
| `texteditor.js` | editor Quill mai usato: nessun riferimento, e non si sarebbe caricato — usa `import` e il pacchetto `quill`, che nel Plugin non c'è |
| `sp-popover.mjs` | l'unico riferimento in `index.html` era commentato |
| `fotoFix.js` | interamente commentato, non esportava niente. La `MAIN_fixFoto` vera è in `CssFramework.js` ed è quella che le agenzie chiamano |

Insieme ai file sono stati tolti la riga commentata che caricava `sp-popover.mjs` e i `require` di
`./fotoFix` nelle sette agenzie: attivi in Pac, Coopfi e Famila — dove restituivano un oggetto vuoto
— e già commentati in Doc, Trea ed Etruria.

## Cosa è stato corretto durante il Lotto 2

Una cosa sola, perché era una riga e perché lasciarla sarebbe stato peggio che cambiarla.

In `cambiStrutturali.js` il confronto sul tipo dell'oggetto InDesign era scritto `"textFrame"`,
mentre `constructorName` vale `"TextFrame"`. Il confronto non era mai vero, e **ogni regola di
cambio strutturale che guardava il contenuto di un campo del box falliva sempre**. La correzione
accende regole che prima erano sempre false: per i clienti con quel tipo di condizioni l'edit si
comporta diversamente da prima. Il dettaglio, e il perché `NotEquals` era il caso peggiore, sono in
[cambiStrutturali.md](cambiStrutturali.md). Coperta da `tests/plugin/cambiStrutturali.test.js`, che
senza la correzione fallisce in quattro casi su sette.

## Difetti trovati e non corretti

Documentare ne ha fatti emergere altri, tutti aperti come task separati. Nessuno è stato toccato:
I20-1002 è un task di documentazione, e correggerli cambierebbe il comportamento di chiamate che
oggi ci convivono.

1. **`XMLHttpRequestClient.abort()` non interrompe la richiesta in volo** —
   [XMLHttpRequestClient.md](XMLHttpRequestClient.md).
2. **`index.html` e `jsIndexControls.js` contengono due copie divergenti delle funzioni dei tab** —
   [index-html.md](index-html.md) e [jsIndexControls.md](jsIndexControls.md).
3. **`garbageCollector.js` ha quattro difetti** nella rimozione differita, di cui il più grave è
   `ContentType` usato senza `require` con l'errore inghiottito da un `catch` vuoto —
   [garbageCollector.md](garbageCollector.md).

## Un'osservazione che vale per tutto il Plugin

Guardando insieme i venti file documentati finora, la differenza salta agli occhi: **i moduli nati
di recente non hanno globali esterne — ricevono tutto come parametro — mentre quelli più vecchi
dipendono da globali che non dichiarano.**

Non è una differenza di stile. È esattamente la linea che separa i file verificabili sotto Node da
quelli che non si caricano affatto, ed è la ragione per cui esistono tanti moduli piccoli: il loro
ospite naturale — `utility.js`, `CssFramework.js`, `indexNew.js` — ha `require('indesign')` in
testa. Chi un giorno accorperà questi file per ridurne il numero deve raggrupparli **fra loro**, non
riversarli dentro gli ospiti: in quel caso si perderebbero i test che oggi coprono proprio quella
logica.
