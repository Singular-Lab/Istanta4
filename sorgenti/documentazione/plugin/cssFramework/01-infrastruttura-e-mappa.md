# CssFramework — infrastruttura, contesto e mappa del box

Il gruppo che fa partire tutto: scaricare le regole, ricordare su cosa si sta lavorando,
fotografare il box prima di toccarlo, e tradurre i numeri del server in nomi.

Panoramica del file: [README.md](README.md).

---

## Variabili

### `semaforoDownloadFramework` — parte a `true`

Dice se le regole vanno riscaricate. Ogni impaginazione lo rialza chiamando
`richiediDiScaricareFramework()` da `indexNew.js:2135`; la prima operazione che ha bisogno delle
regole le scarica e lo abbassa.

**È la differenza fra una chiamata al server e centinaia:** le regole si scaricano una volta per
impaginazione, non una per box. Nasce a `true` perché il primo box di una sessione deve scaricarle
comunque.

### `contestoCss` — parte a `null`

Lo stato del lavoro sul box corrente, riempito da `memorizzaContestoCss`:

| campo | cos'è |
|---|---|
| `etichettaBox` | la label del box, cioè la sua meccanica |
| `boundsBoxImpaginato` | dove il box è finito in pagina |
| `mappaBoxOriginale` | com'era il box prima che lo toccassimo |
| `itemRef` | la referenza che ci sta dentro |
| `DBallineamenti` / `DBDefault` | le regole del cliente e quelle di default |
| `prefissiDerivati` | i prefissi delle copie da duplicazione |

Esiste perché parecchie funzioni hanno bisogno di questi dati e passarseli tutti attraverso catene
di chiamate lunghe era impraticabile. **È il compromesso da cui discende la non rientranza**: non
una svista, ma un prezzo pagato consapevolmente.

---

## Funzioni

### Infrastruttura

- `richiediDiScaricareFramework()` → alza il semaforo.
- `getAllineamentiDB(callback)` → scarica le regole da `FrameworkCssController/scaricaAllineamenti`
  e ne salva una copia in `allineamenti.json` nella cartella di lavorazione.

  **Quella copia non è un residuo:** se lo scaricamento fallisce il motore la rilegge e va avanti
  con l'ultima versione scaricata, scrivendolo in console. Se manca anche quella, l'operazione si
  annulla. Codici: `CSF-002` per il parsing della risposta.

- `memorizzaContestoCss(box, boundsBoxImpaginato, mappaBoxOriginale, itemRef, DBallineamenti, DBDefault)`
  → riempie `contestoCss` all'inizio del lavoro su un box.

### La mappa del box

- `creaMappaturaBoxOriginale(box, prefissiDerivati)` → fotografa il box **prima** che lo si tocchi:
  per ogni elemento con una label, l'oggetto InDesign e i suoi bounds **relativi al box**.

  Relativi perché il box verrà spostato e ridimensionato, e una misura assoluta scadrebbe al primo
  movimento. I bounds vengono anche tagliati ai bordi del box, così un elemento che sporge non falsa
  i conti successivi.

  **La chiave dipende da cosa è l'elemento:** per una copia nata da duplicazione è la label intera,
  per tutti gli altri è la label normalizzata da `Utility.parseLabel`. È qui che si vede all'opera la
  ragione di `etichettaDerivata` in [cssComposizioneBox](composizioneBox.md): normalizzare la
  label di una copia taglierebbe il suffisso e farebbe **di due ombre un elemento solo**.

- `updateMap(mappa)` → non ricostruisce niente: marca `eliminato: true` quello che InDesign non
  considera più valido. **Un elemento rimosso resta nella mappa come lapide**, perché le regole che
  lo nominavano devono sapere che non c'è più, non trovarsi un buco.

- `aggiungiNuoviElementiAllaMappa(box, mappa, prefissiDerivati)` → il caso opposto. **Le copie delle
  duplicazioni nascono a valle degli allineamenti**, e senza questo passaggio le regole eseguite in
  un momento successivo non le vedrebbero affatto. Vedi
  [cssSequenzaOperazioni](sequenzaOperazioni.md) per i momenti.

### Leggere le regole di un box

- `getElementoBoxDB(box, DBallineamenti, DBDefault)` → cerca il box **per meccanica**, cioè per la
  sua label, prima nel DB del cliente e poi in quello di default. È la gerarchia a due livelli di
  tutto il framework: il cliente sovrascrive il default, e se non dice niente vale il default.
- `getPrefissiDerivati(box, DBallineamenti, DBDefault)` → i prefissi delle copie.
- `getSceltaSpazioFoto(box)` → la preferenza sullo spazio foto. `null` vuol dire area massima, come
  sempre. Dettaglio in [sceltaSpazio](../sistemazioneFoto/sceltaSpazio.md).
- `getEstensioniFoto(box)` → lo spazio da riservare attorno alle foto, per lato, in millimetri.

  Usa **le stesse espressioni dei post ridimensionamenti**: un numero, oppure un'etichetta con le
  sue specifiche come `sy_ombra*[H][50%]` per metà dell'altezza dell'ombra. Si misura sul box **com'è
  adesso**, non sulla mappa d'origine, perché gli elementi derivati nascono dopo quella mappa.
  Un'etichetta che nel box non c'è, o che c'è ma è invisibile, **azzera il lato**: non c'è nulla per
  cui fare spazio.

### Applicare il CSS a un campo

`adaptField` **non c'è più.** Interpretava una stringa `css` con `move`, `resize`, `max-sizeX/Y`,
`min-sizeX/Y`, `alignX` e `alignY`, ma in tutto il repository compariva **una volta sola**, la sua
definizione: 140 righe senza un chiamante. Cancellata in I20-1002.

L'interprete vivo delle espressioni di dimensione è `calcolaValoreDimensione`, con una sintassi
diversa e documentata in
[04-ridimensionamento-e-overflow](04-ridimensionamento-e-overflow.md).

### Tradurre i numeri del server

| funzione | valori |
|---|---|
| `enumAxisResizeMode` | `proporzionale`, `ingrandimento_lineare`, `spostamento_lineare`, `spostamento_lineare_centrato` |
| `enumLetturaLivelli` | colonne L→R, colonne R→L, righe T→B, righe B→T |
| `enumInternalAnchor` | `left`, `right`, `top`, `bottom` |
| `enumVerticalReferenceLine` | `top`, `bottom`, `middle` |
| `enumHorizontalReferenceLine` | `left`, `right`, `middle` |
| `enumPriorityAxis` | `x`, `y` — **default `"x"`** |
| `enumFitOperation` | `FRAME_TO_CONTENT`, `CONTENT_TO_FRAME`, `PROPORTIONALLY`, `FILL_PROPORTIONALLY` |

Tutti tornano `null` su un valore sconosciuto, **tranne `enumPriorityAxis`**. Non è una svista da
correggere alla leggera: per l'asse prioritario esiste un default sensato, per gli altri no, e un
`null` fa saltare la regola invece di applicarla a caso.
