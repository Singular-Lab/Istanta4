# cssSequenzaOperazioni.js

**Cosa è:** il momento in cui una regola del framework CSS viene eseguita.

L'ordine delle operazioni su un box è fisso — ridimensionamenti, post ridimensionamenti,
allineamenti, infine la sistemazione delle foto. Va bene quasi sempre, ma alcune regole hanno senso
solo **dopo** che le foto hanno preso la posizione definitiva: prima di allora si allineerebbero a
qualcosa che sta ancora per spostarsi.

Invece di rendere configurabile l'intera sequenza, ogni regola dichiara in quale momento vuole
essere eseguita, e il motore riceve un DB già filtrato: **non sa nemmeno che i momenti esistono**. È
il motivo per cui questo meccanismo resta piccolo.

## Da sapere

- Una regola senza `fase` appartiene al momento standard: a dati invariati l'ordine è esattamente
  quello di prima.
- Il DB originale **non viene mai toccato**. È lo stesso oggetto per tutti i box della lavorazione,
  e una modifica in posto si porterebbe dietro il box successivo.
- **Limite noto, dichiarato nel codice:** una regola di un livello più specifico sopprime quella
  omonima del livello di default solo se le due si incontrano nello stesso momento. Una regola e la
  sua sovrascrittura vanno tenute sulla stessa fase.

## Variabili globali

| nome | valore | cos'è |
|---|---|---|
| `standard` | `"standard"` | il momento in cui gira tutto quello che non dice altro |
| `dopoFixFoto` | `"dopoFixFoto"` | dopo che le foto hanno preso la posizione definitiva |
| `momenti` | `["standard", "dopoFixFoto"]` | in ordine di esecuzione |
| `chiaviRegole` | `["ridimensionamenti", "postRidimensionamenti", "allineamenti"]` | le famiglie di regole che partecipano ai momenti |

Due scelte, non conseguenze:

- `momenti` è **l'unico modo previsto per estenderli**: si aggiunge una voce qui, non si tocca il
  motore.
- `duplicazioni` e `ordiniZ` restano fuori da `chiaviRegole` **di proposito**: la composizione del
  box viene rieseguita in ogni momento, perché gli elementi derivati devono inseguire i propri
  bersagli tutte le volte che questi si spostano.

## Funzioni

- `normalizzaMomento(fase)` → un valore assente, vuoto o sconosciuto vale come `standard`: **un
  refuso nel dato non deve far sparire una regola**, al massimo la lascia dov'era. Il caso
  sconosciuto lascia un avviso in console.
- `regolaNelMomento(regola, momento)` → il confronto passa da `normalizzaMomento` su entrambi i
  lati, così una regola senza fase e una richiesta di `"standard"` si incontrano.
- `filtraRegole(regole, momento)` → un elenco assente resta assente, uno vuoto resta vuoto: chi
  chiama distingue «non ci sono regole» da «non ce ne sono per adesso».
- `filtraDBPerMomento(DB, momento)` → copia del DB con le sole regole del momento.
- `esistonoRegole(DB, momento)` → serve a **non pagare un giro di operazioni a vuoto** su ogni box
  quando nessun cliente usa il momento.

**Test:** `node --test tests/plugin/cssSequenzaOperazioni.test.js`
