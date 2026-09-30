# menu.js

**Cosa è:** l'oggetto `Menu`, cinque membri: il menu flottante, i picker e il calendario. Uscito da
`utility.js` in I20-1012. È un file solo, e perciò non ha una cartella.

`indexNew.js` lo dichiara come globale, e lo usano `filtri.js`, `indexNew.js` e la scheda. Non fa
`require('indesign')` e si carica sotto Node; usa `$` e `document` al momento della chiamata.

## Funzioni

- `creaFloatingMenu({ x, y, content, className, onClose })` → un menu che galleggia nel punto
  dato. Ne esiste uno alla volta, e un clic fuori lo chiude chiamando `onClose`.
- `chiudiFloatingMenu()` → lo chiude e smette di ascoltare i clic fuori.
- `setPickerValue(picker, value)` → seleziona in un `sp-picker` la voce con quel valore, o la prima
  se non c'è. In UXP scrivere il valore non basta: si segna `selected` sulla voce giusta e si toglie
  dalle altre.
- `setPickerWidthHack(picker)` → su un pannello stretto, sotto i 700 pixel, il picker si allarga al
  passaggio del mouse fino a `maxWidth` e torna a `minWidth` quando esce.
- `registerDateMenuPicker(rootNode)` → **378 righe da sola.** Trasforma ogni `<date-menu-picker>`
  sotto `rootNode`, o in tutta la pagina, in un campo data con il suo calendario. Il campo non si
  scrive a mano: si sceglie dal calendario. Da fuori si legge `value` e si ascolta `date-change`.

## Da sapere

**Il calendario si apre come una modale**, e come le modali spegne gli elementi `.hideble` del
pannello: è per questo che `menu.js` importa [Modali](modali/modali.md).
