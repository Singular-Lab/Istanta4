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
   nati di recente (`versionePlugin`, `reportIntegrita/avvio`) sono l'eccezione voluta, scritti
   apposta per essere verificabili da soli.
2. **`ipconfig.json` e `custom.js` cambiano per cliente**, montati da `monta-cliente.sh`. Quello che
   trovi nel repository è l'ultimo montaggio fatto su quella macchina, non il prodotto.
3. **Il Plugin ha residui.** Dove un file è morto o svuotato questa documentazione lo dice, perché
   serve anche a indicare cosa *non* vale la pena guardare.

---

## Come è organizzato il Plugin: un concetto, una cartella

Regola decisa con l'operatore il 2026-09-30, applicata per la prima volta in **I20-1009**. Vale per
i lavori di divisione e accorpamento che seguono (I20-1014, I20-1015, I20-1012, e quello che resta
di I20-1007).

- **Un file rappresenta un concetto.** Quando un concetto ha bisogno di più di un file, ha **una
  cartella sua**: `plugin/<concetto>/`. Le prime sono [sistemazioneFoto/](sistemazioneFoto/README.md)
  (I20-1009) e [reportIntegrita/](reportIntegrita/README.md) (I20-1014).
- **Quando due parti non pure di un concetto condividono lo stato**, come il flusso e i pannelli
  del report, stanno in due file ma in **un oggetto solo**: il secondo si mescola nel primo con
  `Object.assign`, e a runtime il `this` è uno. Si divide il file, non lo stato.
- **Dentro la cartella, la parte pura sta separata da quella che parla con InDesign.** La parte
  pura non fa `require('indesign')`, si carica sotto Node ed è verificata dai test; l'altra si prova
  solo in collaudo. È la divisione che ha prodotto i moduli buoni del Plugin, e non si mescola.
- **I nomi dentro la cartella non ripetono il prefisso del vecchio ospite.** `cssSpazioFoto.js`,
  entrato in `sistemazioneFoto/`, è diventato `sceltaSpazio.js`.
- **Il file da cui il concetto esce tiene dei rimandi** di una riga per i membri che chiamano le
  agenzie. `Agenzie/*/custom.js` fa `require('./utility')` e `require('./CssFramework')` e usa quei
  membri per nome: senza rimandi, ogni spostamento romperebbe un cliente. **Il core chiama il
  modulo nuovo direttamente**, e un test lo controlla.
- **I test restano in `tests/plugin/`**, senza sottocartelle: la CI lancia
  `node --test tests/plugin/*.test.js`. Chi scandisce i file del Plugin usa
  `tests/plugin/fileDelPlugin.js`, che guarda anche nelle cartelle dei concetti.
- **La documentazione segue il codice**: `sorgenti/documentazione/plugin/<concetto>/`, con un
  README del concetto e una pagina per parte.
- **Il codice commentato non si trasloca.** Resta nella storia git.

---

## Stato del lavoro

| lotto | file | stato |
|---|---|---|
| 1 — Fondamenta | `manifest.json`, `ipconfig.json`, `index.html`, `logger.js`, `versionePlugin.js`, `XMLHttpRequestClient.js` | **fatto** |
| 2 — Utilità piccole | `barraScorrimento`, `dissolvenza`, `tooltipPosizione`, `jsIndexControls`, `cacheHashFoto`, `dataCaricamentoFoto`, `credenzialiSalvate`, `fotoAutoSync`, `garbageCollector`, `cambiStrutturali`, `ricollegaEsiti`, `reportConteggi`, `trattiDescrizione`, `variantiDescrizione` | **fatto** |
| 3 — Motore CSS | `CssFramework`, `cssComposizioneBox`, `cssRegoleConflitti`, `cssSequenzaOperazioni`, `cssSpazioFoto` (dal I20-1009 `sistemazioneFoto/sceltaSpazio`), `noRenderElementi` | **fatto** |
| 4 — Report | `reportConfronti`, `reportConfrontoCsv`, `reportIntegritaAvvio` | **fatto** |
| 5 — Nucleo | `utility`, `events`, `cmd`, `pluginMiddleware`, `custom`, `filtri`, `griglia`, `ficoProcess`, `schedaArtwork`, `InputEditController`, `schedaRef`, `confronti`, `indexNew` | **fatto** |

**Con il Lotto 5 questo lavoro è concluso.**

Restano fuori i tre `custom.js` di cliente — Edro21, Coopfi, Famila — e la cartella `Receiver`.
**Non sono in arretrato: sono fuori perimetro per decisione dell'operatore.** Le agenzie sono un
caso a sé e vorranno una documentazione loro, con criteri diversi da questi; oggi non è in
programma, e non c'è un task aperto. Chi arriva qui cercando quelle pagine non le trova perché non
devono esserci, non perché qualcuno le ha dimenticate.

Quello che serve sapere sul confine col cliente sta comunque in [custom.md](custom.md) e
[pluginMiddleware.md](pluginMiddleware.md): il file dell'agenzia montato in radice è documentato,
ed è documentato il meccanismo con cui il server prevale su di lui.

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
| [reportIntegrita/conteggi.md](reportIntegrita/conteggi.md) | i numeri sulle linguette del Report Integrità (era `reportConteggi.js`) |
| [dataCaricamentoFoto.md](dataCaricamentoFoto.md) | il badge con la data sulle foto |
| [ricollegaEsiti.md](ricollegaEsiti.md) | cosa dire all'operatore dopo un ricollegamento |
| [trattiDescrizione.md](trattiDescrizione.md) | i tratti di stile di un campo descrizione |
| [variantiDescrizione.md](variantiDescrizione.md) | quale variante di descrizione comanda |
| [credenzialiSalvate.md](credenzialiSalvate.md) | le credenziali nell'archivio cifrato del sistema |
| [fotoAutoSync.md](fotoAutoSync.md) | scaricare e impaginare la foto in un colpo solo |
| [jsIndexControls.md](jsIndexControls.md) | le schede del pannello, per il codice e per i click |
| [garbageCollector.md](garbageCollector.md) | la rimozione differita degli elementi InDesign |
| [cambiStrutturali.md](cambiStrutturali.md) | quali cambi strutturali si applicano a una referenza |

### Lotto 3 — il motore CSS

| pagina | il file che spiega |
|---|---|
| [cssSequenzaOperazioni.md](cssSequenzaOperazioni.md) | quando una regola del framework viene eseguita |
| [cssRegoleConflitti.md](cssRegoleConflitti.md) | quali elementi non devono toccarsi, e su cosa si misura |
| [cssComposizioneBox.md](cssComposizioneBox.md) | duplicare elementi e decidere chi sta davanti |
| [sistemazioneFoto/](sistemazioneFoto/README.md) | trovare dove c'è posto nel box e farci stare le foto: tre file, uno puro per il calcolo dei rettangoli e uno per la scelta. Uscito da `CssFramework` in I20-1009 |
| [noRenderElementi.md](noRenderElementi.md) | rendere invisibili singoli elementi di un box |
| [cssFramework/](cssFramework/README.md) | il motore vero: 7.283 righe, spiegate in tre pagine per gruppo |

### Lotto 4 — i report

| pagina | il file che spiega |
|---|---|
| [reportIntegrita/avvio.md](reportIntegrita/avvio.md) | quando il Report Integrità parte, e quando smette di valere (era `reportIntegritaAvvio.js`) |
| [reportIntegrita/sezioneConfronti.md](reportIntegrita/sezioneConfronti.md) | la sezione Confronti: cosa è cambiato nei campi che l'agenzia tiene d'occhio (era `reportConfronti.js`) |
| [reportIntegrita/csv.md](reportIntegrita/csv.md) | come è fatto il csv, e perché è fatto per Excel (era `reportConfrontoCsv.js`) |

Dal I20-1014 stanno in [reportIntegrita/](reportIntegrita/README.md), insieme al flusso e ai pannelli
del report.

### Lotto 5 — il nucleo

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
| [confronti.md](confronti.md) | il motore di confronto fra documento e dato; fino a I20-1014 anche il Report Integrità, ora in [reportIntegrita/](reportIntegrita/README.md) |
| [schedaRef.md](schedaRef.md) | la scheda della referenza, e i tre concetti che contiene |
| [indexNew/](indexNew/README.md) | il file che tiene insieme il Plugin: 129 funzioni, tutte documentate |

---

Insieme a [reportIntegrita/conteggi.md](reportIntegrita/conteggi.md), documentata nel Lotto 2, sono i quattro pezzi del
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

1. **`XMLHttpRequestClient.abort()` non interrompe la richiesta in volo** — corretto da I20-1004:
   ora la ferma e dice all'operatore cosa è stato annullato e perché
   ([XMLHttpRequestClient.md](XMLHttpRequestClient.md)).
2. **`index.html` e `jsIndexControls.js` contengono due copie divergenti delle funzioni dei tab** —
   corretto da I20-1005: resta la copia di `jsIndexControls.js`, e le azioni del solo click le
   dichiara il markup ([index-html.md](index-html.md) e [jsIndexControls.md](jsIndexControls.md)).
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

## Cosa è stato rimosso e corretto durante il Lotto 5

Il nucleo è la parte grossa, e leggerla ha fatto emergere i difetti descritti nelle singole pagine.
Quelli di `indexNew.js` stanno in
[indexNew/04-tracciato-messaggi-e-il-resto.md](indexNew/04-tracciato-messaggi-e-il-resto.md).

| cosa | esito |
|---|---|
| agenzie `Pac` e `Trea` (11.733 righe) | **cancellate**: deprecate. Restano Edro21, Coopfi e Famila |
| `sincronizzaBoxGriglia` (142 righe) | **cancellata**: zero chiamanti, e dentro 14 `Utiliy.` al posto di `Utility.` |
| `escludiRef`, `ripristinaElemento`, `compilaTabElementiEsclusi` (219 righe) | **cancellate**: la funzione è già viva in `griglia.js`, e queste scrivevano `listaRefEscluse.json` in un formato che nessun altro sa leggere |
| `decodificaNomeFile` | **cancellata**: abbozzo senza chiamanti che restituiva una promo inventata. Quella vera è `customAgenzia.decodificaNomeFile` |
| `indexNew.replaceAll` | **cancellata**: copia locale senza chiamanti, e il suo `while` non termina se la sostituzione contiene la stringa cercata |
| `indexNew.makeRegexFromGroupName` | **rinominata** `makeRegexFromFieldName`: era una globale omonima di un membro di `CssFramework` che fa una cosa diversa, quindi un `this.` dimenticato là cadeva qui **senza errore** |
| `showLoading` | **corretta**: una riga col solo identificatore `Default`, che lanciava `ReferenceError` nel ramo di ripiego |
| `checkPercorsi` | **corretta**: leggeva `forceOptions`, un parametro rimosso — `ReferenceError` ogni volta che mancava un percorso |
| `monta-cliente.sh` | allineato: non offre più i due clienti cancellati |

### Difetti del Lotto 5 non corretti

Tre, tutti in `indexNew.js`, tutti da task separato perché correggerli cambia il comportamento:

4. **`await` applicato alla negazione di una promise**, in `initDocumentInLavorazione` e
   `initLibroInLavorazione`: `while (await !checkPercorsi())` non gira mai, quindi l'attesa dei
   percorsi di sistema non avviene.
5. **`autoCompilazioneCampiKit` non fa niente**: manca l'assegnazione del risultato di
   `customAgenzia.decodificaNomeFile`, quindi la compilazione automatica dei campi del kit è morta
   da sempre — e senza errore, perché le tendine restano semplicemente vuote.
6. **`writeDebugMessageForCrash` scrive su un percorso inesistente**: concatena `pathLavorazione`
   a `percorsoLogs`, che è già assoluto. Il log di crash non viene mai scritto, e all'operatore
   compare un avviso fuorviante di «cartella logs assente».

## Dove le funzioni dovrebbero stare

Dal Lotto 5 in poi, leggendo le funzioni una per una, si annota anche **quando una sembra stare nel
file sbagliato** — senza spostare niente. Gli appunti servono al task di divisione dei file, che
altrimenti dovrebbe rifare la stessa lettura da capo.

| funzione | dov'è | dove dovrebbe stare |
|---|---|---|
| `controllaChiusuraReportIntegrita` | `events.js` | **fatto in I20-1014**: la decisione è `ReportIntegrita.chiudiSeNonValePiu`, e in `events.js` resta la chiamata a intervalli |
| `normalize`, `isIn`, `getValueByPath` | `pluginMiddleware.js` | `utility.js`: sono utilità generiche, non mediano niente |
| `toFitOptions` | `pluginMiddleware.js` | `utility.js`, o accanto agli `enum*` di `CssFramework` |
| `calcolaDistanza` | `griglia.js` | `utility.js`: sei righe di geometria pura |
| `setVersionePlugin`, `controllaVersionePubblicata`, `bloccaPerVersioneDisallineata` | `indexNew.js` | `versionePlugin.js`, che **esiste già** e tiene il confronto fra versioni |
| `getFiltroButtonMarkup`, `setFiltroButtonsDefaultMarkup` | `indexNew.js` | `filtri.js`: sono le uniche due righe di `indexNew` che parlano dell'aspetto dei filtri |
| `clearFile`, `readFile`, `appendToFile` | `indexNew.js` | `utility.js`: è accesso al disco, non interfaccia |
| `scaricaContenutoKit`, `scaricaContenutoKitAsync`, `leggiContenutoKit` | `indexNew.js` | `ficoProcess.js`, che già fa ricerca e selezione del kit |
| `showLogin`, `login`, `logout`, `setFinestrePerRuolo` | `indexNew.js` | un js dell'accesso: sono quattro funzioni di un concetto solo |
| `checkPercorsi`, `impostaPercorsiDiSistema` | `indexNew.js` | un js dei percorsi di lavoro |
| `getIdRecFromItemRef`, `getCodiceGruppoFromItemRef`, `makeCodiceAssociatoLabel`, `makeCodiceFiltroFromItemRef`, `sameCodiceFiltro`, `addCodiceFiltroToReq` | `indexNew.js` | un js loro, o `utility.js`: sono l'identità di una referenza, e le usa anche `griglia.js` |
| `addSegnalazione`, `finalizzaSegnalazioni`, `stampaSegnalazioni` | `indexNew.js` | il js del Report Integrità già previsto |
| `datiPrimarioPerConfronto`, `boxDellElementoMappa`, `preAnalisiBoxMappato` | `indexNew.js` | idem |
| `checkForLoghiCore`, `rimuoviSimboli` | `indexNew.js` | il js delle foto già previsto |
| `applyOverflowFix` | `indexNew.js` | `CssFramework.js`: è una regola di impaginazione sul contenuto di un campo |
| `getSchedaRefAsync` | `indexNew.js` | `schedaRef.js`, accanto alla funzione che avvolge |

**Un caso a parte: due copie della stessa funzione.** `pluginMiddleware.getValueByPath` e
`cambiStrutturali._getNestedValue` fanno la stessa identica cosa. In I20-1002 sono state allineate
nel comportamento — quella di `cambiStrutturali` aveva il corpo commentato e non scendeva più nei
percorsi — ma **non unite fisicamente**: `pluginMiddleware.js` e `utility.js` richiedono InDesign e
sotto Node non si caricano, mentre `cambiStrutturali.js` sì e ha il suo test. Importare l'uno
dall'altro farebbe perdere quel test. Per unirle serve **un modulo puro che entrambi possano
importare**.

**Un doppione da togliere:** `delay` in `indexNew.js` fa esattamente quello che fa già
`Utility.sleep`. Una delle due va tolta, e nel Plugin `Utility.sleep` è quella usata ovunque.

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
