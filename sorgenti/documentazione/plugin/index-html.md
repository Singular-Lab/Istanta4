# index.html

**Cosa è:** il pannello che l'operatore vede dentro InDesign. Tutta l'interfaccia sta qui, in un
documento solo.

- **Script caricati:** due soli — `js/jquery.min.js` e `indexNew.js`. Tutto il resto del Plugin lo
  tira dentro `indexNew.js` con `require`.
- **Schede** (`#contenitoreTab`) → menabò, griglia, artwork, filtri, referenza, libro, utility.
- **Pannelli a copertura totale** → `#loadingPanel` blocca il lavoro durante le operazioni lunghe,
  `#loginPanel` prima dell'accesso.
- **Due blocchi `<script>` in fondo**: `toggleAdvancedMode` e `openTabSync`. Le funzioni dei tab
  non stanno qui ma in [jsIndexControls.js](jsIndexControls.md).

## Da sapere

Markup e comportamento non sono separati: molti elementi portano l'azione scritta nell'attributo
`onclick`. Chi cerca un pulsante lo cerca qui per `id`, e quell'`id` è il filo che lega
l'interfaccia al codice: rinominarlo rompe in silenzio.

## Le schede: si chiama jsIndexControls

Gli `onclick` della barra e dei sottomenù chiamano `jsIndexControls.openTab`,
`jsIndexControls.changeSubMenu`, `jsIndexControls.changeImage` e `jsIndexControls.clearSubmenu`:
`jsIndexControls` è una `const` di `indexNew.js`, e il markup la vede come vede `confronti` e
`Utility`.

- I click della **barra** passano `true` come secondo argomento di `changeSubMenu`: dicono che il
  click è dell'operatore, e solo allora parte il `data-method` della prima sottoscheda.
- L'attributo **`data-method`** dichiara cosa fare entrando in una sottoscheda col click: oggi
  «Consulta tracciato» ha `mostraTracciato` e «Filtri» ha `filtriJs.visualizzaHomePageFiltri`. Il
  nome va registrato in `jsIndexControls.metodiDaMarkup`, altrimenti non fa niente.
- Il click **diretto** su una sottoscheda passa la stessa funzione a `openTab`, che la esegue dopo
  aver mostrato la scheda: `jsIndexControls.openTab(event, 'Tab1', mostraTracciato)`.

Perché le azioni del click non stanno in `openTab`: vedi [jsIndexControls.md](jsIndexControls.md).

## Funzioni

- `toggleAdvancedMode(isChecked)` → mostra o nasconde la riga della modalità avanzata; quando la
  nasconde **azzera anche la spunta**, così non resta attiva invisibile.
- `openTabSync(evt, tabName)` → le tre schede della finestra di sincronizzazione foto (rimasti,
  terminati, falliti).

## Fino a I20-1005: due copie

Il primo blocco `<script>` conteneva una copia di `openTab`, `openTabTracciato`, `changeImage`,
`clearSubmenu` e `changeSubMenu`, con `functionMap` al posto di `metodiDaMarkup`, e la chiamavano i
click; il codice chiamava quella di `jsIndexControls.js`. Le due erano già divergenti: aprire una
scheda da codice e aprirla con un click non facevano la stessa cosa. La copia di qui è stata tolta,
con `resolveFunctionFromString`, che non aveva chiamanti.

Nel passaggio è cambiata una cosa sola del click: su «Filtri» l'`onclick` chiamava
`filtriJs.visualizzaHomePageFiltri()` con le parentesi, cioè **prima** di aprire la scheda,
passando a `openTab` il risultato. Ora le passa la funzione, che parte dopo l'apertura come già
succedeva entrando dal menabò.
