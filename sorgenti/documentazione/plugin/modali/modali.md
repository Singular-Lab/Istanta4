# modali.js — aprire, chiudere, confermare

**Cosa è:** l'oggetto `Modali`, undici membri suoi più i sei di [eliminazione.js](eliminazione.md)
mescolati dentro. Uscito da `utility.js` in I20-1012. Panoramica: [README.md](README.md).

## La modale principale

- `apriModal(modalId, titolo, bottoneChiusura, idElementiInTestata, hideBehind, scrollRules)` →
  apre `#overlayModal` di `index.html` con dentro **una copia** dell'elemento `modalId`, eventi
  compresi. `idElementiInTestata` sono altri elementi da copiare nella barra del titolo;
  `hideBehind` nasconde il pannello sotto; `scrollRules` si ricorda dove tornare a scorrere.
- `chiudiModal()` → la chiude, rimette il pannello e, se c'erano `scrollRules`, riporta il
  contenitore dove l'operatore l'aveva lasciato.
- `apriModalCustom(modalId, titolo, suffisso, ...)` / `chiudiModalCustom(suffisso)` → lo stesso in
  un overlay diverso, `#overlayModal` più il suffisso, per una modale sopra un'altra. La usa il
  sync del pacchetto foto.
- `closeAllModal()` → chiude popup, confirm e modale principale insieme.

## Le conferme e gli avvisi

- `confirm(message)` → **Conferma** dà `true`, **Annulla** `false`, e un errore vale come Annulla.
  `message` può essere un testo o un elemento.
- `confirmCustom(message, testo1, valore1, testo2, valore2)` → uno o due pulsanti dal testo
  scelto, più Annulla. Restituisce `{ result, hiddenVal }`: `hiddenVal` dice quale pulsante.
  Fino a I20-1040 aspettava che `hiddenVal` fosse impostato, e Annulla non lo imposta: con Annulla
  l'attesa non finiva. Ora aspetta la risposta, qualunque sia; con Annulla `result` è `false`.
  Dal I20-1040 `message` può essere anche un elemento, inserito com'è (un testo resta in un
  titolo). Se il messaggio non ci sta, prende in pixel lo spazio sopra i pulsanti e scorre: in
  UXP un contenitore scorre solo con un'altezza esplicita, e col solo `max-height` del riquadro
  il testo lungo veniva tagliato.
- `popup(title, message, taglia, alChiudi, contenutoIntestazione)` → un avviso, e attende.
  **Ha un contratto da conoscere:** rimuove il popup **prima** di chiamare `alChiudi`, e il suo
  ciclo di attesa non finisce da solo.

## I campi di testo sotto le modali

In UXP i campi di testo nativi restano disegnati **sopra** qualunque cosa, anche sopra l'overlay di
una modale. Fino a I20-1123 i campi marcati `.hideble` si spegnevano mentre una modale era aperta
(`nascondiHidebleElements`, `mostraHidebleElements`, `isElementVisible`, e `dopoLaDomanda` dopo una
domanda). Da I20-1123 i campi stanno **a riposo** come testo HTML ([campiARiposo](../campiARiposo.md))
e le modali li coprono come tutto il resto: aprendosi, `confirm`, `confirmCustom`, `popup`,
`apriModal` e `apriModalCustom` chiamano solo `CampiARiposo.tuttiARiposo()`, che rimette a riposo il
campo in cui l'operatore sta scrivendo. Alla chiusura non c'è niente da riaccendere.
