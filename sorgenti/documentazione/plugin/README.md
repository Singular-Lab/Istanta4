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
| 3 — Motore CSS | `CssFramework`, `cssComposizioneBox`, `cssRegoleConflitti`, `cssSequenzaOperazioni`, `cssSpazioFoto`, `noRenderElementi` | **fatto** |
| 4 — Report | `reportConfronti`, `reportConfrontoCsv`, `reportIntegritaAvvio` | **fatto** |
| 5 — Nucleo | `utility`, `events`, `cmd`, `pluginMiddleware`, `custom`, `filtri`, `griglia`, `ficoProcess`, `schedaArtwork`, `InputEditController`, `schedaRef`, `confronti`, `indexNew` | in corso: fatti `events`, `InputEditController`, `schedaArtwork`, `pluginMiddleware`, `custom`, `cmd`, `ficoProcess`, `griglia`, `filtri`, `utility`, `confronti` |
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

### Lotto 3 — il motore CSS

| pagina | il file che spiega |
|---|---|
| [cssSequenzaOperazioni.md](cssSequenzaOperazioni.md) | quando una regola del framework viene eseguita |
| [cssRegoleConflitti.md](cssRegoleConflitti.md) | quali elementi non devono toccarsi, e su cosa si misura |
| [cssComposizioneBox.md](cssComposizioneBox.md) | duplicare elementi e decidere chi sta davanti |
| [cssSpazioFoto.md](cssSpazioFoto.md) | in quale spazio libero finiscono le foto |
| [noRenderElementi.md](noRenderElementi.md) | rendere invisibili singoli elementi di un box |
| [cssFramework/](cssFramework/README.md) | il motore vero: 8.636 righe, spiegate in cinque pagine per gruppo |

### Lotto 4 — i report

| pagina | il file che spiega |
|---|---|
| [reportIntegritaAvvio.md](reportIntegritaAvvio.md) | quando il Report Integrità parte, e quando smette di valere |
| [reportConfronti.md](reportConfronti.md) | la sezione Confronti: cosa è cambiato nei campi che l'agenzia tiene d'occhio |
| [reportConfrontoCsv.md](reportConfrontoCsv.md) | come è fatto il csv, e perché è fatto per Excel |

### Lotto 5 — il nucleo (in corso)

| pagina | il file che spiega |
|---|---|
| [events.md](events.md) | il registro degli eventi di background, a cui gli altri si registrano |
| [InputEditController.md](InputEditController.md) | i campi della scheda referenza, e cosa va davvero salvato |
| [schedaArtwork.md](schedaArtwork.md) | l'artwork: più referenze trattate come un'unica immagine |
| [pluginMiddleware.md](pluginMiddleware.md) | il mediatore fra il Plugin e la configurazione del cliente |
| [custom.md](custom.md) | il file dell'agenzia montata, e cosa resta quando il server comanda |
| [cmd.md](cmd.md) | lo scaricamento delle immagini, e perché il nome non dice cosa fa |
| [ficoProcess.md](ficoProcess.md) | promo, kit, lavorazione corrente ed esportazione |
| [griglia.md](griglia.md) | la mappa dell'impaginato: cosa va dove, prima di impaginare |
| [filtri.md](filtri.md) | i filtri di pagina del volantino, e i dieci nomi di «è una data» |
| [utility.md](utility.md) | settantasei membri e otto concetti: il file che va diviso |
| [confronti.md](confronti.md) | il Report Integrità, e i suoi duecento pannelli |

---

Insieme a [reportConteggi.md](reportConteggi.md), documentata nel Lotto 2, sono i quattro pezzi del
Report Integrità, tutti nati da I20-981.

**Sono anche gli unici file del Plugin su cui la ricognizione dei difetti non ha trovato niente da
segnalare**, e il motivo vale la pena dirlo: sono nati insieme ai loro test. Il movimento è sempre
lo stesso — togliere le regole da `indexNew.js` e `confronti.js`, che non si caricano sotto Node,
per poterle provare — e il risultato si vede.

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

## Cosa è stato rimosso e corretto durante il Lotto 3

Il motore CSS era il pezzo mai documentato, e documentarlo ha fatto emergere due difetti che
duravano da anni, entrambi della stessa natura: **un membro dell'oggetto chiamato senza `this.`**.
In un metodo quel nome non esiste come funzione globale, quindi la riga lancia `ReferenceError`; e
siccome in questo file quasi tutto è avvolto in un `try/catch`, l'errore spariva.

| cosa | esito |
|---|---|
| catena `MAIN_fixFoto` (28 membri, 627 righe) | **cancellata**: non poteva funzionare, e la chiamavano solo agenzie deprecate |
| `reflowTextFrameAvoidConflicts` | **corretta**: 1.230 righe che non erano mai partite, il reflow della descrizione nei PoP |
| agenzie `Doc` ed `Etruria` (9.120 righe) | **cancellate**: deprecate, e già orfane nel resto della suite |
| cinque membri senza chiamanti (211 righe) | **cancellati**: `adaptField`, `getBoundsLineByIndex`, due involucri e un membro inerte |
| `coloraResults` | **cancellata**: strumento di debug con l'unica chiamata commentata |
| `cambiStrutturali.js` | `textFrame` → `TextFrame`, vedi [cambiStrutturali.md](cambiStrutturali.md) |

In tutto **oltre 10.000 righe rimosse** dal Plugin.

A impedire il ritorno di quella classe di difetti c'è
`tests/plugin/cssFrameworkChiamateMembri.test.js`, che legge il sorgente come testo — il file non si
carica sotto Node — e fallisce se un membro viene chiamato senza `this.`.

## Dove le funzioni dovrebbero stare

Dal Lotto 5 in poi, leggendo le funzioni una per una, si annota anche **quando una sembra stare nel
file sbagliato** — senza spostare niente. Gli appunti servono al task di divisione dei file, che
altrimenti dovrebbe rifare la stessa lettura da capo.

| funzione | dov'è | dove dovrebbe stare |
|---|---|---|
| `controllaChiusuraReportIntegrita` | `events.js` | `reportIntegritaAvvio.js`: decide quando un report smette di valere, ed è una regola del report, non un evento |
| `normalize`, `isIn`, `getValueByPath` | `pluginMiddleware.js` | `utility.js`: sono utilità generiche, non mediano niente |
| `toFitOptions` | `pluginMiddleware.js` | `utility.js`, o accanto agli `enum*` di `CssFramework` |
| `calcolaDistanza` | `griglia.js` | `utility.js`: sei righe di geometria pura |

**Un caso a parte: due copie della stessa funzione.** `pluginMiddleware.getValueByPath` e
`cambiStrutturali._getNestedValue` fanno la stessa identica cosa. In I20-1002 sono state allineate
nel comportamento — quella di `cambiStrutturali` aveva il corpo commentato e non scendeva più nei
percorsi — ma **non unite fisicamente**: `pluginMiddleware.js` e `utility.js` richiedono InDesign e
sotto Node non si caricano, mentre `cambiStrutturali.js` sì e ha il suo test. Importare l'uno
dall'altro farebbe perdere quel test. Per unirle serve **un modulo puro che entrambi possano
importare**.

**Un file il cui nome nasconde il contenuto:** `cmd.js` contiene lo scaricamento delle immagini,
non «comandi». **Rinomina proposta: `scaricaImmagini.js`.** Costa quanto un file mal diviso, perché
chi cerca quel codice non guarda lì.

**Proposte valutate e scartate**, annotate con quello che si perde, perché non tornino senza sapere
cosa si è già deciso:

| proposta | cosa resta così |
|---|---|
| un modulo per le funzioni di parsing di `griglia.js` | `parseCodiceAssociato` resta non verificabile |
| una casa comune per le finestre modali | `griglia.js` resta con 382 righe di dialogo dentro |
| un `lavorazioneCorrente.js` per i quattro `get*LavorazioneCorrente` | chi vuole sapere il tipo di lavorazione deve importare tutto `ficoProcess` |

Il criterio con cui sono state scartate è sempre lo stesso, ed è il rovescio di quello che porta ad
accorpare: **un file nuovo si paga**, e va aperto solo quando il guadagno è evidente. Dove il
guadagno era solo la verificabilità di poche funzioni, o l'ordine formale, non è bastato.

**E una nota di disegno, non una ricollocazione:** `setBolloNOFOTO` e `setBolloFOTONOFOUND` in
`pluginMiddleware` mediano un'operazione su InDesign invece di un valore di configurazione. Se il
middleware debba delegare operazioni oltre che rispondere a domande è una decisione da prendere,
non un errore da correggere.

Il criterio è quello di sempre: **un file rappresenta un concetto**. Vale nei due sensi — ci sono
moduli piccoli da accorpare, e file grandi che contengono di tutto.

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
