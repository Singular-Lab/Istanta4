# reperimentoFoto/fineScaricamento.js

*Nasce con I20-1027. Lo usa [reperimentoFoto.js](operazioni.md), nel sync del pacchetto foto.*

**Cosa è:** la decisione su quando lo scaricamento del pacchetto foto è finito **davvero**, e su
cosa dire all'operatore in quel momento.

La finestra «Scaricamento pacchetto foto» esegue fino a due fasi: «Avvia sync completo» scarica le
foto (modo 0) e poi, da solo, loghi e bolli (modo 1). Prima di I20-1027 la fine delle foto scriveva
già «Operazione completata», la finestra ripartiva coi loghi, e la fine vera si riconosceva solo
dalla piccola croce ricomparsa in testata: l'operatore aspettava senza sapere se fosse finito.

Ora alla fine vera compare un pulsante **Fine** che chiude la finestra.

Non tocca InDesign, così la regola è verificabile dal test runner di Node. La applica
`ReperimentoFoto.mostraFineScaricamento`.

## Variabili globali

| nome | valore | perché |
|---|---|---|
| `modi` | `pacchettoFoto: 0`, `loghiBolli: 1`, `listaCodici: 2` | i modi di `avviaSyncPacchettoFoto` |
| `esiti` | `completato`, `nonRiuscito` | come è finita una fase. L'annullamento non c'è: chiude la finestra da sé, senza Fine |
| `messaggi` | `completata`, `fotoScaricate`, `nonRiuscito`, `terminata` | i testi della riga in alto nella finestra |

## Funzioni

- `statoAlTermine(modo, esito)` → `{ concluso, messaggio, mostraFine }`.
  - **foto completate (modo 0)**: non concluso, niente Fine, e il messaggio dice che partono loghi e
    bolli invece di dire «completata»;
  - **loghi e bolli (modo 1)** o **lista di codici dalla scheda (modo 2)** completati: «Operazione
    completata» e Fine. Il modo 1 è la fine anche del sync completo;
  - **un errore, in qualsiasi modo**: «Scaricamento non riuscito» e Fine. Il processo si è fermato,
    e la finestra non deve restare senza un modo per chiuderla;
  - **un modo sconosciuto**: Fine, con un messaggio neutro che non promette niente.

## Dove si applica

`ReperimentoFoto.mostraFineScaricamento(modo, esito)` scrive il messaggio e, se serve, mostra Fine e
la croce e toglie «riduci a icona» e «annulla». Passa **sempre** da `#overlayModalDownloadFoto`: la
finestra è un clone del modello `dialogSyncPacchettoFoto` di `index.html`, e a finestra chiusa, come
nell'impaginazione del libro che scarica senza aprirla, un `$("#…")` globale cambierebbe il modello.
Fine resterebbe visibile e comparirebbe già all'apertura successiva.

Alla fine vera, `mostraFineScaricamento` toglie anche l'operazione da `syncFotoInCorso`. Sulle strade
d'errore prima non la toglieva nessuno, e `apriSchermataSyncPacchettoFoto`, trovandola, rimostrava la
finestra già chiusa e vuota invece di avviare un nuovo scaricamento.

Se la finestra era ridotta a icona, alla fine dei loghi si chiude da sola col messaggio verde
«Scaricamento delle immagini completato», come prima: l'operatore non la sta guardando.

**Test:** `node --test tests/plugin/fineScaricamentoFoto.test.js`
