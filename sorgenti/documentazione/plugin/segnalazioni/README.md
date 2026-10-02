# segnalazioni/ — le segnalazioni di impaginazione

**Cosa è:** gli avvisi che nascono **durante l'impaginazione** di un box e restano scritti nel
documento. Esempi: CSF-009 (un elemento eccede la griglia), CSF-013 (conflitto fra elementi),
«descrizione spostata», «meccanica non trovata», gli errori IDX-57.5 e IDX-58. Nasce con
**I20-1029**.

**Non sono** le differenze della scheda ref (badge rosso e finestra «Differenze rilevate», I20-992)
né le segnalazioni del [Report Integrità](../reportIntegrita/README.md): quelle si ricalcolano
confrontando il box con il server e restano separate, per decisione dell'operatore.

## Come funziona (lotto 1, il registro)

Il **documento è il registro**. Ogni box ha al più un **bollino**:
- **vuoto**, senza testo;
- **colorato con la gravità peggiore** fra le sue segnalazioni: rosso gli errori, arancione i
  warning. Prima ogni segnalazione portava il suo colore, e CSF-013 era giallo;
- con **tutte le segnalazioni nell'etichetta** dell'ovale:

```
segnalazioni$[{"g":"error","c":"CSF-009","t":"Code CSF-009: L'elemento ..."},{"g":"warning","c":"CSF-013","t":"..."}]
```

`g` è la gravità (error, warning, notifica), `c` il codice quando il testo ne ha uno, `t` il testo.
È un JSON e non dei separatori a mano, perché i testi contengono già `$`, apici e due punti.

Così le segnalazioni sopravvivono alla chiusura del Plugin e di InDesign, viaggiano con il file e
si rileggono da qualunque flusso le abbia prodotte: Volantino, PoP, libro, Report Integrità, scheda
ref.

**Prima di I20-1029** il bollino portava come testo **una sola** segnalazione, la prima con
`applicaBollino` dopo l'ordinamento (non sempre la più grave), con « (Testo per mandare in
overflow)» in coda perché InDesign la segnalasse. Le altre si perdevano: restavano solo nel `.txt`
del report, che nessuno rileggeva. Un box rifatto accumulava un bollino sull'altro, e «descrizione
spostata» ne disegnava uno suo in più.

## I file

| file | cosa fa | InDesign | test |
|---|---|---|---|
| `etichetta.js` | il formato dell'etichetta: `scrivi`, `leggi`, `gravita`, `codice`, `ordina`, `gravitaPeggiore`, `colore`, `giaPresente` | no | `segnalazioniImpaginazione.test.js` |
| `segnalazioni.js` | il bollino nel documento: `applicaAlBox`, `togliDalBox`, `leggiDalBox`, `bolliniDelBox`, `leggiDocumento`; dal lotto 2 `risolviVoce` e `risolviTutte` | no, lavora sugli oggetti che riceve e disegna con `Utility.addBollinoCustom` | `segnalazioniImpaginazione.test.js` e `schermataSegnalazioni.test.js`, con box finti |
| `schermata.js` | la schermata delle segnalazioni del documento (lotto 2) | no, usa `$`, `Modali`, `app` di indexNew | `schermataSegnalazioni.test.js`: parti pure provate, il resto sul sorgente |

## Chi li usa (indexNew.js)

- `addSegnalazione` raccoglie le segnalazioni del box e **scarta i doppioni**: stessa chiave o
  stesso testo. Il motore CSS ripassa più volte sugli stessi controlli.
- `finalizzaSegnalazioni` chiama `Segnalazioni.applicaAlBox` con **tutte** le segnalazioni del box.
  Senza segnalazioni non tocca il bollino: la funzione arriva due volte per box, e la seconda con
  la lista vuota. Il messaggio nel report `.txt` e il messaggio di fine impaginazione restano com'erano.
- `impaginaBox` **svuota la lista all'inizio**: se il box di prima è andato in errore prima di
  chiuderle, le sue segnalazioni non passano a questo.
- `fixRefImpaginata` **toglie il bollino vecchio** prima di rifare il box: le segnalazioni nuove,
  se ce ne sono, le riscrive `finalizzaSegnalazioni`.
- `Utility.addBollinoCustom` ha un ultimo parametro facoltativo, `etichettaBollino`, che va
  sull'ovale. Senza, come prima.

## La schermata (lotto 2)

Un **popup** che legge i bollini del documento con `Segnalazioni.leggiDocumento` e mostra **tutte**
le segnalazioni del documento, non solo quelle dell'ultimo giro: quelle non risolte restano nei
bollini e devono restare visibili.

`leggiDocumento` fa una **lettura mirata**: il bollino è sempre un ovale figlio diretto del gruppo
del box, quindi guarda solo gli ovali dei gruppi di ogni pagina, più un livello sotto per i box
finiti dentro un altro gruppo. La prima versione scorreva tutti gli elementi del documento e leggeva
l'etichetta di ognuno: in collaudo il popup impiegava **6 secondi** ad aprirsi. Misurato in console
su quel volantino: 6339 ms contro 90 ms, con gli stessi bollini.

- **Per pagina, poi per box**: il nome del box (meccanica e codice gruppo, dal DNA), un pallino del
  colore della gravità peggiore, e sotto ogni segnalazione con il suo colore, il codice e il testo,
  inseriti come testo e non come HTML.
- **Vai al box**: porta alla pagina e seleziona il box, come fa il Report Integrità.
- **Risolvi**, accanto a ogni segnalazione, senza conferma: `Segnalazioni.risolviVoce` la toglie
  dall'etichetta e ridisegna il bollino con quelle che restano e il colore della gravità che resta;
  se non ne resta nessuna, il bollino sparisce.
- **Risolvi tutte**, sul box, **con conferma** («Sicuro? Sì / No») **dentro il popup**: la conferma di
  `Modali` sta a un livello più basso (5000) del popup (9000) e resterebbe nascosta.
- Dopo ogni risoluzione l'elenco si **rilegge dal documento**: gli indici e i box, che il bollino
  ridisegnato regruppa, cambiano.

**Dove si apre:**
- dal pulsante **«Segnalazioni»** in Menabò → Filtri, accanto a Conteggio e Impagina;
- **da sola a fine impaginazione**, se il giro ha prodotto segnalazioni (`apriSeCiSono`): Volantino
  (non il conteggio), PoP e impaginazione singola dal tracciato;
- **non** dopo Fix referenza (un box solo, il bollino si vede già), **non** dalle operazioni massive
  del Report Integrità (la aprirebbero a ogni box), **non** dentro il giro di un **libro** InDesign:
  lì i documenti si impaginano uno alla volta e si chiudono, e la schermata non avrebbe niente da
  mostrare. Per decisione dell'operatore il libro resta col solo messaggio di prima.

**I controlli del pannello restano sotto la schermata.** Il popup nasconde i controlli nativi
`.hideble` che trova, perché in UXP restano sopra a tutto. In collaudo, a fine Volantino, le caselle
Ordine del Menabò comparivano sopra la schermata (in console: 30 caselle, 0 nascoste; dal pulsante
3 nascoste, le sole visibili). Una traccia dei ridisegni del Menabò ha mostrato che arrivavano tutti
prima del popup: a riaccendere le caselle era `hideLoading()`, chiamato dopo l'apertura (nel `finally`
di Volantino e PoP, da chi lancia l'impaginazione singola). Ora `hideLoading()` non riaccende niente
se un popup è aperto: lo fa il popup quando si chiude. In più, a fine Volantino il ridisegno del
Menabò si aspetta (`await filtriJs.visualizzaHomePageFiltri()`), così non crea caselle a popup già
aperto. La barra verticale che si intravede a destra è quella della griglia del Menabò, e resta.

**Il PoP ora ha il suo report**: prima le segnalazioni del PoP venivano raccolte e buttate via;
dal lotto 2 passa da `stampaSegnalazioni` come il Volantino (file `.txt` e messaggio), fuori dal
giro di un libro.

## Il badge di pagina del tracciato (lotto 3)

Nella Home il pallino col numero di pagina di una referenza impaginata prende il colore della
segnalazione più grave del suo box: **rosso** gli errori, **arancione** i warning; senza
segnalazioni resta **blu**. Passandoci sopra: «2 segnalazioni di impaginazione (1 errore)».

- `Segnalazioni.riepilogoPerRecord(lette, dnaDelBox)` riassume le letture di `leggiDocumento` per
  `idRec`, dal DNA del box: `{ idRec: { gravita, segnalazioni, errori } }`. Una referenza in più box
  prende il peggiore e la somma. `Segnalazioni.chiaveRecord` rende uguali l'`idRec` del DNA (testo)
  e quello del tracciato (numero).
- `SchermataSegnalazioni.testoRiepilogo(riepilogo)` è il suggerimento.
- Il tracciato legge **una volta per ridisegno**, non una per riga. Quando la schermata si
  **chiude** (`SchermataSegnalazioni.allaChiusura`, il callback di chiusura di `Modali.popup`) i
  pallini si ricolorano senza rifare il tracciato: dopo un «Risolvi» il colore di prima non è più
  vero.
- Un box senza DNA leggibile, per esempio finito dentro un altro gruppo, resta blu nel tracciato.

Il dettaglio dal lato del tracciato sta in
[indexNew, 04](../indexNew/04-tracciato-messaggi-e-il-resto.md).

## I bollini vecchi (lotto 4)

Prima del I20-1029 il bollino era un **ovale senza etichetta** con dentro un riquadro di testo: una
sola segnalazione, spesso il solo codice («CSF-013»), più « (Testo per mandare in overflow)» per
farlo uscire dal riquadro. Si sommavano a ogni rifacimento del box. Misurato in console su un file
vecchio: 5 ovali così, tutti segnalazioni (CSF-013 gialli, «Descrizione spostata» arancioni), due
uguali sullo stesso box, nessun ovale della grafica.

- **Si riconoscono**: ovale **figlio diretto** del gruppo del box (dove `addBollinoCustom` lo metteva;
  gli ovali della grafica stanno dentro il box), **senza etichetta**, con un riquadro di testo.
  `Segnalazioni.bolliniVecchiDelBox`, `_voceBollinoVecchio`.
- **La voce**: `etichetta.daBollinoVecchio(testo, colore)`. Il testo è la storia del riquadro senza il
  pezzo per l'overflow; la gravità viene dal colore (`gravitaDaColore`: rosso errore, arancione e
  giallo warning, il resto notifica); la voce è segnata `vecchio: true`. Il messaggio intero non è mai
  stato scritto nel documento: la schermata mette accanto al testo «(bollino vecchio)».
- **Non sono segnalazioni** i bollini «Dif» del vecchio confronto dei box: esclusi.
- **Doppioni** una volta sola (`etichetta.senzaDoppioni`).
- **Si leggono con i nuovi**: `leggiDalBox` e `leggiDocumento` danno prima le voci del bollino e poi
  quelle vecchie, nello stesso ordine, perché «Risolvi» toglie per posizione. Così compaiono nella
  schermata e colorano il badge del tracciato.
- **Si tolgono con i nuovi**: `togliDalBox` toglie anche i vecchi, quindi Fix referenza e rifacimento
  del box non lasciano più due bollini.
- **«Risolvi» converte il box**: le voci rimaste, anche quelle vecchie, finiscono nell'unico bollino
  nuovo, e gli ovali vecchi spariscono.
