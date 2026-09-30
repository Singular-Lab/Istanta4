# jsIndexControls.js

**Cosa è:** le funzioni che governano le schede del pannello. **Copia unica**: le chiamano sia il
codice sia gli `onclick` del markup di [index.html](index-html.md), che scrivono
`jsIndexControls.openTab(...)`, `jsIndexControls.changeImage(...)` e così via.

## Il click e il codice non fanno la stessa cosa, e devono non farla

Entrando in una scheda con un click l'operatore si aspetta che la scheda si prepari: in home si
ridisegna il tracciato, nel menabò si carica la home dei filtri. Il codice, quando cambia scheda,
**non deve** farlo:

- `EVENT_NO_REF_SELECTED` (`indexNew.js`) torna alla home, o al menabò, **a ogni deselezione**:
  ridisegnare lì il tracciato vorrebbe dire ridisegnarlo a ogni click nel vuoto;
- la chiusura della scheda aperta dal Report Integrità (`reportIntegrita/reportIntegrita.js`) torna alla home e subito
  dopo riapre il report: il ridisegno del tracciato in mezzo al report è quello che I20-981 aveva
  tolto.

Per questo quelle azioni **non stanno in `openTab`**: le dichiara il markup, con l'attributo
`data-method` dell'immagine, e `changeSubMenu` le esegue solo quando riceve `daOperatore = true`.
Lo passano gli `onclick` della barra; il codice non lo passa mai.

Fino a I20-1005 `index.html` teneva una seconda copia di queste funzioni, chiamata dai click, con
il `case 'Tab1'` che chiamava `mostraTracciato()` e il `data-method` letto sempre. Le due copie
erano già divergenti, e chi correggeva un comportamento dei tab lo correggeva a metà.

## Variabili globali

Nessuna propria. Dipende da globali esterne che non dichiara: `$` (jQuery) in quasi tutti i
metodi, `document` e `onresizeWindow` in `openTab`, e dentro `metodiDaMarkup` `filtriJs` e
`mostraTracciato`, lette al momento della chiamata perché quando il modulo si carica `indexNew.js`
non le ha ancora dichiarate.

Non fa `require('indesign')`, e si carica sotto Node: è coperto da
`tests/plugin/jsIndexControls.test.js`.

## Funzioni

- `metodiDaMarkup` → i nomi che il markup può scrivere in `data-method` e la funzione di ciascuno.
  Oggi: `filtriJs.visualizzaHomePageFiltri` e `mostraTracciato`. **Un `data-method` aggiunto al
  markup senza registrarlo qui non fa niente e non dà errore**; il test lo controlla.
- `metodoDaMarkup(nome)` → la funzione registrata per quel nome, o `null`.
- `clearSubmenu()` → nasconde tutti i sottomenù.
- `changeSubMenu(tabName, daOperatore = false)` → mostra il sottomenù della scheda e **apre il
  primo elemento visibile**: è così che entrando in una scheda si apre già la prima sottoscheda. Con
  `daOperatore` esegue anche il `data-method` di quell'elemento.
- `openTab(evt, tabName, functionToCall = null)` → nasconde tutte le schede e mostra quella
  chiesta, con le eccezioni dello `switch`: `Tab5` mostra «Salva», `Tab6` «Conferma», `Tab7`,
  `Tab8` e `Tab13` nascondono entrambi. Poi esegue `functionToCall`, se è una funzione, e chiude
  con `onresizeWindow()`.
- `changeImage(sender)` → il pulsante è un'immagine e «acceso» vuol dire un file diverso: spegne il
  fratello attivo togliendo `_active` dal nome e accende il cliccato aggiungendolo, tenendo
  allineato l'attributo `active`.
- `findOpenedTab()` → quale scheda è accesa, letta dall'attributo `active` delle immagini della
  barra. `null` se non ce n'è nessuna.

`openTabTracciato`, che non aveva chiamanti, è stata tolta con la copia di `index.html`.
