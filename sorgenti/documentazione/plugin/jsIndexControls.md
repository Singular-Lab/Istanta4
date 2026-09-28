# jsIndexControls.js

**Cosa è:** le funzioni che governano le schede del pannello — quelle che chiama **il codice**, non
il markup.

## Da sapere prima di tutto: è una delle due copie

`index.html` contiene `openTab`, `openTabTracciato`, `changeImage`, `clearSubmenu` e
`changeSubMenu` **quasi identiche** a queste. Non è un residuo: sono vive tutte e due.

- gli `onclick` scritti negli attributi del markup chiamano quelle di `index.html`;
- il codice JS chiama queste — `indexNew.js:550`, `confronti.js:2094`, `schedaArtwork.js:20` e `47`.

Le due copie **sono già divergenti**:

| | `index.html` | `jsIndexControls.js` |
|---|---|---|
| `case 'Tab1'` → `mostraTracciato()` | sì | **no** |
| parametro `functionToCall` | sì | **no** |
| `findOpenedTab()` | no | sì |

Aprire una scheda da codice e aprirla con un click non fanno la stessa cosa. È stato aperto un task
a sé; vedi anche [index-html.md](index-html.md).

## Variabili globali

Nessuna propria. Dipende da **tre globali esterne** che non dichiara: `$` (jQuery) in quasi tutti i
metodi, `onresizeWindow` in coda a `openTab`, e `document`.

In testa fa `require('indesign')` importando `app`, `PDFExportOptions` e `CompressionQuality`, **che
poi non usa mai**: è un import residuo, e basta lui a impedire che il file si carichi sotto Node.

## Funzioni

- `clearSubmenu()` → nasconde tutti i sottomenù.
- `changeSubMenu(tabName)` → mostra il sottomenù della scheda e **simula il click sul primo
  elemento visibile**: è così che entrando in una scheda si apre già la prima sottoscheda.
- `openTab(evt, tabName)` → nasconde tutte le schede e mostra quella chiesta, con le eccezioni
  dello `switch`: `Tab5` mostra «Salva», `Tab6` «Conferma», `Tab7`, `Tab8` e `Tab13` nascondono
  entrambi. A differenza della copia in `index.html` **non gestisce `Tab1`** e non accetta una
  funzione da eseguire dopo.
- `openTabTracciato(evt, tabName)` → come sopra ma sulle schede interne del tracciato. **Nessun
  chiamante**, né qui né nel markup.
- `changeImage(sender)` → il pulsante è un'immagine e «acceso» vuol dire un file diverso: spegne il
  fratello attivo togliendo `_active` dal nome e accende il cliccato aggiungendolo.
- `findOpenedTab()` → quale scheda è accesa, letta dall'attributo `active` delle immagini della
  barra. `null` se non ce n'è nessuna.

**Un dettaglio minore, in entrambe le copie:** il `case 'Tab8'` è senza `break` e prosegue dentro
`Tab13`. Oggi è innocuo perché le due istruzioni sono identiche; smette di esserlo il giorno che
`Tab13` cambia.
