# ricollegaEsiti.js

**Cosa è:** le regole del ricollegamento che non toccano InDesign — cosa dire all'operatore e dove
mettere una foto nuova. Nasce con I20-986.

Stanno qui, e non dentro alle funzioni che le usavano, per due motivi. Il primo è che così si
possono provare da sole: sono la parte che decide, ed è esattamente la parte dove si nascondevano i
difetti. Il secondo è che le due funzioni chiamate `ricollega` — quella del box e quella massiva
delle foto — stanno in file diversi e **ripetevano le stesse decisioni in modi leggermente
diversi**.

## Variabili globali

| nome | cos'è |
|---|---|
| `STATO` | i sette stati che il server manda indietro per ogni elemento |

| stato | valore |
|---|---|
| `giaImpaginato` | 1 |
| `autoImpaginato` | 2 |
| `cambioDiForma` | 3 |
| `inesistenteNellaPromo` | 4 |
| `inesistente` | 5 |
| `clonato` | 6 |
| `richiestaClonazione` | 7 |

Sono numeri che arrivano dal server: il nome sta qui perché nel codice non si leggano i numeri
nudi.

## Funzioni

- `messaggioPerElemento(elemento)` → cosa dire all'operatore per un elemento tornato dal
  ricollegamento del box, oppure niente se non c'è niente da dire.

  **Il caso che contava:** il server scrive l'errore dentro al singolo elemento, e chi chiamava
  guardava solo l'errore generale. Un ricollegamento fallito passava quindi per riuscito, con la
  scheda che si aggiornava come se fosse andata bene.

- Gli altri membri seguono la stessa logica: leggere lo `STATO` del singolo elemento e decidere
  messaggio e collocazione della foto nuova.

**Test:** `node --test tests/plugin/ricollegaEsiti.test.js`
