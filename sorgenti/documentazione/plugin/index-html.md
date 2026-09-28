# index.html

**Cosa è:** il pannello che l'operatore vede dentro InDesign. Tutta l'interfaccia sta qui, in un
documento solo.

- **Script caricati:** due soli — `js/jquery.min.js` e `indexNew.js`. Tutto il resto del Plugin lo
  tira dentro `indexNew.js` con `require`.
- **Schede** (`#contenitoreTab`) → menabò, griglia, artwork, filtri, referenza, libro, utility.
- **Pannelli a copertura totale** → `#loadingPanel` blocca il lavoro durante le operazioni lunghe,
  `#loginPanel` prima dell'accesso.
- **Due blocchi `<script>` in fondo** (righe 785 e 1235 circa): comportamento dei tab e dialoghi.

## Da sapere

Markup e comportamento non sono separati: molti elementi portano l'azione scritta nell'attributo
`onclick`. Chi cerca un pulsante lo cerca qui per `id`, e quell'`id` è il filo che lega
l'interfaccia al codice: rinominarlo rompe in silenzio.

## Variabili globali

| nome | cos'è |
|---|---|
| `functionMap` | mappa un nome scritto come stringa nell'attributo `data-method` di un elemento alla funzione vera da chiamare |

Oggi `functionMap` contiene **una voce sola**, `filtriJs.visualizzaHomePageFiltri`. Serve perché
l'interfaccia dichiara l'azione come testo nel markup; se aggiungi un `data-method` senza
registrarlo qui, il click non fa niente e non dà errore.

## Funzioni

- `openTab(evt, tabName, functionToCall)` → nasconde tutte le schede, mostra quella chiesta, poi
  applica le eccezioni: `Tab1` chiama `mostraTracciato()`, `Tab5` mostra «Salva», `Tab6` mostra
  «Conferma», `Tab7`, `Tab8` e `Tab13` nascondono entrambi. Se le passi una funzione la esegue
  dopo, e chiude sempre con `onresizeWindow()`.
- `openTabTracciato(evt, tabName)` → come sopra ma sulle schede interne del tracciato. **Nessun
  chiamante**, né dal markup né dal codice.
- `changeImage(sender)` → il pulsante è un'immagine, e «acceso» vuol dire un file diverso: spegne
  quello attivo fra i fratelli togliendo `_active` dal nome e accende il cliccato aggiungendolo,
  tenendo allineato l'attributo `active`.
- `clearSubmenu()` → nasconde tutti i sottomenù.
- `changeSubMenu(tabName)` → mostra il sottomenù della scheda e **simula il click sul suo primo
  elemento visibile**: ne legge l'attributo `tab`, cerca in `functionMap` l'eventuale `data-method`
  e chiama `openTab`, poi `changeImage`. È il motivo per cui entrare in una scheda apre già la prima
  sottoscheda giusta.
- `toggleAdvancedMode(isChecked)` → mostra o nasconde la riga della modalità avanzata; quando la
  nasconde **azzera anche la spunta**, così non resta attiva invisibile.
- `openTabSync(evt, tabName)` → le tre schede della finestra di sincronizzazione foto (rimasti,
  terminati, falliti).
- `resolveFunctionFromString(path)` → risolverebbe `"a.b.c"` in una funzione partendo da `window`.
  **Nessun chiamante**: è l'approccio scartato in favore di `functionMap`.

## La stessa interfaccia è governata da due copie del codice

`jsIndexControls.js` contiene `openTab`, `openTabTracciato`, `changeImage`, `clearSubmenu` e
`changeSubMenu` quasi identiche a queste. Non è un residuo: **sono vive tutte e due**.

- gli `onclick` scritti nel markup chiamano quelle di `index.html`;
- il codice JS chiama quelle di `jsIndexControls` — `indexNew.js:550`, `confronti.js:2094`,
  `schedaArtwork.js:20` e `47`.

Le due copie **sono già divergenti**:

| | `index.html` | `jsIndexControls.js` |
|---|---|---|
| `case 'Tab1'` → `mostraTracciato()` | sì | **no** |
| parametro `functionToCall` | sì | **no** |
| `findOpenedTab()` | no | sì |

Aprire una scheda da codice e aprirla con un click **non fanno la stessa cosa**. Chi corregge un
comportamento dei tab deve correggerlo in due punti, o accorgersi di quale dei due sta guardando.
È stato aperto un task a sé.

**Un dettaglio minore, in entrambe le copie:** nello `switch` di `openTab` il `case 'Tab8'` è senza
`break` e prosegue dentro `Tab13`. Oggi è innocuo perché le due istruzioni sono identiche; smette di
esserlo il giorno che `Tab13` cambia.
