# versionePlugin.js

**Cosa è:** la regola che confronta la versione installata con quella pubblicata per il cliente.
Lavorare con un Plugin diverso da quello pubblicato vuol dire lavorare con regole diverse da quelle
del server, e i difetti che ne nascono si scoprono a impaginato fatto.

Nasce con I20-987.

## Da sapere

Gli esiti sono **tre e non due** di proposito. Se il server non risponde la versione è **non
verificabile**, non disallineata: il controllo gira a ogni avvio, e bloccare tutti per un guasto che
non è loro fermerebbe il lavoro senza motivo. Si blocca solo su una differenza vera.

**Il controllo non gira solo al login (I20-1047).** Chi non perde mai la sessione non rifaceva mai
il login, e non veniva mai bloccato anche dopo la pubblicazione di una versione nuova. Ora il ciclo
di [events](events.md) lo ripete ogni due minuti, con la stessa `controllaVersionePubblicata` del
login. Il ritmo è separato da quello di `getSession` (10 s) di proposito: la sessione costa poco, il
controllo della versione scarica il manifest pubblicato.

**L'indirizzo del manifest cambia davvero a ogni richiesta (I20-1047).** Il parametro `c` serviva
a scavalcare le cache, ma era il primo numero di un `Random` con seme fisso: sempre lo stesso, e
l'indirizzo non cambiava mai. Ora è un `Guid` nuovo, in `LoginController.ParametroAntiCache()`, che
vale anche per l'indirizzo dello zip da scaricare.

Il modulo non tocca né InDesign né il DOM: è una regola, non un pezzo di interfaccia, e per questo
si prova sotto Node da solo.

## Variabili globali

| nome | cos'è |
|---|---|
| `VersionePlugin` | l'oggetto esportato |
| `VersionePlugin.ESITO` | le tre costanti: `allineata`, `disallineata`, `nonVerificabile` |
| `VersionePlugin.INTERVALLO_CONTROLLO_MS` | ogni quanto il ciclo ricontrolla la versione: due minuti (I20-1047) |
| `VersionePlugin.ultimoControllo` | quando è partito l'ultimo controllo, del login o del ciclo; `0` se mai (I20-1047) |

Le costanti stanno qui e non sparse come stringhe perché chi chiama confronti l'esito con queste, non
con un letterale.

**Nessuna dipendenza esterna:** non usa globali del Plugin.

## Funzioni

- `confronta(installata, pubblicata)` → torna uno dei tre `ESITO`. Se **una delle due** versioni
  manca è `nonVerificabile`, non `disallineata`.
- `ripulisci(versione)` → toglie gli spazi e tratta come vuoto tutto ciò che non è stringa. È la
  ragione per cui `confronta` non esplode su `null` o su un numero.
- `siPuoLavorare(esito)` → `false` **solo** su `disallineata`. Col server che non risponde si
  continua a lavorare.
- `messaggioDisallineamento(installata, pubblicata)` → titolo e dettaglio per l'operatore. Dice
  tutte e due le versioni, perché senza non si capisce se si deve aggiornare o se si è andati avanti
  troppo, e dice cosa fare: il messaggio lo legge chi impagina, non chi ha scritto il codice.
- `eOraDiControllare(ultimoControllo, adesso, loggato, intervallo)` → `true` se si è loggati e il
  controllo non è mai partito, o sono passati almeno `intervallo` ms dall'ultimo (I20-1047). Da non
  loggati mai: senza sessione il server non risponde, e il controllo lo rifà comunque il login.
  Riceve l'ora invece di leggerla, così si prova sotto Node senza aspettare.
