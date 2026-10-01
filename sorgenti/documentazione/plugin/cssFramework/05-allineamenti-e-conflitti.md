# CssFramework — allineamenti, ancoraggi, condizioni, conflitti, composizione

**A cosa serve questo gruppo: mettere ogni elemento del box dove la regola dice che deve stare.**

È il gruppo più numeroso — una trentina di membri, circa 3.100 righe — e contiene quattro cose
distinte che condividono lo stesso impianto: gli allineamenti, gli ancoraggi fra gruppi, le
condizioni che decidono se una regola si applica, e le segnalazioni all'operatore quando due
elementi finiscono uno sopra l'altro.

Panoramica del file: [README.md](README.md).

---

## Allineare

- `applicaAllineamentoCss(box, bounds, mappa, itemRef, bypassDownload, momento)` → l'ingresso,
  chiamato da `indexNew`. Scarica le regole se il semaforo è alzato e passa ad `allineamenti`.
- `allineamenti(box, bounds, mappa, itemRef, DBallineamenti, DBDefault)` → cerca le regole del box
  per meccanica, con la solita gerarchia a due livelli, e le applica gruppo per gruppo.
- `AllineamentoInternoGruppo(box, nomeGruppo, gruppoElementi, ordinamento, lettura, Spacing, mappa, itemRef)`
  → dispone gli elementi di un gruppo: **ordinamento per livello**, **direzione di lettura** —
  colonne o righe, in un verso o nell'altro, vedi `enumLetturaLivelli` in
  [01-infrastruttura-e-mappa](01-infrastruttura-e-mappa.md) — e **spaziatura**. I bounds in arrivo
  sono relativi al box e qui diventano assoluti.

  **È la funzione più grande del file**, 797 righe.

## Ancorare

- `FollowAnchorGruppo(...)` → fa seguire un gruppo a un altro.
- `followGroup(gruppoSeguito, gruppoAllineamento, anchor, direction, useTextBounds, isItemLinkGruppo)`
  → lo spostamento vero su un asse.
- `followStaticAnchor(...)` → come sopra, ma il bersaglio è un punto fisso del box invece di un
  altro gruppo.

**La struttura di un'ancora**, documentata nel codice e per asse:

| campo | cosa dice |
|---|---|
| `nomiGruppiSeguiti` | chi si segue; può essere il nome di un gruppo o di una singola etichetta |
| `distance` | la distanza da mantenere, in millimetri |
| `distancePercentuale` | I20-1026: si somma a `distance` una percentuale della dimensione del gruppo seguito sull'asse (larghezza per x, altezza per y). Vedi [sovrastrutture](sovrastrutture.md) |
| `allineaAlLato` | il lato del bersaglio a cui ci si avvicina: `left`, `right`, `middle` |
| `allineaLato` | il proprio lato di riferimento, stessi valori |
| `stopOnCollision` | ci si ferma in anticipo se si va addosso a qualcosa |

## Condizionare

- `checkCondition(mappa, itemRef, condizione, box)` → se una regola si applica a questo box.
  Le condizioni previste comprendono `elementiDaTrovare` — basta che ne manchi uno e la condizione è
  falsa — `elementiDaNonTrovare`, e `touchCondition`, che usa `elementsTouching` per chiedere se
  un'etichetta ne tocca un'altra.
  Dal I20-1026 ci sono anche `refCondition`, sui dati della ref, e `formaBoxCondition`, sulla forma
  del box (largo, alto, standard): vedi [sovrastrutture](sovrastrutture.md).
- `checkSetCondition(...)` e `checkAllConditions(...)` → la applicano a insiemi di condizioni.

## Segnalare i conflitti

Dodici membri con il suffisso `*SegnalazioniConflitti*`. Il meccanismo ha **due tempi**:

1. `preparaSegnalazioniConflitti(box, DBallineamenti, DBDefault)` raccoglie le regole del box e le
   mette in sospeso in `segnalazioniConflittiPendenti`;
2. `controllaSegnalazioniConflittiPendenti(box)` guarda alla fine se gli elementi che non dovevano
   toccarsi si toccano, e segnala.

Due tempi perché **durante la lavorazione i conflitti sono transitori**: un elemento è sopra un
altro finché non viene spostato. Per la stessa ragione `indexNew` alza
`sospendiControlloSegnalazioniConflitti` attorno al fix foto.

**La lettura delle regole non è qui:** vive in [cssRegoleConflitti](regoleConflitti.md), fuori
da InDesign e con i suoi test.

## Comporre

- `applicaComposizioneBox(...)` → esegue sul documento il piano calcolato da
  [cssComposizioneBox](composizioneBox.md): duplicazioni e ordine di sovrapposizione.
- `riapplicaComposizioneBox(...)` → lo rifà dopo che le cose si sono mosse.
- `riportaDentroAlBox(...)` ed `elementoDentroAlBox(...)` → il rientro degli elementi derivati.
- `applicaOperazioniDopoFixFoto(box, bounds)` → il momento `dopoFixFoto` di
  [cssSequenzaOperazioni](sequenzaOperazioni.md).

## Variabili

| nome | cos'è |
|---|---|
| `segnalazioniConflittiPendenti` | le regole preparate per il box in lavorazione, in attesa del controllo finale |
| `sospendiControlloSegnalazioniConflitti` | quando è vero il controllo non scatta; lo alza `indexNew` attorno al fix foto |

## Funzioni di servizio

- `makeRegexFromGroupName(nome)` → trasforma `sy_ombra*` in `/^sy_ombra.*$/`. Toglie i suffissi
  `[itemLink]` e `[exist]` e protegge i caratteri speciali tranne l'asterisco. **È la funzione la
  cui chiamata senza `this.` teneva ferma `reflowTextFrameAvoidConflicts`**, vedi
  [04-ridimensionamento-e-overflow](04-ridimensionamento-e-overflow.md).
- `parseGroupSpec(nome)` → separa il suffisso `[exist]`, che vuol dire «vale solo se c'è».
- `getRealBounds(item)` → i bounds veri: su una casella di testo quelli del **testo**, non del
  riquadro.
- `getItemContained(item)` → scende dentro i gruppi fino agli elementi foglia.

---

## Cosa è stato rimosso e sistemato in I20-1002

**Cinque membri morti, 211 righe.** Nessuno di questi aveva un chiamante: in tutto il repository
comparivano una volta sola, la propria definizione.

| membro | righe | nota |
|---|---|---|
| `adaptField` | 140 | interpretava una stringa `css` con `move`, `resize`, `max-size*`, `align*`. L'interprete vivo è `calcolaValoreDimensione`, che ha una sintassi diversa |
| `getBoundsLineByIndex` | 48 | `getBoundsLine` invece è viva |
| `normalizzaRegolaSegnalazioniConflitti` | 4 | involucro rimasto a metà strada quando la logica è passata a `cssRegoleConflitti` con I20-974 |
| `splitSegnalazioniConflittiSpec` | 4 | idem |

**`etichetteSegnalate` ripulita.** Il membro c'era ma era inerte: tutti e tre gli accessi — l'azzeramento in `applicaRidimensionamento` e le due letture in `fixOverflowFromBox` — erano senza
`this.` e lavoravano su una globale implicita. Funzionava perché sbagliavano tutti allo stesso modo,
ma bastava che qualcuno scrivesse `this.etichetteSegnalate` per far sparire le segnalazioni in
silenzio. Ora il membro è quello vero e i tre accessi passano da `this.`.

**I `catch` silenziosi, resi espliciti dove serviva.** Erano ventuno, e non sono tutti uguali:

- in `getAllineamentiDB` il `console.error` **era commentato**. Se la copia di riserva in
  `allineamenti.json` non si scrive, il prossimo scaricamento fallito non ha su cosa ripiegare e
  l'operazione si annulla. Ora c'è un errore vero, `CSF-009`.
- i tre ripieghi sull'id — `getBoxKeySegnalazioniConflitti`, `getItemKeySegnalazioniConflitti`,
  `elementoVisibilePerSegnalazioniConflitti` — hanno un valore alternativo nella riga successiva:
  lì è scritto **dentro il `catch`** cosa succede, invece di un log che ripeterebbe la stessa cosa a
  ogni chiamata.
- i tredici dentro `reflowTextFrameAvoidConflicts` sono **fallback deliberati**: l'algoritmo
  interroga InDesign su proprietà che su certi oggetti non esistono e prova subito la strada
  alternativa. Un log lì significherebbe una riga in console per ogni carattere esaminato. C'è una
  nota in testa alla funzione che spiega la convenzione.

Resta vero che **in questo file un errore non fa rumore**, ed è il motivo per cui i due difetti
gravi di I20-1002 sono rimasti nascosti per anni. A prevenirne il ritorno c'è ora
`tests/plugin/cssFrameworkChiamateMembri.test.js`, che guarda il sorgente invece dei log.
