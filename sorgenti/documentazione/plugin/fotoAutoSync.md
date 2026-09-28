# fotoAutoSync.js

**Cosa è:** al cambio foto, se la foto non è nei Links, va scaricata e impaginata da sola, senza
che l'operatore prema prima «scarica» e poi «impagina». Nasce con I20-967.

Qui vive **solo la decisione** — c'è già? serve chiederla al server? il file è arrivato davvero? Le
operazioni concrete (filesystem UXP, chiamata a Istanta, download da Olimpo) arrivano dall'esterno
nell'oggetto `operazioni`, così il modulo resta privo di dipendenze da InDesign e verificabile.

## Variabili globali

| nome | cos'è |
|---|---|
| `esiti` | i sette esiti possibili, esposti per non doverli scrivere a mano nei chiamanti e nei test |

`nomeMancante`, `giaPresente`, `guidMancante`, `infoNonRecuperata`, `downloadFallito`,
`fotoAncoraAssente`, `scaricata`.

## Funzioni

- `assicuraFotoNeiLinks(nomeFoto, guidId, operazioni)` → assicura che la foto sia nella cartella
  Links, scaricandola se manca. Torna `{ presente, scaricata, motivo }`. Il chiamante **impagina
  comunque**: se `presente` è `false` si ricade sul comportamento precedente, con la riga di errore
  e i pulsanti manuali.

  Le `operazioni` che si aspetta: `fotoPresente(nomeFoto)`, `infoFoto(guidId)`,
  `scarica(recordFoto)`.

  Dopo lo scaricamento **ricontrolla che il file ci sia davvero**: il download può concludersi
  senza eccezioni e lasciare comunque la cartella vuota.

- `impaginaConRitentativo(operazioni)` → impagina ritentando **una volta sola**. Un file appena
  scritto nella cartella Links può non essere ancora visibile a InDesign quando `place()` parte
  subito dopo: il place fallisce e al suo posto finisce il segnaposto di foto non trovata. Prima
  questo non si vedeva perché fra lo scaricamento e l'impaginazione c'era il tempo di premere un
  pulsante. Il secondo tentativo torna con `ritentata` a `true`.

**Test:** `node --test tests/plugin/fotoAutoSync.test.js`
